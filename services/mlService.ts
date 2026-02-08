
import { Candle, TechnicalIndicators, TradeSignal, TrainingData, NewsItem } from "../types";
import { storageService } from "./storageService";
import { calculateBollingerBands } from "../utils/technical";
import { generateUUID } from "../utils/uuid";
import { confidenceCalibrator, adaptiveHyperparameters, patternDiscovery } from "./metaLearning";
// Gemini API removed - using pure self-learning RL agent
// import { analyzeMarketWithAI } from "./geminiService";

// --- REINFORCEMENT LEARNING (DQN) WITH PATTERN MEMORY ---

// Pattern Memory Interface
interface PatternMemory {
    pattern: string;
    winCount: number;
    lossCount: number;
    totalPnl: number;
    avgPnl: number;
    confidence: number;
    lastSeen: number;
}

class DeepQNetwork {
    inputNodes: number;
    hiddenNodes: number;
    outputNodes: number;
    weightsIH: number[][]; // Input -> Hidden
    weightsHO: number[][]; // Hidden -> Output (Q-Values)
    biasH: number[];
    biasO: number[];
    learningRate: number;
    discountFactor: number; // Gamma for Q-Learning
    epsilon: number; // Exploration Rate
    
    // Pattern Memory System
    patternMemory: Map<string, PatternMemory>;
    totalTrainingIterations: number;

    constructor(inputNodes: number, hiddenNodes: number, outputNodes: number) {
        this.inputNodes = inputNodes;
        this.hiddenNodes = hiddenNodes;
        this.outputNodes = outputNodes;
        this.learningRate = 0.08; // TUNED: Faster learning for quicker adaptation
        this.discountFactor = 0.95; // TUNED: Higher value for better long-term planning
        this.epsilon = 0.05; // TUNED: 5% exploration (was 20%) - more exploitation of learned patterns
        
        // Initialize pattern memory
        this.patternMemory = new Map();
        this.totalTrainingIterations = 0;

        // Initialize random weights or load from storage
        const saved = storageService.getModelWeights();
        if (saved) {
            this.weightsIH = saved.weightsIH;
            this.weightsHO = saved.weightsHO;
            this.biasH = saved.biasH;
            this.biasO = saved.biasO;
        } else {
            // Xavier Initialization
            this.weightsIH = Array(this.hiddenNodes).fill(0).map(() => Array(this.inputNodes).fill(0).map(() => Math.random() * 0.2 - 0.1));
            this.weightsHO = Array(this.outputNodes).fill(0).map(() => Array(this.hiddenNodes).fill(0).map(() => Math.random() * 0.2 - 0.1));
            this.biasH = Array(this.hiddenNodes).fill(0).map(() => Math.random() * 0.2 - 0.1);
            this.biasO = Array(this.outputNodes).fill(0).map(() => Math.random() * 0.2 - 0.1);
        }
    }

    // Activation Function: ReLU
    relu(x: number): number {
        return Math.max(0, x);
    }

    drelu(y: number): number {
        return y > 0 ? 1 : 0;
    }

    // Sigmoid for Output
    sigmoid(x: number): number {
        return 1 / (1 + Math.exp(-x));
    }

    dsigmoid(y: number): number {
        return y * (1 - y);
    }

    predict(inputs: number[]): number[] {
        // Input -> Hidden
        let hidden = this.weightsIH.map((row, i) => 
            this.relu(row.reduce((sum, w, j) => sum + w * inputs[j], 0) + this.biasH[i])
        );

        // Hidden -> Output
        let outputs = this.weightsHO.map((row, i) => 
            this.sigmoid(row.reduce((sum, w, j) => sum + w * hidden[j], 0) + this.biasO[i])
        );

        return outputs;
    }

