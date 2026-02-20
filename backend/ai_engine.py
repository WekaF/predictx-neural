import torch
import numpy as np
import pandas as pd
from torch.utils.data import DataLoader
from services.lstm_service import LSTMModel, train_model, predict, TimeSeriesDataset
from services.data_service import get_historical_data
from services.db_service import db_service
from services.funding_rate_service import funding_analyzer
from services.market_sentiment_service import sentiment_analyzer
import os
import logging
import time
import asyncio
from sklearn.preprocessing import StandardScaler
import joblib
from utils.smc_utils import get_smc_context

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
    Feature Engineering: Adds Log Returns, RSI, EMA Trend Difference, and Futures Data
    """
    df['log_return'] = np.log(df['close'] / df['close'].shift(1))

    # RSI
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))

    # EMA - Trend Divergence
    df['ema_20'] = df['close'].ewm(span=20, adjust=False).mean()
    df['ema_diff'] = (df['close'] - df['ema_20']) / df['ema_20']

    # EMA 200 - Major Trend Filter
    df['ema_200'] = df['close'].ewm(span=200, adjust=False).mean()

    # ATR - Volatility
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift())
    low_close = np.abs(df['low'] - df['close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    df['atr'] = true_range.rolling(14).mean()
    
    # --- FUTURES FEATURES (Fill 0 if missing for backward compatibility) ---
    if 'fundingRate' not in df.columns:
        df['fundingRate'] = 0.0
    if 'openInterest' not in df.columns:
        df['openInterest'] = 0.0
    if 'longShortRatio' not in df.columns:
        df['longShortRatio'] = 1.0
    
    # Derived Futures Features
    df['funding_trend'] = df['fundingRate'].rolling(window=7).mean()
    df['oi_change'] = df['openInterest'].pct_change()
    df['taker_ratio'] = 1.0 # Placeholder if not available
        
    df.fillna(0, inplace=True) 
    return df

class AIEngine:
    def __init__(self):
        self.models_loaded = False
        print("Initializing AI Engine (Tier 6 - Futures Enhanced)...")
        
        # UPGRADED Input Size: 3 -> 9
        # 1. Log Return
        # 2. RSI
        # 3. EMA Diff
        # 4. Funding Rate
        # 5. Funding Trend
        # 6. Open Interest
        # 7. OI Change
        # 8. Long/Short Ratio
        # 9. Taker Ratio (or Volatility as proxy if missing)
        self.input_size = 9 
        self.seq_length = 60
        self.hidden_size = 128 
        self.num_layers = 3    

        self.scaler = StandardScaler()
        self.scaler_path = 'models/scaler_v3_futures.pkl'
        self.model_path = 'models/predictx_v3_futures.pth'

        self.rl_agent = None
        self.rl_enabled = False
        self.cnn_model = None
        self.cnn_enabled = False

        try:
            self.lstm_model = LSTMModel(input_size=self.input_size, 
                                      hidden_size=self.hidden_size, 
                                      num_layers=self.num_layers)
            self.load_model()
            self.load_rl_agent()
            self.load_cnn_model()
        except Exception as e:
            print(f"Failed to initialize LSTM: {e}")

    def load_model(self):
        # Try loading V3 (Futures) model first
        if os.path.exists(self.model_path):
            try:
                self.lstm_model.load_state_dict(torch.load(self.model_path))
                self.lstm_model.eval()
                if os.path.exists(self.scaler_path):
                    self.scaler = joblib.load(self.scaler_path)
                self.models_loaded = True
                print(f"✅ LSTM Model V3 (Futures) Loaded: {self.model_path}")
            except Exception as e:
                print(f"❌ Error loading LSTM V3: {e}")
                self.models_loaded = False
        else:
            print("⚠️ Futures Model not found. Please retrain for Phase 6 features.")
            # Fallback logic could be added here, but for now we enforce retraining for Phase 6
            self.models_loaded = False

    def prepare_data(self, data, seq_length):
        xs, ys = [], []
        for i in range(len(data) - seq_length):
            x = data[i:(i + seq_length)]
            y = data[i + seq_length, 0] 
            xs.append(x)
            ys.append(y)
        return np.array(xs), np.array(ys)
    
    async def fetch_futures_data(self, symbol, limit):
        """Fetch historical futures data asynchronously"""
        # Fetch concurrently
        funding_task = funding_analyzer.get_funding_history(symbol, limit=limit)
        oi_task = sentiment_analyzer.get_historical_open_interest(symbol, limit=limit)
        ls_task = sentiment_analyzer.get_historical_long_short_ratio(symbol, limit=limit)
        
        funding, oi, ls = await asyncio.gather(funding_task, oi_task, ls_task)
        return funding, oi, ls

    def train(self, symbol="BTCUSDT", epochs=50, interval="1h", progress_callback=None):
        start_time = time.time()
        print(f"Training started for {symbol}...")
        
        # 1. Fetch OHLCV
        raw_data = get_historical_data(symbol, period="1y", interval=interval)
        if "error" in raw_data: return {"status": "error", "message": raw_data["error"]}

        df = pd.DataFrame(raw_data["data"])
        
        # 2. Fetch Futures Data (Async run in Sync)
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            funding, oi, ls = loop.run_until_complete(self.fetch_futures_data(symbol, limit=1000))
            loop.close()
            
            # 3. Merge Data (Simplistic merging logic for prototype)
            # In production, use accurate timestamp merging. 
            # Here we assume data density is similar or just fill
            
            # Funding
            if funding and 'history' in funding:
                 # Funding is 8h usually, repeated mapping needed. 
                 # For simplicity, we use current funding as feature (not ideal but works for proof of concept)
                 # Better: Map funding rates to timestamps
                 df['fundingRate'] = funding['current'] # Placeholder: static funding
            
            # OI
            if oi:
                oi_df = pd.DataFrame(oi)
                oi_df['time'] = pd.to_datetime(oi_df['timestamp'], unit='ms')
                # Use interpolation or merge_asof if indices match
                # For Phase 6 prototype: We assume last known OI
                df['openInterest'] = oi[0]['open_interest'] # Placeholder
                
            # LS
            if ls:
                df['longShortRatio'] = ls[0]['ratio'] # Placeholder
                
            print("Futures data fetched and merged.")
            
        except Exception as e:
            print(f"Error fetching futures data: {e}")
            # Fallback to defaults
            pass

        df = add_indicators(df)
        
        # Select 9 Features
        # Ensure we have all columns
        feature_cols = ['log_return', 'rsi', 'ema_diff', 'fundingRate', 'funding_trend', 'openInterest', 'oi_change', 'longShortRatio', 'atr']
        
        # Fill missing
        for col in feature_cols:
            if col not in df.columns:
                 df[col] = 0.0
                 
        features = df[feature_cols].values
        
        # Handle NaNs
        features = np.nan_to_num(features)

        train_size = int(len(features) * 0.8)
        self.scaler.fit(features[:train_size])
        scaled_data = self.scaler.transform(features)

        if not os.path.exists('models'): os.makedirs('models')
        joblib.dump(self.scaler, self.scaler_path)

        X, y = self.prepare_data(scaled_data, self.seq_length)
        train_size = int(len(X) * 0.8)
        X_train, y_train = X[:train_size], y[:train_size]

        train_dataset = TimeSeriesDataset(X_train, y_train)
        train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)

        self.lstm_model.train()
        with torch.autograd.set_detect_anomaly(True):
            history = train_model(self.lstm_model, train_loader, num_epochs=epochs, progress_callback=progress_callback)
        torch.save(self.lstm_model.state_dict(), self.model_path)
        self.models_loaded = True

        return {"status": "success", "final_loss": history['loss'][-1], "epochs": epochs}

    def predict_next_move(self, candles: list, futures_data: dict = None):
        if not self.models_loaded or len(candles) < 120:
            if len(candles) < 120:
                logging.warning(f"[AI Engine] ⚠️ Not enough candles: {len(candles)} < 120. Returning neutral prediction.")
            return 0.5

        try:
            df = pd.DataFrame(candles)
            
            # --- INJECT FUTURES DATA ---
            # If provided, use it. If not, defaulting to 0/neutral
            if not futures_data:
                # In sync, we skip fetching to avoid performance hit/async complexit
                pass
            else:
                df['fundingRate'] = futures_data.get('fundingRate', 0.0)
                df['openInterest'] = futures_data.get('openInterest', 0.0)
                df['longShortRatio'] = futures_data.get('longShortRatio', 1.0)
            
            df = add_indicators(df)
            
            feature_cols = ['log_return', 'rsi', 'ema_diff', 'fundingRate', 'funding_trend', 'openInterest', 'oi_change', 'longShortRatio', 'atr']
            
             # Fill missing
            for col in feature_cols:
                if col not in df.columns:
                     df[col] = 0.0
            
            current_features = df[feature_cols].tail(self.seq_length).values
            
            # Handle NaNs
            current_features = np.nan_to_num(current_features)
            
            scaled_input = self.scaler.transform(current_features)

            self.lstm_model.eval()
            with torch.no_grad():
                input_tensor = torch.FloatTensor(scaled_input).unsqueeze(0) 

                pred_scaled_return = self.lstm_model(input_tensor).item()

            # Normalization with Gain factor
            prob = 1 / (1 + np.exp(-pred_scaled_return * 4)) 
            
            # Trend Filter EMA 200 (Safety Switch)
            current_close = df['close'].iloc[-1]
            ema_200 = df['ema_200'].iloc[-1]
            
            # If price is far below EMA 200, cap the bullish probability
            if current_close < ema_200 and prob > 0.55:
                prob = 0.52 # Neutralize "fake" buy signals in downtrend
            
            return float(prob)
        except Exception as e:
            return 0.5

    def decide_action(self, trend_prob: float, state_vector=None, candles=None):
        """
        REVISED TIER 7: Focus on Quality over Quantity
        """
        # --- CONFIGURATION ---
        BUY_ZONE = 0.58    # Min score to consider BUY (Relaxed from 0.62)
        SELL_ZONE = 0.42   # Max score to consider SELL (Relaxed from 0.38)
        
        ensemble_score = float(trend_prob)
        
        # 0. SMC Check (New)
        smc_score = 0.5
        if candles is not None:
            smc_df = pd.DataFrame(candles)
            smc_data = get_smc_context(smc_df)
            smc_score = smc_data['score']
            
        # 1. Ensemble Confirmation (CNN)
        if self.cnn_enabled and candles is not None:
            cnn_prob = self.get_cnn_prediction(candles)
            if cnn_prob is not None:
                # Require BOTH models to agree for high score
                ensemble_score = (ensemble_score * 0.7) + (float(cnn_prob) * 0.3)
        else:
            # Penalty for missing CNN: Pull score toward neutral (0.5)
            # Relaxed from 0.8 to 0.9 to allow LSTM-only signals more weight
            ensemble_score = 0.5 + (ensemble_score - 0.5) * 0.9

        # Integrate SMC Core Score (Weight 20%)
        ensemble_score = (ensemble_score * 0.8) + (smc_score * 0.2)

        # 2. Strategic Decision (RL)
        rl_action = "HOLD"
        rl_leverage = 1
        if self.rl_enabled and state_vector is not None:
            rl_decision = self.get_rl_recommendation(state_vector)
            if rl_decision:
                rl_action, rl_leverage, _ = rl_decision

        # 3. FINAL FUSION LOGIC
        confidence = abs(ensemble_score - 0.5) * 2 * 100

        # Construct basic metadata
        meta = {
            "smc": smc_data if 'smc_data' in locals() else None,
            "cnn_prob": float(cnn_prob) if 'cnn_prob' in locals() and cnn_prob is not None else None,
            "rl_action": rl_action
        }

        # ACTION: BUY
        if ensemble_score >= BUY_ZONE:
            # High quality buy: Trend is Bullish AND RL agrees
            if "BUY" in rl_action:
                return f"BUY_{rl_leverage}x", min(99, confidence + 10), meta
            # Mid quality: Trend Bullish but RL is cautious
            return "BUY_1x", confidence, meta

        # ACTION: SELL
        elif ensemble_score <= SELL_ZONE:
            return "SELL", confidence, meta

        # ACTION: CONFLICT / UNCERTAINTY
        # If RL is very sure about SELL but Trend is neutral
        if rl_action == "SELL" and ensemble_score < 0.45:
            return "SELL", 60, meta
            
        return "HOLD", round(confidence, 1), meta

    # --- Helper Methods (Keep as is but optimized) ---
    def load_rl_agent(self):
        if not RL_AVAILABLE: return
        path = "models/ppo_agent.zip"
        if os.path.exists(path):
            self.rl_agent = PPO.load(path)
            self.rl_enabled = True
            print("✅ RL Agent Loaded")

    def get_rl_recommendation(self, state_vector):
        if not self.rl_enabled: return None
        try:
            action, _ = self.rl_agent.predict(state_vector, deterministic=True)
            action = int(action)
            action_map = {0: ("HOLD", 1, 50), 1: ("BUY", 1, 70), 2: ("BUY", 3, 85), 3: ("BUY", 5, 95), 4: ("SELL", 1, 80)}
            return action_map.get(action, ("HOLD", 1, 50))
        except: return None

    def load_cnn_model(self):
        try:
            from services.cnn_service import CNNPatternModel
            path = "models/cnn_pattern_v1.pth"
            if os.path.exists(path):
                self.cnn_model = CNNPatternModel(sequence_length=20, input_features=4)
                self.cnn_model.load_state_dict(torch.load(path))
                self.cnn_model.eval()
                self.cnn_enabled = True
                print("✅ CNN Model Loaded")
        except: pass

    def get_cnn_prediction(self, candles):
        if not self.cnn_enabled: return None
        try:
            from services.chart_generator import prepare_cnn_input
            from services.cnn_service import predict_pattern
            window = prepare_cnn_input(candles, window_size=20)
            return predict_pattern(self.cnn_model, window) if window is not None else None
        except: return None

    def get_state_vector(self, candles, position, balance, initial_balance=10000):
        if len(candles) < 205: return np.array([0.5]*7, dtype=np.float32)
        try:
            df = add_indicators(pd.DataFrame(candles))
            curr = df.iloc[-1]
            recent = df['close'].tail(100)
            close_n = (curr['close'] - recent.min()) / (recent.max() - recent.min()) if recent.max() != recent.min() else 0.5
            return np.array([close_n, curr['rsi']/100, curr['ema_diff'], self.predict_next_move(candles), 1 if position > 0 else 0, balance/initial_balance, 0.0], dtype=np.float32)
        except: return np.array([0.5]*7, dtype=np.float32)

ai_engine = AIEngine()