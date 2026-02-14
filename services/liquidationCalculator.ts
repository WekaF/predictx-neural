/**
 * Liquidation Calculator for Binance Futures
 * Calculates liquidation prices and validates trade safety
 */

export interface LiquidationInfo {
  liquidationPrice: number;
  marginRatio: number;
  safetyMargin: number;
  riskLevel: 'SAFE' | 'MODERATE' | 'HIGH' | 'EXTREME';
  warningMessage?: string;
}

export class LiquidationCalculator {
  /**
   * Calculate liquidation price for futures position
   * 
   * @param entryPrice - Entry price
   * @param leverage - Leverage (1-125)
   * @param side - 'LONG' or 'SHORT'
   * @param maintenanceMarginRate - Usually 0.4% for BTC (0.004), 0.5% for alts
   * @returns Liquidation price
   */
  calculateLiquidationPrice(
    entryPrice: number,
    leverage: number,
    side: 'LONG' | 'SHORT',
    maintenanceMarginRate: number = 0.004
  ): number {
    if (side === 'LONG') {
      // Long liquidation = Entry * (1 - 1/leverage + MMR)
      return entryPrice * (1 - (1 / leverage) + maintenanceMarginRate);
    } else {
      // Short liquidation = Entry * (1 + 1/leverage - MMR)
      return entryPrice * (1 + (1 / leverage) - maintenanceMarginRate);
    }
  }

  /**
   * Calculate safe leverage based on stop loss distance
   * 
   * @param entryPrice - Entry price
   * @param stopLoss - Stop loss price
   * @param side - 'LONG' or 'SHORT'
   * @param maxRiskPercent - Max account risk percentage (default 2%)
   * @returns Recommended leverage
   */
  calculateSafeLeverage(
    entryPrice: number,
    stopLoss: number,
    side: 'LONG' | 'SHORT',
    maxRiskPercent: number = 2
  ): number {
    const stopDistance = Math.abs(entryPrice - stopLoss) / entryPrice;
    
    // Safe leverage = (Max Risk %) / (Stop Distance %)
    const safeLeverage = (maxRiskPercent / 100) / stopDistance;
    
    // Cap at 10x for safety (even if calculation allows higher)
    return Math.min(Math.floor(safeLeverage), 10);
  }

  /**
   * Validate if trade is safe from liquidation
   * 
   * @param entryPrice - Entry price
   * @param stopLoss - Stop loss price
   * @param leverage - Leverage to use
   * @param side - 'LONG' or 'SHORT'
   * @returns Liquidation info with risk assessment
   */
  validateTrade(
    entryPrice: number,
    stopLoss: number,
    leverage: number,
    side: 'LONG' | 'SHORT'
  ): LiquidationInfo {
    const liqPrice = this.calculateLiquidationPrice(entryPrice, leverage, side);
    
    // Calculate safety margin (distance from SL to liquidation)
    const slDistance = Math.abs(entryPrice - stopLoss);
    const liqDistance = Math.abs(entryPrice - liqPrice);
    const safetyMargin = ((liqDistance - slDistance) / entryPrice) * 100;
    
    let riskLevel: 'SAFE' | 'MODERATE' | 'HIGH' | 'EXTREME';
    let warningMessage: string | undefined;
    
    if (safetyMargin > 5) {
      riskLevel = 'SAFE';
    } else if (safetyMargin > 2) {
      riskLevel = 'MODERATE';
      warningMessage = 'Liquidation price is close to stop loss. Consider reducing leverage.';
    } else if (safetyMargin > 0) {
      riskLevel = 'HIGH';
      warningMessage = 'WARNING: Liquidation price is very close to stop loss!';
    } else {
      riskLevel = 'EXTREME';
      warningMessage = 'DANGER: Stop loss is beyond liquidation price! Trade will be liquidated before SL hits!';
    }
    
    return {
      liquidationPrice: Number(liqPrice.toFixed(2)),
      marginRatio: (1 / leverage) * 100,
      safetyMargin: Number(safetyMargin.toFixed(2)),
      riskLevel,
      warningMessage
    };
  }

  /**
   * Get maintenance margin rate based on symbol
   * Different symbols have different MMR
   */
  getMaintenanceMarginRate(symbol: string): number {
    // BTC, ETH = 0.4%
    if (symbol.includes('BTC') || symbol.includes('ETH')) {
      return 0.004;
    }
    // Most alts = 0.5%
    return 0.005;
  }

  /**
   * Calculate position size based on account balance and risk
   * 
   * @param accountBalance - Total account balance in USDT
   * @param entryPrice - Entry price
   * @param stopLoss - Stop loss price
   * @param leverage - Leverage to use
   * @param riskPercent - Percentage of account to risk (default 2%)
   * @returns Position size in base currency
   */
  calculatePositionSize(
    accountBalance: number,
    entryPrice: number,
    stopLoss: number,
    leverage: number,
    riskPercent: number = 2
  ): number {
    const riskAmount = accountBalance * (riskPercent / 100);
    const stopDistance = Math.abs(entryPrice - stopLoss);
    
    // Position size = (Risk Amount / Stop Distance) * Entry Price
    const positionSize = (riskAmount / stopDistance) * entryPrice;
    
    // Cap at max position size (50% of balance * leverage)
    const maxPosition = (accountBalance * 0.5) * leverage;
    
    return Math.min(positionSize, maxPosition);
  }
}

// Singleton instance
export const liquidationCalculator = new LiquidationCalculator();