    // Q-Learning Training Step
    train(inputs: number[], actionIndex: number, reward: number) {
        // 1. Forward Pass
        let hidden = this.weightsIH.map((row, i) => 
            this.relu(row.reduce((sum, w, j) => sum + w * inputs[j], 0) + this.biasH[i])
        );
        let outputs = this.weightsHO.map((row, i) => 
            this.sigmoid(row.reduce((sum, w, j) => sum + w * hidden[j], 0) + this.biasO[i])
        );

        // 2. Target Q-Value
        const currentQ = outputs[actionIndex];
        const targetQ = currentQ + this.learningRate * (reward - currentQ);
        
        const targets = [...outputs];
        targets[actionIndex] = targetQ;

        // 3. Backpropagation
        let outputErrors = targets.map((t, i) => t - outputs[i]);
        let gradients = outputs.map((o, i) => outputErrors[i] * this.dsigmoid(o) * this.learningRate);

        const oldWeightsHO = this.weightsHO.map(row => [...row]);
        this.weightsHO = this.weightsHO.map((row, i) => 
            row.map((w, j) => w + gradients[i] * hidden[j])
        );
        this.biasO = this.biasO.map((b, i) => b + gradients[i]);

        let hiddenErrors = hidden.map((_, i) => 
            oldWeightsHO.reduce((sum, row, j) => sum + row[i] * outputErrors[j], 0)
        );

        let hiddenGradients = hidden.map((h, i) => hiddenErrors[i] * this.drelu(h) * this.learningRate);

        this.weightsIH = this.weightsIH.map((row, i) => 
            row.map((w, j) => w + hiddenGradients[i] * inputs[j])
        );
        this.biasH = this.biasH.map((b, i) => b + hiddenGradients[i]);

        this.save();
    }

    save() {
        storageService.saveModelWeights({
            weightsIH: this.weightsIH,
            weightsHO: this.weightsHO,
            biasH: this.biasH,
            biasO: this.biasO
        });
    }

    load() {
        const saved = storageService.getModelWeights();
        if (saved) {
            this.weightsIH = saved.weightsIH;
            this.weightsHO = saved.weightsHO;
            this.biasH = saved.biasH;
            this.biasO = saved.biasO;
            console.log("Model weights reloaded from storage.");
        }
    }
    
    // --- PATTERN MEMORY METHODS ---
    
    /**
     * Identify market pattern from state
     */
    identifyPattern(state: number[]): string {
        const [rsi, trend, bb, volatility, sentiment, momentum] = state;
        
        // Create pattern signature
        const patterns: string[] = [];
        
        // RSI patterns
        if (rsi < 0.3) patterns.push("RSI_oversold");
        else if (rsi > 0.7) patterns.push("RSI_overbought");
        else patterns.push("RSI_neutral");
        
        // Trend patterns
        if (trend > 0.6) patterns.push("uptrend");
        else if (trend < 0.4) patterns.push("downtrend");
        else patterns.push("sideways");
        
        // BB patterns
        if (bb < 0.2) patterns.push("BB_lower");
        else if (bb > 0.8) patterns.push("BB_upper");
        else patterns.push("BB_mid");
        
        // Volatility
        if (volatility > 0.7) patterns.push("high_vol");
        else if (volatility < 0.3) patterns.push("low_vol");
        
        return patterns.join("_");
    }
    
    /**
     * Update pattern memory after trade outcome
     */
    updatePatternMemory(state: number[], action: number, outcome: 'WIN' | 'LOSS', pnl: number) {
        const pattern = this.identifyPattern(state);
        
        const memory = this.patternMemory.get(pattern) || {
            pattern,
            winCount: 0,
            lossCount: 0,
            totalPnl: 0,
            avgPnl: 0,
            confidence: 50,
            lastSeen: Date.now()
        };
        
        // Update counts
        if (outcome === 'WIN') {
            memory.winCount++;
        } else {
            memory.lossCount++;
        }
        
        // Update PNL
        memory.totalPnl += pnl;
        const totalTrades = memory.winCount + memory.lossCount;
        memory.avgPnl = memory.totalPnl / totalTrades;
        
        // Calculate confidence from win rate
        memory.confidence = (memory.winCount / totalTrades) * 100;
        memory.lastSeen = Date.now();
        
        this.patternMemory.set(pattern, memory);
        
        console.log(`[Pattern Memory] ${pattern}: ${memory.winCount}W/${memory.lossCount}L (${memory.confidence.toFixed(0)}% confidence, avg PNL: ${memory.avgPnl.toFixed(2)})`);
    }
    
