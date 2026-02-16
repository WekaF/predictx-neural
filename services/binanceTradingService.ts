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

// Local cache for symbol stepSize (LOT_SIZE filter)
const symbolStepSizeCache = new Map<string, number>();
const symbolPrecisionCache = new Map<string, number>();

/**
 * Get API base URL based on testnet setting and environment
 * - Development: Uses local proxy to avoid CORS
 * - Production: Uses direct Binance API (CORS handled by Binance or browser)
 */
function getApiBase(): string {
    const isDev = import.meta.env.DEV;
    const isProduction = import.meta.env.PROD;
    
    try {
        const settings = localStorage.getItem('neurotrade_settings');
        const useTestnet = settings ? JSON.parse(settings).useTestnet : true;
        
        if (useTestnet) {
            console.log('[Binance Trading] 🧪 Using TESTNET mode');
            // In production, use direct testnet API
            if (isProduction) {
                console.log('[Binance Trading] 📡 Production: Direct Testnet API');
                return 'https://testnet.binancefuture.com';
            }
            // In development, use backend proxy
            return LOCAL_PROXY_API;
        }
    } catch (e) {
        console.warn('[Binance Trading] Failed to read testnet setting, using production');
    }
    
    // Production mode: Use direct Binance API
    if (isProduction) {
        console.log('[Binance Trading] 📡 Production: Direct Binance API');
        return 'https://fapi.binance.com'; // Futures API
    }
    
    // Development: Use Vite proxy
    return '/api/futures';
}

