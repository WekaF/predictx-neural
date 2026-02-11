
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
}

export interface TrainingData {
  id: string;
  pattern: string;
  confluence: string; // Context: e.g. "Uptrend + SMA200 bounce"
  outcome: 'WIN' | 'LOSS';
  riskReward: number;
  note: string;
  // New fields for deep learning training replay
  input?: {
      candles: Candle[];
      indicators: TechnicalIndicators;
      sentiment: number;
  };
  output?: {
      type: 'BUY' | 'SELL';
      outcome: 'WIN' | 'LOSS';
      pnl: number;
  };
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
    symbol: string;
    type: 'BUY' | 'SELL';
    
    // --- Detailed Analysis Fields ---
    agent: string;          // e.g. "Hybrid CNN-LSTM", "RL-DQN", "Manual"
    exitPrice?: number;
    exitTimestamp?: number;
    pnl?: number;
    outcome?: 'WIN' | 'LOSS';
    exitReason?: string;    // e.g. "Take Profit", "Stop Loss", "Manual"
    
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

// --- SMC Types ---
export interface OrderBlock {
    id: string;
    type: 'BULLISH' | 'BEARISH';
    top: number;
    bottom: number;
    candleIndex: number;
    timestamp: number; // Added for mapping
    mitigated: boolean;
    strength: number;
}

export interface FairValueGap {
    id: string;
    type: 'BULLISH' | 'BEARISH';
    top: number;
    bottom: number;
    candleIndex: number;
    timestamp: number; // Added for mapping
    mitigated: boolean;
}

export interface SwingPoint {
    type: 'HIGH' | 'LOW';
    price: number;
    index: number;
}

export interface SMCAnalysis {
    structure: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    lastBOS?: { price: number; index: number; type: 'BULLISH'|'BEARISH' };
    lastCHoCH?: { price: number; index: number; type: 'BULLISH'|'BEARISH' };
    orderBlocks: OrderBlock[];
    fairValueGaps: FairValueGap[];
    swingHighs: SwingPoint[];
    swingLows: SwingPoint[];
}
