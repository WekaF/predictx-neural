import { MarketContext } from './types/enhanced';

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  time: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface TradeSignal {
  id: string;
  symbol: string; // Added: e.g. "BTC/USD"
  type: 'BUY' | 'SELL' | 'HOLD';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
  confidence: number; // 0-100
  timestamp: number;
  patternDetected?: string;
  confluenceFactors?: string[]; // e.g. ["SMA200 Support", "RSI Divergence"]
  riskRewardRatio?: number;
  outcome?: 'WIN' | 'LOSS' | 'PENDING' | 'EXPIRED' | 'MANUAL_CLOSE';
  outputToken?: string;
  newsSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  execution?: {
    status: string;
    side: string;
    leverage: number;
    margin?: number;
    size?: number;
    tp: number;
    sl: number;
    unrealizedProfit?: number;
    unrealizedProfitPercent?: number;
    execution_status: string;
    mode?: 'paper' | 'live';
    orderId?: number | {
      entry?: number;
      oco?: number;
      stopLoss?: number;
      takeProfit?: number;
    };
  };
  marketContext?: MarketContext;
  quantity?: number; // Added for real execution tracking
  meta?: any; // Added for SMC/Backend metadata
}

export interface TechnicalIndicators {
  rsi: number;
  sma50: number;
  sma200: number;
  sma20: number;
  ema20: number;
  ema12: number;
  ema26: number;
  volumeSma: number;
  fibLevels: {
    level0: number;
    level236: number;
    level382: number;
    level500: number;
    level618: number;
    level100: number;
  };
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  nearestSupport: number;
  nearestResistance: number;
  macd: {
      value: number;
      signal: number;
      histogram: number;
  };
  stochastic: {
      k: number;
      d: number;
  };
  momentum: number;
  rsiDivergence?: {
    type: 'BULLISH' | 'BEARISH';
    strength: number;
    pricePoints: { index: number; value: number }[];
    rsiPoints: { index: number; value: number }[];
    detectedAt: number;
  } | null;
}

export interface TrainingData {
  id: string;
  pattern: string;
  confluence: string; // Context: e.g. "Uptrend + SMA200 bounce"
  outcome: 'WIN' | 'LOSS';
  riskReward: number;
  note: string;
  pnl?: number; // Added to enable filtering out negative Realized PnL
}

export interface BacktestTrade {
  id: string;
  symbol?: string;
  entryTime: string;
  exitTime?: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  pnl: number;
  outcome: 'WIN' | 'LOSS' | 'OPEN';
}

export interface ExecutedTrade extends BacktestTrade {
  source: 'AI' | 'MANUAL';
}

export interface BacktestStats {
  // Returns
  netProfit: number;
  agentReturn: number; // % Return on initial balance
  avgMonthlyProfit: number; // Estimated
  buyHoldReturn: number;
  sellHoldReturn?: number; // Optional if only doing long/short analysis

  // Risk
  maxDrawdown: number; // %
  sharpeRatio: number;
  calmarRatio: number;

  // Trade Statistics
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number; // %
  profitFactor: number;
  expectancy: number; // Average R per trade
  riskRewardRatio: number; // Average realize R:R
  avgWin: number;
  avgLoss: number;
  timeInMarket: number; // % of time with open positions

  // Counts
  longCount: number;
  shortCount: number;
}

export interface BacktestConfig {
  id: string;
  name: string;
  initialBalance: number;
  riskPercent: number;
  interval: number;
  selectedModel: string;
  useMockAI: boolean;
}

export interface Alert {
  id: string;
  type: 'PRICE' | 'RSI';
  condition: 'ABOVE' | 'BELOW';
  value: number;
  active: boolean;
  message: string;
}

export interface AppSettings {
  webhookUrl: string;
  webhookMethod: 'POST' | 'GET';
  enableNotifications: boolean;
  useTestnet: boolean;
}

export interface Asset {
    symbol: string;
    name: string;
    type: 'CRYPTO' | 'FOREX';
    price: number; // Starting price for mock data
}

export interface ActivityLog {
  id: string;
  event_type: string;
  details: string;
  metadata?: any;
  created_at: string;
}

export interface MarketSnapshot {
    price: number;
    rsi: number;
    trend: 'UP' | 'DOWN' | 'SIDEWAYS';
    newsSentiment: number;
    condition: string; // e.g. "Overbought", "Oversold"
}

export interface TradingLog {
    id: string;
    tradeId: string;
    timestamp: number; // Entry Time
    entryTime?: string; // ISO timestamp for display
    exitTime?: string; // ISO timestamp for display
    symbol: string;
    type: 'BUY' | 'SELL';
    entryPrice?: number;
    exitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    quantity?: number;
    pnl?: number;
    outcome?: 'WIN' | 'LOSS' | 'PENDING' | 'EXPIRED' | 'MANUAL_CLOSE';
    source?: 'AI' | 'MANUAL';
    items: {
        snapshot: MarketSnapshot;
        chartHistory: Candle[]; // Stored candles for visualization
        aiReasoning: string;
        aiConfidence: number;
        aiPrediction?: string; // e.g. "Price likely to bounce off SMA200"
    };
    notes?: string;
    tags?: string[]; // e.g. ["Scalp", "News", "Reversal"]
}
