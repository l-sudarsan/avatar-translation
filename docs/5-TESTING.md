# Testing

> **Status**: ✅ Local deployment tested | ⏳ Cloud deployment testing pending

## Pre-Test Setup

- [ ] Azure Speech resource configured (`.env` file)
  - [ ] `SPEECH_KEY` set
  - [ ] `SPEECH_REGION` set
- [ ] Python dependencies installed (`pip install -r requirements.txt`)
- [ ] Server running (`python -m flask run --host=0.0.0.0 --port=5000`)
- [ ] Server shows: "Listening on http://0.0.0.0:5000"

> ⚠️ **Audio Feedback Warning**: Do not run speaker and listener on the same device during testing. The microphone will pick up the avatar's audio output, causing feedback. Use Dev Tunnels and test the listener on a separate device (phone, tablet, or another computer).

---

## Test 1: Speaker Session Creation

**URL**: `http://localhost:5000/speaker`

### Steps
1. [ ] Open speaker interface in Chrome
2. [ ] Fill in session details:
   - [ ] Session name: "Test Session 1"
   - [ ] Source language: English (United States)
   - [ ] Target language: Spanish (Spain)
   - [ ] Voice: es-ES-ElviraNeural (or default)
3. [ ] Click "Create Session" button

### Expected Results
- [ ] Session info card appears
- [ ] Session code displayed (6 digits)
- [ ] Listener URL shown
- [ ] "Copy URL" button works
- [ ] "Share URL" button available (may require HTTPS)
- [ ] Listener count shows "0 listeners"
- [ ] "Start Translation" button enabled

---

## Test 2: Listener Joins Session

**URL**: Copy from speaker interface

### Steps
1. [ ] Copy listener URL from speaker interface
2. [ ] Open in Firefox (different browser)
3. [ ] Paste URL and press Enter

### Expected Results - Listener
- [ ] Page loads with session name
- [ ] "Connecting to avatar..." message appears
- [ ] Avatar connection succeeds
- [ ] Status changes to "Avatar Connected ✅"
- [ ] Avatar video container appears (black/blank)
- [ ] Live Translation panel visible
- [ ] No control buttons (read-only interface)

### Expected Results - Speaker
- [ ] Listener count updates to "1 listener"
- [ ] Count increases in real-time

---

## Test 3: Multiple Listeners

### Steps
1. [ ] Open listener URL in Edge (3rd browser)
2. [ ] Open listener URL in Chrome incognito

### Expected Results
- [ ] Speaker shows "3 listeners"
- [ ] Each listener connects independently
- [ ] All listeners see "Avatar Connected ✅"

---

## Test 4: Start Translation

**Browser**: Chrome (speaker)

### Steps
1. [ ] Click "Start Translation" button
2. [ ] Allow microphone access when prompted
3. [ ] Speak clearly in English: "Hello, how are you today?"
4. [ ] Wait 1-2 seconds for processing

### Expected Results - Speaker
- [ ] Button changes to "Stop Translation"
- [ ] Microphone indicator appears
- [ ] Audio level bar animates when speaking
- [ ] Source Text box shows: "Hello, how are you today?"
- [ ] Target Text box shows Spanish translation
- [ ] Translation added to history
- [ ] **NO avatar video/audio in speaker view**

### Expected Results - Each Listener
- [ ] Avatar video appears and starts speaking
- [ ] Avatar speaks Spanish translation
- [ ] Source Text shows English
- [ ] Target Text shows Spanish
- [ ] Translation added to history with timestamp
- [ ] Audio indicator animates during avatar speech

---

## Test 5: Continuous Translation

### Steps
1. [ ] Continue speaking multiple sentences:
   - [ ] "My name is John."
   - [ ] "I live in Seattle."
   - [ ] "The weather is nice today."
2. [ ] Pause between sentences (2-3 seconds)

### Expected Results
- [ ] Each sentence translated separately
- [ ] All listeners receive all translations
- [ ] History builds up chronologically
- [ ] Avatar speaks each translation sequentially
- [ ] No translations are missed

---

## Test 6: Stop Translation

### Steps
1. [ ] Click "Stop Translation" in speaker view
2. [ ] Try speaking again

### Expected Results
- [ ] Translation stops immediately
- [ ] Button changes back to "Start Translation"
- [ ] Microphone indicator disappears
- [ ] Speaking does not produce translations
- [ ] Listeners remain connected
- [ ] Session still active

---

## Test 7: Restart Translation

### Steps
1. [ ] Click "Start Translation" again
2. [ ] Speak: "This is a second test."

### Expected Results
- [ ] Translation resumes
- [ ] All listeners receive new translations
- [ ] History continues (not cleared)
- [ ] Avatar works normally

---

## Test 8: Listener Disconnects

### Steps
1. [ ] Close one listener browser (Edge)
2. [ ] Check speaker interface

### Expected Results
- [ ] Speaker listener count decreases by 1
- [ ] Remaining listeners unaffected
- [ ] Translation continues normally

---

## Test 9: End Session

### Steps
1. [ ] Click "End Session" in speaker view
2. [ ] Check remaining listener browsers

### Expected Results - Speaker
- [ ] Session ends immediately
- [ ] UI resets to initial state
- [ ] Session info card cleared

### Expected Results - Listeners
- [ ] "Session ended by speaker" notification appears
- [ ] Avatar connection closes
- [ ] Translation stops
- [ ] Cannot reconnect (session no longer exists)

---