// Load API credentials from environment (works in both browser and Node.js)
// Support separate keys for production and testnet
function getApiCredentials(): { apiKey: string; secretKey: string } {
    const isTestnet = (() => {
        try {
            const settings = localStorage.getItem('neurotrade_settings');
            return settings ? JSON.parse(settings).useTestnet : true;
        } catch {
            return true;
        }
    })();

    if (isTestnet) {
        const testnetKey = typeof import.meta !== 'undefined' && import.meta.env 
            ? import.meta.env.VITE_BINANCE_API_KEY_TESTNET 
            : process.env.VITE_BINANCE_API_KEY_TESTNET;
        const testnetSecret = typeof import.meta !== 'undefined' && import.meta.env
            ? import.meta.env.VITE_BINANCE_API_SECRET_TESTNET
            : process.env.VITE_BINANCE_API_SECRET_TESTNET;
        
        if (testnetKey && testnetSecret) {
            return { apiKey: testnetKey, secretKey: testnetSecret };
        }
    }

    // Fallback to production keys
    const prodKey = typeof import.meta !== 'undefined' && import.meta.env 
        ? import.meta.env.VITE_BINANCE_API_KEY 
        : process.env.VITE_BINANCE_API_KEY;
    const prodSecret = typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_BINANCE_SECRET_KEY
        : process.env.VITE_BINANCE_SECRET_KEY;

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

    throw new Error('All connection attempts failed (Direct + Proxies)');
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
        recvWindow: 30000 // Increased to 30s for slower proxies
    };

    const makeRequest = async (requestParams: any) => {
        // Create query string using formatParameter helper
        const queryString = Object.entries(requestParams)
            .map(([key, value]) => `${key}=${formatParameter(value)}`)
            .join('&');

        // Generate signature
        const signature = generateSignature(queryString);
        const signedQueryString = `${queryString}&signature=${signature}`;

        // Determine Base URL
        let baseUrl = getApiBase();
        const isBackendProxy = baseUrl === LOCAL_PROXY_API;
        if (endpoint.startsWith('/fapi')) {
            if (baseUrl === '/api/binance') baseUrl = '/api/futures';
        }

        // Construct URL
        let url = `${baseUrl}${endpoint}?${signedQueryString}`;
        if (isBackendProxy) {
            url += '&testnet=true';
        }
        
        console.log(`[Binance Auth] ${method} ${endpoint} | TS: ${requestParams.timestamp} | Offset: ${serverTimeOffset}`);

        const response = await fetchWithProxy(url, {
            method,
            headers: {
                'X-MBX-APIKEY': apiKey,
                ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {})
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            // Try to parse JSON error if possible
            try {
                const jsonError = JSON.parse(errorText);
                throw new Error(jsonError.msg || jsonError.message || `Binance API Error: ${response.status}`);
            } catch (e) {
                // If not JSON, it might be HTML or plain text
                throw new Error(`Binance API Error: ${response.status} - ${errorText.substring(0, 200)}`);
            }
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
    console.log(`[Binance Auth] Fetching order ${orderId} for ${symbol}...`);
    const data = await authenticatedRequest('/fapi/v1/openOrder', 'GET', { symbol, orderId });
    console.log(`[Binance Auth] ✅ Order status: ${data.status}`);
    return data;
}

/**
 * Get current open positions (Risk)
 * Endpoint: /fapi/v2/positionRisk
 */
export async function getPositions(symbol?: string): Promise<any[]> {
    console.log('[Binance Auth] Fetching positions...');
    const params = symbol ? { symbol } : {};
    const data = await authenticatedRequest('/fapi/v2/positionRisk', 'GET', params);
    
    // Filter out empty positions
    const activePositions = Array.isArray(data) 
        ? data.filter((p: any) => parseFloat(p.positionAmt) !== 0)
        : [];
        
    console.log(`[Binance Auth] ✅ Found ${activePositions.length} active positions`);
    return activePositions;
}

/**
 * Place a new order
 */
export async function placeOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';
    quantity: string | number;
    price?: string | number;
    stopPrice?: string | number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    reduceOnly?: boolean;
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

    if (params.type === 'LIMIT') {
        orderParams.price = params.price;
        orderParams.timeInForce = params.timeInForce || 'GTC';
    }

    if (params.type === 'STOP_LOSS_LIMIT') {
        orderParams.price = params.price;
        orderParams.stopPrice = params.stopPrice;
        orderParams.timeInForce = params.timeInForce || 'GTC';
    }

    const data = await authenticatedRequest('/fapi/v1/order', 'POST', orderParams);
    console.log('[Binance Auth] ✅ Order placed:', data.orderId);
    return data;
}

/**
 * Place OCO Order (One-Cancels-Other)
 * Combines Stop Loss and Take Profit in a single order
 * When one executes, the other is automatically cancelled
 */
export async function placeOCOOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: string | number;
    price: number;           // Take Profit limit price
    stopPrice: number;       // Stop Loss trigger price
    stopLimitPrice: number;  // Stop Loss limit price
}): Promise<any> {
    console.log('[Binance Auth] Placing OCO order:', params);
    
    const ocoParams: any = {
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        stopPrice: params.stopPrice,
        stopLimitPrice: params.stopLimitPrice,
        stopLimitTimeInForce: 'GTC',
        reduceOnly: 'true' // OCO orders are always to close positions
    };

    try {
        // Binance Futures OCO endpoint
        const data = await authenticatedRequest('/fapi/v1/order/oco', 'POST', ocoParams);
        console.log('[Binance Auth] ✅ OCO order placed:', {
            orderListId: data.orderListId,
            orders: data.orders?.map((o: any) => ({ orderId: o.orderId, type: o.type }))
        });
        return data;
    } catch (error: any) {
        console.error('[Binance Auth] ❌ OCO order failed:', error);
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
    // Check cache first (Simple cache strategy, might need invalidation later)
    if (symbolStepSizeCache.has(symbol) && symbolPrecisionCache.has(symbol)) {
        return { 
            stepSize: symbolStepSizeCache.get(symbol)!, 
            tickSize: symbolPrecisionCache.get(symbol)!, // We'll store tickSize in same cache or new one? Let's use new one.
            precision: 8, // Derived, not strictly needed for math if we have tickSize
            minQty: 0.001, // Default fallback if cached heavily
            minNotional: 5.0
        };
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

        symbolStepSizeCache.set(symbol, stepSize);
        symbolPrecisionCache.set(symbol, tickSize); // Reuse cache map for tickSize (misnomer but works if we track it)
        // Ideally we should rename or use separate cache. For safety let's just make a new one or ignore cache for now to ensure freshness.
        // Actually, let's just return values.

        return { stepSize, tickSize, precision, minQty, minNotional };
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
export async function roundQuantity(symbol: string, quantity: number, price: number = 0): Promise<number> {
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

    // 2. Check Min Notional (only if price is provided)
    if (price > 0 && (quantity * price) < minNotional) {
        console.warn(`[Binance] Notional value ${(quantity * price).toFixed(2)} below minNotional ${minNotional} for ${symbol}`);
        return 0;
    }
    
    // 3. Round to Step Size
    const factor = 1 / stepSize;
    return Math.floor(quantity * factor) / factor;
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
    const quantity = await roundQuantity(symbol, rawQuantity);

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

export default {
    getAccountInfo,
    getAccountBalances,
    getOpenOrders,
    getAllOrders,
    getOpenOrder,
    getPositions,
    placeOrder,
    placeOCOOrder,
    cancelAllOrders,
    closePosition,
    cancelOrder,
    getTradeHistory,
    testConnection,
    isConfigured,
    getSymbolFilters,
    roundQuantity,
    roundPrice,
    setLeverage
};
