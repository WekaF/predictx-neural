import requests
import json
import sys

def check_ip():
    try:
        print("1. Checking Public IP...")
        response = requests.get('http://ip-api.com/json/', timeout=5)
        data = response.json()
        print(f"   IP: {data.get('query')}")
        print(f"   Country: {data.get('country')} ({data.get('countryCode')})")
        print(f"   ISP: {data.get('isp')}")
        return data.get('countryCode')
    except Exception as e:
        print(f"   ❌ Failed to check IP: {e}")
        return None

def check_binance(url):
    print(f"\n2. Checking Binance Connectivity ({url})...")
    try:
        response = requests.get(f"{url}/fapi/v1/time", timeout=10)
        print(f"   Status Code: {response.status_code}")
        if response.status_code == 200:
            print(f"   ✅ Server Time: {response.json().get('serverTime')}")
            print("   ✅ Connection Successful!")
            return True
        elif response.status_code == 403:
            print(f"   ❌ 403 Forbidden (Blocked). Response: {response.text[:200]}")
            return False
        else:
            print(f"   ⚠️ Unexpected Status: {response.status_code}. Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"   ❌ Connection Failed: {e}")
        return False

if __name__ == "__main__":
    print("--- Network Diagnostic Tool ---")
    country = check_ip()
    
    url = "https://demo-fapi.binance.com"
    success = check_binance(url)
    
    print("\n--- Diagnosis ---")
    if country == 'ID':
        print("❌ You are detected in INDONESIA.")
        print("   If you are using a VPN, it is NOT working for this terminal.")
        print("   Note: Browser extensions (Chrome VPNs) DO NOT cover the terminal.")
        print("   Please use a System-Wide VPN (e.g., WARP, NordVPN App).")
    elif not success:
        print(f"⚠️ You are in {country}, but connectivity failed.")
        print("   Possible IP Ban or Datacenter Block.")
    else:
        print("✅ Network looks GOOD. Terminal can reach Binance.")
        print("   If the App still fails, the issue is likely in the Vite Proxy configuration.")