    /**
     * Get pattern confidence for current state
     */
    getPatternConfidence(state: number[]): number {
        const pattern = this.identifyPattern(state);
        const memory = this.patternMemory.get(pattern);
        
        if (!memory) return 50; // Default 50% for unknown patterns
        
        // Require at least 3 trades to trust pattern
        const totalTrades = memory.winCount + memory.lossCount;
        if (totalTrades < 3) return 50;
        
        return memory.confidence;
    }
    
    /**
     * Get enhanced confidence combining Q-values, pattern memory, and experience
     */
    getEnhancedConfidence(state: number[], action: number): number {
        // 1. Q-value based confidence
        const qValues = this.predict(state);
        const maxQ = Math.max(...qValues);
        const minQ = Math.min(...qValues);
        const qConfidence = ((qValues[action] - minQ) / (maxQ - minQ + 0.01)) * 100;
        
        // 2. Pattern memory confidence
        const patternConfidence = this.getPatternConfidence(state);
        
        // 3. Experience-based confidence (improves with training)
        const experienceConfidence = Math.min(this.totalTrainingIterations / 100, 1) * 100;
        
        // 4. Weighted average
        const confidence = (
            qConfidence * 0.4 +
            patternConfidence * 0.4 +
            experienceConfidence * 0.2
        );
        
        return Math.min(Math.max(confidence, 0), 100);
    }
}

// Instantiate the RL Agent
const brain = new DeepQNetwork(6, 8, 3);

export const refreshModel = () => {
    brain.load();
};

// --- EXPERT ADVISOR (FEATURE EXTRACTION) ---

const getMarketState = (candles: Candle[], indicators: TechnicalIndicators, sentiment: number): number[] => {
    const last = candles[candles.length - 1];
    const prices = candles.map(c => c.close);
    const bb = calculateBollingerBands(prices, 20, 2);

    const rsiFeature = indicators.rsi / 100;
    const trendFeature = last.close > indicators.sma200 ? 1 : 0;
    
    let bbPosition = 0.5;
    if (bb.upper - bb.lower !== 0) {
        bbPosition = (last.close - bb.lower) / (bb.upper - bb.lower);
    }
    const bbFeature = Math.max(0, Math.min(1, bbPosition));

    const bandwidth = (bb.upper - bb.lower) / (bb.middle || 1);
    const volatilityFeature = Math.min(1, bandwidth * 10); 

    const sentimentFeature = sentiment * 0.5 + 0.5;

    const momDiff = (last.close - indicators.ema20) / indicators.ema20;
    const momFeature = Math.max(0, Math.min(1, (momDiff * 10) + 0.5));

    return [rsiFeature, trendFeature, bbFeature, volatilityFeature, sentimentFeature, momFeature];
};

// --- SERVICE EXPORTS ---

