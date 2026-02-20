import asyncio
import aiohttp
import os
from dotenv import load_dotenv

load_dotenv("../.env.local")

async def test_proxy():
    # Simulate backend proxy constructing the URL
    base_url = "https://testnet.binancefuture.com"
    path = "fapi/v1/openOrders"
    
    # Simulate what typical query_string looks like:
    # We'll use a dummy signature
    query_string_raw = b"symbol=BTCUSDT&timestamp=1771560553215&signature=foobar&testnet=true"
    
    query_string = query_string_raw.decode("utf-8")
    params_str = query_string.replace('testnet=true', '').replace('testnet=false', '')
    params_str = params_str.replace('&&', '&').strip('&')
    
    url = f"{base_url}/{path}"
    if params_str:
        url += f"?{params_str}"
        
    api_key = os.getenv("VITE_BINANCE_API_KEY_TESTNET", "")
    headers = {"X-MBX-APIKEY": api_key, "Content-Type": "application/json"}
    
    print(f"URL: {url}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.request("GET", url, params=None, json=None, headers=headers, ssl=False) as resp:
                print(f"Status: {resp.status}")
                print(await resp.text())
    except Exception as e:
        print(f"Connection Error: {type(e).__name__}: {str(e)}")

asyncio.run(test_proxy())
