import sys
import os
import pandas as pd
import numpy as np

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_engine import ai_engine, add_indicators
from services.data_service import get_historical_data
from rl_trading_env import TradingEnv

def test_rl_agent():
    """
    Test Tier 6 RL Agent performance vs Tier 5 LSTM
    """
    print("🧪 Testing Tier 6: Hybrid RL + LSTM")
    print("=" * 60)
    
    # 1. Fetch Test Data
    print("\n[1/4] Fetching test data (3 months)...")
    raw_data = get_historical_data("BTC-USD", period="3mo", interval="1h")
    
    if "error" in raw_data:
        print(f"❌ Error: {raw_data['error']}")
        return
    
    df = pd.DataFrame(raw_data["data"])
    df = add_indicators(df)
    print(f"✅ Loaded {len(df)} candles")
    
    # 2. Test RL Agent in Environment
    print("\n[2/4] Testing RL Agent in trading environment...")
    env = TradingEnv(df, initial_balance=250000)
    
    if not ai_engine.rl_enabled:
        print("❌ RL Agent not loaded. Run train_rl_agent.py first.")
        return
    
    obs, _ = env.reset()
    total_reward = 0
    done = False
    steps = 0
    max_steps = min(len(df) - 100, 500)  # Test on 500 candles
    
    while not done and steps < max_steps:
        # Get RL action
        action, _states = ai_engine.rl_agent.predict(obs, deterministic=True)
        obs, reward, done, truncated, info = env.step(action)
        total_reward += reward
        steps += 1
        
        if steps % 100 == 0:
            print(f"  Step {steps}/{max_steps} | Balance: Rp {info['balance']:,.0f} | Trades: {info['trades']}")
    
    # 3. Results
    print("\n[3/4] RL Agent Test Results:")
    print("-" * 60)
    print(f"Steps Executed    : {steps}")
    print(f"Total Reward      : {total_reward:.2f}")
    print(f"Final Balance     : Rp {info['balance']:,.0f}")
    print(f"Total Trades      : {info['trades']}")
    print(f"Total Profit      : Rp {info['total_profit']:,.2f}")
    
    roi = ((info['balance'] - 250000) / 250000) * 100
    print(f"ROI               : {roi:.2f}%")
    
    # 4. Compare with Tier 5 (LSTM Only)
    print("\n[4/4] Comparing with Tier 5 (LSTM Only)...")
    
    # Simple LSTM-only simulation
    lstm_balance = 250000
    lstm_position = 0
    lstm_entry = 0
    lstm_trades = 0
    
    for i in range(60, min(len(df), 560)):
        current_candles = df.iloc[:i].to_dict('records')
        current_price = df.iloc[i]['close']
        
        prob = ai_engine.predict_next_move(current_candles)
        action, conf = ai_engine.decide_action(prob)  # Tier 5 logic (no RL)
        
        if action == "BUY" and lstm_position == 0 and lstm_balance > 10000:
            lstm_position = (lstm_balance * 0.2) / current_price
            lstm_entry = current_price
            lstm_balance -= (lstm_balance * 0.2)
            lstm_trades += 1
        elif action == "SELL" and lstm_position > 0:
            lstm_balance += lstm_position * current_price
            lstm_position = 0
    
    # Final LSTM equity
    lstm_final = lstm_balance + (lstm_position * df.iloc[-1]['close'] if lstm_position > 0 else 0)
    lstm_roi = ((lstm_final - 250000) / 250000) * 100
    
    print("\n📊 COMPARISON:")
    print("=" * 60)
    print(f"{'Metric':<20} {'Tier 5 (LSTM)':<20} {'Tier 6 (RL+LSTM)':<20}")
    print("-" * 60)
    print(f"{'Final Balance':<20} Rp {lstm_final:>15,.0f}  Rp {info['balance']:>15,.0f}")
    print(f"{'ROI':<20} {lstm_roi:>18.2f}%  {roi:>18.2f}%")
    print(f"{'Total Trades':<20} {lstm_trades:>18}  {info['trades']:>18}")
    print("=" * 60)
    
    if roi > lstm_roi:
        improvement = roi - lstm_roi
        print(f"\n✅ Tier 6 BETTER by {improvement:.2f}%!")
    else:
        decline = lstm_roi - roi
        print(f"\n⚠️ Tier 6 WORSE by {decline:.2f}%. May need more training.")
    
    print("\n💡 Note: RL agent trained on 2y data, tested on 3mo.")
    print("   For best results, retrain with 500k+ timesteps.")

if __name__ == "__main__":
    test_rl_agent()