export const analyzeMarket = async (
    candles: Candle[],
    indicators: TechnicalIndicators,
    trainingHistory: TrainingData[],
    news: NewsItem[],
    assetSymbol: string = 'Unknown'
): Promise<TradeSignal | null> => {
    
    // 1. Run Local RL Analysis (Fast, Free)
    // ------------------------------------
    const sentimentScore = news.length > 0 ? 
        news.reduce((acc, n) => acc + (n.sentiment === 'POSITIVE' ? 1 : n.sentiment === 'NEGATIVE' ? -1 : 0), 0) / Math.max(1, news.length) 
        : 0;

    const state = getMarketState(candles, indicators, sentimentScore);

    // Q-values: [Q_Buy, Q_Sell, Q_Hold]
    const qValues = brain.predict(state);
    const [qBuy, qSell, qHold] = qValues;

    let decision: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = qHold;

    // --- EPSILON GREEDY STRATEGY (Exploration) ---
    // If random number < epsilon, choose random action to learn
    if (Math.random() < brain.epsilon) {
        // EXPLORATION MODE (5% of the time)
        const rand = Math.random();
        if (rand < 0.33) {
            decision = 'BUY';
            confidence = qBuy; // FIXED: Use actual Q-value instead of hardcoded 0.5
        } else if (rand < 0.66) {
            decision = 'SELL';
            confidence = qSell; // FIXED: Use actual Q-value instead of hardcoded 0.5
        } else {
            decision = 'HOLD';
            confidence = qHold;
        }
        console.log(`[RL Agent] 🎲 Exploration Mode (${(brain.epsilon * 100).toFixed(0)}%): Chose ${decision} with Q-value ${confidence.toFixed(3)}`);
    } else {
        // EXPLOITATION MODE (95% of the time) - Use learned patterns
        const ACTION_THRESHOLD = 0.45; // TUNED: Lowered from 0.51 to encourage action

        if (qBuy > qSell && qBuy > qHold && qBuy > ACTION_THRESHOLD) {
            decision = 'BUY';
            confidence = qBuy;
        } else if (qSell > qBuy && qSell > qHold && qSell > ACTION_THRESHOLD) {
            decision = 'SELL';
            confidence = qSell;
        }
        console.log(`[RL Agent] 🧠 Exploitation Mode: Q-values [BUY:${qBuy.toFixed(3)}, SELL:${qSell.toFixed(3)}, HOLD:${qHold.toFixed(3)}] → ${decision}`);
    }

    // 2. PURE SELF-LEARNING RL - NO EXTERNAL AI
    // -----------------------------------------
    // Use enhanced confidence combining Q-values, pattern memory, and experience
    
    const actionIndex = decision === 'BUY' ? 0 : decision === 'SELL' ? 1 : 2;
    const enhancedConfidence = brain.getEnhancedConfidence(state, actionIndex);
    
    // Generate rule-based reasoning from technical indicators
    const generateReasoning = (): string => {
        const reasons: string[] = [];
        
        // RSI analysis
        if (indicators.rsi < 30) {
            reasons.push("RSI oversold (bullish signal)");
        } else if (indicators.rsi > 70) {
            reasons.push("RSI overbought (bearish signal)");
        }
        
        // Bollinger Bands (using nearestSupport/Resistance as proxy)
        const last = candles[candles.length - 1];
        if (last.close < indicators.nearestSupport) {
            reasons.push("Price near support level (potential bounce)");
        } else if (last.close > indicators.nearestResistance) {
            reasons.push("Price near resistance (potential reversal)");
        }
        
        // Moving averages
        if (indicators.ema20 > indicators.sma50) {
            reasons.push("EMA20 above SMA50 (bullish momentum)");
        } else if (indicators.ema20 < indicators.sma50) {
            reasons.push("EMA20 below SMA50 (bearish momentum)");
        }
        
        // Pattern memory
        const pattern = brain.identifyPattern(state);
        const memory = brain.patternMemory.get(pattern);
        if (memory && memory.winCount > 2) {
            reasons.push(`Pattern "${pattern}" has ${memory.winCount} wins (${memory.confidence.toFixed(0)}% success rate)`);
        }
        
        // Trend
        if (indicators.trend === 'UP') {
            reasons.push("Strong uptrend detected");
        } else if (indicators.trend === 'DOWN') {
            reasons.push("Strong downtrend detected");
        }
        
        return reasons.length > 0 
            ? reasons.join(". ") + "."
            : `Technical analysis suggests ${decision} action based on learned patterns.`;
    };

    // If HOLD, return early
    if (decision === 'HOLD') {
        return { 
            id: generateUUID(), 
            symbol: assetSymbol,
            type: 'HOLD', 
            entryPrice: 0, stopLoss: 0, takeProfit: 0, 
            confidence: Math.round(enhancedConfidence), 
            reasoning: `AI Strategy: Wait. Market conditions ambiguous. (Q-Hold: ${qHold.toFixed(2)})`,
            timestamp: Date.now() 
        };
    }

    // Construct Trade Signal from Local Decision
    const last = candles[candles.length - 1];
    const atr = (Math.max(...candles.slice(-14).map(c => c.high)) - Math.min(...candles.slice(-14).map(c => c.low))) * 0.2; 
    let entry = last.close;
    let sl = decision === 'BUY' ? entry - (atr * 2) : entry + (atr * 2);
    let tp = decision === 'BUY' ? entry + (atr * 3) : entry - (atr * 3);
    
    if (decision === 'BUY') sl = Math.min(sl, indicators.nearestSupport * 0.999);
    else sl = Math.max(sl, indicators.nearestResistance * 1.001);

    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    const rr = risk === 0 ? 0 : Number((reward/risk).toFixed(2));
    
    // Get pattern for logging
    const currentPattern = brain.identifyPattern(state);

    return {
        id: generateUUID(),
        symbol: assetSymbol,
        type: decision,
        entryPrice: entry,
        stopLoss: Number(sl.toFixed(2)),
        takeProfit: Number(tp.toFixed(2)),
        reasoning: generateReasoning(), // Use rule-based reasoning
        confidence: Math.round(enhancedConfidence), // Use enhanced confidence
        timestamp: Date.now(),
        patternDetected: `RL-DQN: ${currentPattern}`,
        confluenceFactors: [`Enhanced Confidence: ${enhancedConfidence.toFixed(0)}%`, `Trend: ${indicators.trend}`, `RSI: ${indicators.rsi.toFixed(0)}`],
        riskRewardRatio: rr,
        outcome: 'PENDING'
    };
};

