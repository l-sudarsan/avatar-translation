# PowerShell script to deploy Speech Translation Avatar to Azure App Service
# Prerequisites: Azure CLI installed and logged in (az login)

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$true)]
    [string]$AppServiceName,
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "westus2",
    
    [Parameter(Mandatory=$false)]
    [string]$Sku = "B2",
    
    [Parameter(Mandatory=$false)]
    [string]$SpeechRegion,
    
    [Parameter(Mandatory=$false)]
    [string]$SpeechKey
)

# Continue on warnings but check exit codes manually
$ErrorActionPreference = "Continue"

Write-Host "Deploying Speech Translation Avatar to Azure App Service" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green

# Check Azure CLI login
Write-Host "`nChecking Azure CLI login status..." -ForegroundColor Cyan
try {
    $account = az account show 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Not logged in to Azure CLI. Run 'az login' first." -ForegroundColor Red
        exit 1
    }
    Write-Host "Logged in to Azure" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Azure CLI not found or not logged in. Run 'az login' first." -ForegroundColor Red
    exit 1
}

# Step 1: Create resource group
Write-Host "`n[1/7] Creating resource group: $ResourceGroupName in $Location" -ForegroundColor Cyan
$rgResult = az group create --name $ResourceGroupName --location $Location 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create resource group" -ForegroundColor Red
    Write-Host $rgResult -ForegroundColor Red
    exit 1
}
Write-Host "Resource group created successfully" -ForegroundColor Green

# Step 2: Create App Service Plan (Linux - required for Python)
$planName = "$AppServiceName-plan"
Write-Host "`n[2/7] Creating App Service Plan: $planName (Linux)" -ForegroundColor Cyan
$planResult = az appservice plan create --name $planName --resource-group $ResourceGroupName --location $Location --sku $Sku --is-linux 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create App Service Plan" -ForegroundColor Red
    Write-Host $planResult -ForegroundColor Red
    exit 1
}
Write-Host "App Service Plan created successfully" -ForegroundColor Green

# Step 3: Create Web App (Linux with Python 3.11)
Write-Host "`n[3/7] Creating Web App: $AppServiceName (Linux)" -ForegroundColor Cyan
$webappResult = az webapp create --resource-group $ResourceGroupName --plan $planName --name $AppServiceName --runtime "PYTHON:3.11" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create Web App" -ForegroundColor Red
    Write-Host $webappResult -ForegroundColor Red
    exit 1
}
Write-Host "Web App created successfully" -ForegroundColor Green

# Step 4: Configure Web App settings
Write-Host "`n[4/7] Configuring Web App settings" -ForegroundColor Cyan

# Enable WebSocket support
az webapp config set --resource-group $ResourceGroupName --name $AppServiceName --web-sockets-enabled true | Out-Null
Write-Host "  - WebSocket enabled" -ForegroundColor Green

# Enable always-on
az webapp config set --resource-group $ResourceGroupName --name $AppServiceName --always-on true | Out-Null
Write-Host "  - Always-on enabled" -ForegroundColor Green

# Configure startup command using app settings (more reliable)
$startupCmd = "gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:8000 --timeout 120 app:app"
Write-Host "  - Startup command will be: $startupCmd" -ForegroundColor Green

# Step 5: Configure app settings (environment variables)
Write-Host "`n[5/7] Configuring environment variables" -ForegroundColor Cyan

# Read from .env file if credentials not provided
$envFile = Join-Path $PSScriptRoot ".env"
if ((Test-Path $envFile) -and (-not $SpeechRegion -or -not $SpeechKey)) {
    Write-Host "  Reading credentials from .env file..." -ForegroundColor Cyan
    $envContent = Get-Content $envFile
    foreach ($line in $envContent) {
        if ($line -match "^SPEECH_REGION=(.+)$" -and -not $SpeechRegion) {
            $SpeechRegion = $matches[1].Trim()
        }
        if ($line -match "^SPEECH_KEY=(.+)$" -and -not $SpeechKey) {
            $SpeechKey = $matches[1].Trim()
        }
    }
}

# Build settings array
$settingsList = @(
    "SCM_DO_BUILD_DURING_DEPLOYMENT=true"  # ensure requirements.txt is installed on deploy
    "PYTHONUNBUFFERED=1"
    "WEBSITES_PORT=8000"
    "WEBSITES_CONTAINER_START_TIME_LIMIT=600"  # Allow 10 minutes for startup
)

if ($SpeechRegion) {
    $settingsList += "SPEECH_REGION=$SpeechRegion"
    Write-Host "  - SPEECH_REGION=$SpeechRegion" -ForegroundColor Green
} else {
    Write-Host "  - WARNING: SPEECH_REGION not set!" -ForegroundColor Yellow
}

