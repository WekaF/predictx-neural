import requests
import json

def test_proxy_klines():
    # Simulate Frontend Request (as updated in binanceService.ts)
    # URL: http://127.0.0.1:8000/api/proxy/fapi/v1/klines
    # Query: symbol=BTCUSDT&interval=1h&limit=5&testnet=true
    
    url = "http://127.0.0.1:8000/api/proxy/fapi/v1/klines"
    params = {
        "symbol": "BTCUSDT",
        "interval": "1h",
        "limit": 5,
        "testnet": "true"
    }
    
    print(f"Testing Proxy URL: {url}")
    print(f"Params: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Success! Data received:")
            print(json.dumps(data[:1], indent=2)) # Print first candle
            return True
        else:
            print(f"❌ Failed. Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

if __name__ == "__main__":
    test_proxy_klines()