// Backwards compatibility alias
export const analyzeMarketWithLocalML = analyzeMarket; 


export const trainModel = (
    outcome: 'WIN' | 'LOSS', 
    type: 'BUY' | 'SELL', 
    candles: Candle[], 
    indicators: TechnicalIndicators,
    sentiment: number,
    pnl: number, 
    riskAmount: number,
    predictedConfidence?: number // NEW: Track predicted confidence
) => {
    const state = getMarketState(candles, indicators, sentiment);
    
    // Enhanced reward calculation
    let reward = 0;
    if (outcome === 'WIN') {
        const rr = Math.abs(pnl) / (riskAmount || 1);
        reward = 0.8 + (Math.min(rr, 3) * 0.1); // Base + bonus for high R:R
    } else {
        reward = 0.2; 
    }

    const actionIndex = type === 'BUY' ? 0 : 1;
    
    // Train Q-values
    brain.train(state, actionIndex, reward);
    
    // Update pattern memory
    brain.updatePatternMemory(state, actionIndex, outcome, pnl);
    
    // Increment training iterations
    brain.totalTrainingIterations++;
    
    // --- META-LEARNING INTEGRATION ---
    
    // 1. Record prediction for confidence calibration
    if (predictedConfidence !== undefined) {
        confidenceCalibrator.recordPrediction(predictedConfidence, outcome);
    }
    
    // 2. Update adaptive hyperparameters metrics
    const currentConfidence = brain.getEnhancedConfidence(state, actionIndex);
    adaptiveHyperparameters.updateMetrics(outcome, currentConfidence);
    
    // 3. Auto-optimize hyperparameters every 10 trades
    if (brain.totalTrainingIterations % 10 === 0) {
        adaptiveHyperparameters.optimize(brain);
    }
    
    // 4. Discover patterns every 20 trades
    if (brain.totalTrainingIterations % 20 === 0) {
        storageService.fetchTrainingDataFromSupabase().then(data => {
            if (data.length >= 10) {
                patternDiscovery.discoverPatterns(data);
            }
        });
    }
    
    // Decay Epsilon (Reduce exploration over time) - now handled by adaptive hyperparameters
    // if (brain.epsilon > 0.05) {
    //     brain.epsilon *= 0.995; 
    // }
    
    console.log(`[RL Training] Action: ${type} | Result: ${outcome} | Reward: ${reward.toFixed(2)} | PNL: ${pnl.toFixed(2)} | Iterations: ${brain.totalTrainingIterations} | Epsilon: ${brain.epsilon.toFixed(3)}`);};

