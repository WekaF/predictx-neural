import requests
import time
import hashlib
import hmac
import json

# keys
API_KEY = "WaBJscL1raLkhUB2KcyyiTxNguObcqeWYELLeTxkXvVZbJpygUxYQuvgbl9HQEjK"
SECRET_KEY = "E0FGnI6a4NV5e16w5vrYgmrn2I2Asw57qS9lHLFZ1B9JgVvEEKMJ91rfCvIDYqeJ"

def get_signature(params, secret):
    query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
    return hmac.new(secret.encode('utf-8'), query_string.encode('utf-8'), hashlib.sha256).hexdigest()

def get_server_time(base_url, path):
    try:
        r = requests.get(f"{base_url}{path}")
        return r.json()['serverTime']
    except:
        return int(time.time() * 1000)

def test_signed_endpoint(name, base_url, time_path, account_path):
    print(f"\n--- Testing {name} ---")
    
    # 1. Sync Time
    server_time = get_server_time(base_url, time_path)
    print(f"Server Time: {server_time}")
    
    # 2. Prepare Request
    params = {
        'timestamp': server_time, # Use server time directly
        'recvWindow': 60000 
    }
    
    signature = get_signature(params, SECRET_KEY)
    params['signature'] = signature
    headers = {'X-MBX-APIKEY': API_KEY}
    
    url = f"{base_url}{account_path}"
    
    try:
        response = requests.get(url, headers=headers, params=params)
        print(f"Request URL: {response.url}")
        print(f"Status: {response.status_code}")
        print(f"Body: {response.text}")
        
        if response.status_code == 200:
            print(f"✅ SUCCESS! Keys work on {name}")
            return True
        else:
            print(f"❌ FAILED on {name}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

# Test Futures Testnet (v1 and v2)
test_signed_endpoint("Futures Testnet (v1)", "https://testnet.binancefuture.com", "/fapi/v1/time", "/fapi/v1/account")
test_signed_endpoint("Futures Testnet (v2)", "https://testnet.binancefuture.com", "/fapi/v1/time", "/fapi/v2/account")

# Test Spot Testnet
test_signed_endpoint("Spot Testnet", "https://testnet.binance.vision", "/api/v3/time", "/api/v3/account")

