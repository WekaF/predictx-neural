import { EnhancedExecutedTrade, TradeAnalytics, PatternPerformance, ConfidenceCalibration, TimeBasedPerformance } from '../types/enhanced';

/**
 * Trade Analytics Service
 * Comprehensive trade performance analysis engine for AI training optimization
 */

/**
 * Calculate pattern-level performance metrics
 */
export const analyzePatternPerformance = (trades: EnhancedExecutedTrade[]): PatternPerformance[] => {
  // Group trades by pattern
  const patternGroups = new Map<string, EnhancedExecutedTrade[]>();
  
  trades.forEach(trade => {
    const pattern = trade.patternDetected || 'Unknown';
    if (!patternGroups.has(pattern)) {
      patternGroups.set(pattern, []);
    }
    patternGroups.get(pattern)!.push(trade);
  });

  // Calculate metrics for each pattern
  const performances: PatternPerformance[] = [];

  patternGroups.forEach((patternTrades, patternName) => {
    const wins = patternTrades.filter(t => t.outcome === 'WIN').length;
    const losses = patternTrades.filter(t => t.outcome === 'LOSS').length;
    const totalTrades = wins + losses;

    if (totalTrades === 0) return;

    const winRate = (wins / totalTrades) * 100;
    
    const pnls = patternTrades.map(t => t.pnl);
    const totalPnl = pnls.reduce((sum, pnl) => sum + pnl, 0);
    const avgPnl = totalPnl / totalTrades;
    
    const confidences = patternTrades
      .filter(t => t.aiConfidence !== undefined)
      .map(t => t.aiConfidence!);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0;

    const rrs = patternTrades
      .filter(t => t.actualRR !== undefined)
      .map(t => t.actualRR!);
    const avgRR = rrs.length > 0
      ? rrs.reduce((sum, rr) => sum + rr, 0) / rrs.length
      : 0;

    const bestTrade = Math.max(...pnls);
    const worstTrade = Math.min(...pnls);

    performances.push({
      patternName,
      totalTrades,
      wins,
      losses,
      winRate,
      avgPnl,
      totalPnl,
      avgConfidence,
      avgRR,
      bestTrade,
      worstTrade
    });
  });

  // Sort by total PNL descending
  return performances.sort((a, b) => b.totalPnl - a.totalPnl);
};

/**
 * Calibrate confidence scores (expected vs actual win rate)
 */
export const calibrateConfidence = (trades: EnhancedExecutedTrade[]): ConfidenceCalibration[] => {
  // Filter trades with confidence scores
  const tradesWithConfidence = trades.filter(t => t.aiConfidence !== undefined && t.outcome !== 'OPEN');

  if (tradesWithConfidence.length === 0) return [];

  // Group by confidence ranges
  const ranges = [
    { min: 0, max: 50, label: '0-50%' },
    { min: 50, max: 60, label: '50-60%' },
    { min: 60, max: 70, label: '60-70%' },
    { min: 70, max: 80, label: '70-80%' },
    { min: 80, max: 90, label: '80-90%' },
    { min: 90, max: 100, label: '90-100%' }
  ];

  const calibrations: ConfidenceCalibration[] = [];

  ranges.forEach(range => {
    const rangeTradesFiltered = tradesWithConfidence.filter(
      t => t.aiConfidence! >= range.min && t.aiConfidence! < range.max
    );

    if (rangeTradesFiltered.length === 0) return;

    const wins = rangeTradesFiltered.filter(t => t.outcome === 'WIN').length;
    const actualWinRate = (wins / rangeTradesFiltered.length) * 100;
    
    // Expected win rate is the average confidence in this range
    const avgConfidence = rangeTradesFiltered.reduce((sum, t) => sum + t.aiConfidence!, 0) / rangeTradesFiltered.length;
    const expectedWinRate = avgConfidence;

    const calibrationError = Math.abs(expectedWinRate - actualWinRate);

    calibrations.push({
      confidenceRange: range.label,
      totalTrades: rangeTradesFiltered.length,
      actualWinRate,
      expectedWinRate,
      calibrationError
    });
  });

  return calibrations;
};

/**
 * Analyze performance by time of day
 */
export const analyzeTimeBasedPerformance = (trades: EnhancedExecutedTrade[]): TimeBasedPerformance[] => {
  // Group by hour of entry
  const hourGroups = new Map<number, EnhancedExecutedTrade[]>();

  trades.forEach(trade => {
    // Parse hour from entryTime (format: "HH:MM:SS" or ISO string)
    let hour = 0;
    try {
      if (trade.entryTime.includes(':')) {
        hour = parseInt(trade.entryTime.split(':')[0]);
      } else {
        const date = new Date(trade.entryTime);
        hour = date.getHours();
      }
    } catch (e) {
      return; // Skip invalid times
    }

    if (!hourGroups.has(hour)) {
      hourGroups.set(hour, []);
    }
    hourGroups.get(hour)!.push(trade);
  });

  const performances: TimeBasedPerformance[] = [];

  hourGroups.forEach((hourTrades, hour) => {
    const completedTrades = hourTrades.filter(t => t.outcome !== 'OPEN');
    if (completedTrades.length === 0) return;

    const wins = completedTrades.filter(t => t.outcome === 'WIN').length;
    const winRate = (wins / completedTrades.length) * 100;
    
    const avgPnl = completedTrades.reduce((sum, t) => sum + t.pnl, 0) / completedTrades.length;

    performances.push({
      hour,
      totalTrades: completedTrades.length,
      winRate,
      avgPnl
    });
  });

  // Sort by hour
  return performances.sort((a, b) => a.hour - b.hour);
};

