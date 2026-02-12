import { Candle, TechnicalIndicators, NewsItem } from '../types';
import { MarketContext } from '../types/enhanced';

/**
 * Market Context Service
 * Captures complete market state snapshot for AI training
 */

/**
 * Calculate Average True Range (ATR) for volatility measurement
 */
export const calculateATR = (candles: Candle[], period: number = 14): number => {
  if (candles.length < period + 1) return 0;

  const trueRanges: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  // Calculate average of last 'period' true ranges
  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;
};

/**
 * Calculate Bollinger Band Width for volatility
 */
export const calculateBollingerBandWidth = (candles: Candle[], period: number = 20): number => {
  if (candles.length < period) return 0;

  const closes = candles.slice(-period).map(c => c.close);
  const sma = closes.reduce((sum, price) => sum + price, 0) / period;
  
  // Calculate standard deviation
  const squaredDiffs = closes.map(price => Math.pow(price - sma, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
  const stdDev = Math.sqrt(variance);
  
  // BB Width = (Upper Band - Lower Band) / Middle Band
  const upperBand = sma + (2 * stdDev);
  const lowerBand = sma - (2 * stdDev);
  
  return ((upperBand - lowerBand) / sma) * 100; // As percentage
};

/**
 * Calculate Historical Volatility (standard deviation of returns)
 */
export const calculateHistoricalVolatility = (candles: Candle[], period: number = 20): number => {
  if (candles.length < period + 1) return 0;

  const returns: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const returnPct = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
    returns.push(returnPct);
  }
  
  const recentReturns = returns.slice(-period);
  const avgReturn = recentReturns.reduce((sum, r) => sum + r, 0) / period;
  
  const squaredDiffs = recentReturns.map(r => Math.pow(r - avgReturn, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
  
  // Annualized volatility (assuming 1-minute candles, 525600 minutes/year)
  return Math.sqrt(variance) * Math.sqrt(525600) * 100; // As percentage
};

/**
 * Analyze volume profile
 */
export const analyzeVolumeProfile = (candles: Candle[], period: number = 20) => {
  if (candles.length < period) {
    return {
      current: 0,
      average: 0,
      volumeRatio: 1
    };
  }

  const recentCandles = candles.slice(-period);
  const currentVolume = candles[candles.length - 1].volume;
  const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / period;
  
  return {
    current: currentVolume,
    average: avgVolume,
    volumeRatio: avgVolume > 0 ? currentVolume / avgVolume : 1
  };
};

/**
 * Get 24-hour price action metrics
 */
export const getPriceAction = (candles: Candle[]) => {
  if (candles.length === 0) {
    return {
      currentPrice: 0,
      priceChange24h: 0,
      highLow24h: { high: 0, low: 0 }
    };
  }

  const currentPrice = candles[candles.length - 1].close;
  
  // Assuming 1-minute candles, 24h = 1440 candles
  const candles24h = candles.slice(-1440);
  
  if (candles24h.length === 0) {
    return {
      currentPrice,
      priceChange24h: 0,
      highLow24h: { high: currentPrice, low: currentPrice }
    };
  }

  const price24hAgo = candles24h[0].close;
  const priceChange24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;
  
  const high24h = Math.max(...candles24h.map(c => c.high));
  const low24h = Math.min(...candles24h.map(c => c.low));
  
  return {
    currentPrice,
    priceChange24h,
    highLow24h: { high: high24h, low: low24h }
  };
};

/**
 * Calculate aggregate sentiment from news
 */
export const calculateAggregateSentiment = (news: NewsItem[]) => {
  if (news.length === 0) {
    return {
      score: 0,
      newsCount: 0,
      dominantSentiment: 'NEUTRAL' as const
    };
  }

  let sentimentSum = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  news.forEach(item => {
    if (item.sentiment === 'POSITIVE') {
      sentimentSum += 1;
      positiveCount++;
    } else if (item.sentiment === 'NEGATIVE') {
      sentimentSum -= 1;
      negativeCount++;
    } else {
      neutralCount++;
    }
  });

  const score = sentimentSum / news.length; // -1 to 1
  
  let dominantSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  if (positiveCount > negativeCount && positiveCount > neutralCount) {
    dominantSentiment = 'BULLISH';
  } else if (negativeCount > positiveCount && negativeCount > neutralCount) {
    dominantSentiment = 'BEARISH';
  } else {
    dominantSentiment = 'NEUTRAL';
  }

  return {
    score,
    newsCount: news.length,
    dominantSentiment
  };
};

/**
 * Find which Fibonacci level the current price is near
 */
export const findNearestFibLevel = (
  currentPrice: number,
  fibLevels: { level0: number; level236: number; level382: number; level500: number; level618: number; level100: number }
): number | undefined => {
  const levels = [
    { value: 0, price: fibLevels.level0 },
    { value: 0.236, price: fibLevels.level236 },
    { value: 0.382, price: fibLevels.level382 },
    { value: 0.5, price: fibLevels.level500 },
    { value: 0.618, price: fibLevels.level618 },
    { value: 1.0, price: fibLevels.level100 }
  ];

  let nearestLevel: number | undefined;
  let minDistance = Infinity;

  levels.forEach(level => {
    const distance = Math.abs(currentPrice - level.price);
    if (distance < minDistance) {
      minDistance = distance;
      nearestLevel = level.value;
    }
  });

  // Only return if within 1% of the level
  const priceRange = Math.abs(fibLevels.level100 - fibLevels.level0);
  if (minDistance < priceRange * 0.01) {
    return nearestLevel;
  }

  return undefined;
};

/**
 * Main function: Capture complete market context snapshot
 */
export const captureMarketContext = (
  candles: Candle[],
  indicators: TechnicalIndicators,
  sentimentScore: number,
  news: NewsItem[]
): MarketContext => {
  // Volatility metrics
  const atr = calculateATR(candles);
  const bollingerBandWidth = calculateBollingerBandWidth(candles);
  const historicalVolatility = calculateHistoricalVolatility(candles);

  // Sentiment analysis
  const sentimentData = calculateAggregateSentiment(news);

  // Volume analysis
  const volumeData = analyzeVolumeProfile(candles);

  // Price action
  const priceActionData = getPriceAction(candles);

  // Fibonacci level
  const fibLevel = findNearestFibLevel(priceActionData.currentPrice, indicators.fibLevels);

  return {
    indicators: {
      rsi: indicators.rsi,
      macd: indicators.macd,
      stochastic: indicators.stochastic,
      sma20: indicators.sma20 || 0,
      sma50: indicators.sma50,
      sma200: indicators.sma200,
      ema12: indicators.ema12 || 0,
      ema26: indicators.ema26 || 0,
      momentum: indicators.momentum
    },
    volatility: {
      atr,
      bollingerBandWidth,
      historicalVolatility
    },
    sentiment: {
      score: sentimentScore,
      newsCount: sentimentData.newsCount,
      dominantSentiment: sentimentData.dominantSentiment
    },
    structure: {
      trend: indicators.trend,
      nearestSupport: indicators.nearestSupport,
      nearestResistance: indicators.nearestResistance,
      fibLevel
    },
    volume: volumeData,
    priceAction: priceActionData
  };
};

export const marketContextService = {
  captureMarketContext,
  calculateATR,
  calculateBollingerBandWidth,
  calculateHistoricalVolatility,
  analyzeVolumeProfile,
  getPriceAction,
  calculateAggregateSentiment,
  findNearestFibLevel
};
