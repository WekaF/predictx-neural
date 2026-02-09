import torch
import numpy as np
import pandas as pd
from torch.utils.data import DataLoader
from services.lstm_service import LSTMModel, train_model, predict, TimeSeriesDataset
from services.data_service import get_historical_data
from services.db_service import db_service
import os
import logging
import time

# Configure Logging
logging.basicConfig(
    filename='training.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

class AIEngine:
    def __init__(self):
        self.models_loaded = False
        print("Initializing AI Engine...")
        logging.info("Initializing AI Engine...")
        
        self.input_size = 1 # Using 'Close' price only for now
        self.seq_length = 60 # Lookback period
        self.hidden_size = 64
        self.num_layers = 2
        
        # Initialize LSTM Model
        try:
            self.lstm_model = LSTMModel(input_size=self.input_size, hidden_size=self.hidden_size, num_layers=self.num_layers)
            
            # Load weights if available
            self.model_path = 'models/lstm_v1.pth'
            if os.path.exists(self.model_path):
                self.lstm_model.load_state_dict(torch.load(self.model_path))
                self.lstm_model.eval()
                self.models_loaded = True
                print(f"LSTM Model Loaded from {self.model_path}")
            else:
                print("LSTM Model Initialized (Random Weights) - Waiting for training")
                
        except Exception as e:
            print(f"Failed to initialize LSTM: {e}")
            self.models_loaded = False

    def prepare_data(self, data, seq_length):
        xs, ys = [], []
        for i in range(len(data) - seq_length):
            x = data[i:(i + seq_length)]
            y = data[i + seq_length]
            xs.append(x)
            ys.append(y)
        return np.array(xs), np.array(ys)

    def train(self, symbol="BTC-USD", epochs=20):
        start_time = time.time()
        print(f"Starting training for {symbol}...")
        logging.info(f"Starting training session for {symbol} with {epochs} epochs")
        
        # 1. Fetch Data
        raw_data = get_historical_data(symbol, period="2y", interval="1h")
        if "error" in raw_data:
            error_msg = raw_data["error"]
            logging.error(f"Data fetch error: {error_msg}")
            
            # Log Failure to DB
            db_service.log_training_session({
                "symbol": symbol,
                "epochs": epochs,
                "status": "FAILED",
                "error_message": error_msg,
                "duration_seconds": 0
            })
            
            return {"status": "error", "message": error_msg}
            
        df = pd.DataFrame(raw_data["data"])
        
        if df.empty:
             return {"status": "error", "message": "No data received"}

        # 2. Preprocess
        # Use simple MinMax Normalization on Close price
        prices = df['close'].values.astype(float)
        
        self.min_val = np.min(prices)
        self.max_val = np.max(prices) 
        
        # Avoid division by zero
        if self.max_val == self.min_val:
             return {"status": "error", "message": "Flat data, cannot normalize"}
             
        normalized_data = (prices - self.min_val) / (self.max_val - self.min_val)
        
        # Create sequences
        X, y = self.prepare_data(normalized_data, self.seq_length)
        
        # Reshape X for LSTM [samples, seq_len, features]
        X = X.reshape((X.shape[0], X.shape[1], 1))
        
        # Split train/test
        train_size = int(len(X) * 0.8)
        X_train, X_test = X[:train_size], X[train_size:]
        y_train, y_test = y[:train_size], y[train_size:]
        
        train_dataset = TimeSeriesDataset(X_train, y_train)
        train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
        
        # 3. Train
        history = train_model(self.lstm_model, train_loader, num_epochs=epochs)
        
        # 4. Save Model
        if not os.path.exists('models'):
            os.makedirs('models')
        torch.save(self.lstm_model.state_dict(), self.model_path)
        self.models_loaded = True
        
        final_loss = history['loss'][-1] if history['loss'] else 0
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"Training complete. Final Loss: {final_loss:.6f}")
        logging.info(f"Training complete. Final Loss: {final_loss:.6f}")
        
        # Log Success to DB
        db_service.log_training_session({
            "symbol": symbol,
            "epochs": epochs,
            "final_loss": float(final_loss),
            "status": "SUCCESS",
            "duration_seconds": round(duration, 2),
            "metadata": {"min_val": float(self.min_val), "max_val": float(self.max_val)}
        })
        
        return {
            "status": "success", 
            "message": "Model trained successfully", 
            "final_loss": final_loss,
            "epochs": epochs
        }

    def predict_next_move(self, candles: list):
        """
        Returns probability of Uptrend next candle (0.0 - 1.0)
        """
        if not self.models_loaded:
            return 0.5
            
        try:
            # Extract close prices
            if not candles: 
                return 0.5
                
            closes = [c['close'] for c in candles]
            
            # We need at least seq_length candles
            if len(closes) < self.seq_length:
                return 0.5
            
            # Take last seq_length candles
            input_seq = closes[-self.seq_length:]
            last_close = input_seq[-1]
            
            # Normalize
            if hasattr(self, 'min_val') and hasattr(self, 'max_val'):
                 norm_input = (np.array(input_seq) - self.min_val) / (self.max_val - self.min_val)
                 current_norm = norm_input[-1]
            else:
                # Fallback: self-normalize
                local_min = np.min(input_seq)
                local_max = np.max(input_seq)
                if local_max == local_min: return 0.5
                norm_input = (np.array(input_seq) - local_min) / (local_max - local_min)
                current_norm = norm_input[-1]

            # Reshape [seq_len, 1]
            model_input = norm_input.reshape(self.seq_length, 1)
            
            # Predict next normalized price
            pred_norm = predict(self.lstm_model, model_input)
            
            # Convert to 'Up Probability'
            # If pred > current, prob > 0.5
            # We map the diff to a probability
            diff = pred_norm - current_norm
            
            # Sigmoid-like mapping for probability
            # diff of 0 -> 0.5
            # diff of +0.05 -> high confidence up
            prob = 1 / (1 + np.exp(-diff * 50)) # Scaling factor 50 for sensitivity
            
            return float(prob)
            
        except Exception as e:
            print(f"Prediction error: {e}")
            return 0.5

    def decide_action(self, market_state: dict):
        """
        Tier 2: PPO Agent Decision
        Returns: 'BUY', 'SELL', 'HOLD' and confidence
        """
        # Mock logic
        return "HOLD", 0.0

ai_engine = AIEngine()
