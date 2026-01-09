# Speaker/Listener Mode Implementation Guide

## Overview

The translation app now supports **separate speaker and listener modes** with session-based communication:

- **Speaker Mode**: Controls translation settings, starts/stops translation, manages session. Does NOT see avatar video/audio.
- **Listener Mode**: Receives avatar video/audio and live translations. NO controls, avatar-only experience.

## Architecture

### Session-Based Communication
```
Speaker creates session → Gets unique 6-digit code → Generates listener URL
        ↓
    Speaker starts translation and speaks
        ↓
    Translation broadcast to session room via Socket.IO
        ↓
    All listeners in session receive:
        - Real-time translations
        - Avatar video/audio (WebRTC)
        - Translation history
```

### Key Components

#### Backend (app.py)
- **Session Management**: In-memory storage of active sessions
- **New Routes**:
  - `/speaker` - Speaker control interface
  - `/listener/<session_id>` - Listener interface
  - `/api/createSession` - Create translation session
  - `/api/getSession/<session_id>` - Get session details
  - `/api/startTranslation` - Start translation for session
  - `/api/connectListenerAvatar` - Connect listener to avatar
  - `/api/endSession` - End session and notify listeners
- **Socket.IO Rooms**: Session-based broadcasting

#### Frontend Files
1. **speaker.html** - Speaker control panel
2. **listener.html** - Listener avatar display
3. **static/js/speaker.js** - Speaker logic
4. **static/js/listener.js** - Listener logic with WebRTC

## Usage Flow

### 1. Speaker Creates Session

**URL**: `http://localhost:5000/speaker`

