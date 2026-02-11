
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

def generate_chart_windows(df, window_size=20):
    \"\"\"
    Generate sliding windows of OHLC data for CNN training

    Args:
        df: DataFrame with columns ['open', 'high', 'low', 'close']
        window_size: Number of candles per window

    Returns:
        windows: numpy array (n_windows, window_size, 4)
        labels: numpy array (n_windows, 1) - 1 if next candle is bullish, 0 if bearish
    \"\"\"
    windows = []
    labels = []

    # Normalize OHLC data
    scaler = MinMaxScaler()
    ohlc_data = df[['open', 'high', 'low', 'close']].values

    for i in range(len(df) - window_size - 1):
        # Extract window
        window = ohlc_data[i:i+window_size]

        # Normalize window (0-1 range)
        window_normalized = scaler.fit_transform(window)

        # Label: Is next candle bullish?
        next_close = df.iloc[i + window_size]['close']
        current_close = df.iloc[i + window_size - 1]['close']
        label = 1.0 if next_close > current_close else 0.0

        windows.append(window_normalized)
        labels.append(label)

    return np.array(windows), np.array(labels).reshape(-1, 1)

def detect_candlestick_patterns(window):
    \"\"\"
    Detect common candlestick patterns in a window

    Args:
        window: numpy array (n, 4) - OHLC data

    Returns:
        patterns: dict with pattern names and confidence scores
    \"\"\"
    patterns = {}

    # Get last candle
    if len(window) < 1:
        return patterns

    last = window[-1]
    o, h, l, c = last[0], last[1], last[2], last[3]

    body = abs(c - o)
    range_hl = h - l

    if range_hl == 0:
        return patterns

    # Doji: Small body relative to range
    if body / range_hl < 0.1:
        patterns['doji'] = 0.8

    # Hammer: Long lower shadow, small body at top
    lower_shadow = min(o, c) - l
    upper_shadow = h - max(o, c)
    if lower_shadow > 2 * body and upper_shadow < body:
        patterns['hammer'] = 0.7

    # Engulfing (need 2 candles)
    if len(window) >= 2:
        prev = window[-2]
        prev_o, prev_c = prev[0], prev[3]

        # Bullish engulfing
        if prev_c < prev_o and c > o and c > prev_o and o < prev_c:
            patterns['bullish_engulfing'] = 0.9

        # Bearish engulfing
        if prev_c > prev_o and c < o and c < prev_o and o > prev_c:
            patterns['bearish_engulfing'] = 0.9

    return patterns

def prepare_cnn_input(candles, window_size=20):
    \"\"\"
    Prepare candle data for CNN input

    Args:
        candles: list of dicts with OHLC data
        window_size: Number of candles to use

    Returns:
        numpy array (window_size, 4) ready for CNN
    \"\"\"
    if len(candles) < window_size:
        return None

    # Extract last window_size candles
    recent_candles = candles[-window_size:]

    # Convert to OHLC array
    ohlc = np.array([
        [c['open'], c['high'], c['low'], c['close']]
        for c in recent_candles
    ])

    # Normalize
    scaler = MinMaxScaler()
    ohlc_normalized = scaler.fit_transform(ohlc)

    return ohlc_normalized
