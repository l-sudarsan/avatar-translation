# Speech Translation Avatar Application

A standalone Flask application for real-time speech translation with Azure Avatar synthesis. Speak in one language and have an AI avatar speak the translation in another language.

## Features

- 🎤 **Real-time Speech Translation**: Continuous speech recognition and translation
- 🤖 **AI Avatar Output**: Translated speech spoken by customizable AI avatar
- 🌐 **Multiple Languages**: Support for 10+ languages (English, Spanish, French, German, Japanese, etc.)
- 📡 **WebRTC Streaming**: Low-latency video streaming via WebRTC
- 🔄 **Live Updates**: Real-time transcription display using Socket.IO
- 🎨 **Customizable Avatars**: Built-in or custom avatar characters with different styles
- 👥 **NEW: Speaker/Listener Mode**: Separate interfaces for speakers and remote listeners with session management

## Quick Start

### Prerequisites

- Python 3.8+
- Azure Speech Service subscription ([create one free](https://azure.microsoft.com/free/cognitive-services/))
- Modern web browser (Chrome, Edge, Firefox)

### Installation

1. **Clone or copy this directory**

2. **Install Python dependencies**
   ```powershell
   pip install -r requirements.txt
   ```

3. **Configure Azure credentials**
   ```powershell
   # Copy example environment file
   cp .env.example .env
   
   # Edit .env with your credentials
   notepad .env
   ```
   
   Add your Azure Speech Service credentials:
   ```
   SPEECH_REGION=westus2
   SPEECH_KEY=your_actual_speech_key_here
   ```

4. **Run the application**
   ```powershell
   python app.py
   ```

5. **Open in browser**
   Navigate to: `http://localhost:5000`

## Usage Modes

### 🆕 Speaker/Listener Mode (Recommended for Multi-User Sessions)

**Perfect for**: Presentations, meetings, webinars, or any scenario where one speaker translates for multiple remote listeners.

**Quick Start**:
1. **Speaker** opens `http://localhost:5000/speaker`
2. Create session, get unique listener URL
3. Share URL with participants
4. **Listeners** open URL in their browsers
5. Speaker starts translation - all listeners see avatar + translations in real-time

**Features**:
- ✅ **Speaker**: Control panel, no avatar video (saves bandwidth)
- ✅ **Listener**: Avatar video only, no controls (immersive experience)
- ✅ **Session Management**: Unique codes, multiple listeners per session
- ✅ **Real-time Broadcasting**: All listeners receive translations instantly
- ✅ **Listener Count**: See how many people are connected

📖 **Full Guide**: See [SPEAKER_LISTENER_GUIDE.md](./SPEAKER_LISTENER_GUIDE.md) for detailed instructions and API reference.

### Legacy Combined Mode

Original single-user interface with avatar, controls, and translation all in one view.

Access at: `http://localhost:5000/translate`

## Usage

### Basic Translation Flow

1. **Configure Translation**
   - Select **Source Language** (language you'll speak)
   - Select **Target Language** (language for translation)
   - Optionally specify **Target Voice** for the avatar

2. **Configure Avatar**
   - Choose avatar character (e.g., "lisa", "james")
   - Select avatar style (e.g., "casual-sitting", "technical-standing")
   - Customize appearance (background, video crop, etc.)

3. **Connect Avatar**
   - Click **"Connect Avatar"** button
   - Wait for connection confirmation
   - Click **"Test Speak"** to verify avatar works

4. **Start Translation**
   - Click **"Start Translation"**
   - Grant microphone permissions when prompted
   - **Speak into your microphone**
   - Watch the avatar speak your translation in real-time!

5. **View Results**
   - **Live Transcription**: See source and translated text in real-time
   - **Translation History**: Scroll through past translations
   - **Avatar Video**: Watch the AI avatar speak translations

## Supported Languages

### Source & Target Languages

| Language | Code | Example Voice |
|----------|------|---------------|
| English (US) | en-US | en-US-JennyNeural |
| Spanish (Spain) | es-ES | es-ES-ElviraNeural |
| French (France) | fr-FR | fr-FR-DeniseNeural |
| German (Germany) | de-DE | de-DE-KatjaNeural |
| Italian (Italy) | it-IT | it-IT-ElsaNeural |
| Portuguese (Brazil) | pt-BR | pt-BR-FranciscaNeural |
| Japanese | ja-JP | ja-JP-NanamiNeural |
| Chinese (Mandarin) | zh-CN | zh-CN-XiaoxiaoNeural |
| Korean | ko-KR | ko-KR-SunHiNeural |
| Hindi (India) | hi-IN | hi-IN-SwaraNeural |

[See all supported voices](https://learn.microsoft.com/azure/ai-services/speech-service/language-support?tabs=tts)

## Avatar Configuration

### Built-in Avatar Characters

| Character | Styles Available | Description |
|-----------|-----------------|-------------|
| lisa | casual-sitting, graceful-sitting, technical-sitting, technical-standing | Female, professional |
| james | casual-sitting, technical-sitting, technical-standing | Male, professional |
| anna | casual-sitting, graceful-sitting | Female, friendly |
| ryan | casual-sitting | Male, casual |

### Custom Avatars

Check "Custom Avatar" to use your own trained avatar model. Requires:
- Custom avatar created in Azure Speech Studio
- Avatar character ID
- Optional: Custom voice for voice sync

## API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Home page (translation interface) |
| `/translate` | GET | Translation interface |
| `/api/getIceToken` | GET | Get ICE/TURN server credentials |
| `/api/connectAvatar` | POST | Establish WebRTC connection to avatar |
| `/api/disconnectAvatar` | POST | Close avatar connection |
| `/api/speak` | POST | Speak SSML via avatar |
| `/api/translateSpeak` | POST | Start continuous translation |
| `/api/stopTranslation` | POST | Stop translation |

### Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Client → Server | Client connected |
| `join` | Client → Server | Join room for updates |
| `response` | Server → Client | Translation result |

## Architecture

```
┌─────────────────┐
│   Web Browser   │
│  (translate.js) │
└────────┬────────┘
         │ Socket.IO + WebRTC
         ↓
┌─────────────────┐
│  Flask Server   │
│    (app.py)     │
└────────┬────────┘
         │ Azure SDK
         ↓
┌─────────────────────────────────────┐
│     Azure Speech Service            │
│  - TranslationRecognizer (STT)      │
│  - SpeechSynthesizer (TTS)          │
│  - Avatar Synthesis (WebRTC)        │
└─────────────────────────────────────┘
```

## Testing Locally

### Option 1: Local Network

Access from other devices on your network:
```powershell
# Find your local IP
ipconfig

# Open in browser
http://YOUR_LOCAL_IP:5000
```

### Option 2: Dev Tunnels (Public Access)

Share with anyone using VS Code dev tunnels:

1. **In VS Code**:
   - Open **PORTS** tab
   - Click **"Forward a Port"**
   - Enter `5000`
   - Set visibility to **"Public"**

2. **Share URL**: Copy the tunnel URL (e.g., `https://abc123-5000.usw2.devtunnels.ms`)

3. **Test**: Open URL in any browser, even on mobile devices!

See `../LOCAL_TESTING.md` for detailed instructions.

## Deployment

### Deploy to Azure App Service

Use the provided deployment script:
```powershell
cd ../option1-single-app
.\deploy-azure-app-service.ps1 -ResourceGroupName "my-rg" -AppServiceName "my-translate-app"
```

### Deploy with Docker

```powershell
# Build image
docker build -t translate-app .

# Run locally
docker run -p 5000:5000 --env-file .env translate-app

# Push to Azure Container Registry
az acr login --name myregistry
docker tag translate-app myregistry.azurecr.io/translate-app:latest
docker push myregistry.azurecr.io/translate-app:latest
```

See deployment options in:
- `../option1-single-app/README.md` - Single web app deployment
- `../option3-acs-integration/README.md` - Enterprise-scale with Azure Communication Services

## Troubleshooting

### Avatar Connection Fails

**Symptoms**: "Avatar connection failed" error, no video appears

**Solutions**:
1. Verify Speech Service credentials in `.env`
2. Check Speech Service region matches your resource
3. Ensure Speech Service has Avatar feature enabled
4. Check browser console for WebRTC errors
5. Try different avatar character/style combination

### No Audio/Video Stream

**Symptoms**: Avatar connects but no video appears

**Solutions**:
1. Click **"Test Speak"** to trigger initial video
2. Check browser console for video element errors
3. Verify WebRTC connection state in logs
4. Ensure firewall allows WebRTC traffic

### Microphone Not Working

**Symptoms**: Translation doesn't start, no audio input

**Solutions**:
1. Grant microphone permissions in browser
2. Check browser requires HTTPS for mic access (use dev tunnel for testing)
3. Test microphone in Windows Sound settings
4. Try different browser (Chrome/Edge recommended)

### Translation Not Appearing

**Symptoms**: Speech recognized but no translation shown

**Solutions**:
1. Check Socket.IO connection in logs
2. Verify client ID matches in browser console
3. Ensure target language code is valid
4. Check Speech Service supports language pair

### Logs Show "ICE Connection Failed"

**Symptoms**: WebRTC ICE connection state: failed

**Solutions**:
1. Check corporate firewall/VPN isn't blocking WebRTC
2. Verify ICE/TURN server credentials are valid
3. Try from different network (mobile hotspot)
4. Check Azure Speech Service TURN servers are accessible

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SPEECH_REGION` | ✅ Yes | - | Azure Speech Service region |
| `SPEECH_KEY` | ✅ Yes | - | Azure Speech Service subscription key |
| `SPEECH_PRIVATE_ENDPOINT` | ❌ No | - | Private endpoint URL (optional) |
| `ENABLE_TOKEN_AUTH` | ❌ No | false | Use token auth instead of key |
| `ICE_SERVER_URL` | ❌ No | - | Custom TURN server URL |
| `ICE_SERVER_USERNAME` | ❌ No | - | Custom TURN server username |
| `ICE_SERVER_PASSWORD` | ❌ No | - | Custom TURN server password |
| `PORT` | ❌ No | 5000 | Server listening port |

### Avatar Configuration

| Parameter | Description | Examples |
|-----------|-------------|----------|
| Character | Avatar character ID | lisa, james, anna, ryan |
| Style | Avatar animation style | casual-sitting, technical-standing |
| Background Color | ARGB hex color | #FFFFFFFF (white), #FF000000 (black) |
| Transparent Background | Remove background | true/false |
| Video Crop | Crop to 16:9 aspect | true/false |
| Custom Avatar | Use custom trained avatar | true/false |
| Use Built-In Voice | Enable voice-face sync | true/false (custom avatars only) |

## Performance Tips

### Reduce Latency

1. **Choose nearby region**: Deploy in same region as Speech Service
2. **Use relay policy**: ICE transport policy set to 'relay' for consistent performance
3. **Optimize avatar**: Use video crop to reduce bandwidth
4. **Disable logging**: Remove verbose logging in production

### Handle Multiple Users

For production with multiple concurrent users:
1. **Use Option 1 deployment**: Includes Gunicorn for better concurrency
2. **Scale horizontally**: Add more app instances
3. **Consider ACS (Option 3)**: For 100+ concurrent users
4. **Enable caching**: Cache ICE tokens across requests

## Cost Estimation

### Azure Speech Service Costs

| Feature | Cost | Usage Example |
|---------|------|---------------|
| Speech Translation | $2.50/hour | 1 hour continuous translation |
| Neural TTS (Avatar) | $16/million chars | ~500 chars per translation |
| TURN Server | Included | Part of Avatar service |

**Example**: 10 users, 1 hour each, 200 translations:
- Translation: 10 × $2.50 = **$25**
- TTS: 200 × 500 chars × $16/1M = **$1.60**
- **Total: ~$27**

### Azure Hosting Costs

| Option | Cost/Month | Suitable For |
|--------|------------|--------------|
| App Service (B1) | ~$13 | Dev/test, <10 concurrent |
| App Service (P1V2) | ~$80 | Production, <100 concurrent |
| Container Instances | Pay per second | Variable usage |
| ACS Integration (Option 3) | $0.004/participant-min | >100 concurrent |

## Advanced Features

### Personal Voice Integration

Use your own voice with the avatar:
1. Create Personal Voice in Speech Studio
2. Get speaker profile ID
3. Set in avatar configuration
4. Avatar will speak translations in your voice!

### Custom Avatar Training

Train avatar on your appearance:
1. Record avatar training video (Speech Studio)
2. Get custom avatar ID
3. Check "Custom Avatar" in UI
4. Enter your avatar character ID

### Multi-Language Support

Add new languages:
1. Update `translate.html` language dropdowns
2. Add corresponding voice names
3. Ensure Speech Service supports language pair

## Security Best Practices

### Production Checklist

- [ ] Use Azure Key Vault for credentials
- [ ] Enable managed identity for authentication
- [ ] Use private endpoints for Speech Service
- [ ] Implement authentication (Azure AD, JWT)
- [ ] Enable HTTPS (required for production)
- [ ] Set up monitoring (Application Insights)
- [ ] Rotate keys regularly
- [ ] Implement rate limiting
- [ ] Add CORS restrictions
- [ ] Enable audit logging

### Environment Security

```powershell
# Never commit .env files
echo ".env" >> .gitignore

# Use separate keys for dev/prod
# Rotate keys after public testing
# Use read-only keys for client apps
```

## Resources

- [Azure Speech Service Documentation](https://learn.microsoft.com/azure/ai-services/speech-service/)
- [Avatar Feature Overview](https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar)
- [Speech Translation Overview](https://learn.microsoft.com/azure/ai-services/speech-service/speech-translation)
- [Supported Languages](https://learn.microsoft.com/azure/ai-services/speech-service/language-support)
- [WebRTC in Speech Service](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis-webrtc)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Azure Speech Service documentation
3. Check browser console and server logs
4. Test with different avatar/voice combinations

## License

Copyright (c) Microsoft Corporation. Licensed under the MIT license.
