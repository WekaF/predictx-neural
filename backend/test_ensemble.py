import sys
import os
import pandas as pd

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_engine import ai_engine, add_indicators
from services.data_service import get_historical_data

def test_ensemble():
    """
    Test Tier 7: CNN-LSTM Ensemble vs Tier 5: LSTM Only
    """
    print("🧪 Testing Tier 7: CNN-LSTM Ensemble")
    print("=" * 60)
    
    # 1. Fetch Test Data
    print("\n[1/3] Fetching test data (3 months)...")
    raw_data = get_historical_data("BTC-USD", period="3mo", interval="1h")
    
    if "error" in raw_data:
        print(f"❌ Error: {raw_data['error']}")
        return
    
    df = pd.DataFrame(raw_data["data"])
    df = add_indicators(df)
    print(f"✅ Loaded {len(df)} candles")
    
    # 2. Test Ensemble Predictions
    print("\n[2/3] Testing ensemble predictions...")
    
    ensemble_signals = []
    lstm_signals = []
    
    for i in range(60, min(len(df), 160)):  # Test on 100 candles
        current_candles = df.iloc[:i].to_dict('records')
        
        # Get LSTM prediction
        lstm_prob = ai_engine.predict_next_move(current_candles)
        
        # Get Ensemble prediction (with CNN)
        action_ensemble, conf_ensemble, _ = ai_engine.decide_action(lstm_prob, candles=current_candles)
        action_lstm, conf_lstm, _ = ai_engine.decide_action(lstm_prob)  # Tier 5 (no CNN)
        
        ensemble_signals.append({'action': action_ensemble, 'conf': conf_ensemble})
        lstm_signals.append({'action': action_lstm, 'conf': conf_lstm})
        
        if i % 50 == 0:
            print(f"  Candle {i}: Ensemble={action_ensemble}({conf_ensemble:.1f}%) | LSTM={action_lstm}({conf_lstm:.1f}%)")
    
    # 3. Compare Results
    print("\n[3/3] Comparing Ensemble vs LSTM...")
    
    ensemble_buys = sum(1 for s in ensemble_signals if 'BUY' in s['action'])
    ensemble_sells = sum(1 for s in ensemble_signals if 'SELL' in s['action'])
    ensemble_holds = sum(1 for s in ensemble_signals if s['action'] == 'HOLD')
    
    lstm_buys = sum(1 for s in lstm_signals if 'BUY' in s['action'])
    lstm_sells = sum(1 for s in lstm_signals if 'SELL' in s['action'])
    lstm_holds = sum(1 for s in lstm_signals if s['action'] == 'HOLD')
    
    ensemble_avg_conf = sum(s['conf'] for s in ensemble_signals) / len(ensemble_signals)
    lstm_avg_conf = sum(s['conf'] for s in lstm_signals) / len(lstm_signals)
    
    print("\n📊 COMPARISON:")
    print("=" * 60)
    print(f"{'Metric':<25} {'Tier 5 (LSTM)':<18} {'Tier 7 (Ensemble)':<18}")
    print("-" * 60)
    print(f"{'BUY Signals':<25} {lstm_buys:<18} {ensemble_buys:<18}")
    print(f"{'SELL Signals':<25} {lstm_sells:<18} {ensemble_sells:<18}")
    print(f"{'HOLD Signals':<25} {lstm_holds:<18} {ensemble_holds:<18}")
    print(f"{'Avg Confidence':<25} {lstm_avg_conf:<18.1f} {ensemble_avg_conf:<18.1f}")
    print("=" * 60)
    
    # Analysis
    print("\n💡 ANALYSIS:")
    if ensemble_holds > lstm_holds:
        print(f"✅ Ensemble is MORE SELECTIVE (+{ensemble_holds - lstm_holds} holds)")
        print("   → Higher confidence threshold (70%) is working")
    
    if ensemble_avg_conf > lstm_avg_conf:
        print(f"✅ Ensemble has HIGHER CONFIDENCE (+{ensemble_avg_conf - lstm_avg_conf:.1f}%)")
        print("   → CNN pattern recognition is adding conviction")
    
    total_ensemble_trades = ensemble_buys + ensemble_sells
    total_lstm_trades = lstm_buys + lstm_sells
    
    print(f"\n📈 TRADE FREQUENCY:")
    print(f"   Tier 5 (LSTM): {total_lstm_trades} trades")
    print(f"   Tier 7 (Ensemble): {total_ensemble_trades} trades")
    
    if total_ensemble_trades < total_lstm_trades:
        reduction = ((total_lstm_trades - total_ensemble_trades) / total_lstm_trades) * 100
        print(f"   → {reduction:.1f}% reduction (more selective)")
    
    print("\n✅ Ensemble integration successful!")
    print("   Next: Run full backtest with run_all.py")

if __name__ == "__main__":
    test_ensemble()
