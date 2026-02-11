
import ccxt
import pandas as pd
import yfinance as yf
from datetime import datetime
import time

def get_historical_data(symbol: str, period: str = "1mo", interval: str = "1h", limit: int = 1000) -> dict:
    """
    Fetch historical market data using YFinance (Primary) or CCXT (Fallback).
    """
    # 1. Try YFinance First (Better reliability for historical data)
    try:
        print(f"Fetching data for {symbol} using YFinance...")
        
        # Map symbol: BTC/USDT -> BTC-USD for YFinance
        ticker = symbol.replace("/", "-").replace("USDT", "USD")
        if "USD" not in ticker and "-" not in ticker:
             ticker += "-USD"

        # Fetch
        data = yf.download(ticker, period=period, interval=interval, progress=False)
        
        if not data.empty:
            # Handle MultiIndex columns (yfinance > 0.2 can return (Price, Ticker))
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            # Reset index to get Date/Datetime as column
            data.reset_index(inplace=True)
            
            # Normalize columns to lowercase
            data.columns = [c.lower() for c in data.columns]
            
            # Rename common columns to standard
            rename_map = {
                "date": "time", "datetime": "time",
                "adj close": "adj_close" 
            }
            data.rename(columns=rename_map, inplace=True)
            
            # Verify required columns exist
            required = ['time', 'open', 'high', 'low', 'close', 'volume']
            if all(col in data.columns for col in required):
                # Select only required
                df = data[required].copy()
                df['time'] = df['time'].astype(str)
                
                print(f"✅ YFinance: Loaded {len(df)} candles for {ticker}")
                return {
                    "symbol": ticker,
                    "count": len(df),
                    "data": df.to_dict(orient="records")
                }
            else:
                print(f"⚠️ YFinance missing columns: {data.columns.tolist()}")

    except Exception as e:
        print(f"⚠️ YFinance failed: {e}")

    # 2. CCXT Fallback
    print(f"⚠️ Switching to CCXT/Binance fallback for {symbol}...")
    try:
        exchange = ccxt.binance()
        
        # Normalize symbol for CCXT
        ccxt_symbol = symbol
        if "-" in ccxt_symbol:
            ccxt_symbol = ccxt_symbol.replace("-", "/")
        if "USD" in ccxt_symbol and "USDT" not in ccxt_symbol:
             ccxt_symbol = ccxt_symbol.replace("USD", "USDT")
        
        # Fetch
        fetch_limit = min(limit, 1000)
        ohlcv = exchange.fetch_ohlcv(ccxt_symbol, timeframe=interval, limit=fetch_limit)

        if not ohlcv:
             return {"error": f"No data found for {symbol} (CCXT)"}

        df = pd.DataFrame(ohlcv, columns=['time', 'open', 'high', 'low', 'close', 'volume'])
        df['time'] = pd.to_datetime(df['time'], unit='ms').astype(str)
        
        print(f"✅ CCXT: Loaded {len(df)} candles for {ccxt_symbol}")
        return {
            "symbol": ccxt_symbol,
            "count": len(df),
            "data": df.to_dict(orient="records")
        }

    except Exception as e:
        print(f"❌ All methods failed. CCXT Error: {e}")
        return {"error": str(e)}
