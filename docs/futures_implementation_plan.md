# Implementation Plan: Futures Trading Features

## Goal
Add critical futures-specific features to PredictX for Binance Futures trading, including funding rate analysis, liquidation protection, and market sentiment indicators (Open Interest, Long/Short Ratio).

## User Review Required

> [!IMPORTANT]
> **Breaking Changes**
> - LSTM input size will change from 3 to 9 features (requires model retraining)
> - AI Engine `decide_action()` signature will add `symbol` parameter
> - New dependencies: No new Python packages needed (using existing `aiohttp`, `requests`)

> [!WARNING]
> **API Changes**
> - `/api/predict` endpoint will return additional fields: `funding_rate`, `liquidation_info`, `market_sentiment`
> - Frontend `mlService.ts` will need to handle new liquidation risk checks

## Proposed Changes

### Backend Services

#### [NEW] [funding_rate_service.py](file:///Users/weka/Learning/predictx/backend/services/funding_rate_service.py)

Create new service to fetch and analyze Binance Futures funding rates:
- `get_current_funding_rate(symbol)` - Fetch current funding rate from Binance Futures API
- `get_funding_history(symbol, limit)` - Analyze funding rate trends (7-day average)
- `should_avoid_trade(signal_type, funding_data)` - Filter trades with unfavorable funding
- Integration with Binance Futures API: `https://fapi.binance.com/fapi/v1/fundingRate`

---

#### [NEW] [market_sentiment_service.py](file:///Users/weka/Learning/predictx/backend/services/market_sentiment_service.py)

Create service for market sentiment indicators:
- `get_open_interest(symbol)` - Fetch current open interest
- `get_long_short_ratio(symbol, period)` - Get long/short account ratio (contrarian signal)
- `get_taker_buy_sell_ratio(symbol, period)` - Get aggressive buyer/seller ratio
- Integration with Binance Futures API endpoints:
  - `/fapi/v1/openInterest`
  - `/futures/data/globalLongShortAccountRatio`
  - `/futures/data/takerlongshortRatio`

---

#### [MODIFY] [ai_engine.py](file:///Users/weka/Learning/predictx/backend/ai_engine.py)

**Changes:**
1. Update `add_indicators()` to include futures features:
   - Add `funding_rate`, `oi_change`, `ls_ratio`, `taker_ratio` columns
   - Calculate liquidation cluster estimates

2. Update `decide_action()` signature:
   ```python
   def decide_action(self, trend_prob, state_vector=None, candles=None, symbol="BTCUSDT"):
   ```

3. Add funding rate filter in `decide_action()`:
   - Import `FundingRateAnalyzer`
   - Check funding rate before returning signal
   - Reduce confidence if funding is unfavorable
   - Block trades with extreme funding rates (>5%)

4. Update LSTM input size:
   ```python
   # OLD: self.input_size = 3
   # NEW: self.input_size = 9
   ```

5. Update feature extraction in `train()` and `predict_next_move()`:
   ```python
   # OLD: features = df[['log_return', 'rsi', 'ema_diff']].values
   # NEW: features = df[['log_return', 'rsi', 'ema_diff', 
   #                      'funding_rate', 'oi_change', 'ls_ratio',
   #                      'taker_ratio', 'liq_cluster_above', 'liq_cluster_below']].values
   ```

---

#### [MODIFY] [main.py](file:///Users/weka/Learning/predictx/backend/main.py)

**Changes:**
1. Add new API endpoints after line 107:
   ```python
   @app.get("/api/funding-rate/{symbol}")
   async def get_funding_rate(symbol: str):
       """Get current funding rate and history"""
   
   @app.get("/api/market-sentiment/{symbol}")
   async def get_market_sentiment(symbol: str):
       """Get Open Interest, Long/Short Ratio, Taker Ratio"""
   ```

2. Update `/api/predict` endpoint to include funding and sentiment data in response

---

### Frontend Services

#### [NEW] [liquidationCalculator.ts](file:///Users/weka/Learning/predictx/services/liquidationCalculator.ts)

Create TypeScript service for liquidation risk management:
- `LiquidationCalculator` class with methods:
  - `calculateLiquidationPrice(entryPrice, leverage, side, maintenanceMarginRate)`
  - `calculateSafeLeverage(entryPrice, stopLoss, side, maxRiskPercent)`
  - `validateTrade(entryPrice, stopLoss, leverage, side)` - Returns risk level (SAFE/MODERATE/HIGH/EXTREME)

---

#### [NEW] [fundingRateService.ts](file:///Users/weka/Learning/predictx/services/fundingRateService.ts)

