from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env.local in parent directory
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

app = FastAPI(title="PredictX AI Engine", version="1.0.0")

# CORS Configuration
origins = [
    "http://localhost:5173", # React Frontend
    "http://localhost:3000",
    "https://predictx-neural.vercel.app", # Production Vercel App
    "*" # Allow all for flexibility during testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import training router
from api import training

# Register routers
app.include_router(training.router, prefix="/api", tags=["training"])


@app.get("/")
def read_root():
    return {"status": "online", "message": "PredictX AI Engine is running 🚀"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# --- Tier 0: Data Intake ---
try:
    from services.data_service import get_historical_data
except ImportError:
    from backend.services.data_service import get_historical_data

@app.get("/api/market-data/{symbol}")
def market_data(symbol: str, period: str = "1mo", interval: str = "1h"):
    """
    Fetch historical market data for a symbol.
    """
    result = get_historical_data(symbol, period, interval)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

# --- Tier 1: AI Prediction ---
from ai_engine import ai_engine
from services.trading_service import trading_service
from pydantic import BaseModel

class PredictionRequest(BaseModel):
    symbol: str
    candles: List[dict] # OHLCV data

@app.post("/api/predict")
def predict_trend(request: PredictionRequest):
    """
    Get AI prediction and Execution Recommendation (Tier 7).
    """
    if not request.candles:
        raise HTTPException(status_code=400, detail="No candles provided")

    # 1. Get LSTM Prediction
    trend_prob = ai_engine.predict_next_move(request.candles)
    
    # 2. Get Agent Decision (Tier 7 - Ensemble CNN-LSTM)
    action, confidence, meta = ai_engine.decide_action(trend_prob, candles=request.candles)
    
    # 3. Get Execution/Position Recommendation
    current_price = request.candles[-1]['close']
    execution = trading_service.calculate_execution(
        request.symbol, 
        action, 
        confidence, 
        current_price
    )
    
    return {
        "symbol": request.symbol,
        "prediction": {
            "trend_prob": trend_prob,
            "direction": "UP" if trend_prob > 0.5 else "DOWN"
        },
        "agent_action": {
            "action": action,
            "confidence": confidence,
            "meta": meta
        },
        "execution": execution
    }


@app.post("/api/train")
def train_model(symbol: str = "BTC-USD", epochs: int = 20):
    """
    Trigger AI Model Training.
    """
    result = ai_engine.train(symbol, epochs)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# --- Tier 0.5: Binance Proxy (Bypass Blokir) ---
import aiohttp
import websockets
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import json

BINANCE_WS_BASE = "wss://fstream.binance.com/ws"
BINANCE_API_BASE = "https://fapi.binance.com/fapi/v1"

@app.websocket("/ws/proxy/{stream}")
async def websocket_proxy(websocket: WebSocket, stream: str):
    """
    WebSocket Proxy to bypass ISP blocking.
    Connects to Binance WS -> Forwards to Frontend
    """
    await websocket.accept()
    print(f"[Proxy] Client connected for stream: {stream}")
    
    binance_ws_url = f"{BINANCE_WS_BASE}/{stream}"
    print(f"[Proxy] 🔄 Attempting to connect upstream to: {binance_ws_url}")
    
    try:
        async with websockets.connect(binance_ws_url) as binance_ws:
            print(f"[Proxy] ✅ Connected to Binance Upstream: {binance_ws_url}")
            
            async def forward_to_client():
                try:
                    async for message in binance_ws:
                        await websocket.send_text(message)
                except Exception as e:
                    print(f"[Proxy] Error reading from Binance: {e}")

            async def forward_to_binance():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await binance_ws.send(data)
                except WebSocketDisconnect:
                    print("[Proxy] Client disconnected")
                except Exception as e:
                    print(f"[Proxy] Error reading from Client: {e}")

            # Run both tasks concurrently
            await asyncio.gather(forward_to_client(), forward_to_binance())
            
    except Exception as e:
        import traceback
        error_msg = f"Connection error: {str(e)}"
        print(f"[Proxy] ❌ {error_msg}")
        traceback.print_exc()
        try:
            await websocket.close(code=1011, reason=error_msg[:100])
        except:
            pass

@app.get("/api/proxy/{path:path}")
async def proxy_get_request(path: str, request: Request):
    """
    Generic GET Proxy for Binance Futures API
    Example: /api/proxy/exchangeInfo -> https://fapi.binance.com/fapi/v1/exchangeInfo
    """
    url = f"{BINANCE_API_BASE}/{path}"
    # Forward query parameters
    params = dict(request.query_params)
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    error_text = await resp.text()
                    print(f"[Proxy] Error {resp.status}: {error_text}")
                    raise HTTPException(status_code=resp.status, detail=f"Binance API Error: {error_text}")
        except Exception as e:
            print(f"[Proxy] Exception: {e}")
            raise HTTPException(status_code=500, detail=str(e))
