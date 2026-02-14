"""
Binance Futures Market Sentiment Service
Analyzes Open Interest, Long/Short Ratio, and Taker Buy/Sell Ratio
"""

import aiohttp
from typing import Dict, Optional
from datetime import datetime

class MarketSentimentAnalyzer:
    def __init__(self):
        self.base_url = "https://fapi.binance.com"
        self.cache = {}
        self.cache_duration = 300  # 5 minutes cache
    
    async def get_open_interest(self, symbol: str = "BTCUSDT") -> Optional[Dict]:
        """
        Get current Open Interest
        
        High OI + Price increase = Strong trend
        High OI + Price decrease = Potential reversal
        
        Returns:
            {
                "symbol": "BTCUSDT",
                "open_interest": 123456.78,
                "timestamp": 1234567890
            }
        """
        cache_key = f"oi_{symbol}"
        
        # Check cache
        if cache_key in self.cache:
            cached_data, cached_time = self.cache[cache_key]
            if (datetime.now().timestamp() - cached_time) < self.cache_duration:
                return cached_data
        
        endpoint = f"{self.base_url}/fapi/v1/openInterest"
        params = {"symbol": symbol}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        result = {
                            "symbol": symbol,
                            "open_interest": float(data["openInterest"]),
                            "timestamp": data["time"]
                        }
                        
                        # Cache result
                        self.cache[cache_key] = (result, datetime.now().timestamp())
                        return result
                    else:
                        print(f"[Open Interest] API Error {response.status}")
                        return None
        except Exception as e:
            print(f"[Open Interest] Exception: {e}")
            return None
    
    async def get_long_short_ratio(self, symbol: str = "BTCUSDT", period: str = "5m") -> Optional[Dict]:
        """
        Get Long/Short Account Ratio
        
        Ratio > 1 = More longs (potential SHORT opportunity - contrarian)
        Ratio < 1 = More shorts (potential LONG opportunity - contrarian)
        
        Returns:
            {
                "symbol": "BTCUSDT",
                "ratio": 1.23,
                "signal": "BEARISH" | "BULLISH" | "NEUTRAL",
                "long_account": 0.55,
                "short_account": 0.45
            }
        """
        endpoint = f"{self.base_url}/futures/data/globalLongShortAccountRatio"
        params = {"symbol": symbol, "period": period, "limit": 30}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        if data and len(data) > 0:
                            latest = data[0]
                            ratio = float(latest["longShortRatio"])
                            
                            # Contrarian signal
                            # Too many longs = potential SHORT opportunity
                            # Too many shorts = potential LONG opportunity
                            if ratio > 2.0:
                                signal = "BEARISH"  # Too many longs, expect reversal down
                            elif ratio < 0.5:
                                signal = "BULLISH"  # Too many shorts, expect reversal up
                            else:
                                signal = "NEUTRAL"
                            
                            return {
                                "symbol": symbol,
                                "ratio": ratio,
                                "signal": signal,
                                "long_account": float(latest["longAccount"]),
                                "short_account": float(latest["shortAccount"]),
                                "timestamp": latest["timestamp"]
                            }
                    else:
                        print(f"[Long/Short Ratio] API Error {response.status}")
                        return None
        except Exception as e:
            print(f"[Long/Short Ratio] Exception: {e}")
            return None
    
    async def get_taker_buy_sell_ratio(self, symbol: str = "BTCUSDT", period: str = "5m") -> Optional[Dict]:
        """
        Get Taker Buy/Sell Volume Ratio
        
        Ratio > 1 = Aggressive buying (bullish)
        Ratio < 1 = Aggressive selling (bearish)
        
        Returns:
            {
                "symbol": "BTCUSDT",
                "ratio": 1.05,
                "signal": "BULLISH" | "BEARISH" | "NEUTRAL"
            }
        """
        endpoint = f"{self.base_url}/futures/data/takerlongshortRatio"
        params = {"symbol": symbol, "period": period, "limit": 30}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        if data and len(data) > 0:
                            latest = data[0]
                            ratio = float(latest["buySellRatio"])
                            
                            # Direct signal (not contrarian)
                            if ratio > 1.2:
                                signal = "BULLISH"  # Strong buying pressure
                            elif ratio < 0.8:
                                signal = "BEARISH"  # Strong selling pressure
                            else:
                                signal = "NEUTRAL"
                            
                            return {
                                "symbol": symbol,
                                "ratio": ratio,
                                "signal": signal,
                                "buy_volume": float(latest["buyVol"]),
                                "sell_volume": float(latest["sellVol"]),
                                "timestamp": latest["timestamp"]
                            }
                    else:
                        print(f"[Taker Ratio] API Error {response.status}")
                        return None
        except Exception as e:
            print(f"[Taker Ratio] Exception: {e}")
            return None
    
    async def get_comprehensive_sentiment(self, symbol: str = "BTCUSDT") -> Dict:
        """
        Get all sentiment indicators in one call
        
        Returns:
            {
                "symbol": "BTCUSDT",
                "open_interest": {...},
                "long_short_ratio": {...},
                "taker_ratio": {...},
                "overall_sentiment": "BULLISH" | "BEARISH" | "NEUTRAL"
            }
        """
        # Fetch all data concurrently
        oi_data = await self.get_open_interest(symbol)
        ls_data = await self.get_long_short_ratio(symbol)
        taker_data = await self.get_taker_buy_sell_ratio(symbol)
        
        # Determine overall sentiment
        signals = []
        if ls_data:
            signals.append(ls_data["signal"])
        if taker_data:
            signals.append(taker_data["signal"])
        
        # Count signals
        bullish_count = signals.count("BULLISH")
        bearish_count = signals.count("BEARISH")
        
        if bullish_count > bearish_count:
            overall = "BULLISH"
        elif bearish_count > bullish_count:
            overall = "BEARISH"
        else:
            overall = "NEUTRAL"
        
        return {
            "symbol": symbol,
            "open_interest": oi_data,
            "long_short_ratio": ls_data,
            "taker_ratio": taker_data,
            "overall_sentiment": overall
        }

    async def get_historical_open_interest(self, symbol: str = "BTCUSDT", period: str = "1h", limit: int = 500) -> Optional[List[Dict]]:
        """
        Get historical Open Interest
        Endpoint: GET /fapi/v1/openInterestHist
        """
        endpoint = f"{self.base_url}/fapi/v1/openInterestHist"
        params = {"symbol": symbol, "period": period, "limit": limit}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Format: [{"symbol":"BTCUSDT", "sumOpenInterest": "123.4", "sumOpenInterestValue": "456.7", "timestamp": 123...}, ...]
                        return [{
                            "timestamp": item["timestamp"],
                            "open_interest": float(item["sumOpenInterest"]),
                            "open_interest_value": float(item["sumOpenInterestValue"])
                        } for item in data]
                    else:
                        print(f"[Hist OI] API Error {response.status}")
                        return None
        except Exception as e:
            print(f"[Hist OI] Exception: {e}")
            return None

    async def get_historical_long_short_ratio(self, symbol: str = "BTCUSDT", period: str = "1h", limit: int = 500) -> Optional[List[Dict]]:
        """
        Get historical Top Trader Long/Short Ratio (Accounts)
        Endpoint: GET /futures/data/globalLongShortAccountRatio
        """
        endpoint = f"{self.base_url}/futures/data/globalLongShortAccountRatio"
        params = {"symbol": symbol, "period": period, "limit": limit}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Format: [{"symbol":"BTCUSDT", "longShortRatio": "1.2", "longAccount": "0.55", "shortAccount": "0.45", "timestamp": 123...}]
                        return [{
                            "timestamp": item["timestamp"],
                            "ratio": float(item["longShortRatio"]),
                            "long_account": float(item["longAccount"]),
                            "short_account": float(item["shortAccount"])
                        } for item in data]
                    else:
                        print(f"[Hist LSR] API Error {response.status}")
                        return None
        except Exception as e:
            print(f"[Hist LSR] Exception: {e}")
            return None

    async def get_historical_taker_ratio(self, symbol: str = "BTCUSDT", period: str = "1h", limit: int = 500) -> Optional[List[Dict]]:
        """
        Get historical Taker Buy/Sell Volume Ratio
        Endpoint: GET /futures/data/takerlongshortRatio
        """
        endpoint = f"{self.base_url}/futures/data/takerlongshortRatio"
        params = {"symbol": symbol, "period": period, "limit": limit}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Format: [{"buySellRatio": "1.1", "buyVol": "100", "sellVol": "90", "timestamp": 123...}]
                        return [{
                            "timestamp": item["timestamp"],
                            "ratio": float(item["buySellRatio"]),
                            "buy_volume": float(item["buyVol"]),
                            "sell_volume": float(item["sellVol"])
                        } for item in data]
                    else:
                        print(f"[Hist Taker] API Error {response.status}")
                        return None
        except Exception as e:
            print(f"[Hist Taker] Exception: {e}")
            return None

# Singleton instance
sentiment_analyzer = MarketSentimentAnalyzer()
