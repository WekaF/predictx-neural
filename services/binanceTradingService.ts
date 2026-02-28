/**
 * Binance Authenticated Trading Service
 * Handles authenticated API calls for account info, orders, and trading
 */

import crypto from 'crypto-js';

// CORS Proxies for browser requests
const CORS_PROXIES = [
    { name: 'corsproxy', url: 'https://corsproxy.io/?', needsEncoding: true },
    { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=', needsEncoding: true },
    { name: 'thingproxy', url: 'https://thingproxy.freeboard.io/fetch/', needsEncoding: false }
];

// Binance API Configuration with Testnet Support
const BINANCE_PRODUCTION_API = 'https://api.binance.com';
const BINANCE_TESTNET_API = 'https://testnet.binancefuture.com';
const LOCAL_PROXY_API = '/ai-api/proxy';

// Local cache for symbol filters
const symbolFilterCache = new Map<string, { stepSize: number, tickSize: number, precision: number, minQty: number, minNotional: number }>();

// Internal state for trading mode
let currentMode: 'paper' | 'live' = 'paper';

/**
 * Update the active trading mode
 */
export function setMode(mode: 'paper' | 'live') {
    console.log(`[Binance Trading] 🔄 Mode switched to: ${mode.toUpperCase()}`);
    currentMode = mode;
}

/**
 * Get API base URL based on testnet setting and environment
 * - Development: Uses local proxy to avoid CORS
 * - Production: Uses Railway backend proxy (deployed separately)
 */
function getApiBase(): string {
    const isDev = import.meta.env.DEV;
    const isProduction = import.meta.env.PROD;
    const railwayBackendUrl = import.meta.env.VITE_BACKEND_URL; // Set in Vercel env vars
    
    // DEVELOPMENT MODE: Always use local backend proxy
    if (isDev) {
        console.log('[Binance Trading] 🔧 Development: Using local backend proxy');
        return '/ai-api/proxy';
    }
    
    // PRODUCTION MODE: Use Railway backend
    // PRODUCTION MODE: Use Railway backend
    if (isProduction) {
        if (railwayBackendUrl) {
            let backendUrl = railwayBackendUrl;
            if (!backendUrl.startsWith('http')) {
                backendUrl = `https://${backendUrl}`;
            }
            console.log('[Binance Trading] 📡 Production: Using Railway Backend at', backendUrl);
            // DIRECT BACKEND ACCESS: Use real /api prefix, not the /ai-api dev proxy prefix
            return `${backendUrl}/api/proxy`;
        } else {
            console.warn('[Binance Trading] ⚠️ VITE_BACKEND_URL not set! Please deploy backend to Railway or enable Paper Trading.');
            // Fallback: Try direct API (will likely fail with CORS)
            try {
                const settings = localStorage.getItem('neurotrade_settings');
                const useTestnet = settings ? JSON.parse(settings).useTestnet : true;
                return useTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';
            } catch {
                return 'https://fapi.binance.com';
            }
        }
    }
    
    // Fallback (should not reach here)
    return '/ai-api/proxy';
}

// Load API credentials from environment (works in both browser and Node.js)
// Support separate keys for production and testnet
function getApiCredentials(): { apiKey: string; secretKey: string } {
    const isTestnet = (() => {
        // If tradingMode is 'live', we FORCE production keys regardless of settings
        if (currentMode === 'live') return false;
        
        try {
            const settings = localStorage.getItem('neurotrade_settings');
            return settings ? JSON.parse(settings).useTestnet : true;
        } catch {
            return true;
        }
    })();

    // Helper to mask keys for logging
    const mask = (s?: string) => s ? `${s.substring(0, 4)}...${s.substring(s.length - 4)}` : 'MISSING';

    if (isTestnet) {
        const testnetKey = typeof import.meta !== 'undefined' && import.meta.env 
            ? import.meta.env.VITE_BINANCE_API_KEY_TESTNET 
            : process.env.VITE_BINANCE_API_KEY_TESTNET;
        const testnetSecret = typeof import.meta !== 'undefined' && import.meta.env
            ? import.meta.env.VITE_BINANCE_API_SECRET_TESTNET
            : process.env.VITE_BINANCE_API_SECRET_TESTNET;
        
        console.log(`[Binance Auth] Loading TESTNET credentials: Key=${mask(testnetKey)}, Secret=${mask(testnetSecret)}`);
        
        if (testnetKey && testnetSecret) {
            return { apiKey: testnetKey, secretKey: testnetSecret };
        } else {
            console.error('[Binance Auth] ❌ Testnet keys missing! To use Testnet, set VITE_BINANCE_API_KEY_TESTNET and VITE_BINANCE_API_SECRET_TESTNET in .env.local');
            return { apiKey: '', secretKey: '' };
        }
    }

    // Fallback to production keys
    const prodKey = typeof import.meta !== 'undefined' && import.meta.env 
        ? import.meta.env.VITE_BINANCE_API_KEY 
        : process.env.VITE_BINANCE_API_KEY;
    const prodSecret = typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_BINANCE_SECRET_KEY
        : process.env.VITE_BINANCE_SECRET_KEY;

    console.log(`[Binance Auth] Loading PROD credentials: Key=${mask(prodKey)}, Secret=${mask(prodSecret)}`);

    return { apiKey: prodKey || '', secretKey: prodSecret || '' };
}

/**
 * Generate HMAC SHA256 signature for Binance API
 */
function generateSignature(queryString: string): string {
    const { secretKey } = getApiCredentials();
    return crypto.HmacSHA256(queryString, secretKey).toString();
}

/**
 * Helper to fetch with CORS proxy fallback
 */
async function fetchWithProxy(url: string, options: RequestInit = {}): Promise<Response> {
    // 0. If using local proxy (Vite), try first but allow fallback
    if (url.startsWith('/')) {
        console.log(`[Binance] Fetching via local proxy: ${url}`);
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            
            const text = await response.text();
            console.warn(`[Binance] Local Proxy failed (${response.status}): ${text.substring(0, 100)}... Switching to CORS proxies.`);
        } catch (e) {
            console.warn(`[Binance] Local Proxy network error. Switching to CORS proxies.`, e);
        }
    }

    // 1. Try direct request first (for production or non-proxy envs)
    try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        // If not ok, throw to trigger fallback (unless it's a 4xx error from API that we should handle)
        if (response.status === 0 || response.status === 403 || response.type === 'opaque' || response.type === 'error') {
            throw new Error('CORS or Network Error');
        }
        return response;
    } catch (error) {
        console.warn(`[Binance] Direct fetch failed for ${url}, trying proxies...`);
    }

    // 2. Try proxies (Only for full URLs)
    console.log(`[Binance] Available proxies: ${CORS_PROXIES.length}`);
    for (const proxy of CORS_PROXIES) {
        try {
            const proxyUrl = proxy.needsEncoding 
                ? `${proxy.url}${encodeURIComponent(url)}`
                : `${proxy.url}${url}`;
            
            console.log(`[Binance] Trying ${proxy.name} proxy... URL: ${proxyUrl.substring(0, 50)}...`);
            
            // Proxies usually only support GET well, but for Binance we mostly use GET
            // For POST/DELETE we might need specific proxy config or passthrough
            // const proxyOptions = { ...options, method: 'GET' }; 
            
            const response = await fetch(proxyUrl, options);
            
            if (response.ok) {
                console.log(`[Binance] ✅ Success via ${proxy.name} proxy`);
                return response;
            } else {
                console.warn(`[Binance] ⚠️ ${proxy.name} proxy responded with status: ${response.status}`);
            }
        } catch (e) {
            console.warn(`[Binance] ❌ ${proxy.name} proxy failed:`, e);
        }
    }

    // Final error with helpful message
    const isProduction = import.meta.env.PROD;
    const errorMsg = isProduction 
        ? `❌ Connection failed (${url.substring(0, 50)}...). Please ensure VITE_BACKEND_URL is set in Vercel to your Railway app, and check your network.`
        : `All connection attempts failed to ${url.substring(0, 50)}. Check console for details.`;
    
    console.error(`[Binance] ${errorMsg}`);
    throw new Error(errorMsg);
}
/**
 * Format parameter value to string, specifically avoiding scientific notation for numbers
 */
