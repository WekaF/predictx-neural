import asyncio
import pandas as pd
import numpy as np
import sys
import os

# Add parent directory to path to allow importing modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_engine import ai_engine
from services.data_service import get_historical_data

def run_backtest(engine, symbol="BTC-USD", period="1mo", interval="1h"):
    print(f"\n--- 🚀 Starting Tier 3.5 AI Backtest for {symbol} ---")
    print(f"Period: {period} | Interval: {interval}")
    print(f"Strategy: Scalp (1H) + Volatility Filter + SL(3%) Only")
    
    # 1. Fetch Historical Data
    raw_data = get_historical_data(symbol, period=period, interval=interval)
    
    if "error" in raw_data:
        print(f"❌ Error fetching data: {raw_data['error']}")
        return

    df = pd.DataFrame(raw_data["data"])
    if df.empty:
        print("❌ No data received.")
        return

    print(f"✅ Loaded {len(df)} candles.")

    initial_balance = 1000.0  # USD
    balance = initial_balance
    position = 0.0            # Amount of coin held
    trades = []
    
    # fees (0.1% per trade)
    fee_rate = 0.001

    entry_price = 0.0
    
    # 2. Iterate through time (Simulate bar-by-bar)
    # Start after seq_length to ensure enough data for prediction
    start_idx = engine.seq_length + 20 
    
    print("⏳ Running simulation...")
    
    for i in range(start_idx, len(df)):
        # Slice data as if it's "now"
        current_window_df = df.iloc[:i]
        current_candles = current_window_df.to_dict('records')
        
        current_price = float(df.iloc[i]['close'])
        current_high = float(df.iloc[i]['high'])
        current_low = float(df.iloc[i]['low'])
        timestamp = df.iloc[i]['time']
        
        # --- CHECK SL FIRST (If in position) ---
        if position > 0:
            # Stop Loss (-3%) - Safety Net Only
            if current_low <= entry_price * 0.97:
                sell_price = entry_price * 0.97
                sell_amount_usd = position * sell_price
                fee = sell_amount_usd * fee_rate
                balance = sell_amount_usd - fee
                
                trades.append({
                    "time": timestamp,
                    "type": "SELL (SL)",
                    "price": sell_price,
                    "confidence": 100,
                    "prob": 0.0,
                    "balance": balance
                })
                # print(f"🛑 STOP LOSS at ${sell_price:.2f}")
                position = 0
                entry_price = 0
                continue

        # Get AI Prediction
        prob = engine.predict_next_move(current_candles)
        action, confidence = engine.decide_action(prob)
        
        # 3. Execution Logic
        if action == "BUY" and balance > 10: # Minimum trade size
            # Buy All
            buy_amount_usd = balance
            fee = buy_amount_usd * fee_rate
            net_buy_amount = buy_amount_usd - fee
            
            position = net_buy_amount / current_price
            balance = 0
            entry_price = current_price
            
            trades.append({
                "time": timestamp,
                "type": "BUY",
                "price": current_price,
                "confidence": confidence,
                "prob": round(prob, 2)
            })
            # print(f"🟢 BUY at ${current_price:.2f} (Conf: {confidence}%)")
            
        elif action == "SELL" and position > 0:
            # AI Signal Sell (Active Management)
            sell_amount_usd = position * current_price
            fee = sell_amount_usd * fee_rate
            balance = sell_amount_usd - fee
            
            trades.append({
                "time": timestamp,
                "type": "SELL (Signal)",
                "price": current_price,
                "confidence": confidence,
                "prob": round(prob, 2),
                "balance": balance
            })
            # print(f"🔴 SELL at ${current_price:.2f} (Conf: {confidence}%)")
            position = 0
            entry_price = 0

    # 4. Final Results
    final_equity = balance + (position * df.iloc[-1]['close'])
    profit_pct = ((final_equity - initial_balance) / initial_balance) * 100
    
    print("\n--- 📊 Backtest Results ---")
    print(f"Initial Balance: ${initial_balance:.2f}")
    print(f"Final Equity:    ${final_equity:.2f}")
    print(f"Total Return:    {profit_pct:.2f}%")
    print(f"Total Trades:    {len(trades)}")
    
    if len(trades) > 0:
        wins = 0
        losses = 0
        last_buy_price = 0
        for t in trades:
            if t['type'] == 'BUY':
                last_buy_price = t['price']
            elif 'SELL' in t['type'] and last_buy_price > 0:
                if t['price'] > last_buy_price:
                    wins += 1
                else:
                    losses += 1
                last_buy_price = 0
        
        print(f"Win Rate:        {wins}/{wins+losses} ({wins/(wins+losses)*100:.1f}%)" if (wins+losses) > 0 else "Win Rate: N/A")

    return trades

if __name__ == "__main__":
    # Ensure model is in a usable state (it will be random if not trained)
    # But we want to test the pipeline.
    
    # Optional: Trigger training first?
    print("Auto-Training first to ensure model architecture matches...")
    ai_engine.train(symbol="BTC-USD", epochs=5, interval="1h") 
    
    run_backtest(ai_engine, symbol="BTC-USD", period="1mo", interval="1h")
