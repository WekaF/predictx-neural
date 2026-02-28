
import ccxt
import pandas as pd
import yfinance as yf
from datetime import datetime
import time


import ccxt
import pandas as pd
import yfinance as yf
from datetime import datetime
import time
import asyncio

def get_historical_data(symbol: str, period: str = "1mo", interval: str = "1h", limit: int = 1000, include_futures: bool = False) -> dict:
    """
    Fetch historical market data using YFinance (Primary) or CCXT (Fallback).
    """
    df = pd.DataFrame()
    ticker = symbol

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
                df['timestamp'] = pd.to_datetime(df['time']).dt.tz_localize(None).astype('datetime64[ms]')
                df['time'] = df['time'].astype(str)
                print(f"✅ YFinance: Loaded {len(df)} candles for {ticker}")

    except Exception as e:
        print(f"⚠️ YFinance failed: {e}")

    # 2. CCXT Fallback
    if df.empty:
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

            if ohlcv:
                df = pd.DataFrame(ohlcv, columns=['time', 'open', 'high', 'low', 'close', 'volume'])
                df['timestamp'] = pd.to_datetime(df['time'], unit='ms').dt.tz_localize(None).astype('datetime64[ms]')
                df['time'] = df['timestamp'].astype(str)
                print(f"✅ CCXT: Loaded {len(df)} candles for {ccxt_symbol}")

        except Exception as e:
            print(f"❌ All methods failed. CCXT Error: {e}")
            return {"error": str(e)}

    if df.empty:
        return {"error": f"No data found for {symbol}"}

    # 3. Fetch Futures Data if requested
    if include_futures:
        try:
            from services.funding_rate_service import funding_analyzer
            from services.market_sentiment_service import sentiment_analyzer
            
            # Use Binance symbol for futures data
            binance_symbol = symbol.replace("/", "").replace("-", "")
            if "USD" in binance_symbol and "USDT" not in binance_symbol:
                binance_symbol = binance_symbol.replace("USD", "USDT")


            print(f"Fetching historical futures data for {binance_symbol}...")
            
            # Run async fetches in sync wrapper
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            funding_task = funding_analyzer.get_funding_history(binance_symbol, limit=limit)
            oi_task = sentiment_analyzer.get_historical_open_interest(binance_symbol, period=interval, limit=limit)
            ls_task = sentiment_analyzer.get_historical_long_short_ratio(binance_symbol, period=interval, limit=limit)
            
            funding, oi, ls = loop.run_until_complete(asyncio.gather(funding_task, oi_task, ls_task))

            
            # Merge Funding (usually 8h, we'll forward fill for 1h candles)
            # In current implementation funding_analyzer returns list of rates. 
            # We'll just use the current/avg if historical list is not perfectly aligned by timestamp.
            df['fundingRate'] = funding['current'] if funding else 0.0
            
            df.sort_values('timestamp', inplace=True)
            
            # Merge OI (Historically aligned)
            if oi:
                oi_df = pd.DataFrame(oi)
                oi_df['timestamp'] = pd.to_datetime(oi_df['timestamp'], unit='ms').dt.tz_localize(None).astype('datetime64[ms]')
                oi_df.sort_values('timestamp', inplace=True)
                df = pd.merge_asof(df, oi_df, on='timestamp', direction='backward')
            else:
                df['openInterest'] = 0.0
                
            # Merge Long/Short Ratio
            if ls:
                ls_df = pd.DataFrame(ls)
                ls_df['timestamp'] = pd.to_datetime(ls_df['timestamp'], unit='ms').dt.tz_localize(None).astype('datetime64[ms]')
                ls_df.rename(columns={'ratio': 'longShortRatio'}, inplace=True)
                ls_df.sort_values('timestamp', inplace=True)
                df = pd.merge_asof(df, ls_df[['timestamp', 'longShortRatio']], on='timestamp', direction='backward')
            else:
                df['longShortRatio'] = 1.0



            df.ffill(inplace=True)
            df.fillna(0, inplace=True)

            
            print("✅ Futures data merged successfully.")
        except Exception as e:
            print(f"⚠️ Failed to merge futures data: {e}")

    return {
        "symbol": ticker,
        "count": len(df),
        "data": df.drop(columns=['timestamp']).to_dict(orient="records")
    }

