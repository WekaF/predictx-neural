import asyncio
import aiohttp
import os
from dotenv import load_dotenv

load_dotenv("../.env.local")

async def test_conn():
    url = "https://testnet.binancefuture.com/fapi/v1/openOrders?symbol=BTCUSDT"
    api_key = os.getenv("VITE_BINANCE_API_KEY_TESTNET", "")
    headers = {"X-MBX-APIKEY": api_key, "Content-Type": "application/json"}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, ssl=False) as resp:
                print(f"Status: {resp.status}")
                print(await resp.text())
    except Exception as e:
        print(f"Connection Error: {type(e).__name__}: {str(e)}")

asyncio.run(test_conn())
