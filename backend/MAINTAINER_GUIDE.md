# PredictX - AI Training & Maintenance Guide

This guide explains how to use the provided training scripts to improve the accuracy of your trading AI.

## Training Master Script

The `train_master.py` script is the central tool for training all models.

### Basic Usage

Run the script from the `backend/` directory:

```bash
cd backend
python train_master.py --tier [lstm|cnn|rl|all] [options]
```

### Examples

1. **Train only the LSTM model (Trend Prediction):**
   ```bash
   python train_master.py --tier lstm --epochs 50 --symbol BTC-USD
   ```

2. **Train only the CNN model (Pattern Recognition):**
   ```bash
   python train_master.py --tier cnn --epochs 40
   ```

3. **Train only the RL Agent (Strategic Execution):**
   ```bash
   python train_master.py --tier rl --timesteps 100000 --symbol BTC-USD
   ```

4. **Retrain Everything (Full Reset):**
   ```bash
   python train_master.py --all
   ```

## How to Improve Accuracy

If your predictions are not accurate, consider the following adjustments:

### 1. Increase Training Data
In `ai_engine.py` and `train_rl_agent.py`, the `period` parameter in `get_historical_data` determines how much history the AI sees. 
- **Recommendation:** Use at least `2y` (2 years) for RL agents and `1y` (1 year) for LSTM.

### 2. Optimize Epochs
- **LSTM:** 50-100 epochs is usually sufficient. If loss stops decreasing, stop training (Early Stopping).
- **CNN:** 30-50 epochs.
- **Tip:** Too many epochs can cause *Overfitting* (the AI memorizes the past but fails in the future). If accuracy on the test set decreases while accuracy on the training set increases, you are overfitting.

### 3. RL Timesteps
The RL agent learns by trial and error.
- **Testing:** 50,000 timesteps.
- **Production:** 500,000+ timesteps.
- **Tip:** Training with more timesteps takes significantly longer but results in more robust trading strategies.

### 4. Market Context (Phase 6 Features)
The current `AIEngine` (Tier 6) uses **Futures Data** (Funding Rates, Open Interest). Ensure you are training on symbols that have this data available (e.g., Binance USDT-M Futures symbols like `BTC-USDT` instead of `BTC-USD`).

## Model Storage
All models are saved in the `backend/models/` directory:
- `predictx_v3_futures.pth`: LSTM Model
- `scaler_v3_futures.pkl`: Data Scaler
- `cnn_pattern_v1.pth`: CNN Model
- `ppo_agent.zip`: RL Agent
