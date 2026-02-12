import { EnhancedExecutedTrade, PatternPerformance } from '../types/enhanced';
import { tradeAnalyticsService } from './tradeAnalyticsService';

/**
 * Pattern Analysis Service
 * Identifies high-performing setups and suggests improvements
 */

export interface PatternScore {
  patternName: string;
  score: number; // 0-100
  rating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'REJECT';
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}

/**
 * Group trades by pattern and analyze each one deeply
 */
export const trackPatternPerformance = (trades: EnhancedExecutedTrade[]): PatternPerformance[] => {
  return tradeAnalyticsService.analyzePatternPerformance(trades);
};

/**
 * Calculate a scoring metric for a pattern based on various factors
 */
export const scorePattern = (performance: PatternPerformance): PatternScore => {
  // Score based on Win Rate (40%), Profit Factor (30%), Average RR (20%), and Sample Size (10%)
  const wrScore = Math.min(performance.winRate * 2, 100); // 50% WR = 100 score component
  
  // Profit factor like calculation
  const grossProfit = performance.wins * performance.avgPnl;
  const grossLoss = Math.abs(performance.losses * performance.avgPnl); 
  // Simplified since we have avgPnl which is already net. 
  // Let's use Win Rate * Average Win / Average Loss logic if available, 
  // but we'll stick to WR and Total PNL for now.
  
  const pnlScore = performance.totalPnl > 0 ? Math.min(performance.totalPnl / 100, 100) : 0;
  const sampleSizeScore = Math.min((performance.totalTrades / 20) * 100, 100);
  
  const totalScore = (wrScore * 0.5) + (pnlScore * 0.3) + (sampleSizeScore * 0.2);
  
  let rating: PatternScore['rating'];
  let recommendation: string;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (totalScore >= 80) {
    rating = 'EXCELLENT';
    recommendation = 'Aggressively trade this pattern. High reliability.';
    strengths.push('High win rate', 'Consistent profitability');
  } else if (totalScore >= 65) {
    rating = 'GOOD';
    recommendation = 'Reliable pattern. Continue trading with standard risk.';
    strengths.push('Good statistical edge');
  } else if (totalScore >= 50) {
    rating = 'AVERAGE';
    recommendation = 'Manual confirmation required. Median performance.';
    weaknesses.push('Mediocre win rate');
  } else if (totalScore >= 30) {
    rating = 'POOR';
    recommendation = 'Lower risk or avoid. Low edge detected.';
    weaknesses.push('High failure rate');
  } else {
    rating = 'REJECT';
    recommendation = 'Pattern is statistically negative. Block this setup.';
    weaknesses.push('Negative expectancy', 'High risk of loss');
  }

  return {
    patternName: performance.patternName,
    score: Math.round(totalScore),
    rating,
    strengths,
    weaknesses,
    recommendation
  };
};

/**
 * Filter high-performing patterns that meet a minimum win rate and trade count
 */
export const filterHighPerformingPatterns = (
  performances: PatternPerformance[],
  minWinRate: number = 60,
  minTrades: number = 5
): PatternPerformance[] => {
  return performances.filter(p => p.winRate >= minWinRate && p.totalTrades >= minTrades);
};

/**
 * Suggest improvements for a pattern based on market context
 */
export const suggestImprovements = (patternName: string, trades: EnhancedExecutedTrade[]) => {
  const patternTrades = trades.filter(t => (t.patternDetected || 'Unknown') === patternName);
  
  if (patternTrades.length < 5) return "Need more data for specific suggestions.";

  // Analyze market conditions for wins vs losses
  const wins = patternTrades.filter(t => t.outcome === 'WIN');
  const losses = patternTrades.filter(t => t.outcome === 'LOSS');

  // Simple heuristic analysis
  const winTrends = wins.map(t => t.marketContext?.structure.trend).filter(Boolean);
  const lossTrends = losses.map(t => t.marketContext?.structure.trend).filter(Boolean);

  // If wins are mostly in UPTREND but losses are spread out
  const upTrendWins = winTrends.filter(t => t === 'UP').length;
  if (upTrendWins > wins.length * 0.7) {
    return `This pattern performs best in UPTRENDS. Avoid taking ${patternName} setups in Sideways or Downtrend markets.`;
  }

  return `Pattern ${patternName} is performing normally. Monitor R:R ratios for optimization.`;
};

export const patternAnalysisService = {
  trackPatternPerformance,
  scorePattern,
  filterHighPerformingPatterns,
  suggestImprovements
};
