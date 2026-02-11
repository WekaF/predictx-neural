
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

def calculate_detailed_metrics(item_equity, trades, df, initial_balance):
    """
    Menghitung metrik backtest komprehensif.
    """
    if df.empty or not trades:
        return {}

    # Basic Data
    start_price = df.iloc[0]['close']
    end_price = df.iloc[-1]['close']
    start_time = pd.to_datetime(df.iloc[0]['time'])
    end_time = pd.to_datetime(df.iloc[-1]['time'])
    duration_days = (end_time - start_time).days
    duration_years = duration_days / 365.25
    duration_months = duration_days / 30.44

    final_equity = item_equity[-1] if item_equity else initial_balance
    total_return_abs = final_equity - initial_balance
    agent_return_pct = (total_return_abs / initial_balance) * 100

    # 1. Buy & Hold Return
    buy_hold_return = ((end_price - start_price) / start_price) * 100

    # 2. Sell & Hold Return (Inverse)
    sell_hold_return = ((start_price - end_price) / start_price) * 100

    # 3. Process Trades for Win/Loss/Duration
    wins = []
    losses = []
    durations = []

    # Reconstruct paired trades
    current_buy = None

    for t in trades:
        if 'BUY' in t['type']:
            current_buy = t
        elif 'SELL' in t['type'] and current_buy:
            pnl = t['balance'] - current_buy['balance']

            # Duration
            t_time = pd.to_datetime(t['time'])
            o_time = pd.to_datetime(current_buy['time'])
            duration_mins = (t_time - o_time).total_seconds() / 60
            durations.append(duration_mins)

            if pnl > 0:
                wins.append(pnl)
            else:
                losses.append(abs(pnl))

            current_buy = None

    total_trades = len(wins) + len(losses)
    win_rate = (len(wins) / total_trades * 100) if total_trades > 0 else 0

    avg_win = np.mean(wins) if wins else 0
    avg_loss = np.mean(losses) if losses else 0

    # Risk:Reward Ratio
    risk_reward = (avg_win / avg_loss) if avg_loss > 0 else 0

    # Profit Factor
    gross_profit = sum(wins)
    gross_loss = sum(losses)
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else 0

    # Expectancy (R)
    expectancy = (len(wins)/total_trades * avg_win) - (len(losses)/total_trades * avg_loss) if total_trades > 0 else 0

    # Avg Profit / Month
    avg_profit_month = total_return_abs / duration_months if duration_months > 0 else 0

    # Time in Market
    total_time_in_market_min = sum(durations)
    total_period_min = duration_days * 24 * 60
    time_in_market_pct = (total_time_in_market_min / total_period_min * 100) if total_period_min > 0 else 0

    # 4. Returns & Ratios (Sharpe, Calmar)
    equity_series = pd.Series(item_equity)
    returns = equity_series.pct_change().dropna()

    # Sharpe Ratio (Annualized) - Assuming hourly data approx
    n_periods = 252 * 24 
    if returns.std() != 0:
        sharpe = (returns.mean() / returns.std()) * np.sqrt(n_periods)
    else:
        sharpe = 0

    # Max Drawdown
    mdd_pct = calculate_max_drawdown(item_equity)

    # Calmar Ratio
    annualized_return_pct = ((final_equity / initial_balance) ** (365/duration_days) - 1) * 100 if duration_days > 0 else 0
    calmar = abs(annualized_return_pct / mdd_pct) if mdd_pct != 0 else 0

    return {
        "agent_return": agent_return_pct,
        "avg_profit_month": avg_profit_month,
        "buy_hold_return": buy_hold_return,
        "sell_hold_return": sell_hold_return,
        "sharpe_ratio": sharpe,
        "calmar_ratio": calmar,
        "profit_factor": profit_factor,
        "expectancy": expectancy,
        "risk_reward": risk_reward,
        "max_drawdown": mdd_pct,
        "win_rate": win_rate,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "time_in_market": time_in_market_pct,
        "total_trades": total_trades,
        "buy_count": len([t for t in trades if 'BUY' in t['type']]),
        "sell_count": len([t for t in trades if 'SELL' in t['type']])
    }

