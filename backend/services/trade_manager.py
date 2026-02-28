import asyncio
import logging
import time
from datetime import datetime
from services.trading_service import trading_service
from utils.smc_utils import StrategyConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TradeManager")

class TradeManager:
    """
    Background Service that monitors active trades and applies Trailing Stop logic.
    Designed for 24/7 standalone operation.
    """
    def __init__(self, interval_seconds=15):
        self.interval = interval_seconds
        self.is_running = False
        self._task = None

    async def start(self):
        """Starts the monitoring loop"""
        if self.is_running:
            return
        
        self.is_running = True
        logger.info("🚀 Trade Manager Service Started (Interval: %ds)", self.interval)
        self._task = asyncio.create_task(self._monitor_loop())

    async def stop(self):
        """Stops the monitoring loop"""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 Trade Manager Service Stopped")

    async def _monitor_loop(self):
        while self.is_running:
            try:
                await self.manage_active_trades()
            except Exception as e:
                logger.error("❌ Error in Trade Manager loop: %s", e, exc_info=True)
            
            await asyncio.sleep(self.interval)

    async def manage_active_trades(self):
        """
        Fetches active positions and orders from Binance and applies Trailing Stop logic.
        """
        if not trading_service.exchange:
            return

        # 1. Fetch Positions
        try:
            # Note: CCXT fetch_positions() usually returns all symbols if no symbol is provided
            # For efficiency in 24/7 mode, we'll focus on symbols with active balance
            # or just fetch all and filter for non-zero amounts.
            positions = trading_service.exchange.fetch_positions()
            active_positions = [p for p in positions if float(p.get('contracts', 0)) != 0]
        except Exception as e:
            logger.error("Failed to fetch positions: %s", e)
            return

        for pos in active_positions:
            symbol = pos['symbol']
            side = 'BUY' if float(pos['contracts']) > 0 else 'SELL'
            entry_price = float(pos['entryPrice'])
            mark_price = float(pos['markPrice'])
            amount = abs(float(pos['contracts']))

            # Calculate Price Move (ROE-free)
            if side == 'BUY':
                price_move = (mark_price - entry_price) / entry_price
            else:
                price_move = (entry_price - mark_price) / entry_price

            logger.debug("Checking %s (%s) | Price Move: %.4f%%", symbol, side, price_move * 100)

            # Determine New SL/TP targets based on StrategyConfig
            target_new_sl = 0
            target_new_tp = 0
            tier = ""

            config = StrategyConfig.TRAILING_CONFIG
            
            # Level 3 (+1.0%)
            if price_move >= config["LEVEL_3"]["trigger"]:
                target_new_sl = entry_price * (1 + config["LEVEL_3"]["sl_move"]) if side == 'BUY' else entry_price * (1 - config["LEVEL_3"]["sl_move"])
                target_new_tp = entry_price * (1 + config["LEVEL_3"]["tp_move"]) if side == 'BUY' else entry_price * (1 - config["LEVEL_3"]["tp_move"])
                tier = "LEVEL 3 (+1.0%)"
            # Level 2 (+0.5%)
            elif price_move >= config["LEVEL_2"]["trigger"]:
                target_new_sl = entry_price * (1 + config["LEVEL_2"]["sl_move"]) if side == 'BUY' else entry_price * (1 - config["LEVEL_2"]["sl_move"])
                target_new_tp = entry_price * (1 + config["LEVEL_2"]["tp_move"]) if side == 'BUY' else entry_price * (1 - config["LEVEL_2"]["tp_move"])
                tier = "LEVEL 2 (+0.5%)"
            # Level 1 (+0.2%) -> Break Even
            elif price_move >= config["LEVEL_1"]["trigger"]:
                target_new_sl = entry_price
                tier = "LEVEL 1 (+0.2%)"

            if target_new_sl > 0:
                await self._apply_trailing_update(symbol, side, amount, target_new_sl, target_new_tp, tier)

    async def _apply_trailing_update(self, symbol, side, amount, target_sl, target_tp, tier):
        """
        Compares target SL/TP with existing orders and updates if better.
        """
        try:
            loop = asyncio.get_event_loop()
            open_orders = await loop.run_in_executor(None, lambda: trading_service.exchange.fetch_open_orders(symbol))
            
            # Find existing SL/TP orders
            sl_order = next((o for o in open_orders if o['type'] in ['stop_market', 'STOP_MARKET']), None)
            tp_order = next((o for o in open_orders if o['type'] in ['take_profit_market', 'TAKE_PROFIT_MARKET']), None)

            # Close side is opposite of entry side
            close_side = 'SELL' if side == 'BUY' else 'BUY'

            # 1. Update SL
            if target_sl > 0:
                rounded_sl = float(trading_service.exchange.price_to_precision(symbol, target_sl))
                if sl_order:
                    current_sl = float(sl_order['stopPrice'])
                    is_better = rounded_sl > current_sl if side == 'BUY' else rounded_sl < current_sl
                    is_significant = abs(current_sl - rounded_sl) > (rounded_sl * 0.0001)

                    if is_better and is_significant:
                        logger.info("🛡️ %s Reached for %s. Moving SL from %s to %s", tier, symbol, current_sl, rounded_sl)
                        if sl_order['id']:
                            await loop.run_in_executor(None, lambda: trading_service.exchange.cancel_order(sl_order['id'], symbol))
                        await loop.run_in_executor(None, lambda: trading_service.place_algo_order(symbol, close_side, 'STOP_MARKET', rounded_sl))
                else:
                    logger.info("🛡️ %s Reached for %s. Creating New SL at %s", tier, symbol, rounded_sl)
                    await loop.run_in_executor(None, lambda: trading_service.place_algo_order(symbol, close_side, 'STOP_MARKET', rounded_sl))

            # 2. Update TP
            if target_tp and target_tp > 0:
                rounded_tp = float(trading_service.exchange.price_to_precision(symbol, target_tp))
                if tp_order:
                    current_tp = float(tp_order['stopPrice'])
                    is_better = rounded_tp > current_tp if side == 'BUY' else rounded_tp < current_tp
                    is_significant = abs(current_tp - rounded_tp) > (rounded_tp * 0.0001)

                    if is_better and is_significant:
                        logger.info("🎯 %s Reached for %s. Moving TP from %s to %s", tier, symbol, current_tp, rounded_tp)
                        if tp_order['id']:
                            await loop.run_in_executor(None, lambda: trading_service.exchange.cancel_order(tp_order['id'], symbol))
                        await loop.run_in_executor(None, lambda: trading_service.place_algo_order(symbol, close_side, 'TAKE_PROFIT_MARKET', rounded_tp))
                else:
                    logger.info("🎯 %s Reached for %s. Creating New TP at %s", tier, symbol, rounded_tp)
                    await loop.run_in_executor(None, lambda: trading_service.place_algo_order(symbol, close_side, 'TAKE_PROFIT_MARKET', rounded_tp))

        except Exception as e:
            logger.error("Failed to update orders for %s: %s", symbol, e)

# Global Instance
trade_manager = TradeManager()