if ($SpeechKey) {
    $settingsList += "SPEECH_KEY=$SpeechKey"
    Write-Host "  - SPEECH_KEY=********" -ForegroundColor Green
} else {
    Write-Host "  - WARNING: SPEECH_KEY not set!" -ForegroundColor Yellow
}

# Apply settings
az webapp config appsettings set --resource-group $ResourceGroupName --name $AppServiceName --settings $settingsList | Out-Null
Write-Host "  - App settings configured (Windows uses web.config for startup)" -ForegroundColor Green

# Step 6: Create deployment package
Write-Host "`n[6/7] Creating deployment package" -ForegroundColor Cyan

$deployDir = Join-Path $PSScriptRoot "deploy-temp"
$sourceDir = Split-Path -Parent $PSScriptRoot

# Clean up existing temp folder
if (Test-Path $deployDir) {
    Remove-Item $deployDir -Recurse -Force
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# Copy application files
Copy-Item (Join-Path $sourceDir "app.py") $deployDir
Copy-Item (Join-Path $sourceDir "speaker.html") $deployDir
Copy-Item (Join-Path $sourceDir "listener.html") $deployDir

# Copy vad_iterator.py if exists
$vadFile = Join-Path $sourceDir "vad_iterator.py"
if (Test-Path $vadFile) {
    Copy-Item $vadFile $deployDir
}

# Create startup.sh for Linux App Service
$startupScript = @"
#!/bin/bash
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:8000 --timeout 120 app:app
"@
Set-Content -Path (Join-Path $deployDir "startup.sh") -Value $startupScript -NoNewline
Write-Host "  - Created startup.sh for Linux" -ForegroundColor Green

# Copy requirements
$reqProd = Join-Path $sourceDir "requirements-production.txt"
if (Test-Path $reqProd) {
    Copy-Item $reqProd (Join-Path $deployDir "requirements.txt")
} else {
    Copy-Item (Join-Path $sourceDir "requirements.txt") $deployDir
}

# Copy static files
$staticCss = Join-Path $deployDir "static\css"
$staticJs = Join-Path $deployDir "static\js"
New-Item -ItemType Directory -Path $staticCss -Force | Out-Null
New-Item -ItemType Directory -Path $staticJs -Force | Out-Null

Copy-Item (Join-Path $sourceDir "static\css\styles.css") $staticCss
Copy-Item (Join-Path $sourceDir "static\js\speaker.js") $staticJs
Copy-Item (Join-Path $sourceDir "static\js\listener.js") $staticJs

Write-Host "  Files prepared for deployment" -ForegroundColor Green

# Create ZIP
$zipPath = Join-Path $PSScriptRoot "deploy-temp.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path "$deployDir\*" -DestinationPath $zipPath -Force
Write-Host "  ZIP archive created" -ForegroundColor Green

# Step 7: Deploy to Azure
Write-Host "`n[7/8] Deploying to Azure App Service (this may take 3-5 minutes)..." -ForegroundColor Cyan
$deployResult = az webapp deployment source config-zip --resource-group $ResourceGroupName --name $AppServiceName --src $zipPath 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed" -ForegroundColor Red
    Write-Host $deployResult -ForegroundColor Red
    # Cleanup before exit
    Remove-Item $deployDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "Deployment completed successfully" -ForegroundColor Green

# Step 8: Restart to apply configuration
Write-Host "`n[8/8] Restarting Web App to apply configuration" -ForegroundColor Cyan
$restartResult = az webapp restart --resource-group $ResourceGroupName --name $AppServiceName 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Automatic restart failed. Please restart the app manually." -ForegroundColor Yellow
    Write-Host $restartResult -ForegroundColor Yellow
} else {
    Write-Host "Web App restarted successfully" -ForegroundColor Green
}

# Cleanup
Write-Host "`nCleaning up temporary files..." -ForegroundColor Cyan
Remove-Item $deployDir -Recurse -Force
Remove-Item $zipPath -Force

# Output success message
$appUrl = "https://$AppServiceName.azurewebsites.net"
Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application URL: $appUrl" -ForegroundColor Cyan
Write-Host "Speaker URL:     $appUrl/speaker" -ForegroundColor Cyan
Write-Host "Listener URL:    $appUrl/listener/<session-code>" -ForegroundColor Cyan
Write-Host ""

if (-not $SpeechRegion -or -not $SpeechKey) {
    Write-Host "WARNING: Missing credentials. Set them in Azure Portal:" -ForegroundColor Yellow
    Write-Host "  Azure Portal -> App Service -> Configuration -> Application settings" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Wait 1-2 minutes for the app to start" -ForegroundColor White
Write-Host "  2. Open the Speaker URL in your browser" -ForegroundColor White
Write-Host "  3. If issues, check: Azure Portal -> App Service -> Log stream" -ForegroundColor White
