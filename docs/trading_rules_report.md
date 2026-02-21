# 📊 PredictX — Aturan Entry, Stop Loss & Take Profit

> Updated: 21 Februari 2026

---

## 🤖 1. AI Engine (`trading_service.py`)

SL/TP **dinamis berdasarkan leverage** (formula: `target_roe / leverage`):

| Leverage | SL (Price) | TP (Price) | SL (ROE) | TP (ROE) | R:R |
|----------|-----------|-----------|----------|---------|-----|
| 1x | 8% | 15% | 8% | 15% | 1:1.875 |
| 3x | 2.67% | 5% | 8% | 15% | 1:1.875 |
| 5x | 1.6% | 3% | 8% | 15% | 1:1.875 |
| **10x** | **0.8%** | **1.5%** | **8%** | **15%** | **1:1.875** |

### Position Sizing
- **5% dari balance** per trade, max account risk **2%**

---

## 🔧 2. Simple Bot — Order Block (`tradingBot.ts`)

SL/TP dari struktur candle (dinamis):

| Kondisi | Entry | SL | TP |
|---------|-------|----|-----|
| Bullish OB | High candle merah | Low candle merah | Fib 1.618 |
| Bearish OB | Low candle hijau | High candle hijau | Fib 1.618 |

---

## 🧠 3. AI Signal (`mlService.ts`)

ATR-based SL, **max cap 1%** dari harga entry:

| Kondisi | SL | TP |
|---------|----|----|
| ATR normal (< 1%) | ATR × multiplier | ATR × multiplier |
| ATR > 1% | **Capped 1%** | Recalculated (R:R 1.5) |

---

## 🛡️ 4. Trailing Stop (`binanceTradingService.ts`)

| ROE | Aksi |
|-----|------|
| **≥ 1.5%** | SL → **Break Even** |
| **≥ 3.0%** | SL → **+0.3% profit** (lock) |

---

## 📋 Trading Rules Status

| # | Rule | Status |
|---|------|--------|
| 1 | OB Detection (Bullish/Bearish) | ✅ Aktif |
| 2 | Auto Set Leverage | ✅ Aktif |
| 3 | Auto Open Limit Order (OB) | ✅ Aktif |
| 4 | Auto Set SL & TP (batch atomic) | ✅ Aktif |
| 5 | Auto Move SL → Break Even (+1.5% ROE) | ✅ Aktif |
| 6 | Auto Move SL → Lock Profit (+3% ROE) | ✅ Aktif |
| 7 | Fibonacci TP Dynamic (1.618 extension) | ✅ Aktif |
| 8 | Auto Cancel & Replace SL (trailing) | ✅ Aktif |