function formatParameter(val: any): string {
    if (typeof val === 'number') {
        // Handle zero and non-finite numbers explicitly 
        if (!Number.isFinite(val)) return "0";
        if (val === 0) return "0";
        
        // Use toFixed(8) for crypto precision
        let s = val.toFixed(8);
        
        // Only strip trailing zeros if there's a decimal point
        if (s.includes('.')) {
            s = s.replace(/0+$/, ''); // Strip trailing zeros
            s = s.replace(/\.$/, '');  // Strip trailing dot if no decimals left
        }
        return s;
    }
    return String(val);
}

/**
 * Get Binance server time to sync timestamps
 */
// ...
let serverTimeOffset = 0;
let isTimeSynced = false;

/**
 * Get Binance server time to sync timestamps
 */
export async function syncServerTime(force = false): Promise<void> {
    if (isTimeSynced && !force) return;

    try {
        console.log('[Binance Auth] ⏳ Syncing server time...');
        
        let baseUrl = getApiBase();
        // If production/fallback logic touches this, map correctly
        if (baseUrl === '/api/binance') baseUrl = '/api/futures'; 

        // Use Futures time endpoint (Root + /fapi/v1/time)
        const url = `${baseUrl}/fapi/v1/time`;
        
        const response = await fetchWithProxy(url);
        const data = await response.json();
        const serverTime = data.serverTime;
        const localTime = Date.now();
        
        // Calculate offset
        serverTimeOffset = serverTime - localTime;
        isTimeSynced = true;
        
        console.log(`[Binance Auth] ⏰ Time synced. Offset: ${serverTimeOffset}ms (Server: ${serverTime}, Local: ${localTime})`);
    } catch (error) {
        console.error('[Binance Auth] ❌ Could not sync server time:', error);
        // Fallback: subtract 1000ms to be safe against "ahead" errors
        if (!isTimeSynced) serverTimeOffset = -1000;
    }
}

/**
 * Make authenticated request to Binance API
 */
