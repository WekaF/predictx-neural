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
    "https://predictx-neural.vercel.app" # Production Vercel App
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
async def predict_trend(request: PredictionRequest):
    """
    Get AI prediction and Execution Recommendation (Tier 7).
    """
    if not request.candles:
        raise HTTPException(status_code=400, detail="No candles provided")

    # 0. Fetch Futures Data (Concurrent) for Enhanced AI Input
    futures_data = None
    try:
        # Simple heuristic for symbol conversion if needed (e.g. BTC/USD -> BTCUSDT)
        # However, frontend usually sends correct symbol. We try to be robust.
        symbol = request.symbol.replace('/', '').replace('-', '')
        if 'USD' in symbol and 'USDT' not in symbol:
             symbol = symbol.replace('USD', 'USDT')
        
        # Parallel fetch
        funding_task = funding_analyzer.get_funding_history(symbol, limit=5)
        sentiment_task = sentiment_analyzer.get_comprehensive_sentiment(symbol)
        
        # Use return_exceptions to prevent one failure from blocking everything
        results = await asyncio.gather(funding_task, sentiment_task, return_exceptions=True)
        funding, sentiment = results[0], results[1]
        
        futures_data = {}
        
        # Parse Funding
        if isinstance(funding, dict):
            futures_data['fundingRate'] = funding.get('current', 0.0)
        else:
            print(f"[Predict] Funding fetch failed: {funding}")
            
        # Parse Sentiment
        if isinstance(sentiment, dict):
            futures_data['openInterest'] = sentiment.get('open_interest', {}).get('open_interest', 0.0)
            futures_data['longShortRatio'] = sentiment.get('long_short_ratio', {}).get('ratio', 1.0)
        else:
             print(f"[Predict] Sentiment fetch failed: {sentiment}")
             
    except Exception as e:
        print(f"[Predict] Futures data fetch warning: {e}")
        futures_data = None

    # 1. Get LSTM Prediction (Now Async & Futures Aware)
    trend_prob = ai_engine.predict_next_move(request.candles, futures_data)
    
    # 2. Get Agent Decision (Tier 7 - Ensemble CNN-LSTM)
    # Note: We could pass futures_data to decide_action too in future
    action, confidence, meta = ai_engine.decide_action(trend_prob, candles=request.candles)
    
    # 3. Get Execution/Position Recommendation
    current_price = request.candles[-1]['close']
    execution = trading_service.calculate_execution(
        request.symbol, 
        action, 
        confidence, 
        current_price
    )
    
    # Inject futures metadata into response if available
    if futures_data:
        meta['futures_data'] = futures_data
    
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

# --- Scheduler Integration ---
# from services.scheduler import training_scheduler

@app.on_event("startup")
def startup_event():
    # Start the scheduler when the app starts
    # training_scheduler.start()
    pass

@app.get("/api/training/schedule/status")
def get_schedule_status():
    # return training_scheduler.get_status()
    return {"running": False, "job_scheduled": False, "next_run": None}

@app.post("/api/training/schedule")
def set_schedule(interval_hours: int = 24):
    # return training_scheduler.schedule_training(interval_hours)
    return {"status": "disabled", "message": "Scheduler temporarily disabled due to import error"}

@app.post("/api/training/schedule/stop")
def stop_schedule():
    # training_scheduler.remove_training_job()
    return {"status": "stopped"}

# --- Futures-Specific Endpoints ---
from services.funding_rate_service import funding_analyzer
from services.market_sentiment_service import sentiment_analyzer

@app.get("/api/funding-rate/{symbol}")
async def get_funding_rate(symbol: str):
    """
    Get current funding rate and historical trends for a futures symbol.
    
    Example: /api/funding-rate/BTCUSDT
    """
    try:
        funding_data = await funding_analyzer.get_funding_history(symbol)
        if not funding_data:
            raise HTTPException(status_code=404, detail=f"No funding data found for {symbol}")
        return funding_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market-sentiment/{symbol}")
async def get_market_sentiment(symbol: str):
    """
    Get comprehensive market sentiment including:
    - Open Interest
    - Long/Short Account Ratio
    - Taker Buy/Sell Ratio
    
    Example: /api/market-sentiment/BTCUSDT
    """
    try:
        sentiment_data = await sentiment_analyzer.get_comprehensive_sentiment(symbol)
        return sentiment_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# --- Tier 0.5: Binance Proxy (Bypass Blokir) ---
