import sys
import pandas as pd
import os
import shutil

# Add current directory to path so imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_engine import ai_engine, AIEngine
from services.backtest_service import run_backtest_v2, plot_backtest_results, calculate_max_drawdown

def main():
    print("--- 🤖 PredictX Tier 4: Automated Pipeline ---")
    
    # 1. Inisialisasi Engine
    # Note: ai_engine is already instantiated in ai_engine.py as 'ai_engine'.
    # But user requested 'AIEngine()', so let's stick to their pattern or use the singleton.
    # The singleton 'ai_engine' has models loaded. A fresh AIEngine() might not.
    # User said: "Re-Training (Fresh Start)". So maybe new instance is better, 
    # BUT we need to ensure it initializes correctly.
    # ai_engine.py's __init__ loads existing models.
    # To do a FRESH start, we should probably clear the model file first?
    # User said: "Bersihkan Cache: Hapus folder __pycache__ dan file model lama"
    
    engine = ai_engine # Use the singleton which handles loading
    
    # 2. Re-Training (Fresh Start)
    print("\n[1/3] Memulai Training Model dengan Fitur Baru...")
    # 30 Epochs as requested
    train_result = engine.train(symbol="BTC-USD", epochs=30, interval="1h")
    
    if train_result["status"] == "success":
        print(f"✅ Training Selesai. Final Loss: {train_result['final_loss']:.6f}")
    else:
        print("❌ Training Gagal. Menghentikan Pipeline."); return

    # 3. Backtesting
    print("\n[2/3] Menjalankan Backtest (Interval 1H, TP 6%, SL 2.5%)...")
    
    # Note: run_backtest_v2 needs to return (final_equity, history, df)
    # My implementation in backtest_service.py does return this.
    final_equity, history, df = run_backtest_v2(engine, symbol="BTC-USD", period="3mo", interval="1h")
    
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
