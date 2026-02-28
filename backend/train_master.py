#!/usr/bin/env python3
"""
PredictX - Unified Training Master Script
Unifies training for LSTM, CNN, and RL Agents.
"""

import sys
import os
import argparse
import time

# Ensure we're in the backend directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.getcwd())

from ai_engine import ai_engine
from train_cnn import train_cnn_pattern_model
from train_rl_agent import train_rl_agent

def header(text):
    print("\n" + "=" * 60)
    print(f"🚀 {text}")
    print("=" * 60)

def train_lstm(symbol, epochs, interval):
    header(f"Training LSTM Model (Tier 5/6) - {symbol}")
    print(f"Epochs: {epochs} | Interval: {interval}")
    
    result = ai_engine.train(symbol=symbol, epochs=epochs, interval=interval)
    
    if result["status"] == "success":
        print(f"\n✅ LSTM Training Complete!")
        print(f"Final Loss: {result['final_loss']:.6f}")
    else:
        print(f"\n❌ LSTM Training Failed: {result.get('message', 'Unknown error')}")

def train_cnn(epochs):
    header("Training CNN Pattern Model (Tier 6)")
    print(f"Epochs: {epochs}")
    
    model, history = train_cnn_pattern_model(epochs=epochs)
    print("\n✅ CNN Training Complete!")
    print(f"Final Accuracy: {history['accuracy'][-1]:.2f}%")

def train_rl(symbol, timesteps):
    header(f"Training RL Trading Agent (Tier 7) - {symbol}")
    print(f"Total Timesteps: {timesteps}")
    
    try:
        model = train_rl_agent(symbol=symbol, total_timesteps=timesteps)
        print("\n✅ RL Agent Training Complete!")
    except Exception as e:
        print(f"\n❌ RL Agent Training Failed: {e}")

def main():
    parser = argparse.ArgumentParser(description="PredictX Unified Training Master")
    parser.add_argument("--tier", type=str, choices=["lstm", "cnn", "rl", "all"], 
                        help="Which model(s) to train")
    parser.add_argument("--symbol", type=str, default="BTC-USD", help="Target symbol (e.g. BTC-USD)")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--timesteps", type=int, default=50000, help="Timesteps for RL training")
    parser.add_argument("--interval", type=str, default="1h", help="Data interval (e.g. 1h, 15m)")
    parser.add_argument("--all", action="store_true", help="Train everything (Tier 5, 6, 7)")

    args = parser.parse_args()

    if not args.tier and not args.all:
        parser.print_help()
        return

    start_total = time.time()

    if args.all or args.tier == "lstm":
        train_lstm(args.symbol, args.epochs, args.interval)

    if args.all or args.tier == "cnn":
        train_cnn(args.epochs)

    if args.all or args.tier == "rl":
        train_rl(args.symbol, args.timesteps)

    total_time = (time.time() - start_total) / 60
    header("ALL TASKS COMPLETED")
    print(f"Total time elapsed: {total_time:.2f} minutes")
    print("Models saved in 'models/' directory.")

if __name__ == "__main__":
    main()
