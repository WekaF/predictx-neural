#!/usr/bin/env python3
"""
Run backtest with the newly trained Trinity AI models
"""

import sys
import os

# Ensure we're in the backend directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from ai_engine import ai_engine
from services.backtest_service import run_backtest_v2

print("=" * 60)
print("Trinity AI - Backtest with New Models")
print("=" * 60)
print()

# You can customize these parameters
SYMBOL = "BTC-USD"
PERIOD = "3mo"  # Options: 1mo, 3mo, 6mo, 1y, 2y
INTERVAL = "1h"  # Options: 15m, 1h, 4h, 1d

print(f"Symbol: {SYMBOL}")
print(f"Period: {PERIOD}")
print(f"Interval: {INTERVAL}")
print()
print("Running backtest...")
print()

try:
    final_equity, trades, df = run_backtest_v2(
        ai_engine, 
        symbol=SYMBOL, 
        period=PERIOD, 
        interval=INTERVAL
    )
    
    print()
    print("=" * 60)
    print("✅ BACKTEST COMPLETE!")
    print("=" * 60)
    print()
    print(f"Final Equity: ${final_equity:,.2f}")
    print(f"Total Trades: {len(trades)}")
    print()
    
    # Save trade log
    import csv
    import time
    
    log_file = f"logs/backtest_trinity_{int(time.time())}.csv"
    os.makedirs("logs", exist_ok=True)
    
    keys = ["time", "type", "price", "confidence", "balance", "reason"]
    with open(log_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for t in trades:
            row = {k: t.get(k, '') for k in keys}
            writer.writerow(row)
    
    print(f"📝 Trade log saved to: {log_file}")
    print()
    
except Exception as e:
    print(f"❌ Backtest Failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
