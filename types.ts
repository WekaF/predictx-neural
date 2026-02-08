
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
  outcome?: 'WIN' | 'LOSS' | 'PENDING';
  newsSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface TechnicalIndicators {
  rsi: number;
  sma50: number;
  sma200: number;
  ema20: number;
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
}

export interface TrainingData {
  id: string;
  pattern: string;
  confluence: string; // Context: e.g. "Uptrend + SMA200 bounce"
  outcome: 'WIN' | 'LOSS';
  riskReward: number;
  note: string;
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
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  profitFactor: number;
  maxDrawdown: number;
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
