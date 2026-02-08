/**
 * Real-Time Training Data Sync Service
 * Fetches trade signals from Supabase and converts them for leverage training
 */

import { supabase } from './supabaseClient';
import { LeverageTrade } from './leverageTradeService';

/**
 * Fetch real-time trade signals from Supabase for training
 * These are actual trades made in the app that AI can learn from
 */
export const fetchRealTimeTradeSignals = async (limit: number = 100): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('trade_signals')
            .select('*')
            .in('outcome', ['WIN', 'LOSS']) // Only completed trades
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        
        console.log(`[Real-Time Sync] ✅ Fetched ${data?.length || 0} trade signals from app`);
        return data || [];
    } catch (error: any) {
        console.error('[Real-Time Sync] ❌ Fetch failed:', error);
        return [];
    }
};

/**
 * Convert trade signals to leverage trade format for training
 */
export const convertSignalsToLeverageTrades = (signals: any[]): LeverageTrade[] => {
    return signals.map(signal => {
        const isWin = signal.outcome === 'WIN';
        const orderType = signal.type === 'BUY' ? 'LONG' : 'SHORT';
        
        // Calculate PNL based on entry/exit prices with 10x leverage
        let pnlPercent = 0;
        if (signal.exit_price && signal.entry_price) {
            if (orderType === 'LONG') {
                pnlPercent = ((signal.exit_price - signal.entry_price) / signal.entry_price) * 10 * 100;
            } else {
                pnlPercent = ((signal.entry_price - signal.exit_price) / signal.entry_price) * 10 * 100;
            }
        }
        
        return {
            id: signal.id,
            trade_date: signal.created_at.split('T')[0],
            trade_time: signal.created_at.split('T')[1]?.split('.')[0],
            order_type: orderType,
            open_price: signal.entry_price,
            close_price: signal.exit_price || signal.entry_price,
            target_price: signal.take_profit || signal.entry_price,
            stop_loss_price: signal.stop_loss,
            result_percent: pnlPercent,
            status: 'FILLED',
            balance: 100, // Default base
            leverage_multiplier: 10,
            pnl_percent: pnlPercent,
            pnl_amount: (pnlPercent / 100) * 100,
            ai_confidence: signal.confidence,
            ai_reasoning: signal.reasoning,
            notes: `Real-time trade from app. Source: ${signal.source || 'AI'}. Symbol: ${signal.symbol}`,
            source: 'AI_PREDICTED' as const
        };
    });
};

/**
 * Sync all real-time training data from Supabase
 * Combines trade signals and historical data for comprehensive learning
 */
export const syncRealTimeTrainingData = async (): Promise<{
    tradeSignals: any[];
    leverageTrades: LeverageTrade[];
    totalCount: number;
}> => {
    try {
        // Fetch real-time signals
        const signals = await fetchRealTimeTradeSignals(100);
        
        // Convert signals to leverage trades format
        const leverageTrades = convertSignalsToLeverageTrades(signals);
        
        console.log(`[Real-Time Sync] ✅ Synced ${signals.length} real-time trades for training`);
        
        return {
            tradeSignals: signals,
            leverageTrades,
            totalCount: signals.length
        };
    } catch (error: any) {
        console.error('[Real-Time Sync] ❌ Sync failed:', error);
        return {
            tradeSignals: [],
            leverageTrades: [],
            totalCount: 0
        };
    }
};

/**
 * Get training statistics from real-time data
 */
export const getRealTimeTrainingStats = async (): Promise<{
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
    avgConfidence: number;
}> => {
    try {
        const signals = await fetchRealTimeTradeSignals(1000);
        
        const wins = signals.filter(s => s.outcome === 'WIN').length;
        const losses = signals.filter(s => s.outcome === 'LOSS').length;
        const totalTrades = wins + losses;
        
        const pnls = signals
            .filter(s => s.pnl !== null && s.pnl !== undefined)
            .map(s => s.pnl);
        
        const confidences = signals
            .filter(s => s.confidence !== null && s.confidence !== undefined)
            .map(s => s.confidence);
        
        return {
            totalTrades,
            wins,
            losses,
            winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
            avgPnl: pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0,
            totalPnl: pnls.reduce((a, b) => a + b, 0),
            avgConfidence: confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0
        };
    } catch (error: any) {
        console.error('[Real-Time Sync] ❌ Stats fetch failed:', error);
        return {
            totalTrades: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            avgPnl: 0,
            totalPnl: 0,
            avgConfidence: 0
        };
    }
};

export default {
    fetchRealTimeTradeSignals,
    convertSignalsToLeverageTrades,
    syncRealTimeTrainingData,
    getRealTimeTrainingStats
};
