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
const BINANCE_TESTNET_API = 'https://demo-fapi.binance.com';

// Local cache for symbol stepSize (LOT_SIZE filter)
const symbolStepSizeCache = new Map<string, number>();
const symbolPrecisionCache = new Map<string, number>();

/**
 * Get API base URL based on testnet setting
 * Uses local proxy in development to avoid CORS
 */
function getApiBase(): string {
    const isDev = import.meta.env.DEV;
    
    try {
        const settings = localStorage.getItem('neurotrade_settings');
        const useTestnet = settings ? JSON.parse(settings).useTestnet : true;
        
        if (useTestnet) {
            console.log('[Binance Trading] 🧪 Using s mode');
            // Use relative path if likely in a Vercel-like environment with rewrites
            // In dev (Vite), /api/testnet is handled by vite.config.ts
            // In prod, it should be handled by vercel.json or similar
            return '/api/testnet';
        }
    } catch (e) {
        console.warn('[Binance Trading] Failed to read testnet setting, using production');
    }
    
    // Always use relative path to leverage proxies/rewrites and avoid CORS
    return '/api/binance';
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
    // 0. If using local proxy (Vite), just fetch directly
    if (url.startsWith('/')) {
        console.log(`[Binance] Fetching via local proxy: ${url}`);
        const response = await fetch(url, options);
        if (!response.ok) {
            const text = await response.text();
            if (response.status === 403) {
                console.error('[Binance Proxy] 403 Forbidden. Likely Geo-block.', text);
                throw new Error(`🚫 Access Denied (403). Binance Futures API is blocked in your region. \n\n➡️ SOLUTION: Please ENABLE A VPN (e.g., to Singapore/Japan) and try again.`);
            }
            throw new Error(`Local Proxy Error: ${response.status} - ${text}`);
        }
        return response;
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
let serverTimeOffset = 0;
async function syncServerTime(): Promise<void> {
    try {
        const url = `${getApiBase()}/api/v3/time`;
        const response = await fetchWithProxy(url);
        const data = await response.json();
        const serverTime = data.serverTime;
        const localTime = Date.now();
        serverTimeOffset = serverTime - localTime;
        console.log(`[Binance Auth] ⏰ Time synced. Offset: ${serverTimeOffset}ms`);
    } catch (error) {
        console.error('[Binance Auth] ❌ Could not sync server time:', error);
        // Don't swallow error, let it propagate or keep previous offset
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

    // CRITICAL: Always sync server time before authenticated requests
    await syncServerTime();

    // Add timestamp with server offset
    const timestamp = Date.now() + serverTimeOffset;
    const queryParams = {
        ...params,
        timestamp,
        recvWindow: 60000 // 60 second window to account for network delays
    };

    // Create query string using formatParameter helper
    const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${key}=${formatParameter(value)}`)
        .join('&');

    // Generate signature
    const signature = generateSignature(queryString);
    const signedQueryString = `${queryString}&signature=${signature}`;

    // Determine Base URL based on endpoint type (Spot vs Futures)
    let baseUrl = getApiBase();
    
    // If endpoint starts with /fapi, usage of Futures Proxy is required
    if (endpoint.startsWith('/fapi')) {
        const isTestnet = getApiCredentials().apiKey.includes('test'); // Hacky check or reuse isTestnet logic
        // Better: Check settings again or pass isTestnet param
        // For now, let's assume if getApiBase returns /api/testnet, it stays /api/testnet (but we need to ensure testnet target is correct)
        
        if (baseUrl === '/api/binance') {
            baseUrl = '/api/futures';
        }
    }

    // Make request - use dynamic API base with CORS proxy fallback
    const url = `${baseUrl}${endpoint}?${signedQueryString}`;
    
    console.log(`[Binance Auth] ${method} ${endpoint}`);
    if (method === 'POST') console.log('[Binance Auth] Body Params:', queryParams);

    try {
        const response = await fetchWithProxy(baseUrl, {
            method,
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Binance API Error: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error: any) {
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
export async function getAccountBalances(): Promise<any[]> {
    const accountInfo = await getAccountInfo();
    return accountInfo.balances.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
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
 * Get exchange info for a symbol to find LOT_SIZE filters
 */
export async function getSymbolFilters(symbol: string): Promise<{ stepSize: number, precision: number } | null> {
    // Check cache first
    if (symbolStepSizeCache.has(symbol)) {
        return { 
            stepSize: symbolStepSizeCache.get(symbol)!, 
            precision: symbolPrecisionCache.get(symbol)! 
        };
    }

    try {
        const url = `${getApiBase()}/api/v3/exchangeInfo?symbol=${symbol}`;
        const response = await fetchWithProxy(url);
        const data = await response.json();
        
        const symbolInfo = data.symbols?.find((s: any) => s.symbol === symbol);
        if (!symbolInfo) return null;

        const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
        if (!lotSizeFilter) return null;

        const stepSize = parseFloat(lotSizeFilter.stepSize);
        const precision = symbolInfo.baseAssetPrecision || 8;

        symbolStepSizeCache.set(symbol, stepSize);
        symbolPrecisionCache.set(symbol, precision);

        return { stepSize, precision };
    } catch (error) {
        console.error(`[Binance] Error fetching filters for ${symbol}:`, error);
        return null;
    }
}

/**
 * Round quantity to comply with Binance LOT_SIZE stepSize
 */
export async function roundQuantity(symbol: string, quantity: number): Promise<number> {
    const filters = await getSymbolFilters(symbol);
    if (!filters) {
        // Fallback to 6 decimals if filter not found (safer than nothing)
        return Math.floor(quantity * 1000000) / 1000000;
    }

    const { stepSize } = filters;
    
    // Calculate number of decimals from stepSize (e.g., 0.001 -> 3)
    // Avoid precision issues with log/toString
    const stepStr = stepSize.toString();
    const decimals = stepStr.indexOf('.') === -1 ? 0 : stepStr.split('.')[1].length;
    
    // Round down to the nearest multiple of stepSize
    // Using simple truncate to decimals is usually sufficient for Binance
    const factor = Math.pow(10, decimals);
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
 * Get trade history
 */
export async function getTradeHistory(symbol: string, limit: number = 500): Promise<any[]> {
    // Sanitize symbol: 
    // 1. Replace /USD with USDT (e.g. BTC/USD -> BTCUSDT)
    // 2. Remove / (e.g. BTC/USDT -> BTCUSDT)
    const formattedSymbol = symbol.replace('/USD', 'USDT').replace('/', '');
    
    console.log(`[Binance Auth] Fetching trade history for ${formattedSymbol}...`);
    const data = await authenticatedRequest('/fapi/v1/userTrades', 'GET', { symbol: formattedSymbol, limit });
    console.log(`[Binance Auth] ✅ Found ${data ? data.length : 0} trades`);
    return data;
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

export default {
    getAccountInfo,
    getAccountBalances,
    getOpenOrders,
    getAllOrders,
    placeOrder,
    cancelOrder,
    getTradeHistory,
    testConnection,
    isConfigured,
    getSymbolFilters,
    roundQuantity
};
