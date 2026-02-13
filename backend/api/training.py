from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import threading
import time
import os
from typing import Dict, Optional
import uuid

router = APIRouter()

# In-memory job tracking (for simplicity, can be replaced with Redis)
training_jobs: Dict[str, dict] = {}

class TrainingRequest(BaseModel):
    symbol: str = "BTC-USD"
    epochs: int = 50
    interval: str = "1h"

class TrainingStatus(BaseModel):
    job_id: str
    status: str  # "running", "completed", "failed"
    progress: float  # 0-100
    logs: list
    error: Optional[str] = None

def train_lstm_background(job_id: str, symbol: str, epochs: int, interval: str):
    """Background task for LSTM training with real-time progress updates"""
    try:
        training_jobs[job_id]["status"] = "running"
        training_jobs[job_id]["logs"].append(f"Starting LSTM training for {symbol}...")
        
        from ai_engine import ai_engine
        
        def on_progress(current_epoch, total_epochs, loss):
            progress = (current_epoch / total_epochs) * 100
            training_jobs[job_id]["progress"] = progress
            training_jobs[job_id]["logs"].append(f"Epoch {current_epoch}/{total_epochs} - Loss: {loss:.6f}")
            # Keep logs manageable
            if len(training_jobs[job_id]["logs"]) > 100:
                training_jobs[job_id]["logs"].pop(1) # Keep the first "Starting..." log
        
        # Start training
        result = ai_engine.train(
            symbol=symbol, 
            epochs=epochs, 
            interval=interval, 
            progress_callback=on_progress
        )
        
        if result["status"] == "success":
            training_jobs[job_id]["status"] = "completed"
            training_jobs[job_id]["progress"] = 100
            training_jobs[job_id]["logs"].append(f"✅ Training complete! Final Loss: {result['final_loss']:.6f}")
        else:
            raise Exception(result.get("message", "Training failed"))
        
    except Exception as e:
        training_jobs[job_id]["status"] = "failed"
        training_jobs[job_id]["error"] = str(e)
        training_jobs[job_id]["logs"].append(f"❌ Error: {str(e)}")

def train_cnn_background(job_id: str):
    """Background task for CNN training"""
    try:
        training_jobs[job_id]["status"] = "running"
        training_jobs[job_id]["logs"].append("Starting CNN training...")
        
        # Import and run CNN training
        import sys
        sys.path.append(os.path.dirname(__file__))
        
        from train_cnn import train_cnn_pattern_model
        
        # Run training (this will take time)
        training_jobs[job_id]["logs"].append("Fetching data for 5 symbols...")
        training_jobs[job_id]["progress"] = 20
        
        train_cnn_pattern_model(epochs=40)
        
        training_jobs[job_id]["status"] = "completed"
        training_jobs[job_id]["progress"] = 100
        training_jobs[job_id]["logs"].append("✅ CNN training complete!")
        
    except Exception as e:
        training_jobs[job_id]["status"] = "failed"
        training_jobs[job_id]["error"] = str(e)
        training_jobs[job_id]["logs"].append(f"❌ Error: {str(e)}")

def train_rl_background(job_id: str, symbol: str, timesteps: int):
    """Background task for RL training"""
    try:
        training_jobs[job_id]["status"] = "running"
        training_jobs[job_id]["logs"].append(f"Starting RL training for {symbol}...")
        
        from train_rl_agent import train_rl_agent
        
        training_jobs[job_id]["logs"].append(f"Training PPO agent for {timesteps} timesteps...")
        training_jobs[job_id]["progress"] = 30
        
        model = train_rl_agent(symbol=symbol, total_timesteps=timesteps)
        
        training_jobs[job_id]["status"] = "completed"
        training_jobs[job_id]["progress"] = 100
        training_jobs[job_id]["logs"].append("✅ RL agent training complete!")
        
    except Exception as e:
        training_jobs[job_id]["status"] = "failed"
        training_jobs[job_id]["error"] = str(e)
        training_jobs[job_id]["logs"].append(f"❌ Error: {str(e)}")

@router.post("/training/lstm")
async def start_lstm_training(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Start LSTM model training"""
    job_id = str(uuid.uuid4())
    
    training_jobs[job_id] = {
        "status": "pending",
        "progress": 0,
        "logs": [],
        "error": None,
        "model": "LSTM",
        "started_at": time.time()
    }
    
    # Start training in background
    thread = threading.Thread(
        target=train_lstm_background,
        args=(job_id, request.symbol, request.epochs, request.interval)
    )
    thread.daemon = True
    thread.start()
    
    return {"job_id": job_id, "message": "LSTM training started"}

@router.post("/training/cnn")
async def start_cnn_training():
    """Start CNN model training"""
    job_id = str(uuid.uuid4())
    
    training_jobs[job_id] = {
        "status": "pending",
        "progress": 0,
        "logs": [],
        "error": None,
        "model": "CNN",
        "started_at": time.time()
    }
    
    thread = threading.Thread(target=train_cnn_background, args=(job_id,))
    thread.daemon = True
    thread.start()
    
    return {"job_id": job_id, "message": "CNN training started"}

@router.post("/training/rl")
async def start_rl_training(symbol: str = "BTC-USD", timesteps: int = 50000):
    """Start RL agent training"""
    job_id = str(uuid.uuid4())
    
    training_jobs[job_id] = {
        "status": "pending",
        "progress": 0,
        "logs": [],
        "error": None,
        "model": "RL",
        "started_at": time.time()
    }
    
    thread = threading.Thread(target=train_rl_background, args=(job_id, symbol, timesteps))
    thread.daemon = True
    thread.start()
    
    return {"job_id": job_id, "message": "RL training started"}

@router.get("/training/status/{job_id}")
async def get_training_status(job_id: str):
    """Get training job status"""
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return training_jobs[job_id]

@router.get("/training/models")
async def get_model_status():
    """Check which models are trained"""
    models_dir = "models"
    
    return {
        "lstm": {
            "trained": os.path.exists(f"{models_dir}/predictx_v2.pth"),
            "path": f"{models_dir}/predictx_v2.pth"
        },
        "cnn": {
            "trained": os.path.exists(f"{models_dir}/cnn_pattern_v1.pth"),
            "path": f"{models_dir}/cnn_pattern_v1.pth"
        },
        "rl": {
            "trained": os.path.exists(f"{models_dir}/ppo_agent.zip"),
            "path": f"{models_dir}/ppo_agent.zip"
        },
        "scaler": {
            "trained": os.path.exists(f"{models_dir}/scaler_v2.pkl"),
            "path": f"{models_dir}/scaler_v2.pkl"
        }
    }

@router.delete("/training/{job_id}")
async def cancel_training(job_id: str):
    """Cancel a running training job"""
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if training_jobs[job_id]["status"] == "running":
        training_jobs[job_id]["status"] = "cancelled"
        return {"message": "Training cancelled"}
    
    return {"message": "Job is not running"}
