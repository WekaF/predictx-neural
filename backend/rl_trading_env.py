
import gymnasium as gym
from gymnasium import spaces
import numpy as np
import pandas as pd
from ai_engine import add_indicators

class TradingEnv(gym.Env):
    """
    Custom Trading Environment for RL Agent (PPO)
    Optimized for Rp 250k capital with leverage support
    """
    metadata = {'render_modes': ['human']}

    def __init__(self, df, initial_balance=250000, fee_rate=0.001):
        super(TradingEnv, self).__init__()

        self.df = df
        self.initial_balance = initial_balance
        self.fee_rate = fee_rate

        # State: [Close_norm, RSI, EMA_Diff, LSTM_Prob, Position, Balance_norm, Leverage]
        self.observation_space = spaces.Box(
            low=np.array([0, 0, -1, 0, -1, 0, 0]),
            high=np.array([1, 100, 1, 1, 1, 10, 5]),
            dtype=np.float32
        )

        # Action: 0=Hold, 1=Buy_1x, 2=Buy_3x, 3=Buy_5x, 4=Sell
        self.action_space = spaces.Discrete(5)

        self.reset()

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)

        self.current_step = 60  # Start after enough data for indicators
        self.balance = self.initial_balance
        self.position = 0.0
        self.entry_price = 0.0
        self.leverage = 1
        self.total_profit = 0
        self.trades = []
        self.equity_curve = [self.initial_balance]

        return self._get_observation(), {}

    def _get_observation(self):
        """
        Returns normalized state vector
        """
        row = self.df.iloc[self.current_step]

        # Normalize close price (0-1 range based on recent window)
        recent_prices = self.df['close'].iloc[max(0, self.current_step-100):self.current_step+1]
        close_norm = (row['close'] - recent_prices.min()) / (recent_prices.max() - recent_prices.min() + 1e-8)

        # RSI (already 0-100)
        rsi = row['rsi']

        # EMA Diff (already percentage)
        ema_diff = row['ema_diff']

        # LSTM Probability (placeholder - will be filled by ai_engine)
        lstm_prob = 0.5  # Neutral default

        # Position (-1=short, 0=flat, 1=long)
        position_state = 1 if self.position > 0 else 0

        # Balance normalized (relative to initial)
        balance_norm = self.balance / self.initial_balance

        # Current leverage
        leverage_state = self.leverage

        return np.array([
            close_norm,
            rsi / 100.0,  # Normalize to 0-1
            ema_diff,
            lstm_prob,
            position_state,
            balance_norm,
            leverage_state / 5.0  # Normalize to 0-1
        ], dtype=np.float32)

    def step(self, action):
        """
        Execute action and return (observation, reward, done, truncated, info)
        """
        # Convert numpy array to int if needed
        if hasattr(action, 'item'):
            action = action.item()

        current_price = self.df.iloc[self.current_step]['close']
        done = False
        reward = 0

        # Action Mapping
        # 0 = Hold
        # 1 = Buy 1x
        # 2 = Buy 3x
        # 3 = Buy 5x
        # 4 = Sell

        # Execute Action
        if action in [1, 2, 3] and self.position == 0 and self.balance > 10000:  # Min Rp 10k per trade
            # BUY with leverage
            leverage_map = {1: 1, 2: 3, 3: 5}
            self.leverage = leverage_map[action]

            # Calculate position size (use 20% of balance for risk management)
            trade_amount = self.balance * 0.2 * self.leverage
            fee = trade_amount * self.fee_rate
            net_amount = trade_amount - fee

            self.position = net_amount / current_price
            self.entry_price = current_price
            self.balance -= (trade_amount / self.leverage)  # Deduct margin

            self.trades.append({
                'type': 'BUY',
                'price': current_price,
                'leverage': self.leverage,
                'step': self.current_step
            })

        elif action == 4 and self.position > 0:
            # SELL
            sell_value = self.position * current_price
            fee = sell_value * self.fee_rate
            net_value = sell_value - fee

            # Calculate P&L
            profit = net_value - (self.entry_price * self.position)
            self.total_profit += profit

            # Return margin + profit
            self.balance += (self.entry_price * self.position / self.leverage) + profit

            self.trades.append({
                'type': 'SELL',
                'price': current_price,
                'profit': profit,
                'step': self.current_step
            })

            # Calculate reward based on profit percentage
            profit_pct = profit / (self.entry_price * self.position)
            reward = profit_pct * 100  # Scale reward

            # Reset position
            self.position = 0
            self.entry_price = 0
            self.leverage = 1

        # Check Liquidation (if price moves against us by 1/leverage)
        if self.position > 0:
            liquidation_price = self.entry_price * (1 - 0.9 / self.leverage)
            if current_price <= liquidation_price:
                # LIQUIDATED
                self.balance = 0
                self.position = 0
                reward = -100  # Heavy penalty
                done = True

        # Update equity curve
        current_equity = self.balance + (self.position * current_price if self.position > 0 else 0)
        self.equity_curve.append(current_equity)

        # Move to next step
        self.current_step += 1

        # Episode end conditions
        if self.current_step >= len(self.df) - 1:
            done = True
            # Final reward based on total return
            final_return = (current_equity - self.initial_balance) / self.initial_balance
            reward += final_return * 100

        # Bankruptcy check
        if self.balance < 5000:  # Below minimum tradeable amount
            done = True
            reward = -50

        observation = self._get_observation()
        info = {
            'balance': self.balance,
            'position': self.position,
            'total_profit': self.total_profit,
            'trades': len(self.trades)
        }

        return observation, reward, done, False, info

    def render(self, mode='human'):
        current_equity = self.balance + (self.position * self.df.iloc[self.current_step]['close'] if self.position > 0 else 0)
        print(f"Step: {self.current_step} | Balance: Rp {self.balance:,.0f} | Equity: Rp {current_equity:,.0f} | Trades: {len(self.trades)}")
