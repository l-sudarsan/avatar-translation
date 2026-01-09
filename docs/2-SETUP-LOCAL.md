# Setup Local

> **Status**: ✅ Local deployment tested | ⏳ Cloud deployment testing pending

## Prerequisites

- Python 3.11+
- Azure Speech resource configured
- Visual Studio Code (recommended)

## Quick Start (5 Minutes)

### Step 1: Install Dependencies and activate
Create and activate virtual environment
```powershell
cd avatar-translation
python -m venv venv
.\venv\Scripts\Activate 
```
```powershell
pip install -r requirements.txt
```

### Step 2: Configure Environment

Create a `.env` file with your Azure credentials:

```bash
SPEECH_REGION=your-region
SPEECH_KEY=your-key
```

### Step 3: Start Server

```powershell
python -m flask run --host=0.0.0.0 --port=5000
```

Server shows: "Listening on http://0.0.0.0:5000"

### Step 4: Open Speaker Interface

```
http://localhost:5000/speaker
```

### Step 5: Create Session

1. Fill in session name
2. Select source/target languages
3. Click "Create Session"
4. **Copy listener URL**

### Step 6: Share URL with Participants

> ⚠️ **Important**: Do not run speaker and listener on the same device. The microphone will pick up the avatar's audio output, causing a feedback loop. Use Dev Tunnels (see below) and open the listener URL on a separate device (phone, tablet, or another computer) for the best experience.

```
eg 
http://localhost:5000/listener/123456
```

### Step 7: Wait for Avatar Connection

1. Open the listener URL in a browser (or share with participants)
2. **Wait for the avatar video to appear** — this takes a few seconds
3. The avatar is ready when you see the video feed in the listener window

> 📋 **Important**: Do not start speaking until the avatar is connected. The listener needs the avatar ready to display translated speech.

### Step 8: Start Translation

1. Click "Start Translation"
2. Allow microphone access
3. **Start speaking!**

---

## Remote Access Options

### Option 1: Local Network (Same WiFi)

1. Find your IP:
   ```powershell
   ipconfig
   ```
   Look for IPv4 (e.g., `192.168.1.100`)

2. Use: `http://192.168.1.100:5000/speaker`
3. Share: `http://192.168.1.100:5000/listener/123456`

### Option 2: VS Code Dev Tunnel (Recommended)

1. **Start Flask server**:
   ```powershell
   python -m flask run --host=0.0.0.0 --port=5000
   ```

2. **Forward Port in VS Code**:
   - Open **PORTS** tab (View > Command Palette > "Ports: Focus on Ports View")
   - Click **"Forward a Port"**
   - Type: `5000` and press Enter
   - Right-click → **Port Visibility** → **Public**
   - Copy the tunnel URL (e.g., `https://abc123-5000.usw2.devtunnels.ms`)

3. **Access Your App**:
   - Speaker: `https://your-tunnel-url/speaker`
   - Listener: `https://your-tunnel-url/listener/123456`

### Option 3: Azure CLI Dev Tunnels

```powershell
# Install dev tunnels
az extension add --name dev-tunnels

# Login to Azure
az login

# Create a tunnel
devtunnel create --allow-anonymous

# Start port forwarding (new terminal)
devtunnel port create <tunnel-id> -p 5000
devtunnel host <tunnel-id>
```

### Option 4: ngrok

```powershell
# Install ngrok
choco install ngrok

# Create tunnel (in new terminal)
ngrok http 5000
```

---

## Testing with Multiple Listeners

### Same Computer

Open listener URL in different browsers:
- Chrome (speaker)
- Firefox (listener 1)
- Edge (listener 2)
- Chrome Incognito (listener 3)

### Different Devices

1. Use local network IP or dev tunnel URL
2. Open listener URL on phone, tablet, other computer

### Verify Workflow

1. ✅ Speaker creates session → sees session code
2. ✅ Listener opens URL → connects to avatar
3. ✅ Speaker sees listener count increase
4. ✅ Speaker starts translation → speaks
5. ✅ Listener sees avatar speak translation
6. ✅ Both see live transcriptions
7. ✅ Speaker stops translation → avatar stops
8. ✅ Speaker ends session → listener notified

