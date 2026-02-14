/**
 * Futures Risk Manager
 * Manages position sizing and leverage for futures trading
 */

export class FuturesRiskManager {
  private maxLeverage = 10; // Conservative max leverage
  private maxAccountRisk = 0.02; // 2% per trade

  /**
   * Calculate position size based on account balance and risk
   * 
   * @param accountBalance - Total account balance in USDT
   * @param entryPrice - Entry price
   * @param stopLoss - Stop loss price
   * @param leverage - Leverage to use
   * @returns Position size in base currency
   */
  calculatePositionSize(
    accountBalance: number,
    entryPrice: number,
    stopLoss: number,
    leverage: number
  ): number {
    // Position size = (Account * Risk%) / (Entry - SL) * Leverage
    const riskAmount = accountBalance * this.maxAccountRisk;
    const stopDistance = Math.abs(entryPrice - stopLoss);
    
    if (stopDistance === 0) {
      console.warn('[Risk Manager] Stop distance is zero, using minimum position');
      return 0.001; // Minimum position
    }

    const positionSize = (riskAmount / stopDistance) * leverage;
    
    // Cap at max position size (e.g., 50% of balance)
    const maxPosition = accountBalance * 0.5 * leverage;
    return Math.min(positionSize, maxPosition);
  }

  /**
   * Adjust leverage based on market volatility (ATR)
   * 
   * @param baseLevel - Base leverage level
   * @param atr - Average True Range
   * @param price - Current price
   * @returns Adjusted leverage
   */
  adjustLeverageByVolatility(
    baseLevel: number,
    atr: number,
    price: number
  ): number {
    const volatilityPercent = (atr / price) * 100;
    
    // High volatility = Lower leverage
    if (volatilityPercent > 5) {
      return Math.min(baseLevel, 3);
    }
    if (volatilityPercent > 3) {
      return Math.min(baseLevel, 5);
    }
    if (volatilityPercent > 2) {
      return Math.min(baseLevel, 7);
    }
    
    return baseLevel;
  }

  /**
   * Calculate risk/reward ratio
   */
  calculateRiskReward(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): number {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    
    if (risk === 0) return 0;
    return reward / risk;
  }

  /**
   * Validate if risk/reward ratio is acceptable
   */
  isRiskRewardAcceptable(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    minRR: number = 1.5
  ): boolean {
    const rr = this.calculateRiskReward(entryPrice, stopLoss, takeProfit);
    return rr >= minRR;
  }

  /**
   * Get recommended leverage based on strategy
   */
  getRecommendedLeverage(strategy: 'SCALP' | 'SWING'): number {
    if (strategy === 'SCALP') {
      return 5; // Higher leverage for scalping
    } else {
      return 3; // Lower leverage for swing trading
    }
  }

  /**
   * Calculate maximum loss in USDT
   */
  calculateMaxLoss(
    accountBalance: number,
    positionSize: number,
    entryPrice: number,
    stopLoss: number,
    leverage: number
  ): number {
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const lossPercent = stopDistance / entryPrice;
    
    // Max loss = Position Size * Loss% * Leverage
    return positionSize * lossPercent * leverage;
  }

  /**
   * Validate if max loss is within acceptable limits
   */
  isMaxLossAcceptable(
    accountBalance: number,
    maxLoss: number,
    maxRiskPercent: number = 2
  ): boolean {
    const maxAcceptableLoss = accountBalance * (maxRiskPercent / 100);
    return maxLoss <= maxAcceptableLoss;
  }
}

// Singleton instance
export const futuresRiskManager = new FuturesRiskManager();
