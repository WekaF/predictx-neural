import requests
import time
import hashlib
import hmac
import json

# Demo Keys
API_KEY = "WaBJscL1raLkhUB2KcyyiTxNguObcqeWYELLeTxkXvVZbJpygUxYQuvgbl9HQEjK"
SECRET_KEY = "E0FGnI6a4NV5e16w5vrYgmrn2I2Asw57qS9lHLFZ1B9JgVvEEKMJ91rfCvIDYqeJ"

BASE_URL = "https://testnet.binancefuture.com"

def get_signature(params, secret):
    query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
    return hmac.new(secret.encode('utf-8'), query_string.encode('utf-8'), hashlib.sha256).hexdigest()

def get_server_time():
    try:
        r = requests.get(f"{BASE_URL}/fapi/v1/time")
        return r.json()['serverTime']
    except:
        return int(time.time() * 1000)

def get_open_orders():
    print(f"\n--- Fetching Open Orders (Demo) ---")
    
    server_time = get_server_time()
    params = {
        'timestamp': server_time,
        'recvWindow': 60000 
    }
    
    signature = get_signature(params, SECRET_KEY)
    params['signature'] = signature
    headers = {'X-MBX-APIKEY': API_KEY}
    
    url = f"{BASE_URL}/fapi/v1/openOrders"
    
    try:
        response = requests.get(url, headers=headers, params=params)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ SUCCESS! Found {len(orders)} active orders.")
            if len(orders) > 0:
                print(json.dumps(orders[0], indent=2))
            else:
                print("No active orders found (which is valid).")
            return True
        else:
            print(f"❌ FAILED: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

if __name__ == "__main__":
    get_open_orders()