---

## Configuration for Dev Tunnels

### Update app.py for Better Local Testing

Add CORS and proxy support:

```python
# Enable CORS for dev tunnels
from flask_cors import CORS
CORS(app, resources={r"/*": {"origins": "*"}})

# Trust dev tunnel proxy headers
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
```

Install CORS:
```powershell
pip install flask-cors
```

### Configure Socket.IO

```python
socketio = SocketIO(app, 
                    cors_allowed_origins="*",
                    async_mode='eventlet')
```

---

## Troubleshooting

### Port Already in Use

```powershell
# Find what's using port 5000
netstat -ano | findstr :5000

# Kill the process
Stop-Process -Id <PID> -Force

# Or use different port
python -m flask run --host=0.0.0.0 --port=5001
```

### WebRTC Not Working

- Dev tunnels provide HTTPS (required for WebRTC) ✅
- Microphone access requires HTTPS ✅
- Check browser console for errors
- Try different browser (Chrome/Edge recommended)

### Socket.IO Not Connecting

Make sure server is listening on `0.0.0.0` not `127.0.0.1`:
```powershell
python -m flask run --host=0.0.0.0 --port=5000
```

### Microphone Access Denied

1. Dev tunnels provide HTTPS automatically ✅
2. Click lock icon → Site settings → Allow microphone
3. Test microphone in Windows Sound settings

### "Connection Reset" or 502 Errors

```powershell
# 1. Ensure Flask is on 0.0.0.0
python -m flask run --host=0.0.0.0 --port=5000

# 2. Check Windows Firewall
New-NetFirewallRule -DisplayName "Flask Dev" -Direction Inbound -Port 5000 -Protocol TCP -Action Allow

# 3. Restart the tunnel in VS Code
```

---

## Performance Tips

### For Best Quality

- ✅ Use wired headset/microphone
- ✅ Quiet environment
- ✅ Speak clearly, moderate pace
- ✅ Pause between sentences
- ❌ Avoid background music/noise

### For Best Performance

- ✅ Close unused browser tabs
- ✅ Use wired network (not WiFi)
- ✅ Chrome/Edge recommended
- ✅ Keep listener count <20 per session
- ❌ Don't use VPN if possible

---

## Speaker Checklist

- [ ] Create session
- [ ] Configure languages (source/target)
- [ ] Copy listener URL
- [ ] Share URL with participants
- [ ] Wait for listeners to join (see count)
- [ ] Click "Start Translation"
- [ ] Speak clearly into microphone
- [ ] Monitor listener count
- [ ] Check live transcriptions
- [ ] End session when done

---

## Listener Experience

**URL**: `http://localhost:5000/listener/<session_id>`

**What Listeners See**:
- ✅ Avatar video speaking translation
- ✅ Live transcriptions (source + target)
- ✅ Translation history
- ✅ Audio indicator during speech
- ❌ NO controls (read-only)

**What Listeners Do**:
1. Open URL
2. Wait for avatar connection
3. Listen and watch!

---

## Security Notes for Dev Tunnels

⚠️ **Important**: Dev tunnels expose your local machine to the internet

1. **Only run during testing**: Stop tunnel when not needed
2. **Use temporary credentials**: Don't use production keys
3. **Monitor access logs**: Check who's accessing your tunnel
4. **Public vs Private**: Use "Private" visibility for internal testing

---

## Useful Commands

```powershell
# Start Flask server
python -m flask run --host=0.0.0.0 --port=5000

# Start with different port
python -m flask run --host=0.0.0.0 --port=5001

# Check what's using port 5000
netstat -ano | findstr :5000

# Kill process on port 5000
Stop-Process -Id <PID> -Force

# VS Code: Forward port
Ctrl+Shift+P → "Forward a Port"

# Test if server is accessible
curl http://localhost:5000/api/getStatus
```
