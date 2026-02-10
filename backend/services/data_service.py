import ccxt
import pandas as pd
from datetime import datetime
import time

def get_historical_data(symbol: str, period: str = "1mo", interval: str = "1h", limit: int = 1000) -> dict:
    """
    Fetch historical market data from Binance using CCXT.
    
    Args:
        symbol (str): Ticker symbol (e.g., "BTC-USD", "BTC/USDT")
        period (str): Ignored in CCXT (calculated from limit/since), kept for API compatibility.
        interval (str): Data interval (default: "1h")
        limit (int): Number of candles to fetch (default: 1000)
        
    Returns:
        dict: Processed data including candles and metadata
    """
    print(f"Fetching data for {symbol} (Interval: {interval}) using CCXT/Binance...")

    try:
        # Initialize Binance Exchange
        exchange = ccxt.binance()
        
        # Normalize symbol: CCXT expects "BTC/USDT", Frontend might send "BTC-USD" or "BTCUSDT"
        # 1. Replace first hyphen with slash if exists (BTC-USD -> BTC/USD)
        if "-" in symbol:
            symbol = symbol.replace("-", "/")
        # 2. If no slash, assumes it might be raw (BTCUSDT), let CCXT try or manually fix if needed.
        # But for "BTC-USD" from frontend, it usually means BTC/USDT in Binance terms.
        if "USD" in symbol and "USDT" not in symbol:
             symbol = symbol.replace("USD", "USDT")
        
        # Ensure it has a slash for CCXT
        if "/" not in symbol and len(symbol) > 6: 
             # Rough heuristic: insert slash before last 4 chars (USDT) or 3 chars (BTC)
             # Better: just force standard map if known.
             if symbol.endswith("USDT"):
                 symbol = symbol[:-4] + "/USDT"
        
        print(f"Normalized symbol for Binance: {symbol}")

        # Map 'period' to limit/since if needed, but for now we'll fetch a fixed amount suitable for training
        # If period is "1mo", 1h candles = 24 * 30 = 720 candles.
        # Binance call limit is 1000.
        fetch_limit = min(limit, 1000)
        
        # Fetch OHLCV
        # timestamp, open, high, low, close, volume
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe=interval, limit=fetch_limit)
        
        if not ohlcv:
             return {"error": f"No data found for symbol {symbol}"}

        # Convert to DataFrame
        df = pd.DataFrame(ohlcv, columns=['time', 'open', 'high', 'low', 'close', 'volume'])
        
        # Process timestamps (ms to datetime string)
        df['time'] = pd.to_datetime(df['time'], unit='ms').astype(str)
        
        return {
            "symbol": symbol,
            "count": len(df),
            "data": df.to_dict(orient="records")
        }
        
    except Exception as e:
        print(f"CCXT Error: {e}")
        return {"error": str(e)}
