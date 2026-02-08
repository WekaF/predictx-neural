import { Candle } from '../types';

export const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[prices.length - i] - prices[prices.length - i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

export const calculateSMA = (prices: number[], period: number): number => {
  if (prices.length < period) return prices[prices.length - 1];
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
};

export const calculateEMA = (prices: number[], period: number): number => {
  if (prices.length < period) return calculateSMA(prices, period);
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
};

export const calculateBollingerBands = (prices: number[], period: number = 20, multiplier: number = 2) => {
  if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
  
  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  
  const squaredDiffs = slice.map(price => Math.pow(price - sma, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(avgSquaredDiff);

  return {
      upper: sma + (multiplier * stdDev),
      middle: sma,
      lower: sma - (multiplier * stdDev)
  };
};

export const findSupportResistance = (candles: Candle[]) => {
    // Simplified pivot point logic based on local highs/lows
    // Real-world would use clustering algorithms
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    return {
        support: Math.min(...lows.slice(-20)),
        resistance: Math.max(...highs.slice(-20))
    };
};

export const detectCandlePatterns = (current: Candle, prev: Candle, volumeSma: number) => {
    const bodySize = Math.abs(current.close - current.open);
    const prevBodySize = Math.abs(prev.close - prev.open);
    const upperWick = current.high - Math.max(current.open, current.close);
    const lowerWick = Math.min(current.open, current.close) - current.low;
    const isHighVolume = current.volume > volumeSma * 1.2;

    const patterns: string[] = [];

    // 1. Doji (Indecision)
    if (bodySize <= (current.high - current.low) * 0.1) {
        patterns.push("Doji");
    }

    // 2. Hammer / Pin Bar (Rejection)
    if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
        patterns.push("Hammer/Pin Bar (Bullish)");
    } else if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
        patterns.push("Shooting Star (Bearish)");
    }

    // 3. Engulfing (Momentum Shift)
    const isBullishEngulfing = current.close > current.open && prev.close < prev.open && 
                               current.open < prev.close && current.close > prev.open;
    
    const isBearishEngulfing = current.close < current.open && prev.close > prev.open &&
                               current.open > prev.close && current.close < prev.open;

    if (isBullishEngulfing && isHighVolume) patterns.push("Bullish Engulfing");
    if (isBearishEngulfing && isHighVolume) patterns.push("Bearish Engulfing");

    return patterns.join(", ");
};

export const calculateFibonacci = (high: number, low: number, trend: 'UP' | 'DOWN' | 'SIDEWAYS') => {
  const diff = high - low;
  if (trend === 'UP') {
    return {
      level0: low,
      level236: low + diff * 0.236,
      level382: low + diff * 0.382,
      level500: low + diff * 0.5,
      level618: low + diff * 0.618,
      level100: high,
    };
  } else {
    return {
      level0: high,
      level236: high - diff * 0.236,
      level382: high - diff * 0.382,
      level500: high - diff * 0.5,
      level618: high - diff * 0.618,
      level100: low,
    };
  }
};

export const generateMockData = (initialPrice: number, count: number): Candle[] => {
  const data: Candle[] = [];
  let currentPrice = initialPrice;
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const time = new Date(now.getTime() - (count - i) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const volatility = currentPrice * 0.005; // 0.5% volatility
    const change = (Math.random() - 0.5) * volatility;
    
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.5);
    const volume = Math.floor(Math.random() * 1000) + 100;

    data.push({
      time,
      open,
      high,
      low,
      close,
      volume
    });

    currentPrice = close;
  }
  return data;
};

export const analyzeTrend = (candles: Candle[], sma200: number): 'UP' | 'DOWN' | 'SIDEWAYS' => {
  const currentPrice = candles[candles.length - 1].close;
  // Professional logic: Trend is defined by price relation to 200 SMA
  if (currentPrice > sma200 * 1.001) return 'UP';
  if (currentPrice < sma200 * 0.999) return 'DOWN';
  return 'SIDEWAYS';
};

export const calculateMACD = (prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) => {
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    const macdLine = fastEMA - slowEMA;
    
    // We need historical MACD line values to calculate the signal line (EMA of MACD)
    // For simplicity in this real-time snapshot, we'll approximate or require more data processing
    // Proper way: Calculate MACD for whole series, then EMA of that series.
    // Here we will just return the MACD line and a simplified signal for the current candle
    
    return {
        macd: macdLine,
        signal: macdLine * 0.9, // Placeholder: Real signal requires EMA of MACD history
        histogram: macdLine - (macdLine * 0.9)
    };
};

// Full MACD calculation requiring historical EMA series
export const calculateFullMACD = (prices: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    if (prices.length < slowPeriod + signalPeriod) return { macd: 0, signal: 0, histogram: 0 };

    // Calculate EMAs for the entire series
    const kFast = 2 / (fastPeriod + 1);
    const kSlow = 2 / (slowPeriod + 1);
    const kSignal = 2 / (signalPeriod + 1);

    const fastEMAs: number[] = [];
    const slowEMAs: number[] = [];
    
    let fastEma = prices[0];
    let slowEma = prices[0];

    for (let i = 0; i < prices.length; i++) {
        fastEma = prices[i] * kFast + fastEma * (1 - kFast);
        slowEma = prices[i] * kSlow + slowEma * (1 - kSlow);
        fastEMAs.push(fastEma);
        slowEMAs.push(slowEma);
    }

    const macdLine = fastEMAs.map((f, i) => f - slowEMAs[i]);
    
    // Calculate Signal Line (EMA of MACD Line)
    let signalEma = macdLine[0];
    for (let i = 0; i < macdLine.length; i++) {
        signalEma = macdLine[i] * kSignal + signalEma * (1 - kSignal);
    }

    const currentMACD = macdLine[macdLine.length - 1];
    
    return {
        macd: currentMACD,
        signal: signalEma,
        histogram: currentMACD - signalEma
    };
};

export const calculateStochastic = (candles: Candle[], kPeriod = 14, dPeriod = 3) => {
    if (candles.length < kPeriod) return { k: 50, d: 50 };

    const current = candles[candles.length - 1];
    const periodSlice = candles.slice(-kPeriod);
    
    const lowLow = Math.min(...periodSlice.map(c => c.low));
    const highHigh = Math.max(...periodSlice.map(c => c.high));

    const currentK = ((current.close - lowLow) / (highHigh - lowLow)) * 100;

    // Smooth K for D (Simple Moving Average of K)
    // simplified for current snapshot
    return {
        k: currentK,
        d: currentK // Placeholder, typically SMA over dPeriod of K
    };
};

export const calculateMomentum = (prices: number[], period: number = 10) => {
    if (prices.length < period) return 0;
    return prices[prices.length - 1] - prices[prices.length - 1 - period];
};