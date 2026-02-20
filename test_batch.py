import requests
import time
import hmac
import hashlib
from urllib.parse import urlencode, quote
from dotenv import load_dotenv
import os
import json

load_dotenv('.env.local')

api_key = os.environ.get('VITE_BINANCE_API_KEY_TESTNET')
secret_key = os.environ.get('VITE_BINANCE_API_SECRET_TESTNET')
base_url = 'https://testnet.binancefuture.com'

server_time = requests.get(f"{base_url}/fapi/v1/time").json()['serverTime']
local_time = int(time.time() * 1000)
offset = server_time - local_time

# Test 1: URL Encoded JSON (Binance correct way)
orders = [{"symbol": "BTCUSDT", "side": "BUY", "type": "MARKET", "quantity": "0.001"}]
json_str = json.dumps(orders)

timestamp = int(time.time() * 1000) + offset
# The standard way: we encode the json string for the query string
encoded_json = quote(json_str)

# Query string should be exactly what we sign
query_string = f"batchOrders={encoded_json}&timestamp={timestamp}&recvWindow=60000"
signature = hmac.new(secret_key.encode('utf-8'), query_string.encode('utf-8'), hashlib.sha256).hexdigest()

url = f"{base_url}/fapi/v1/batchOrders?{query_string}&signature={signature}"
headers = {'X-MBX-APIKEY': api_key}
res = requests.post(url, headers=headers)
print("Encoded Signature Response:", res.status_code, res.text)


# Test 2: Unencoded JSON signature (What the TS code is doing)
timestamp = int(time.time() * 1000) + offset
# Generate signature on UNENCODED json
unencoded_query_string = f"batchOrders={json_str}&timestamp={timestamp}&recvWindow=60000"
signature2 = hmac.new(secret_key.encode('utf-8'), unencoded_query_string.encode('utf-8'), hashlib.sha256).hexdigest()

# Send URL using requests which will likely encode the URL before sending
res2 = requests.post(f"{base_url}/fapi/v1/batchOrders?{unencoded_query_string}&signature={signature2}", headers=headers)
print("Unencoded Signature Response:", res2.status_code, res2.text)

