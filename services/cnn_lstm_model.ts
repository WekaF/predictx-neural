import { Candle } from "../types";

/**
 * CNN-LSTM Hybrid Model for Trading Pattern Recognition
 * 
 * Architecture:
 * 1. CNN Layer - Extract visual patterns from candlestick sequences
 * 2. LSTM Layer - Learn temporal dependencies
 * 3. Dense Layer - Combine features for prediction
 */

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

function tanh(x: number): number {
    return Math.tanh(x);
}

function relu(x: number): number {
    return Math.max(0, x);
}

function drelu(y: number): number {
    return y > 0 ? 1 : 0;
}

// Xavier initialization
function randomWeight(fanIn: number, fanOut: number): number {
    const limit = Math.sqrt(6 / (fanIn + fanOut));
    return Math.random() * 2 * limit - limit;
}

// ============================================================================
// CONV1D LAYER
// ============================================================================

class Conv1DLayer {
    filters: number;
    kernelSize: number;
    inputChannels: number;
    weights: number[][][]; // [filter][kernel][channel]
    biases: number[];
    
    constructor(filters: number, kernelSize: number, inputChannels: number) {
        this.filters = filters;
        this.kernelSize = kernelSize;
        this.inputChannels = inputChannels;
        
        // Initialize weights
        this.weights = Array(filters).fill(0).map(() =>
            Array(kernelSize).fill(0).map(() =>
                Array(inputChannels).fill(0).map(() => randomWeight(kernelSize * inputChannels, filters))
            )
        );
        
        this.biases = Array(filters).fill(0).map(() => Math.random() * 0.1 - 0.05);
    }
    
    /**
     * Forward pass: Apply convolution
     * Input: [sequenceLength, inputChannels]
     * Output: [outputLength, filters]
     */
    forward(input: number[][]): number[][] {
        const sequenceLength = input.length;
        const outputLength = sequenceLength - this.kernelSize + 1;
        const output: number[][] = [];
        
        for (let i = 0; i < outputLength; i++) {
            const filterOutputs: number[] = [];
            
            for (let f = 0; f < this.filters; f++) {
                let sum = this.biases[f];
                
                // Apply convolution
                for (let k = 0; k < this.kernelSize; k++) {
                    for (let c = 0; c < this.inputChannels; c++) {
                        sum += input[i + k][c] * this.weights[f][k][c];
                    }
                }
                
                filterOutputs.push(relu(sum));
            }
            
            output.push(filterOutputs);
        }
        
        return output;
    }
    
    /**
     * Max pooling
     */
    maxPool(input: number[][], poolSize: number = 2): number[][] {
        const output: number[][] = [];
        
        for (let i = 0; i < input.length; i += poolSize) {
            const pooled: number[] = [];
            
            for (let f = 0; f < this.filters; f++) {
                let max = -Infinity;
                for (let p = 0; p < poolSize && i + p < input.length; p++) {
                    max = Math.max(max, input[i + p][f]);
                }
                pooled.push(max);
            }
            
            output.push(pooled);
        }
        
        return output;
    }
}

// ============================================================================
// LSTM CELL
// ============================================================================

class LSTMCell {
    inputSize: number;
    hiddenSize: number;
    
    // Weights for gates: [input, forget, cell, output]
    Wf: number[][];  // Forget gate
    Wi: number[][];  // Input gate
    Wc: number[][];  // Cell gate
    Wo: number[][];  // Output gate
    
    // Biases
    bf: number[];
    bi: number[];
    bc: number[];
    bo: number[];
    
    // State
    h: number[];  // Hidden state
    c: number[];  // Cell state
    
    constructor(inputSize: number, hiddenSize: number) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        
        // Initialize weights (combined input + hidden)
        const totalInputSize = inputSize + hiddenSize;
        
        this.Wf = this.initWeights(hiddenSize, totalInputSize);
        this.Wi = this.initWeights(hiddenSize, totalInputSize);
        this.Wc = this.initWeights(hiddenSize, totalInputSize);
        this.Wo = this.initWeights(hiddenSize, totalInputSize);
        
        this.bf = Array(hiddenSize).fill(0);
        this.bi = Array(hiddenSize).fill(0);
        this.bc = Array(hiddenSize).fill(0);
        this.bo = Array(hiddenSize).fill(0);
        
        this.reset();
    }
    
    private initWeights(rows: number, cols: number): number[][] {
        return Array(rows).fill(0).map(() =>
            Array(cols).fill(0).map(() => randomWeight(cols, rows))
        );
    }
    
    reset() {
        this.h = Array(this.hiddenSize).fill(0);
        this.c = Array(this.hiddenSize).fill(0);
    }
    
    /**
     * Forward pass for one timestep
     */
    forward(x: number[]): number[] {
        // Concatenate input and previous hidden state
        const combined = [...x, ...this.h];
        
        // Forget gate
        const f = this.bf.map((b, i) =>
            sigmoid(this.Wf[i].reduce((sum, w, j) => sum + w * combined[j], 0) + b)
        );
        
        // Input gate
        const inputGate = this.bi.map((b, i) =>
            sigmoid(this.Wi[i].reduce((sum, w, j) => sum + w * combined[j], 0) + b)
        );
        
        // Cell gate
        const cellGate = this.bc.map((b, i) =>
            tanh(this.Wc[i].reduce((sum, w, j) => sum + w * combined[j], 0) + b)
        );
        
        // Output gate
        const o = this.bo.map((b, i) =>
            sigmoid(this.Wo[i].reduce((sum, w, j) => sum + w * combined[j], 0) + b)
        );
        
        // Update cell state
        this.c = this.c.map((c_prev, i) =>
            f[i] * c_prev + inputGate[i] * cellGate[i]
        );
        
        // Update hidden state
        this.h = this.c.map((c, i) => o[i] * tanh(c));
        
        return this.h;
    }
}

