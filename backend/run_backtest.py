import asyncio
import pandas as pd
import numpy as np
import sys
import os
import time
import csv

# Add parent directory to path to allow importing modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_engine import ai_engine
from ai_engine import ai_engine, add_indicators
from services.data_service import get_historical_data

def run_backtest(engine, symbol="BTC-USD", period="3mo", interval="1h"):
    print(f"\n--- 🚀 Starting Tier 4 AI Backtest for {symbol} ---")
    print(f"\n--- 🚀 Starting Tier 5 AI Backtest (Trend Surfer) for {symbol} ---")
    print(f"Period: {period} | Interval: {interval}")
    print(f"Strategy: The Quality Hunter (Strict Filters, High Confidence)")
    print(f"Strategy: LSTM + EMA 200 Filter + ATR Trailing Stop")
    
    # 1. Fetch Historical Data
    raw_data = get_historical_data(symbol, period=period, interval=interval)
    
    if "error" in raw_data:
        print(f"❌ Error fetching data: {raw_data['error']}")
        return

    df = pd.DataFrame(raw_data["data"])
    if df.empty:
        print("❌ No data received.")
        return

    # --- FEATURE ENGINEERING (Calculate EMA 200 & ATR) ---
    df = add_indicators(df)
    # -----------------------------------------------------

    print(f"✅ Loaded {len(df)} candles.")

    initial_balance = 1000.0  # USD
    balance = initial_balance
    position = 0.0            # Amount of coin held
    trades = []
    
    # fees (0.1% per trade)
    fee_rate = 0.001
    
    entry_price = 0.0 # Track entry price
    entry_price = 0.0
    trailing_sl_price = 0.0  # Variable untuk Trailing Stop
    
    # 2. Iterate through time (Simulate bar-by-bar)
    # Start after seq_length to ensure enough data for prediction
    start_idx = engine.seq_length + 20 
    # Start after 200 candles to ensure EMA 200 is valid
    start_idx = max(engine.seq_length + 20, 205)
    
    print("⏳ Running simulation...")
    
    for i in range(start_idx, len(df)):
        # Slice data as if it's "now"
        current_window_df = df.iloc[:i]
        current_candles = current_window_df.to_dict('records')
        
        current_price = float(df.iloc[i]['close'])
        current_low = float(df.iloc[i]['low'])
        current_high = float(df.iloc[i]['high'])
        timestamp = df.iloc[i]['time']
        
        # --- CHECK TP/SL FIRST (If in position) ---
        if position > 0:
            # Take Profit (+6%)
            if current_high >= entry_price * 1.06:
                sell_price = entry_price * 1.06
                sell_amount_usd = position * sell_price
                fee = sell_amount_usd * fee_rate
                balance = sell_amount_usd - fee
                
                trades.append({
                    "time": timestamp,
                    "type": "SELL (TP)",
                    "price": sell_price,
                    "confidence": 100,
                    "prob": 0.0,
                    "balance": balance,
                    "reason": "Take Profit (+6%)"
                })
                position = 0
                entry_price = 0
                continue
                
            # Stop Loss (-2.5%) - Tighter Risk
            if current_low <= entry_price * 0.975:
                sell_price = entry_price * 0.975
                sell_amount_usd = position * sell_price
                fee = sell_amount_usd * fee_rate
                balance = sell_amount_usd - fee
                
                trades.append({
                    "time": timestamp,
                    "type": "SELL (SL)",
                    "price": sell_price,
                    "confidence": 100,
                    "prob": 0.0,
                    "balance": balance,
                    "reason": "Stop Loss (-2.5%)"
                })
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
                "prob": round(prob, 2),
                "reason": f"AI Signal (Conf: {confidence}%)"
            })
            # print(f"🟢 BUY at ${current_price:.2f} (Conf: {confidence}%)")
            
        elif action == "SELL" and position > 0:
            # AI Signal Sell
            sell_amount_usd = position * current_price
            fee = sell_amount_usd * fee_rate
            balance = sell_amount_usd - fee
            
            trades.append({
                "time": timestamp,
                "type": "SELL",
                "price": current_price,
                "confidence": confidence,
                "prob": round(prob, 2),
                "balance": balance,
                "reason": f"AI Signal (Conf: {confidence}%)"
            })
            # print(f"🔴 SELL at ${current_price:.2f} (Conf: {confidence}%)")
            position = 0
            entry_price = 0

    # 4. Final Results
    final_equity = balance + (position * df.iloc[-1]['close'])
    profit_pct = ((final_equity - initial_balance) / initial_balance) * 100
    
    # Calculate Max Drawdown
    equity_curve = [initial_balance]
    temp_bal = initial_balance
    for t in trades:
        if 'balance' in t:
            temp_bal = t['balance']
        equity_curve.append(temp_bal)
    
    # Simple Max Drawdown Calc
    peak = initial_balance
    max_dd = 0
    for val in equity_curve:
        if val > peak:
            peak = val
        dd = (val - peak) / peak
        if dd < max_dd:
            max_dd = dd
            
    mdd_pct = max_dd * 100

    print("\n--- 📊 Tier 4 BACKTEST REPORT ---")
    print(f"Symbol: {symbol} | Period: {period} | Interval: {interval}")
    
    print("\n💰 FINANCIALS:")
    print(f"Initial Balance  : ${initial_balance:,.2f}")
    print(f"Final Equity     : ${final_equity:,.2f}")
    print(f"Total Return     : {profit_pct:+.2f}%")
    print(f"Max Drawdown     : {mdd_pct:.2f}%")
    
    print("\n🛡️ RISK METRICS:")
    print(f"Total Trades     : {len(trades)}")
    
    # Win Rate Calc
    wins = 0
    losses = 0
    if len(trades) > 0:
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
        
        total_closed = wins + losses
        wr = (wins / total_closed * 100) if total_closed > 0 else 0
        pf = (wins * 6) / (losses * 2.5) if losses > 0 else 0 # Approximate Profit Factor based on TP/SL
        
        print(f"Win Rate         : {wr:.1f}% ({wins}/{total_closed})")
        print(f"Profit Factor    : {pf:.2f} (Est)")
        print(f"Avg. Win         : +6.0% (TP)")
        print(f"Avg. Loss        : -2.5% (SL)")
        print(f"Avg. Win         : Dynamic (Trailing)")
        print(f"Avg. Loss        : Dynamic (ATR)")

        if profit_pct > 0 and mdd_pct > -15:
            print("\n✅ Status: STRATEGY VALIDATED (Ready for Paper Trading)")
        else:
            print("\n⚠️ Status: NEEDS TUNING (High Drawdown or Negative Return)")
            print("\n⚠️ Status: NEEDS TUNING (Check Trend Filters)")
    else:
        print("Win Rate         : N/A (No Trades)")

    # 5. CSV Logging
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
        
    csv_file = f"{log_dir}/backtest_tier4_{int(time.time())}.csv"
    keys = ["time", "type", "price", "confidence", "prob", "balance", "reason"]
    
    with open(csv_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for t in trades:
            # Filter out keys that might not exist in all dicts or are extra
            row = {k: t.get(k, '') for k in keys}
            writer.writerow(row)
            
    print(f"📝 Trade log saved to: {csv_file}")

    return trades

if __name__ == "__main__":
    # Ensure model is in a usable state (it will be random if not trained)
    # But we want to test the pipeline.
    
    # Optional: Trigger training first?
    # print("Auto-Training first to ensure model adapts to Tier 4 Logic...")
    # ai_engine.train(symbol="BTC-USD", epochs=5, interval="1h") 
    
    run_backtest(ai_engine, symbol="BTC-USD", period="3mo", interval="1h")
