
import sys
import os
import pandas as pd
import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.cnn_service import CNNPatternModel, train_cnn_model
from services.chart_generator import generate_chart_windows
from services.data_service import get_historical_data
from ai_engine import add_indicators

def train_cnn_pattern_model(epochs=40):
    """
    Train CNN model for candlestick pattern recognition using multiple assets
    """
    symbols = ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "ADA-USD"]
    print(f"🧠 Training CNN Pattern Model for {len(symbols)} symbols")
    print("=" * 60)

    all_windows = []
    all_labels = []

    for symbol in symbols:
        # 1. Fetch Historical Data
        print(f"\n[1/5] Fetching data for {symbol}...")
        raw_data = get_historical_data(symbol, period="2y", interval="1h", limit=1000)

        if "error" in raw_data:
            print(f"   ❌ Error: {raw_data['error']}")
            continue

        df = pd.DataFrame(raw_data["data"])
        df = add_indicators(df)
        print(f"   ✅ Loaded {len(df)} candles")

        # 2. Generate Training Windows
        windows, labels = generate_chart_windows(df, window_size=20)
        print(f"   ✅ Generated {len(windows)} training samples")

        all_windows.append(windows)
        all_labels.append(labels)

    if not all_windows:
        print("❌ No data loaded. Aborting.")
        return

    windows = np.concatenate(all_windows, axis=0)
    labels = np.concatenate(all_labels, axis=0)
    print(f"\n✨ TOTAL SAMPLES: {len(windows)}")

    # 3. Split Train/Test
    # Shuffle first to mix symbols
    indices = np.arange(len(windows))
    np.random.shuffle(indices)
    windows = windows[indices]
    labels = labels[indices]

    split_idx = int(len(windows) * 0.8)
    train_windows = windows[:split_idx]
    train_labels = labels[:split_idx]
    test_windows = windows[split_idx:]
    test_labels = labels[split_idx:]

    print(f"   Train: {len(train_windows)} | Test: {len(test_windows)}")

    # 4. Create DataLoaders
    print("\n[3/5] Preparing data loaders...")

    # Convert to tensors (batch, features, sequence)
    train_x = torch.FloatTensor(train_windows).permute(0, 2, 1)  # (N, 4, 20)
    train_y = torch.FloatTensor(train_labels).view(-1, 1)  # Menambahkan dimensi kolom
    test_y = torch.FloatTensor(test_labels).view(-1, 1)    # Menambahkan dimensi kolom
    test_x = torch.FloatTensor(test_windows).permute(0, 2, 1)
    test_y = torch.FloatTensor(test_labels)

    train_dataset = TensorDataset(train_x, train_y)
    test_dataset = TensorDataset(test_x, test_y)

    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=64, shuffle=False)

    # 5. Initialize Model
    print("\n[4/5] Training CNN model...")
    model = CNNPatternModel(sequence_length=20, input_features=4)

    # Train
    history = train_cnn_model(model, train_loader, num_epochs=epochs, learning_rate=0.001)

    # 6. Evaluate on Test Set
    print("\n[5/5] Evaluating on test set...")
    model.eval()
    correct = 0
    total = 0

    with torch.no_grad():
        for batch_x, batch_y in test_loader:
            outputs = model(batch_x)
            predicted = (outputs > 0.5).float()
            total += batch_y.size(0)
            correct += (predicted == batch_y).sum().item()

    test_accuracy = 100 * correct / total
    print(f"✅ Test Accuracy: {test_accuracy:.2f}%")

    # 7. Save Model
    model_path = "models/cnn_pattern_v2.pth"
    # Also overwrite the active model path if it exists or use v1 as default
    torch.save(model.state_dict(), model_path)
    torch.save(model.state_dict(), "models/cnn_pattern_v1.pth") # Active model
    print(f"\n✅ Model saved to {model_path} and models/cnn_pattern_v1.pth")

    # 8. Summary
    print("\n" + "=" * 60)
    print("📊 TRAINING SUMMARY")
    print("=" * 60)
    print(f"Total Symbols     : {len(symbols)}")
    print(f"Total Samples     : {len(windows)}")
    print(f"Final Train Acc   : {history['accuracy'][-1]:.2f}%")
    print(f"Test Accuracy     : {test_accuracy:.2f}%")
    print(f"Epochs            : {epochs}")

    if test_accuracy > 60:
        print("\n✅ Status: READY FOR ENSEMBLE")
    elif test_accuracy > 52:
        print("\n⚠️ Status: ACCEPTABLE (Noisy data)")
    else:
        print("\n❌ Status: NEEDS IMPROVEMENT")

    return model, history

if __name__ == "__main__":
    train_cnn_pattern_model(epochs=40)
