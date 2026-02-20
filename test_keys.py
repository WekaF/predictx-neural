import requests
import time
import hmac
import hashlib
from urllib.parse import urlencode
from dotenv import load_dotenv
import os

load_dotenv('.env.local')

api_key = os.environ.get('VITE_BINANCE_API_KEY_TESTNET')
secret_key = os.environ.get('VITE_BINANCE_API_SECRET_TESTNET')

base_url = 'https://testnet.binancefuture.com'

# Sync time
server_time = requests.get(f"{base_url}/fapi/v1/time").json()['serverTime']
local_time = int(time.time() * 1000)
offset = server_time - local_time
print(f"Server time: {server_time}, Local time: {local_time}, Offset: {offset}")

def signed_request(endpoint):
    timestamp = int(time.time() * 1000) + offset
    params = {'timestamp': timestamp, 'recvWindow': 60000}
    query_string = urlencode(params)
    signature = hmac.new(secret_key.encode('utf-8'), query_string.encode('utf-8'), hashlib.sha256).hexdigest()
    url = f"{base_url}{endpoint}?{query_string}&signature={signature}"
    headers = {'X-MBX-APIKEY': api_key}
    return requests.get(url, headers=headers)

res_pos = signed_request('/fapi/v2/positionRisk')
print("\nPositions Status Code:", res_pos.status_code)
print("Response:", res_pos.text[:500])

res_ord = signed_request('/fapi/v1/openOrders')
print("\nOpen Orders Status Code:", res_ord.status_code)
print("Response:", res_ord.text[:500])