// --- AI TUNING FUNCTIONS ---

export const updateLearningRate = (rate: number) => {
    brain.learningRate = rate;
    console.log(`[ML] Learning rate updated to ${rate}`);
};

export const updateEpsilon = (epsilon: number) => {
    brain.epsilon = epsilon;
    console.log(`[ML] Epsilon updated to ${epsilon}`);
};

export const resetModel = () => {
    // Reinitialize weights
    brain.weightsIH = Array(brain.hiddenNodes).fill(0).map(() => Array(brain.inputNodes).fill(0).map(() => Math.random() * 0.2 - 0.1));
    brain.weightsHO = Array(brain.outputNodes).fill(0).map(() => Array(brain.hiddenNodes).fill(0).map(() => Math.random() * 0.2 - 0.1));
    brain.biasH = Array(brain.hiddenNodes).fill(0).map(() => Math.random() * 0.2 - 0.1);
    brain.biasO = Array(brain.outputNodes).fill(0).map(() => Math.random() * 0.2 - 0.1);
    
    // Reset epsilon to tuned default
    brain.epsilon = 0.05; // Match the new optimized default
    
    // Clear saved weights
    storageService.saveModelWeights({
        weightsIH: brain.weightsIH,
        weightsHO: brain.weightsHO,
        biasH: brain.biasH,
        biasO: brain.biasO
    });
    
    console.log('[ML] Model reset to initial state');
};

export const exportWeights = () => {
    return {
        weightsIH: brain.weightsIH,
        weightsHO: brain.weightsHO,
        biasH: brain.biasH,
        biasO: brain.biasO,
        learningRate: brain.learningRate,
        epsilon: brain.epsilon,
        timestamp: new Date().toISOString()
    };
};

export const importWeights = (weights: any) => {
    if (weights.weightsIH && weights.weightsHO && weights.biasH && weights.biasO) {
        brain.weightsIH = weights.weightsIH;
        brain.weightsHO = weights.weightsHO;
        brain.biasH = weights.biasH;
        brain.biasO = weights.biasO;
        
        if (weights.learningRate) brain.learningRate = weights.learningRate;
        if (weights.epsilon) brain.epsilon = weights.epsilon;
        
        // Save to storage
        storageService.saveModelWeights({
            weightsIH: brain.weightsIH,
            weightsHO: brain.weightsHO,
            biasH: brain.biasH,
            biasO: brain.biasO
        });
        
        console.log('[ML] Weights imported successfully');
    } else {
        throw new Error('Invalid weights format');
    }
};

export const getModelStats = () => {
    const trainingData = storageService.getTrainingData();
    return {
        inputNodes: brain.inputNodes,
        hiddenNodes: brain.hiddenNodes,
        outputNodes: brain.outputNodes,
        learningRate: brain.learningRate,
        epsilon: brain.epsilon,
        discountFactor: brain.discountFactor,
        trainingCount: trainingData.length
    };
};// Batch Training Functions for mlService.ts
// Add these to the end of mlService.ts file

// --- BATCH TRAINING SYSTEM ---