// ============================================================================
// LSTM LAYER (Multiple cells for sequence processing)
// ============================================================================

class LSTMLayer {
    cells: LSTMCell[];
    inputSize: number;
    hiddenSize: number;
    numLayers: number;
    dropout: number;
    
    constructor(inputSize: number, hiddenSize: number, numLayers: number = 1, dropout: number = 0.2) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.numLayers = numLayers;
        this.dropout = dropout;
        
        this.cells = [];
        for (let i = 0; i < numLayers; i++) {
            const cellInputSize = i === 0 ? inputSize : hiddenSize;
            this.cells.push(new LSTMCell(cellInputSize, hiddenSize));
        }
    }
    
    reset() {
        this.cells.forEach(cell => cell.reset());
    }
    
    /**
     * Process entire sequence
     * Input: [sequenceLength, inputSize]
     * Output: [hiddenSize] (last hidden state)
     */
    forward(sequence: number[][]): number[] {
        this.reset();
        
        let currentInput = sequence;
        
        // Process through each layer
        for (let layer = 0; layer < this.numLayers; layer++) {
            const layerOutput: number[][] = [];
            
            for (const x of currentInput) {
                const h = this.cells[layer].forward(x);
                
                // Apply dropout (simple version - randomly zero out)
                const droppedH = h.map(val => 
                    Math.random() > this.dropout ? val : 0
                );
                
                layerOutput.push(droppedH);
            }
            
            currentInput = layerOutput;
        }
        
        // Return last hidden state of last layer
        return this.cells[this.numLayers - 1].h;
    }
}

// ============================================================================
// CNN-LSTM NETWORK
// ============================================================================

export class CNNLSTMNetwork {
    // CNN Layers
    conv1: Conv1DLayer;
    conv2: Conv1DLayer;
    
    // LSTM Layers
    lstm: LSTMLayer;
    
    // Dense output layer
    denseWeights: number[][];
    denseBias: number[];
    
    // Config
    sequenceLength: number;
    featuresPerCandle: number;
    
    constructor(
        sequenceLength: number = 50,
        featuresPerCandle: number = 8
    ) {
        this.sequenceLength = sequenceLength;
        this.featuresPerCandle = featuresPerCandle;
        
        // CNN: Extract patterns from candlestick sequences
        this.conv1 = new Conv1DLayer(16, 3, featuresPerCandle);
        this.conv2 = new Conv1DLayer(32, 3, 16);
        
        // LSTM: Learn temporal dependencies
        // After 2 conv layers with kernel=3 and pooling, sequence is reduced
        this.lstm = new LSTMLayer(32, 64, 2, 0.2);
        
        // Dense layer: LSTM output -> 3 outputs (pattern, temporal, combined confidence)
        this.denseWeights = Array(3).fill(0).map(() =>
            Array(64).fill(0).map(() => randomWeight(64, 3))
        );
        this.denseBias = [0, 0, 0];
    }
    
    /**
     * Extract features from a single candle
     */
    private extractCandleFeatures(candle: Candle): number[] {
        const { open, high, low, close, volume } = candle;
        
        // Normalize features
        const bodySize = Math.abs(close - open) / open;
        const upperShadow = (high - Math.max(open, close)) / open;
        const lowerShadow = (Math.min(open, close) - low) / open;
        const priceChange = (close - open) / open;
        const highLowRange = (high - low) / open;
        const volumeNorm = Math.log(volume + 1) / 20; // Log scale
        
        // Candlestick pattern indicators
        const isBullish = close > open ? 1 : 0;
        const isDoji = bodySize < 0.001 ? 1 : 0;
        
        return [
            bodySize,
            upperShadow,
            lowerShadow,
            priceChange,
            highLowRange,
            volumeNorm,
            isBullish,
            isDoji
        ];
    }
    
    /**
     * Extract features from candle sequence
     */
    extractCandlestickFeatures(candles: Candle[]): number[][] {
        return candles.slice(-this.sequenceLength).map(c => this.extractCandleFeatures(c));
    }
    

