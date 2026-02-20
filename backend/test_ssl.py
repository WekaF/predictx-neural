import asyncio
import aiohttp

async def test_ssl():
    url = "https://testnet.binancefuture.com/fapi/v1/klines?symbol=BTCUSDT&interval=15m&limit=50"
    try:
        async with aiohttp.ClientSession() as session:
            # Notice ssl=False here as used in main.py
            async with session.request("GET", url, params=None, json=None, headers={}, ssl=False) as resp:
                print(f"Status: {resp.status}")
                print(await resp.text())
    except Exception as e:
        print(f"Connection Error: {type(e).__name__}: {str(e)}")

asyncio.run(test_ssl())