export const calculateAverageConfidence = (): number => {
    if (brain.patternMemory.size === 0) return 50;
    
    let totalConf = 0;
    let count = 0;
    
    for (const memory of brain.patternMemory.values()) {
        const trades = memory.winCount + memory.lossCount;
        if (trades >= 3) { // Only count patterns with enough data
            totalConf += memory.confidence;
            count++;
        }
    }
    
    return count > 0 ? totalConf / count : 50;
};

export const getPatternStats = () => {
    return {
        totalPatterns: brain.patternMemory.size,
        avgConfidence: calculateAverageConfidence(),
        totalTrades: brain.totalTrainingIterations,
        patterns: Array.from(brain.patternMemory.values())
            .filter(m => (m.winCount + m.lossCount) >= 3)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 10)
    };
};

export const batchTrainFromHistory = (
    trainingData: TrainingData[],
    onProgress?: (current: number, total: number, confidence: number) => void
): { totalTrained: number; avgConfidence: number; patternCount: number } => {
    console.log(`[Batch Training] 🚀 Starting with ${trainingData.length} historical trades...`);
    
    let totalTrained = 0;
    
    for (let i = 0; i < trainingData.length; i++) {
        const trade = trainingData[i];
        
        if (!trade.outcome || !trade.pattern) continue;
        
        const mockState = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
        const action = trade.pattern.toLowerCase().includes('buy') ? 0 : 1;
        const outcome = trade.outcome;
        const pnl = trade.riskReward || 0;
        const reward = outcome === 'WIN' ? 0.8 + (Math.min(Math.abs(pnl), 3) * 0.1) : 0.2;
        
        brain.train(mockState, action, reward);
        brain.updatePatternMemory(mockState, action, outcome, pnl);
        brain.totalTrainingIterations++;
        
        totalTrained++;
        
        if (onProgress && (i + 1) % 5 === 0) {
            onProgress(i + 1, trainingData.length, calculateAverageConfidence());
        }
    }
    
    brain.save();
    
    const avgConfidence = calculateAverageConfidence();
    console.log(`[Batch Training] ✅ Trained: ${totalTrained}, Confidence: ${avgConfidence.toFixed(1)}%`);
    
    return { totalTrained, avgConfidence, patternCount: brain.patternMemory.size };
};

export const trainUntilConfident = async (
    targetConfidence: number = 90,
    maxIterations: number = 50,
    onProgress?: (iteration: number, confidence: number) => void
): Promise<{ success: boolean; finalConfidence: number; iterations: number }> => {
    console.log(`[Iterative Training] 🎯 Target: ${targetConfidence}%`);
    
    const trainingData = await storageService.fetchTrainingDataFromSupabase();
    
    if (trainingData.length === 0) {
        console.warn('[Iterative Training] ❌ No training data');
        return { success: false, finalConfidence: 50, iterations: 0 };
    }
    
    let iteration = 0;
    let currentConfidence = calculateAverageConfidence();
    let noImprovementCount = 0;
    let previousConfidence = currentConfidence;
    
    while (currentConfidence < targetConfidence && iteration < maxIterations) {
        iteration++;
        batchTrainFromHistory(trainingData);
        currentConfidence = calculateAverageConfidence();
        
        if (onProgress) onProgress(iteration, currentConfidence);
        
        console.log(`[Iteration ${iteration}] Confidence: ${currentConfidence.toFixed(1)}%`);
        
        if (currentConfidence <= previousConfidence + 0.5) {
            noImprovementCount++;
        } else {
            noImprovementCount = 0;
        }
        
        if (noImprovementCount >= 5) {
            console.warn('[Iterative Training] ⚠️ No improvement. Stopping.');
            break;
        }
        
        previousConfidence = currentConfidence;
    }
    
    brain.save();
    
    console.log(`[Iterative Training] ✅ Final: ${currentConfidence.toFixed(1)}%`);
    
    return {
        success: currentConfidence >= targetConfidence,
        finalConfidence: currentConfidence,
        iterations: iteration
    };
};
// Meta-Learning Test & Comparison System
// Add to end of mlService.ts

