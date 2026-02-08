/**
 * Leverage Trade Service
 * Handles 10x leverage trading data import, calculations, and Supabase sync
 */

import { supabase } from './supabaseClient';

export interface LeverageTrade {
    id?: string;
    trade_date: string;
    trade_time?: string;
    order_type: 'SHORT' | 'LONG';
    open_price: number;
    target_price: number;
    close_price?: number;
    result_percent: number;
    status: 'FILLED' | 'NOT FILLED' | 'PENDING';
    balance: number;
    
    // Leverage calculations (auto-calculated by DB trigger)
    leverage_multiplier?: number;
    position_size?: number;
    pnl_amount?: number;
    pnl_percent?: number;
    
    // AI fields
    predicted_by_ai?: boolean;
    ai_confidence?: number;
    ai_reasoning?: string;
    ai_pattern?: string;
    
    // Risk management
    stop_loss_price?: number;
    take_profit_price?: number;
    risk_reward_ratio?: number;
    
    notes?: string;
    source?: 'HISTORICAL' | 'AI_PREDICTED' | 'MANUAL';
}

export interface TrainingSession {
    id?: string;
    started_at?: string;
    completed_at?: string;
    total_trades_used: number;
    epochs: number;
    learning_rate: number;
    epsilon: number;
    initial_accuracy?: number;
    final_accuracy?: number;
    win_rate?: number;
    avg_pnl?: number;
    total_iterations?: number;
    patterns_discovered?: number;
    avg_confidence?: number;
    status?: 'RUNNING' | 'COMPLETED' | 'FAILED';
    error_message?: string;
}

export interface LeveragePattern {
    id?: string;
    pattern_name: string;
    pattern_signature: string;
    win_count: number;
    loss_count: number;
    win_rate: number;
    avg_pnl: number;
    total_pnl: number;
    confidence_score: number;
    reliability_score: number;
    order_type_preference?: 'SHORT' | 'LONG' | 'NEUTRAL';
    market_conditions?: any;
    last_seen?: string;
    times_traded?: number;
}

