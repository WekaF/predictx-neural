import { TradeSignal, ExecutedTrade, AppSettings } from "../types";
import { storageService } from "./storageService";

const getSettings = (): AppSettings => {
    return storageService.getSettings();
};

// Helper to perform the fetch with a fallback strategy
const reliableFetch = async (url: string, method: 'POST' | 'GET', payload: any) => {
    let finalUrl = url;
    let body = undefined;

    // Detect if this is an n8n Test URL
    const isN8nTest = url.includes('webhook-test');

    // Build URL/Body based on method
    if (method === 'GET') {
        try {
            const urlObj = new URL(url);
            Object.keys(payload).forEach(key => {
                if (typeof payload[key] === 'object') {
                    urlObj.searchParams.append(key, JSON.stringify(payload[key]));
                } else {
                    urlObj.searchParams.append(key, String(payload[key]));
                }
            });
            finalUrl = urlObj.toString();
        } catch (e) {
            console.error("Invalid URL construction for GET request", e);
            throw new Error("Invalid URL format");
        }
    } else {
        body = JSON.stringify(payload);
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    const options: RequestInit = {
        method,
        headers,
        body,
        credentials: 'omit',
        cache: 'no-cache'
    };

    // Helper for fetch with timeout
    const fetchWithTimeout = async (u: string, opts: RequestInit, timeout = 10000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(u, { ...opts, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    };

    const isLocalhost = finalUrl.includes('localhost') || finalUrl.includes('127.0.0.1');
    const errors: string[] = [];

    // --- STRATEGY: DIRECT -> CORSPROXY -> BLIND FALLBACK ---

    // 1. Direct Connection
    try {
        console.log(`[Webhook] Attempting Direct: ${finalUrl}`);
        const response = await fetchWithTimeout(finalUrl, options);
        if (response.ok) return { success: true };
        
        // Handle specific HTTP errors
        const errText = `Direct: ${response.status} ${response.statusText}`;
        console.warn(`[Webhook] ${errText}`);
        
        if (response.status === 404 && isN8nTest) {
             errors.push("N8N Test URL not listening (404). Click 'Execute Node' in n8n.");
        } else {
             errors.push(errText);
        }

        if (isLocalhost) {
             throw new Error(`Localhost connection failed (${response.status}).`);
        }
    } catch (error: any) {
        console.warn(`[Webhook] Direct fetch network error:`, error);
        
        let msg = error.message;
        if (msg === 'Failed to fetch' && isN8nTest) {
            msg = "Network blocked. Ensure n8n is active/listening.";
        }
        errors.push(`Direct Network: ${msg}`);
        
        if (isLocalhost) {
            throw new Error(`Localhost failed. Ensure server is running. (${msg})`);
        }
    }

    // 2. Proxy: corsproxy.io (Only if NOT Localhost)
    // Most other proxies (AllOrigins, ThingProxy) DO NOT support POST bodies correctly.
    if (!isLocalhost) {
        try {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(finalUrl)}`;
            console.log(`[Webhook] Attempting Proxy: ${proxyUrl}`);
            const response = await fetchWithTimeout(proxyUrl, options);
            if (response.ok) return { success: true, usedProxy: true };
            errors.push(`Proxy: ${response.status}`);
        } catch (error: any) {
            console.warn(`[Webhook] Proxy failed:`, error);
            errors.push(`Proxy Error: ${error.message}`);
        }
    }

    // 3. Fallback: Blind Request (no-cors)
    try {
        console.log(`[Webhook] Attempting Blind Send (no-cors): ${finalUrl}`);
        
        const blindOptions: RequestInit = {
            method: method,
            mode: 'no-cors',
            credentials: 'omit',
            cache: 'no-cache'
        };

        if (method === 'POST') {
            // 'application/json' is NOT allowed in no-cors mode (browser will block it or revert to simple request)
            // We MUST use text/plain. N8N will receive a string body.
            blindOptions.headers = { 'Content-Type': 'text/plain' }; 
            blindOptions.body = body;
        }
        
        await fetch(finalUrl, blindOptions);
        
        // Short, actionable warning for the UI
        let warningMsg = "Blind Mode active. Data sent as text/plain. See Settings for N8N fix.";
        
        return { 
            success: true, 
            usedProxy: false, 
            warning: warningMsg
        };
    } catch (e: any) {
        console.warn("Blind send failed", e);
        errors.push(`Blind Mode: ${e.message}`);
    }

    // If we get here, everything failed.
    throw new Error(errors.join(' | '));
};

// --- DUPLICATE PREVENTION ---
// Track sent signals to prevent duplicates within 30 seconds
const sentSignals = new Map<string, number>();

const isDuplicate = (signalId: string): boolean => {
    const now = Date.now();
    const lastSent = sentSignals.get(signalId);
    
    if (lastSent && (now - lastSent) < 30000) { // 30 seconds window
        console.warn(`[Webhook] ⚠️ Duplicate signal detected: ${signalId} (sent ${((now - lastSent) / 1000).toFixed(1)}s ago)`);
        return true;
    }
    
    // Mark as sent
    sentSignals.set(signalId, now);
    
    // Cleanup old entries (older than 1 minute)
    for (const [id, timestamp] of sentSignals.entries()) {
        if (now - timestamp > 60000) {
            sentSignals.delete(id);
        }
    }
    
    return false;
};

export const sendWebhookNotification = async (
    event: 'SIGNAL_ENTRY' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE',
    data: TradeSignal | ExecutedTrade,
    price?: number
): Promise<{ success: boolean; skipped?: boolean; error?: string; warning?: string }> => {
    const settings = getSettings();
    
    if (!settings.enableNotifications || !settings.webhookUrl) {
        console.warn("Webhook attempt skipped: Notifications disabled or URL missing.");
        return { success: false, skipped: true };
    }
    
    // Check for duplicates (only for SIGNAL_ENTRY events)
    if (event === 'SIGNAL_ENTRY' && data.id && isDuplicate(data.id)) {
        console.log(`[Webhook] ✅ Skipped duplicate signal: ${data.id}`);
        return { success: true, skipped: true }; // Return success to avoid error notifications
    }

    // Create a rich message format suitable for Telegram/Slack
    let message = "";
    let emoji = "";
    const symbol = data.symbol || 'Unknown Pair';

    switch (event) {
        case 'SIGNAL_ENTRY':
            emoji = data.type === 'BUY' ? '🟢' : '🔴';
            message = `${emoji} *${symbol} - ${data.type} SIGNAL*\n\n` +
                      `*Asset:* ${symbol}\n` +
                      `*Action:* ${data.type}\n` +
                      `*Entry Price:* $${data.entryPrice}\n` +
                      `*Stop Loss:* $${data.stopLoss}\n` +
                      `*Take Profit:* $${data.takeProfit}\n` +
                      `*Confidence:* ${(data as TradeSignal).confidence}%\n` +
                      `*Reason:* ${(data as TradeSignal).reasoning || 'Manual Entry'}`;
            break;
        case 'TAKE_PROFIT':
            emoji = '💰';
            message = `${emoji} *${symbol} - TAKE PROFIT HIT ✅*\n\n` +
                      `*Asset:* ${symbol}\n` +
                      `*Position:* ${data.type}\n` +
                      `*Exit Price:* $${price}\n` +
                      `*Result:* PROFIT 💵`;
            break;
        case 'STOP_LOSS':
            emoji = '🛑';
            message = `${emoji} *${symbol} - STOP LOSS HIT ❌*\n\n` +
                      `*Asset:* ${symbol}\n` +
                      `*Position:* ${data.type}\n` +
                      `*Exit Price:* $${price}\n` +
                      `*Result:* LOSS`;
            break;
        case 'MANUAL_CLOSE':
            emoji = '⚠️';
            message = `${emoji} *${symbol} - MANUAL CLOSE*\n\n` +
                      `*Asset:* ${symbol}\n` +
                      `*Position:* ${data.type}\n` +
                      `*Exit Price:* $${price}`;
            break;
    }

    const payload = {
        event,
        asset: symbol,
        timestamp: new Date().toISOString(),
        message: message, 
        raw_data: {
            ...data,
            symbol: symbol,
            current_price: price
        }
    };

    try {
        const result: any = await reliableFetch(settings.webhookUrl, settings.webhookMethod, payload);
        return { success: true, warning: result.warning };
    } catch (e: any) {
        console.error("Webhook Execution Failed", e);
        return { success: false, error: e.message };
    }
};

export const testWebhook = async (
    url: string, 
    method: 'POST' | 'GET',
    eventType: 'SIGNAL_ENTRY' | 'TAKE_PROFIT' | 'STOP_LOSS' = 'SIGNAL_ENTRY'
) => {
    let mockData: any = {};
    const timestamp = new Date().toISOString();

    if (eventType === 'SIGNAL_ENTRY') {
        mockData = {
            event: 'SIGNAL_ENTRY',
            asset: 'BTC/USD',
            timestamp,
            message: '🟢 *TEST SIGNAL (BUY)*\n\n*Pair:* BTC/USD\n*Type:* BUY\n*Entry:* $50000\n*Stop Loss:* $49000\n*Take Profit:* $52000',
            raw_data: {
                id: 'test-id-entry',
                symbol: 'BTC/USD',
                type: 'BUY',
                entryPrice: 50000,
                stopLoss: 49000,
                takeProfit: 52000,
                reasoning: 'Test Signal',
                confidence: 95,
                timestamp: Date.now(),
                current_price: 50000
            }
        };
    } else if (eventType === 'TAKE_PROFIT') {
        mockData = {
            event: 'TAKE_PROFIT',
            asset: 'BTC/USD',
            timestamp,
            message: '💰 *TEST TAKE PROFIT*\n\n*Pair:* BTC/USD\n*Type:* BUY\n*Closed At:* $52000\n*PNL:* PROFIT',
            raw_data: {
                id: 'test-id-tp',
                symbol: 'BTC/USD',
                type: 'BUY',
                entryPrice: 50000,
                exitPrice: 52000,
                stopLoss: 49000,
                takeProfit: 52000,
                pnl: 200,
                outcome: 'WIN',
                current_price: 52000
            }
        };
    } else if (eventType === 'STOP_LOSS') {
        mockData = {
            event: 'STOP_LOSS',
            asset: 'BTC/USD',
            timestamp,
            message: '🛑 *TEST STOP LOSS*\n\n*Pair:* BTC/USD\n*Type:* BUY\n*Closed At:* $49000\n*PNL:* LOSS',
            raw_data: {
                id: 'test-id-sl',
                symbol: 'BTC/USD',
                type: 'BUY',
                entryPrice: 50000,
                exitPrice: 49000,
                stopLoss: 49000,
                takeProfit: 52000,
                pnl: -100,
                outcome: 'LOSS',
                current_price: 49000
            }
        };
    }

    try {
        const result: any = await reliableFetch(url, method, mockData);
        return { success: true, error: null, usedProxy: result.usedProxy, warning: result.warning };
    } catch (e: any) {
        return { success: false, error: e.message || 'Network Error' };
    }
};