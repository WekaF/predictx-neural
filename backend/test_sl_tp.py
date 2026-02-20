"""
Test script untuk debug Binance Futures SL/TP placement.
Jalankan: venv/bin/python test_sl_tp.py
"""
import os
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local
env_path = Path(__file__).resolve().parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

import ccxt

api_key = os.environ.get("VITE_BINANCE_API_KEY")
api_secret = os.environ.get("VITE_BINANCE_SECRET_KEY")

print(f"API Key: {api_key[:10]}..." if api_key else "❌ No API Key")

# Fetch Binance server time via public endpoint (no auth needed)
try:
    r = requests.get("https://fapi.binance.com/fapi/v1/time", timeout=5)
    binance_time = r.json()['serverTime']
    local_time = int(time.time() * 1000)
    time_offset = binance_time - local_time
    print(f"Binance server time: {binance_time}")
    print(f"Local time:          {local_time}")
    print(f"Offset:              {time_offset}ms")
except Exception as e:
    print(f"❌ Could not fetch Binance time: {e}")
    time_offset = 0

exchange = ccxt.binance({
    'apiKey': api_key,
    'secret': api_secret,
    'options': {
        'defaultType': 'future',
        'recvWindow': 60000,
    }
})

# Override nonce to use corrected timestamp
_offset = time_offset
def corrected_nonce():
    return int(time.time() * 1000) + _offset

exchange.nonce = corrected_nonce
print(f"✅ Nonce override applied with offset: {time_offset}ms")

SYMBOL = "BTC/USDT"

print("\n=== 1. Cek Posisi Aktif ===")
try:
    positions = exchange.fetch_positions([SYMBOL])
    active = [p for p in positions if float(p.get('contracts', 0) or 0) > 0]
    if active:
        for p in active:
            print(f"  Symbol: {p['symbol']}")
            print(f"  Side: {p['side']}")
            print(f"  Contracts: {p['contracts']}")
            print(f"  Entry Price: {p['entryPrice']}")
            print(f"  Mark Price: {p['markPrice']}")
    else:
        print("  Tidak ada posisi aktif")
except Exception as e:
    print(f"  ❌ Error fetch positions: {e}")

print("\n=== 2. Cek Open Orders ===")
try:
    orders = exchange.fetch_open_orders(SYMBOL)
    if orders:
        for o in orders:
            print(f"  ID: {o['id']} | Type: {o['type']} | Side: {o['side']} | Stop: {o.get('stopPrice')}")
    else:
        print("  Tidak ada open orders")
except Exception as e:
    print(f"  ❌ Error fetch orders: {e}")

print("\n=== 3. Test Place SL/TP ===")
try:
    positions = exchange.fetch_positions([SYMBOL])
    active = [p for p in positions if float(p.get('contracts', 0) or 0) > 0]
    
    if not active:
        ticker = exchange.fetch_ticker(SYMBOL)
        current_price = ticker['last']
        print(f"  Tidak ada posisi aktif. Current Price: {current_price}")
        print(f"  ⚠️  Tidak bisa pasang SL/TP tanpa posisi aktif (reduceOnly)")
    else:
        pos = active[0]
        side = pos['side']
        contracts = float(pos['contracts'])
        entry_price = float(pos['entryPrice'])
        
        print(f"  Posisi: {side} {contracts} BTC @ {entry_price}")
        
        sl_price = entry_price * (0.98 if side == 'long' else 1.02)
        tp_price = entry_price * (1.04 if side == 'long' else 0.96)
        
        print(f"  Akan pasang SL @ {sl_price:.2f}, TP @ {tp_price:.2f}")
        
        confirm = input("  Ketik 'yes' untuk eksekusi: ").strip().lower()
        if confirm == 'yes':
            sl_order = exchange.create_order(
                symbol=SYMBOL,
                type='STOP_MARKET',
                side='sell' if side == 'long' else 'buy',
                amount=contracts,
                params={
                    'stopPrice': exchange.price_to_precision(SYMBOL, sl_price),
                    'reduceOnly': True
                }
            )
            print(f"  ✅ SL placed: {sl_order['id']}")
            
            tp_order = exchange.create_order(
                symbol=SYMBOL,
                type='TAKE_PROFIT_MARKET',
                side='sell' if side == 'long' else 'buy',
                amount=contracts,
                params={
                    'stopPrice': exchange.price_to_precision(SYMBOL, tp_price),
                    'reduceOnly': True
                }
            )
            print(f"  ✅ TP placed: {tp_order['id']}")
        else:
            print("  Dibatalkan.")
            
except Exception as e:
    print(f"  ❌ Error: {e}")
