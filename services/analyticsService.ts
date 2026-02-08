import { supabase } from './supabaseClient';

// Analytics metrics interface
export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  lossRate: number;
  pendingRate: number;
  avgConfidence: number;
  bestTrade: { symbol: string; confidence: number } | null;
  worstTrade: { symbol: string; confidence: number } | null;
}

export interface AssetPerformance {
  symbol: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface TradeSignalData {
  id: string;
  created_at: string;
  symbol: string;
  type: string;
  entry_price: number;
  confidence: number;
  outcome: string;
  source: string;
}

export const analyticsService = {
  // Fetch all trade signals from Supabase
  async getTradeSignals(): Promise<TradeSignalData[]> {
    if (!supabase) return [];
    
    try {
      const { data, error } = await supabase
        .from('trade_signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('[Analytics] Fetch error:', error);
        return [];
      }
      
      return data || [];
    } catch (e) {
      console.error('[Analytics] Unexpected error:', e);
      return [];
    }
  },

  // Calculate performance metrics
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const signals = await this.getTradeSignals();
    
    if (signals.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        lossRate: 0,
        pendingRate: 0,
        avgConfidence: 0,
        bestTrade: null,
        worstTrade: null
      };
    }
    
    const wins = signals.filter(s => s.outcome === 'WIN').length;
    const losses = signals.filter(s => s.outcome === 'LOSS').length;
    const pending = signals.filter(s => s.outcome === 'PENDING').length;
    const total = signals.length;
    
    const avgConfidence = signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / total;
    
    // Find best and worst trades (by confidence)
    const completedTrades = signals.filter(s => s.outcome === 'WIN' || s.outcome === 'LOSS');
    const bestTrade = completedTrades.length > 0 
      ? completedTrades.reduce((best, curr) => curr.confidence > best.confidence ? curr : best)
      : null;
    const worstTrade = completedTrades.length > 0
      ? completedTrades.reduce((worst, curr) => curr.confidence < worst.confidence ? curr : worst)
      : null;
    
    return {
      totalTrades: total,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      lossRate: total > 0 ? (losses / total) * 100 : 0,
      pendingRate: total > 0 ? (pending / total) * 100 : 0,
      avgConfidence: avgConfidence,
      bestTrade: bestTrade ? { symbol: bestTrade.symbol, confidence: bestTrade.confidence } : null,
      worstTrade: worstTrade ? { symbol: worstTrade.symbol, confidence: worstTrade.confidence } : null
    };
  },

  // Get performance breakdown by asset
  async getAssetPerformance(): Promise<AssetPerformance[]> {
    const signals = await this.getTradeSignals();
    
    // Group by symbol
    const grouped: Record<string, { wins: number; losses: number; total: number }> = signals.reduce((acc, signal) => {
      if (!acc[signal.symbol]) {
        acc[signal.symbol] = { wins: 0, losses: 0, total: 0 };
      }
      acc[signal.symbol].total++;
      if (signal.outcome === 'WIN') acc[signal.symbol].wins++;
      if (signal.outcome === 'LOSS') acc[signal.symbol].losses++;
      return acc;
    }, {} as Record<string, { wins: number; losses: number; total: number }>);
    
    // Convert to array
    return Object.entries(grouped).map(([symbol, stats]) => ({
      symbol,
      totalTrades: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0
    }));
  },

  // Get confidence accuracy (how well confidence predicts outcome)
  async getConfidenceAccuracy(): Promise<{ confidence: number; wasCorrect: boolean }[]> {
    const signals = await this.getTradeSignals();
    
    return signals
      .filter(s => s.outcome === 'WIN' || s.outcome === 'LOSS')
      .map(s => ({
        confidence: s.confidence || 0,
        wasCorrect: s.outcome === 'WIN'
      }));
  },

  // Get recent trades (last 10)
  async getRecentTrades(): Promise<TradeSignalData[]> {
    const signals = await this.getTradeSignals();
    return signals.slice(0, 10);
  }
};
