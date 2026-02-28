// Enhanced ExecutedTrade type with market context for AI training

export interface MarketContext {
  // Technical Indicators Snapshot
  indicators: {
    rsi: number;
    macd: { value: number; signal: number; histogram: number };
    stochastic: { k: number; d: number };
    sma20: number;
    sma50: number;
    sma200: number;
    ema12: number;
    ema26: number;
    momentum: number;
  };
  
  // Volatility Metrics
  volatility: {
    atr: number; // Average True Range
    bollingerBandWidth: number;
    historicalVolatility: number; // Standard deviation of returns
  };
  
  // Market Sentiment
  sentiment: {
    score: number; // -1 to 1
    newsCount: number;
    dominantSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  
  // Market Structure
  structure: {
    trend: 'UP' | 'DOWN' | 'SIDEWAYS';
    nearestSupport: number;
    nearestResistance: number;
    fibLevel?: number; // Which fib level price is near
  };
  
  // Volume Analysis
  volume: {
    current: number;
    average: number;
    volumeRatio: number; // current / average
  };
  
  // Price Action
  priceAction: {
    currentPrice: number;
    priceChange24h: number; // %
    highLow24h: { high: number; low: number };
  };
}

export interface EnhancedExecutedTrade {
  // Original ExecutedTrade fields
  id: string;
  symbol: string;
  entryTime: string;
  exitTime: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  pnl: number;
  outcome: 'WIN' | 'LOSS' | 'OPEN' | 'PENDING' | 'EXPIRED' | 'MANUAL_CLOSE';
  source: 'AI' | 'MANUAL' | 'BINANCE_IMPORT';
  tradingMode?: 'paper' | 'live';
  
  // Enhanced fields for AI training
  marketContext: MarketContext;
  
  // Pattern & Confluence
  patternDetected?: string;
  confluenceFactors?: string[];
  
  // AI Metadata
  aiConfidence?: number; // 0-100
  aiReasoning?: string;
  
  // Trade Metrics
  holdDuration?: number; // in minutes
  riskRewardRatio?: number;
  actualRR?: number; // Actual R:R achieved
  
  // Performance Tags
  tags?: string[]; // e.g., ['scalp', 'breakout', 'reversal']
}

export interface PatternPerformance {
  patternName: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  avgConfidence: number;
  avgRR: number;
  bestTrade: number;
  worstTrade: number;
}

export interface ConfidenceCalibration {
  confidenceRange: string; // e.g., "80-90%"
  totalTrades: number;
  actualWinRate: number;
  expectedWinRate: number; // Based on confidence
  calibrationError: number; // Difference between expected and actual
}

export interface TimeBasedPerformance {
  hour: number;
  totalTrades: number;
  winRate: number;
  avgPnl: number;
}

export interface TradeAnalytics {
  overview: {
    totalTrades: number;
    totalWins: number;
    totalLosses: number;
    overallWinRate: number;
    totalPnl: number;
    avgPnl: number;
    profitFactor: number;
  };
  
  byPattern: PatternPerformance[];
  byConfidence: ConfidenceCalibration[];
  byTimeOfDay: TimeBasedPerformance[];
  
  marketConditions: {
    bestTrend: 'UP' | 'DOWN' | 'SIDEWAYS';
    bestVolatility: 'HIGH' | 'MEDIUM' | 'LOW';
    bestSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  bySymbol?: PatternPerformance[]; // Reuse PatternPerformance for symbol stats
}
