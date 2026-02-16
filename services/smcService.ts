
import { Candle } from "../types";

export interface OrderBlock {
    type: 'BULLISH_OB' | 'BEARISH_OB';
    top: number;
    bottom: number;
    index: number;
    timestamp: number;
}

export interface SMCContext {
    score: number;
    active_ob: OrderBlock | null;
    order_blocks: OrderBlock[];
}

export const smcService = {
    /**
     * Detects Swing Highs and Swing Lows
     * Returns arrays of indices where swings occur
     */
    detectSwingPoints(candles: Candle[], window: number = 5): { highs: (number | null)[], lows: (number | null)[] } {
        const highs: (number | null)[] = new Array(candles.length).fill(null);
        const lows: (number | null)[] = new Array(candles.length).fill(null);

        for (let i = window; i < candles.length - window; i++) {
            let isHigh = true;
            let isLow = true;

            for (let j = 1; j <= window; j++) {
                if (candles[i - j].high > candles[i].high || candles[i + j].high > candles[i].high) {
                    isHigh = false;
                }
                if (candles[i - j].low < candles[i].low || candles[i + j].low < candles[i].low) {
                    isLow = false;
                }
            }

            if (isHigh) highs[i] = candles[i].high;
            if (isLow) lows[i] = candles[i].low;
        }

        return { highs, lows };
    },

    /**
     * Identifies Order Blocks based on Break of Structure (BOS)
     * Aliased as detectOrderBlocks for clarity
     */
    detectOrderBlocks(candles: Candle[]): OrderBlock[] {
        return this.findSMCStructures(candles);
    },

    findSMCStructures(candles: Candle[]): OrderBlock[] {
        const { highs, lows } = this.detectSwingPoints(candles);
        const orderBlocks: OrderBlock[] = [];
        
        let lastHigh: number | null = null;
        let lastLow: number | null = null;

        for (let i = 0; i < candles.length; i++) {
            const currentClose = candles[i].close;

            // Update Last Swings
            if (highs[i] !== null) lastHigh = highs[i];
            if (lows[i] !== null) lastLow = lows[i];

            // Detect Bullish BOS (Break of Structure Up)
            if (lastHigh !== null && currentClose > lastHigh) {
                // Find visible bearish candle before the move (Order Block)
                const lookback = 8; // Look back a bit further to find the pivot
                for (let j = i - 1; j >= Math.max(0, i - lookback); j--) {
                    // Simple heuristic: Last bearish candle
                    if (candles[j].close < candles[j].open) {
                        orderBlocks.push({
                            type: 'BULLISH_OB',
                            top: candles[j].high,
                            bottom: candles[j].low,
                            index: j,
                            timestamp: typeof candles[j].time === 'string' ? new Date(Number(candles[j].time)).getTime() : Number(candles[j].time)
                        });
                        break;
                    }
                }
                lastHigh = null; // Reset to find next structure
            }

            // Detect Bearish BOS (Break of Structure Down)
            if (lastLow !== null && currentClose < lastLow) {
                // Find visible bullish candle before the move
                const lookback = 8;
                for (let j = i - 1; j >= Math.max(0, i - lookback); j--) {
                    if (candles[j].close > candles[j].open) {
                        orderBlocks.push({
                            type: 'BEARISH_OB',
                            top: candles[j].high,
                            bottom: candles[j].low,
                            index: j,
                            timestamp: typeof candles[j].time === 'string' ? new Date(Number(candles[j].time)).getTime() : Number(candles[j].time)
                        });
                        break;
                    }
                }
                lastLow = null; // Reset
            }
        }

        return orderBlocks;
    },

    /**
     * Calculate optimal Limit Order Entry Price from an Order Block
     * For Bullish OB: Entry is at the Top (Proximal Line) or 50% retracement
     * For Bearish OB: Entry is at the Bottom (Proximal Line) or 50% retracement
     */
    getLimitEntryPrice(ob: OrderBlock, aggression: 'AGGRESSIVE' | 'CONSERVATIVE' = 'AGGRESSIVE'): number {
        if (ob.type === 'BULLISH_OB') {
            // Aggressive: Top of OB
            // Conservative: 50% of OB (Midpoint)
            if (aggression === 'AGGRESSIVE') return ob.top;
            return (ob.top + ob.bottom) / 2;
        } else {
            // Bearish OB
            // Aggressive: Bottom of OB
            // Conservative: 50% of OB
            if (aggression === 'AGGRESSIVE') return ob.bottom;
            return (ob.top + ob.bottom) / 2;
        }
    },

    /**
     * Calculate Fibonacci Extension Targets based on the Impulse Leg formed by the Order Block
     */
    getFibonacciTargets(ob: OrderBlock, candles: Candle[]): { tp1: number, tp2: number, tp3: number } {
        // 1. Find the highest/lowest point occurring AFTER the Order Block
        // The OB index is where the OB candle formed. The move happened after.
        const relevantCandles = candles.slice(ob.index + 1);
        
        if (relevantCandles.length === 0) {
            // Fallback if OB is the very last candle (unlikely for entry)
            return { tp1: 0, tp2: 0, tp3: 0 };
        }

        if (ob.type === 'BULLISH_OB') {
            // Impulse Leg: Low (OB) -> High (Peak after OB)
            const low = ob.bottom;
            const high = Math.max(...relevantCandles.map(c => c.high));
            const range = high - low;

            return {
                tp1: high, // Liquidity Run (Swing High)
                tp2: high + (range * 0.618), // 1.618 Extension
                tp3: high + (range * 1.0)    // 2.0 Extension (1:2 R:R usually)
            };
        } else {
            // Impulse Leg: High (OB) -> Low (Trough after OB)
            const high = ob.top;
            const low = Math.min(...relevantCandles.map(c => c.low));
            const range = high - low;

            return {
                tp1: low, // Liquidity Run (Swing Low)
                tp2: low - (range * 0.618), // 1.618 Extension
                tp3: low - (range * 1.0)    // 2.0 Extension
            };
        }
    },

    /**
     * Get SMC Context for current market state
     */
    getSMCContext(candles: Candle[]): SMCContext {
        // Need at least 50 candles to detect swings properly
        if (candles.length < 50) {
             return { score: 0.5, active_ob: null, order_blocks: [] };
        }

        const obs = this.findSMCStructures(candles);
        const lastCandle = candles[candles.length - 1];
        const close = lastCandle.close;

        let score = 0.5; // Neutral
        let activeOb: OrderBlock | null = null;

        // Check for Bullish OB Retest
        const bullishObs = obs.filter(ob => ob.type === 'BULLISH_OB');
        if (bullishObs.length > 0) {
            const latestOb = bullishObs[bullishObs.length - 1]; // Most recent
            // Check if price is approaching OB (within 1.5% range) or inside
            // Expanded range to catch "Near OB" for Limit Order placement
            const distance = (close - latestOb.top) / latestOb.top;
            
            if (close >= latestOb.bottom && distance <= 0.015) {
                score = 0.8; // Bullish Conviction (Buy Limit Zone)
                activeOb = latestOb;
            }
        }

        // Check for Bearish OB Retest
        const bearishObs = obs.filter(ob => ob.type === 'BEARISH_OB');
        if (bearishObs.length > 0) {
            const latestOb = bearishObs[bearishObs.length - 1];
            if (!activeOb || latestOb.index > activeOb.index) { // Priority to most recent
                const distance = (latestOb.bottom - close) / latestOb.bottom;
                
                if (close <= latestOb.top && distance <= 0.015) {
                    score = 0.2; // Bearish Conviction (Sell Limit Zone)
                    activeOb = latestOb;
                }
            }
        }

        return {
            score,
            active_ob: activeOb,
            order_blocks: obs.slice(-3) // Return last 3
        };
    }
};
