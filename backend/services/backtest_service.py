import pandas as pd
import numpy as np
import time
from services.data_service import get_historical_data

def calculate_max_drawdown(balances):
    """
    Menghitung persentase penurunan terdalam dari titik puncak (Peak)
    """
    if not balances:
        return 0
    
    # Konversi ke numpy array untuk perhitungan cepat
    equity_curve = np.array(balances)
    
    # Hitung running maximum (titik tertinggi sejauh ini)
    peak = np.maximum.accumulate(equity_curve)
    
    # Hitung drawdown (selisih dari peak)
    # Avoid division by zero
    drawdown = np.zeros_like(peak)
    mask = peak > 0
    drawdown[mask] = (equity_curve[mask] - peak[mask]) / peak[mask]
    
    # Ambil nilai minimum (penurunan paling dalam)
    max_drawdown = np.min(drawdown) if len(drawdown) > 0 else 0
    
    return max_drawdown * 100 # Dalam persen

def plot_backtest_results(df, history):
    """
    Menampilkan grafik backtest sederhana menggunakan matplotlib (jika tersedia)
    atau ASCII chart sebagai fallback.
    """
    try:
        import matplotlib.pyplot as plt
        
        # 1. Prepare Data
        times = [t['time'] for t in history]
        balances = [t['balance'] for t in history if 'balance' in t]
        
        # Add initial balance if trades started after
        if len(balances) < len(times): 
             # Should align data properly based on trade execution
             pass

        if not balances:
            print("No balance history to plot")
            return

        # 2. Equity Curve
        plt.figure(figsize=(12, 6))
        plt.plot(range(len(balances)), balances, label='Equity ($)', color='green')
        plt.title('Backtest Equity Curve')
        plt.xlabel('Trade #')
        plt.ylabel('Balance ($)')
        plt.grid(True, alpha=0.3)
        plt.legend()
        
        # Save plot
        plt.savefig('backtest_equity.png')
        print("📈 Equity curve saved to 'backtest_equity.png'")
        # plt.show() # Blocking call, avoid in automated scripts
        
    except ImportError:
        print("⚠️ Matplotlib not installed. Skipping Graph.")

def run_backtest_v2(engine, symbol="BTC-USD", period="3mo", interval="1h"):
    print(f"Strategy: The Quality Hunter (Tier 4.1)")
    
    # 1. Fetch Historical Data
    raw_data = get_historical_data(symbol, period=period, interval=interval)
    
    if "error" in raw_data:
        print(f"❌ Error fetching data: {raw_data['error']}")
        return 0, [], pd.DataFrame()

    df = pd.DataFrame(raw_data["data"])
    if df.empty:
        print("❌ No data received.")
        return 0, [], pd.DataFrame()

    print(f"✅ Loaded {len(df)} candles.")

    initial_balance = 1000.0
    balance = initial_balance
    position = 0.0
    trades = []
    
    fee_rate = 0.001
    entry_price = 0.0
    
    # Start after seq_length + buffer
    start_idx = engine.seq_length + 20 
    
    equity_history = []
    
    print("⏳ Running simulation...")
    
    for i in range(start_idx, len(df)):
        current_window_df = df.iloc[:i]
        current_candles = current_window_df.to_dict('records')
        
        current_price = float(df.iloc[i]['close'])
        current_low = float(df.iloc[i]['low'])
        current_high = float(df.iloc[i]['high'])
        timestamp = df.iloc[i]['time']
        
        # --- EXECUTION LOGIC (TP/SL/SIGNAL) ---
        
        # 1. Check Open Position
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
                    "balance": balance,
                    "reason": "TP (+6%)"
                })
                position = 0
                entry_price = 0
                continue
                
            # Stop Loss (-2.5%)
            if current_low <= entry_price * 0.975:
                sell_price = entry_price * 0.975
                sell_amount_usd = position * sell_price
                fee = sell_amount_usd * fee_rate
                balance = sell_amount_usd - fee
                
                trades.append({
                    "time": timestamp,
                    "type": "SELL (SL)",
                    "price": sell_price,
                    "balance": balance,
                    "reason": "SL (-2.5%)"
                })
                position = 0
                entry_price = 0
                continue

        # 2. Get AI Signal
        prob = engine.predict_next_move(current_candles)
        action, confidence = engine.decide_action(prob, candles=current_candles)
        
        # 3. Enter/Exit based on AI
        if action == "BUY" and balance > 10:
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
                "balance": initial_balance if len(trades) == 0 else trades[-1]['balance'], # Snapshot balance before trade? Or after? Keeping consistent equity curve is tricky with 0 balance logic.
                "reason": f"AI Buy ({confidence}%)"
            })
            
        elif action == "SELL" and position > 0:
            sell_amount_usd = position * current_price
            fee = sell_amount_usd * fee_rate
            balance = sell_amount_usd - fee
            
            trades.append({
                "time": timestamp,
                "type": "SELL",
                "price": current_price,
                "confidence": confidence,
                "balance": balance,
                "reason": f"AI Sell ({confidence}%)"
            })
            position = 0
            entry_price = 0
            
    # Final Value
    final_equity = balance + (position * df.iloc[-1]['close'])
    
    # Fix Equity Curve for Graphing
    # We want a continuous balance visualization. 
    # Since we go All-In (Balance=0), we should reconstruct equity at each trade.
    reconstructed_history = []
    current_equity = initial_balance
    
    # Pre-fill start
    reconstructed_history.append({'time': df.iloc[0]['time'], 'balance': initial_balance})
    
    for t in trades:
        # If BUY, equity roughly same (minus fee)
        # If SELL, equity updates
        if t['type'] == 'BUY':
             # Value is cash - fee. Effectively still equity.
             # We can just track the realized balance updates on SELLs
             pass
        else:
             reconstructed_history.append(t)

    return final_equity, trades, df
