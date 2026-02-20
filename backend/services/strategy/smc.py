import pandas as pd
import numpy as np

class SMCStrategy:
    """
    Smart Money Concepts (SMC) Strategy Module
    - Order Block (OB) Detection
    - Fibonacci Retracement & Extension
    - Market Structure (BOS/CHOCH) - Simplified
    """

    def detect_order_blocks(self, df: pd.DataFrame, lookback=50):
        """
        Detects potential Order Blocks from OHLCV data.
        Returns the last valid Bullish & Bearish OBs.
        """
        if df.empty:
            return None, None

        df = df.copy()
        df['bullish_ob'] = False
        df['bearish_ob'] = False
        
        # Simplified OB Logic:
        # Bullish OB: Last down candle before a strong up move (break of structure)
        # Bearish OB: Last up candle before a strong down move
        
        # We look for a candle that is engulfed by the next 1-2 candles with strong momentum
        
        obs = []
        
        for i in range(2, len(df) - 2):
            current = df.iloc[i]
            next_candle = df.iloc[i+1]
            prev_candle = df.iloc[i-1]
            
            # Bullish OB Logic
            # 1. Current is RED (Close < Open)
            # 2. Next is GREEN and Engulfs Current (Close > Current Open)
            # 3. Momentum: Next candle body is large
            if current['close'] < current['open']: # Red
                if next_candle['close'] > current['open'] and next_candle['close'] > next_candle['open']:
                    # Potential Bullish OB
                    ob = {
                        "type": "bullish",
                        "top": current['open'],
                        "bottom": current['low'],
                        "index": i,
                        "timestamp": current.name if isinstance(current.name, str) else str(current.name)
                    }
                    obs.append(ob)

            # Bearish OB Logic
            # 1. Current is GREEN (Close > Open)
            # 2. Next is RED and Engulfs Current (Close < Current Open)
            if current['close'] > current['open']: # Green
                if next_candle['close'] < current['open'] and next_candle['close'] < next_candle['open']:
                    # Potential Bearish OB
                    ob = {
                        "type": "bearish",
                        "top": current['high'],
                        "bottom": current['open'],
                        "index": i,
                        "timestamp": current.name if isinstance(current.name, str) else str(current.name)
                    }
                    obs.append(ob)
        
        # Filter: Return only the latest relevant OBs
        # In a real system, we'd check if price has mitigated them or not.
        # For now, return the last found of each type.
        
        last_bullish = next((ob for ob in reversed(obs) if ob['type'] == 'bullish'), None)
        last_bearish = next((ob for ob in reversed(obs) if ob['type'] == 'bearish'), None)
        
        return last_bullish, last_bearish

    def calculate_fib_levels(self, high, low, trend="uptrend"):
        """
        Calculates Fib Retracement (Entry) and Extension (TP).
        """
        diff = high - low
        
        if trend == "uptrend":
            # Retracement (Buy Limit Levels)
            fib_0_5 = high - (diff * 0.5)
            fib_0_618 = high - (diff * 0.618) # Golden Pocket
            fib_0_786 = high - (diff * 0.786)
            
            # Extension (Take Profit)
            ext_1_272 = high + (diff * 0.272)
            ext_1_618 = high + (diff * 0.618)
            
            return {
                "entry_zone": [fib_0_5, fib_0_618],
                "golden_pocket": fib_0_618,
                "tp1": high, # Swing High
                "tp2": ext_1_272,
                "tp3": ext_1_618,
                "sl": low # Swing Low
            }
        else: # downtrend
            # Retracement (Sell Limit Levels)
            fib_0_5 = low + (diff * 0.5)
            fib_0_618 = low + (diff * 0.618)
            fib_0_786 = low + (diff * 0.786)
            
            # Extension (Take Profit)
            ext_1_272 = low - (diff * 0.272)
            ext_1_618 = low - (diff * 0.618)
            
            return {
                "entry_zone": [fib_0_5, fib_0_618],
                "golden_pocket": fib_0_618,
                "tp1": low, # Swing Low
                "tp2": ext_1_272,
                "tp3": ext_1_618,
                "sl": high # Swing High
            }

smc_strategy = SMCStrategy()