// Export meta-learning stats
export const getMetaLearningStats = () => {
    return {
        confidenceCalibration: confidenceCalibrator.getStats(),
        adaptiveMetrics: adaptiveHyperparameters.getMetrics(),
        discoveredPatterns: patternDiscovery.getPatterns(),
        currentHyperparameters: {
            learningRate: brain.learningRate,
            epsilon: brain.epsilon,
            totalIterations: brain.totalTrainingIterations
        }
    };
};

// Apply calibrated confidence to predictions
export const getCalibratedConfidence = (rawConfidence: number): number => {
    return confidenceCalibrator.getCalibratedConfidence(rawConfidence);
};

// Test meta-learning impact
export const testMetaLearningImpact = async () => {
    console.log('='.repeat(60));
    console.log('META-LEARNING IMPACT TEST');
    console.log('='.repeat(60));
    
    const trainingData = await storageService.fetchTrainingDataFromSupabase();
    
    if (trainingData.length < 20) {
        console.warn('⚠️ Need at least 20 trades for meaningful test');
        return;
    }
    
    console.log(`\n📊 Testing with ${trainingData.length} historical trades\n`);
    
    // Test 1: Confidence Calibration
    console.log('1️⃣ CONFIDENCE CALIBRATION TEST');
    console.log('-'.repeat(40));
    const calibStats = confidenceCalibrator.getStats();
    console.log(`Total predictions tracked: ${calibStats.totalPredictions}`);
    console.log('Calibration curve:');
    calibStats.calibrationCurve.forEach(([predicted, actual]) => {
        console.log(`  ${predicted}-${predicted+20}% predicted → ${actual.toFixed(1)}% actual`);
    });
    
    // Test 2: Adaptive Hyperparameters
    console.log('\n2️⃣ ADAPTIVE HYPERPARAMETERS TEST');
    console.log('-'.repeat(40));
    const metrics = adaptiveHyperparameters.getMetrics();
    console.log(`Recent win rate: ${(metrics.recentWinRate * 100).toFixed(1)}%`);
    console.log(`Avg confidence: ${metrics.avgConfidence.toFixed(1)}%`);
    console.log(`Learning progress: ${metrics.learningProgress.toFixed(2)}`);
    console.log(`Current LR: ${brain.learningRate.toFixed(4)}`);
    console.log(`Current Epsilon: ${brain.epsilon.toFixed(3)}`);
    
    // Test 3: Pattern Discovery
    console.log('\n3️⃣ PATTERN DISCOVERY TEST');
    console.log('-'.repeat(40));
    const patterns = patternDiscovery.discoverPatterns(trainingData);
    console.log(`Patterns discovered: ${patterns.length}`);
    patterns.forEach((p, i) => {
        console.log(`  ${i+1}. ${p.name}`);
        console.log(`     Trades: ${p.tradeCount}, Win Rate: ${(p.winRate * 100).toFixed(0)}%, Avg PNL: ${p.avgPnl.toFixed(2)}`);
    });
    
    // Test 4: Overall Impact
    console.log('\n4️⃣ OVERALL IMPACT');
    console.log('-'.repeat(40));
    const avgConf = calculateAverageConfidence();
    const patternStats = getPatternStats();
    console.log(`Average confidence: ${avgConf.toFixed(1)}%`);
    console.log(`Total patterns learned: ${patternStats.totalPatterns}`);
    console.log(`Total training iterations: ${brain.totalTrainingIterations}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ META-LEARNING TEST COMPLETE');
    console.log('='.repeat(60));
    
    return {
        calibration: calibStats,
        adaptive: metrics,
        patterns: patterns,
        overall: {
            avgConfidence: avgConf,
            totalPatterns: patternStats.totalPatterns,
            iterations: brain.totalTrainingIterations
        }
    };
};
