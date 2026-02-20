import os
import time
import requests
import json
import urllib.parse
from dotenv import load_dotenv
from pathlib import Path

import hmac
import hashlib

# Load testnet keys
env_path = Path(__file__).resolve().parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)
api_key = os.environ.get("VITE_BINANCE_API_KEY_TESTNET")
api_secret = os.environ.get("VITE_BINANCE_API_SECRET_TESTNET")

base_url = "https://testnet.binancefuture.com"

# Sync time
r = requests.get(f"{base_url}/fapi/v1/time")
server_time = r.json()['serverTime']
local_time = int(time.time() * 1000)
offset = server_time - local_time

def place_batch(orders):
    timestamp = int(time.time() * 1000) + offset
    
    # 1. Build Query String exactly as frontend does
    query = urllib.parse.urlencode({
        "batchOrders": json.dumps(orders),
        "timestamp": timestamp,
        "recvWindow": 60000
    })
    
    # 2. Sign
    signature = hmac.new(
        api_secret.encode('utf-8'),
        query.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    final_query = f"{query}&signature={signature}"
    url = f"{base_url}/fapi/v1/batchOrders?{final_query}"
    
    print(f"URL Length: {len(url)}")
    
    headers = {
        'X-MBX-APIKEY': api_key,
        'Content-Type': 'application/json' # Frontend sets this for POST (wait, frontend only sets if params.body exists, which is false here. But requests defaults to blank)
    }
    
    # Frontend does fetch(url, { method: 'POST', body: undefined })
    res = requests.post(url, headers=headers)
    print("Status:", res.status_code)
    try:
        print("Response:", json.dumps(res.json(), indent=2))
    except:
        print("Response:", res.text)

print("\n--- TEST 1: Market Entry + SL/TP ---")
orders = [
    {
        "symbol": "BTCUSDT",
        "side": "BUY",
        "type": "MARKET",
        "quantity": "0.005"
    },
    {
        "symbol": "BTCUSDT",
        "side": "SELL",
        "type": "STOP_MARKET",
        "stopPrice": "50000",
        "closePosition": "true",
        "workingType": "MARK_PRICE"
    },
    {
        "symbol": "BTCUSDT",
        "side": "SELL",
        "type": "TAKE_PROFIT_MARKET",
        "stopPrice": "100000",
        "closePosition": "true",
        "workingType": "MARK_PRICE"
    }
]
place_batch(orders)

print("\n--- TEST 2: Limit Entry + SL/TP ---")
orders[0]["type"] = "LIMIT"
orders[0]["price"] = "60000"
orders[0]["timeInForce"] = "GTC"
place_batch(orders)
