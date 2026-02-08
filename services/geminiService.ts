import { GoogleGenAI, Type } from "@google/genai";
import { Candle, TechnicalIndicators, TradeSignal, TrainingData, NewsItem } from "../types";

const cleanJsonString = (str: string) => {
  return str.replace(/```json\n?|```/g, '').trim();
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeMarketWithAI = async (
  candles: Candle[],
  indicators: TechnicalIndicators,
  trainingHistory: TrainingData[],
  news: NewsItem[],
  modelName: string = 'gemini-3-flash-preview'
): Promise<TradeSignal | null> => {
  
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key missing");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. Prepare Market Context
  const recentCandles = candles.slice(-20).map(c => 
    `Time: ${c.time} | Open: ${c.open.toFixed(2)} | High: ${c.high.toFixed(2)} | Low: ${c.low.toFixed(2)} | Close: ${c.close.toFixed(2)} | Vol: ${c.volume}`
  ).join('\n');

  // 2. Prepare News Context
  const newsContext = news.length > 0 
    ? news.map(n => `- [${n.sentiment}] ${n.headline}`).join('\n') 
    : "No major news events.";

  // 3. Prepare Neural Feedback (Knowledge Base)
  const successfulPatterns = trainingHistory.filter(t => t.outcome === 'WIN');
  const failedPatterns = trainingHistory.filter(t => t.outcome === 'LOSS');
  
  const learningContext = `
    MEMORY & LEARNING:
    - Successful setups in current session: ${successfulPatterns.map(p => `[${p.confluence}]`).join(', ') || 'None yet'}
    - Failed setups (AVOID): ${failedPatterns.map(p => `[${p.confluence}]`).join(', ') || 'None yet'}
  `;

  // 4. The Professional Prompt
  const prompt = `
    ACT AS A PROFESSIONAL CRYPTO/FOREX ALGORITHMIC TRADER.
    
    YOUR STRATEGY: "CONFLUENCE OF EVIDENCE"
    You must NOT trade unless at least 3 factors align (Technicals + Fundamentals).
    
    DATA ANALYSIS:
    - Current Price: ${candles[candles.length-1].close}
    - Major Trend (SMA200): ${indicators.sma200.toFixed(2)} (${indicators.trend})
    - Dynamic Support (EMA20): ${indicators.ema20.toFixed(2)}
    - RSI (14): ${indicators.rsi.toFixed(2)}
    - Nearest Support: ${indicators.nearestSupport.toFixed(2)}
    - Nearest Resistance: ${indicators.nearestResistance.toFixed(2)}
    
    FUNDAMENTAL ANALYSIS (NEWS):
    ${newsContext}

    ${learningContext}

    MARKET DATA (Last 20 Candles):
    ${recentCandles}

    EXECUTION RULES:
    1. MARKET STRUCTURE: 
       - If Price > SMA200, only look for BUYS (Long).
       - If Price < SMA200, only look for SELLS (Short).
    
    2. FUNDAMENTAL FILTER:
       - If news is overwhelmingly NEGATIVE, do NOT Buy.
       - If news is overwhelmingly POSITIVE, do NOT Sell.
    
    3. CANDLE SIGNAL (TRIGGER):
       - Look for Pin Bars, Hammers, Engulfing, or Doji Reversals.
       - High Volume on the signal candle adds validity.
    
    4. RISK MANAGEMENT (CRITICAL):
       - Target Ratio: Minimum 1:2 (Reward must be 2x Risk).
       - Stop Loss: Placed below Swing Low (Buy) or above Swing High (Sell).

    TASK:
    Analyze the data. If a High Probability setup exists matching the criteria above, issue a signal.
    If conditions are mixed or risk/reward is poor, return HOLD.

    Return JSON strictly:
    {
      "type": "BUY" | "SELL" | "HOLD",
      "entryPrice": number,
      "stopLoss": number,
      "takeProfit": number,
      "riskRewardRatio": number,
      "patternDetected": "string (e.g. Bullish Engulfing)",
      "confluenceFactors": ["string", "string"],
      "newsSentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
      "reasoning": "string",
      "confidence": number (0-100)
    }
  `;

  let retries = 0;
  const maxRetries = 3;
  const initialDelay = 2000; // 2 seconds

  while (retries <= maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["BUY", "SELL", "HOLD"] },
              entryPrice: { type: Type.NUMBER },
              stopLoss: { type: Type.NUMBER },
              takeProfit: { type: Type.NUMBER },
              riskRewardRatio: { type: Type.NUMBER },
              patternDetected: { type: Type.STRING },
              confluenceFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
              newsSentiment: { type: Type.STRING, enum: ["BULLISH", "BEARISH", "NEUTRAL"] },
              reasoning: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            }
          }
        }
      });

      const text = response.text;
      if (!text) return null;

      const data = JSON.parse(cleanJsonString(text));
      
      // Safety check on R:R
      if (data.type !== 'HOLD' && data.riskRewardRatio < 1.5) {
          console.warn("AI attempted low R:R trade, forcing HOLD");
          return { ...data, type: 'HOLD', reasoning: 'Risk/Reward below 1.5 threshold' } as TradeSignal;
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        outcome: 'PENDING',
        ...data
      } as TradeSignal;

    } catch (error: any) {
      // Check for Rate Limit (429) or Quota errors
      const isRateLimit = 
          error?.status === 429 || 
          error?.code === 429 || 
          error?.message?.includes('429') || 
          error?.message?.toLowerCase().includes('quota') ||
          error?.message?.toLowerCase().includes('rate limit');

      if (isRateLimit && retries < maxRetries) {
          const delay = initialDelay * Math.pow(2, retries);
          console.warn(`Gemini API Rate Limit Hit. Retrying in ${delay/1000}s...`);
          await wait(delay);
          retries++;
          continue;
      }

      console.error("AI Analysis Failed:", error);
      return null;
    }
  }

  return null;
};