Create TypeScript service to fetch funding rate from backend:
- `getCurrentFundingRate(symbol)` - Fetch from `/api/funding-rate/{symbol}`
- `getFundingHistory(symbol)` - Get historical trends
- Cache funding rate data (update every 8 hours)

---

#### [NEW] [futuresRiskManager.ts](file:///Users/weka/Learning/predictx/services/futuresRiskManager.ts)

Create risk management service:
- `FuturesRiskManager` class with methods:
  - `calculatePositionSize(accountBalance, entryPrice, stopLoss, leverage)` - Safe position sizing
  - `adjustLeverageByVolatility(baseLevel, atr, price)` - Dynamic leverage based on ATR

---

#### [MODIFY] [mlService.ts](file:///Users/weka/Learning/predictx/services/mlService.ts)

**Changes:**
1. Import new services:
   ```typescript
   import { LiquidationCalculator } from './liquidationCalculator';
   import { fundingRateService } from './fundingRateService';
   ```

2. Update `analyzeMarket()` function (after line 770):
   - Add liquidation validation before returning signal
   - Check if stop loss is beyond liquidation price
   - Block trade if risk level is EXTREME
   - Add recommended leverage to signal metadata

3. Add funding rate check:
   - Fetch funding rate for symbol
   - Reduce confidence if funding is unfavorable
   - Add funding warning to signal reasoning

---

### Frontend UI (Optional - for display)

#### [MODIFY] [App.tsx](file:///Users/weka/Learning/predictx/App.tsx)

**Changes:**
- Display funding rate in market info section
- Show liquidation price and risk level in trade signals
- Add warning badge if funding rate is high

---

## Verification Plan

### Automated Tests

**Backend API Tests:**
```bash
# Test funding rate endpoint
curl http://localhost:8000/api/funding-rate/BTCUSDT

# Expected output:
# {
#   "symbol": "BTCUSDT",
#   "current_rate": 0.0001,
#   "annual_rate": 10.95,
#   "trend": "NEUTRAL",
#   "extreme": false
# }

# Test market sentiment endpoint
curl http://localhost:8000/api/market-sentiment/BTCUSDT

# Expected output:
# {
#   "open_interest": 123456.78,
#   "long_short_ratio": 1.23,
#   "taker_ratio": 1.05,
#   "sentiment": "BULLISH"
# }
```

**Frontend Unit Tests:**
```bash
# In /Users/weka/Learning/predictx directory
npm run test

# Test liquidation calculator
# Expected: Liquidation price calculation accuracy within 0.1%
# Expected: Risk level classification (SAFE/MODERATE/HIGH/EXTREME)
```

### Manual Verification

**Step 1: Test Funding Rate Service**
1. Start backend: `cd backend && source venv/bin/activate && uvicorn main:app --reload`
2. Open browser: `http://localhost:8000/api/funding-rate/BTCUSDT`
3. Verify response contains `current_rate`, `trend`, `extreme` fields
4. Check if `trend` is "BULLISH", "BEARISH", or "NEUTRAL"

**Step 2: Test Liquidation Calculator**
1. Start frontend: `npm run dev`
2. Open browser console (F12)
3. Run test:
   ```javascript
   import { LiquidationCalculator } from './services/liquidationCalculator';
   const calc = new LiquidationCalculator();
   
   // Test LONG position with 10x leverage
   const liqPrice = calc.calculateLiquidationPrice(50000, 10, 'LONG');
   console.log('Liquidation Price:', liqPrice); // Should be ~45200
   
   // Test risk validation
   const risk = calc.validateTrade(50000, 48000, 10, 'LONG');
   console.log('Risk Level:', risk.riskLevel); // Should be SAFE or MODERATE
   ```

**Step 3: Test AI Integration**
1. Open PredictX app in browser
2. Select BTC/USDT symbol
3. Wait for AI signal generation
4. Check console logs for:
   - `[Funding Rate]` messages showing funding check
   - `[Liquidation Risk]` messages showing validation
   - Signal should include `liquidationInfo` and `fundingRate` in metadata

**Step 4: Verify LSTM Retraining**
1. After updating input size to 9, retrain model:
   ```bash
   cd backend
   python -c "from ai_engine import ai_engine; ai_engine.train('BTCUSDT', epochs=20)"
   ```
2. Check training logs for convergence
3. Verify model saves to `models/predictx_v2.pth`

---

## Notes

- Funding rate updates every 8 hours on Binance (00:00, 08:00, 16:00 UTC)
- Open Interest data updates in real-time but we'll cache for 5 minutes to avoid rate limits
- Liquidation price formula assumes isolated margin mode
- LSTM retraining required after changing input size (existing model incompatible)
