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
from sklearn.preprocessing import StandardScaler
import joblib

# RL Integration
try:
    from stable_baselines3 import PPO
    RL_AVAILABLE = True
except ImportError:
    RL_AVAILABLE = False
    print("⚠️ stable-baselines3 not installed. RL features disabled.")

# Configure Logging
logging.basicConfig(
    filename='training.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def add_indicators(df):
    """
    Feature Engineering: Adds RSI, EMA Trend Difference, and EMA 200
    """
    # RSI (Relative Strength Index)
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    
    # EMA (Exponential Moving Average) - Trend Divergence
    df['ema_20'] = df['close'].ewm(span=20, adjust=False).mean()
    df['ema_diff'] = (df['close'] - df['ema_20']) / df['ema_20'] # Percentage distance to trend
    
    # EMA 200 - Major Trend Filter (Tier 5)
    df['ema_200'] = df['close'].ewm(span=200, adjust=False).mean()
    
    # ATR (Average True Range) - Volatility
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift())
    low_close = np.abs(df['low'] - df['close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    df['atr'] = true_range.rolling(14).mean()

    # Fill NaN from rolling calculations
    df.bfill(inplace=True)
    df.fillna(0, inplace=True) # Safety net
    return df

class AIEngine:
    def __init__(self):
        self.models_loaded = False
        print("Initializing AI Engine (Tier 5 - The Trend Surfer)...")
        logging.info("Initializing AI Engine (Tier 5 - The Trend Surfer)...")
        
        # New Feature Set: Close, RSI, EMA_Diff
        self.input_size = 3 
        self.seq_length = 60
        self.hidden_size = 128 
        self.num_layers = 3    
        
        self.scaler = StandardScaler()
        self.scaler_path = 'models/scaler_v2.pkl'
        self.model_path = 'models/predictx_v2.pth'
        
        # RL Agent (Tier 6)
        self.rl_agent = None
        self.rl_enabled = False
        
        # CNN Model (Tier 7)
        self.cnn_model = None
        self.cnn_enabled = False
        
        # Initialize LSTM Model
        try:
            self.lstm_model = LSTMModel(input_size=self.input_size, 
                                      hidden_size=self.hidden_size, 
                                      num_layers=self.num_layers)
            self.load_model()
            self.load_rl_agent()
            self.load_cnn_model()
                
        except Exception as e:
            print(f"Failed to initialize LSTM: {e}")
            self.models_loaded = False

    def load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.lstm_model.load_state_dict(torch.load(self.model_path))
                self.lstm_model.eval()
                
                # Load Scaler if exists
                if os.path.exists(self.scaler_path):
                    self.scaler = joblib.load(self.scaler_path)
                    
                self.models_loaded = True
                print(f"LSTM Model (Tier 5) Loaded from {self.model_path}")
            except Exception as e:
                print(f"Error loading model: {e}")
        else:
            print("LSTM Model Initialized (Random Weights) - Waiting for training")

    def prepare_data(self, data, seq_length):
        xs, ys = [], []
        for i in range(len(data) - seq_length):
            x = data[i:(i + seq_length)]
            # Predict only Close price (index 0) for next step
            y = data[i + seq_length, 0] 
            xs.append(x)
            ys.append(y)
        return np.array(xs), np.array(ys)

    def train(self, symbol="BTC-USD", epochs=50, interval="1h"):
        start_time = time.time()
        print(f"Starting Tier 5 training for {symbol} ({interval})...")
        logging.info(f"Starting Tier 5 training session for {symbol} ({interval}) with {epochs} epochs")
        
        # 1. Fetch Data
        raw_data = get_historical_data(symbol, period="1y", interval=interval)
        if "error" in raw_data:
            return {"status": "error", "message": raw_data["error"]}
            
        df = pd.DataFrame(raw_data["data"])
        if df.empty:
             return {"status": "error", "message": "No data received"}

        # 2. Feature Engineering
        df = add_indicators(df)
        
        # Select features: Close, RSI, EMA_Diff
        features = df[['close', 'rsi', 'ema_diff']].values
        
        # 3. Scaling (Fit only on training data)
        # For simplicity in this pipeline, we fit on the whole fetched dataset 
        # (assuming it's a batch update)
        scaled_data = self.scaler.fit_transform(features)
        
        # Save scaler for inference
        if not os.path.exists('models'):
            os.makedirs('models')
        joblib.dump(self.scaler, self.scaler_path)
        
        # 4. Prepare Sequences
        X, y = self.prepare_data(scaled_data, self.seq_length)
        
        # Split train/test
        train_size = int(len(X) * 0.8)
        X_train, X_test = X[:train_size], X[train_size:]
        y_train, y_test = y[:train_size], y[train_size:]
        
        train_dataset = TimeSeriesDataset(X_train, y_train)
        train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
        
        # 5. Train
        self.lstm_model.train()
        history = train_model(self.lstm_model, train_loader, num_epochs=epochs)
        
        # 6. Save Model
        torch.save(self.lstm_model.state_dict(), self.model_path)
        self.models_loaded = True
        
        final_loss = history['loss'][-1] if history['loss'] else 0
        duration = time.time() - start_time
        
        print(f"Training complete. Final Loss: {final_loss:.6f}")
        
        # Log to DB
        db_service.log_training_session({
            "symbol": symbol,
            "epochs": epochs,
            "final_loss": float(final_loss),
            "status": "SUCCESS",
            "duration_seconds": round(duration, 2),
            "metadata": {"algorithm": "LSTM_Tier5_TrendSurfer"}
        })
        
        return {
            "status": "success", 
            "message": "Tier 5 Model trained successfully", 
            "final_loss": final_loss,
            "epochs": epochs
        }

    def predict_next_move(self, candles: list):
        """
        Returns probability of Uptrend next candle (0.0 - 1.0)
        """
        # Need enough data for lag features (EMA 200 needs 200 candles)
        if not self.models_loaded or len(candles) < 205:
            return 0.5
            
        try:
            df = pd.DataFrame(candles)
            df = add_indicators(df)

            # Take last seq_length features
            current_features = df[['close', 'rsi', 'ema_diff']].tail(self.seq_length).values
            
            # Use saved scaler
            scaled_input = self.scaler.transform(current_features)
            last_close_norm = scaled_input[-1, 0]
            
            # Predict
            self.lstm_model.eval()
            with torch.no_grad():
                # [1, seq, feat]
                input_tensor = torch.FloatTensor(scaled_input).unsqueeze(0) 
                pred_norm = self.lstm_model(input_tensor).item()
            
            # LOGIC: Scaled Difference Priority
            diff = pred_norm - last_close_norm
            
            # Sigmoid with Sensitivity 15
            prob = 1 / (1 + np.exp(-diff * 15)) 
            
            # --- TIER 5: TREND SURFER LOGIC ---
            current_close = df['close'].iloc[-1]
            ema_200 = df['ema_200'].iloc[-1]
            current_rsi = df['rsi'].iloc[-1]
            
            # 1. Trend Filter (EMA 200)
            # LONG ONLY if Price > EMA 200
            if current_close > ema_200:
                # Allow Bullish Prob. Suppress Bearish Prob.
                if prob < 0.5:
                    prob = 0.5 # Neutralize Bearish Signal (Don't short uptrend)
                # Boost Bullish Confidence slightly if strong trend
                prob *= 1.05 
            
            # SHORT ONLY if Price < EMA 200
            elif current_close < ema_200:
                # Allow Bearish Prob. Suppress Bullish Prob.
                if prob > 0.5:
                    prob = 0.5 # Neutralize Bullish Signal (Don't buy downtrend)
                # Boost Bearish Confidence slightly
                prob *= 0.95
            
            # 2. RSI Sanity Check (Relaxed)
            # Prevent longing the absolute top (>80) or shorting absolute bottom (<20)
            if current_rsi > 80: 
                prob = min(prob, 0.5) # Kill buy signal
            if current_rsi < 20: 
                prob = max(prob, 0.5) # Kill sell signal
            
            return float(prob)
            
        except Exception as e:
            print(f"Prediction error: {e}")
            return 0.5

    def load_rl_agent(self):
        """
        Load trained PPO agent for Tier 6 hybrid decision-making
        """
        if not RL_AVAILABLE:
            print("⚠️ RL agent not available (stable-baselines3 not installed)")
            return
            
        rl_model_path = "models/ppo_agent.zip"
        if os.path.exists(rl_model_path):
            try:
                self.rl_agent = PPO.load(rl_model_path)
                self.rl_enabled = True
                print(f"✅ RL Agent (PPO) Loaded from {rl_model_path}")
            except Exception as e:
                print(f"⚠️ Failed to load RL agent: {e}")
        else:
            print(f"⚠️ RL model not found at {rl_model_path}. Run train_rl_agent.py first.")
    
    def get_rl_recommendation(self, state_vector):
        """
        Get action recommendation from RL agent
        Returns: (action_name, leverage, confidence)
        """
        if not self.rl_enabled or self.rl_agent is None:
            return None
            
        try:
            action, _states = self.rl_agent.predict(state_vector, deterministic=True)
            
            # Map action to trading decision
            action_map = {
                0: ("HOLD", 1, 50),
                1: ("BUY", 1, 70),
                2: ("BUY", 3, 85),
                3: ("BUY", 5, 95),
                4: ("SELL", 1, 80)
            }
            
            return action_map.get(action, ("HOLD", 1, 50))
        except Exception as e:
            print(f"RL prediction error: {e}")
            return None
    
    def load_cnn_model(self):
        """
        Load trained CNN model for Tier 7 ensemble
        """
        from services.cnn_service import CNNPatternModel
        
        cnn_model_path = "models/cnn_pattern_v1.pth"
        if os.path.exists(cnn_model_path):
            try:
                self.cnn_model = CNNPatternModel(sequence_length=20, input_features=4)
                self.cnn_model.load_state_dict(torch.load(cnn_model_path))
                self.cnn_model.eval()
                self.cnn_enabled = True
                print(f"✅ CNN Pattern Model Loaded from {cnn_model_path}")
            except Exception as e:
                print(f"⚠️ Failed to load CNN model: {e}")
        else:
            print(f"⚠️ CNN model not found at {cnn_model_path}. Run train_cnn.py first.")
    
    def get_cnn_prediction(self, candles):
        """
        Get pattern prediction from CNN model
        Returns: probability (0-1, where >0.5 = bullish pattern)
        """
        if not self.cnn_enabled or self.cnn_model is None:
            return None
        
        try:
            from services.chart_generator import prepare_cnn_input
            
            # Prepare 20-candle window
            window = prepare_cnn_input(candles, window_size=20)
            if window is None:
                return None
            
            # Get CNN prediction
            from services.cnn_service import predict_pattern
            prob = predict_pattern(self.cnn_model, window)
            return prob
            
        except Exception as e:
            print(f"CNN prediction error: {e}")
            return None

    def decide_action(self, trend_prob: float, state_vector=None, candles=None):
        """
        Tier 7: CNN-LSTM Ensemble
        - LSTM provides trend analysis
        - CNN provides pattern recognition
        - Ensemble fusion with weighted voting
        """
        # Tier 7: CNN-LSTM Ensemble
        if self.cnn_enabled and candles is not None:
            cnn_prob = self.get_cnn_prediction(candles)
            
            if cnn_prob is not None:
                # Tier 7: High Confidence Ensemble (Refined)
                # Weighted ensemble: LSTM (60%) + CNN (40%)
                ensemble_prob = (trend_prob * 0.6) + (cnn_prob * 0.4)
                
                # Calculate confidence
                confidence = abs(ensemble_prob - 0.5) * 2 * 100
                
                # Filter: High confidence (>65%) and trend alignment
                # trend_prob > 0.55 means LSTM is bullish
                # trend_prob < 0.45 means LSTM is bearish
                
                if confidence > 58: 
                    if ensemble_prob > 0.58 and trend_prob > 0.51:
                        return "BUY", round(confidence, 1)
                    elif ensemble_prob < 0.42 and trend_prob < 0.49:
                        return "SELL", round(confidence, 1)
                
                return "HOLD", round(confidence, 1)
        
        # Tier 6: RL + LSTM (if RL enabled)
        if self.rl_enabled and state_vector is not None:
            rl_decision = self.get_rl_recommendation(state_vector)
            if rl_decision:
                action, leverage, confidence = rl_decision
                # Filter by LSTM trend
                if action == "BUY" and trend_prob < 0.45:
                    return "HOLD", 50  # LSTM says bearish, override RL
                elif action == "SELL" and trend_prob > 0.55:
                    return "HOLD", 50  # LSTM says bullish, override RL
                return f"{action}_{leverage}x", confidence
        
        # Fallback to Tier 5 logic (LSTM only)
        buy_threshold = 0.55
        sell_threshold = 0.45
        
        confidence = abs(trend_prob - 0.5) * 2 * 100
        
        if trend_prob > buy_threshold:
            return "BUY", round(confidence, 1)
        elif trend_prob < sell_threshold:
            return "SELL", round(confidence, 1)
        else:
            return "HOLD", round(confidence, 1)

ai_engine = AIEngine()
