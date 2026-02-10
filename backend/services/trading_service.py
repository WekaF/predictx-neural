import os
import logging
import ccxt
from datetime import datetime
from services.db_service import db_service

class TradingService:
    """
    Execution Service for PredictX
    Handles position sizing, leverage, and trade logging.
    Optimized for Rp 250,000 capital.
    """
    def __init__(self, initial_balance=250000):
        self.balance_idr = initial_balance
        self.min_order_usd = 5.0 # Binance minimum notional
        self.usd_to_idr = 15500 # Approx exchange rate
        
        # Binance Setup
        self.api_key = os.environ.get("BINANCE_API_KEY")
        self.api_secret = os.environ.get("BINANCE_API_SECRET")
        self.is_live = os.environ.get("LIVE_TRADING", "false").lower() == "true"
        self.exchange = None
        
        if self.api_key and self.api_secret:
            try:
                self.exchange = ccxt.binance({
                    'apiKey': self.api_key,
                    'secret': self.api_secret,
                    'options': {'defaultType': 'future'} # Use Futures for leverage
                })
                print(f"✅ Connected to Binance (Live Trading: {self.is_live})")
            except Exception as e:
                print(f"⚠️ Failed to connect to Binance: {e}")
        
    def calculate_execution(self, symbol: str, action: str, confidence: float, current_price: float):
        """
        Calculates execution parameters based on AI signal.
        """
        if "HOLD" in action:
            return {"status": "HOLD", "reason": "No high confidence signal"}

        # 1. Determine Leverage based on Confidence
        # Higher confidence = Higher leverage (up to 5x)
        leverage = 1
        if confidence > 85:
            leverage = 5
        elif confidence > 65:
            leverage = 3
        elif confidence > 45:
            leverage = 2
            
        # 2. Position Sizing
        # Use 20% of balance (Rp 50,000) per trade
        margin_idr = self.balance_idr * 0.2
        position_size_idr = margin_idr * leverage
        
        # Verify Minimum Notional ($5)
        # Rp 50,000 * 3x = Rp 150,000 (~$9.6) -> OK
        # Rp 50,000 * 1x = Rp 50,000 (~$3.2) -> TOO SMALL
        if position_size_idr < (self.min_order_usd * self.usd_to_idr):
            # Boost leverage to meet minimum if possible
            needed_leverage = (self.min_order_usd * self.usd_to_idr) / margin_idr
            if needed_leverage <= 5:
                leverage = round(needed_leverage + 0.5)
                position_size_idr = margin_idr * leverage
            else:
                return {"status": "ERROR", "reason": "Balance too small for minimum Binance order"}

        # 3. Calculate TP / SL (Standard Tier 5/7 settings)
        tp_pct = 0.06 # +6%
        sl_pct = 0.025 # -2.5%
        
        is_buy = "BUY" in action
        if is_buy:
            tp_price = current_price * (1 + tp_pct)
            sl_price = current_price * (1 - sl_pct)
        else:
            tp_price = current_price * (1 - tp_pct)
            sl_price = current_price * (1 + sl_pct)

        execution_plan = {
            "status": "EXECUTE",
            "symbol": symbol,
            "side": "BUY" if is_buy else "SELL",
            "leverage": leverage,
            "margin_idr": round(margin_idr, 0),
            "size_idr": round(position_size_idr, 0),
            "price": current_price,
            "tp": round(tp_price, 2),
            "sl": round(sl_price, 2),
            "confidence": confidence,
            "timestamp": datetime.now().isoformat()
        }
        
        # Log to Supabase (if table exists)
        self.log_trade(execution_plan)
        
        # 4. IF LIVE: Execute Position
        if self.is_live and self.exchange:
            execution_plan["execution_status"] = self.execute_position(execution_plan)
        else:
            execution_plan["execution_status"] = "SIMULATED (LIVE_TRADING=false)"
            
        return execution_plan

    def execute_position(self, plan: dict):
        """
        Executes a real position on Binance Futures.
        """
        try:
            symbol = plan["symbol"].replace("-", "").replace("/", "") # Normalize to BTCUSDT
            if "USD" in symbol: symbol = symbol.replace("USD", "USDT")
            
            # 1. Set Leverage
            self.exchange.set_leverage(plan["leverage"], symbol)
            
            # 2. Open Position (Market Order)
            # Size in Base Asset (e.g. BTC)
            size_usd = plan["size_idr"] / self.usd_to_idr
            amount = size_usd / plan["price"]
            
            order = self.exchange.create_order(
                symbol=symbol,
                type='market',
                side=plan["side"].lower(),
                amount=amount
            )
            
            # 3. Set TP/SL
            # Binance Futures often requires separate stop orders
            self.exchange.create_order(
                symbol=symbol,
                type='STOP_MARKET',
                side='sell' if plan["side"] == 'BUY' else 'buy',
                amount=amount,
                params={'stopPrice': plan["sl"], 'reduceOnly': True}
            )
            
            self.exchange.create_order(
                symbol=symbol,
                type='TAKE_PROFIT_MARKET',
                side='sell' if plan["side"] == 'BUY' else 'buy',
                amount=amount,
                params={'stopPrice': plan["tp"], 'reduceOnly': True}
            )
            
            return f"SUCCESS: Order {order['id']} placed with TP/SL"
            
        except Exception as e:
            return f"FAILED: {str(e)}"

    def log_trade(self, trade_data: dict):
        """
        Attempts to log trade to Supabase 'trades' table.
        """
        if not db_service.client:
            return
            
        try:
            # We assume a 'trades' table exists or will be created
            # This is a passive attempt
            db_service.client.table("trades").insert(trade_data).execute()
        except Exception:
            # Table might not exist yet, ignore error to keep app running
            pass

trading_service = TradingService()
