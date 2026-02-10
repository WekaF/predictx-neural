Write-Host "Installing Python via Microsoft Store (Winget)..."
winget install -e --id Python.Python.3.11 --silent --accept-source-agreements --accept-package-agreements
Write-Host "Installation command sent. Please restart your terminal after this completes."