/**
 * Identify best market conditions for trading
 */
export const identifyBestMarketConditions = (trades: EnhancedExecutedTrade[]) => {
  const tradesWithContext = trades.filter(t => t.marketContext && t.outcome !== 'OPEN');

  if (tradesWithContext.length === 0) {
    return {
      bestTrend: 'SIDEWAYS' as const,
      bestVolatility: 'MEDIUM' as const,
      bestSentiment: 'NEUTRAL' as const
    };
  }

  // Analyze by trend
  const trendGroups = new Map<string, { wins: number; total: number; pnl: number }>();
  
  tradesWithContext.forEach(trade => {
    const trend = trade.marketContext!.structure.trend;
    if (!trendGroups.has(trend)) {
      trendGroups.set(trend, { wins: 0, total: 0, pnl: 0 });
    }
    const group = trendGroups.get(trend)!;
    group.total++;
    if (trade.outcome === 'WIN') group.wins++;
    group.pnl += trade.pnl;
  });

  let bestTrend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
  let bestTrendPnl = -Infinity;
  
  trendGroups.forEach((stats, trend) => {
    if (stats.pnl > bestTrendPnl) {
      bestTrendPnl = stats.pnl;
      bestTrend = trend as 'UP' | 'DOWN' | 'SIDEWAYS';
    }
  });

  // Analyze by volatility (using ATR as proxy)
  const volatilityGroups = new Map<string, { wins: number; total: number; pnl: number }>();
  
  tradesWithContext.forEach(trade => {
    const atr = trade.marketContext!.volatility.atr;
    let volCategory: string;
    
    // Categorize volatility (this is simplified, could be asset-specific)
    if (atr < 50) volCategory = 'LOW';
    else if (atr < 150) volCategory = 'MEDIUM';
    else volCategory = 'HIGH';

    if (!volatilityGroups.has(volCategory)) {
      volatilityGroups.set(volCategory, { wins: 0, total: 0, pnl: 0 });
    }
    const group = volatilityGroups.get(volCategory)!;
    group.total++;
    if (trade.outcome === 'WIN') group.wins++;
    group.pnl += trade.pnl;
  });

  let bestVolatility: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let bestVolPnl = -Infinity;
  
  volatilityGroups.forEach((stats, vol) => {
    if (stats.pnl > bestVolPnl) {
      bestVolPnl = stats.pnl;
      bestVolatility = vol as 'HIGH' | 'MEDIUM' | 'LOW';
    }
  });

  // Analyze by sentiment
  const sentimentGroups = new Map<string, { wins: number; total: number; pnl: number }>();
  
  tradesWithContext.forEach(trade => {
    const sentiment = trade.marketContext!.sentiment.dominantSentiment;
    if (!sentimentGroups.has(sentiment)) {
      sentimentGroups.set(sentiment, { wins: 0, total: 0, pnl: 0 });
    }
    const group = sentimentGroups.get(sentiment)!;
    group.total++;
    if (trade.outcome === 'WIN') group.wins++;
    group.pnl += trade.pnl;
  });

  let bestSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let bestSentPnl = -Infinity;
  
  sentimentGroups.forEach((stats, sent) => {
    if (stats.pnl > bestSentPnl) {
      bestSentPnl = stats.pnl;
      bestSentiment = sent as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    }
  });

  return {
    bestTrend,
    bestVolatility,
    bestSentiment
  };
};

/**
 * Main function: Calculate comprehensive trade analytics
 */
export const calculateTradeAnalytics = (trades: EnhancedExecutedTrade[]): TradeAnalytics => {
  const completedTrades = trades.filter(t => t.outcome !== 'OPEN');

  if (completedTrades.length === 0) {
    return {
      overview: {
        totalTrades: 0,
        totalWins: 0,
        totalLosses: 0,
        overallWinRate: 0,
        totalPnl: 0,
        avgPnl: 0,
        profitFactor: 0
      },
      byPattern: [],
      byConfidence: [],
      byTimeOfDay: [],
      marketConditions: {
        bestTrend: 'SIDEWAYS',
        bestVolatility: 'MEDIUM',
        bestSentiment: 'NEUTRAL'
      }
    };
  }

  // Overview metrics
  const totalWins = completedTrades.filter(t => t.outcome === 'WIN').length;
  const totalLosses = completedTrades.filter(t => t.outcome === 'LOSS').length;
  const overallWinRate = (totalWins / completedTrades.length) * 100;
  
  const totalPnl = completedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const avgPnl = totalPnl / completedTrades.length;
  
  const grossProfit = completedTrades
    .filter(t => t.pnl > 0)
    .reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(
    completedTrades
      .filter(t => t.pnl < 0)
      .reduce((sum, t) => sum + t.pnl, 0)
  );
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Pattern analysis
  const byPattern = analyzePatternPerformance(completedTrades);

  // Confidence calibration
  const byConfidence = calibrateConfidence(completedTrades);

  // Time-based analysis
  const byTimeOfDay = analyzeTimeBasedPerformance(completedTrades);

  // Market conditions
  const marketConditions = identifyBestMarketConditions(completedTrades);

  return {
    overview: {
      totalTrades: completedTrades.length,
      totalWins,
      totalLosses,
      overallWinRate,
      totalPnl,
      avgPnl,
      profitFactor
    },
    byPattern,
    byConfidence,
    byTimeOfDay,
    marketConditions
  };
};

export const tradeAnalyticsService = {
  calculateTradeAnalytics,
  analyzePatternPerformance,
  calibrateConfidence,
  analyzeTimeBasedPerformance,
  identifyBestMarketConditions
};
