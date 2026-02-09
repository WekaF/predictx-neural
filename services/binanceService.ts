import { Candle } from '../types';

// Binance API Configuration with Fallback System
// Try multiple proxies, fallback to CoinGecko if all fail
const CORS_PROXIES = [
    { name: 'corsproxy', url: 'https://corsproxy.io/?', needsEncoding: true },
    { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=', needsEncoding: true },
    { name: 'cors.sh', url: 'https://proxy.cors.sh/', needsEncoding: false }
];

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

/**
 * Fetch data from Binance using rotating proxies
 */
async function fetchWithFallback(endpoint: string, params: string) {
    // 1. Try Vercel/Vite Proxy (Relative Path) first - Best for production/local dev
    try {
        // Construct relative URL: /api/v3/ticker/price...
        const proxyUrl = `/api/v3${endpoint}?${params}`;
        const response = await fetch(proxyUrl);
        
        if (response.ok) {
             return await response.json();
        }
        
        // If 404/500 from own proxy, might be because it's not configured, fall through to external proxies
    } catch (e) {
        // Fallback to external CORS proxies
    }

    // 2. Fallback to external CORS proxies
    const targetUrl = `${BINANCE_API_BASE}${endpoint}?${params}`;
    
    for (const proxy of CORS_PROXIES) {
        try {
            const proxyUrl = proxy.needsEncoding 
                ? `${proxy.url}${encodeURIComponent(targetUrl)}`
                : `${proxy.url}${targetUrl}`;
                
            const response = await fetch(proxyUrl);
            
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
const CACHE_DURATION = 60000; // 1 minute cache

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

const BINANCE_WS_API = 'wss://stream.binance.com:9443/ws';

// Symbol mapping: App format → Binance format
const SYMBOL_MAP: Record<string, string> = {
    'BTC/USD': 'BTCUSDT',
    'ETH/USD': 'ETHUSDT',
    'BNB/USD': 'BNBUSDT',
    'SOL/USD': 'SOLUSDT',
    'XRP/USD': 'XRPUSDT',
    'ADA/USD': 'ADAUSDT',
    'AVAX/USD': 'AVAXUSDT',
    'DOGE/USD': 'DOGEUSDT',
    'DOT/USD': 'DOTUSDT',
    'MATIC/USD': 'MATICUSDT',
    'LINK/USD': 'LINKUSDT',
    'UNI/USD': 'UNIUSDT',
    'ATOM/USD': 'ATOMUSDT',
    'LTC/USD': 'LTCUSDT',
    'NEAR/USD': 'NEARUSDT',
};

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
 */
export function toBinanceSymbol(appSymbol: string): string {
    return SYMBOL_MAP[appSymbol] || appSymbol.replace('/', '');
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
    limit: number = 100
): Promise<Candle[]> {
    // Check cache first
    const cached = getCachedData(symbol, interval);
    if (cached) {
        return cached;
    }
    
    // Use CoinGecko directly (no proxy issues, no geo-restrictions)
    console.log(`[Data] Fetching ${limit} ${interval} candles for ${symbol} via CoinGecko...`);
    const data = await getHistoricalKlinesFromCoinGecko(symbol, interval, limit);
    
    // Cache the result
    setCachedData(symbol, interval, data);
    
    return data;
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
        const response = await fetch(url);
        
        // Check for rate limit
        if (response.status === 429) {
            console.warn('[CoinGecko] ⚠️ Rate limit hit. Using simulated data...');
            return generateSimulatedCandles(symbol, limit);
        }
        
        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if response has error (CoinGecko sometimes returns 200 with error object)
        if (data.status && data.status.error_code === 429) {
            console.warn('[CoinGecko] ⚠️ Rate limit in response. Using simulated data...');
            return generateSimulatedCandles(symbol, limit);
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
        console.warn('[CoinGecko] Using simulated data as fallback...');
        return generateSimulatedCandles(symbol, limit);
    }
}

/**
 * Generate simulated candle data when APIs are unavailable
 */
function generateSimulatedCandles(symbol: string, limit: number): Candle[] {
    console.log(`[Simulator] Generating ${limit} simulated candles for ${symbol}...`);
    
    // Base prices for different assets
    const basePrices: Record<string, number> = {
        'BTC/USD': 95000,
        'ETH/USD': 3500,
        'BNB/USD': 600,
        'SOL/USD': 180,
        'XRP/USD': 2.5,
        'ADA/USD': 0.95,
        'AVAX/USD': 40,
        'DOGE/USD': 0.35,
        'DOT/USD': 7.5,
        'MATIC/USD': 0.85,
        'LINK/USD': 20,
        'UNI/USD': 12,
        'ATOM/USD': 10,
        'LTC/USD': 105,
        'NEAR/USD': 6
    };
    
    let basePrice = basePrices[symbol] || 100;
    const candles: Candle[] = [];
    const now = Date.now();
    
    for (let i = 0; i < limit; i++) {
        const volatility = 0.002; // 0.2% volatility
        const change = (Math.random() - 0.5) * 2 * volatility;
        
        const open = basePrice;
        const close = basePrice * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * volatility);
        const low = Math.min(open, close) * (1 - Math.random() * volatility);
        
        candles.push({
            time: String(now - (limit - i) * 60000), // 1 minute intervals
            open,
            high,
            low,
            close,
            volume: Math.random() * 1000000
        });
        
        basePrice = close; // Next candle starts where this one ended
    }
    
    console.log(`[Simulator] ✅ Generated ${candles.length} simulated candles`);
    return candles;
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
    const binanceSymbol = toBinanceSymbol(symbol).toLowerCase();
    const stream = `${binanceSymbol}@kline_${interval}`;
    const url = `${BINANCE_WS_API}/${stream}`;

    console.log(`[Binance WS] Connecting to ${stream}...`);
    const ws = new WebSocket(url);

    ws.onopen = () => {
        console.log(`[Binance WS] ✅ Connected to ${stream}`);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            const kline: BinanceKline = data.k;
            const candle = normalizeKlineWS(kline);
            const isClosed = kline.x; // Is kline closed?

            onUpdate(candle, isClosed);

            if (isClosed) {
                console.log(`[Binance WS] 🕯️ New ${interval} candle closed for ${symbol}: ${candle.close}`);
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
    return symbol in SYMBOL_MAP;
}
// --- Order Book Data ---
export const getOrderBook = async (symbol: string, limit: number = 10) => {
    const binanceSymbol = toBinanceSymbol(symbol);
    
    try {
        const data = await fetchWithFallback('/depth', `symbol=${binanceSymbol}&limit=${limit}`);
        return data;
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
    const url = `${BINANCE_WS_API}/${stream}`;

    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Binance depth stream update
            onUpdate({
                bids: data.bids,
                asks: data.asks
            });
        } catch (error) {
            console.error('OrderBook WebSocket Error:', error);
        }
    };

    return ws;
};
