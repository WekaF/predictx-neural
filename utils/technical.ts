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
  if (prices.length === 0) return 0;
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

// --- SERIES CALCULATORS FOR CHARTING ---

export const calculateSeriesSMA = (prices: number[], period: number): (number | null)[] => {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
};

export const calculateSeriesEMA = (prices: number[], period: number): (number | null)[] => {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema = prices[0];
  
  // First value is SMA (or price itself for simplicity at index 0)
  result.push(ema);

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
};

export const calculateSeriesKDJ = (candles: Candle[], n: number = 9, m1: number = 3, m2: number = 3) => {
  const kArr: number[] = [];
  const dArr: number[] = [];
  const jArr: number[] = [];

  let k = 50;
  let d = 50;

  for (let i = 0; i < candles.length; i++) {
    const slice = candles.slice(Math.max(0, i - n + 1), i + 1);
    const lowLow = Math.min(...slice.map(c => c.low));
    const highHigh = Math.max(...slice.map(c => c.high));
    
    let rsv = 50;
    if (highHigh - lowLow !== 0) {
      rsv = ((candles[i].close - lowLow) / (highHigh - lowLow)) * 100;
    }

    k = (2/3) * k + (1/3) * rsv;
    d = (2/3) * d + (1/3) * k;
    const j = 3 * k - 2 * d;

    kArr.push(k);
    dArr.push(d);
    jArr.push(j);
  }

  return { k: kArr, d: dArr, j: jArr };
};

export const calculateSeriesRSI = (prices: number[], period: number = 14): (number | null)[] => {
  const result: (number | null)[] = [];
  let gains = 0;
  let losses = 0;

  // First RSI
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Fill nulls
  for (let i = 0; i < period; i++) result.push(null);
  
  // Calculate first
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - (100 / (1 + rs)));

  // Rest
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - (100 / (1 + rs)));
  }

  return result;
};

export const calculateSeriesMACD = (prices: number[], fast: number = 12, slow: number = 26, signal: number = 9) => {
  const fastEMA = calculateSeriesEMA(prices, fast);
  const slowEMA = calculateSeriesEMA(prices, slow);
  
  const macdLine: (number | null)[] = [];
  for(let i=0; i<prices.length; i++) {
      if (fastEMA[i] !== null && slowEMA[i] !== null) {
          macdLine.push(fastEMA[i]! - slowEMA[i]!);
      } else {
          macdLine.push(null);
      }
  }

  // Signal line is EMA of MACD line
  // Filter nulls to calculate signal, then align
  const validMacd = macdLine.filter(x => x !== null) as number[];
  const validSignal = calculateSeriesEMA(validMacd, signal);
  
  const signalLine: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  
  let signalIdx = 0;
  for(let i=0; i<macdLine.length; i++) {
      if (macdLine[i] === null) {
          signalLine.push(null);
          histogram.push(null);
      } else {
          // Align signal with valid macd start
          if (signalIdx < validSignal.length) {
              signalLine.push(validSignal[signalIdx]);
              histogram.push(macdLine[i]! - validSignal[signalIdx]!);
              signalIdx++;
          } else {
               signalLine.push(null);
               histogram.push(null);
          }
      }
  }

  return { macd: macdLine, signal: signalLine, histogram };
};

export const calculateSeriesBollinger = (prices: number[], period: number = 20, multiplier: number = 2) => {
  const sma = calculateSeriesSMA(prices, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const middle: (number | null)[] = [...sma];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    
    // Standard Deviation
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = sma[i]!;
    const squaredDiffs = slice.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push(mean + multiplier * stdDev);
    lower.push(mean - multiplier * stdDev);
  }

  return { upper, middle, lower };
};

// --- RSI DIVERGENCE DETECTION ---

export interface PivotPoint {
  index: number;
  value: number;
  type: 'HIGH' | 'LOW';
}

export interface RSIDivergence {
  type: 'BULLISH' | 'BEARISH';
  strength: number; // 0-100
  pricePoints: { index: number; value: number }[];
  rsiPoints: { index: number; value: number }[];
  detectedAt: number;
}

/**
 * Find pivot points (local peaks and troughs) in a data series
 * @param values - Array of values (prices or RSI)
 * @param lookback - Number of candles to look left and right (default: 5)
 * @returns Array of pivot points with their indices and values
 */
export const findPivotPoints = (
  values: number[],
  lookback: number = 5
): PivotPoint[] => {
  const pivots: PivotPoint[] = [];
  
  // Need at least lookback*2+1 values to find a pivot
  if (values.length < lookback * 2 + 1) return pivots;

  for (let i = lookback; i < values.length - lookback; i++) {
    const current = values[i];
    let isHigh = true;
    let isLow = true;

    // Check if current point is higher/lower than surrounding points
    for (let j = 1; j <= lookback; j++) {
      if (values[i - j] >= current || values[i + j] >= current) {
        isHigh = false;
      }
      if (values[i - j] <= current || values[i + j] <= current) {
        isLow = false;
      }
    }

    if (isHigh) {
      pivots.push({ index: i, value: current, type: 'HIGH' });
    } else if (isLow) {
      pivots.push({ index: i, value: current, type: 'LOW' });
    }
  }

  return pivots;
};

