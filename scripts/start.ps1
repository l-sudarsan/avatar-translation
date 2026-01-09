# Quick Start Script for Translation Avatar App
# This script helps you get started quickly

param(
    [string]$SpeechRegion = "westus2",
    [string]$SpeechKey = ""
)

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Speech Translation Avatar - Quick Start                 ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    
    if ($SpeechKey -eq "") {
        $SpeechKey = Read-Host "Enter your Azure Speech Service Key"
    }
    
    if ($SpeechRegion -eq "") {
        $SpeechRegion = Read-Host "Enter your Azure Speech Service Region (default: westus2)"
        if ($SpeechRegion -eq "") {
            $SpeechRegion = "westus2"
        }
    }
    
    # Create .env file
    @"
# Azure Speech Service Configuration
SPEECH_REGION=$SpeechRegion
SPEECH_KEY=$SpeechKey

# Application Configuration
PORT=5000
FLASK_ENV=production
"@ | Out-File -FilePath ".env" -Encoding UTF8
    
    Write-Host "✅ .env file created!" -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔍 Checking Python installation..." -ForegroundColor Yellow

# Check if Python is installed
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} else {
    Write-Host "❌ Python not found! Please install Python 3.8 or later" -ForegroundColor Red
    Write-Host "   Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

$pythonVersion = & $pythonCmd --version
Write-Host "✅ Found: $pythonVersion" -ForegroundColor Green

Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow

# Install requirements
& $pythonCmd -m pip install -r requirements.txt --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Some dependencies may have failed to install" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  🚀 Ready to start!                                       ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Cyan
Write-Host "  $pythonCmd app.py" -ForegroundColor White
Write-Host ""
Write-Host "Then open in your browser:" -ForegroundColor Cyan
Write-Host "  http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "For dev tunnel (public access):" -ForegroundColor Cyan
Write-Host "  1. In VS Code, open PORTS tab" -ForegroundColor White
Write-Host "  2. Forward port 5000" -ForegroundColor White
Write-Host "  3. Set visibility to Public" -ForegroundColor White
Write-Host "  4. Copy and share the tunnel URL" -ForegroundColor White
Write-Host ""

$startNow = Read-Host "Start the application now? (y/n)"
if ($startNow -eq "y" -or $startNow -eq "Y" -or $startNow -eq "yes") {
    Write-Host ""
    Write-Host "🚀 Starting application..." -ForegroundColor Green
    Write-Host ""
    & $pythonCmd app.py
}