async function authenticatedRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    params: Record<string, any> = {}
): Promise<any> {
    const { apiKey, secretKey } = getApiCredentials();
    
    if (!apiKey || !secretKey) {
        throw new Error('Binance API credentials not configured. Please set VITE_BINANCE_API_KEY and VITE_BINANCE_SECRET_KEY in .env.local');
    }

    // CRITICAL: Always check sync status before authenticated requests
    if (!isTimeSynced) await syncServerTime();

    // Timestamp Calculation Strategy
    // We subtract a buffer to ensure we are sufficiently "behind" server time to satisfy "Timestamp ahead" check
    // But within "recvWindow" to satisfy "Timestamp too old" check.
    // Proxy latency adds to the "age" of the request when it reaches Binance.
    // Buffer: 2500ms (Safe zone)
    const getTimestamp = () => Date.now() + serverTimeOffset - 2500;
    
    let currentTimestamp = getTimestamp();
    
    // Prepare initial parameters
    let currentParams = {
        ...params,
        timestamp: currentTimestamp,
        recvWindow: 60000 // Increased to 60s for slower proxies and to prevent timestamp errors
    };

    const makeRequest = async (requestParams: any) => {
        // Create query string using formatParameter helper
        // CRITICAL: URL-encode values to prevent signature mismatch.
        // Without encoding, JSON values like batchOrders=[{"symbol":...}] get signed raw,
        // but the browser/proxy URL-encodes them before sending → Binance sees different
        // query string than what was signed → -1022 Signature invalid.
        const queryString = Object.entries(requestParams)
            .map(([key, value]) => `${key}=${encodeURIComponent(formatParameter(value))}`)
            .join('&');

        // Generate signature
        const signature = generateSignature(queryString);
        const signedQueryString = `${queryString}&signature=${signature}`;

        // Determine Base URL
        let baseUrl = getApiBase();
        
        // Check if using ANY proxy (Local or Railway)
        // Local uses /ai-api/proxy, Production uses /api/proxy
        const isProxy = baseUrl.includes('/ai-api/proxy') || baseUrl.includes('/api/proxy');

        if (endpoint.startsWith('/fapi')) {
             // If direct Binance API (fallback), adjust base path if needed
            if (baseUrl === '/api/binance') baseUrl = '/api/futures';
        }

        // Construct URL
        let url = `${baseUrl}${endpoint}?${signedQueryString}`;
        
        // Append testnet flag for Proxy (both local and production Railway)
        if (isProxy) {
            const isTestnetFlag = (() => {
                // If currentMode is live, we force testnet=false
                if (currentMode === 'live') return false;
                
                try {
                    const settings = localStorage.getItem('neurotrade_settings');
                    return settings ? JSON.parse(settings).useTestnet : true;
                } catch {
                    return true;
                }
            })();
            url += `&testnet=${isTestnetFlag}`;
        }
        
        console.log(`[Binance Auth] ${method} ${endpoint} | TS: ${requestParams.timestamp} | Offset: ${serverTimeOffset}`);

        const response = await fetchWithProxy(url, {
            method,
            headers: {
                'X-MBX-APIKEY': apiKey
                // NOTE: Do NOT send Content-Type: application/json for Binance signed requests.
                // All params go via query string, not body. Sending Content-Type: application/json
                // with empty body causes the backend proxy (FastAPI) to return 400 Bad Request.
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Binance API Error: ${response.status}`;
            let errorCode = null;

            // Try to parse JSON error if possible
            try {
                const jsonError = JSON.parse(errorText);
                errorMessage = jsonError.msg || jsonError.message || errorMessage;
                errorCode = jsonError.code;
            } catch (e) {
                errorMessage = `${errorMessage} - ${errorText.substring(0, 200)}`;
            }

            // DETAILED HANDLING FOR 401/403 (AUTHENTICATION/PERMISSION)
            if (response.status === 401 || response.status === 403 || errorCode === -2015) {
                console.error(`[Binance Auth] 🔐 AUTH ERROR DETECTED: ${errorMessage}`);
                
                const helpMsg = `
❌ Binance Authentication Failed (${response.status})
Common causes:
1. API Key/Secret is incorrect.
2. IP Whitelisting is blocking this request.
3. API Key does not have "Enable Futures" permissions.

Please visit Binance API Management to verify settings.
                `.trim();
                
                throw new Error(helpMsg);
            }

            throw new Error(errorMessage);
        }

        // Validate Content-Type for JSON
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('application/json')) {
             const text = await response.text();
             // Check if it's the index.html (React App)
             if (text.includes('<!DOCTYPE html>') || text.includes('<div id="root">')) {
                 throw new Error(`API Connection Failed: Endpoint not found (served HTML). URL: ${endpoint}`);
             }
             throw new Error(`Invalid API Response (Not JSON): ${text.substring(0, 100)}`);
        }

        return await response.json();
    };

    try {
        return await makeRequest(currentParams);
    } catch (error: any) {
        // AUTO-RETRY LOGIC for Timestamp/Sync errors (-1021)
        if (error.message.includes('-1021') || 
            error.message.includes('Timestamp for this request') || 
            error.message.includes('recvWindow') ||
            (error.message.includes('Invalid Timestamp') && !params.timestamp)) {
            
            console.warn('[Binance Auth] ⚠️ Timestamp sync error detected. Force re-syncing and retrying...');
            
            // Force Update Server Time
            await syncServerTime(true);
            
            // Re-calculate timestamp with new offset
            currentTimestamp = getTimestamp();
            currentParams = {
                ...params,
                timestamp: currentTimestamp,
                recvWindow: 60000 // Maximize window on retry
            };
            
            console.log(`[Binance Auth] 🔄 Retrying with new Offset: ${serverTimeOffset}ms`);
            return await makeRequest(currentParams);
        }
        
        console.error('[Binance Auth] API Error:', error);
        throw error;
    }
}

/**
 * Get account information
 */
export async function getAccountInfo(): Promise<any> {
    console.log('[Binance Auth] Fetching account info...');
    const data = await authenticatedRequest('/fapi/v2/account');
    console.log('[Binance Auth] ✅ Account info retrieved');
    return data;
}

/**
 * Get account balances
 */
/**
 * Get account balances
 * Handles both Spot (balances) and Futures (assets) response structures
 */
export async function getAccountBalances(): Promise<any[]> {
    const accountInfo = await getAccountInfo();
    
    // Handle Futures API (uses 'assets')
    if (accountInfo.assets && Array.isArray(accountInfo.assets)) {
        console.log('[Binance Auth] Detected Futures Account assets');
        return accountInfo.assets
            .filter((a: any) => parseFloat(a.walletBalance) > 0 || parseFloat(a.marginBalance) > 0)
            .map((a: any) => ({
                asset: a.asset,
                free: a.availableBalance, // Available for trade
                locked: (parseFloat(a.walletBalance) - parseFloat(a.availableBalance)).toFixed(8),
                marginBalance: a.marginBalance, // Total Equity (Wallet + Unrealized PNL)
                unrealizedPNL: a.unrealizedProfit
            }));
    }

    // Handle Spot API (uses 'balances')
    if (accountInfo.balances && Array.isArray(accountInfo.balances)) {
        return accountInfo.balances.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
    }
    
    console.warn('[Binance Auth] No balances or assets found in account info');
    return [];
}

/**
 * Get open orders
 */
export async function getOpenOrders(symbol?: string): Promise<any[]> {
    console.log('[Binance Auth] Fetching open orders...');
    const params = symbol ? { symbol } : {};
    const data = await authenticatedRequest('/fapi/v1/openOrders', 'GET', params);
    console.log(`[Binance Auth] ✅ Found ${data.length} open orders`);
    return data;
}

/**
 * Get all orders (open and closed)
 */
export async function getAllOrders(symbol: string, limit: number = 500): Promise<any[]> {
    console.log(`[Binance Auth] Fetching all orders for ${symbol}...`);
    const data = await authenticatedRequest('/fapi/v1/allOrders', 'GET', { symbol, limit });
    console.log(`[Binance Auth] ✅ Found ${data.length} orders`);
    return data;
}

/**
 * Get a specific open order (as requested by user)
 * Endpoint: /fapi/v1/openOrder
 */
export async function getOpenOrder(symbol: string, orderId: number): Promise<any> {
    console.log(`[Binance Auth] Fetching open order ${orderId} for ${symbol}...`);
    const data = await authenticatedRequest('/fapi/v1/openOrder', 'GET', { symbol, orderId });
    console.log(`[Binance Auth] ✅ Order status: ${data.status}`);
    return data;
}

/**
 * Get a specific order (open or filled)
 * Endpoint: /fapi/v1/order
 */
export async function getOrder(symbol: string, orderId: number): Promise<any> {
    console.log(`[Binance Auth] Fetching order ${orderId} for ${symbol}...`);
    const data = await authenticatedRequest('/fapi/v1/order', 'GET', { symbol, orderId });
    console.log(`[Binance Auth] ✅ Order status: ${data.status}`);
    return data;
}

/**
 * Get current open positions (Risk)
 * Endpoint: /fapi/v2/positionRisk
 */
export async function getPositions(symbol?: string): Promise<any[]> {
    // console.log('[Binance Auth] Fetching positions...'); // Reduce spam
    const params = symbol ? { symbol } : {};
    const data = await authenticatedRequest('/fapi/v2/positionRisk', 'GET', params);
    
    // DEBUG: Log raw data to see what Binance is actually returning
    if (symbol) {
        console.log(`[Binance Auth] RAW Position Data for ${symbol}:`, data);
    }
    
    // Filter out empty positions
    const activePositions = Array.isArray(data) 
        ? data.filter((p: any) => parseFloat(p.positionAmt) !== 0)
        : [];
        
    // console.log(`[Binance Auth] ✅ Found ${activePositions.length} active positions`);
    return activePositions;
}

export async function placeOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
    quantity: string | number;
    price?: string | number;
    stopPrice?: string | number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    reduceOnly?: boolean;
    closePosition?: boolean;
}): Promise<any> {
    console.log('[Binance Auth] Placing order:', params);
    
    const orderParams: any = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity
    };

    if (params.reduceOnly) {
        orderParams.reduceOnly = 'true';
    }

    if (params.closePosition) {
        orderParams.closePosition = 'true';
        // When closePosition is used, quantity should NOT be sent or should be ignored by Binance for STOP_MARKET/TAKE_PROFIT_MARKET
        delete orderParams.quantity;
    }

    if (params.type === 'LIMIT') {
        orderParams.price = params.price;
        orderParams.timeInForce = params.timeInForce || 'GTC';
    }

    // STOP_LOSS_LIMIT and TAKE_PROFIT_LIMIT need price AND stopPrice
    if (params.type === 'STOP_LOSS_LIMIT' || params.type === 'TAKE_PROFIT_LIMIT') {
        orderParams.price = params.price;
        orderParams.stopPrice = params.stopPrice;
        orderParams.timeInForce = params.timeInForce || 'GTC';
    }

    // STOP_MARKET and TAKE_PROFIT_MARKET only need stopPrice
    if (params.type === 'STOP_MARKET' || params.type === 'TAKE_PROFIT_MARKET' || params.type === 'STOP_LOSS' || params.type === 'TAKE_PROFIT') {
        orderParams.stopPrice = params.stopPrice;
    }

    try {
        const data = await authenticatedRequest('/fapi/v1/order', 'POST', orderParams);
        console.log('[Binance Auth] ✅ Order placed:', data.orderId);
        return data;
    } catch (error: any) {
        console.error('[Binance Auth] ❌ Order placement failed:', error);
        
        // Parse Binance error codes and provide user-friendly messages
        const errorMsg = error.message || JSON.stringify(error);
        
        if (errorMsg.includes('-2019') || errorMsg.includes('Margin is insufficient')) {
            throw new Error('❌ Insufficient balance. Please reduce position size or add funds to your testnet account at https://testnet.binancefuture.com');
        }
        if (errorMsg.includes('-2021')) {
            throw new Error('❌ Immediate Trigger: Order would trigger immediately. Please adjust stop price.');
        }
        if (errorMsg.includes('-1111') || errorMsg.includes('Precision')) {
            throw new Error('❌ Invalid quantity or price precision. Please check symbol filters.');
        }

        if (errorMsg.includes('-1111') || errorMsg.includes('Precision')) {
            throw new Error('❌ Invalid quantity or price precision. Please check symbol filters.');
        }
        if (errorMsg.includes('-1021') || errorMsg.includes('Timestamp')) {
            throw new Error('❌ Request timestamp error. Please check your system time.');
        }
        if (errorMsg.includes('-4164') || errorMsg.includes('price is X% too')) {
            throw new Error('❌ Order price is too far from current market price. Please adjust your entry price.');
        }
        
        // Re-throw original error if not a known error code
        throw error;
    }
}

/**
 * Place Algo Order (Conditional)
 * Endpoint: /fapi/v1/algoOrder
 */
export async function placeAlgoOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'STOP_MARKET' | 'TAKE_PROFIT_MARKET' | 'STOP' | 'TAKE_PROFIT' | 'TRAILING_STOP_MARKET';
    triggerPrice: string | number;
    workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
    closePosition?: boolean;
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';
}): Promise<any> {
    console.log('[Binance Auth] Placing Algo order:', params);
    
    const orderParams: any = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        algoType: 'CONDITIONAL',
        triggerPrice: formatParameter(params.triggerPrice),
        workingType: params.workingType || 'MARK_PRICE',
        closePosition: params.closePosition ? 'true' : 'false',
        timeInForce: params.timeInForce || 'GTC'
    };

    try {
        const data = await authenticatedRequest('/fapi/v1/algoOrder', 'POST', orderParams);
        console.log('[Binance Auth] ✅ Algo order placed:', data.algoId || 'Success');
        return data;
    } catch (error: any) {
        console.error('[Binance Auth] ❌ Algo order placement failed:', error);
        throw error;
    }
}

/**
 * Place batch orders (Atomic or Sequential fallback)
 * Endpoint: /fapi/v1/batchOrders
 */
export async function placeBatchOrders(orders: any[]): Promise<any[]> {
    console.log(`[Binance Auth] Placing batch of ${orders.length} orders...`);
    
    // Format orders for Binance batchOrders parameter
    const formattedOrders = orders.map(order => {
        const orderParams: any = {
            symbol: order.symbol,
            side: order.side,
            type: order.type
        };

        if (order.quantity && !order.closePosition) orderParams.quantity = formatParameter(order.quantity);
        if (order.reduceOnly) orderParams.reduceOnly = 'true';
        if (order.closePosition) orderParams.closePosition = 'true';
        if (order.price) orderParams.price = formatParameter(order.price);
        if (order.stopPrice) orderParams.stopPrice = formatParameter(order.stopPrice);
        if (order.timeInForce) orderParams.timeInForce = order.timeInForce;

        return orderParams;
    });

    try {
        const data = await authenticatedRequest('/fapi/v1/batchOrders', 'POST', {
            batchOrders: JSON.stringify(formattedOrders)
        });
        console.log('[Binance Auth] ✅ Batch orders placed');
        return data;
    } catch (error: any) {
        console.error('[Binance Auth] ❌ Batch order failed. Attempting sequential fallback...', error);
        // Fallback for Testnet issues if batch is rejected
        const results = [];
        for (const order of orders) {
            try {
                const res = await placeOrder(order);
                results.push(res);
            } catch (err) {
                results.push({ code: -1, msg: String(err) });
            }
        }
        return results;
    }
}

/**
 * Place Hard Stop Loss and Take Profit Orders (Futures)
 * Binance Futures does not support "OCO" endpoint like Spot.
 * We must verify separate orders: STOP_MARKET and TAKE_PROFIT_MARKET.
 * Both must be REDUCE_ONLY to close position.
 */
export async function placeOCOOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: string | number;
    price: number;           // Take Profit trigger price
    stopPrice: number;       // Stop Loss trigger price
    stopLimitPrice?: number; // Not used for MARKET stops
    reduceOnly?: boolean;    // Ensure this is properly passed
}): Promise<any> {
    console.log('[Binance Auth] Placing Hard SL/TP Orders (Futures Split):', params);

    const results = {
        orderListId: Date.now(), // Synthetic ID
        orders: [] as any[]
    };


    // We try/catch each individually so one failure doesn't block the other (unless critical)
    // Actually, for "Atomic" behavior, we might want to fail all?
    // BUT user request implies "Auto TP not working", maybe they set SL but not TP.
    // If we throw on TP failure, SL is rolled back? No, SL was already placed.
    // So if SL succeeds but TP fails, we have an SL-protected position but no TP.
    // This is safe-ish. We should allow it but warn.

    // 0. Ensure prices are rounded to tickSize
    const roundedTP = await roundPrice(params.symbol, params.price);
    const roundedSL = await roundPrice(params.symbol, params.stopPrice);

    console.log(`[Binance Auth] Rounded Prices for ${params.symbol}: TP ${roundedTP}, SL ${roundedSL}`);

    try {
        // 1. Place STOP LOSS (STOP_MARKET)
        if (params.stopPrice > 0) {
            console.log(`[OCO-Sim] Placing STOP_MARKET (Algo) at ${params.stopPrice}`);
            try {
                const slOrder = await placeAlgoOrder({
                    symbol: params.symbol,
                    side: params.side, 
                    type: 'STOP_MARKET',
                    triggerPrice: roundedSL,
                    closePosition: true
                });
                results.orders.push(slOrder);
            } catch (slError: any) {
                console.error('[OCO-Sim] Failed to place STOP LOSS:', slError);
                throw new Error(`Stop Loss Error: ${slError.message || slError}`);
            }
        } else {
            console.log('[OCO-Sim] Skipping Stop Loss (Price <= 0)');
        }

        // 2. Place TAKE PROFIT (TAKE_PROFIT_MARKET)
        if (params.price > 0) {
            console.log(`[OCO-Sim] Placing TAKE_PROFIT_MARKET (Algo) at ${params.price}`);
            try {
                const tpOrder = await placeAlgoOrder({
                    symbol: params.symbol,
                    side: params.side, 
                    type: 'TAKE_PROFIT_MARKET',
                    triggerPrice: roundedTP,
                    closePosition: true
                });
                results.orders.push(tpOrder);
            } catch (tpError: any) {
                console.error('[OCO-Sim] Failed to place TAKE PROFIT:', tpError);
                throw new Error(`Take Profit Error: ${tpError.message || tpError}`);
            }
        } else {
            console.log('[OCO-Sim] Skipping Take Profit (Price <= 0)');
        }

        console.log('[Binance Auth] ✅ Hard SL/TP algo orders execution complete. Placed:', results.orders.length);
        return results;
    } catch (error: any) {
        console.error('[Binance Auth] ❌ Failed to place one or more algo orders:', error);
        throw error; 
    }
}

/**
 * Cancel all open orders for a symbol
 * Useful for clearing OCO orders when manually closing position
 */
export async function cancelAllOrders(symbol: string): Promise<any> {
    console.log(`[Binance Auth] Canceling all orders for ${symbol}...`);
    
    try {
        const data = await authenticatedRequest('/fapi/v1/allOpenOrders', 'DELETE', { symbol });
        console.log('[Binance Auth] ✅ All orders canceled');
        return data;
    } catch (error: any) {
        console.error('[Binance Auth] ❌ Cancel all orders failed:', error);
        throw error;
    }
}

/**
 * Get exchange info for a symbol to find LOT_SIZE filters
 */
/**
 * Get exchange info for a symbol to find LOT_SIZE and MIN_NOTIONAL filters
 * Uses Futures endpoint (/fapi/v1/exchangeInfo)
 */
export async function getSymbolFilters(symbol: string): Promise<{ stepSize: number, tickSize: number, precision: number, minQty: number, minNotional: number } | null> {
    // Check cache first
    if (symbolFilterCache.has(symbol)) {
        return symbolFilterCache.get(symbol)!;
    }

    try {
        // Determine Base URL for Futures
        let baseUrl = getApiBase();
        if (baseUrl === '/api/binance') baseUrl = '/api/futures'; 
        
        const url = `${baseUrl}/fapi/v1/exchangeInfo`; 
        
        const response = await fetchWithProxy(url);
        const data = await response.json();
        
        const symbolInfo = data.symbols?.find((s: any) => s.symbol === symbol);
        if (!symbolInfo) {
             console.warn(`[Binance] Symbol ${symbol} not found in exchange info`);
             return null;
        }

        const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
        const priceFilter = symbolInfo.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
        const minNotionalFilter = symbolInfo.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL');
        
        if (!lotSizeFilter || !priceFilter) return null;

        const stepSize = parseFloat(lotSizeFilter.stepSize);
        const tickSize = parseFloat(priceFilter.tickSize);
        const minQty = parseFloat(lotSizeFilter.minQty);
        const minNotional = minNotionalFilter ? parseFloat(minNotionalFilter.notional) : 5.0; // Default 5 USDT
        const precision = symbolInfo.quantityPrecision || 8; 

        const filters = { stepSize, tickSize, precision, minQty, minNotional };
        symbolFilterCache.set(symbol, filters);
        return filters;
    } catch (error) {
        console.error(`[Binance] Error fetching filters for ${symbol}:`, error);
        return null; // Fail safe
    }
}

/**
 * Round price to comply with Binance PRICE_FILTER tickSize
 */
export async function roundPrice(symbol: string, price: number): Promise<number> {
    const filters = await getSymbolFilters(symbol);
    if (!filters) {
        return parseFloat(price.toFixed(2)); // Fallback
    }

    const { tickSize } = filters;
    if (!tickSize) return price;

    // Inverse of tickSize to get precision factor
    // e.g. tickSize 0.01 -> factor 100
    // e.g. tickSize 0.1 -> factor 10
    // e.g. tickSize 0.0001 -> factor 10000
    
    // safe calculation
    const precision = Math.round(-Math.log10(tickSize)); // 0.01 -> 2
    
    // If tickSize is complex like 0.5, this log10 approach is rough but typically tickSize is 1, 0.1, 0.01 etc.
    // Better approach:
    
    const factor = 1 / tickSize; 
    
    // Round to nearest tick
    return Math.round(price * factor) / factor;
}

/**
 * Round quantity to comply with Binance LOT_SIZE stepSize and MIN_NOTIONAL
 */
export async function roundQuantity(symbol: string, quantity: number, price: number = 0, reduceOnly: boolean = false): Promise<number> {
    const filters = await getSymbolFilters(symbol);
    if (!filters) {
        // Fallback to 6 decimals if filter not found (safer than nothing)
        return Math.floor(quantity * 1000000) / 1000000;
    }

    const { stepSize, minQty, minNotional } = filters;
    
    // 1. Check Min Qty
    if (quantity < minQty) {
        console.warn(`[Binance] Quantity ${quantity} below minQty ${minQty} for ${symbol}`);
        return 0;
    }

    // 2. Check Min Notional (only if price is provided AND it's not a closing order)
    if (!reduceOnly && price > 0 && (quantity * price) < minNotional) {
        console.warn(`[Binance] Notional value ${(quantity * price).toFixed(2)} below minNotional ${minNotional} for ${symbol}`);
        return 0;
    }
    
    // 3. Round to Step Size
    // Use Math.round to avoid floor-ing below notional limit
    const factor = 1 / stepSize;
    const rounded = Math.round(quantity * factor) / factor;
    
    // Double check that we didn't round down below minQty
    return Math.max(rounded, minQty);
}

/**
 * Cancel an order
 */
export async function cancelOrder(symbol: string, orderId: number): Promise<any> {
    console.log(`[Binance Auth] Canceling order ${orderId}...`);

    const data = await authenticatedRequest('/fapi/v1/order', 'DELETE', { symbol, orderId });
    console.log('[Binance Auth] ✅ Order canceled');
    return data;
}

/**
 * Close an entire position (Market Close)
 */
export async function closePosition(symbol: string, positionAmt: string | number): Promise<any> {
    const amt = parseFloat(positionAmt.toString());
    if (amt === 0) return;

    const side = amt > 0 ? 'SELL' : 'BUY';
    const rawQuantity = Math.abs(amt);
    
    // CRITICAL: Round quantity to stepSize to avoid LOT_SIZE error
    // Even "ReduceOnly" orders must respect stepSize
    const quantity = await roundQuantity(symbol, rawQuantity, 0, true);

    console.log(`[Binance Auth] Closing position for ${symbol}. Side: ${side}, Raw: ${rawQuantity}, Rounded: ${quantity}`);
    
    if (quantity <= 0) {
        console.warn(`[Binance Auth] ⚠️ Quantity too small to close (${rawQuantity}). Skipping.`);
        return;
    }

    return placeOrder({
        symbol,
        side,
        type: 'MARKET',
        quantity,
        reduceOnly: true
    });
}

/**
 * Get trade history
 */
export async function getTradeHistory(symbol: string, limit: number = 500): Promise<any[]> {
    // Sanitize symbol: 
    // 1. Remove slash
    let formattedSymbol = symbol.replace('/', '');
    
    // 2. Ensure it ends with a valid quote currency for Futures (USDT mostly)
    // If it's just "BTC", append "USDT".
    if (!formattedSymbol.endsWith('USDT') && !formattedSymbol.endsWith('USDC') && !formattedSymbol.endsWith('BUSD')) {
        formattedSymbol += 'USDT';
    }
    
    console.log(`[Binance Auth] Fetching trade history for ${formattedSymbol} (Original: ${symbol})...`);
    
    try {
        const data = await authenticatedRequest('/fapi/v1/userTrades', 'GET', { symbol: formattedSymbol, limit });
        
        if (Array.isArray(data)) {
            // Sort by time descending (newest first) so data[0] is the LATEST trade
            data.sort((a: any, b: any) => b.time - a.time);
        }
        
        console.log(`[Binance Auth] ✅ Found ${data ? data.length : 0} trades`);
        return data;
    } catch (error: any) {
         console.error(`[Binance Auth] ❌ Fetch trade history failed for ${formattedSymbol}:`, error);
         // Return empty array instead of throwing to prevent crashing the app
         return [];
    }
}

/**
 * Get income history (realized PnL, funding fees, commissions)
 * Endpoint: /fapi/v1/income
 */
export async function getIncomeHistory(params: {
    symbol?: string;
    incomeType?: 'REALIZED_PNL' | 'FUNDING_FEE' | 'COMMISSION' | 'TRANSFER' | 'INSURANCE_CLEAR';
    startTime?: number;
    endTime?: number;
    limit?: number;
} = {}): Promise<any[]> {
    const requestParams: Record<string, any> = {
        limit: params.limit || 1000
    };
    if (params.symbol) {
        let formattedSymbol = params.symbol.replace('/', '');
        if (!formattedSymbol.endsWith('USDT') && !formattedSymbol.endsWith('USDC') && !formattedSymbol.endsWith('BUSD')) {
            formattedSymbol += 'USDT';
        }
        requestParams.symbol = formattedSymbol;
    }
    if (params.incomeType) requestParams.incomeType = params.incomeType;
    if (params.startTime) requestParams.startTime = params.startTime;
    if (params.endTime) requestParams.endTime = params.endTime;

    try {
        const data = await authenticatedRequest('/fapi/v1/income', 'GET', requestParams);
        if (Array.isArray(data)) {
            data.sort((a: any, b: any) => b.time - a.time);
        }
        console.log(`[Binance Auth] ✅ Found ${data?.length || 0} income records`);
        return data || [];
    } catch (error: any) {
        console.error('[Binance Auth] ❌ Fetch income history failed:', error);
        return [];
    }
}

/**
 * Test connectivity and authentication
 */
export async function testConnection(): Promise<boolean> {
    try {
        console.log('[Binance Auth] Testing connection...');
        await getAccountInfo();
        console.log('[Binance Auth] ✅ Connection successful!');
        return true;
    } catch (error) {
        console.error('[Binance Auth] ❌ Connection failed:', error);
        return false;
    }
}

/**
 * Check if API credentials are configured
 */
export function isConfigured(): boolean {
    const { apiKey, secretKey } = getApiCredentials();
    return !!(apiKey && secretKey);
}

/**
 * Set Leverage for a symbol
 * Endpoint: /fapi/v1/leverage
 */
export async function setLeverage(symbol: string, leverage: number): Promise<any> {
    console.log(`[Binance Auth] Setting leverage for ${symbol} to ${leverage}x...`);
    try {
        const data = await authenticatedRequest('/fapi/v1/leverage', 'POST', { symbol, leverage });
        console.log(`[Binance Auth] ✅ Leverage set to ${data.leverage}x`);
        return data;
    } catch (error: any) {
        console.error(`[Binance Auth] ❌ Failed to set leverage:`, error);
        // Don't throw, just return null or warn, to avoid breaking flow
        return null;
    }
}

/**
 * Rule: Auto Open Order with SL & TP (Atomic Batch)
 */
export async function placeOrderWithSLTP(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET';
    quantity: string | number;
    price?: number;
    tpPrice: number;
    slPrice: number;
    leverage?: number;
}): Promise<any> {
    // 1. Rule: Auto Set Leverage sebelum entry
    if (params.leverage) {
        await setLeverage(params.symbol, params.leverage);
    }

    const closeSide = params.side === 'BUY' ? 'SELL' : 'BUY';

    const entryPrice = params.type === 'LIMIT' && params.price ? await roundPrice(params.symbol, params.price) : params.price;
    const roundedTP = await roundPrice(params.symbol, params.tpPrice);
    const roundedSL = await roundPrice(params.symbol, params.slPrice);

    // Round quantities
    const quantity = typeof params.quantity === 'number' ? params.quantity : parseFloat(params.quantity);
    const roundedQty = await roundQuantity(params.symbol, quantity, entryPrice || 0);

    // 1. Place Entry Order (Wait for it to land)
    const entryOrder = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: roundedQty,
        ...(params.type === 'LIMIT' ? { price: entryPrice, timeInForce: 'GTC' } : {})
    };

    let entryRes: any;
    try {
        entryRes = await placeOrder(entryOrder as any);
        console.log(`[Binance Trading] ✅ Entry Order Placed: ${entryRes.orderId}`);
    } catch (e: any) {
        console.error(`[Binance Trading] ❌ Entry Order Failed:`, e);
        throw new Error(`Entry Order Failed: ${e.message}`);
    }

    // Emulate batchRes format [entry, tp, sl] for backward compatibility with App.tsx
    const batchRes: any[] = [entryRes, {}, {}];

    // 2. Place Take Profit (Algo Order)
    if (roundedTP > 0) {
        try {
            console.log(`[Binance Trading] Placing TP Algo Order for ${params.symbol} at ${roundedTP}...`);
            const tpRes = await placeAlgoOrder({
                symbol: params.symbol,
                side: closeSide,
                type: 'TAKE_PROFIT_MARKET',
                triggerPrice: roundedTP,
                workingType: 'CONTRACT_PRICE',
                closePosition: true
            });
            batchRes[1] = tpRes;
        } catch (e: any) {
            console.error(`[Binance Trading] ❌ Take Profit Failed:`, e);
            batchRes[1] = { code: -1, msg: e.message || 'Take Profit Failed' };
        }
    }

    // 3. Place Stop Loss (Algo Order)
    if (roundedSL > 0) {
        try {
            console.log(`[Binance Trading] Placing SL Algo Order for ${params.symbol} at ${roundedSL}...`);
            const slRes = await placeAlgoOrder({
                symbol: params.symbol,
                side: closeSide,
                type: 'STOP_MARKET',
                triggerPrice: roundedSL,
                workingType: 'CONTRACT_PRICE',
                closePosition: true
            });
            batchRes[2] = slRes;
        } catch (e: any) {
            console.error(`[Binance Trading] ❌ Stop Loss Failed:`, e);
            batchRes[2] = { code: -1, msg: e.message || 'Stop Loss Failed' };
        }
    }

    // 4. Validation: Verify SL/TP Orders
    const slTpErrors = batchRes.slice(1)
        .map((res: any, index: number) => {
            if (res.code || res.msg) {
                const orderType = index === 0 ? 'Take Profit' : 'Stop Loss';
                return `${orderType}: ${res.msg || res.code}`;
            }
            return null;
        })
        .filter(Boolean);

    if (slTpErrors.length > 0) {
        // We throw so that App.tsx catches it and displays "Entry OK, but SL/TP Error: ..."
        throw new Error(`SL/TP Error: ${slTpErrors.join(' | ')}`);
    }
    
    console.log(`[Binance Trading] ✅ Complete SL/TP execution successful.`);
    return batchRes;
}

/**
 * Rule: Trailing Logic & Auto Move SL
 * Panggil fungsi ini di dalam interval/loop di App.tsx atau Store
 * ROE thresholds adjusted for leverage-aware risk management
 */
export async function manageTrailingStop(symbol: string, leverage: number) {
    const positions = await getPositions(symbol);
    if (positions.length === 0) return;

    const pos = positions[0];
    const entryPrice = parseFloat(pos.entryPrice);
    const markPrice = parseFloat(pos.markPrice);
    const amt = parseFloat(pos.positionAmt);
    const side = amt > 0 ? 'BUY' : 'SELL';
    
    // Hitung Profit % dari Pergerakan Harga (Price Move)
    let priceMove = 0;
    if (side === 'BUY') {
        priceMove = (markPrice - entryPrice) / entryPrice;
    } else {
        priceMove = (entryPrice - markPrice) / entryPrice;
    }

    let targetNewSL = 0;
    let targetNewTP = 0;
    let level = "";

    // Thresholds (ROE-free, based on Price Move)
    // Level 3 (+1.0%)
    if (priceMove >= 0.010) {
        targetNewSL = side === 'BUY' ? entryPrice * 1.005 : entryPrice * 0.995;
        targetNewTP = side === 'BUY' ? entryPrice * 1.030 : entryPrice * 0.970;
        level = "LEVEL 3 (+1.0%)";
    } 
    // Level 2 (+0.5%)
    else if (priceMove >= 0.005) {
        targetNewSL = side === 'BUY' ? entryPrice * 1.001 : entryPrice * 0.999;
        targetNewTP = side === 'BUY' ? entryPrice * 1.020 : entryPrice * 0.980;
        level = "LEVEL 2 (+0.5%)";
    } 
    // Level 1 (+0.2%)
    else if (priceMove >= 0.002) {
        targetNewSL = entryPrice;
        level = "LEVEL 1 (+0.2%)";
    }

    if (targetNewSL > 0 || targetNewTP > 0) {
        const openOrders = await getOpenOrders(symbol);
        
        // 1. Handle SL Update (Trailing SL)
        if (targetNewSL > 0) {
            const oldSL = openOrders.find(o => o.type === 'STOP_MARKET');
            const roundedSL = await roundPrice(symbol, targetNewSL);

            // Hanya update jika harga baru signifikan berbeda (> 0.01%) 
            // DAN hanya jika mengunci profit lebih banyak (Trailing)
            if (oldSL) {
                const currentSLPrice = parseFloat(oldSL.stopPrice);
                const isBetterSL = side === 'BUY' ? roundedSL > currentSLPrice : roundedSL < currentSLPrice;
                const isSignificant = Math.abs(currentSLPrice - roundedSL) > (roundedSL * 0.0001);

                if (isBetterSL && isSignificant) {
                    console.log(`[Trailing] 🛡️ ${level} Reached. Moving SL to ${roundedSL}`);
                    await cancelOrder(symbol, oldSL.orderId);
                    await placeOrder({
                        symbol,
                        side: side === 'BUY' ? 'SELL' : 'BUY',
                        type: 'STOP_MARKET',
                        quantity: Math.abs(amt),
                        stopPrice: roundedSL,
                        reduceOnly: true
                    });
                }
            }
        }

        // 2. Handle TP Update (Move TP)
        if (targetNewTP > 0) {
            const oldTP = openOrders.find(o => o.type === 'TAKE_PROFIT_MARKET');
            const roundedTP = await roundPrice(symbol, targetNewTP);

            if (oldTP) {
                const currentTPPrice = parseFloat(oldTP.stopPrice);
                const isBetterTP = side === 'BUY' ? roundedTP > currentTPPrice : roundedTP < currentTPPrice;
                const isSignificant = Math.abs(currentTPPrice - roundedTP) > (roundedTP * 0.0001);

                if (isBetterTP && isSignificant) {
                    console.log(`[Trailing] 🎯 ${level} Reached. Moving TP to ${roundedTP}`);
                    await cancelOrder(symbol, oldTP.orderId);
                    await placeOrder({
                        symbol,
                        side: side === 'BUY' ? 'SELL' : 'BUY',
                        type: 'TAKE_PROFIT_MARKET',
                        quantity: Math.abs(amt),
                        stopPrice: roundedTP,
                        reduceOnly: true
                    });
                }
            }
        }
    }
}

export default {
    setMode,
    getAccountInfo,
    getAccountBalances,
    getOpenOrders,
    getAllOrders,
    getOpenOrder,
    getOrder,
    getPositions,
    placeOrder,
    placeOCOOrder,
    cancelAllOrders,
    closePosition,
    cancelOrder,
    getTradeHistory,
    getIncomeHistory,
    testConnection,
    isConfigured,
    getSymbolFilters,
    roundQuantity,
    roundPrice,
    setLeverage,
    placeOrderWithSLTP,
    placeBatchOrders,
    manageTrailingStop
};
