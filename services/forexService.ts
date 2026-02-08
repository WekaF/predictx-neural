import { Candle } from '../types';

// Twelve Data API Configuration
const TWELVE_DATA_API = 'https://api.twelvedata.com';
const API_KEY = import.meta.env.VITE_TWELVEDATA_API_KEY || 'demo'; // Use 'demo' for testing

// Symbol mapping: App format → Twelve Data format
const FOREX_SYMBOLS: Record<string, string> = {
    'EUR/USD': 'EUR/USD',
    'GBP/USD': 'GBP/USD',
    'USD/JPY': 'USD/JPY',
    'AUD/USD': 'AUD/USD',
    'USD/CAD': 'USD/CAD',
    'EUR/GBP': 'EUR/GBP',
    'USD/CHF': 'USD/CHF',
    'XAU/USD': 'XAU/USD', // Gold
    'XAG/USD': 'XAG/USD', // Silver
    'WTI/USD': 'WTI/USD', // Crude Oil
};

// Twelve Data time series format
interface TwelveDataBar {
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
}

interface TwelveDataResponse {
    meta: {
        symbol: string;
        interval: string;
        currency: string;
        exchange_timezone: string;
        exchange: string;
        type: string;
    };
    values: TwelveDataBar[];
    status: string;
}

/**
 * Normalize Twelve Data bar to Candle format
 */
function normalizeBar(bar: TwelveDataBar): Candle {
    return {
        time: String(new Date(bar.datetime).getTime()), // Convert timestamp to string
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: bar.volume ? parseFloat(bar.volume) : 0
    };
}

/**
 * Fetch historical forex/commodity data from Twelve Data
 * @param symbol - App symbol (e.g., 'EUR/USD', 'XAU/USD')
 * @param interval - Timeframe (1min, 5min, 15min, 1h, 4h, 1day)
 * @param outputsize - Number of candles (max 5000)
 */
export async function getForexCandles(
    symbol: string,
    interval: string = '1min',
    outputsize: number = 100
): Promise<Candle[]> {
    const twelveSymbol = FOREX_SYMBOLS[symbol] || symbol;
    const url = `${TWELVE_DATA_API}/time_series?symbol=${twelveSymbol}&interval=${interval}&outputsize=${outputsize}&apikey=${API_KEY}`;

    try {
        console.log(`[Twelve Data] Fetching ${outputsize} ${interval} candles for ${symbol}...`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Twelve Data API error: ${response.status} ${response.statusText}`);
        }

        const data: TwelveDataResponse = await response.json();
        
        if (data.status === 'error') {
            throw new Error(`Twelve Data error: ${JSON.stringify(data)}`);
        }

        if (!data.values || data.values.length === 0) {
            console.warn(`[Twelve Data] ⚠️ No data returned for ${symbol}`);
            return [];
        }

        // Reverse array (Twelve Data returns newest first, we want oldest first)
        const candles = data.values.reverse().map(normalizeBar);
        
        console.log(`[Twelve Data] ✅ Fetched ${candles.length} candles for ${symbol}`);
        return candles;
    } catch (error) {
        console.error(`[Twelve Data] ❌ Error fetching candles for ${symbol}:`, error);
        throw error;
    }
}

/**
 * Get current price for forex/commodity symbol
 * @param symbol - App symbol (e.g., 'EUR/USD')
 */
export async function getForexPrice(symbol: string): Promise<number> {
    const twelveSymbol = FOREX_SYMBOLS[symbol] || symbol;
    const url = `${TWELVE_DATA_API}/price?symbol=${twelveSymbol}&apikey=${API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Twelve Data API error: ${response.status}`);
        }

        const data = await response.json();
        return parseFloat(data.price);
    } catch (error) {
        console.error(`[Twelve Data] Error fetching price for ${symbol}:`, error);
        throw error;
    }
}

/**
 * Start polling for real-time forex updates
 * Note: Twelve Data doesn't have WebSocket, so we poll every 5 seconds
 * @param symbol - App symbol
 * @param interval - Timeframe
 * @param onUpdate - Callback when new data arrives
 * @returns Interval ID (call clearInterval() to stop)
 */
export function startForexPolling(
    symbol: string,
    interval: string = '1min',
    onUpdate: (candle: Candle) => void
): number {
    console.log(`[Twelve Data Polling] Starting polling for ${symbol} every 5s...`);
    
    // Initial fetch
    getForexCandles(symbol, interval, 1)
        .then(candles => {
            if (candles.length > 0) {
                onUpdate(candles[0]);
            }
        })
        .catch(err => console.error('[Twelve Data Polling] Initial fetch error:', err));

    // Poll every 5 seconds
    const intervalId = window.setInterval(async () => {
        try {
            const candles = await getForexCandles(symbol, interval, 1);
            if (candles.length > 0) {
                onUpdate(candles[0]);
            }
        } catch (error) {
            console.error('[Twelve Data Polling] Polling error:', error);
        }
    }, 5000); // 5 seconds

    return intervalId;
}

/**
 * Check if symbol is supported by Twelve Data
 */
export function isForexSupported(symbol: string): boolean {
    return symbol in FOREX_SYMBOLS;
}

/**
 * Get API usage info (for monitoring rate limits)
 */
export async function getAPIUsage(): Promise<any> {
    const url = `${TWELVE_DATA_API}/api_usage?apikey=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log('[Twelve Data] API Usage:', data);
        return data;
    } catch (error) {
        console.error('[Twelve Data] Error fetching API usage:', error);
        return null;
    }
}
