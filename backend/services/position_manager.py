import os
import time
import ccxt.async_support as ccxt
import logging
import aiohttp
import pandas as pd
from datetime import datetime, timedelta
import asyncio
from services.db_service import db_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PositionManager")

class PositionManager:
    """
    Background service to manage active positions and open orders.
    Rules:
    - Auto Set SL/TP after Limit Order fills (from DB)
    - Auto Move SL to Break Even at +2% profit
    - Auto Move SL to Lock Profit (+2%) at +4% profit
    - Auto Cancel & Replace SL (Trailing)
    - Stale Limit Order Cancellation
    """
    def __init__(self):
        self.api_key = os.environ.get("BINANCE_API_KEY") or os.environ.get("VITE_BINANCE_API_KEY")
        self.api_secret = os.environ.get("BINANCE_API_SECRET") or os.environ.get("VITE_BINANCE_SECRET_KEY")
        self.is_live = os.environ.get("LIVE_TRADING", "false").lower() == "true"
        self.exchange = None
        self._time_offset = 0  # ms offset between local and Binance server time
        
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
                logger.info("PositionManager connected to Binance")
            except Exception as e:
                logger.error(f"PositionManager failed to connect: {e}")

    async def _sync_time(self):
        """
        Sync local clock with Binance Futures server time.
        Applies offset to ccxt nonce so all signed requests use correct timestamp.
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get("https://fapi.binance.com/fapi/v1/time", timeout=5) as r:
                    data = await r.json()
                    server_time = data['serverTime']
                    local_time = int(time.time() * 1000)
                    self._time_offset = server_time - local_time
                    # Apply to ccxt: override nonce function
                    offset = self._time_offset
                    self.exchange.nonce = lambda: int(time.time() * 1000) + offset
                    logger.info(f"⏱️ Time synced. Offset: {self._time_offset}ms")
        except Exception as e:
            logger.warning(f"Failed to sync time: {e}")

    async def run_loop(self, interval_seconds=30):
        """
        Main loop to check positions periodically.
        """
        if not self.exchange or not self.is_live:
            logger.info("PositionManager loop skipped (Not Live or No Exchange)")
            return

        logger.info("🚀 Starting PositionManager Loop...")
        
        # Sync time once at startup
        await self._sync_time()
        
        loop_count = 0
        while True:
            try:
                # Re-sync time every 10 loops (~5 min) to prevent drift
                if loop_count % 10 == 0:
                    await self._sync_time()
                
                await self.check_positions()
                await self.check_open_orders()
                loop_count += 1
            except Exception as e:
                logger.error(f"Error in PositionManager loop: {e}")
            
            await asyncio.sleep(interval_seconds)

    async def check_positions(self):
        """
        Fetch active positions and apply SL/TP & trailing logic.
        """
        if not self.is_live or not self.exchange:
            return

        try:
            positions = await self.exchange.fetch_positions()
            active_positions = [
                p for p in positions 
                if abs(float(p.get('contracts', 0) or 0)) > 0
            ]
            
            for pos in active_positions:
                symbol = pos['symbol']
                entry_price = float(pos['entryPrice'])
                current_price = float(pos['markPrice'])
                side = pos['side']  # 'long' or 'short'
                pnl_pct = float(pos.get('percentage', 0)) / 100.0
                contracts = abs(float(pos['contracts']))
                
                # Fetch open orders for this symbol
                open_orders = await self.exchange.fetch_open_orders(symbol)
                sl_orders = [o for o in open_orders if o['type'] == 'STOP_MARKET']
                tp_orders = [o for o in open_orders if o['type'] == 'TAKE_PROFIT_MARKET']
                
                # RULE 1: If no SL/TP at all → Attach from DB
                if not sl_orders and not tp_orders:
                    logger.info(f"⚠️ No SL/TP for {symbol}. Attaching from DB...")
                    await self.attach_initial_sl_tp(symbol, side, entry_price, contracts)
                
                # RULE 2 & 3: Trailing SL logic (only if SL exists)
                elif sl_orders:
                    await self.apply_trailing_rules(
                        symbol, side, entry_price, current_price, pnl_pct, contracts, sl_orders[0]
                    )
                    
        except Exception as e:
            logger.error(f"Error checking positions: {e}")

    async def attach_initial_sl_tp(self, symbol, side, entry_price, contracts):
        """
        Attach SL/TP from DB (AI-calculated values) or use safety fallback.
        Uses closePosition=True so Binance closes the ENTIRE position.
        """
        try:
            tp_price = 0.0
            sl_price = 0.0
            
            # Try to get AI-calculated SL/TP from DB
            if db_service.client:
                try:
                    response = db_service.client.table("trades")\
                        .select("*")\
                        .eq("symbol", symbol)\
                        .in_("status", ["OPEN", "PENDING", "FILLED"])\
                        .order("created_at", desc=True)\
                        .limit(1)\
                        .execute()
                    
                    if response.data:
                        trade = response.data[0]
                        tp_price = float(trade.get('tp_price', 0) or 0)
                        sl_price = float(trade.get('sl_price', 0) or 0)
                        logger.info(f"✅ Recovered SL/TP from DB: SL={sl_price}, TP={tp_price}")
                        
                        # Mark as FILLED
                        db_service.client.table("trades")\
                            .update({"status": "FILLED"})\
                            .eq("id", trade['id'])\
                            .execute()
                except Exception as e:
                    logger.warning(f"DB lookup failed: {e}")
            
            # Safety fallback if DB has no values
            if sl_price == 0 or tp_price == 0:
                logger.warning(f"Using safety fallback SL/TP for {symbol}")
                if side == 'long':
                    sl_price = entry_price * 0.98   # 2% SL
                    tp_price = entry_price * 1.06   # 6% TP
                else:
                    sl_price = entry_price * 1.02
                    tp_price = entry_price * 0.94
            
            close_side = 'sell' if side == 'long' else 'buy'
            
            # Place SL (STOP_MARKET with closePosition=True)
            await self.exchange.create_order(
                symbol=symbol,
                type='STOP_MARKET',
                side=close_side,
                amount=contracts,
                params={
                    'stopPrice': float(self.exchange.price_to_precision(symbol, sl_price)),
                    'closePosition': True,  # Close entire position
                }
            )
            logger.info(f"✅ SL placed @ {sl_price:.2f} for {symbol}")
            
            # Place TP (TAKE_PROFIT_MARKET with closePosition=True)
            await self.exchange.create_order(
                symbol=symbol,
                type='TAKE_PROFIT_MARKET',
                side=close_side,
                amount=contracts,
                params={
                    'stopPrice': float(self.exchange.price_to_precision(symbol, tp_price)),
                    'closePosition': True,  # Close entire position
                }
            )
            logger.info(f"✅ TP placed @ {tp_price:.2f} for {symbol}")
            
        except Exception as e:
            logger.error(f"Failed to attach SL/TP for {symbol}: {e}")

    async def apply_trailing_rules(self, symbol, side, entry_price, current_price, pnl_pct, contracts, sl_order):
        """
        Apply trailing SL rules:
        - +2% profit → Move SL to Break Even (entry)
        - +4% profit → Move SL to Entry + 2% (lock profit)
        - +6%+ profit → Dynamic trailing (keep 2% distance from current price)
        """
        try:
            current_sl_price = float(sl_order.get('stopPrice', 0) or 0)
            if current_sl_price == 0:
                return
            
            new_sl_price = None
            reason = ""
            
            if side == 'long':
                be_price = entry_price * 1.001      # Break Even (entry + tiny buffer)
                lock_price = entry_price * 1.02     # Lock +2%
                
                # RULE: +2% → Break Even
                if pnl_pct >= 0.02 and current_sl_price < be_price:
                    new_sl_price = be_price
                    reason = "Break Even (+2%)"
                
                # RULE: +4% → Lock +2%
                elif pnl_pct >= 0.04 and current_sl_price < lock_price:
                    new_sl_price = lock_price
                    reason = "Lock Profit (+4% → SL to +2%)"
                
                # RULE: +6%+ → Dynamic Trail (2% below current)
                elif pnl_pct >= 0.06:
                    trail_price = current_price * 0.98
                    if trail_price > current_sl_price:
                        new_sl_price = trail_price
                        reason = f"Trailing SL (2% below {current_price:.2f})"
                        
            elif side == 'short':
                be_price = entry_price * 0.999
                lock_price = entry_price * 0.98
                
                # RULE: +2% → Break Even
                if pnl_pct >= 0.02 and current_sl_price > be_price:
                    new_sl_price = be_price
                    reason = "Break Even (+2%)"
                
                # RULE: +4% → Lock +2%
                elif pnl_pct >= 0.04 and current_sl_price > lock_price:
                    new_sl_price = lock_price
                    reason = "Lock Profit (+4% → SL to +2%)"
                
                # RULE: +6%+ → Dynamic Trail (2% above current)
                elif pnl_pct >= 0.06:
                    trail_price = current_price * 1.02
                    if trail_price < current_sl_price:
                        new_sl_price = trail_price
                        reason = f"Trailing SL (2% above {current_price:.2f})"
            
            if new_sl_price:
                logger.info(f"🔄 Updating SL for {symbol}: {reason}")
                await self._replace_sl(symbol, side, contracts, sl_order['id'], new_sl_price)
                    
        except Exception as e:
            logger.error(f"Error applying trailing rules for {symbol}: {e}")

    async def _replace_sl(self, symbol, side, contracts, old_order_id, new_sl_price):
        """
        Cancel old SL and place new one. (Auto Cancel & Replace)
        """
        try:
            # 1. Cancel old SL
            await self.exchange.cancel_order(old_order_id, symbol)
            logger.info(f"🗑️ Cancelled old SL order {old_order_id}")
            
            # 2. Place new SL
            sl_price_precision = float(self.exchange.price_to_precision(symbol, new_sl_price))
            close_side = 'sell' if side == 'long' else 'buy'
            
            await self.exchange.create_order(
                symbol=symbol,
                type='STOP_MARKET',
                side=close_side,
                amount=contracts,
                params={
                    'stopPrice': sl_price_precision,
                    'closePosition': True,
                }
            )
            logger.info(f"✅ New SL placed @ {sl_price_precision} for {symbol}")
            
        except Exception as e:
            logger.error(f"Failed to replace SL for {symbol}: {e}")

    async def check_open_orders(self):
        """
        Cancel stale LIMIT orders that haven't been filled after 4 hours.
        """
        if not self.is_live or not self.exchange:
            return
        
        try:
            target_symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT"]
            
            for symbol in target_symbols:
                try:
                    orders = await self.exchange.fetch_open_orders(symbol)
                    limit_orders = [o for o in orders if o['type'] == 'LIMIT']
                    
                    for order in limit_orders:
                        order_time = datetime.fromtimestamp(order['timestamp'] / 1000)
                        
                        if datetime.now() - order_time > timedelta(hours=4):
                            logger.info(f"🗑️ Cancelling stale LIMIT order {order['id']} for {symbol}")
                            await self.exchange.cancel_order(order['id'], symbol)
                            
                            # Update DB
                            if db_service.client:
                                try:
                                    db_service.client.table("trades")\
                                        .update({"status": "CANCELLED"})\
                                        .eq("order_id", str(order['id']))\
                                        .execute()
                                except:
                                    pass
                except Exception as e:
                    pass  # Symbol might not have orders
                    
        except Exception as e:
            logger.error(f"Error checking open orders: {e}")

position_manager = PositionManager()
