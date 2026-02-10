# Check if python is in PATH
if (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
} else {
    Write-Host "❌ Python not found! Please install Python from https://python.org or Microsoft Store." -ForegroundColor Red
    Write-Host "👉 Run this command after installing: winget install Python.Python.3.11" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found Python: $pythonCmd" -ForegroundColor Green

# Install dependencies if needed
if (-not (Test-Path "backend/venv")) {
    Write-Host "📦 Installing dependencies (first time only)..." -ForegroundColor Cyan
    & $pythonCmd -m pip install -r backend/requirements.txt
}

# Run Backend
Write-Host "🚀 Starting AI Engine..." -ForegroundColor Green
& $pythonCmd backend/main.py
