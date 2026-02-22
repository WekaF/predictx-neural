/**
 * Funding Rate Service
 * Fetches funding rate data from backend
 */

interface FundingRateData {
  symbol: string;
  current: number;
  avg_7d: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  extreme: boolean;
  history: number[];
}

interface FundingRateCache {
  data: FundingRateData;
  timestamp: number;
}

class FundingRateService {
  private cache: Map<string, FundingRateCache> = new Map();
  private cacheDuration = 3600000; // 1 hour (funding updates every 8h)
  private baseUrl = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api`;

  /**
   * Get current funding rate for a symbol
   */
  async getCurrentFundingRate(symbol: string): Promise<FundingRateData | null> {
    // Convert symbol format: BTC/USDT -> BTCUSDT
    const binanceSymbol = symbol.replace('/', '');
    
    // Check cache
    const cached = this.cache.get(binanceSymbol);
    if (cached && (Date.now() - cached.timestamp) < this.cacheDuration) {
      console.log(`[Funding Rate] Using cached data for ${binanceSymbol}`);
      return cached.data;
    }

    try {
      const response = await fetch(`${this.baseUrl}/funding-rate/${binanceSymbol}`);
      
      if (!response.ok) {
        console.error(`[Funding Rate] API error ${response.status}`);
        return null;
      }

      const data: FundingRateData = await response.json();
      
      // Cache the result
      this.cache.set(binanceSymbol, {
        data,
        timestamp: Date.now()
      });

      console.log(`[Funding Rate] ${binanceSymbol}: ${(data.current * 100).toFixed(4)}% (${data.trend})`);
      return data;
    } catch (error) {
      console.error('[Funding Rate] Fetch error:', error);
      return null;
    }
  }

  /**
   * Check if funding rate is favorable for a trade
   */
  isFundingFavorable(
    signalType: 'BUY' | 'SELL',
    fundingData: FundingRateData | null
  ): { favorable: boolean; warning?: string } {
    if (!fundingData) {
      return { favorable: true };
    }

    const rate = fundingData.current;

    // Check for extreme funding (should avoid)
    if (signalType === 'BUY' && rate > 0.05) {
      return {
        favorable: false,
        warning: `Funding rate too high (${(rate * 100).toFixed(3)}%) - expensive to hold LONG`
      };
    }

    if (signalType === 'SELL' && rate < -0.05) {
      return {
        favorable: false,
        warning: `Funding rate too negative (${(rate * 100).toFixed(3)}%) - expensive to hold SHORT`
      };
    }

    // Warning for moderately high funding
    if (signalType === 'BUY' && rate > 0.03) {
      return {
        favorable: true,
        warning: `High funding rate (${(rate * 100).toFixed(3)}%) - consider reducing position size`
      };
    }

    if (signalType === 'SELL' && rate < -0.03) {
      return {
        favorable: true,
        warning: `Negative funding rate (${(rate * 100).toFixed(3)}%) - consider reducing position size`
      };
    }

    return { favorable: true };
  }

  /**
   * Get confidence adjustment multiplier based on funding
   */
  getConfidenceAdjustment(
    signalType: 'BUY' | 'SELL',
    fundingData: FundingRateData | null
  ): number {
    if (!fundingData) {
      return 1.0;
    }

    const rate = fundingData.current;

    // Reduce confidence for unfavorable funding
    if (signalType === 'BUY' && rate > 0.03) {
      // High positive funding = expensive LONG
      const penalty = Math.min((rate - 0.03) / 0.02, 0.5); // Up to 50% reduction
      return 1.0 - penalty;
    }

    if (signalType === 'SELL' && rate < -0.03) {
      // Negative funding = expensive SHORT
      const penalty = Math.min((Math.abs(rate) - 0.03) / 0.02, 0.5);
      return 1.0 - penalty;
    }

    return 1.0;
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[Funding Rate] Cache cleared');
  }
}

// Singleton instance
export const fundingRateService = new FundingRateService();