import aiohttp
import websockets
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import json

BINANCE_WS_BASE = "wss://fstream.binance.com/ws"
BINANCE_API_BASE = "https://fapi.binance.com"

# Futures Testnet Endpoints
BINANCE_WS_TESTNET = "wss://stream.binancefuture.com/ws"
BINANCE_API_TESTNET = "https://testnet.binancefuture.com"

@app.websocket("/ws/proxy/{stream}")
async def websocket_proxy(websocket: WebSocket, stream: str):
    """
    WebSocket Proxy with Testnet Support.
    Connects to Binance WS -> Forwards to Frontend
    Pass ?testnet=true to use Futures Testnet.
    """
    await websocket.accept()
    
    is_testnet = websocket.query_params.get('testnet') == 'true'
    ws_base = BINANCE_WS_TESTNET if is_testnet else BINANCE_WS_BASE
    
    print(f"[Proxy] Client connected for stream: {stream} (Testnet: {is_testnet})")
    
    binance_ws_url = f"{ws_base}/{stream}"
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

from fastapi import Response

@app.api_route("/api/proxy/{path:path}", methods=["GET", "POST", "DELETE"])
async def proxy_request(path: str, request: Request):
    """
    Generic Proxy for Binance Futures API (GET/POST/DELETE)
    Pass ?testnet=true to use Futures Testnet.
    """
    is_testnet = request.query_params.get('testnet') == 'true'
    base_url = BINANCE_API_TESTNET if is_testnet else BINANCE_API_BASE
    
    url = f"{base_url}/{path}"
    
    # Use raw query string to preserve parameter order for signature verification!
    query_string = request.scope.get("query_string", b"").decode("utf-8")
    
    # Remove testnet param from query string safely
    # It could be "?testnet=true", "&testnet=true", "testnet=true&"
    params_str = query_string.replace('testnet=true', '').replace('testnet=false', '')
    
    # Clean up double && or trailing/leading ?/&
    params_str = params_str.replace('&&', '&').strip('&')
    
    # Append to URL directly
    if params_str:
        url += f"?{params_str}"
    
    print(f"[Proxy] Forwarding {request.method} -> {url[:200]}")
        
    # Get raw body for POST (if any)
    # CRITICAL: Read raw bytes, NOT json(). Binance signed requests use query params
    # even for POST. Calling request.json() with Content-Type: application/json but
    # empty body causes FastAPI to return 400 Bad Request before reaching our handler.
    raw_body = await request.body()
    
    # Forward necessary headers (API Key only)
    # Do NOT forward Content-Type: application/json when there's no body,
    # as it can confuse the upstream server.
    headers = {}
    if 'x-mbx-apikey' in request.headers:
        headers['X-MBX-APIKEY'] = request.headers['x-mbx-apikey']
    
    async with aiohttp.ClientSession() as session:
        try:
            # CRITICAL: Use yarl.URL with encoded=True to prevent double-encoding.
            # The query string from the frontend is already URL-encoded (e.g. %5B for [).
            # Without encoded=True, aiohttp will re-encode % to %25, breaking the
            # Binance HMAC signature for batch orders.
            from yarl import URL
            target_url = URL(url, encoded=True)
            
            # Only send body if it actually has content
            request_kwargs = {
                'headers': headers
            }
            if raw_body:
                request_kwargs['data'] = raw_body
                if 'content-type' in request.headers:
                    headers['Content-Type'] = request.headers['content-type']
            
            async with session.request(request.method, target_url, **request_kwargs) as resp:
                # Read content
                content = await resp.read()
                
                # Log error responses for debugging
                if resp.status != 200:
                    try:
                        error_json = json.loads(content)
                        print(f"[Proxy] ❌ Binance API Error {resp.status}: {error_json}")
                        print(f"[Proxy] Request URL: {url}")
                        print(f"[Proxy] Request Method: {request.method}")
                        print(f"[Proxy] Request Headers: {headers}")
                    except:
                        print(f"[Proxy] ❌ Binance API Error {resp.status}: {content.decode('utf-8')}")
                
                # Forward response exactly as is (status + body)
                return Response(content=content, status_code=resp.status, media_type="application/json")
                
        except Exception as e:
            print(f"[Proxy] Exception: {e}")
            raise HTTPException(status_code=500, detail=str(e))

