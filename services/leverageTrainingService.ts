/**
 * Leverage Training Service
 * Handles batch training with historical leverage trades
 */

import { 
    fetchLeverageTrades, 
    createTrainingSession, 
    updateTrainingSession,
    savePattern,
    extractTradeFeatures,
    LeverageTrade,
    TrainingSession
} from './leverageTradeService';
import { trainModel, batchTrainFromHistory, calculateAverageConfidence, getPatternStats } from './mlService';
import { storageService } from './storageService';
import { TrainingData } from '../types';

export interface LeverageTrainingResult {
    success: boolean;
    session_id?: string;
    total_trained: number;
    win_rate: number;
    avg_pnl: number;
    final_confidence: number;
    patterns_discovered: number;
    iterations: number;
    error?: string;
}

export interface TrainingProgress {
    current: number;
    total: number;
    confidence: number;
    win_rate: number;
    status: string;
}

/**
 * Convert leverage trade to training data format
 */
const convertToTrainingData = (trade: LeverageTrade): TrainingData | null => {
    if (trade.status !== 'FILLED' || !trade.close_price) {
        return null;
    }
    
    // Determine outcome based on PNL
    const outcome: 'WIN' | 'LOSS' = (trade.pnl_percent || 0) > 0 ? 'WIN' : 'LOSS';
    
    // Create pattern description
    const pattern = `${trade.order_type}_${trade.pnl_percent && trade.pnl_percent > 10 ? 'HIGH_PROFIT' : trade.pnl_percent && trade.pnl_percent < -10 ? 'HIGH_LOSS' : 'NORMAL'}`;
    
    return {
        id: trade.id || '',
        pattern,
        outcome,
        confluence: `Open: ${trade.open_price}, Close: ${trade.close_price}, Target: ${trade.target_price}`,
        riskReward: trade.pnl_percent || 0,
        note: `Leverage ${trade.leverage_multiplier}x. PNL: $${(trade.pnl_amount || 0).toFixed(2)}. Confidence: ${trade.ai_confidence || 'N/A'}%`
    };
};

/**
 * Batch train model with all historical leverage trades
 */
export const batchTrainWithLeverageTrades = async (
    onProgress?: (progress: TrainingProgress) => void
): Promise<LeverageTrainingResult> => {
    try {
        console.log('[Leverage Training] 🚀 Starting batch training...');
        
        // Create training session
        const sessionData: Omit<TrainingSession, 'id'> = {
            total_trades_used: 0,
            epochs: 1,
            learning_rate: 0.08,
            epsilon: 0.05,
            status: 'RUNNING'
        };
        
        const sessionId = await createTrainingSession(sessionData);
        if (!sessionId) {
            throw new Error('Failed to create training session');
        }
        
        // Fetch all leverage trades
        const trades = await fetchLeverageTrades();
        const filledTrades = trades.filter(t => t.status === 'FILLED' && t.close_price);
        
        console.log(`[Leverage Training] 📊 Found ${filledTrades.length} filled trades`);
        
        if (filledTrades.length === 0) {
            throw new Error('No filled trades available for training');
        }
        
        // Convert to training data format
        const trainingData: TrainingData[] = filledTrades
            .map(convertToTrainingData)
            .filter(t => t !== null) as TrainingData[];
        
        // Save to Supabase for future use
        await storageService.saveTrainingData(trainingData);
        
        // Track metrics
        let totalTrained = 0;
        let wins = 0;
        let losses = 0;
        let totalPnl = 0;
        
        // Train on each trade
        for (let i = 0; i < filledTrades.length; i++) {
            const trade = filledTrades[i];
            
            if (!trade.close_price) continue;
            
            // Extract features for training
            const features = extractTradeFeatures(trade);
            
            // Determine outcome
            const outcome: 'WIN' | 'LOSS' = (trade.pnl_percent || 0) > 0 ? 'WIN' : 'LOSS';
            const pnl = trade.pnl_amount || 0;
            const riskAmount = trade.balance * 0.1; // Assuming 10% risk per trade
            
            // Train the model
            trainModel(
                outcome,
                trade.order_type === 'SHORT' ? 'SELL' : 'BUY',
                [], // Empty candles - using extracted features instead
                {} as any, // Empty indicators
                0, // No sentiment data
                pnl,
                riskAmount,
                trade.ai_confidence
            );
            
            totalTrained++;
            if (outcome === 'WIN') wins++;
            else losses++;
            totalPnl += pnl;
            
            // Report progress
            if (onProgress) {
                const currentConfidence = calculateAverageConfidence();
                const winRate = wins / (wins + losses);
                
                onProgress({
                    current: i + 1,
                    total: filledTrades.length,
                    confidence: currentConfidence,
                    win_rate: winRate * 100,
                    status: `Training trade ${i + 1}/${filledTrades.length}`
                });
            }
        }
        
        // Get final metrics
        const finalConfidence = calculateAverageConfidence();
        const winRate = wins / (wins + losses);
        const avgPnl = totalPnl / totalTrained;
        const patternStats = getPatternStats();
        
        // Update training session
        await updateTrainingSession(sessionId, {
            completed_at: new Date().toISOString(),
            total_trades_used: totalTrained,
            final_accuracy: winRate * 100,
            win_rate: winRate * 100,
            avg_pnl: avgPnl,
            total_iterations: totalTrained,
            patterns_discovered: patternStats.totalPatterns,
            avg_confidence: finalConfidence,
            status: 'COMPLETED'
        });
        
        // Save discovered patterns
        for (const pattern of patternStats.patterns) {
            await savePattern({
                pattern_name: pattern.pattern,
                pattern_signature: pattern.pattern,
                win_count: pattern.winCount,
                loss_count: pattern.lossCount,
                win_rate: pattern.confidence,
                avg_pnl: pattern.avgPnl,
                total_pnl: pattern.totalPnl,
                confidence_score: pattern.confidence,
                reliability_score: Math.min((pattern.winCount + pattern.lossCount) / 10 * 100, 100),
                last_seen: new Date().toISOString(),
                times_traded: pattern.winCount + pattern.lossCount
            });
        }
        
        console.log(`[Leverage Training] ✅ Completed: ${totalTrained} trades, ${(winRate * 100).toFixed(1)}% win rate, ${finalConfidence.toFixed(1)}% confidence`);
        
        return {
            success: true,
            session_id: sessionId,
            total_trained: totalTrained,
            win_rate: winRate * 100,
            avg_pnl: avgPnl,
            final_confidence: finalConfidence,
            patterns_discovered: patternStats.totalPatterns,
            iterations: totalTrained
        };
        
    } catch (error: any) {
        console.error('[Leverage Training] ❌ Training failed:', error);
        return {
            success: false,
            total_trained: 0,
            win_rate: 0,
            avg_pnl: 0,
            final_confidence: 50,
            patterns_discovered: 0,
            iterations: 0,
            error: error.message
        };
    }
};

