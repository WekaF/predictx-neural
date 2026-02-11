import sys
import pandas as pd
import os
import shutil
import argparse

# Add current directory to path so imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_engine import ai_engine
from services.backtest_service import run_backtest_v2, plot_backtest_results, calculate_max_drawdown

def main():
    parser = argparse.ArgumentParser(description='PredictX AI Pipeline')
    parser.add_argument('--tier', type=int, default=5, help='AI Tier Level (4-7)')
    parser.add_argument('--symbol', type=str, default='BTC-USD', help='Trading Symbol')
    parser.add_argument('--interval', type=str, default='1h', help='Timeframe Interval')
    parser.add_argument('--epochs', type=int, default=30, help='Training Epochs')
    
    args = parser.parse_args()
    
    print(f"--- 🤖 PredictX AI Pipeline (Tier {args.tier}) ---")
    
    # Update AI Engine output to reflect tier (logic is handled inside engine based on loaded models)
    if args.tier >= 7:
        print("ℹ️  Tier 7 Mode: Enabling CNN Pattern Recognition & Ensemble Logic if available.")
    
    # 1. Inisialisasi Engine
    engine = ai_engine 
    
    # 2. Re-Training (Fresh Start)
    print("\n[1/3] Memulai Training Model dengan Fitur Baru...")
    train_result = engine.train(symbol=args.symbol, epochs=args.epochs, interval=args.interval)
    
    if train_result["status"] == "success":
        print(f"✅ Training Selesai. Final Loss: {train_result['final_loss']:.6f}")
    else:
        print("❌ Training Gagal. Menghentikan Pipeline."); return

    # 3. Backtesting
    print(f"\n[2/3] Menjalankan Backtest (Interval {args.interval}, TP 6%, SL 2.5%)...")
    
    final_equity, history, df = run_backtest_v2(engine, symbol=args.symbol, period="3mo", interval=args.interval)
    
    if len(history) == 0:
        print("⚠️ No trades generated.")
        return

    # 4. Analisis & Visualisasi
    print("\n[3/3] Menganalisis Hasil & Membuat Grafik...")
    
    balances = [h['balance'] for h in history if 'balance' in h]
    if not balances:
        balances = [1000] # Fallback
        
    mdd = calculate_max_drawdown(balances)
    total_return = ((final_equity - 1000) / 1000) * 100
    
    print("-" * 30)
    print(f"HASIL AKHIR     : ${final_equity:.2f}")
    print(f"TOTAL RETURN    : {total_return:.2f}%")
    print(f"MAX DRAWDOWN    : {mdd:.2f}%")
    print(f"TOTAL TRADES    : {len(history)}")
    print("-" * 30)
    
    # Munculkan Grafik
    plot_backtest_results(df, history)

if __name__ == "__main__":
    main()
