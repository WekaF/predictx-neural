import os
import time
import logging
import ccxt
import requests
from datetime import datetime
from services.db_service import db_service

class TradingService:
    """
    Execution Service for PredictX
    Handles position sizing, leverage, and trade logging.
    Optimized for USDT capital.
    """
    def __init__(self, initial_balance=10000):
        self.balance_usdt = initial_balance
        self.min_order_usd = 5.0 # Binance minimum notional
        
        # Binance Setup
        self.api_key = os.environ.get("BINANCE_API_KEY") or os.environ.get("VITE_BINANCE_API_KEY")
        self.api_secret = os.environ.get("BINANCE_API_SECRET") or os.environ.get("VITE_BINANCE_SECRET_KEY")
        self.is_live = os.environ.get("LIVE_TRADING", "false").lower() == "true"
        self.exchange = None
        
        if self.api_key and self.api_secret:
            try:
                self.exchange = ccxt.binance({
                    'apiKey': self.api_key,
                    'secret': self.api_secret,
                    'options': {
                        'defaultType': 'future',
                        'recvWindow': 60000,
                    }
                })
                # Sync time with Binance to prevent -1021 timestamp error
                self._sync_time()  
                print(f"✅ TradingService initialized (Live Trading: {self.is_live})")
            except Exception as e:
                print(f"⚠️ Failed to initialize Binance TradingService: {e}")

    def _sync_time(self):
        """Sync nonce with Binance server time to prevent -1021 error."""
        try:
            r = requests.get("https://fapi.binance.com/fapi/v1/time", timeout=5)
            server_time = r.json()['serverTime']
            offset = server_time - int(time.time() * 1000)
            self.exchange.nonce = lambda: int(time.time() * 1000) + offset
            print(f"⏱️ Time synced. Offset: {offset}ms")
        except Exception as e:
            print(f"⚠️ Time sync failed: {e}")
        
    def calculate_execution(self, symbol: str, action: str, confidence: float, current_price: float, meta: dict = None):
        """
        Calculates execution parameters based on AI signal and SMC Context.
        """
        if "HOLD" in action:
            return {"status": "HOLD", "reason": "No high confidence signal"}

        # 1. Determine Leverage based on Confidence
        leverage = 1
        if confidence > 85:
            leverage = 5
        elif confidence > 65:
            leverage = 3
        elif confidence > 45:
            leverage = 2
            
        # 2. Position Sizing (5% per trade)
        margin_usdt = self.balance_usdt * 0.05 
        position_size_usdt = margin_usdt * leverage
        
        # Verify Minimum Notional ($5)
        if position_size_usdt < self.min_order_usd:
            if position_size_usdt * 2 < self.min_order_usd:
                 margin_usdt = self.min_order_usd
                 position_size_usdt = margin_usdt * leverage

        # 3. Determine Entry & TP/SL (SMC vs Standard)
        order_type = "MARKET"
        entry_price = current_price
        tp_price = 0.0
        sl_price = 0.0
        
        # Check for SMC Setup
        smc_setup = None
        if meta and meta.get('smc') and meta['smc'].get('setup'):
            smc_setup = meta['smc']['setup']
            
        if smc_setup:
            # use SMC Entry
            order_type = "LIMIT"
            entry_price = smc_setup['entry']
            sl_price = smc_setup['sl']
            tp_price = smc_setup['tp3'] # Target TP3 for max potential (Manager will trail)
            
            # Check if Limit is too close to Market (Binance might reject), if so convert to Market
            # Simple check: within 0.1%
            if abs(entry_price - current_price) / current_price < 0.001:
                order_type = "MARKET"
                entry_price = current_price
        else:
            # Standard Fallback logic (Fixed %)
            tp_pct = 0.06 
            sl_pct = 0.025
            
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
            "side": "BUY" if "BUY" in action else "SELL",
            "order_type": order_type,
            "leverage": leverage,
            "margin": round(margin_usdt, 2),
            "size": round(position_size_usdt, 2),
            "price": entry_price, # This is Limit Price if LIMIT, or estimated market price
            "tp": round(tp_price, 2),
            "sl": round(sl_price, 2),
            "confidence": confidence,
            "meta": meta,
            "timestamp": datetime.now().isoformat()
        }
        
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
            
            self.exchange.set_leverage(plan["leverage"], symbol)
            
            if not self.exchange.markets:
                self.exchange.load_markets()

            # 2. Open Position
            size_usd = plan["size"]
            entry_price = plan["price"]
            raw_amount = size_usd / entry_price
            amount = self.exchange.amount_to_precision(symbol, raw_amount)
            
            side = plan["side"].lower()
            order_type = plan.get("order_type", "MARKET").lower()
            
            params = {}
            if order_type == "limit":
                params['price'] = self.exchange.price_to_precision(symbol, entry_price)
                params['timeInForce'] = 'GTC'

            # Place Entry Order
            order = self.exchange.create_order(
                symbol=symbol,
                type=order_type,
                side=side,
                amount=amount,
                price=params.get('price'), # None for market
                params=params
            )
            
            # 3. Set TP/SL
            # IMPORTANT: For LIMIT orders, we usually wait for fill to place TP/SL, 
            # BUT Binance Futures allows placing TP/SL immediately if we use STOP/TAKE_PROFIT orders
            # However, if the position is not open, reduceOnly orders might fail or trigger immediately if price matches.
            # Best practice for LIMIT: Use OCO or place TP/SL after fill (via WebSocket/Manager).
            # For this prototype: We attempt to place them as independent stops.
            
            tp_price = float(self.exchange.price_to_precision(symbol, plan["tp"]))
            sl_price = float(self.exchange.price_to_precision(symbol, plan["sl"]))
            
            # Note: For LIMIT entry, SL/TP placement might need to be delayed.
            # We will attempt it, but catch errors. The PositionManager is the safety net.
            sl_tp_status = "PENDING"
            
            is_limit = order_type == 'limit'
            
            if not is_limit:
                 try:
                    self.exchange.create_order(
                        symbol=symbol,
                        type='STOP_MARKET',
                        side='sell' if side == 'buy' else 'buy',
                        amount=amount,
                        params={'stopPrice': sl_price, 'reduceOnly': True}
                    )
                    
                    self.exchange.create_order(
                        symbol=symbol,
                        type='TAKE_PROFIT_MARKET',
                        side='sell' if side == 'buy' else 'buy',
                        amount=amount,
                        params={'stopPrice': tp_price, 'reduceOnly': True}
                    )
                    sl_tp_status = "PLACED"
                 except Exception as e:
                    sl_tp_status = f"FAILED: {e}"
            else:
                sl_tp_status = "SKIPPED (LIMIT ORDER)"

            # LOG TRADE TO DB
            trade_record = {
                "symbol": symbol,
                "side": side.upper(),
                "entry_price": float(entry_price),
                "amount": float(amount),
                "leverage": plan["leverage"],
                "tp_price": tp_price,
                "sl_price": sl_price,
                "status": "OPEN" if not is_limit else "PENDING",
                "order_type": order_type.upper(),
                "order_id": str(order['id']),
                "meta": plan.get("meta", {}),
                "created_at": datetime.now().isoformat()
            }
            self.log_trade(trade_record)

            return f"SUCCESS: {order_type.upper()} Order {order['id']} placed. SL/TP: {sl_tp_status} (Manager will retry)"
            
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
            print(f"✅ Trade logged to DB: {trade_data['symbol']} {trade_data['side']}")
        except Exception as e:
            # Table might not exist yet, ignore error to keep app running
            print(f"⚠️ Failed to log trade to DB: {e}")
            pass

trading_service = TradingService()
