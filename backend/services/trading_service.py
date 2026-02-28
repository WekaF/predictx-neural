import os
import logging
import ccxt
from datetime import datetime

from services.db_service import db_service
from utils.smc_utils import StrategyConfig

class TradingService:
    """
    Execution Service for PredictX
    Handles position sizing, leverage, and trade logging.
    Optimized for USDT capital with Unified StrategyConfig.
    """
    def __init__(self, initial_balance=10000):
        self.balance_usdt = initial_balance
        self.min_order_usd = 101.0 # Binance minimum notional (safe buffer)
        
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
                    'options': {'defaultType': 'future'} 
                })
                self.exchange.load_markets()
                print(f"✅ Connected to Binance (Live Trading: {self.is_live})")
                if self.is_live:
                    self.balance_usdt = self.fetch_balance()
            except Exception as e:
                print(f"⚠️ Failed to connect to Binance: {e}")
        
    def fetch_balance(self):
        """
        Fetches the current USDT Futures balance from Binance.
        """
        if not self.exchange: return self.balance_usdt
        try:
            balance = self.exchange.fetch_balance()
            usdt_balance = balance.get('total', {}).get('USDT', self.balance_usdt)
            print(f"💰 Fetched Binance Balance: {usdt_balance} USDT")
            return float(usdt_balance)
        except Exception as e:
            logging.error(f"Failed to fetch balance: {e}")
            return self.balance_usdt
        
    def calculate_execution(self, symbol: str, action: str, confidence: float, current_price: float):
        """
        Calculates execution parameters based on AI signal and Unified StrategyConfig.
        """
        if "HOLD" in action or confidence < StrategyConfig.MIN_CONFIDENCE:
            return {"status": "HOLD", "reason": f"Signal quality below threshold ({confidence} < {StrategyConfig.MIN_CONFIDENCE})"}

        # 1. Standardized Leverage
        leverage = StrategyConfig.BASE_LEVERAGE
        
        # 2. Position Sizing with Absolute Drawdown Risk
        # 0.8% Price SL * 10x Leverage = 8% ROE loss.
        # To lose 2% of total account on an 8% ROE loss:
        # Position Size = (Account * 0.02) / (SL_PCT * Leverage)
        
        # Refresh balance if live
        if self.is_live:
            self.balance_usdt = self.fetch_balance()

        # 2. Position Sizing
        risk_per_trade = self.balance_usdt * StrategyConfig.MAX_DRAWDOWN_PER_TRADE
        total_position_size = risk_per_trade / (StrategyConfig.DEFAULT_SL_PCT * leverage)
        
        # Ensure minimum notional requirement is met
        if total_position_size < self.min_order_usd:
             total_position_size = self.min_order_usd
             
        margin_usdt = total_position_size / leverage
        
        # Clamp to balance: Use up to 98% of account if needed to meet min notional
        # We allow a very high percentage only if it's the absolute minimum needed to trade
        # First calculate theoretical size to check if we need the high margin clamp
        theoretical_size = margin_usdt * leverage
        max_margin = self.balance_usdt * 0.98 if theoretical_size >= self.min_order_usd else self.balance_usdt * 0.5
        
        margin_usdt = min(margin_usdt, max_margin)
        position_size_usdt = margin_usdt * leverage

        # Final check: If still below min notional after clamping, we can't trade
        if position_size_usdt < self.min_order_usd:
             return {"status": "HOLD", "reason": f"Account balance ({self.balance_usdt:.2f} USDT) too low for min notional ({self.min_order_usd} USDT) at {leverage}x leverage (Required Margin: {self.min_order_usd/leverage:.2f})."}

        # 3. Calculate TP / SL (Strict StrategyConfig)
        sl_pct = StrategyConfig.DEFAULT_SL_PCT
        tp_pct = StrategyConfig.DEFAULT_TP_PCT
        
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
            "margin": round(margin_usdt, 2),
            "size": round(position_size_usdt, 2),
            "price": current_price,
            "tp": round(tp_price, 2),
            "sl": round(sl_price, 2),
            "confidence": confidence,
            "timestamp": datetime.now().isoformat()
        }
        
        self.log_trade(execution_plan)
        
        if self.is_live and self.exchange:
            execution_plan["execution_status"] = self.execute_position(execution_plan)
        else:
            execution_plan["execution_status"] = "SIMULATED (LIVE_TRADING=false)"
            
        return execution_plan

    def execute_position(self, plan: dict):
        try:
            # 1. Normalisasi Symbol (Binance menggunakan format BTCUSDT)
            symbol = plan["symbol"].replace("-", "").replace("/", "")
            if "USD" in symbol and "USDT" not in symbol:
                symbol = symbol.replace("USD", "USDT")
            
            # 2. Setup Leverage & Mode
            # Sebaiknya set margin mode (ISOLATED/CROSSED) di sini jika diperlukan
            self.exchange.set_leverage(plan["leverage"], symbol)
            
            # 3. Presisi Jumlah (Amount)
            # Tambahkan buffer 1.05 untuk memastikan melewati batas min notional setelah fee
            raw_amount = plan["size"] / plan["price"]
            amount = float(self.exchange.amount_to_precision(symbol, raw_amount))
            
            if (amount * plan["price"]) < self.min_order_usd:
                amount = float(self.exchange.amount_to_precision(symbol, (self.min_order_usd / plan["price"]) * 1.05))
    
            # 4. Eksekusi Entry (Market Order)
            logging.info(f"🚀 Sending Market {plan['side']} order for {symbol}...")
            order = self.exchange.create_market_order(
                symbol=symbol,
                side=plan["side"].lower(),
                amount=amount
            )
            
            # 5. Verifikasi Harga Fill
            # Market order terkadang slippage, kita ambil harga asli dari exchange
            fill_price = order.get('average') or order.get('price') or plan["price"]
            logging.info(f"✅ Filled at: {fill_price}")
    
            # 6. Kalkulasi Harga SL/TP berdasarkan Fill Price
            is_buy = plan["side"].upper() == 'BUY'
            tp_side = 'sell' if is_buy else 'buy'
            
            # Hitung harga (Gunakan StrategyConfig jika tersedia, atau plan sebagai fallback)
            tp_price = fill_price * (1 + StrategyConfig.DEFAULT_TP_PCT) if is_buy else fill_price * (1 - StrategyConfig.DEFAULT_TP_PCT)
            sl_price = fill_price * (1 - StrategyConfig.DEFAULT_SL_PCT) if is_buy else fill_price * (1 + StrategyConfig.DEFAULT_SL_PCT)
    
            # 7. Kirim Protective Orders (SL & TP)
            # Note: 'closePosition': True memerlukan amount=None di API Binance via CCXT
            
            if StrategyConfig.AUTO_SL_TP:
                protection_orders = [
                    {
                        'type': 'TAKE_PROFIT_MARKET',
                        'price': self.exchange.price_to_precision(symbol, tp_price),
                        'label': 'TP'
                    },
                    {
                        'type': 'STOP_MARKET',
                        'price': self.exchange.price_to_precision(symbol, sl_price),
                        'label': 'SL'
                    }
                ]
        
                for p_order in protection_orders:
                    try:
                        # Binance now requires /fapi/v1/algoOrder for conditional orders (SL/TP)
                        self.exchange.fapiPrivatePostAlgoOrder({
                            'symbol': symbol,
                            'side': tp_side.upper(),
                            'algoType': 'CONDITIONAL',
                            'type': p_order['type'],
                            'triggerPrice': p_order['price'],
                            'workingType': 'MARK_PRICE',
                            'closePosition': 'true',
                            'timeInForce': 'GTC'
                        })
                        logging.info(f"🎯 {p_order['label']} set at {p_order['price']} via Algo API")
                    except Exception as e:
                        logging.error(f"⚠️ Failed to set {p_order['label']}: {e}")
                        # Opsional: Jika SL gagal, mungkin kamu ingin tutup posisi entry segera?
            else:
                logging.info(f"⏩ Auto SL/TP is disabled in StrategyConfig. Skipping Algo API.")
    
            return f"SUCCESS: Order {order['id']} filled at {fill_price}"
    
        except Exception as e:
            # Menangani error fatal (API Key salah, saldo tidak cukup, limit leverage)
            error_msg = str(e)
            logging.error(f"❌ FATAL EXECUTION ERROR: {error_msg}")
            return f"FAILED: {error_msg}"

    def log_trade(self, trade_data: dict):
        if not db_service.client: return
        try:
            db_service.client.table("trades").insert(trade_data).execute()
        except Exception: pass

trading_service = TradingService()