// Historical data from user (40 trades)
const HISTORICAL_DATA: Omit<LeverageTrade, 'id'>[] = [
    { trade_date: '2025-11-15', trade_time: '12:50:59', order_type: 'SHORT', open_price: 96454.05, target_price: 91989.94, close_price: 95596.24, result_percent: 8.89, status: 'FILLED', balance: 32.67, source: 'HISTORICAL' },
    { trade_date: '2025-11-16', trade_time: '12:51:25', order_type: 'SHORT', open_price: 97500, target_price: 94900, result_percent: 0, status: 'NOT FILLED', balance: 32.67, source: 'HISTORICAL' },
    { trade_date: '2025-11-17', trade_time: '12:51:48', order_type: 'SHORT', open_price: 95810.08, target_price: 91689.89, close_price: 91689.89, result_percent: 43.00, status: 'FILLED', balance: 46.72, source: 'HISTORICAL' },
    { trade_date: '2025-11-18', trade_time: '12:40:37', order_type: 'SHORT', open_price: 92400, target_price: 89500, close_price: 89500, result_percent: 31.39, status: 'FILLED', balance: 56.39, source: 'HISTORICAL' },
    { trade_date: '2025-11-19', trade_time: '07:03:23', order_type: 'SHORT', open_price: 95232.59, target_price: 90689.07, result_percent: 0, status: 'NOT FILLED', balance: 56.39, source: 'HISTORICAL' },
    { trade_date: '2025-11-20', trade_time: '07:11:47', order_type: 'SHORT', open_price: 91904.96, target_price: 88754.96, close_price: 88754.96, result_percent: 34.27, status: 'FILLED', balance: 75.72, source: 'HISTORICAL' },
    { trade_date: '2025-11-21', trade_time: '08:14:56', order_type: 'SHORT', open_price: 87535.09, target_price: 86204.04, result_percent: 0, status: 'NOT FILLED', balance: 75.72, source: 'HISTORICAL' },
    { trade_date: '2025-11-22', trade_time: '07:02:26', order_type: 'SHORT', open_price: 85350, target_price: 82700, close_price: 84739.74, result_percent: 7.15, status: 'FILLED', balance: 81.13, source: 'HISTORICAL' },
    { trade_date: '2025-11-23', trade_time: '07:02:42', order_type: 'SHORT', open_price: 86107.24, target_price: 83372.26, close_price: 86830, result_percent: -8.39, status: 'FILLED', balance: 74.32, source: 'HISTORICAL' },
    { trade_date: '2025-11-24', trade_time: '07:02:16', order_type: 'SHORT', open_price: 87200, target_price: 84500, close_price: 88300.01, result_percent: -12.61, status: 'FILLED', balance: 64.94, source: 'HISTORICAL' },
    { trade_date: '2025-11-25', trade_time: '07:02:20', order_type: 'SHORT', open_price: 88300.01, target_price: 88150, close_price: 88150, result_percent: 1.70, status: 'FILLED', balance: 66.04, source: 'HISTORICAL' },
    { trade_date: '2025-11-26', trade_time: '07:03:47', order_type: 'SHORT', open_price: 89723.44, target_price: 84230.2, close_price: 90484.02, result_percent: -8.48, status: 'FILLED', balance: 60.44, source: 'HISTORICAL' },
    { trade_date: '2025-11-27', trade_time: '07:02:57', order_type: 'LONG', open_price: 89667.23, target_price: 91709.19, result_percent: 0, status: 'NOT FILLED', balance: 60.44, source: 'HISTORICAL' },
    { trade_date: '2025-11-28', trade_time: '07:02:34', order_type: 'LONG', open_price: 90600, target_price: 91980, result_percent: 0, status: 'NOT FILLED', balance: 60.44, source: 'HISTORICAL' },
    { trade_date: '2025-11-29', trade_time: '07:00:59', order_type: 'SHORT', open_price: 90942.77, target_price: 90872.2, close_price: 90872.2, result_percent: 0.78, status: 'FILLED', balance: 60.91, source: 'HISTORICAL' },
    { trade_date: '2025-11-30', trade_time: '07:00:51', order_type: 'LONG', open_price: 90200, target_price: 91250, result_percent: 0, status: 'NOT FILLED', balance: 60.91, source: 'HISTORICAL' },
    { trade_date: '2025-12-01', trade_time: '07:01:07', order_type: 'SHORT', open_price: 91900, target_price: 89800, result_percent: 0, status: 'NOT FILLED', balance: 60.91, source: 'HISTORICAL' },
    { trade_date: '2025-12-02', trade_time: '07:01:21', order_type: 'SHORT', open_price: 87700, target_price: 84800, close_price: 91277.88, result_percent: -40.80, status: 'FILLED', balance: 36.06, source: 'HISTORICAL' },
    { trade_date: '2025-12-03', trade_time: '07:01:17', order_type: 'LONG', open_price: 91200, target_price: 92150, result_percent: 0, status: 'NOT FILLED', balance: 36.06, source: 'HISTORICAL' },
    { trade_date: '2025-12-04', trade_time: '07:03:12', order_type: 'LONG', open_price: 91280, target_price: 95580, result_percent: 0, status: 'NOT FILLED', balance: 36.06, source: 'HISTORICAL' },
    { trade_date: '2025-12-05', trade_time: '07:01:32', order_type: 'SHORT', open_price: 93878.56, target_price: 89562.8, result_percent: 0, status: 'NOT FILLED', balance: 36.06, source: 'HISTORICAL' },
    { trade_date: '2025-12-06', trade_time: '07:01:36', order_type: 'SHORT', open_price: 89700, target_price: 88500, close_price: 89236.79, result_percent: 5.16, status: 'FILLED', balance: 37.92, source: 'HISTORICAL' },
    { trade_date: '2025-12-07', trade_time: '07:01:37', order_type: 'SHORT', open_price: 90080, target_price: 87970, close_price: 87970, result_percent: 23.42, status: 'FILLED', balance: 46.8, source: 'HISTORICAL' },
    { trade_date: '2025-12-08', trade_time: '07:01:26', order_type: 'LONG', open_price: 87860, target_price: 91480, result_percent: 0, status: 'NOT FILLED', balance: 46.8, source: 'HISTORICAL' },
    { trade_date: '2025-12-09', trade_time: '07:02:31', order_type: 'LONG', open_price: 87438.4, target_price: 92239.38, result_percent: 0, status: 'NOT FILLED', balance: 46.8, source: 'HISTORICAL' },
    { trade_date: '2025-12-10', trade_time: '07:02:12', order_type: 'LONG', open_price: 90587.95, target_price: 94765.33, result_percent: 0, status: 'NOT FILLED', balance: 46.8, source: 'HISTORICAL' },
    { trade_date: '2025-12-11', trade_time: '07:01:02', order_type: 'SHORT', open_price: 93044.2, target_price: 89163.78, close_price: 92513.38, result_percent: 5.71, status: 'FILLED', balance: 49.47, source: 'HISTORICAL' },
    { trade_date: '2025-12-12', trade_time: '07:01:26', order_type: 'LONG', open_price: 91373.38, target_price: 95553.38, result_percent: 0, status: 'NOT FILLED', balance: 49.47, source: 'HISTORICAL' },
    { trade_date: '2025-12-13', trade_time: '07:00:55', order_type: 'SHORT', open_price: 90720, target_price: 88800, result_percent: 0, status: 'NOT FILLED', balance: 49.47, source: 'HISTORICAL' },
    { trade_date: '2025-12-14', trade_time: '07:01:44', order_type: 'SHORT', open_price: 90650, target_price: 89700, result_percent: 0, status: 'NOT FILLED', balance: 49.47, source: 'HISTORICAL' },
    { trade_date: '2025-12-15', trade_time: '23:54:59', order_type: 'SHORT', open_price: 89000, target_price: 87000, result_percent: 0, status: 'NOT FILLED', balance: 49.47, source: 'HISTORICAL' },
    { trade_date: '2025-12-16', trade_time: '07:01:27', order_type: 'SHORT', open_price: 87275, target_price: 84400, close_price: 87863.42, result_percent: -6.74, status: 'FILLED', balance: 46.14, source: 'HISTORICAL' },
    { trade_date: '2025-12-17', trade_time: '07:02:01', order_type: 'SHORT', open_price: 87900, target_price: 87700, close_price: 87700, result_percent: 2.28, status: 'FILLED', balance: 47.19, source: 'HISTORICAL' },
    { trade_date: '2025-12-18', trade_time: '11:27:35', order_type: 'SHORT', open_price: 90365.85, target_price: 85200, result_percent: 0, status: 'NOT FILLED', balance: 47.18761646, source: 'HISTORICAL' },
    { trade_date: '2025-12-19', trade_time: '07:01:07', order_type: 'SHORT', open_price: 87850, target_price: 84600, close_price: 88136.94, result_percent: -3.27, status: 'FILLED', balance: 45.65, source: 'HISTORICAL' },
    { trade_date: '2025-12-20', trade_time: '07:01:04', order_type: 'LONG', open_price: 87450.2, target_price: 89650.45, result_percent: 0, status: 'NOT FILLED', balance: 45.65, source: 'HISTORICAL' },
    { trade_date: '2025-12-21', trade_time: '07:00:55', order_type: 'LONG', open_price: 87750.1, target_price: 89650.25, result_percent: 0, status: 'NOT FILLED', balance: 45.65, source: 'HISTORICAL' },
    { trade_date: '2025-12-22', trade_time: '07:01:00', order_type: 'LONG', open_price: 87800.25, target_price: 91450.5, result_percent: 0, status: 'NOT FILLED', balance: 45.65, source: 'HISTORICAL' },
    { trade_date: '2025-12-23', trade_time: '07:00:58', order_type: 'LONG', open_price: 86100, target_price: 89250, result_percent: 0, status: 'NOT FILLED', balance: 45.65, source: 'HISTORICAL' },
];

