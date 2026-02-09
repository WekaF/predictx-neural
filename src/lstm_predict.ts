import * as tf from '@tensorflow/tfjs';
import { RSI, MACD, EMA } from 'technicalindicators';
import { getHistoricalKlines } from '../services/binanceService';
import { Candle } from '../types';

// Define the shape of our processed data
export interface ProcessedData {
    time: string;
    close: number;
    rsi: number;
    macd: number;
    ema20: number;
    ema50: number;
    target: number; // 1 if next close > current close, else 0
}

/**
 * Fetches market data and adds technical indicators.
 * Replaces the Python fetch_market_data function.
 */
export async function fetchMarketData(
    symbol: string = "BTC/USD", 
    interval: string = "1d", 
    limit: number = 365
): Promise<ProcessedData[] | null> {
    console.log(`Fetching data for ${symbol}...`);

    // 1. Download data using existing service
    // Note: binanceService uses a cache and fallback mechanism
    const candles: Candle[] = await getHistoricalKlines(symbol, interval, limit + 50); // Fetch extra for warm-up

    if (!candles || candles.length === 0) {
        console.warn("No data fetched.");
        return null;
    }

    // Extract close prices for indicator calculation
    const closePrices = candles.map(c => c.close);

    // 2. Add Technical Indicators
    
    // RSI (Length 14)
    // technicalindicators.RSI.calculate({values, period})
    const rsiValues = RSI.calculate({
        values: closePrices,
        period: 14
    });

    // MACD (12, 26, 9)
    // Python: ta.macd(df['Close']) -> Returns MACD_12_26_9, MACDh_12_26_9, MACDs_12_26_9
    // We want the main MACD line (MACD_12_26_9) matching the Python code `macd['MACD_12_26_9']`
    const macdResult = MACD.calculate({
        values: closePrices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    });
    // extract just the MACD line
    const macdValues = macdResult.map(m => m.MACD); 

    // EMA 20
    const ema20Values = EMA.calculate({
        period: 20,
        values: closePrices
    });

    // EMA 50
    const ema50Values = EMA.calculate({
        period: 50,
        values: closePrices
    });

    /**
     * Alignment:
     * Indicators have different start indices because of the lookback period.
     * We need to align everything to the array with the most lag (likely EMA 50).
     * 
     * RSI starts at index 14
     * MACD starts at index 26 (slow period)
     * EMA20 starts at index 20
     * EMA50 starts at index 50
     * 
     * However, the 'technicalindicators' library returns an array ONLY containing the calculated values.
     * So rsiValues[0] corresponds to closePrices[14] (approx).
     * 
     * We need to align them by the end of the arrays.
     */

    const minLength = Math.min(
        rsiValues.length,
        macdValues.length, 
        ema20Values.length, 
        ema50Values.length
    );

    // We align from the end
    const alignedData: ProcessedData[] = [];

    // Iterate backwards or align indices
    // Let's iterate based on the number of available aligned points
    // The indicators arrays end at the same 'time' as closePrices (the last element corresponds to the last closePrice)
    
    // We stop at i = 1 because need next close for target
    // We also need to make sure we have indicator data for i
    
    for (let i = 0; i < minLength; i++) {
        // Get values from the end
        const rsiVal = rsiValues[rsiValues.length - 1 - i];
        
        // Handling MACD which might be undefined if something went wrong, but usually it's fine
        const macdVal = macdValues[macdValues.length - 1 - i];
        
        const ema20Val = ema20Values[ema20Values.length - 1 - i];
        const ema50Val = ema50Values[ema50Values.length - 1 - i];

        // Corresponding close price index
        // closePrices' last index matches indicators' last index
        const closeIndex = closePrices.length - 1 - i;
        
        if (closeIndex < 0) continue; 
        
        const currentClose = closePrices[closeIndex];
        const currentTime = candles[closeIndex].time;

        // Calculate Target: 1 if NEXT close > CURRENT close
        // We need the next close, which is at closeIndex + 1
        // But we are iterating backwards from the end...
        
        // Wait, let's look at the Python code again:
        // df['Target'] = (df['Close'].shift(-1) > df['Close']).astype(int)
        // This compares Time T with Time T+1.
        // If T+1 > T, target = 1.
        
        // If we are at the very last candle (most recent), we don't have T+1 close.
        // So the target for the last candle is undefined (or NaN in pandas).
        // The Python code does `df.dropna(inplace=True)` at the end, which removes the last row (and the first 50 rows due to EMA).
        
        // So we should verify we have a 'next' value.
        // If we are iterating `i` from 0 (dataset end), `i=0` is the last candle. We cannot compute target for it.
        // So we skip `i=0`.
        
        if (i === 0) continue; // Skip the most recent candle as we don't know the future

        // Next close corresponds to i-1 (since we are going backwards, i-1 is "later" in time? No)
        // Let's use standard forward indices to avoid confusion.
        
    }

    // Let's restart the alignment logic using standard indices
    // Calculate start index for closePrices where all indicators are valid
    // EMA50 needs 50 data points. output[0] is for the 50th point (index 49).
    // So if ema50Values[0] aligns with closePrices[49].
    
    const offsetEMA50 = 50 - 1; 
    const offsetEMA20 = 20 - 1;
    const offsetMACD = 26 - 1; // Approx
    const offsetRSI = 14; 
    
    // The library handles it such that:
    // If input has N elements. EMA(50) has N - 50 + 1 elements.
    // ema50Values[k] corresponds to closePrices[49 + k]
    
    // We want to align everything.
    // Let's create the objects starting from valid indices.
    
    const processed: ProcessedData[] = [];
    
    // Loop through closePrices
    // We need indices where all indicators are available.
    // We also need i < closePrices.length - 1 to calculate target.
    
    const startIdx = 50; // Use a safe margin, EMA50 requires ~50 points
    
    for (let i = startIdx; i < closePrices.length - 1; i++) {
        // Calculate array indices for indicators
        // The indicators array is shorter than closePrices.
        // index 0 of ema50Values corresponds to closePrices[49] (assuming period 50)
        // index k corresponds to closePrices[49 + k]
        // So to get value for closePrices[i], we need ema50Values[i - 49]
        
        // HOWEVER, technicalindicators library calculation might vary slightly.
        // It's safer to align from the end.
        
        // Let's simplify: 
        // We know the lengths.
        // last closePrice is at index N-1.
        // last ema50Value corresponds to N-1. index M-1.
        // So ema50Value for closePrices[i] is at ema50Values.length - (closePrices.length - i).
        
        const idxFromEnd = closePrices.length - 1 - i;
        
        const rsiVal = rsiValues[rsiValues.length - 1 - idxFromEnd];
        const macdVal = macdValues[macdValues.length - 1 - idxFromEnd];
        const ema20Val = ema20Values[ema20Values.length - 1 - idxFromEnd];
        const ema50Val = ema50Values[ema50Values.length - 1 - idxFromEnd];
        
        if (
            rsiVal === undefined || 
            macdVal === undefined || 
            ema20Val === undefined || 
            ema50Val === undefined
        ) {
            continue;
        }

        const currentClose = closePrices[i];
        const nextClose = closePrices[i + 1];
        
        const target = nextClose > currentClose ? 1 : 0;
        
        processed.push({
            time: candles[i].time,
            close: currentClose,
            rsi: rsiVal,
            macd: macdVal,
            ema20: ema20Val,
            ema50: ema50Val,
            target: target
        });
    }

    return processed;
}

// Example usage function (can be called from UI)
export async function runPredictionExample() {
    const data = await fetchMarketData("BTC/USD", "1d", 100);
    if (data && data.length > 0) {
        console.log("Processed Data (Tail):", data.slice(-5));
        
        // Simple Tensor creation example (for LSTM later)
        if (data.length > 10) {
             const featureKeys = ['close', 'rsi', 'macd', 'ema20', 'ema50'] as const;
            const features = data.map(d => featureKeys.map(k => d[k]));
            const targets = data.map(d => d.target);

            const xs = tf.tensor2d(features);
            const ys = tf.tensor2d(targets, [targets.length, 1]);

            console.log("Input Tensor Shape:", xs.shape);
            console.log("Target Tensor Shape:", ys.shape);
            
            // Clean up tensors
            xs.dispose();
            ys.dispose();
        }
    }
}