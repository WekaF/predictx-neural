import { Candle, SMCAnalysis, OrderBlock, FairValueGap, SwingPoint } from '../types';

export const smcService = {
    analyze: (candles: Candle[]): SMCAnalysis => {
        if (candles.length < 50) {
            return {
                structure: 'NEUTRAL',
                orderBlocks: [],
                fairValueGaps: [],
                swingHighs: [],
                swingLows: []
            };
        }

        const swings = findSwings(candles);
        const structure = analyzeStructure(candles, swings);
        const fairValueGaps = findFVGs(candles); // Find ALL unmitigated FVGs
        const orderBlocks = findOrderBlocks(candles, swings, structure.trend);

        return {
            structure: structure.trend,
            lastBOS: structure.lastBOS,
            lastCHoCH: structure.lastCHoCH,
            orderBlocks,
            fairValueGaps,
            swingHighs: swings.highs,
            swingLows: swings.lows
        };
    }
};

// --- Helper Functions ---

function findSwings(candles: Candle[], left = 3, right = 2): { highs: SwingPoint[], lows: SwingPoint[] } {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];

    for (let i = left; i < candles.length - right; i++) {
        const currentHigh = candles[i].high;
        const currentLow = candles[i].low;

        // Check High
        let isHigh = true;
        for (let j = 1; j <= left; j++) if (candles[i - j].high > currentHigh) isHigh = false;
        for (let j = 1; j <= right; j++) if (candles[i + j].high > currentHigh) isHigh = false; // Strict high
        
        // Refined: Center needs to be highest
        // Also check equality to avoid double counting, take the first one or ignore?
        // Simple pivot logic is fine for now.

        if (isHigh) highs.push({ type: 'HIGH', price: currentHigh, index: i });

        // Check Low
        let isLow = true;
        for (let j = 1; j <= left; j++) if (candles[i - j].low < currentLow) isLow = false;
        for (let j = 1; j <= right; j++) if (candles[i + j].low < currentLow) isLow = false;

        if (isLow) lows.push({ type: 'LOW', price: currentLow, index: i });
    }
    return { highs, lows };
}

function analyzeStructure(candles: Candle[], swings: { highs: SwingPoint[], lows: SwingPoint[] }) {
    // Determine trend based on recent breaks of Highs/Lows
    // We look at the last few significant swings
    
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let lastBOS = undefined;
    let lastCHoCH = undefined;

    // Iterate through swings to build structure map? 
    // Simplified: Check if price broke the last major swing high/low
    
    // Get last verified high and low
    const lastHigh = swings.highs.length > 0 ? swings.highs[swings.highs.length - 1] : null;
    const lastLow = swings.lows.length > 0 ? swings.lows[swings.lows.length - 1] : null;

    if (!lastHigh || !lastLow) return { trend: 'NEUTRAL' as const };

    const currentPrice = candles[candles.length - 1].close;

    // Very basic structure detection
    // If recent highs are ascending and lows are ascending -> Bullish
    
    // Robust BOS logic:
    // Iterate from end. Find first candle closing above lastHigh.
    
    // We will look at the sequence of the last 4 swing points
    if (swings.highs.length >= 2 && swings.lows.length >= 2) {
        const h1 = swings.highs[swings.highs.length - 1]; // Most recent
        const h2 = swings.highs[swings.highs.length - 2];
        const l1 = swings.lows[swings.lows.length - 1];
        const l2 = swings.lows[swings.lows.length - 2];

        if (h1.price > h2.price && l1.price > l2.price) {
            trend = 'BULLISH';
            // Check for BOS
            // IF close > h1.price? No, h1 IS the pivot.
            // BOS happens when price breaks a previous pivot.
        } else if (l1.price < l2.price && h1.price < h2.price) {
            trend = 'BEARISH';
        }
    }
    
    // Detect recent BOS
    // A BOS is when a candle body closes beyond a previous key swing point in the direction of trend.
    
    // For now, let's keep trend simple.
    // If closes > last swing high -> Bullish Structure Break
    
    return { trend, lastBOS, lastCHoCH };
}

