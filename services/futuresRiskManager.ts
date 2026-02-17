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
    // Position size = (Account * Risk%) / (Entry - SL)
    // NOTE: Leverage is NOT a multiplier for risk-based sizing. It only determines max buying power.
    const riskAmount = accountBalance * this.maxAccountRisk;
    const stopDistance = Math.abs(entryPrice - stopLoss);
    
    if (stopDistance === 0) {
      console.warn('[Risk Manager] Stop distance is zero, using minimum position');
      return 0.001; // Minimum position
    }

    // Units = Risk Amount / Loss per unit
    let positionSize = riskAmount / stopDistance;
    
    // Check if this exceeds Max Buying Power
    const maxBuyingPower = accountBalance * leverage * 0.95; // 95% of max to leave room for fees
    const maxUnitsByLeverage = maxBuyingPower / entryPrice;
    
    // Cap at Max Buying Power
    if (positionSize > maxUnitsByLeverage) {
        console.warn(`[Risk Manager] Risk-based size (${positionSize}) exceeds max buying power (${maxUnitsByLeverage}). Capping.`);
        positionSize = maxUnitsByLeverage;
    }
    
    // Also cap at a reasonable % of balance (e.g. max 50% of balance used as margin)
    // This prevents going "all in" on a single trade even if SL is tight
    const maxMarginUsage = accountBalance * 0.5; // Max 50% of wallet per trade
    const maxUnitsByMargin = (maxMarginUsage * leverage) / entryPrice;
    
    return Math.min(positionSize, maxUnitsByMargin);
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
