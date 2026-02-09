from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import os

app = FastAPI(title="PredictX AI Engine", version="1.0.0")

# CORS Configuration
origins = [
    "http://localhost:5173", # React Frontend
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
from pydantic import BaseModel

class PredictionRequest(BaseModel):
    symbol: str
    candles: List[dict] # OHLCV data

@app.post("/api/predict")
def predict_trend(request: PredictionRequest):
    """
    Get AI prediction for the next candle trend.
    """
    # 1. Get LSTM Prediction
    trend_prob = ai_engine.predict_next_move(request.candles)
    
    # 2. Get Agent Decision (Tier 2 - Placeholder)
    action, confidence = ai_engine.decide_action({})
    
    return {
        "symbol": request.symbol,
        "prediction": {
            "trend_prob": trend_prob,
            "direction": "UP" if trend_prob > 0.5 else "DOWN"
        },
        "agent_action": {
            "action": action,
            "confidence": confidence
        }
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
