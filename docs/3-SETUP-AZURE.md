# Setup in Azure

> **Status**: ⏳ Cloud deployment testing pending

## Pre-Deployment Requirements

### Local Testing (Required Before Deployment)

- [ ] All tests in `5-TESTING.md` completed
- [ ] Tested with real Azure Speech service
- [ ] Tested with multiple browsers
- [ ] Tested with multiple concurrent listeners (5+)
- [ ] Tested session creation/end flow
- [ ] Verified WebRTC avatar connection works

### Environment Preparation

- [ ] `.env` file configured with production credentials
- [ ] Azure Speech Service subscription active
- [ ] Quota limits reviewed (TPS, concurrent connections)
- [ ] Python dependencies installed (`requirements.txt`)

---

## Deployment Options

> 💡 **Quick Deploy Scripts**: Use the scripts in `scripts/` folder for automated deployment:
> - `scripts/deploy-azure-app-service.ps1` - Deploy to Azure App Service
> - `scripts/deploy-docker.ps1` - Build and run Docker container locally

### Option 1: Azure App Service (Recommended)

#### Using Deployment Script

```powershell
# Automated deployment
.\scripts\deploy-azure-app-service.ps1 -ResourceGroupName "my-rg" -AppServiceName "my-app"
```

#### Manual Deployment

##### Prerequisites

- Azure subscription active
- Azure CLI installed (`az`)
- Resource group created

##### Deployment Steps

```powershell
# 1. Login to Azure
az login

# 2. Create App Service Plan
az appservice plan create `
  --name translate-app-plan `
  --resource-group myResourceGroup `
  --sku B1 `
  --is-linux

# 3. Create Web App
az webapp create `
  --name my-translate-app `
  --resource-group myResourceGroup `
  --plan translate-app-plan `
  --runtime "PYTHON:3.11"

# 4. Configure environment variables
az webapp config appsettings set `
  --name my-translate-app `
  --resource-group myResourceGroup `
  --settings `
    SPEECH_KEY=your-key `
    SPEECH_REGION=your-region

# 5. Deploy code
az webapp up `
  --name my-translate-app `
  --resource-group myResourceGroup
```

#### Post-Deployment Verification

- [ ] Verify app starts: `https://my-translate-app.azurewebsites.net`
- [ ] Test speaker interface: `/speaker`
- [ ] Test listener URL generation
- [ ] Test with remote device
- [ ] Configure custom domain (optional)
- [ ] Enable HTTPS redirect
- [ ] Set up monitoring/logs

---

### Option 2: Docker Container

#### Using Deployment Script

```powershell
# Build and run with script
.\scripts\deploy-docker.ps1 -Build -Run

# Or separately
.\scripts\deploy-docker.ps1 -Build    # Build image
.\scripts\deploy-docker.ps1 -Run      # Run container
.\scripts\deploy-docker.ps1 -Logs     # View logs
.\scripts\deploy-docker.ps1 -Stop     # Stop container
```

#### Manual Deployment

##### Prerequisites

- Docker installed
- Docker Hub account (or Azure Container Registry)

##### Deployment Steps

```powershell
# 1. Build image
docker build -t translate-app:latest .

# 2. Test locally
docker run -p 5000:5000 `
  -e SPEECH_KEY=your-key `
  -e SPEECH_REGION=your-region `
  translate-app:latest

# 3. Tag for registry
docker tag translate-app:latest yourusername/translate-app:latest

# 4. Push to registry
docker push yourusername/translate-app:latest

# 5. Deploy to Azure Container Instances
az container create `
  --resource-group myResourceGroup `
  --name translate-app `
  --image yourusername/translate-app:latest `
  --dns-name-label my-translate-app `
  --ports 5000 `
  --environment-variables `
    SPEECH_KEY=your-key `
    SPEECH_REGION=your-region
```

#### Post-Deployment

- [ ] Verify container running
- [ ] Test public URL
- [ ] Check logs: `docker logs <container>`
- [ ] Monitor resource usage

---

### Option 3: Azure Container Apps

#### Prerequisites

- Azure CLI with Container Apps extension
- Container image pushed to registry

#### Deployment Steps

```powershell
# 1. Create Container Apps environment
az containerapp env create `
  --name translate-app-env `
  --resource-group myResourceGroup `
  --location eastus

# 2. Create Container App
az containerapp create `
  --name translate-app `
  --resource-group myResourceGroup `
  --environment translate-app-env `
  --image yourusername/translate-app:latest `
  --target-port 5000 `
  --ingress external `
  --secrets `
    speech-key=your-key `
  --env-vars `
    SPEECH_KEY=secretref:speech-key `
    SPEECH_REGION=your-region