/**
 * Detect RSI divergence between price action and RSI indicator
 * @param candles - Array of candles
 * @param rsiValues - Array of RSI values (must match candles length)
 * @param lookback - Lookback period for pivot detection (default: 5)
 * @param minStrength - Minimum strength threshold (default: 40)
 * @returns RSIDivergence object or null if no divergence detected
 */
export const detectRSIDivergence = (
  candles: Candle[],
  rsiValues: number[],
  lookback: number = 5,
  minStrength: number = 40
): RSIDivergence | null => {
  if (candles.length < 20 || rsiValues.length !== candles.length) {
    return null;
  }

  // Extract price highs and lows
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // Find pivot points
  const priceHighPivots = findPivotPoints(highs, lookback).filter(p => p.type === 'HIGH');
  const priceLowPivots = findPivotPoints(lows, lookback).filter(p => p.type === 'LOW');
  const rsiHighPivots = findPivotPoints(rsiValues, lookback).filter(p => p.type === 'HIGH');
  const rsiLowPivots = findPivotPoints(rsiValues, lookback).filter(p => p.type === 'LOW');

  // Need at least 2 pivots to detect divergence
  if (priceHighPivots.length < 2 || priceLowPivots.length < 2 ||
      rsiHighPivots.length < 2 || rsiLowPivots.length < 2) {
    return null;
  }

  // Check for BULLISH divergence (price lower low, RSI higher low)
  const recentPriceLows = priceLowPivots.slice(-2);
  const recentRsiLows = rsiLowPivots.slice(-2);

  if (recentPriceLows.length === 2 && recentRsiLows.length === 2) {
    const priceLow1 = recentPriceLows[0];
    const priceLow2 = recentPriceLows[1];
    const rsiLow1 = recentRsiLows[0];
    const rsiLow2 = recentRsiLows[1];

    // Check if indices are reasonably close (within 10 candles)
    if (Math.abs(priceLow1.index - rsiLow1.index) < 10 &&
        Math.abs(priceLow2.index - rsiLow2.index) < 10) {
      
      // Bullish: price making lower low, RSI making higher low
      if (priceLow2.value < priceLow1.value && rsiLow2.value > rsiLow1.value) {
        const priceChange = ((priceLow1.value - priceLow2.value) / priceLow1.value) * 100;
        const rsiChange = rsiLow2.value - rsiLow1.value;
        const strength = Math.min(100, (priceChange + rsiChange) * 2);

        if (strength >= minStrength) {
          return {
            type: 'BULLISH',
            strength: Math.round(strength),
            pricePoints: [
              { index: priceLow1.index, value: priceLow1.value },
              { index: priceLow2.index, value: priceLow2.value }
            ],
            rsiPoints: [
              { index: rsiLow1.index, value: rsiLow1.value },
              { index: rsiLow2.index, value: rsiLow2.value }
            ],
            detectedAt: Date.now()
          };
        }
      }
    }
  }

  // Check for BEARISH divergence (price higher high, RSI lower high)
  const recentPriceHighs = priceHighPivots.slice(-2);
  const recentRsiHighs = rsiHighPivots.slice(-2);

  if (recentPriceHighs.length === 2 && recentRsiHighs.length === 2) {
    const priceHigh1 = recentPriceHighs[0];
    const priceHigh2 = recentPriceHighs[1];
    const rsiHigh1 = recentRsiHighs[0];
    const rsiHigh2 = recentRsiHighs[1];

    // Check if indices are reasonably close
    if (Math.abs(priceHigh1.index - rsiHigh1.index) < 10 &&
        Math.abs(priceHigh2.index - rsiHigh2.index) < 10) {
      
      // Bearish: price making higher high, RSI making lower high
      if (priceHigh2.value > priceHigh1.value && rsiHigh2.value < rsiHigh1.value) {
        const priceChange = ((priceHigh2.value - priceHigh1.value) / priceHigh1.value) * 100;
        const rsiChange = rsiHigh1.value - rsiHigh2.value;
        const strength = Math.min(100, (priceChange + rsiChange) * 2);

        if (strength >= minStrength) {
          return {
            type: 'BEARISH',
            strength: Math.round(strength),
            pricePoints: [
              { index: priceHigh1.index, value: priceHigh1.value },
              { index: priceHigh2.index, value: priceHigh2.value }
            ],
            rsiPoints: [
              { index: rsiHigh1.index, value: rsiHigh1.value },
              { index: rsiHigh2.index, value: rsiHigh2.value }
            ],
            detectedAt: Date.now()
          };
        }
      }
    }
  }

  return null;
};