**Steps**:
1. Enter session name
2. Select source language (language you'll speak)
3. Select target language (language for translation)
4. Select voice for avatar (optional)
5. Configure avatar settings (character, style, background)
6. Click **"Create Session"**

**Result**:
- Session created with unique 6-digit code
- Listener URL generated: `http://localhost:5000/listener/123456`
- Session info card displays code and URL with copy/share buttons

### 2. Share Listener URL

**Options**:
- Click **"Copy URL"** to copy to clipboard
- Click **"Share URL"** to use Web Share API (mobile-friendly)
- Manually share URL with participants

**Listener URL Format**:
```
http://localhost:5000/listener/123456
```

### 3. Listeners Join

**URL**: `http://localhost:5000/listener/<session_id>`

**Automatic Actions**:
1. Listener opens URL in browser
2. Connects to WebRTC avatar service
3. Joins Socket.IO session room
4. Notifies speaker of presence
5. Waits for translation to start

**UI Shows**:
- Session name
- Connection status (Avatar Connected)
- Avatar video container (blank until translation starts)
- Live translation panel

### 4. Speaker Starts Translation

**Steps**:
1. Click **"Start Translation"**
2. Allow microphone access when prompted
3. Start speaking in source language

**What Happens**:
- Microphone captures audio
- Azure Speech SDK recognizes speech in source language
- Speech is translated to target language
- Translation is broadcast to ALL listeners in session room
- Each listener's avatar speaks the translation
- Both speaker and listeners see live transcriptions

**Speaker UI Shows**:
- Listener count (updates in real-time)
- Live transcriptions (source + target)
- Audio level indicator
- Translation history

**Listener UI Shows**:
- Avatar video speaking translation
- Live transcriptions (source + target)
- Animated audio indicator during speech
- Translation history with timestamps

### 5. Speaker Stops or Ends Session

**Stop Translation**:
- Click **"Stop Translation"**
- Pauses translation, keeps session active
- Listeners remain connected

**End Session**:
- Click **"End Session"**
- Terminates session completely
- Notifies all listeners
- Cleans up server resources

## API Reference

### POST /api/createSession
Creates new translation session.

**Request Body**:
```json
{
  "sessionName": "Team Meeting",
  "sourceLanguage": "en-US",
  "targetLanguage": "es-ES",
  "targetVoice": "es-ES-ElviraNeural",
  "avatarCharacter": "lisa",
  "avatarStyle": "casual-sitting",
  "backgroundColor": "#FFFFFFFF",
  "isCustomAvatar": false,
  "transparentBackground": false,
  "videoCrop": false
}
```

**Response**:
```json
{
  "sessionId": "123456",
  "listenerUrl": "http://localhost:5000/listener/123456",
  "sessionInfo": {
    "id": "123456",
    "name": "Team Meeting",
    "sourceLanguage": "en-US",
    "targetLanguage": "es-ES",
    "created_at": "2024-01-15T10:30:00",
    "active": false
  }
}
```

### GET /api/getSession/{sessionId}
Retrieves session information.

**Response**:
```json
{
  "id": "123456",
  "name": "Team Meeting",
  "sourceLanguage": "en-US",
  "targetLanguage": "es-ES",
  "targetVoice": "es-ES-ElviraNeural",
  "avatarCharacter": "lisa",
  "active": true,
  "listenerCount": 3
}
```

### POST /api/startTranslation
Starts translation for specific session.

**Request Body**:
```json
{
  "sessionId": "123456",
  "clientId": "uuid-of-speaker-client"
}
```

**Response**:
```json
{
  "status": "started",
  "sourceLanguage": "en-US",
  "targetLanguage": "es-ES",
  "message": "Translation started"
}
```

### POST /api/connectListenerAvatar
Connects listener to avatar service via WebRTC.

**Request Body**:
```json
{
  "sessionId": "123456",
  "clientId": "uuid-of-listener-client",
  "sdp": "v=0\r\no=- ... (WebRTC SDP offer)"
}
```

**Response**:
```json
{
  "sdp": "v=0\r\no=- ... (WebRTC SDP answer)"
}
```

### POST /api/endSession
Ends session and notifies all listeners.

**Request Body**:
```json
{
  "sessionId": "123456"
}
```

**Response**:
```json
{
  "status": "ended"
}
```

## Socket.IO Events

### Client → Server

#### `joinSession`
Listener joins translation session.
```javascript
socket.emit('joinSession', {
  sessionId: '123456'
});
```

#### `join`
Legacy: Join client-specific room.
```javascript
socket.emit('join', {
  room: 'client-uuid'
});
```

### Server → Client

#### `translationResult`
Real-time translation broadcast to session.
```javascript
socket.on('translationResult', (data) => {
  // data.sourceText - original speech
  // data.translatedText - translated text
  // data.sourceLanguage - source language code
  // data.targetLanguage - target language code
  // data.timestamp - ISO timestamp
});
```

#### `listenerJoined`
Notifies speaker when listener joins.
```javascript
socket.on('listenerJoined', (data) => {
  // data.sessionId - session ID
  // data.listenerCount - current listener count
});
```

#### `listenerCountUpdated`
Updates listener count for all in session.
```javascript
socket.on('listenerCountUpdated', (data) => {
  // data.count - current listener count
});
```

#### `sessionEnded`
Notifies listeners when session ends.
```javascript
socket.on('sessionEnded', (data) => {
  // data.sessionId - ended session ID
});
```

## Testing Locally

### 1. Start Server
```powershell
cd C:\Users\sudarsanl\dev-git\azure-speech\speech-avatar\production-deployment\translate-app
python app.py
```

### 2. Open Speaker Interface
```
http://localhost:5000/speaker
```

### 3. Test with Multiple Listeners

**Option A: Same Computer**
1. Open listener URL in different browser/incognito window
2. Example: Chrome (speaker) + Firefox (listener 1) + Edge (listener 2)

**Option B: Different Devices**
1. Find your local IP: `ipconfig` (look for IPv4)
2. Example: `http://192.168.1.100:5000/listener/123456`
3. Open on phone, tablet, other computer

**Option C: Dev Tunnel (Public URL)**
See `LOCAL_TESTING.md` for dev tunnel setup.

### 4. Verify Workflow
1. ✅ Speaker creates session → sees session code
2. ✅ Listener opens URL → connects to avatar
3. ✅ Speaker sees listener count increase
4. ✅ Speaker starts translation → speaks
5. ✅ Listener sees avatar speak translation
6. ✅ Both see live transcriptions
7. ✅ Speaker stops translation → avatar stops
8. ✅ Speaker ends session → listener notified

## Troubleshooting

### Listener Can't Connect to Avatar
**Symptoms**: "Connecting to avatar..." never completes

**Solutions**:
1. Check session ID in URL is valid
2. Verify speaker created session first
3. Check browser console for WebRTC errors
4. Try HTTPS dev tunnel (WebRTC requires secure context)

### No Audio in Listener Browser
**Symptoms**: Avatar appears but no sound

**Solutions**:
1. Check browser audio permissions
2. Unmute browser tab
3. Verify system volume
4. Check Azure Speech service quota

### Listener Count Not Updating
**Symptoms**: Speaker doesn't see listener join

**Solutions**:
1. Check Socket.IO connection in browser console
2. Verify listener called `socket.emit('joinSession')`
3. Check server logs for join events

### Translation Not Broadcasting
**Symptoms**: Speaker sees translation, listener doesn't

**Solutions**:
1. Verify both joined same session ID
2. Check Socket.IO room membership
3. Inspect network tab for Socket.IO messages
4. Check server logs for broadcast events

### Session Not Found Error
**Symptoms**: 404 error when accessing listener URL

**Solutions**:
1. Verify session was created successfully
2. Check session ID matches exactly (case-sensitive)
3. Note: Sessions are in-memory, restart clears them
4. For production, use Redis/database for persistence

## Performance Considerations

### Bandwidth
- **Speaker**: Microphone audio upload (~10-50 KB/s)
- **Listener**: Avatar video download (~100-200 KB/s)
- **Multiple Listeners**: Server bandwidth scales linearly

### Latency
- Speech recognition: ~500-1000ms
- Translation: ~100-200ms
- Avatar synthesis: ~200-500ms
- **Total End-to-End**: ~1-2 seconds

### Scaling
- **Current**: In-memory sessions (single server)
- **Production**: Use Redis for session storage, load balancer for multiple servers
- **Listeners**: Each listener gets individual WebRTC connection to Azure
- **Recommendation**: 10-50 concurrent listeners per server

## Security Notes

### Session Codes
- 6-digit codes (1 million combinations)
- No authentication required
- Anyone with URL can join as listener
- **For Production**: Add authentication, password-protected sessions

### HTTPS Required
- Microphone access requires HTTPS (except localhost)
- WebRTC prefers HTTPS for security
- Use dev tunnel or reverse proxy for public access

### Environment Variables
Never commit `.env` file with real credentials:
```bash
SPEECH_KEY=your-key
SPEECH_REGION=your-region
```

## Next Steps

### Feature Enhancements
1. **Session Persistence**: Store sessions in Redis/database
2. **Authentication**: Require login for speaker, optional for listener
3. **Session Passwords**: Protect sessions with codes
4. **Recording**: Save translation history to file
5. **Chat**: Allow listeners to send messages to speaker
6. **Multiple Speakers**: Support multiple speakers in one session
7. **Speaker Video**: Add webcam for speaker (separate from avatar)

### Deployment Options
- Azure App Service (see `README.md`)
- Docker container (see `Dockerfile`)
- Azure Container Apps
- Kubernetes (for high scale)

## Support

For issues or questions:
1. Check server logs in terminal
2. Check browser console (F12)
3. Review Azure Speech service quota/limits
4. Test with single listener first
5. Verify environment variables are set

## License

Microsoft MIT License - See LICENSE.md for details.