/**
 * Import historical trading data to Supabase
 */
export const importHistoricalData = async (): Promise<{ success: boolean; count: number; error?: string }> => {
    try {
        console.log('[Leverage Service] 📥 Importing 40 historical trades...');
        
        // Check if data already exists
        const { data: existing, error: checkError } = await supabase
            .from('leverage_trades')
            .select('id')
            .eq('source', 'HISTORICAL')
            .limit(1);
        
        if (checkError) throw checkError;
        
        if (existing && existing.length > 0) {
            console.log('[Leverage Service] ⚠️ Historical data already imported. Skipping...');
            return { success: true, count: 0 };
        }
        
        // Insert all historical trades
        const { data, error } = await supabase
            .from('leverage_trades')
            .insert(HISTORICAL_DATA)
            .select();
        
        if (error) throw error;
        
        console.log(`[Leverage Service] ✅ Successfully imported ${data?.length || 0} trades`);
        
        return { success: true, count: data?.length || 0 };
    } catch (error: any) {
        console.error('[Leverage Service] ❌ Import failed:', error);
        return { success: false, count: 0, error: error.message };
    }
};

/**
 * Fetch all leverage trades from Supabase
 */
export const fetchLeverageTrades = async (): Promise<LeverageTrade[]> => {
    try {
        const { data, error } = await supabase
            .from('leverage_trades')
            .select('*')
            .order('trade_date', { ascending: false });
        
        if (error) throw error;
        
        return data || [];
    } catch (error: any) {
        console.error('[Leverage Service] ❌ Fetch failed:', error);
        return [];
    }
};