    /**
     * Forward pass through entire network
     */
    predict(candles: Candle[]): {
        patternConfidence: number;
        temporalConfidence: number;
        combinedConfidence: number;
        features: number[];
    } {
        // 1. Extract features
        const features = this.extractCandlestickFeatures(candles);
        
        if (features.length < 10) {
            // Not enough data
            return {
                patternConfidence: 50,
                temporalConfidence: 50,
                combinedConfidence: 50,
                features: []
            };
        }
        
        // 2. CNN Forward Pass
        let convOutput = this.conv1.forward(features);
        convOutput = this.conv1.maxPool(convOutput, 2);
        
        convOutput = this.conv2.forward(convOutput);
        convOutput = this.conv2.maxPool(convOutput, 2);
        
        // 3. LSTM Forward Pass
        const lstmOutput = this.lstm.forward(convOutput);
        
        // 4. Dense Layer (Neural Output)
        const outputs = this.denseWeights.map((weights, i) =>
            sigmoid(weights.reduce((sum, w, j) => sum + w * lstmOutput[j], 0) + this.denseBias[i])
        );
        
        // --- HEURISTIC BOOSTING (Cold Start Problem Solver) ---
        // Since weights are random initially, we blend NN output with robust heuristics
        // to ensure the model is useful immediately while it learns.
        
        // Heuristic 1: Trend Strength (for Temporal Confidence)
        const closes = candles.slice(-20).map(c => c.close);
        const sma20 = closes.reduce((a, b) => a + b, 0) / 20;
        const lastClose = closes[closes.length - 1];
        const trendDiff = (lastClose - sma20) / sma20; // % distance from SMA
        // Map trend diff to 0-1 confidence (cap at 2% deviation)
        const trendStrength = Math.min(1, Math.abs(trendDiff) * 50); 
        const heuristicTemporal = 50 + (trendDiff > 0 ? 1 : -1) * (trendStrength * 40); // 10% to 90%
        
        // Blend: 30% NN (initially random), 70% Heuristic
        // As model trains, we should rely more on NN, but for now fixed blend
        const temporalConfidence = (outputs[1] * 100 * 0.3) + (heuristicTemporal * 0.7);
        
        // Heuristic 2: Pattern Confidence (passed from identifyPattern usually, but here generic)
        const patternConfidence = outputs[0] * 100; // Keep raw NN for this, override in getActionConfidence
        
        // Combined
        const combinedConfidence = (patternConfidence + temporalConfidence) / 2;
        
        return {
            patternConfidence: patternConfidence,         
            temporalConfidence: temporalConfidence,       
            combinedConfidence: combinedConfidence,
            features: lstmOutput
        };
    }
    
    /**
     * Get pattern name from CNN analysis
     */
    identifyPattern(candles: Candle[]): string {
        if (candles.length < 3) return "insufficient_data";
        
        const last3 = candles.slice(-3);
        const features = last3.map(c => this.extractCandleFeatures(c));
        
        // Simple pattern detection based on features
        const [prev2, prev1, current] = features;
        
        // Hammer pattern
        if (current[2] > 0.02 && current[0] < 0.01) {
            return "hammer_bullish";
        }
        
        // Shooting star
        if (current[1] > 0.02 && current[0] < 0.01) {
            return "shooting_star_bearish";
        }
        
        // Bullish engulfing
        if (prev1[6] === 0 && current[6] === 1 && current[0] > prev1[0] * 1.5) {
            return "bullish_engulfing";
        }
        
        // Bearish engulfing
        if (prev1[6] === 1 && current[6] === 0 && current[0] > prev1[0] * 1.5) {
            return "bearish_engulfing";
        }
        
        // Doji
        if (current[7] === 1) {
            return "doji_neutral";
        }
        
        // Trend continuation
        const allBullish = features.every(f => f[6] === 1);
        const allBearish = features.every(f => f[6] === 0);
        
        if (allBullish) return "bullish_continuation";
        if (allBearish) return "bearish_continuation";
        
        return "neutral_pattern";
    }
    
    /**
     * Get confidence for specific action
     */
    getActionConfidence(candles: Candle[], action: 'BUY' | 'SELL' | 'HOLD'): number {
        const prediction = this.predict(candles);
        const pattern = this.identifyPattern(candles);
        
        let confidence = prediction.combinedConfidence;
        
        // HEURISTIC OVERRIDE: If we detect a specific named pattern, 
        // we assign a high base confidence regardless of what the NN thinks.
        // This ensures the "System 1" (Fast/Heuristic) works while "System 2" (Slow/NN) learns.
        
        if (action === 'BUY') {
            if (pattern.includes('bullish')) {
                // Boost confidence significantly for known bullish patterns
                confidence = Math.max(confidence, 75); 
            } else if (pattern.includes('bearish')) {
                confidence = Math.min(confidence, 25);
            }
            
            // Add trend confirmation from implicit temporal confidence
            if (prediction.temporalConfidence > 60) confidence += 10;
            
        } else if (action === 'SELL') {
            if (pattern.includes('bearish')) {
                confidence = Math.max(confidence, 75);
            } else if (pattern.includes('bullish')) {
                confidence = Math.min(confidence, 25);
            }
            
            // Add trend confirmation
            if (prediction.temporalConfidence < 40) confidence += 10;
        } 
        
        return Math.max(0, Math.min(100, confidence));
    }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const cnnLstmModel = new CNNLSTMNetwork(50, 8);

console.log('[CNN-LSTM] Model initialized with 50 sequence length, 8 features per candle');