/**
 * Iterative training until target confidence is reached
 */
export const trainUntilTargetConfidence = async (
    targetConfidence: number = 70,
    maxIterations: number = 10,
    onProgress?: (iteration: number, confidence: number, winRate: number) => void
): Promise<LeverageTrainingResult> => {
    console.log(`[Iterative Training] 🎯 Target confidence: ${targetConfidence}%`);
    
    let iteration = 0;
    let currentConfidence = calculateAverageConfidence();
    let lastResult: LeverageTrainingResult | null = null;
    
    while (currentConfidence < targetConfidence && iteration < maxIterations) {
        iteration++;
        console.log(`[Iterative Training] 🔄 Iteration ${iteration}/${maxIterations}`);
        
        // Run batch training
        lastResult = await batchTrainWithLeverageTrades();
        
        if (!lastResult.success) {
            console.error('[Iterative Training] ❌ Training failed');
            break;
        }
        
        currentConfidence = lastResult.final_confidence;
        
        if (onProgress) {
            onProgress(iteration, currentConfidence, lastResult.win_rate);
        }
        
        console.log(`[Iterative Training] 📊 Iteration ${iteration}: Confidence ${currentConfidence.toFixed(1)}%`);
        
        // Check if we've reached target
        if (currentConfidence >= targetConfidence) {
            console.log(`[Iterative Training] ✅ Target reached! ${currentConfidence.toFixed(1)}% >= ${targetConfidence}%`);
            break;
        }
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (lastResult) {
        return {
            ...lastResult,
            iterations: iteration
        };
    }
    
    return {
        success: false,
        total_trained: 0,
        win_rate: 0,
        avg_pnl: 0,
        final_confidence: currentConfidence,
        patterns_discovered: 0,
        iterations: iteration,
        error: 'Training did not complete successfully'
    };
};

/**
 * Get training statistics
 */
export const getTrainingStats = async () => {
    try {
        const trades = await fetchLeverageTrades();
        const filledTrades = trades.filter(t => t.status === 'FILLED');
        const wins = filledTrades.filter(t => (t.pnl_percent || 0) > 0);
        const losses = filledTrades.filter(t => (t.pnl_percent || 0) < 0);
        
        const totalPnl = filledTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0);
        const avgPnl = totalPnl / filledTrades.length;
        
        const winRate = (wins.length / filledTrades.length) * 100;
        
        return {
            total_trades: trades.length,
            filled_trades: filledTrades.length,
            not_filled: trades.length - filledTrades.length,
            wins: wins.length,
            losses: losses.length,
            win_rate: winRate,
            avg_pnl: avgPnl,
            total_pnl: totalPnl,
            best_trade: Math.max(...filledTrades.map(t => t.pnl_percent || 0)),
            worst_trade: Math.min(...filledTrades.map(t => t.pnl_percent || 0)),
            short_trades: trades.filter(t => t.order_type === 'SHORT').length,
            long_trades: trades.filter(t => t.order_type === 'LONG').length
        };
    } catch (error) {
        console.error('[Training Stats] ❌ Failed to get stats:', error);
        return null;
    }
};

export default {
    batchTrainWithLeverageTrades,
    trainUntilTargetConfidence,
    getTrainingStats
};
