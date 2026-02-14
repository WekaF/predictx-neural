"""
Binance Futures Funding Rate Service
Analyzes funding rates to avoid expensive positions
"""

import aiohttp
import asyncio
from typing import Dict, List, Optional, Tuple
from datetime import datetime

class FundingRateAnalyzer:
    def __init__(self):
        self.base_url = "https://fapi.binance.com/fapi/v1"
        self.cache = {}
        self.cache_duration = 3600  # 1 hour cache (funding updates every 8h)
    
    async def get_current_funding_rate(self, symbol: str = "BTCUSDT") -> Optional[Dict]:
        """
        Get current funding rate from Binance Futures
        
        Returns:
            {
                "symbol": "BTCUSDT",
                "rate": 0.0001,
                "time": 1234567890,
                "annual_rate": 10.95  # Annualized percentage
            }
        """
        cache_key = f"funding_{symbol}"
        
        # Check cache
        if cache_key in self.cache:
            cached_data, cached_time = self.cache[cache_key]
            if (datetime.now().timestamp() - cached_time) < self.cache_duration:
                return cached_data
        
        endpoint = f"{self.base_url}/fundingRate"
        params = {"symbol": symbol, "limit": 1}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        if data and len(data) > 0:
                            rate = float(data[0]["fundingRate"])
                            result = {
                                "symbol": symbol,
                                "rate": rate,
                                "time": data[0]["fundingTime"],
                                "annual_rate": rate * 3 * 365 * 100  # 3x per day, as percentage
                            }
                            
                            # Cache result
                            self.cache[cache_key] = (result, datetime.now().timestamp())
                            return result
                    else:
                        print(f"[Funding Rate] API Error {response.status}")
                        return None
        except Exception as e:
            print(f"[Funding Rate] Exception: {e}")
            return None
    
    async def get_funding_history(self, symbol: str = "BTCUSDT", limit: int = 100) -> Optional[Dict]:
        """
        Analyze funding rate trends over time
        
        Returns:
            {
                "current": 0.0001,
                "avg_7d": 0.00015,
                "trend": "BULLISH" | "BEARISH" | "NEUTRAL",
                "extreme": False,
                "history": [...]
            }
        """
        endpoint = f"{self.base_url}/fundingRate"
        params = {"symbol": symbol, "limit": limit}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        if not data:
                            return None
                        
                        rates = [float(r["fundingRate"]) for r in data]
                        current = rates[0] if rates else 0
                        avg_rate = sum(rates) / len(rates) if rates else 0
                        
                        # Determine trend
                        if avg_rate > 0.01:
                            trend = "BULLISH"  # High positive funding = many longs
                        elif avg_rate < -0.01:
                            trend = "BEARISH"  # Negative funding = many shorts
                        else:
                            trend = "NEUTRAL"
                        
                        # Check if extreme (potential reversal signal)
                        extreme = abs(avg_rate) > 0.05
                        
                        return {
                            "symbol": symbol,
                            "current": current,
                            "avg_7d": avg_rate,
                            "trend": trend,
                            "extreme": extreme,
                            "history": rates[:20]  # Last 20 funding rates
                        }
                    else:
                        print(f"[Funding History] API Error {response.status}")
                        return None
        except Exception as e:
            print(f"[Funding History] Exception: {e}")
            return None
    
    def should_avoid_trade(self, signal_type: str, funding_data: Dict) -> Tuple[bool, str]:
        """
        Determine if trade should be avoided due to unfavorable funding
        
        Args:
            signal_type: "BUY" or "SELL"
            funding_data: Result from get_funding_history()
        
        Returns:
            (should_block, reason)
        """
        if not funding_data:
            return False, "No funding data available"
        
        rate = funding_data.get("current", 0)
        
        # Avoid LONG if funding is extremely positive (expensive to hold)
        if signal_type == "BUY" and rate > 0.05:
            return True, f"Funding too high ({rate*100:.3f}%) - expensive to hold LONG"
        
        # Avoid SHORT if funding is extremely negative
        if signal_type == "SELL" and rate < -0.05:
            return True, f"Funding too negative ({rate*100:.3f}%) - expensive to hold SHORT"
        
        # Warning for moderately high funding
        if signal_type == "BUY" and rate > 0.03:
            return False, f"High funding rate ({rate*100:.3f}%) - consider reducing position size"
        
        if signal_type == "SELL" and rate < -0.03:
            return False, f"Negative funding rate ({rate*100:.3f}%) - consider reducing position size"
        
        return False, "Funding OK"
    
    def get_confidence_adjustment(self, signal_type: str, funding_data: Dict) -> float:
        """
        Calculate confidence adjustment based on funding rate
        
        Returns:
            Multiplier (0.5 - 1.0) to apply to confidence
        """
        if not funding_data:
            return 1.0
        
        rate = funding_data.get("current", 0)
        
        # Reduce confidence for unfavorable funding
        if signal_type == "BUY" and rate > 0.03:
            # High positive funding = expensive LONG
            penalty = min((rate - 0.03) / 0.02, 0.5)  # Up to 50% reduction
            return 1.0 - penalty
        
        if signal_type == "SELL" and rate < -0.03:
            # Negative funding = expensive SHORT
            penalty = min((abs(rate) - 0.03) / 0.02, 0.5)
            return 1.0 - penalty
        
        return 1.0

# Singleton instance
funding_analyzer = FundingRateAnalyzer()
