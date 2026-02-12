import { EnhancedExecutedTrade } from '../types/enhanced';

/**
 * Hyperparameter Optimizer Service
 * Calibrates AI thresholds and risk parameters using historical performance
 */

export interface OptimizationResult {
  parameter: string;
  currentValue: number;
  optimizedValue: number;
  estimatedImprovement: number; // percentage
  status: 'IMPROVED' | 'NO_CHANGE' | 'DEGRADED';
}

/**
 * Calibrate the optimal confidence threshold for taking trades
 * Finds the threshold that maximizes Total PNL or Win Rate
 */
export const optimizeConfidenceThreshold = (trades: EnhancedExecutedTrade[]): OptimizationResult => {
  const currentThreshold = 70; // Default assumption
  let bestThreshold = currentThreshold;
  let maxPnl = -Infinity;
  
  const completedTrades = trades.filter(t => t.outcome !== 'OPEN' && t.aiConfidence !== undefined);
  
  if (completedTrades.length < 10) {
    return {
      parameter: 'Confidence Threshold',
      currentValue: currentThreshold,
      optimizedValue: currentThreshold,
      estimatedImprovement: 0,
      status: 'NO_CHANGE'
    };
  }

  // Test thresholds from 50 to 95 in steps of 5
  for (let threshold = 50; threshold <= 95; threshold += 5) {
    const filteredTrades = completedTrades.filter(t => t.aiConfidence! >= threshold);
    if (filteredTrades.length < 5) continue; // Sample size too small

    const totalPnl = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
    
    if (totalPnl > maxPnl) {
      maxPnl = totalPnl;
      bestThreshold = threshold;
    }
  }

  const currentPnl = completedTrades
    .filter(t => t.aiConfidence! >= currentThreshold)
    .reduce((sum, t) => sum + t.pnl, 0);

  const improvement = currentPnl !== 0 
    ? ((maxPnl - currentPnl) / Math.abs(currentPnl)) * 100 
    : 0;

  return {
    parameter: 'Confidence Threshold',
    currentValue: currentThreshold,
    optimizedValue: bestThreshold,
    estimatedImprovement: Math.round(improvement),
    status: bestThreshold !== currentThreshold ? 'IMPROVED' : 'NO_CHANGE'
  };
};

/**
 * Optimize Risk-Reward Ratio based on historical outcomes
 */
export const optimizeRiskReward = (trades: EnhancedExecutedTrade[]): OptimizationResult => {
  const currentRR = 2.0; // Default assumption
  let bestRR = currentRR;
  let maxEquity = -Infinity;

  const completedTrades = trades.filter(t => t.outcome !== 'OPEN');
  
  if (completedTrades.length < 10) {
    return {
      parameter: 'Risk-Reward Ratio',
      currentValue: currentRR,
      optimizedValue: currentRR,
      estimatedImprovement: 0,
      status: 'NO_CHANGE'
    };
  }

  // Iterate through potential RR ratios
  for (let rr = 1.0; rr <= 5.0; rr += 0.5) {
    // This is a simulation: if we had used this RR, what would happen?
    // We assume SL stays the same, TP shifts.
    // If actual pnl > 0 and (actualRR >= rr), it's a win.
    // This is complex without re-running backtests, so we use a statistical proxy.
    
    const winRateAtRR = completedTrades.filter(t => {
      const actualRR = t.actualRR || 0;
      return t.outcome === 'WIN' && actualRR >= rr;
    }).length / completedTrades.length;

    // Expected Value = (WinRate * RR) - (LossRate * 1)
    const ev = (winRateAtRR * rr) - ((1 - winRateAtRR) * 1);
    
    if (ev > maxEquity) {
      maxEquity = ev;
      bestRR = rr;
    }
  }

  return {
    parameter: 'Target R:R Ratio',
    currentValue: currentRR,
    optimizedValue: bestRR,
    estimatedImprovement: 0, // Hard to estimate without fresh backtest
    status: bestRR !== currentRR ? 'IMPROVED' : 'NO_CHANGE'
  };
};

/**
 * Full optimization suite
 */
export const runOptimizationSuite = (trades: EnhancedExecutedTrade[]): OptimizationResult[] => {
  return [
    optimizeConfidenceThreshold(trades),
    optimizeRiskReward(trades)
  ];
};

export const hyperparameterOptimizer = {
  optimizeConfidenceThreshold,
  optimizeRiskReward,
  runOptimizationSuite
};
