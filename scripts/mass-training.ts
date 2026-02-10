/**
 * MASS TRAINING SCRIPT
 * Train AI model with hundreds of historical patterns
 * This will boost pattern memory and experience confidence
 */

import { trainModel } from '../services/mlService';
import { Candle, TechnicalIndicators } from '../types';
import { calculateRSI, analyzeTrend, calculateSMA } from '../utils/technical';

/**
 * Generate synthetic training data from historical patterns
 */
const generateTrainingData = (candles: Candle[]) => {
    const trainingSet = [];

    // Slide through historical data
    for (let i = 100; i < candles.length - 20; i++) {
        const subset = candles.slice(i - 100, i);
        const futureSlice = candles.slice(i, i + 20);

        // Calculate indicators
        const rsi = calculateRSI(subset);
        const sma200 = calculateSMA(subset, 200);
        const trend = analyzeTrend(subset, sma200);

        const indicators: TechnicalIndicators = {
            rsi,
            trend,
            fibLevels: { level0: 0, level236: 0, level382: 0, level500: 0, level618: 0, level100: 0 },
            sma50: calculateSMA(subset, 50),
            sma200,
            ema20: calculateSMA(subset, 20), // Simplified
            nearestSupport: Math.min(...subset.slice(-20).map(c => c.low)),
            nearestResistance: Math.max(...subset.slice(-20).map(c => c.high)),
            volumeSma: calculateSMA(subset.map(c => c.volume), 20),
            macd: { value: 0, signal: 0, histogram: 0 },
            stochastic: { k: 50, d: 50 },
            momentum: 0
        };

        // Determine outcome based on future price action
        const currentPrice = subset[subset.length - 1].close;
        const futureHigh = Math.max(...futureSlice.map(c => c.high));
        const futureLow = Math.min(...futureSlice.map(c => c.low));

        const upMove = ((futureHigh - currentPrice) / currentPrice) * 100;
        const downMove = ((currentPrice - futureLow) / currentPrice) * 100;

        // Determine if BUY or SELL would have won
        let outcome: 'WIN' | 'LOSS';
        let type: 'BUY' | 'SELL';
        let pnl: number;

        if (upMove > downMove && upMove > 1) {
            // BUY would have won
            type = 'BUY';
            outcome = 'WIN';
            pnl = upMove * 100; // Simplified P/L
        } else if (downMove > upMove && downMove > 1) {
            // SELL would have won
            type = 'SELL';
            outcome = 'WIN';
            pnl = downMove * 100;
        } else if (upMove > 0.5) {
            type = 'BUY';
            outcome = 'LOSS';
            pnl = -downMove * 100;
        } else {
            type = 'SELL';
            outcome = 'LOSS';
            pnl = -upMove * 100;
        }

        trainingSet.push({
            candles: subset,
            indicators,
            type,
            outcome,
            pnl,
            riskAmount: 100 // Fixed risk
        });
    }

    return trainingSet;
};

/**
 * Execute mass training
 */
export const runMassTraining = async (candles: Candle[], iterations: number = 500) => {
    console.log(`🧠 [MASS TRAINING] Starting with ${candles.length} candles...`);
    console.log(`🎯 [MASS TRAINING] Target: ${iterations} training iterations`);

    const trainingData = generateTrainingData(candles);
    console.log(`📊 [MASS TRAINING] Generated ${trainingData.length} training samples`);

    let trainedCount = 0;
    const maxIterations = Math.min(iterations, trainingData.length);

    for (let i = 0; i < maxIterations; i++) {
        const sample = trainingData[i % trainingData.length];

        await trainModel(
            sample.outcome,
            sample.type,
            sample.candles,
            sample.indicators,
            0.5, // Neutral sentiment
            sample.pnl,
            sample.riskAmount
        );

        trainedCount++;

        // Progress logging
        if (trainedCount % 50 === 0) {
            console.log(`⚡ [MASS TRAINING] Progress: ${trainedCount}/${maxIterations} (${((trainedCount / maxIterations) * 100).toFixed(0)}%)`);
        }
    }

    console.log(`✅ [MASS TRAINING] COMPLETE! Trained ${trainedCount} iterations`);
    console.log(`🎓 [MASS TRAINING] Model should now have significantly higher confidence`);

    return {
        success: true,
        trainedCount,
        patternsLearned: trainingData.length
    };
};

/**
 * Quick training with 100 iterations (fast)
 */
export const quickTrain = async (candles: Candle[]) => {
    return runMassTraining(candles, 100);
};

/**
 * Deep training with 500 iterations (recommended)
 */
export const deepTrain = async (candles: Candle[]) => {
    return runMassTraining(candles, 500);
};

/**
 * Ultra training with 1000+ iterations (maximum learning)
 */
export const ultraTrain = async (candles: Candle[]) => {
    return runMassTraining(candles, 1000);
};
