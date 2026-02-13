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

def get_smc_context(df):
    """
    Returns full SMC context: score, active_ob, market_structure
    """
    obs = find_smc_structures(df)
    latest_close = df['close'].iloc[-1]
    
    context = {
        "score": 0.5,
        "active_ob": None,
        "order_blocks": obs[-3:] if obs else [] # Return last 3 OBs for visualization
    }
    
    if not obs:
        return context
    
    # Check if price is inside a Bullish Order Block (Buy Opportunity)
    bullish_obs = [ob for ob in obs if ob['type'] == 'BULLISH_OB']
    if bullish_obs:
        latest_ob = bullish_obs[-1]
        # Check if we are retesting the OB (within range or slightly above)
        if latest_ob['bottom'] <= latest_close <= latest_ob['top'] * 1.01:
            context['score'] = 0.8 # High conviction Bullish
            context['active_ob'] = latest_ob
            return context
            
    # Check if price is inside a Bearish Order Block (Sell Opportunity)
    bearish_obs = [ob for ob in obs if ob['type'] == 'BEARISH_OB']
    if bearish_obs:
        latest_ob = bearish_obs[-1]
        # Check if we are retesting the OB
        if latest_ob['bottom'] * 0.99 <= latest_close <= latest_ob['top']:
            context['score'] = 0.2 # High conviction Bearish
            context['active_ob'] = latest_ob
            return context
            
    return context
