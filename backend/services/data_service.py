import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

def get_historical_data(symbol: str, period: str = "1mo", interval: str = "1h") -> dict:
    """
    Fetch historical market data from Yahoo Finance.
    
    Args:
        symbol (str): Ticker symbol (e.g., "BTC-USD", "AAPL")
        period (str): Data period to download (default: "1mo")
        interval (str): Data interval (default: "1h")
        
    Returns:
        dict: Processed data including candles and metadata
    """
    print(f"Fetching data for {symbol} ({period}, {interval})...")
    
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            return {"error": f"No data found for symbol {symbol}"}
            
        # Reset index to make Date a column
        df.reset_index(inplace=True)
        
        # Renaissance of column names to match frontend expectations (lowercase)
        df.rename(columns={
            "Date": "time",
            "Datetime": "time", 
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume"
        }, inplace=True)
        
        # Convert timezone-aware datetime to string for JSON serialization
        if 'time' in df.columns:
            df['time'] = df['time'].astype(str)
            
        # Select only required columns
        required_cols = ['time', 'open', 'high', 'low', 'close', 'volume']
        df = df[required_cols]
        
        return {
            "symbol": symbol,
            "count": len(df),
            "data": df.to_dict(orient="records")
        }
        
    except Exception as e:
        return {"error": str(e)}
