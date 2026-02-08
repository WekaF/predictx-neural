import { Candle } from '../types';

// Binance API Configuration
const BINANCE_REST_API = '/api/api/v3';
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
 * Fetch historical klines from Binance REST API
 * @param symbol - App symbol (e.g., 'BTC/USD')
 * @param interval - Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
 * @param limit - Number of candles (max 1000)
 */
export async function getHistoricalKlines(
    symbol: string,
    interval: string = '1m',
    limit: number = 100
): Promise<Candle[]> {
    const binanceSymbol = toBinanceSymbol(symbol);
    const url = `${BINANCE_REST_API}/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;

    try {
        console.log(`[Binance] Fetching ${limit} ${interval} candles for ${symbol} (${binanceSymbol})...`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const candles = data.map(normalizeKlineArray);
        
        console.log(`[Binance] ✅ Fetched ${candles.length} candles for ${symbol}`);
        return candles;
    } catch (error) {
        console.error(`[Binance] ❌ Error fetching klines for ${symbol}:`, error);
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
    const url = `${BINANCE_REST_API}/ticker/price?symbol=${binanceSymbol}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Binance API error: ${response.status}`);
        }

        const data = await response.json();
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
    const url = `${BINANCE_REST_API}/depth?symbol=${binanceSymbol}&limit=${limit}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch order book');
        const data = await response.json();
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