/**
 * Get leverage statistics
 */
export const getLeverageStats = async () => {
    try {
        const { data, error } = await supabase
            .rpc('get_leverage_stats');
        
        if (error) throw error;
        
        return data?.[0] || null;
    } catch (error: any) {
        console.error('[Leverage Service] ❌ Stats fetch failed:', error);
        return null;
    }
};

/**
 * Create a new training session
 */
export const createTrainingSession = async (session: Omit<TrainingSession, 'id'>): Promise<string | null> => {
    try {
        const { data, error } = await supabase
            .from('leverage_training_sessions')
            .insert(session)
            .select('id')
            .single();
        
        if (error) throw error;
        
        return data?.id || null;
    } catch (error: any) {
        console.error('[Leverage Service] ❌ Session creation failed:', error);
        return null;
    }
};

/**
 * Update training session
 */
export const updateTrainingSession = async (id: string, updates: Partial<TrainingSession>): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('leverage_training_sessions')
            .update(updates)
            .eq('id', id);
        
        if (error) throw error;
        
        return true;
    } catch (error: any) {
        console.error('[Leverage Service] ❌ Session update failed:', error);
        return false;
    }
};

/**
 * Save discovered pattern
 */
export const savePattern = async (pattern: Omit<LeveragePattern, 'id'>): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('leverage_patterns')
            .upsert(pattern, { onConflict: 'pattern_signature' });
        
        if (error) throw error;
        
        return true;
    } catch (error: any) {
        console.error('[Leverage Service] ❌ Pattern save failed:', error);
        return false;
    }
};

/**
 * Fetch best performing patterns
 */
export const fetchBestPatterns = async (limit: number = 10): Promise<LeveragePattern[]> => {
    try {
        const { data, error } = await supabase
            .from('best_leverage_patterns')
            .select('*')
            .limit(limit);
        
        if (error) throw error;
        
        return data || [];
    } catch (error: any) {
        console.error('[Leverage Service] ❌ Pattern fetch failed:', error);
        return [];
    }
};

/**
 * Calculate leverage-adjusted PNL manually (for verification)
 */
export const calculateLeveragePNL = (
    orderType: 'SHORT' | 'LONG',
    openPrice: number,
    closePrice: number,
    balance: number,
    leverage: number = 10
): { pnl_percent: number; pnl_amount: number; position_size: number } => {
    // Calculate price movement %
    let priceMovementPercent: number;
    
    if (orderType === 'SHORT') {
        // SHORT: profit when price goes down
        priceMovementPercent = (openPrice - closePrice) / openPrice;
    } else {
        // LONG: profit when price goes up
        priceMovementPercent = (closePrice - openPrice) / openPrice;
    }
    
    // Apply leverage multiplier
    const pnl_percent = priceMovementPercent * leverage * 100;
    const pnl_amount = balance * (pnl_percent / 100);
    const position_size = balance * leverage;
    
    return { pnl_percent, pnl_amount, position_size };
};

/**
 * Extract features from trade for ML training
 */
export const extractTradeFeatures = (trade: LeverageTrade): number[] => {
    // Extract normalized features for ML model
    const priceChange = trade.close_price 
        ? (trade.close_price - trade.open_price) / trade.open_price 
        : 0;
    
    const targetDistance = (trade.target_price - trade.open_price) / trade.open_price;
    
    const orderTypeNumeric = trade.order_type === 'SHORT' ? 0 : 1;
    const statusNumeric = trade.status === 'FILLED' ? 1 : 0;
    
    // Normalize balance (assuming max ~100)
    const balanceNormalized = Math.min(trade.balance / 100, 1);
    
    // Time of day (assuming trade_time format HH:MM:SS)
    let timeOfDay = 0.5; // default midday
    if (trade.trade_time) {
        const hour = parseInt(trade.trade_time.split(':')[0]);
        timeOfDay = hour / 24;
    }
    
    return [
        orderTypeNumeric,
        priceChange,
        targetDistance,
        balanceNormalized,
        statusNumeric,
        timeOfDay
    ];
};

export default {
    importHistoricalData,
    fetchLeverageTrades,
    getLeverageStats,
    createTrainingSession,
    updateTrainingSession,
    savePattern,
    fetchBestPatterns,
    calculateLeveragePNL,
    extractTradeFeatures,
    HISTORICAL_DATA
};
