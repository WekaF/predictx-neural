import pandas as pd
import numpy as np

def detect_swing_points(df, window=5):
    """
    Detects Swing Highs and Swing Lows.
    A swing high is the highest point within a window of candles.
    """
    df['swing_high'] = df['high'][(df['high'] == df['high'].rolling(window=window*2+1, center=True).max())]
    df['swing_low'] = df['low'][(df['low'] == df['low'].rolling(window=window*2+1, center=True).min())]
    return df

def find_smc_structures(df):
    """
    Identifies BOS (Break of Structure) and Order Blocks.
    """
    df = detect_swing_points(df)
    
    order_blocks = []
    last_high = None
    last_low = None
    
    # Simple BOS & OB logic
    for i in range(len(df)):
        current_close = df['close'].iloc[i]
        
        # Detect Break of Structure (Bish)
        if last_high and current_close > last_high:
            # Bullish BOS occurred
            # Find the candle responsible for the move (Order Block)
            # Usually the last bearish candle before the expansion
            lookback = 5
            for j in range(i-1, max(0, i-lookback), -1):
                if df['close'].iloc[j] < df['open'].iloc[j]: # Bearish candle
                    order_blocks.append({
                        'type': 'BULLISH_OB',
                        'top': df['high'].iloc[j],
                        'bottom': df['low'].iloc[j],
                        'index': i,
                        'timestamp': df.index[i]
                    })
                    break
            last_high = None # Reset
            
        # Detect Break of Structure (Bearish)
        if last_low and current_close < last_low:
            # Bearish BOS occurred
            lookback = 5
            for j in range(i-1, max(0, i-lookback), -1):
                if df['close'].iloc[j] > df['open'].iloc[j]: # Bullish candle
                    order_blocks.append({
                        'type': 'BEARISH_OB',
                        'top': df['high'].iloc[j],
                        'bottom': df['low'].iloc[j],
                        'index': i,
                        'timestamp': df.index[i]
                    })
                    break
            last_low = None # Reset

        if not pd.isna(df['swing_high'].iloc[i]):
            last_high = df['swing_high'].iloc[i]
        if not pd.isna(df['swing_low'].iloc[i]):
            last_low = df['swing_low'].iloc[i]
            
    return order_blocks

    return order_blocks

def get_fib_levels(low, high, trend="UP"):
    """
    Calculates Fibonacci Extension levels for TP.
    """
    diff = high - low
    if trend == "UP":
        return {
            "tp1": high + (diff * 0.272),
            "tp2": high + (diff * 0.618),
            "tp3": high + (diff * 1.618)
        }
    else:
        return {
            "tp1": low - (diff * 0.272),
            "tp2": low - (diff * 0.618),
            "tp3": low - (diff * 1.618)
        }

def get_smc_context(df):
    """
    Returns full SMC context: score, active_ob, market_structure, entry_setup
    """
    obs = find_smc_structures(df)
    latest_close = df['close'].iloc[-1]
    
    context = {
        "score": 0.5,
        "active_ob": None,
        "order_blocks": obs[-3:] if obs else [], # Return last 3 OBs for visualization
        "setup": None
    }
    
    if not obs:
        return context
    
    # 1. Bullish Setup (Price retesting Bullish OB)
    bullish_obs = [ob for ob in obs if ob['type'] == 'BULLISH_OB']
    if bullish_obs:
        latest_ob = bullish_obs[-1]
        # Check if we are near OB (within 1% above top)
        if latest_close <= latest_ob['top'] * 1.015 and latest_close >= latest_ob['bottom'] * 0.98:
            context['score'] = 0.8
            context['active_ob'] = latest_ob
            
            # Calculate Fibs from recent swing
            # Find recent high since OB creation
            recent_high = df['high'].iloc[latest_ob['index']:].max()
            fibs = get_fib_levels(latest_ob['bottom'], recent_high, "UP")
            
            context['setup'] = {
                "type": "LONG_LIMIT",
                "entry": latest_ob['top'], # Aggressive entry at top of OB
                "sl": latest_ob['bottom'] * 0.995, # Just below OB
                "tp1": fibs['tp1'],
                "tp2": fibs['tp2'],
                "tp3": fibs['tp3']
            }
            return context
            
    # 2. Bearish Setup (Price retesting Bearish OB)
    bearish_obs = [ob for ob in obs if ob['type'] == 'BEARISH_OB']
    if bearish_obs:
        latest_ob = bearish_obs[-1]
        # Check if we are near OB
        if latest_close >= latest_ob['bottom'] * 0.985 and latest_close <= latest_ob['top'] * 1.02:
            context['score'] = 0.2
            context['active_ob'] = latest_ob
            
            # Calculate Fibs
            recent_low = df['low'].iloc[latest_ob['index']:].min()
            fibs = get_fib_levels(recent_low, latest_ob['top'], "DOWN")
            
            context['setup'] = {
                "type": "SHORT_LIMIT",
                "entry": latest_ob['bottom'], # Aggressive entry at bottom of OB
                "sl": latest_ob['top'] * 1.005, # Just above OB
                "tp1": fibs['tp1'],
                "tp2": fibs['tp2'],
                "tp3": fibs['tp3']
            }
            return context
            
    return context