## Test 10: Error Handling

### Test 10a: Invalid Session URL
- [ ] Open `http://localhost:5000/listener/999999` (fake ID)
- [ ] Expected: "Session not found" error (404)

### Test 10b: Listener Before Speaker
- [ ] Create new session (speaker)
- [ ] Copy listener URL but DON'T start translation
- [ ] Listener opens URL
- [ ] Expected: Listener connects, avatar ready, waits for speaker

### Test 10c: Microphone Denied
- [ ] Create session
- [ ] Start translation
- [ ] Deny microphone permission
- [ ] Expected: Error message, graceful handling

### Test 10d: No Audio Output
- [ ] Mute listener browser tab
- [ ] Expected: Avatar video plays, no sound (expected behavior)

---

## Test 11: Cross-Device Testing

### Option A: Local Network
1. [ ] Find local IP: `ipconfig` (Windows)
2. [ ] Use `http://192.168.x.x:5000/listener/123456` on phone
3. [ ] Test translation from desktop to phone

### Option B: Dev Tunnel (if configured)
1. [ ] Use public HTTPS URL from dev tunnel
2. [ ] Share with remote participant
3. [ ] Test over internet

### Expected Results
- [ ] Works same as localhost
- [ ] May have slightly higher latency
- [ ] HTTPS required for microphone on non-localhost

---

## Test 12: Performance Testing

### Steps
1. [ ] Open 5+ listener tabs/browsers
2. [ ] Start translation
3. [ ] Speak continuously for 1 minute

### Monitor
- [ ] Server CPU usage (Task Manager)
- [ ] Network bandwidth
- [ ] Browser memory
- [ ] Any dropped translations

### Expected Results
- [ ] All listeners receive translations
- [ ] No significant delays (<2 seconds)
- [ ] No errors in server logs
- [ ] Smooth avatar playback

---

## Test 13: Different Languages

### Test 13a: English → French
- [ ] Source: en-US
- [ ] Target: fr-FR
- [ ] Voice: fr-FR-DeniseNeural
- [ ] Test phrase: "Good morning, welcome to the meeting."

### Test 13b: Spanish → English
- [ ] Source: es-ES
- [ ] Target: en-US  
- [ ] Voice: en-US-JennyNeural
- [ ] Test phrase: "Buenos días, ¿cómo está usted?"

### Expected Results
- [ ] Translation accuracy good
- [ ] Avatar voice matches language
- [ ] Correct accents and pronunciation

---

## Test 14: Edge Cases

### Test 14a: Very Long Speech
- [ ] Speak continuously for 30+ seconds
- [ ] Expected: Breaks into multiple translations

### Test 14b: Rapid Speech
- [ ] Speak very quickly
- [ ] Expected: May miss some words, but processes what it can

### Test 14c: Background Noise
- [ ] Play music/noise in background
- [ ] Expected: Translation quality may degrade

### Test 14d: Silent Period
- [ ] Start translation but don't speak for 1 minute
- [ ] Expected: No errors, waits patiently

---

## Basic Functionality Checklist

- [ ] Server starts without errors
- [ ] Can access pages via URL
- [ ] Socket.IO connects (check browser console)
- [ ] WebRTC connection establishes
- [ ] Avatar video appears

## Translation Features Checklist

- [ ] Microphone access granted
- [ ] Speech recognition works
- [ ] Translation appears in real-time
- [ ] Live transcription boxes update
- [ ] Translation history shows entries

## Multi-User Testing Checklist

- [ ] Create session successfully
- [ ] Generate listener join link
- [ ] Listener can join from different device
- [ ] Listener sees translations in real-time
- [ ] Multiple listeners work simultaneously
- [ ] Session cleanup works properly

---

## Troubleshooting Common Issues

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

### WebRTC Connection Fails
**Symptoms**: "ICE connection state: failed", avatar doesn't appear

**Solutions**:
1. Check if ICE token is being fetched
2. Verify TURN servers are accessible
3. Test from different network (corporate VPNs may block WebRTC)

### Socket.IO Won't Connect
**Symptoms**: "Socket.IO disconnected" in logs

**Solutions**:
```python
# In app.py, add more verbose logging
socketio = SocketIO(app, 
                    cors_allowed_origins="*",
                    logger=True,
                    engineio_logger=True)
```

---

## Test Results Summary

**Date**: _______________
**Tester**: _______________

**Overall Status**:
- [ ] All tests passed
- [ ] Minor issues (document below)
- [ ] Major issues (document below)

**Issues Found**:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Notes**:
_______________________________________________

---

## Success Criteria

✅ **Ready for Production** if:
- All core tests (1-9) pass
- At least one cross-device test passes
- No critical errors in logs
- Performance acceptable with 5+ listeners

⚠️ **Needs Work** if:
- Core functionality works but has issues
- Performance problems with multiple listeners
- Frequent errors in logs

❌ **Not Ready** if:
- Cannot create sessions
- Listeners cannot connect
- Translation doesn't work
- Frequent crashes

---

## Success Indicators

You'll know it's working when:
- ✅ Listener count shows connected users
- ✅ Avatar appears and speaks in listener view
- ✅ Translations appear in real-time
- ✅ History builds up correctly
- ✅ No errors in console

---

## Next Steps After Testing

1. Review server logs for warnings
2. Check Azure Speech service usage/quota
3. Document any custom configuration needed
4. Plan for production deployment (see `3-SETUP-AZURE.md`)
5. Create user documentation based on real usage
