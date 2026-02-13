#!/bin/bash

# Trinity AI - Complete Retraining Script
# This script retrains all AI models in the correct order

set -e  # Exit on error

echo "======================================"
echo "Trinity AI - Complete Retraining"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d ".venv" ] && [ ! -d "venv" ]; then
    echo -e "${RED}❌ Virtual environment not found!${NC}"
    echo "Please create a virtual environment first:"
    echo "  python3 -m venv .venv"
    echo "  source .venv/bin/activate"
    echo "  pip install -r requirements.txt"
    exit 1
fi

# Activate virtual environment
if [ -d ".venv" ]; then
    echo -e "${BLUE}🔧 Activating virtual environment (.venv)...${NC}"
    source .venv/bin/activate
elif [ -d "venv" ]; then
    echo -e "${BLUE}🔧 Activating virtual environment (venv)...${NC}"
    source venv/bin/activate
fi

echo ""
echo -e "${YELLOW}⚠️  This will retrain all models. Estimated time: 10-30 minutes${NC}"
echo -e "${YELLOW}⚠️  Make sure you have a stable internet connection for data fetching${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "======================================"
echo "STEP 1/3: Training LSTM (Tier 5)"
echo "======================================"
echo ""

python3 << 'EOF'
import sys
sys.path.append('.')
from ai_engine import ai_engine

print("🧠 Training LSTM Model (Tier 5 - Trend Surfer)...")
result = ai_engine.train(symbol="BTC-USD", epochs=50, interval="1h")

if result["status"] == "success":
    print(f"✅ LSTM Training Complete!")
    print(f"   Final Loss: {result['final_loss']:.6f}")
    print(f"   Epochs: {result['epochs']}")
else:
    print(f"❌ LSTM Training Failed: {result.get('message', 'Unknown error')}")
    sys.exit(1)
EOF

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ LSTM training failed!${NC}"
    exit 1
fi

echo ""
echo "======================================"
echo "STEP 2/3: Training RL Agent (Tier 6)"
echo "======================================"
echo ""
echo -e "${YELLOW}⏳ This step may take 15-20 minutes...${NC}"
echo ""

python3 train_rl_agent.py

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ RL Agent training failed!${NC}"
    exit 1
fi

echo ""
echo "======================================"
echo "STEP 3/3: Running Backtest Validation"
echo "======================================"
echo ""

python3 << 'EOF'
import sys
sys.path.append('.')
from ai_engine import ai_engine
from services.backtest_service import run_backtest_v2

print("📊 Running backtest with new models...")
final_equity, trades, df = run_backtest_v2(
    ai_engine, 
    symbol="BTC-USD", 
    period="3mo", 
    interval="1h"
)

print(f"\n✅ Backtest Complete!")
print(f"   Final Equity: ${final_equity:,.2f}")
print(f"   Total Trades: {len(trades)}")
EOF

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backtest failed!${NC}"
    exit 1
fi

echo ""
echo "======================================"
echo -e "${GREEN}✅ ALL TRAINING COMPLETE!${NC}"
echo "======================================"
echo ""
echo "Models saved:"
echo "  - models/predictx_v2.pth (LSTM)"
echo "  - models/scaler_v2.pkl (Scaler)"
echo "  - models/ppo_agent.zip (RL Agent)"
echo ""
echo "You can now run backtests with the new models."
echo ""
