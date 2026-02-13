
import torch
import torch.nn as nn
import torch.nn.functional as F

class CNNPatternModel(nn.Module):
    """
    CNN for Candlestick Pattern Recognition
    Input: 20×4 matrix (20 candles × OHLC)
    Output: Binary probability (Bullish/Bearish)
    """
    def __init__(self, sequence_length=20, input_features=4):
        super(CNNPatternModel, self).__init__()

        # Conv1D layers for pattern extraction
        self.conv1 = nn.Conv1d(in_channels=input_features, out_channels=32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm1d(32)
        self.pool1 = nn.MaxPool1d(kernel_size=2)

        self.conv2 = nn.Conv1d(in_channels=32, out_channels=64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm1d(64)
        self.pool2 = nn.MaxPool1d(kernel_size=2)

        self.conv3 = nn.Conv1d(in_channels=64, out_channels=128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm1d(128)

        # Calculate flattened size after convolutions
        # sequence_length=20 -> pool1(10) -> pool2(5)
        self.flat_size = 128 * 5

        # Fully connected layers
        self.fc1 = nn.Linear(self.flat_size, 64)
        self.dropout1 = nn.Dropout(0.3)
        self.fc2 = nn.Linear(64, 32)
        self.dropout2 = nn.Dropout(0.2)
        self.fc3 = nn.Linear(32, 1)  # Binary output

    def forward(self, x):
        # x shape: (batch, features, sequence)
        # Conv layers
        x = self.pool1(F.relu(self.bn1(self.conv1(x))))
        x = self.pool2(F.relu(self.bn2(self.conv2(x))))
        x = F.relu(self.bn3(self.conv3(x)))

        # Flatten
        x = x.view(-1, self.flat_size)

        # Dense layers
        x = F.relu(self.fc1(x))
        x = self.dropout1(x)
        x = F.relu(self.fc2(x))
        x = self.dropout2(x)
        x = torch.sigmoid(self.fc3(x))  # Output probability 0-1

        return x

def train_cnn_model(model, train_loader, num_epochs=30, learning_rate=0.001):
    """
    Train CNN pattern recognition model
    """
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    model.train()
    history = {'loss': [], 'accuracy': []}

    for epoch in range(num_epochs):
        epoch_loss = 0
        correct = 0
        total = 0

        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()

            # Forward pass
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y.view(-1, 1))

            # Backward pass
            loss.backward()
            optimizer.step()

            # Metrics
            epoch_loss += loss.item()
            predicted = (outputs > 0.5).float()
            total += batch_y.size(0)
            correct += (predicted == batch_y).sum().item()

        avg_loss = epoch_loss / len(train_loader)
        accuracy = 100 * correct / total

        history['loss'].append(avg_loss)
        history['accuracy'].append(accuracy)

        if (epoch + 1) % 5 == 0:
            print(f"Epoch [{epoch+1}/{num_epochs}], Loss: {avg_loss:.4f}, Accuracy: {accuracy:.2f}%")

    return history

def predict_pattern(model, candle_window):
    """
    Predict bullish/bearish pattern from candle window
    Args:
        candle_window: numpy array (20, 4) - OHLC data
    Returns:
        probability: float (0-1, where >0.5 = bullish)
    """
    model.eval()
    with torch.no_grad():
        # Convert to tensor and reshape for CNN
        # Shape: (1, features=4, sequence=20)
        x = torch.FloatTensor(candle_window.T).unsqueeze(0)
        prob = model(x).item()
    return prob