```

#### Post-Deployment

- [ ] Get app URL: `az containerapp show --name translate-app ...`
- [ ] Test full workflow
- [ ] Configure scaling rules
- [ ] Set up monitoring

---

## Security Configuration

### HTTPS Setup

- [ ] Custom domain configured
- [ ] SSL/TLS certificate installed
- [ ] HTTP → HTTPS redirect enabled
- [ ] HSTS header configured

### Environment Variables

- [ ] All secrets in environment variables (not code)
- [ ] `.env` file NOT in version control
- [ ] Azure Key Vault integration (optional)

### CORS Configuration

If accessing from different domains:

```python
from flask_cors import CORS
CORS(app, origins=["https://yourdomain.com"])
```

- [ ] CORS configured for allowed origins
- [ ] Tested cross-origin requests

### Rate Limiting (Recommended)

```powershell
pip install Flask-Limiter
```

- [ ] Rate limiting implemented
- [ ] API endpoints protected
- [ ] Abuse prevention measures

---

## Production Configuration

### Server Settings

```python
# app.py - Production mode
if __name__ == '__main__':
    socketio.run(
        app,
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=False,  # Set to False in production!
        log_output=True
    )
```

- [ ] `debug=False` in production
- [ ] Proper logging configured
- [ ] Error pages customized

### Session Persistence (Recommended)

For multi-server deployments:

```python
# Use Redis for session storage
import redis
redis_client = redis.Redis(
    host='your-redis.redis.cache.windows.net',
    port=6380,
    ssl=True,
    password='your-key'
)
```

- [ ] Redis configured (if needed)
- [ ] Session data migrated to Redis
- [ ] Tested with multiple servers

### WebSocket Configuration

```python
# For production with multiple workers
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    message_queue='redis://your-redis:6379',
    async_mode='eventlet'
)
```

- [ ] Message queue configured (if scaled)
- [ ] CORS origins restricted
- [ ] Async mode verified

---

## Monitoring & Logging

### Application Insights (Azure)

```powershell
pip install applicationinsights
```

```python
from applicationinsights import TelemetryClient
tc = TelemetryClient('your-instrumentation-key')
```

- [ ] Application Insights enabled
- [ ] Custom events tracked
- [ ] Performance metrics monitored

### Logging Configuration

```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

- [ ] Logging level set (INFO/WARNING)
- [ ] Log rotation configured
- [ ] Logs accessible for debugging

### Health Check Endpoint

```python
@app.route('/health')
def health():
    return {'status': 'healthy'}, 200
```

- [ ] Health check endpoint added
- [ ] Load balancer configured to use it

---

## Performance Optimization

### Caching

- [ ] Static files cached (CSS, JS)
- [ ] CDN configured (optional)
- [ ] Browser caching headers set

### Compression

```python
from flask_compress import Compress
Compress(app)
```

- [ ] Response compression enabled
- [ ] Tested bandwidth reduction

### Connection Pooling

- [ ] Azure Speech SDK connections reused
- [ ] Memory usage monitored

---

## Backup & Recovery

### Configuration Backup

- [ ] `.env` file backed up securely
- [ ] Azure credentials stored in Key Vault
- [ ] Deployment scripts versioned

### Disaster Recovery Plan

- [ ] RTO/RPO defined (Recovery Time/Point Objectives)
- [ ] Failover procedure documented
- [ ] Regular DR drills scheduled

---

## Go-Live Checklist

### Functional Testing

- [ ] Speaker can create session
- [ ] Listener URL accessible externally
- [ ] Multiple listeners can join
- [ ] Translation works end-to-end
- [ ] Session end notifications work
- [ ] HTTPS enforced
- [ ] Mobile devices tested

### Performance Testing

- [ ] Load test with 10+ concurrent sessions
- [ ] Latency within acceptable limits (<2s)
- [ ] No memory leaks over 1 hour
- [ ] CPU usage acceptable under load

### Security Testing

- [ ] Secrets not exposed in responses
- [ ] HTTPS connection verified
- [ ] CORS policy enforced
- [ ] Rate limiting working

### Final Steps

- [ ] Smoke test on production
- [ ] Monitoring alerts configured
- [ ] Support team trained
- [ ] User communication sent
- [ ] Rollback plan prepared
- [ ] On-call schedule defined

**DEPLOY TO PRODUCTION** 🚀

---

## Post-Launch

### Week 1

- [ ] Monitor error rates daily
- [ ] Review user feedback
- [ ] Check performance metrics
- [ ] Address critical issues immediately

### Week 2-4

- [ ] Analyze usage patterns
- [ ] Optimize based on real data
- [ ] Plan feature enhancements
- [ ] Review costs and scaling

### Ongoing

- [ ] Weekly performance review
- [ ] Monthly security updates
- [ ] Quarterly capacity planning
- [ ] Annual architecture review

---

## Quick Deployment Commands

### Azure App Service (Fast)

```powershell
# One-command deploy (from app directory)
az webapp up `
  --name my-translate-app `
  --runtime "PYTHON:3.11" `
  --sku B1

# Set environment variables
az webapp config appsettings set `
  --name my-translate-app `
  --settings SPEECH_KEY=xxx SPEECH_REGION=xxx
```

### Docker (Fast)

```powershell
# Build and run
docker build -t translate-app .
docker run -p 5000:5000 -e SPEECH_KEY=xxx -e SPEECH_REGION=xxx translate-app
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 5000 already in use | Change PORT environment variable |
| Azure credentials not found | Check `.env` or app settings |
| WebRTC not connecting | Verify HTTPS enabled |
| Socket.IO disconnect | Check firewall, enable WebSocket |
| High latency | Review Azure region, network path |
| Session not found | Check in-memory storage, consider Redis |
