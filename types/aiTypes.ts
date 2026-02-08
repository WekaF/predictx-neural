export interface AutonomousMarketAnalystResponse {
  trendProbability: {
    bullish: number;
    bearish: number;
  };
  prediction: {
    high: number;
    low: number;
    close: number;
  };
  proofOfLogic: string;
}

export interface RiskAccuracyOptimizerResponse {
  pred_high: number;
  pred_low: number;
  pred_close: number;
  confidence_score: number;
  risk_adjustment_reasoning?: string;
}

export interface VerifiableInferenceResponse {
  tradeSignal: 'BUY' | 'SELL' | 'NEUTRAL';
  predictClose: number;
  calculationSteps: string[];
  anchoredState: string;
}
