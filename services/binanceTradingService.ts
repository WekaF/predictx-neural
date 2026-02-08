/**
 * Binance Authenticated Trading Service
 * Handles authenticated API calls for account info, orders, and trading
 */

import crypto from 'crypto-js';

// Binance API Configuration
const BINANCE_API_BASE = '/api';

// Load API credentials from environment (works in both browser and Node.js)
const BINANCE_API_KEY = typeof import.meta !== 'undefined' && import.meta.env 
    ? import.meta.env.VITE_BINANCE_API_KEY 
    : process.env.VITE_BINANCE_API_KEY;

const BINANCE_SECRET_KEY = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_BINANCE_SECRET_KEY
    : process.env.VITE_BINANCE_SECRET_KEY;

/**
 * Generate HMAC SHA256 signature for Binance API
 */
function generateSignature(queryString: string): string {
    return crypto.HmacSHA256(queryString, BINANCE_SECRET_KEY).toString();
}

/**
 * Get Binance server time to sync timestamps
 */
let serverTimeOffset = 0;
async function syncServerTime(): Promise<void> {
    try {
        const response = await fetch(`${BINANCE_API_BASE}/api/v3/time`);
        const data = await response.json();
        const serverTime = data.serverTime;
        const localTime = Date.now();
        serverTimeOffset = serverTime - localTime;
        console.log(`[Binance Auth] ⏰ Time synced. Offset: ${serverTimeOffset}ms`);
    } catch (error) {
        console.warn('[Binance Auth] ⚠️ Could not sync server time, using local time');
        serverTimeOffset = 0;
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
    if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
        throw new Error('Binance API credentials not configured. Please set VITE_BINANCE_API_KEY and VITE_BINANCE_SECRET_KEY in .env.local');
    }

    // Sync server time on first request
    if (serverTimeOffset === 0) {
        await syncServerTime();
    }

    // Add timestamp with server offset
    const timestamp = Date.now() + serverTimeOffset;
    const queryParams = {
        ...params,
        timestamp,
        recvWindow: 60000 // 60 second window to account for network delays
    };

    // Create query string
    const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

    // Generate signature
    const signature = generateSignature(queryString);
    const signedQueryString = `${queryString}&signature=${signature}`;

    // Make request
    const url = `${BINANCE_API_BASE}${endpoint}?${signedQueryString}`;
    
    try {
        const response = await fetch(url, {
            method,
            headers: {
                'X-MBX-APIKEY': BINANCE_API_KEY
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Binance API Error: ${error.msg || response.statusText}`);
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
    const data = await authenticatedRequest('/api/v3/account');
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
    const data = await authenticatedRequest('/api/v3/openOrders', 'GET', params);
    console.log(`[Binance Auth] ✅ Found ${data.length} open orders`);
    return data;
}

/**
 * Get all orders (open and closed)
 */
export async function getAllOrders(symbol: string, limit: number = 500): Promise<any[]> {
    console.log(`[Binance Auth] Fetching all orders for ${symbol}...`);
    const data = await authenticatedRequest('/api/v3/allOrders', 'GET', { symbol, limit });
    console.log(`[Binance Auth] ✅ Found ${data.length} orders`);
    return data;
}

/**
 * Place a new order
 */
export async function placeOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET' | 'STOP_LOSS_LIMIT';
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
}): Promise<any> {
    console.log('[Binance Auth] Placing order:', params);
    
    const orderParams: any = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity
    };

    if (params.type === 'LIMIT') {
        orderParams.price = params.price;
        orderParams.timeInForce = params.timeInForce || 'GTC';
    }

    if (params.type === 'STOP_LOSS_LIMIT') {
        orderParams.price = params.price;
        orderParams.stopPrice = params.stopPrice;
        orderParams.timeInForce = params.timeInForce || 'GTC';
    }

    const data = await authenticatedRequest('/api/v3/order', 'POST', orderParams);
    console.log('[Binance Auth] ✅ Order placed:', data.orderId);
    return data;
}

/**
 * Cancel an order
 */
export async function cancelOrder(symbol: string, orderId: number): Promise<any> {
    console.log(`[Binance Auth] Canceling order ${orderId}...`);
    const data = await authenticatedRequest('/api/v3/order', 'DELETE', { symbol, orderId });
    console.log('[Binance Auth] ✅ Order canceled');
    return data;
}

/**
 * Get trade history
 */
export async function getTradeHistory(symbol: string, limit: number = 500): Promise<any[]> {
    console.log(`[Binance Auth] Fetching trade history for ${symbol}...`);
    const data = await authenticatedRequest('/api/v3/myTrades', 'GET', { symbol, limit });
    console.log(`[Binance Auth] ✅ Found ${data.length} trades`);
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
    return !!(BINANCE_API_KEY && BINANCE_SECRET_KEY);
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
    isConfigured
};
