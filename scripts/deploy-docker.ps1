# PowerShell script to build and run Docker container locally
# Prerequisites: Docker Desktop installed and running

param(
    [Parameter(Mandatory=$false)]
    [string]$ImageName = "speech-avatar-translate",
    
    [Parameter(Mandatory=$false)]
    [string]$ContainerName = "speech-avatar",
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 8000,
    
    [Parameter(Mandatory=$false)]
    [switch]$Build,
    
    [Parameter(Mandatory=$false)]
    [switch]$Run,
    
    [Parameter(Mandatory=$false)]
    [switch]$Stop,
    
    [Parameter(Mandatory=$false)]
    [switch]$Logs
)

$scriptDir = Split-Path -Parent $PSScriptRoot

# Build the Docker image
if ($Build) {
    Write-Host "🔨 Building Docker image: $ImageName" -ForegroundColor Cyan
    docker build -t $ImageName $scriptDir
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build complete!" -ForegroundColor Green
    } else {
        Write-Host "❌ Build failed!" -ForegroundColor Red
        exit 1
    }
}

# Run the container
if ($Run) {
    # Check if .env exists
    $envFile = Join-Path $scriptDir ".env"
    if (-not (Test-Path $envFile)) {
        Write-Host "❌ .env file not found at $envFile. Copy .env.example to .env and configure it." -ForegroundColor Red
        exit 1
    }
    
    # Stop existing container if running
    $existing = docker ps -q -f name=$ContainerName
    if ($existing) {
        Write-Host "🛑 Stopping existing container..." -ForegroundColor Yellow
        docker stop $ContainerName | Out-Null
        docker rm $ContainerName | Out-Null
    }
    
    Write-Host "🚀 Starting container: $ContainerName on port $Port" -ForegroundColor Cyan
    docker run -d `
        --name $ContainerName `
        --env-file $envFile `
        -p "${Port}:8000" `
        --restart unless-stopped `
        $ImageName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Container started!" -ForegroundColor Green
        Write-Host "=================================================" -ForegroundColor Green
        Write-Host "Application URL: http://localhost:$Port" -ForegroundColor Cyan
        Write-Host "Speaker URL:     http://localhost:$Port/speaker" -ForegroundColor Cyan
        Write-Host "Listener URL:    http://localhost:$Port/listener/<session-code>" -ForegroundColor Cyan
        Write-Host "`nView logs: .\deploy-docker.ps1 -Logs" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Failed to start container!" -ForegroundColor Red
    }
}

# Stop the container
if ($Stop) {
    Write-Host "🛑 Stopping container: $ContainerName" -ForegroundColor Yellow
    docker stop $ContainerName | Out-Null
    docker rm $ContainerName | Out-Null
    Write-Host "✅ Container stopped and removed" -ForegroundColor Green
}

# Show logs
if ($Logs) {
    Write-Host "📜 Container logs (press Ctrl+C to exit):" -ForegroundColor Cyan
    docker logs -f $ContainerName
}

# Show help if no parameters
if (-not ($Build -or $Run -or $Stop -or $Logs)) {
    Write-Host @"
Speech Translation Avatar - Docker Deployment Script

Usage:
  .\deploy-docker.ps1 -Build              # Build the Docker image
  .\deploy-docker.ps1 -Run                # Run the container
  .\deploy-docker.ps1 -Build -Run         # Build and run
  .\deploy-docker.ps1 -Stop               # Stop and remove container
  .\deploy-docker.ps1 -Logs               # View container logs

Options:
  -ImageName <name>      Docker image name (default: speech-avatar-translate)
  -ContainerName <name>  Container name (default: speech-avatar)
  -Port <number>         Host port (default: 8000)

Prerequisites:
  1. Docker Desktop installed and running
  2. .env file configured with SPEECH_REGION and SPEECH_KEY

Example:
  .\deploy-docker.ps1 -Build -Run -Port 8080

"@ -ForegroundColor White
}
