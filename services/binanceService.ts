import { Candle } from '../types';

// Binance API Configuration with Fallback System
// Try multiple proxies, fallback to CoinGecko if all fail
const CORS_PROXIES = [
    { name: 'corsproxy', url: 'https://corsproxy.io/?', needsEncoding: true },
    { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=', needsEncoding: true },
    { name: 'cors.sh', url: 'https://proxy.cors.sh/', needsEncoding: false }
];

// API Configuration with Testnet Support
const BINANCE_PRODUCTION_API = 'https://api.binance.com/api/v3';
const BINANCE_TESTNET_API = 'https://demo-fapi.binance.com/fapi/v1';
const BINANCE_TESTNET_WS = 'wss://stream.binancefuture.com/ws'; // Futures Testnet WS
const BINANCE_DIRECT_WS = 'wss://stream.binance.com:9443/ws'; // Backup

// Dynamic Backend URL: In dev mode always use localhost, in production use VITE_BACKEND_URL
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const LOCAL_PROXY_API = `${BACKEND_BASE_URL}/api/proxy`;
const BINANCE_PRODUCTION_WS = `${BACKEND_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/proxy`;

/**
 * Get API configuration based on testnet setting
 */
function getApiConfig(): { apiBase: string; wsBase: string } {
    try {
        const settings = localStorage.getItem('neurotrade_settings');
        // FORCE PROXY for now to ensure connection works (Bypass Block)
        const useTestnet = settings ? JSON.parse(settings).useTestnet : true;
        
        console.log(`[Binance] ⚙️ API Config - Testnet: ${useTestnet} (Forced False for Proxy Support)`);
        
        if (useTestnet) {
            return {
                apiBase: BINANCE_TESTNET_API,
                wsBase: BINANCE_TESTNET_WS
            };
        }
    } catch (e) {
        console.warn('[Binance] Failed to read testnet setting, using production');
    }
    
    return {
        apiBase: BINANCE_PRODUCTION_API,
        wsBase: BINANCE_PRODUCTION_WS
    };
}

const BINANCE_API_BASE = BINANCE_PRODUCTION_API; // Fallback default

/**
 * Helper to fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

/**
 * Fetch data from Binance using rotating proxies
 */
async function fetchWithFallback(endpoint: string, params: string) {
    // 1. Try Vercel/Vite Proxy (Relative Path) first - Best for production/local dev
    try {
        // Construct relative URL: /api/v3/ticker/price...
        const proxyUrl = `/api/v3${endpoint}?${params}`;
        const response = await fetchWithTimeout(proxyUrl, {}, 5000); // 5s timeout for local proxy
        
        if (response.ok) {
             return await response.json();
        }
        
    } catch (e) {
        // Fallback to external CORS proxies
        console.warn(`[Binance] Local proxy failed for ${endpoint}, switching to backups...`);
    }

    // 2. Fallback to external CORS proxies
    const targetUrl = `${BINANCE_API_BASE}${endpoint}?${params}`;
    
    for (const proxy of CORS_PROXIES) {
        try {
            const proxyUrl = proxy.needsEncoding 
                ? `${proxy.url}${encodeURIComponent(targetUrl)}`
                : `${proxy.url}${targetUrl}`;
                
            const response = await fetchWithTimeout(proxyUrl, {}, 10000); // 10s timeout for external proxies
            
            if (!response.ok) {
                // If 429 (Rate Limit) or 418 (IP Ban), definitely switch proxy
                if (response.status === 429 || response.status === 418) {
                    console.warn(`[Binance] Proxy ${proxy.name} rate limited/banned. Switching...`);
                    continue;
                }
                throw new Error(`Status ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.warn(`[Binance] Proxy ${proxy.name} failed for ${endpoint}:`, error);
            // Continue to next proxy
        }
    }
    
    throw new Error('All CORS proxies failed to fetch Binance data');
}

// CoinGecko API as fallback (no geo-restrictions, free)
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Cache to reduce API calls and avoid rate limits
interface CacheEntry {
    data: Candle[];
    timestamp: number;
    symbol: string;
    interval: string;
}

const dataCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 3600000; // 60 minutes cache

function getCacheKey(symbol: string, interval: string): string {
    return `${symbol}_${interval}`;
}

function getCachedData(symbol: string, interval: string): Candle[] | null {
    const key = getCacheKey(symbol, interval);
    const cached = dataCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log(`[Cache] ✅ Using cached data for ${symbol} ${interval}`);
        return cached.data;
    }
    
    return null;
}

function setCachedData(symbol: string, interval: string, data: Candle[]): void {
    const key = getCacheKey(symbol, interval);
    dataCache.set(key, {
        data,
        timestamp: Date.now(),
        symbol,
        interval
    });
}

export function hasCachedData(symbol: string, interval: string): boolean {
    const key = getCacheKey(symbol, interval);
    const cached = dataCache.get(key);
    return !!(cached && (Date.now() - cached.timestamp) < CACHE_DURATION);
}

// Force clear cache (useful when switching modes or fixing data)
export function clearCache() {
    console.log('[Cache] 🗑️ Clearing all market data cache...');
    dataCache.clear();
}
const getBinanceWsApi = () => getApiConfig().wsBase;

import { Asset } from '../types';

// Symbol mapping: App format → Binance format
// Now dynamic, but kept for legacy support if needed
const S_MAP: Record<string, string> = {};

// Binance Kline data format
interface BinanceKline {
    t: number;  // Kline start time
    T: number;  // Kline close time
    s: string;  // Symbol
    i: string;  // Interval
    f: number;  // First trade ID
    L: number;  // Last trade ID
    o: string;  // Open price
    c: string;  // Close price
    h: string;  // High price
    l: string;  // Low price
    v: string;  // Base asset volume
    n: number;  // Number of trades
    x: boolean; // Is this kline closed?
    q: string;  // Quote asset volume
    V: string;  // Taker buy base asset volume
    Q: string;  // Taker buy quote asset volume
    B: string;  // Ignore
}

/**
 * Convert app symbol to Binance symbol
 * e.g. BTC/USDT -> BTCUSDT
 */
export function toBinanceSymbol(appSymbol: string): string {
    return appSymbol.replace('/', '');
}

/**
 * Fetch Top Assets from Binance Futures via Proxy
 * Filters for USDT-M Perpetual contracts
 */
export async function fetchTopAssets(): Promise<Asset[]> {
    try {
        console.log('[Binance] 🔄 Fetching Exchange Info & Ticker Data...');
        
        // 1. Get Exchange Info (to filter for TRADING status and USDT margin)
        // Proxy: /api/proxy/fapi/v1/exchangeInfo
        const isTestnet = getApiConfig().apiBase.includes('testnet');
        const querySuffix = isTestnet ? '?testnet=true' : '';
        const exchangeInfoUrl = `${LOCAL_PROXY_API}/fapi/v1/exchangeInfo${querySuffix}`;
        const exchangeInfoRes = await fetchWithTimeout(exchangeInfoUrl, {}, 10000);
        
        if (!exchangeInfoRes.ok) throw new Error('Failed to fetch exchange info');
        const exchangeInfo = await exchangeInfoRes.json();
        
        // Filter for TRADING perps with USDT quote
        const validSymbols = new Set(
            exchangeInfo.symbols
                .filter((s: any) => 
                    s.status === 'TRADING' && 
                    s.contractType === 'PERPETUAL' && 
                    s.quoteAsset === 'USDT'
                )
                .map((s: any) => s.symbol)
        );

        // 2. Get 24hr Ticker (for Volume sorting)
        // Proxy: /api/proxy/ticker/24hr
        const tickerUrl = `${LOCAL_PROXY_API}/fapi/v1/ticker/24hr${querySuffix}`;
        const tickerRes = await fetchWithTimeout(tickerUrl, {}, 10000);
        
        if (!tickerRes.ok) throw new Error('Failed to fetch ticker data');
        const tickerData = await tickerRes.json();
        
        // 3. Filter, Sort and Map
        const assets: Asset[] = tickerData
            .filter((t: any) => validSymbols.has(t.symbol))
            .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)) // Sort by Volume (USDT)
            .slice(0, 50) // Top 50 assets
            .map((t: any) => ({
                symbol: t.symbol.replace('USDT', '/USDT'), // BTCUSDT -> BTC/USDT
                name: t.symbol.replace('USDT', ''), // Simple name derivation
                type: 'CRYPTO',
                price: parseFloat(t.lastPrice)
            }));
            
        console.log(`[Binance] ✅ Loaded ${assets.length} top assets by volume`);
        return assets;

    } catch (error) {
        console.error('[Binance] ❌ Failed to load dynamic assets:', error);
        // Fallback to minimal static list if API fails
        return [
            { symbol: 'BTC/USDT', name: 'Bitcoin', type: 'CRYPTO', price: 0 },
            { symbol: 'ETH/USDT', name: 'Ethereum', type: 'CRYPTO', price: 0 },
            { symbol: 'SOL/USDT', name: 'Solana', type: 'CRYPTO', price: 0 },
            { symbol: 'BNB/USDT', name: 'Binance Coin', type: 'CRYPTO', price: 0 },
        ];
    }
}

/**
 * Normalize Binance kline array to Candle format
 */
function normalizeKlineArray(kline: any[]): Candle {
    return {
        time: String(kline[0]), // Convert timestamp to string
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5])
    };
}

/**
 * Normalize Binance WebSocket kline to Candle format
 */
function normalizeKlineWS(kline: BinanceKline): Candle {
    return {
        time: String(kline.t), // Convert timestamp to string
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        volume: parseFloat(kline.v)
    };
}

/**
 * Fetch historical klines - Use cache first, then CoinGecko
 * @param symbol - App symbol (e.g., 'BTC/USD')
 * @param interval - Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
 * @param limit - Number of candles (max 1000)
 */
export async function getHistoricalKlines(
    symbol: string,
    interval: string = '1m',
    limit: number = 100,
    startTime?: number,
    endTime?: number
): Promise<Candle[]> {
    // Check cache first
    const cached = getCachedData(symbol, interval);
    if (cached) {
        return cached;
    }
    
    // 1. Try Binance API (via Proxy)
    try {
        const binanceSymbol = toBinanceSymbol(symbol);
        console.log(`[Binance] Fetching ${limit} ${interval} candles for ${binanceSymbol}...`);
        
        let query = `symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
        if (startTime) query += `&startTime=${startTime}`;
        if (endTime) query += `&endTime=${endTime}`;

        // Create proxy-specific query for our backend
        // Backend expects: /api/proxy/klines?symbol=BTCUSDT&interval=1m&limit=100
        const isTestnet = getApiConfig().apiBase.includes('testnet');
        if (isTestnet) query += `&testnet=true`;
        
        const proxyUrl = `${LOCAL_PROXY_API}/fapi/v1/klines?${query}`;
        
        console.log(`[Binance] Fetching from Proxy: ${proxyUrl}`);
        const response = await fetchWithTimeout(proxyUrl, {}, 10000);
        
        if (!response.ok) {
             throw new Error(`Proxy Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Normalize data
        const candles = data.map((k: any[]) => normalizeKlineArray(k));
        
        // Cache and return
        setCachedData(symbol, interval, candles);
        return candles;
        
    } catch (error) {
        console.error(`[Binance] Failed to fetch klines via Proxy:`, error);
        throw error; // Fail instead of showing stale CoinGecko data
    }
}

/**
 * Fallback: Fetch data from CoinGecko API (no geo-restrictions)
 */
async function getHistoricalKlinesFromCoinGecko(
    symbol: string,
    interval: string,
    limit: number
): Promise<Candle[]> {
    try {
        // Map symbol to CoinGecko ID
        const coinId = symbol.replace('/USD', '').toLowerCase();
        const coinGeckoMap: Record<string, string> = {
            'btc': 'bitcoin',
            'eth': 'ethereum',
            'bnb': 'binancecoin',
            'sol': 'solana',
            'xrp': 'ripple',
            'ada': 'cardano',
            'avax': 'avalanche-2',
            'doge': 'dogecoin',
            'dot': 'polkadot',
            'matic': 'matic-network',
            'link': 'chainlink',
            'uni': 'uniswap',
            'atom': 'cosmos',
            'ltc': 'litecoin',
            'near': 'near'
        };
        
        const geckoId = coinGeckoMap[coinId] || coinId;
        const days = limit > 100 ? 30 : limit > 50 ? 7 : 1;
        
        console.log(`[CoinGecko] Fetching ${limit} candles for ${symbol} (${geckoId})...`);
        
        const url = `${COINGECKO_API}/coins/${geckoId}/market_chart?vs_currency=usd&days=${days}`;
        const response = await fetchWithTimeout(url, {}, 10000); // 10s timeout
        
        // Check for rate limit
        if (response.status === 429) {
            throw new Error('CoinGecko API Rate Limit');
        }
        
        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if response has error (CoinGecko sometimes returns 200 with error object)
        if (data.status && data.status.error_code === 429) {
            throw new Error('CoinGecko API Rate Limit');
        }
        
        // Convert CoinGecko format to Candle format
        const prices = data.prices || [];
        const candles: Candle[] = prices.slice(-limit).map((price: [number, number], index: number) => ({
            time: String(price[0]),
            open: index > 0 ? prices[index - 1][1] : price[1],
            high: price[1] * 1.001, // Approximate
            low: price[1] * 0.999,  // Approximate
            close: price[1],
            volume: 1000000 // CoinGecko doesn't provide volume in this endpoint
        }));
        
        console.log(`[CoinGecko] ✅ Fetched ${candles.length} candles for ${symbol}`);
        return candles;
    } catch (error) {
        console.error(`[CoinGecko] ❌ Error fetching data:`, error);
        throw error;
    }
}

/**
 * Connect to Binance WebSocket for real-time kline updates
 * @param symbol - App symbol (e.g., 'BTC/USD')
 * @param interval - Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
 * @param onUpdate - Callback when new candle data arrives
 * @returns WebSocket instance (call .close() to disconnect)
 */
export function connectKlineStream(
    symbol: string,
    interval: string = '1m',
    onUpdate: (candle: Candle, isClosed: boolean) => void
): WebSocket {
    // Futures streams must be lowercase
    const binanceSymbol = toBinanceSymbol(symbol).toLowerCase();
    const stream = `${binanceSymbol}@kline_${interval}`;
    
    // Use proxy base URL
    const wsBase = getBinanceWsApi();
    const url = `${wsBase}/${stream}`;

    console.log(`[Binance WS] Connecting to ${url}...`);
    const ws = new WebSocket(url);

    ws.onopen = () => {
        console.log(`[Binance WS] ✅ Connected to ${stream}`);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // console.log('[Binance WS Debug]', data); // Uncomment for verbose debug
            
            // Check if it's a kline event
            if (data.e && data.e === 'kline') {
                const kline: BinanceKline = data.k;
                const candle = normalizeKlineWS(kline);
                const isClosed = kline.x;

                onUpdate(candle, isClosed);

                if (isClosed) {
                    console.log(`[Binance WS] 🕯️ New ${interval} candle closed for ${symbol}: ${candle.close}`);
                }
            }
        } catch (error) {
            console.error('[Binance WS] Error parsing message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error(`[Binance WS] ❌ Error on ${stream}:`, error);
    };

    ws.onclose = () => {
        console.log(`[Binance WS] 🔌 Disconnected from ${stream}`);
    };

    return ws;
}

/**
 * Get current price for a symbol
 * @param symbol - App symbol (e.g., 'BTC/USD')
 */
export async function getCurrentPrice(symbol: string): Promise<number> {
    const binanceSymbol = toBinanceSymbol(symbol);
    try {
        const data = await fetchWithFallback('/ticker/price', `symbol=${binanceSymbol}`);
        return parseFloat(data.price);
    } catch (error) {
        console.error(`[Binance] Error fetching price for ${symbol}:`, error);
        throw error;
    }
}

/**
 * Check if symbol is supported by Binance
 */
export function isBinanceSupported(symbol: string): boolean {
    // Since we are dynamic, we assume any symbol passed from the UI (which comes from our dynamic list) is supported
    // Could add regex check for /USDT suffix
    return symbol.endsWith('/USDT') || symbol.endsWith('USDT');
}
// --- Order Book Data ---
// Note: We are using direct connection for OrderBook for now, 
// but it should also use proxy if moving to production in blocked region.
export const getOrderBook = async (symbol: string, limit: number = 10) => {
    const binanceSymbol = toBinanceSymbol(symbol);
    
    try {
        // Fetch order book via Backend Proxy (to ensure Futures data)
        // Proxy: /api/proxy/depth?symbol=BTCUSDT&limit=10
        const isTestnet = getApiConfig().apiBase.includes('testnet');
        const querySuffix = isTestnet ? '&testnet=true' : '';
        const proxyUrl = `${LOCAL_PROXY_API}/fapi/v1/depth?symbol=${binanceSymbol}&limit=${limit}${querySuffix}`;
        const response = await fetchWithTimeout(proxyUrl, {}, 5000);
        
        if (!response.ok) throw new Error('Failed to fetch order book');
        const data = await response.json();
        
        // Filter bids and asks where quantity > 1
        // Structure is [price, quantity]
        const filterByQuantity = (entries: string[][]) => {
            return entries.filter(entry => parseFloat(entry[1]) > 1);
        };

        return {
            lastUpdateId: data.lastUpdateId,
            bids: filterByQuantity(data.bids || []),
            asks: filterByQuantity(data.asks || [])
        };
    } catch (error) {
        console.error('Error fetching order book:', error);
        return { bids: [], asks: [] };
    }
};

export const connectOrderBookStream = (
    symbol: string, 
    onUpdate: (data: { bids: string[][], asks: string[][] }) => void
): WebSocket => {
    const binanceSymbol = toBinanceSymbol(symbol).toLowerCase();
    const stream = `${binanceSymbol}@depth10@100ms`; // 10 levels, 100ms update
    const url = `${getBinanceWsApi()}/${stream}`;

    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Binance depth stream update
            // Filter updates where quantity > 1
            const filterByQuantity = (entries: string[][]) => {
                return entries.filter(entry => parseFloat(entry[1]) > 1);
            };

            onUpdate({
                bids: filterByQuantity(data.bids || []),
                asks: filterByQuantity(data.asks || [])
            });
        } catch (error) {
            console.error('OrderBook WebSocket Error:', error);
        }
    };

    return ws;
};