function findFVGs(candles: Candle[]): FairValueGap[] {
    const fvgs: FairValueGap[] = [];
    const minGapSize = (candles[candles.length - 1].close * 0.0005); // 0.05% min gap

    for (let i = 0; i < candles.length - 2; i++) {
        const c1 = candles[i];
        const c2 = candles[i + 1]; // The displacement candle
        const c3 = candles[i + 2];

        // Bullish FVG
        // Gap between C1 High and C3 Low
        if (c3.low > c1.high) {
            const gapSize = c3.low - c1.high;
            if (gapSize > minGapSize) {
                // Check if mitigated by future candles
                let mitigated = false;
                for (let j = i + 3; j < candles.length; j++) {
                    if (candles[j].low <= c1.high) { // Fully filled? Or just touched?
                        // Usually if price dips into it, it's testing.
                        // If price closes below it, it's invalidated.
                        // We mark as mitigated if price touches 50%?
                        // Standard: If price fills the gap.
                        if (candles[j].low < c1.high + (gapSize * 0.5)) mitigated = true; 
                    }
                }
                
                if (!mitigated || i > candles.length - 20) { // Keep recent ones even if mitigated
                     fvgs.push({
                        id: `fvg-bull-${i}`,
                        type: 'BULLISH',
                        top: c3.low,
                        bottom: c1.high,
                        candleIndex: i + 1,
                        timestamp: new Date(candles[i+1].time).getTime(),
                        mitigated
                    });
                }
            }
        }

        // Bearish FVG
        // Gap between C1 Low and C3 High
        if (c3.high < c1.low) {
            const gapSize = c1.low - c3.high;
            if (gapSize > minGapSize) {
                let mitigated = false;
                 for (let j = i + 3; j < candles.length; j++) {
                    if (candles[j].high > c1.low - (gapSize * 0.5)) mitigated = true;
                }

                if (!mitigated || i > candles.length - 20) {
                     fvgs.push({
                        id: `fvg-bear-${i}`,
                        type: 'BEARISH',
                        top: c1.low,
                        bottom: c3.high,
                        candleIndex: i + 1,
                        timestamp: new Date(candles[i+1].time).getTime(),
                        mitigated
                    });
                }
            }
        }
    }
    return fvgs.slice(-10); // Return last 10
}

function findOrderBlocks(candles: Candle[], swings: { highs: SwingPoint[], lows: SwingPoint[] }, trend: string): OrderBlock[] {
    const obs: OrderBlock[] = [];
    
    // Simplistic OB detection:
    // Look for strong moves that broke structure (using FVGs as proxy for strong moves).
    // Or just look for the last opposite colored candle before a FVG.
    
    // We will use the FVG detection to find Impulse moves.
    const fvgs = findFVGs(candles); // Re-run or ignore (optimization later)
    
    // For each significant FVG (unmitigated preferably), find the origin candle.
    
    fvgs.forEach(fvg => {
        if (fvg.mitigated && fvg.candleIndex < candles.length - 50) return; // Skip old mitigated ones

        const impulseStartIdx = fvg.candleIndex; // This is the displacement candle
        
        if (fvg.type === 'BULLISH') {
            // Find last bearish candle before index 'impulseStartIdx'
            for (let k = impulseStartIdx - 1; k >= Math.max(0, impulseStartIdx - 5); k--) {
                const c = candles[k];
                if (c.close < c.open) { // Red candle
                     obs.push({
                        id: `ob-bull-${k}`,
                        type: 'BULLISH',
                        top: c.high,
                        bottom: c.low,
                        candleIndex: k,
                        timestamp: new Date(c.time).getTime(),
                        mitigated: false, // Need to check Logic
                        strength: 80
                     });
                     break; // Only the last one
                }
            }
        } else {
             // Bearish FVG, find last bullish candle
             for (let k = impulseStartIdx - 1; k >= Math.max(0, impulseStartIdx - 5); k--) {
                const c = candles[k];
                if (c.close > c.open) { // Green candle
                     obs.push({
                        id: `ob-bear-${k}`,
                        type: 'BEARISH',
                        top: c.high,
                        bottom: c.low,
                        candleIndex: k,
                        timestamp: new Date(c.time).getTime(),
                        mitigated: false,
                        strength: 80
                     });
                     break;
                }
            }
        }
    });

    return obs.slice(-5); // Return top 5 recent
}
