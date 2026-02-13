import { EnhancedExecutedTrade } from '../types/enhanced';

export interface SimulationResult {
  simulationId: number;
  finalBalance: number;
  maxDrawdown: number;
  maxLosingStreak: number;
  equityCurve: { tradeNum: number; equity: number }[];
  isWorstCase: boolean;
  isBestCase: boolean;
  isMedianCase: boolean;
}

export interface MonteCarloStats {
  iterations: number;
  original: {
    finalBalance: number;
    maxDrawdown: number;
    maxLosingStreak: number;
    equityCurve: { tradeNum: number; equity: number }[];
  };
  worstCase: SimulationResult;
  bestCase: SimulationResult;
  medianCase: SimulationResult;
  simulations: SimulationResult[]; // Only a subset for visualization to save memory
}

/**
 * Monte Carlo Simulation Benchmarking Service
 */
export const monteCarloService = {
  
  /**
   * Run Monte Carlo Simulation
   * @param trades Historical trades
   * @param initialBalance Starting capital
   * @param iterations Number of simulations (e.g., 1000, 10000)
   */
  runSimulation: (
    trades: EnhancedExecutedTrade[], 
    initialBalance: number = 10000, 
    iterations: number = 1000
  ): MonteCarloStats => {
    // 1. Extract PnL sequence
    const pnls = trades.map(t => t.pnl);
    
    if (pnls.length === 0) {
      throw new Error("No trades available for simulation");
    }

    // 2. Calculate Original Stats
    const originalStats = calculatePathStats(pnls, initialBalance);
    
    // 3. Run Simulations
    const results: SimulationResult[] = [];
    
    for (let i = 0; i < iterations; i++) {
      // Shuffle PnLs
      const shuffledPnls = shuffleArray([...pnls]);
      const stats = calculatePathStats(shuffledPnls, initialBalance);
      
      results.push({
        simulationId: i,
        finalBalance: stats.finalBalance,
        maxDrawdown: stats.maxDrawdown,
        maxLosingStreak: stats.maxLosingStreak,
        equityCurve: stats.equityCurve, // Note: storing full curve for 50k sims might be heavy. Consider storing only for subset.
        isWorstCase: false,
        isBestCase: false,
        isMedianCase: false
      });
    }

    // 4. Sort results to find Best, Worst, Median
    // Sort by Final Balance for Best/Median
    // Sort by Max Drawdown for Worst Case (Conservative view)
    
    const sortedByBalance = [...results].sort((a, b) => b.finalBalance - a.finalBalance);
    const sortedByDD = [...results].sort((a, b) => a.maxDrawdown - b.maxDrawdown); // Ascending because DD is negative (e.g. -20% < -5%) --> wait, usually DD is represented as % drop. 
    // If DD is -10% and -50%, -50% is worse. So sorting Ascending (-50, -10) puts worst first.
    
    const bestCase = sortedByBalance[0];
    const medianCase = sortedByBalance[Math.floor(sortedByBalance.length / 2)];
    const worstCase = sortedByDD[0]; // Deepest drawdown

    bestCase.isBestCase = true;
    medianCase.isMedianCase = true;
    worstCase.isWorstCase = true;

    // Optimize memory: We don't need equity curves for ALL 50k sims in RAM for the UI chart.
    // We only need curves for Best, Worst, Median, and maybe 50 random ones for "cloud" effect.
    // But for histogram analysis we need the scalar stats.
    
    // Let's keep scalar stats for all, but clear equityCurve for non-essential ones if iterations > 1000
    if (iterations > 1000) {
      results.forEach(r => {
        if (!r.isBestCase && !r.isWorstCase && !r.isMedianCase && r.simulationId > 50) {
          r.equityCurve = []; 
        }
      });
    }

    return {
      iterations,
      original: {
        finalBalance: originalStats.finalBalance,
        maxDrawdown: originalStats.maxDrawdown,
        maxLosingStreak: originalStats.maxLosingStreak,
        equityCurve: originalStats.equityCurve
      },
      worstCase, // Deepest Drawdown
      bestCase,  // Highest Balance
      medianCase, // Typical outcome
      simulations: results
    };
  }
};

// --- Helpers ---

/**
 * Calculate stats for a single sequence of PnL
 */
const calculatePathStats = (pnls: number[], initialBalance: number) => {
  let currentBalance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdown = 0;
  
  let currentLosingStreak = 0;
  let maxLosingStreak = 0;

  const equityCurve = [{ tradeNum: 0, equity: initialBalance }];

  pnls.forEach((pnl, idx) => {
    currentBalance += pnl;
    
    // Drawdown Calculation
    if (currentBalance > peakBalance) {
      peakBalance = currentBalance;
    }
    const currentDrawdown = (currentBalance - peakBalance) / peakBalance * 100; // Percentage
    if (currentDrawdown < maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }

    // Streak Calculation
    if (pnl < 0) {
      currentLosingStreak++;
    } else {
      if (currentLosingStreak > maxLosingStreak) {
        maxLosingStreak = currentLosingStreak;
      }
      currentLosingStreak = 0;
    }

    equityCurve.push({ tradeNum: idx + 1, equity: currentBalance });
  });

  // Final streak check
  if (currentLosingStreak > maxLosingStreak) {
    maxLosingStreak = currentLosingStreak;
  }

  return {
    finalBalance: currentBalance,
    maxDrawdown, // e.g., -25.5
    maxLosingStreak,
    equityCurve
  };
};

/**
 * Fisher-Yates Shuffle
 */
const shuffleArray = (array: number[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};