def print_metrics_report(metrics):
    print("\n" + "="*40)
    print("BACKTEST PERFORMANCE REPORT")
    print("="*40)
    print(f"{'Agent Return':<25}: {metrics.get('agent_return', 0):.2f}%")
    print(f"{'Avg Profit/Month':<25}: ${metrics.get('avg_profit_month', 0):.2f}")
    print(f"{'Buy & Hold Return':<25}: {metrics.get('buy_hold_return', 0):.2f}%")
    print(f"{'Sell & Hold Return':<25}: {metrics.get('sell_hold_return', 0):.2f}%")
    print("-" * 40)
    print(f"{'Sharpe Ratio':<25}: {metrics.get('sharpe_ratio', 0):.2f}")
    print(f"{'Calmar Ratio':<25}: {metrics.get('calmar_ratio', 0):.2f}")
    print(f"{'Profit Factor':<25}: {metrics.get('profit_factor', 0):.2f}")
    print(f"{'Expectancy (R)':<25}: ${metrics.get('expectancy', 0):.2f}")
    print(f"{'Risk:Reward Ratio':<25}: {metrics.get('risk_reward', 0):.2f}")
    print("-" * 40)
    print(f"{'Max Drawdown':<25}: {metrics.get('max_drawdown', 0):.2f}%")
    print(f"{'Win Rate':<25}: {metrics.get('win_rate', 0):.2f}%")
    print(f"{'Avg Win':<25}: ${metrics.get('avg_win', 0):.2f}")
    print(f"{'Avg Loss':<25}: ${metrics.get('avg_loss', 0):.2f}")
    print("-" * 40)
    print(f"{'Time in Market':<25}: {metrics.get('time_in_market', 0):.2f}%")
    print(f"{'Total Trades':<25}: {metrics.get('total_trades', 0)}")
    print(f"{'Orders (BUY:SELL)':<25}: {metrics.get('buy_count', 0)} : {metrics.get('sell_count', 0)}")
    print("="*40 + "\n")

def plot_backtest_results(df, history):
    try:
        import matplotlib.pyplot as plt
        balances = [t['balance'] for t in history if 'balance' in t]
        if not balances:
            print("No balance history to plot")
            return
        plt.figure(figsize=(12, 6))
        plt.plot(range(len(balances)), balances, label='Equity ($)', color='green')
        plt.title('Backtest Equity Curve')
        plt.xlabel('Trade #')
        plt.ylabel('Balance ($)')
        plt.grid(True, alpha=0.3)
        plt.legend()
        plt.savefig('backtest_equity.png')
        print("📈 Equity curve saved to 'backtest_equity.png'")
    except ImportError:
        print("⚠️ Matplotlib not installed. Skipping Graph.")

