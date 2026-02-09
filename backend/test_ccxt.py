from services.data_service import get_historical_data
import pandas as pd

try:
    print("Testing CCXT data fetch...")
    result = get_historical_data("BTC-USD", interval="1h")
    
    if "error" in result:
        print(f"FAILED: {result['error']}")
    else:
        print(f"SUCCESS: Fetched {result['count']} candles for {result['symbol']}")
        df = pd.DataFrame(result['data'])
        print(df.head())
        print(df.tail())

except Exception as e:
    print(f"CRITICAL ERROR: {e}")
