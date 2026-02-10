import sys
import os
import pandas as pd
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv
from stable_baselines3.common.callbacks import BaseCallback

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from rl_trading_env import TradingEnv
from services.data_service import get_historical_data
from ai_engine import add_indicators

class TensorboardCallback(BaseCallback):
    """
    Custom callback for logging training metrics
    """
    def __init__(self, verbose=0):
        super(TensorboardCallback, self).__init__(verbose)
        self.episode_rewards = []
        self.episode_lengths = []
    
    def _on_step(self) -> bool:
        # Log episode rewards
        if len(self.locals.get('infos', [])) > 0:
            for info in self.locals['infos']:
                if 'episode' in info:
                    self.episode_rewards.append(info['episode']['r'])
                    self.episode_lengths.append(info['episode']['l'])
                    
                    if len(self.episode_rewards) % 10 == 0:
                        avg_reward = np.mean(self.episode_rewards[-10:])
                        print(f"Episode {len(self.episode_rewards)} | Avg Reward (last 10): {avg_reward:.2f}")
        
        return True

def train_rl_agent(symbol="BTC-USD", total_timesteps=100000):
    """
    Train PPO agent on historical trading data
    """
    print(f"🤖 Starting RL Agent Training for {symbol}")
    print(f"Total Timesteps: {total_timesteps:,}")
    
    # 1. Fetch Historical Data (2 years for better training)
    print("\n[1/4] Fetching historical data...")
    raw_data = get_historical_data(symbol, period="2y", interval="1h")
    
    if "error" in raw_data:
        print(f"❌ Error: {raw_data['error']}")
        return
    
    df = pd.DataFrame(raw_data["data"])
    if df.empty:
        print("❌ No data received")
        return
    
    # 2. Add Indicators
    print("[2/4] Adding technical indicators...")
    df = add_indicators(df)
    print(f"✅ Prepared {len(df)} candles with indicators")
    
    # 3. Create Environment
    print("[3/4] Creating trading environment...")
    env = TradingEnv(df, initial_balance=250000)
    env = DummyVecEnv([lambda: env])  # Vectorize for SB3
    
    # 4. Initialize PPO Agent
    print("[4/4] Training PPO agent...")
    model = PPO(
        "MlpPolicy",
        env,
        verbose=1,
        learning_rate=0.0003,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01
    )
    
    # Train
    callback = TensorboardCallback()
    model.learn(total_timesteps=total_timesteps, callback=callback)
    
    # 5. Save Model
    model_path = "models/ppo_agent"
    model.save(model_path)
    print(f"\n✅ Model saved to {model_path}.zip")
    
    # 6. Quick Evaluation
    print("\n--- Quick Evaluation ---")
    obs = env.reset()
    total_reward = 0
    done = False
    steps = 0
    
    while not done and steps < 1000:
        action, _states = model.predict(obs, deterministic=True)
        obs, reward, done, info = env.step(action)
        total_reward += reward[0]
        steps += 1
    
    print(f"Evaluation Steps: {steps}")
    print(f"Total Reward: {total_reward:.2f}")
    print(f"Final Balance: Rp {info[0]['balance']:,.0f}")
    
    return model

if __name__ == "__main__":
    # Train with 100k timesteps (adjust based on compute power)
    # For faster testing, use 10000. For production, use 500000+
    train_rl_agent(symbol="BTC-USD", total_timesteps=50000)
