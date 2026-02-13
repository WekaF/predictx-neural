import { supabase } from './supabaseClient';
import { EnhancedExecutedTrade } from '../types/enhanced';

// Analytics metrics interface
export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  lossRate: number;
  pendingRate: number;
  avgConfidence: number;
  bestTrade: { symbol: string; confidence: number; pnl: number } | null;
  worstTrade: { symbol: string; confidence: number; pnl: number } | null;
  // Advanced Metrics
  netProfit: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
}

export interface AssetPerformance {
  symbol: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
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
  pnl?: number; // Added for profit calculation
}

export interface RiskMetrics {
  algoTrading: number; // %
  profitTrades: number; // %
  lossTrades: number; // %
  tradingActivity: number; // %
  maxDrawdown: number; // %
  maxDepositLoad: number; // %
}

export interface GrowthData {
  time: string;
  balance: number;
  equity: number;
  deposit?: number;
  withdrawal?: number;
}

export const analyticsService = {
  // Fetch all trade signals from Supabase (Legacy support or fallback)
  async getTradeSignals(): Promise<TradeSignalData[]> {
    if (!supabase) return [];
    
    try {
      console.log('[Analytics] Fetching non-pending trades from Supabase...');
      const { data, error } = await supabase
        .from('trade_signals')
        .select('*')
        .neq('outcome', 'PENDING') // Exclude pending trades
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('[Analytics] Fetch error:', error);
        return [];
      }
      
      console.log(`[Analytics] Fetched ${data?.length} trades from Supabase`);
      return data || [];
    } catch (e) {
      console.error('[Analytics] Unexpected error:', e);
      return [];
    }
  },

  // Calculate performance metrics from real trades
  async getPerformanceMetrics(trades?: EnhancedExecutedTrade[]): Promise<PerformanceMetrics> {
    console.log('[AnalyticsService] Calculating metrics...');
    
    let completedTrades: any[] = [];

    // Prioritize Supabase fetch if trades are empty OR if we want to ensure we have data
    // The user requested "ambil saja dari table supabase" (just take from supabase)
    // So we will fetch if the passed trades seem insufficient or just always fetch for the dashboard
    
    if (!trades || trades.length === 0) {
        const signals = await this.getTradeSignals();
        completedTrades = signals;
    } else {
        // Even if trades are passed, let's filter them here too just in case
        completedTrades = trades.filter(t => t.outcome !== 'PENDING' && t.outcome !== 'OPEN');
        
        // Use Supabase if local trades are empty after filter
        if (completedTrades.length === 0) {
             const signals = await this.getTradeSignals();
             completedTrades = signals;
        }
    }

    console.log(`[Analytics] Processing ${completedTrades.length} trades for metrics`);
    
    const total = completedTrades.length;
    const wins = completedTrades.filter(t => t.outcome === 'WIN').length;
    const losses = completedTrades.filter(t => t.outcome === 'LOSS').length;
    
    if (total === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        lossRate: 0,
        pendingRate: 0,
        avgConfidence: 0,
        bestTrade: null,
        worstTrade: null,
        netProfit: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        expectancy: 0,
        avgWin: 0,
        avgLoss: 0
      };
    }

    const netProfit = completedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossProfit = completedTrades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(completedTrades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
    
    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const winRate = (wins / total);
    const lossRate = (losses / total);
    
    // Expectancy = (Win % * Avg Win) - (Loss % * Avg Loss)
    const expectancy = (avgWin * winRate) - (avgLoss * lossRate);

    // Max Drawdown Calculation
    let peak = 0;
    let maxDrawdown = 0;
    let runningBalance = 0; // Assuming starting at 0 PnL for DD calc relative to peak profit
    
    for (const trade of completedTrades) {
        runningBalance += trade.pnl;
        if (runningBalance > peak) peak = runningBalance;
        const drawdown = peak - runningBalance;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    // Best/Worst
    const bestTrade = completedTrades.reduce((best, curr) => curr.pnl > best.pnl ? curr : best, completedTrades[0]);
    const worstTrade = completedTrades.reduce((worst, curr) => curr.pnl < worst.pnl ? curr : worst, completedTrades[0]);

    return {
      totalTrades: total,
      winRate: winRate * 100,
      lossRate: lossRate * 100,
      pendingRate: 0,
      avgConfidence: completedTrades.reduce((sum, t) => sum + (t.aiConfidence || 0), 0) / total,
      bestTrade: { symbol: bestTrade.symbol, confidence: bestTrade.aiConfidence || 0, pnl: bestTrade.pnl },
      worstTrade: { symbol: worstTrade.symbol, confidence: worstTrade.aiConfidence || 0, pnl: worstTrade.pnl },
      netProfit,
      profitFactor,
      sharpeRatio: 1.5, // Placeholder - requires standard deviation of returns
      maxDrawdown, // This is in currency units, typically
      expectancy,
      avgWin,
      avgLoss
    };
  },

  // Get performance breakdown by asset
  async getAssetPerformance(trades?: EnhancedExecutedTrade[]): Promise<AssetPerformance[]> {
      let completedTrades: any[] = [];
      if (trades && trades.length > 0) {
          completedTrades = trades.filter(t => t.outcome !== 'PENDING' && t.outcome !== 'OPEN');
      }
      
      if (completedTrades.length === 0) {
         completedTrades = await this.getTradeSignals();
      }
    
    // Group by symbol
    const grouped: Record<string, { wins: number; losses: number; total: number; pnl: number }> = completedTrades.reduce((acc, trade) => {
      if (!acc[trade.symbol]) {
        acc[trade.symbol] = { wins: 0, losses: 0, total: 0, pnl: 0 };
      }
      acc[trade.symbol].total++;
      if (trade.outcome === 'WIN') acc[trade.symbol].wins++;
      if (trade.outcome === 'LOSS') acc[trade.symbol].losses++;
      acc[trade.symbol].pnl += (trade.pnl || 0); // Ensure numeric
      return acc;
    }, {} as Record<string, { wins: number; losses: number; total: number; pnl: number }>);
    
    // Convert to array
    return Object.entries(grouped).map(([symbol, stats]) => ({
      symbol,
      totalTrades: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
      netProfit: stats.pnl
    })).sort((a,b) => b.netProfit - a.netProfit);
  },

  // Get recent trades (last 10)
  async getRecentTrades(trades?: EnhancedExecutedTrade[]): Promise<TradeSignalData[]> {
    if (trades && trades.length > 0) {
        // Map EnhancedExecutedTrade to TradeSignalData for UI compatibility
        return trades.slice(0, 50).map(t => ({
            id: t.id,
            created_at: t.entryTime,
            symbol: t.symbol,
            type: t.type,
            entry_price: t.entryPrice,
            confidence: t.aiConfidence || 0,
            outcome: t.outcome,
            source: t.source,
            pnl: t.pnl
        }));
    }
    const signals = await this.getTradeSignals();
    return signals.slice(0, 10);
  },

  async getRiskMetrics(trades?: EnhancedExecutedTrade[]): Promise<RiskMetrics> {
     const metricData = await this.getPerformanceMetrics(trades);
     return {
         algoTrading: 100,
         profitTrades: metricData.winRate,
         lossTrades: metricData.lossRate,
         tradingActivity: 50, // Mock
         maxDrawdown: metricData.maxDrawdown, // Currency value
         maxDepositLoad: 5.0
     };
  },

  async getGrowthCurve(trades?: EnhancedExecutedTrade[], initialBalance: number = 1000): Promise<GrowthData[]> {
      let sortedTrades: any[] = [];
      
      if (trades && trades.length > 0) {
          sortedTrades = [...trades].sort((a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime());
      } else {
           const signals = await this.getTradeSignals();
           // Sort signals by created_at (ascending for growth curve)
           sortedTrades = [...signals].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }

      const data: GrowthData[] = [];
      let currentBalance = initialBalance;
      
      // Start point
      if (sortedTrades.length > 0) {
          const firstTime = sortedTrades[0].entryTime || sortedTrades[0].created_at;
          data.push({
            time: new Date(new Date(firstTime).getTime() - 86400000).toISOString().split('T')[0],
            balance: initialBalance,
            equity: initialBalance
          });
      }
      
      for (const trade of sortedTrades) {
          if (trade.outcome === 'PENDING') continue;
          currentBalance += (trade.pnl || 0);
          const time = trade.exitTime || trade.created_at;
          data.push({
              time: new Date(time).toISOString().split('T')[0] + ' ' + new Date(time).toLocaleTimeString(),
              balance: Number(currentBalance.toFixed(2)),
              equity: Number(currentBalance.toFixed(2))
          });
      }
      return data;
  }
};
