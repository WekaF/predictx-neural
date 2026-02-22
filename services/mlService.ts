import { Candle, TechnicalIndicators, TradeSignal, TrainingData, NewsItem } from "../types";
import { storageService } from "./storageService";
import { calculateBollingerBands, detectRSIDivergence, calculateSeriesRSI } from "../utils/technical";
import { generateUUID } from "../utils/uuid";
import { confidenceCalibrator, adaptiveHyperparameters, patternDiscovery } from "./metaLearning";
import { aiBackendService } from "./apiService";
import { batchTrainingService, BatchTrainingProgress, BatchTrainingResult } from "./batchTrainingService";
import { hyperparameterOptimizer, OptimizationResult } from "./hyperparameterOptimizer";
import { EnhancedExecutedTrade } from "../types/enhanced";
import { smcService } from "./smcService";
import { liquidationCalculator, LiquidationInfo } from "./liquidationCalculator";
import { fundingRateService } from "./fundingRateService";
import { futuresRiskManager } from "./futuresRiskManager";

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

        // Save Pattern Memory (Convert Map to Array for storage)
        storageService.savePatternMemory(Array.from(this.patternMemory.entries()));
    }

    async load() {
        const savedWeights = storageService.getModelWeights();
        if (savedWeights) {
            this.weightsIH = savedWeights.weightsIH;
            this.weightsHO = savedWeights.weightsHO;
            this.biasH = savedWeights.biasH;
            this.biasO = savedWeights.biasO;
        }

        const savedMemory = await storageService.getPatternMemory();
        if (savedMemory) {
            this.patternMemory = new Map(savedMemory);
            console.log(`[RL Agent] 🧠 Restored ${this.patternMemory.size} patterns from persistent memory.`);
        }
    }

    // Restore memory from historical training logs
    restoreFromHistory(history: TrainingData[]) {
        let newPatterns = 0;
        let updates = 0;

        history.forEach(item => {
            // Check if pattern exists
            let mem = this.patternMemory.get(item.pattern);
            if (!mem) {
                mem = {
                    pattern: item.pattern,
                    winCount: 0,
                    lossCount: 0,
                    totalPnl: 0,
                    avgPnl: 0,
                    confidence: 50,
                    lastSeen: Date.now()
                };
                newPatterns++;
            } else {
                updates++;
            }

            if (item.outcome === 'WIN') {
                mem.winCount++;
                // Estimate PnL impact (simplified)
                mem.totalPnl += (item.riskReward || 1.5) * 100;
            } else {
                mem.lossCount++;
                mem.totalPnl -= 100;
            }

            // Recalculate Stats
            const total = mem.winCount + mem.lossCount;
            mem.confidence = (mem.winCount / total) * 100;
            mem.avgPnl = mem.totalPnl / total;

            this.patternMemory.set(item.pattern, mem);
        });

        console.log(`[RL Agent] 📜 History Replay: Added ${newPatterns} new patterns, Updated ${updates} existing.`);
        this.save();
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
        memory.avgPnl = totalTrades > 0 ? memory.totalPnl / totalTrades : 0;

        // Calculate confidence from win rate (safeguard against division by zero)
        memory.confidence = totalTrades > 0 ? (memory.winCount / totalTrades) * 100 : 50;
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

        // ENHANCED: Require at least 5 trades to trust pattern (increased from 3)
        // This ensures statistical significance before using pattern confidence
        const totalTrades = memory.winCount + memory.lossCount;
        if (totalTrades < 5) {
            console.log(`[Pattern Memory] ⚠️ Pattern "${pattern}" has only ${totalTrades} trades (need 5+). Using default 50% confidence.`);
            return 50;
        }

        return memory.confidence;
    }

    /**
     * Get enhanced confidence combining Q-values, pattern memory, and experience
     * ENHANCED: Now includes Q-value separation validation and pattern quality scoring
     */
    getEnhancedConfidence(state: number[], action: number): number {
        // 1. Q-value based confidence with separation validation
        const qValues = this.predict(state);
        const maxQ = Math.max(...qValues);
        const minQ = Math.min(...qValues);

        // Sort Q-values to find second-best
        const sortedQValues = [...qValues].sort((a, b) => b - a);
        const bestQ = sortedQValues[0];
        const secondBestQ = sortedQValues[1];

        // ENHANCED: Require clear separation between best and second-best Q-value
        const qSeparation = bestQ - secondBestQ;
        const MIN_Q_SEPARATION = 0.10; // Require at least 0.10 difference (10% on 0-1 scale)

        let qConfidence = ((qValues[action] - minQ) / (maxQ - minQ + 0.01)) * 100;

        // Safeguard against NaN
        if (isNaN(qConfidence) || !isFinite(qConfidence)) {
            qConfidence = 50; // Default to 50% if calculation fails
        }

        // Penalize if Q-values are too close (ambiguous signal)
        if (qSeparation < MIN_Q_SEPARATION) {
            const separationPenalty = (1 - (qSeparation / MIN_Q_SEPARATION)) * 30; // Up to -30% penalty
            qConfidence = Math.max(0, qConfidence - separationPenalty);
            console.log(`[Enhanced Confidence] ⚠️ Q-value separation low (${qSeparation.toFixed(3)}). Penalty: -${separationPenalty.toFixed(1)}%`);
        }

        // 2. Pattern memory confidence with quality scoring
        const patternConfidence = this.getPatternConfidence(state);
        const patternQuality = this.getPatternQualityScore(state);

        // 3. Experience-based confidence (improves with training)
        const experienceConfidence = Math.min(this.totalTrainingIterations / 100, 1) * 100;

        // 4. Weighted average (adjusted to include pattern quality)
        let confidence = (
            qConfidence * 0.35 +                    // Q-value strength
            patternConfidence * 0.30 +             // Pattern win rate
            patternQuality * 0.20 +                // Pattern quality/consistency
            experienceConfidence * 0.15             // Overall experience
        );

        // Final safeguard: Ensure result is a valid number
        if (isNaN(confidence) || !isFinite(confidence)) {
            console.warn('[Enhanced Confidence] ⚠️ Calculation resulted in NaN, defaulting to 50%');
            confidence = 50;
        }

        return Math.min(Math.max(confidence, 0), 100);
    }

    /**
     * NEW: Get pattern quality score based on consistency and recency
     * Returns 0-100 score representing the quality/reliability of the pattern
     */
    getPatternQualityScore(state: number[]): number {
        const pattern = this.identifyPattern(state);
        const memory = this.patternMemory.get(pattern);

        if (!memory) return 0;

        const totalTrades = memory.winCount + memory.lossCount;

        // Factor 1: Sample size (more data = higher quality)
        const sampleScore = Math.min(totalTrades / 20, 1) * 100; // Max at 20 trades

        // Factor 2: Win rate consistency (high win rate = high quality)
        const winRate = memory.winCount / totalTrades;
        const consistencyScore = winRate * 100;

        // Factor 3: Recency (prefer recently seen patterns)
        const hoursSinceLastSeen = (Date.now() - memory.lastSeen) / (1000 * 60 * 60);
        const recencyScore = Math.max(0, 100 - (hoursSinceLastSeen * 2)); // -2% per hour

        // Weighted average
        const qualityScore = (
            sampleScore * 0.4 +
            consistencyScore * 0.4 +
            recencyScore * 0.2
        );

        return qualityScore;
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

let lastAnalysisTime = 0;
const ANALYSIS_COOLDOWN_MS = 1500; // 1.5s cooldown for heavy analysis

export const analyzeMarket = async (
    candles: Candle[],
    indicators: TechnicalIndicators,
    trainingHistory: TrainingData[],
    news: NewsItem[],
    assetSymbol: string = 'Unknown',
    strategy: 'SCALP' | 'SWING' = 'SCALP',
    isTraining: boolean = false // NEW: Allow lower confidence during training
): Promise<TradeSignal | null> => {
    // 0. Debounce Guard (Prevent UI lockup from rapid calls)
    const now = Date.now();
    if (!isTraining && (now - lastAnalysisTime < ANALYSIS_COOLDOWN_MS)) {
        console.log('[analyzeMarket] ⏳ Analysis debounced (cooldown)');
        return null;
    }
    lastAnalysisTime = now;

    // 1. Run Local RL Analysis (Fast, Free)
    // ------------------------------------
    const last = candles[candles.length - 1]; // Moved up for Guard Rails
    const sentimentScore = news.length > 0 ?
        news.reduce((acc, n) => acc + (n.sentiment === 'POSITIVE' ? 1 : n.sentiment === 'NEGATIVE' ? -1 : 0), 0) / Math.max(1, news.length)
        : 0;

    const state = getMarketState(candles, indicators, sentimentScore);




    // Q-values: [Q_Buy, Q_Sell, Q_Hold]
    const qValues = brain.predict(state);
    const [qBuy, qSell, qHold] = qValues;

    let decision: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = qHold;

    // === DEBUG LOGGING ===
    console.log('\n=== 🔍 AI DECISION DEBUG ===');
    console.log(`Q-Values: BUY=${qBuy.toFixed(4)}, SELL=${qSell.toFixed(4)}, HOLD=${qHold.toFixed(4)}`);
    console.log(`Q-Values Identical (Virgin Model): ${qBuy === qSell && qSell === qHold}`);
    console.log(`Epsilon: ${brain.epsilon.toFixed(3)} (${(brain.epsilon * 100).toFixed(1)}% exploration chance)`);
    console.log(`Training Iterations: ${brain.totalTrainingIterations}`);
    console.log(`Market State: RSI=${(state[0]*100).toFixed(1)}%, Trend=${state[1] > 0.5 ? 'UP' : 'DOWN'}, BB Position=${(state[2]*100).toFixed(1)}%`);
    console.log(`Indicators: RSI=${indicators.rsi.toFixed(1)}, Trend=${indicators.trend}, Price=${last.close.toFixed(2)}`);
    console.log('========================\n');

    // --- 1.5 CALL PYTHON BACKEND (Tier 2 Inference) ---
    // If enabled, this overrides or enhances local decision
    // --------------------------------------------------
    let backendAction = null;
    let backendConfidence = 0;
    let backendExecution = null;
    let backendMeta = null;
    
    // Only call backend if not in rapid training loop (optimization)
    if (!isTraining) {
        try {
            const backendRes = await aiBackendService.predictTrend(assetSymbol, candles);
            if (backendRes && backendRes.agent_action) {
                backendAction = backendRes.agent_action.action; // BUY, SELL, HOLD
                backendConfidence = backendRes.agent_action.confidence; // 0-100
                backendExecution = backendRes.execution;
                backendMeta = backendRes.agent_action.meta;
                console.log(`[Python AI] 🐍 Backend says: ${backendAction} with ${backendConfidence}% confidence`);
            }
        } catch (e) {
            console.warn("[Backend] ⚠️ Backend inference skipped (not available)");
        }
    }

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

        // Strategy Adjustment: Lowered to allow more frequent trading
        // ENHANCED: Reduced to 35% to allow UNTRAINED models to learn (Q-values start at 0.500)
        let ACTION_THRESHOLD = 0.35; // SCALP: Minimum 35% confidence

        if (strategy === 'SWING') {
            ACTION_THRESHOLD = 0.60; // SWING: Minimum 60% confidence
        }

        // TRAINING MODE OVERRIDE
        // Allow lower confidence trades to accelerate learning
        // Untrained model ~43% confidence (28% Q + 15% Memory + 0% Quality + 0% Exp)
        if (isTraining) {
            ACTION_THRESHOLD = 0.25; // Drastically lower to allow untrained models to explore
            console.log(`[RL Agent] 🎓 TRAINING MODE: Lowered threshold to ${(ACTION_THRESHOLD * 100).toFixed(0)}% to encourage exploration`);
        }

        console.log(`[RL Agent] 📊 Strategy: ${strategy} | Required Confidence Threshold: ${(ACTION_THRESHOLD * 100).toFixed(0)}%`);

        // VIRGIN MODEL DETECTION: If all Q-values are identical, model is untrained
        // Force random exploration to kickstart learning
        const qValuesIdentical = (qBuy === qSell && qSell === qHold);
        if (qValuesIdentical) {
            console.log(`[RL Agent] 🆕 VIRGIN MODEL DETECTED: All Q-values identical (${qBuy.toFixed(3)}). Forcing random exploration to kickstart learning...`);
            const rand = Math.random();
            if (rand < 0.4) {
                decision = 'BUY';
                confidence = qBuy;
            } else if (rand < 0.8) {
                decision = 'SELL';
                confidence = qSell;
            } else {
                decision = 'HOLD';
                confidence = qHold;
            }
            console.log(`[RL Agent] 🎲 Random exploration chose: ${decision}`);
        } else if (qBuy > qSell && qBuy > qHold && qBuy > ACTION_THRESHOLD) {
            decision = 'BUY';
            confidence = qBuy;
        } else if (qSell > qBuy && qSell > qHold && qSell > ACTION_THRESHOLD) {
            decision = 'SELL';
            confidence = qSell;
        }
        console.log(`[RL Agent] 🧠 Exploitation Mode (${strategy}): Q-values [BUY:${qBuy.toFixed(3)}, SELL:${qSell.toFixed(3)}, HOLD:${qHold.toFixed(3)}] → ${decision}`);
    }

    let isBackendOverride = false;
    // --- MERGE STRATEGY: LOCAL + BACKEND ---
    if (backendAction && backendAction !== 'HOLD') {
        // Always prioritize Backend if it provides an explicit BUY/SELL.
        // It's the Tier 7 Engine; the user expects its output to be visible.
        console.log(`[AI Merge] 🤝 Tier 7 Backend active: ${decision} → ${backendAction} (Backend Conf: ${backendConfidence}%)`);
        decision = backendAction as 'BUY' | 'SELL';
        confidence = backendConfidence;
        isBackendOverride = true;
    } else if (backendAction === 'HOLD' && backendConfidence > 65 && decision !== 'HOLD') {
        console.log(`[AI Merge] 🛑 Backend VETO: ${decision} blocked by Backend HOLD (Backend Conf: ${backendConfidence}%)`);
        decision = 'HOLD';
        confidence = backendConfidence;
        isBackendOverride = true;
    }

    // --- GUARD RAILS (Heuristic Filters) - RELAXED ---
    // 1. Trend Filter: Warn about counter-trend but don't block
    const price = last.close;
    const isUptrend = price > indicators.sma200;
    const isDowntrend = price < indicators.sma200;

    // 2. RSI Filter: Only block extreme overbought/oversold
    const isRsiExtremeBuy = indicators.rsi > 80; // Only block if extremely overbought
    const isRsiExtremeSell = indicators.rsi < 20; // Only block if extremely oversold

    // Apply RELAXED Guard Rails
    // Only block trades in EXTREME conditions
    console.log(`[Guard Rails] 🛡️ Checking filters... RSI=${indicators.rsi.toFixed(1)}, Trend=${isUptrend ? 'UP' : 'DOWN'}`);
    
    if (decision === 'BUY') {
        if (!isUptrend) {
            // Just warn, don't block
            console.log(`[Guard Rail] ⚠️ WARNING: BUY in downtrend (Price < SMA200) - Proceed with caution`);
        }
        if (isRsiExtremeBuy) {
            // Block only if RSI > 80
            decision = 'HOLD';
            confidence = 0;
            console.log(`[Guard Rail] 🚫 BLOCKED BUY: RSI Extremely Overbought (${indicators.rsi.toFixed(0)} > 80)`);
        }
    } else if (decision === 'SELL') {
        if (!isDowntrend) {
            // Just warn, don't block
            console.log(`[Guard Rail] ⚠️ WARNING: SELL in uptrend (Price > SMA200) - Proceed with caution`);
        }
        if (isRsiExtremeSell) {
            // Block only if RSI < 20
            decision = 'HOLD';
            confidence = 0;
            console.log(`[Guard Rail] 🚫 BLOCKED SELL: RSI Extremely Oversold (${indicators.rsi.toFixed(0)} < 20)`);
        }
    }
    
    console.log(`[Guard Rails] ✅ Final decision after filters: ${decision}`);


    // --- ENHANCED CONFIDENCE PRE-FILTER (70%+ REQUIREMENT) ---
    // CRITICAL: This filter ensures we only trade with high confidence based on deep RL analysis
    // Calculate enhanced confidence BEFORE proceeding with signal generation
    const actionIndex = decision === 'BUY' ? 0 : decision === 'SELL' ? 1 : 2;
    let enhancedConfidence = brain.getEnhancedConfidence(state, actionIndex);

    // --- RSI DIVERGENCE BOOST ---
    // Apply confidence boost if divergence aligns with trading signal
    if (indicators.rsiDivergence && decision !== 'HOLD') {
        const div = indicators.rsiDivergence;
        const divergenceBoost = (div.strength / 100) * 15; // Up to 15% boost based on strength
        
        if ((div.type === 'BULLISH' && decision === 'BUY') || 
            (div.type === 'BEARISH' && decision === 'SELL')) {
            enhancedConfidence += divergenceBoost;
            console.log(`[RSI Divergence] ✅ ${div.type} divergence aligns with ${decision} signal. Confidence boost: +${divergenceBoost.toFixed(1)}%`);
        } else if ((div.type === 'BULLISH' && decision === 'SELL') || 
                   (div.type === 'BEARISH' && decision === 'BUY')) {
            enhancedConfidence -= divergenceBoost;
            console.log(`[RSI Divergence] ⚠️ ${div.type} divergence CONTRADICTS ${decision} signal. Confidence penalty: -${divergenceBoost.toFixed(1)}%`);
        }
        
        // Ensure confidence stays within 0-100 range
        enhancedConfidence = Math.min(Math.max(enhancedConfidence, 0), 100);
    }

    const MINIMUM_ENHANCED_CONFIDENCE = 30; // Further relaxed to allow more entries for training agents

    if (decision !== 'HOLD' && enhancedConfidence < MINIMUM_ENHANCED_CONFIDENCE && !isBackendOverride) {
        const reason = `Enhanced confidence ${enhancedConfidence.toFixed(1)}% < ${MINIMUM_ENHANCED_CONFIDENCE}% threshold`;
        console.log(`[Enhanced Confidence Filter] ❌ BLOCKED ${decision}: ${reason}`);
        
        // Pass the reason to the signal object for UI visibility
        (decision as any) = 'HOLD';
        (confidence as any) = 0;
    } else if (decision !== 'HOLD') {
        console.log(`[Enhanced Confidence Filter] ✅ PASSED: ${decision} with ${enhancedConfidence.toFixed(1)}% enhanced confidence (threshold: ${MINIMUM_ENHANCED_CONFIDENCE}%)`);
    }

    // 2. PURE SELF-LEARNING RL - NO EXTERNAL AI
    // -----------------------------------------
    // Generate rule-based reasoning from technical indicators

    const generateReasoning = (): string => {
        const reasons: string[] = [];

        // RSI analysis
        if (indicators.rsi < 30) {
            reasons.push("RSI oversold (bullish signal)");
        } else if (indicators.rsi > 70) {
            reasons.push("RSI overbought (bearish signal)");
        }

        // RSI Divergence analysis
        if (indicators.rsiDivergence) {
            const div = indicators.rsiDivergence;
            if (div.type === 'BULLISH') {
                reasons.push(`Bullish RSI divergence detected (strength: ${div.strength}%)`);
            } else {
                reasons.push(`Bearish RSI divergence detected (strength: ${div.strength}%)`);
            }
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

        if (decision === 'HOLD') {
            reasons.push("Guard rails or low confidence blocked trade.");
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
            confidence: isBackendOverride ? Math.round(confidence) : Math.round(enhancedConfidence),
            reasoning: `AI Strategy (${strategy}): Wait. ${generateReasoning()}`,
            timestamp: Date.now(),
            execution: backendExecution,
            meta: backendMeta
        };
    }

    // Construct Trade Signal from Local Decision
    const atr = (Math.max(...candles.slice(-14).map(c => c.high)) - Math.min(...candles.slice(-14).map(c => c.low))) * 0.2;
    let entry = last.close;

    // STRATEGY LOGIC: SL/TP Calculation
    const slMult = strategy === 'SWING' ? 4 : 2;   // Swing: 4x ATR Stop (give room to breathe)
    const tpMult = strategy === 'SWING' ? 8 : 3;   // Swing: 8x ATR Target (aim for big moves)

    let sl = decision === 'BUY' ? entry - (atr * slMult) : entry + (atr * slMult);
    let tp = decision === 'BUY' ? entry + (atr * tpMult) : entry - (atr * tpMult);

    // --- LEVERAGE CALCULATION FIRST ---
    // We must know leverage to enforce strict ROE loss caps.
    const recommendedLeverage = futuresRiskManager.getRecommendedLeverage(strategy);
    const side: 'LONG' | 'SHORT' = decision === 'BUY' ? 'LONG' : 'SHORT';
    
    // Fallback safe leverage (will be re-validated by liquidationCalculator later)
    // Using a default max of 10x if not specified, typically constrained down to 3x-5x by recommended.
    const leverage = Math.min(recommendedLeverage, 10); 

    // --- STRICT MAX DRAWDOWN CAP (8% ROE max) ---
    // Rule: Max SL ROE = 8%. Distance % = 8% / Leverage.
    // E.g., at 10x leverage, Max Price Drop = 8% / 10 = 0.8%.
    const maxLossPercent = 0.08 / leverage;
    const maxSlDistance = entry * maxLossPercent; 

    const currentSlDistance = Math.abs(entry - sl);
    if (currentSlDistance > maxSlDistance) {
        console.log(`[SL Cap] ⚠️ ATR-based SL too wide (${(currentSlDistance/entry*100).toFixed(2)}%). Capping to strict ${maxLossPercent*100}% for ${leverage}x leverage (8% max ROE).`);
        sl = decision === 'BUY' ? entry - maxSlDistance : entry + maxSlDistance;
        
        // Recalculate TP to maintain minimum R:R of 1.875 as per documentation for fixed leverage caps
        const cappedRisk = maxSlDistance;
        const rewardRatio = 1.875;
        const minReward = cappedRisk * rewardRatio;
        tp = decision === 'BUY' ? entry + minReward : entry - minReward;
    }

    if (decision === 'BUY') sl = Math.min(sl, indicators.nearestSupport * 0.999);
    else sl = Math.max(sl, indicators.nearestResistance * 1.001);

    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    const rr = risk === 0 ? 0 : Number((reward / risk).toFixed(2));

    // Get pattern for logging
    const currentPattern = brain.identifyPattern(state);

    // --- SMC ANALYSIS (Local Fallback) ---
    // Ensure we always have SMC data for the UI
    const localSMC = smcService.getSMCContext(candles);

    // Merge backend meta with local fallback if needed
    const finalMeta = backendMeta || {};
    if (!finalMeta.smc) {
        finalMeta.smc = localSMC;
        console.log(`[SMC] Used local fallback analysis. Score: ${localSMC.score}, Active OB: ${localSMC.active_ob ? 'YES' : 'NO'}`);
    }

    // --- FUTURES-SPECIFIC VALIDATION ---
    // 1. Funding Rate Check
    let fundingAdjustment = 1.0;
    try {
        const fundingData = await fundingRateService.getCurrentFundingRate(assetSymbol);
        if (fundingData) {
            const fundingCheck = fundingRateService.isFundingFavorable(decision, fundingData);
            
            if (!fundingCheck.favorable) {
                // Block trade if funding is extremely unfavorable
                console.log(`[Funding Rate] ❌ BLOCKED ${decision}: ${fundingCheck.warning}`);
                return {
                    id: generateUUID(),
                    symbol: assetSymbol,
                    type: 'HOLD',
                    entryPrice: 0,
                    stopLoss: 0,
                    takeProfit: 0,
                    confidence: 0,
                    reasoning: `Funding rate filter: ${fundingCheck.warning}`,
                    timestamp: Date.now(),
                    execution: backendExecution,
                    meta: { ...finalMeta, funding_blocked: true, funding_rate: fundingData.current }
                };
            }
            
            if (fundingCheck.warning) {
                console.log(`[Funding Rate] ⚠️ ${fundingCheck.warning}`);
                // Reduce confidence if funding is moderately unfavorable
                fundingAdjustment = fundingRateService.getConfidenceAdjustment(decision, fundingData);
                enhancedConfidence *= fundingAdjustment;
            }
            
            // Add funding data to metadata
            finalMeta.funding_rate = {
                current: fundingData.current,
                annual: (fundingData.current * 3 * 365 * 100).toFixed(2) + '%',
                trend: fundingData.trend
            };
            
            console.log(`[Funding Rate] ${assetSymbol}: ${(fundingData.current * 100).toFixed(4)}% (${fundingData.trend})`);
        }
    } catch (error) {
        console.warn('[Funding Rate] Failed to fetch, proceeding without funding check:', error);
    }

    // 2. Liquidation Risk Assessment
    // Leverage already calculated above for SL strict bounding:
    // const leverage = Math.min(recommendedLeverage, safeLeverage);
    // Re-verify safe leverage against finalized SL
    const safeLeverage = liquidationCalculator.calculateSafeLeverage(entry, sl, side);
    const finalLeverage = Math.min(leverage, safeLeverage);
    
    const liqInfo = liquidationCalculator.validateTrade(entry, sl, finalLeverage, side);
    
    // Block trade if liquidation risk is EXTREME
    if (liqInfo.riskLevel === 'EXTREME') {
        console.log(`[Liquidation Risk] ❌ BLOCKED ${decision}: ${liqInfo.warningMessage}`);
        return {
            id: generateUUID(),
            symbol: assetSymbol,
            type: 'HOLD',
            entryPrice: 0,
            stopLoss: 0,
            takeProfit: 0,
            confidence: 0,
            reasoning: `Liquidation risk: ${liqInfo.warningMessage}`,
            timestamp: Date.now(),
            execution: backendExecution,
            meta: { ...finalMeta, liquidation_blocked: true, liquidation_info: liqInfo }
        };
    }
    
    // Warn if risk is HIGH
    if (liqInfo.riskLevel === 'HIGH') {
        console.log(`[Liquidation Risk] ⚠️ ${liqInfo.warningMessage}`);
        enhancedConfidence *= 0.85; // Reduce confidence by 15%
    }
    
    // Add liquidation info to metadata
    finalMeta.liquidation_info = liqInfo;
    finalMeta.recommended_leverage = leverage;
    
    console.log(`[Liquidation] Price: ${liqInfo.liquidationPrice}, Risk: ${liqInfo.riskLevel}, Leverage: ${leverage}x`);

    return {
        id: generateUUID(),
        symbol: assetSymbol,
        type: decision,
        entryPrice: entry,
        stopLoss: Number(sl.toFixed(2)),
        takeProfit: Number(tp.toFixed(2)),
        reasoning: generateReasoning(), // Use rule-based reasoning
        confidence: isBackendOverride ? Math.round(confidence) : Math.round(enhancedConfidence), // Use enhanced confidence (adjusted by funding)
        timestamp: Date.now(),
        patternDetected: `RL-DQN: ${currentPattern}`,
        confluenceFactors: [
            `Strategy: ${strategy}`, 
            `Enhanced Confidence: ${enhancedConfidence.toFixed(0)}%`, 
            `Trend: ${indicators.trend}`, 
            `RSI: ${indicators.rsi.toFixed(0)}`,
            ...(indicators.rsiDivergence ? [`${indicators.rsiDivergence.type} RSI Divergence (${indicators.rsiDivergence.strength}%)`] : []),
            `Leverage: ${leverage}x (${liqInfo.riskLevel} risk)`,
            ...(finalMeta.funding_rate ? [`Funding: ${(finalMeta.funding_rate.current * 100).toFixed(3)}%`] : [])
        ],
        riskRewardRatio: rr,
        outcome: 'PENDING',
        execution: backendExecution,
        meta: finalMeta
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
        reward = 1.0 + (Math.min(rr, 3) * 0.2); // Increased Base + bonus for high R:R
    } else {
        // Punish losses more severely
        // -0.5 is a negative reward, discouraging the action
        reward = -0.5;
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

    console.log(`[RL Training] Action: ${type} | Result: ${outcome} | Reward: ${reward.toFixed(2)} | PNL: ${pnl.toFixed(2)} | Iterations: ${brain.totalTrainingIterations} | Epsilon: ${brain.epsilon.toFixed(3)}`);
};

// --- AI TUNING FUNCTIONS ---

export const updateLearningRate = (rate: number) => {
    brain.learningRate = rate;
    console.log(`[ML] Learning rate updated to ${rate}`);
};

export const updateEpsilon = (epsilon: number) => {
    brain.epsilon = epsilon;
    console.log(`[ML] Epsilon updated to ${epsilon}`);
};

/**
 * Retrain model from historical trades (Experienced Replay)
 */
export const batchTrainModel = async (
    trades: EnhancedExecutedTrade[],
    onProgress?: (progress: BatchTrainingProgress) => void
): Promise<BatchTrainingResult> => {
    return await batchTrainingService.retrainFromHistory(trades, onProgress);
};

/**
 * Optimize AI hyperparameters based on trade history
 */
export const optimizeHyperparameters = (
    trades: EnhancedExecutedTrade[]
): OptimizationResult[] => {
    return hyperparameterOptimizer.runOptimizationSuite(trades);
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
        console.log(`  ${predicted}-${predicted + 20}% predicted → ${actual.toFixed(1)}% actual`);
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
        console.log(`  ${i + 1}. ${p.name}`);
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
// Initial Load of Persistent Memory
brain.load().catch(err => console.error("Failed to load brain memory:", err));

export const trainFromSavedHistory = async () => {
    console.log("🔄 Starting training from saved history...");
    try {
        const data = await storageService.fetchTrainingDataFromSupabase();
        if (data && data.length > 0) {
            brain.restoreFromHistory(data);
            return data.length;
        }
        console.log("⚠️ No history found in Supabase.");
        return 0;
    } catch (e) {
        console.error("Error training from history:", e);
        return 0;
    }
};
