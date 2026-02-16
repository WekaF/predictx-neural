import requests
import time
import hmac
import hashlib
import os
from dotenv import load_dotenv

# Load environment variables from .env.local in parent directory
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local')
print(f"Loading env from: {env_path}")
load_dotenv(dotenv_path=env_path)

API_KEY = os.getenv("VITE_BINANCE_API_KEY_TESTNET")
SECRET_KEY = os.getenv("VITE_BINANCE_API_SECRET_TESTNET")
BASE_URL = "http://localhost:8000/api/proxy"

print(f"Testing with Key: {API_KEY[:5]}...")

def get_signature(params):
    query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
    return hmac.new(SECRET_KEY.encode('utf-8'), query_string.encode('utf-8'), hashlib.sha256).hexdigest()

# 1. Test Connectivity (Server Time)
print("\n[Test 1] Fetching Server Time...")
time_offset = 0
try:
    resp = requests.get(f"{BASE_URL}/fapi/v1/time?testnet=true")
    print(f"Response ({resp.status_code}): {resp.text}")
    server_time = resp.json().get('serverTime')
    local_time = int(time.time() * 1000)
    time_offset = server_time - local_time
    print(f"Server Time: {server_time}, Local: {local_time}, Offset: {time_offset}ms")
except Exception as e:
    print(f"Failed: {e}")
    exit(1)

# 2. Test Account Information (Balance)
print("\n[Test 2] Fetching Account Balance...")
params = {
    "timestamp": int(time.time() * 1000) + time_offset - 1000,
    "recvWindow": 20000
}
params['signature'] = get_signature(params)

try:
    # Construct URL with query params manually for get request through proxy? 
    # The proxy forwards query params from request.query_params
    # We need to pass them in the URL to the proxy
    query = '&'.join([f"{k}={v}" for k, v in params.items()])
    resp = requests.get(f"{BASE_URL}/fapi/v2/balance?testnet=true&{query}", headers={"X-MBX-APIKEY": API_KEY})
    print(f"Response ({resp.status_code}): {resp.text[:200]}...")
except Exception as e:
    print(f"Failed: {e}")

# 3. Test Order Placement (Limit Order far away)
print("\n[Test 3] Placing LIMIT Order (BTCUSDT)...")
order_params = {
    "symbol": "BTCUSDT",
    "side": "BUY",
    "type": "LIMIT",
    "timeInForce": "GTC",
    "quantity": 0.001,
    "price": 10000, # Far below price
    "timestamp": int(time.time() * 1000) + time_offset - 1000,
    "recvWindow": 20000
}
order_params['signature'] = get_signature(order_params)

try:
    # Post request
    query = '&'.join([f"{k}={v}" for k, v in order_params.items()])
    resp = requests.post(f"{BASE_URL}/fapi/v1/order?testnet=true&{query}", headers={"X-MBX-APIKEY": API_KEY})
    print(f"Response ({resp.status_code}): {resp.text}")
except Exception as e:
    print(f"Failed: {e}")
