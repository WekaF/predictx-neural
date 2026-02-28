#!/usr/bin/env python3
"""
Trinity AI - Complete Retraining Script
Trains LSTM, RL Agent, and validates with backtest
"""

import sys
import os

# Ensure we're in the backend directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("=" * 50)
print("Trinity AI - Complete Retraining")
print("=" * 50)
print()

# Step 1: Train LSTM
print("=" * 50)
print("STEP 1/3: Training LSTM (Tier 5)")
print("=" * 50)
print()

from ai_engine import ai_engine

print("🧠 Training LSTM Model (Tier 5 - Trend Surfer)...")
print("   Fetching 1 year of BTC-USD data...")
print("   Training for 50 epochs...")
print()

result = ai_engine.train(symbol="BTC-USD", epochs=50, interval="1h")

if result["status"] == "success":
    print()
    print(f"✅ LSTM Training Complete!")
    print(f"   Final Loss: {result['final_loss']:.6f}")
    print(f"   Epochs: {result['epochs']}")
    print(f"   Model saved to: models/predictx_v3_futures.pth")
    print(f"   Scaler saved to: models/scaler_v3_futures.pkl")
else:
    print(f"❌ LSTM Training Failed: {result.get('message', 'Unknown error')}")
    sys.exit(1)

print()
print("=" * 50)
print("STEP 2/3: Training RL Agent (Tier 6)")
print("=" * 50)
print()
print("⏳ This step may take 15-20 minutes...")
print("   Fetching 2 years of data...")
print("   Training PPO agent for 50,000 timesteps...")
print()

from train_rl_agent import train_rl_agent

try:
    model = train_rl_agent(symbol="BTC-USD", total_timesteps=50000)
    print()
    print("✅ RL Agent Training Complete!")
    print("   Model saved to: models/ppo_agent.zip")
except Exception as e:
    print(f"❌ RL Agent Training Failed: {e}")
    sys.exit(1)

print()
print("=" * 50)
print("STEP 3/3: Running Backtest Validation")
print("=" * 50)
print()

from services.backtest_service import run_backtest_v2

print("📊 Running backtest with new models...")
print("   Period: 3 months")
print("   Interval: 1 hour")
print()

try:
    final_equity, trades, df = run_backtest_v2(
        ai_engine, 
        symbol="BTC-USD", 
        period="3mo", 
        interval="1h"
    )
    
    print()
    print("✅ Backtest Complete!")
    print(f"   Final Equity: ${final_equity:,.2f}")
    print(f"   Total Trades: {len(trades)}")
except Exception as e:
    print(f"❌ Backtest Failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print("=" * 50)
print("✅ ALL TRAINING COMPLETE!")
print("=" * 50)
print()
print("Models saved:")
print("  - models/predictx_v3_futures.pth (LSTM V3)")
print("  - models/scaler_v3_futures.pkl (Scaler V3)")
print("  - models/ppo_agent.zip (RL Agent)")
print()
print("You can now run backtests with the new models.")
print()
