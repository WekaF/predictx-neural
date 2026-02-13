import numpy as np
import pandas as pd

def generate_chart_windows(df, window_size=20):
    """
    Generates windows of candlestick data and labels for CNN training.
    Label 1 if price goes up in the next 3 candles, 0 otherwise.
    """
    windows = []
    labels = []
    
    # Kita butuh OHLC yang sudah dinormalisasi
    # Menggunakan persentase perubahan agar stationary
    df['open_n'] = (df['open'] - df['close'].shift(1)) / df['close'].shift(1)
    df['high_n'] = (df['high'] - df['close'].shift(1)) / df['close'].shift(1)
    df['low_n'] = (df['low'] - df['close'].shift(1)) / df['close'].shift(1)
    df['close_n'] = (df['close'] - df['close'].shift(1)) / df['close'].shift(1)
    
    df.dropna(inplace=True)
    
    features = ['open_n', 'high_n', 'low_n', 'close_n']
    data = df[features].values
    close_prices = df['close'].values

    for i in range(len(data) - window_size - 3):
        # Ambil window data (misal 20 candle)
        window = data[i : i + window_size]
        
        # Labeling: Jika harga close 3 candle ke depan lebih tinggi dari close sekarang
        future_price = close_prices[i + window_size + 2]
        current_price = close_prices[i + window_size - 1]
        
        label = 1 if future_price > current_price else 0
        
        windows.append(window)
        labels.append(label)
        
    return np.array(windows), np.array(labels)

def prepare_cnn_input(candles, window_size=20):
    """
    Helper untuk ai_engine dalam memproses input real-time/backtest
    """
    if len(candles) < window_size + 1:
        return None
        
    df = pd.DataFrame(candles).tail(window_size + 1).copy()
    
    # Normalisasi yang sama dengan saat training
    df['open_n'] = (df['open'] - df['close'].shift(1)) / df['close'].shift(1)
    df['high_n'] = (df['high'] - df['close'].shift(1)) / df['close'].shift(1)
    df['low_n'] = (df['low'] - df['close'].shift(1)) / df['close'].shift(1)
    df['close_n'] = (df['close'] - df['close'].shift(1)) / df['close'].shift(1)
    
    df.dropna(inplace=True)
    
    if len(df) < window_size:
        return None
        
    features = ['open_n', 'high_n', 'low_n', 'close_n']
    # Output: (1, features, sequence) untuk PyTorch
    window = df[features].values
    window = torch.FloatTensor(window).permute(1, 0).unsqueeze(0)
    return window