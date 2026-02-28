import pandas as pd
import numpy as np

class StrategyConfig:
    """
    Unified Risk & Execution Configuration
    """
    MAX_DRAWDOWN_PER_TRADE = 0.02
    BASE_LEVERAGE = 150
    DEFAULT_SL_PCT = 0.005 
    DEFAULT_TP_PCT = 0.015 
    AUTO_SL_TP = True
    MIN_CONFIDENCE = 20
    OB_VOLUME_FACTOR = 1.2
    
    # LuxAlgo OB Settings
    OB_LENGTH = 5
    MITIGATION_METHOD = 'Wick' # 'Wick' or 'Close'

    TRAILING_CONFIG = {
        "LEVEL_1": {"trigger": 0.002, "sl_move": 0.0,    "tp_move": None},
        "LEVEL_2": {"trigger": 0.005, "sl_move": 0.001,  "tp_move": 0.020},
        "LEVEL_3": {"trigger": 0.010, "sl_move": 0.005,  "tp_move": 0.030}
    }

def detect_lux_order_blocks(df):
    """
    Detects Order Blocks based on LuxAlgo logic.
    """
    length = StrategyConfig.OB_LENGTH
    df = df.copy()
    
    # Calculate Upper/Lower boundaries for trend
    df['upper'] = df['high'].rolling(window=length).max()
    df['lower'] = df['low'].rolling(window=length).min()
    
    # Calculate Trend (OS)
    os = np.zeros(len(df))
    for i in range(length, len(df)):
        # Pine: os := high[length] > upper ? 0 : low[length] < lower ? 1 : os[1]
        # upper/lower in rolling are at current bar (i)
        # high[length] is at i - length
        current_upper = df['upper'].iloc[i]
        current_lower = df['lower'].iloc[i]
        high_at_len = df['high'].iloc[i - length]
        low_at_len = df['low'].iloc[i - length]
        
        if high_at_len > current_upper:
            os[i] = 0
        elif low_at_len < current_lower:
            os[i] = 1
        else:
            os[i] = os[i-1]
    
    df['os'] = os
    
    # Volume Pivot High
    # phv = ta.pivothigh(volume, length, length)
    # This means volume[i-length] is highest in [i-2*length to i]
    df['phv'] = False
    vol_window = 2 * length + 1
    if len(df) >= vol_window:
        rolling_vol_max = df['volume'].rolling(window=vol_window).max()
        # The max of window [i-2*length : i+1] is at some index.
        # If it's at i-length, then phv is True at i.
        # More efficient:
        for i in range(2 * length, len(df)):
            window = df['volume'].iloc[i - 2 * length : i + 1]
            if window.idxmax() == i - length:
                df.at[i, 'phv'] = True

    # Detect OBs
    bullish_obs = []
    bearish_obs = []
    
    for i in range(length, len(df)):
        # Bullish OB condition: phv and os == 1
        if df['phv'].iloc[i] and df['os'].iloc[i] == 1:
            idx = i - length
            bullish_obs.append({
                'top': (df['high'].iloc[idx] + df['low'].iloc[idx]) / 2, # hl2[length]
                'bottom': df['low'].iloc[idx],
                'start_index': idx,
                'timestamp': str(df['time'].iloc[idx] if 'time' in df.columns else df.index[idx]),
                'mitigated': False
            })
            
        # Bearish OB condition: phv and os == 0
        if df['phv'].iloc[i] and df['os'].iloc[i] == 0:
            idx = i - length
            bearish_obs.append({
                'top': df['high'].iloc[idx],
                'bottom': (df['high'].iloc[idx] + df['low'].iloc[idx]) / 2, # hl2[length]
                'start_index': idx,
                'timestamp': str(df['time'].iloc[idx] if 'time' in df.columns else df.index[idx]),
                'mitigated': False
            })
            
        # Mitigation Check
        target_price = df['close'].iloc[i] if StrategyConfig.MITIGATION_METHOD == 'Close' else df['low'].iloc[i]
        # For bullish OB, mitigation happens if price goes below bottom
        for ob in bullish_obs:
            if not ob['mitigated']:
                if StrategyConfig.MITIGATION_METHOD == 'Close':
                    if df['close'].iloc[i] < ob['bottom']:
                        ob['mitigated'] = True
                else:
                    if df['low'].iloc[i] < ob['bottom']:
                        ob['mitigated'] = True
                        
        # For bearish OB, mitigation happens if price goes above top
        target_price_bear = df['close'].iloc[i] if StrategyConfig.MITIGATION_METHOD == 'Close' else df['high'].iloc[i]
        for ob in bearish_obs:
            if not ob['mitigated']:
                if StrategyConfig.MITIGATION_METHOD == 'Close':
                    if df['close'].iloc[i] > ob['top']:
                        ob['mitigated'] = True
                else:
                    if df['high'].iloc[i] > ob['top']:
                        ob['mitigated'] = True
                        
    return bullish_obs, bearish_obs

def get_smc_context(df):
    """
    Returns full SMC context using LuxAlgo OB logic.
    """
    if len(df) < StrategyConfig.OB_LENGTH * 2 + 1:
        return {"score": 0.5, "active_ob": None, "order_blocks": []}

    bull_obs, bear_obs = detect_lux_order_blocks(df)
    
    # Filter active (non-mitigated) OBs
    active_bull = [{**ob, 'type': 'BULLISH_OB'} for ob in bull_obs if not ob['mitigated']]
    active_bear = [{**ob, 'type': 'BEARISH_OB'} for ob in bear_obs if not ob['mitigated']]
    
    latest_close = df['close'].iloc[-1]
    
    context = {
        "score": 0.5,
        "active_ob": None,
        "order_blocks": (active_bull[-2:] + active_bear[-2:]) # Show some latest active obs
    }
    
    # Check if price is currently in a Bullish OB
    if active_bull:
        latest_ob = active_bull[-1]
        # Buffer of 0.5% for "near" OB
        if latest_ob['bottom'] * 0.999 <= latest_close <= latest_ob['top'] * 1.001:
            context['score'] = 0.75
            context['active_ob'] = {**latest_ob, 'type': 'BULLISH_OB'}
            
    # Check if price is currently in a Bearish OB
    if active_bear:
        latest_ob = active_bear[-1]
        if latest_ob['bottom'] * 0.999 <= latest_close <= latest_ob['top'] * 1.001:
            # If already set by bull, maybe prioritize one or average? 
            # Usually price isn't in both unless they overlap.
            context['score'] = 0.25
            context['active_ob'] = {**latest_ob, 'type': 'BEARISH_OB'}
            
    return context

