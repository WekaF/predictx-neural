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
from utils.smc_utils import StrategyConfig

def run_backtest(engine, symbol="BTC-USD", period="3mo", interval="1h"):
    print(f"\n--- 🚀 Starting Tier 6 AI Backtest (Unified Strategy) for {symbol} ---")
    print(f"Period: {period} | Interval: {interval}")
    print(f"Strategy: LSTM + Unified StrategyConfig (SL: {StrategyConfig.DEFAULT_SL_PCT*100}%, TP: {StrategyConfig.DEFAULT_TP_PCT*100}%)")
    
    # 1. Fetch Historical Data with Futures
    raw_data = get_historical_data(symbol, period=period, interval=interval, include_futures=True)
    
    if "error" in raw_data:
        print(f"❌ Error fetching data: {raw_data['error']}")
        return

    df = pd.DataFrame(raw_data["data"])
    if df.empty:
        print("❌ No data received.")
        return

    # --- FEATURE ENGINEERING ---
    df = add_indicators(df)
    # ---------------------------

    print(f"✅ Loaded {len(df)} candles with Futures features.")

    initial_balance = 1000.0  
    balance = initial_balance
    position = 0.0            
    trades = []
    
    fee_rate = 0.001
    entry_price = 0.0
    
    # 2. Iterate through time (Simulate bar-by-bar)
    start_idx = max(engine.seq_length + 20, 205)
    
    print("⏳ Running simulation...")
    
    for i in range(start_idx, len(df)):
        current_window_df = df.iloc[:i]
        current_candles = current_window_df.to_dict('records')
        
        current_price = float(df.iloc[i]['close'])
        current_low = float(df.iloc[i]['low'])
        current_high = float(df.iloc[i]['high'])
        timestamp = df.iloc[i]['time']
        
        # --- CHECK TP/SL FIRST (Unified Trailing Logic) ---
        if position > 0:
            current_sl_pct = StrategyConfig.DEFAULT_SL_PCT
            current_tp_pct = StrategyConfig.DEFAULT_TP_PCT
            pnl_high_pct = (current_high - entry_price) / entry_price
            
            level_hit = None
            cfg = StrategyConfig.TRAILING_CONFIG
            if pnl_high_pct >= cfg["LEVEL_3"]["trigger"]:
                current_sl_pct = -cfg["LEVEL_3"]["sl_move"]
                current_tp_pct = cfg["LEVEL_3"]["tp_move"]
                level_hit = "LEVEL 3"
            elif pnl_high_pct >= cfg["LEVEL_2"]["trigger"]:
                current_sl_pct = -cfg["LEVEL_2"]["sl_move"]
                current_tp_pct = cfg["LEVEL_2"]["tp_move"]
                level_hit = "LEVEL 2"
            elif pnl_high_pct >= cfg["LEVEL_1"]["trigger"]:
                current_sl_pct = -cfg["LEVEL_1"]["sl_move"]
                level_hit = "LEVEL 1"

            tp_price = entry_price * (1 + current_tp_pct)
            sl_price = entry_price * (1 - current_sl_pct)
            
            # Take Profit
            if current_high >= tp_price:
                sell_price = tp_price
                proceeds = (position * sell_price) * (1 - fee_rate)
                balance += proceeds
                
                reason = f"Take Profit (+{current_tp_pct*100:.1f}%)"
                if level_hit: reason += f" [{level_hit}]"
                
                trades.append({
                    "time": timestamp, "type": "SELL (TP)", "price": sell_price,
                    "confidence": 100, "prob": 0.0, "balance": balance, "reason": reason
                })
                position = 0
                entry_price = 0
                continue
                
            # Stop Loss
            if current_low <= sl_price:
                sell_price = sl_price
                proceeds = (position * sell_price) * (1 - fee_rate)
                balance += proceeds
                
                if level_hit:
                    reason = f"Trailing Stop (+{-current_sl_pct*100:.1f}%) [{level_hit}]"
                else:
                    reason = f"Stop Loss (-{current_sl_pct*100:.1f}%)"

                trades.append({
                    "time": timestamp, "type": "SELL (SL)", "price": sell_price,
                    "confidence": 100, "prob": 0.0, "balance": balance, "reason": reason
                })
                position = 0
                entry_price = 0
                continue

        # Get AI Prediction
        prob = engine.predict_next_move(current_candles)
        action, confidence, meta = engine.decide_action(prob, candles=current_candles)

        
        # 3. Execution Logic with StrategyConfig filters
        if action == "BUY" and balance > 10 and confidence >= StrategyConfig.MIN_CONFIDENCE:
            # Position sizing based on 2% risk rule
            risk_amt = balance * StrategyConfig.MAX_DRAWDOWN_PER_TRADE
            total_size = risk_amt / (StrategyConfig.DEFAULT_SL_PCT * StrategyConfig.BASE_LEVERAGE)
            
            # Clamp size to balance (since this is spot-simulated backtest but futures rules)
            buy_amount_usd = min(balance, total_size)
            fee = buy_amount_usd * fee_rate
            net_buy_amount = buy_amount_usd - fee
            
            position = net_buy_amount / current_price
            balance -= buy_amount_usd
            entry_price = current_price
            
            trades.append({
                "time": timestamp,
                "type": "BUY",
                "price": current_price,
                "confidence": confidence,
                "prob": round(prob, 2),
                "reason": f"AI Signal (Conf: {confidence}%)"
            })
            
        elif action == "SELL" and position > 0:
            # Exit position
            sell_amount_usd = position * current_price
            fee = sell_amount_usd * fee_rate
            balance += (sell_amount_usd - fee)
            
            trades.append({
                "time": timestamp,
                "type": "SELL",
                "price": current_price,
                "confidence": confidence,
                "prob": round(prob, 2),
                "balance": balance,
                "reason": f"AI Signal Exit (Conf: {confidence}%)"
            })
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
    
    peak = initial_balance
    max_dd = 0
    for val in equity_curve:
        if val > peak: peak = val
        dd = (val - peak) / peak
        if dd < max_dd: max_dd = dd
            
    mdd_pct = max_dd * 100

    print("\n--- 📊 Tier 6 BACKTEST REPORT ---")
    print(f"Symbol: {symbol} | Period: {period} | Interval: {interval}")
    print(f"Initial Balance  : ${initial_balance:,.2f}")
    print(f"Final Equity     : ${final_equity:,.2f}")
    print(f"Total Return     : {profit_pct:+.2f}%")
    print(f"Max Drawdown     : {mdd_pct:.2f}%")
    print(f"Total Trades     : {len(trades)}")
    
    if len(trades) > 0:
        wins = 0
        losses = 0
        last_buy_price = 0
        for t in trades:
            if t['type'] == 'BUY':
                last_buy_price = t['price']
            elif 'SELL' in t['type'] and last_buy_price > 0:
                if t['price'] > last_buy_price: wins += 1
                else: losses += 1
                last_buy_price = 0
        
        total_closed = wins + losses
        wr = (wins / total_closed * 100) if total_closed > 0 else 0
        print(f"Win Rate         : {wr:.1f}% ({wins}/{total_closed})")

    # 5. CSV Logging
    log_dir = "logs"
    if not os.path.exists(log_dir): os.makedirs(log_dir)
    csv_file = f"{log_dir}/backtest_tier6_{int(time.time())}.csv"
    keys = ["time", "type", "price", "confidence", "prob", "balance", "reason"]
    with open(csv_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for t in trades:
            row = {k: t.get(k, '') for k in keys}
            writer.writerow(row)
    print(f"📝 Trade log saved to: {csv_file}")
    return trades

if __name__ == "__main__":
    run_backtest(ai_engine, symbol="BTC-USD", period="3mo", interval="1h")

