
import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8000/ws/proxy/btcusdt@kline_15m"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            while True:
                message = await websocket.recv()
                print(f"Received: {message[:100]}...")
                break
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