def run_backtest_v2(engine, symbol="BTC-USD", period="3mo", interval="1h"):
    print(f"Strategy: The Trinity Hunter (Tier 7 - RL+CNN+LSTM)")

    # 1. Fetch Historical Data
    raw_data = get_historical_data(symbol, period=period, interval=interval)

    if "error" in raw_data:
        print(f"❌ Error fetching data: {raw_data['error']}")
        return 0, [], pd.DataFrame()

    df = pd.DataFrame(raw_data["data"])
    if df.empty:
        print("❌ No data received.")
        return 0, [], pd.DataFrame()

    # --- FEATURE ENGINEERING ---
    from ai_engine import add_indicators
    df = add_indicators(df)
    print(f"✅ Loaded {len(df)} candles with Indicators.")

    initial_balance = 1000.0
    balance = initial_balance
    position = 0.0
    trades = []

    fee_rate = 0.001
    entry_price = 0.0

    # Buffer needed for indicators (200 for EMA200) + sequence length
    start_idx = max(engine.seq_length + 20, 205)

    equity_history = []

    # Pre-fill equity history for accurate metrics
    for _ in range(start_idx):
        equity_history.append(initial_balance)

    print("⏳ Running simulation (Trinity Ensemble)...")

    for i in range(start_idx, len(df)):
        current_window_df = df.iloc[:i]
        current_candles = current_window_df.to_dict('records')

        current_price = float(df.iloc[i]['close'])
        current_low = float(df.iloc[i]['low'])
        current_high = float(df.iloc[i]['high'])
        timestamp = df.iloc[i]['time']

        executed_trade = False

        # 1. Check Open Position (Exit Logic)
        if position > 0:
            pnl_pct = (current_price - entry_price) / entry_price

            # Dynamic TP/SL or Signal Exit?
            # Basic Safety TP/SL
            tp_hit = current_high >= entry_price * 1.06
            sl_hit = current_low <= entry_price * 0.95 # Looser SL for Swing

            # Ask AI for Exit Signal (Trinity)
            # We need to construct State Vector for RL
            prob = engine.predict_next_move(current_candles)

            # Construct State Vector [close_norm, rsi, ema, lstm_prob, pos, bal, lev]
            recent_prices = df['close'].iloc[max(0, i-100):i+1]
            if recent_prices.max() == recent_prices.min():
                 close_norm = 0.5
            else:
                 close_norm = (current_price - recent_prices.min()) / (recent_prices.max() - recent_prices.min())

            rsi_norm = df.iloc[i]['rsi'] / 100.0
            ema_diff = df.iloc[i]['ema_diff']
            pos_state = 1
            bal_norm = balance / initial_balance # Approximation

            # RL State
            state_vector = np.array([
               close_norm, rsi_norm, ema_diff, prob, pos_state, bal_norm, 0.2
            ], dtype=np.float32)

            # Fix State Vector shape issues if any
            if state_vector.shape != (7,):
                 state_vector = np.zeros(7, dtype=np.float32)

            action_code, confidence = engine.decide_action(prob, state_vector, current_candles)

            exit_reason = ""
            exit_price = current_price

            if tp_hit:
                exit_reason = "TP (+6%)"
                exit_price = entry_price * 1.06
            elif sl_hit:
                exit_reason = "SL (-5%)"
                exit_price = entry_price * 0.95
            elif "SELL" in action_code:
                # Only exit on Sell signal if confidence is decent
                if confidence > 32:
                     exit_reason = f"AI Sell ({confidence}%)"
                     exit_price = current_price

            if exit_reason:
                sell_val = position * exit_price
                fee = sell_val * fee_rate
                balance = sell_val - fee
                trades.append({
                    "time": timestamp, "type": "SELL", "price": exit_price,
                    "balance": balance, "reason": exit_reason
                })
                position = 0
                entry_price = 0
                executed_trade = True

        # 2. Check Entry
        if not executed_trade and position == 0:
            prob = engine.predict_next_move(current_candles)

            # Construct State Vector
            recent_prices = df['close'].iloc[max(0, i-100):i+1]
            if recent_prices.max() == recent_prices.min():
                 close_norm = 0.5
            else:
                 close_norm = (current_price - recent_prices.min()) / (recent_prices.max() - recent_prices.min())

            rsi_norm = df.iloc[i]['rsi'] / 100.0
            ema_diff = df.iloc[i]['ema_diff']
            pos_state = 0
            bal_norm = balance / initial_balance

            state_vector = np.array([
               close_norm, rsi_norm, ema_diff, prob, pos_state, bal_norm, 0
            ], dtype=np.float32)

            if state_vector.shape != (7,):
                 state_vector = np.zeros(7, dtype=np.float32)

            # Trinity Decision
            action_code, confidence = engine.decide_action(prob, state_vector, current_candles)

            if "BUY" in action_code and balance > 10:
                # Extract Leverage if present (e.g. BUY_3x)
                leverage = 1
                if "_" in action_code:
                     try:
                         leverage = int(action_code.split("_")[1].replace("x",""))
                     except:
                         leverage = 1

                # Filter weak confidence
                if confidence > 38:
                    buy_val = balance
                    fee = buy_val * fee_rate
                    net_buy = buy_val - fee

                    position = net_buy / current_price
                    balance = 0
                    entry_price = current_price

                    trades.append({
                        "time": timestamp, "type": f"BUY ({leverage}x Signal)",
                        "price": current_price, "confidence": confidence,
                        "balance": balance, "reason": f"Trinity {action_code} ({confidence}%)"
                    })

        # TRACK EQUITY
        current_val = balance + (position * current_price) if position > 0 else balance
        equity_history.append(current_val)

    # Final Value
    final_equity = balance + (position * df.iloc[-1]['close'])
    if equity_history:
        equity_history[-1] = final_equity

    # Calculate Detailed Metrics
    metrics = calculate_detailed_metrics(equity_history, trades, df, initial_balance)
    print_metrics_report(metrics)

    return final_equity, trades, df
