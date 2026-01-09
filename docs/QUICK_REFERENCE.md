# Quick Reference - Speaker/Listener Mode

## 🚀 Quick Start (5 Minutes)

### 1. Start Server
```powershell
cd production-deployment\translate-app
python app.py
```

### 2. Speaker Opens
```
http://localhost:5000/speaker
```

### 3. Create Session
1. Fill in session name
2. Select languages
3. Click "Create Session"
4. **Copy listener URL**

### 4. Share URL
Send listener URL to participants:
```
http://localhost:5000/listener/123456
```

### 5. Start Translation
1. Click "Start Translation"
2. Allow microphone
3. **Start speaking!**

---

## 📝 Speaker Checklist

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

## 👥 Listener Experience

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

## 🎯 Common Scenarios

### Presentation to Remote Audience
```
Speaker: Presents in English
Listeners (5-50): See avatar speaking Spanish translation
Perfect for: Webinars, conferences, training
```

### One-on-One Translation
```
Speaker: Explains concept in German
Listener (1): Watches avatar speak French
Perfect for: Meetings, consultations, lessons
```

### Multi-Lingual Teams
```
Speaker: Gives update in Japanese
Listeners (3): English, French, Spanish translations
Perfect for: Team meetings, standups
Note: Create separate sessions for each target language
```

---

## 🔧 Configuration Options

### Languages
| Common Pairs | Source | Target |
|-------------|--------|--------|
| English → Spanish | en-US | es-ES |
| Spanish → English | es-ES | en-US |
| English → French | en-US | fr-FR |
| English → German | en-US | de-DE |
| English → Japanese | en-US | ja-JP |

### Avatar Characters
- **lisa** - Professional, casual
- **james** - Business, formal
- **Custom** - Your trained avatar

### Avatar Styles
- **casual-sitting** - Relaxed
- **technical-standing** - Professional
- **formal-sitting** - Business

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| No microphone access | Check browser permissions, reload page |
| Avatar not connecting | Wait 10 seconds, check session ID is valid |
| No translation | Verify speaker started translation, check mic |
| Listener count wrong | Refresh page, check Socket.IO connection |
| Session not found | Verify session ID, may have been ended |

---

## 📊 Performance Tips

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

## 🌐 Remote Access

### Option 1: Local Network (Same WiFi)
1. Find IP: `ipconfig` → Look for IPv4 (e.g., 192.168.1.100)
2. Use: `http://192.168.1.100:5000/speaker`
3. Share: `http://192.168.1.100:5000/listener/123456`

### Option 2: Dev Tunnel (Internet)
```powershell
# VS Code: Forward port 5000, make Public
# Or use: devtunnel host -p 5000 --allow-anonymous
```
Get HTTPS URL like: `https://abc123.devtunnels.ms/speaker`

---

## 📱 Mobile Support

### Listeners on Mobile
✅ **Works great!**
- Open listener URL in Safari/Chrome
- Avatar plays smoothly
- Translations display correctly

### Speaker on Mobile
⚠️ **Limited support**
- Microphone works
- UI may be cramped
- Desktop recommended

---

## 🔐 Security Notes

### Session Codes
- 6-digit numbers (e.g., 123456)
- Random generation
- No password protection (yet)
- Anyone with URL can join

### Recommendations
- ✅ Use unique sessions per meeting
- ✅ End session when done (cleanup)
- ✅ Use HTTPS in production
- ❌ Don't share listener URLs publicly
- ❌ Don't reuse session codes

---

## ⚡ Keyboard Shortcuts

### Speaker
- `Ctrl+C` - Copy listener URL (when focused)
- `Ctrl+Enter` - Start/Stop translation (future)

### Listener
- `F11` - Fullscreen mode (recommended!)
- `Esc` - Exit fullscreen

---

## 📏 Latency Expectations

| Stage | Time | Total |
|-------|------|-------|
| Microphone → Azure | ~200ms | 200ms |
| Speech Recognition | ~500ms | 700ms |
| Translation | ~100ms | 800ms |
| Avatar Synthesis | ~300ms | 1100ms |
| Network to Listener | ~100ms | **~1.2s** |

**Normal delay**: 1-2 seconds end-to-end

---

## 🎓 Best Practices

### Before Session
1. Test microphone and audio
2. Close unnecessary applications
3. Charge laptop (if battery)
4. Prepare content to translate
5. Send listener URL in advance

### During Session
1. Speak in complete sentences
2. Pause between thoughts
3. Avoid "um", "uh" filler words
4. Check listener count periodically
5. Monitor translation quality

### After Session
1. End session properly
2. Check translation history
3. Note any issues for next time
4. Export logs if needed

---

## 📞 Support

### Self-Help
1. Check `TESTING_CHECKLIST.md`
2. Review `SPEAKER_LISTENER_GUIDE.md`
3. Check browser console (F12)
4. Review server logs

### Common Questions

**Q: How many listeners can join?**
A: Tested with 5-10, should work with 20-50 depending on bandwidth

**Q: Can listeners join mid-session?**
A: Yes! They'll see new translations immediately

**Q: Can I switch languages mid-session?**
A: No, create new session for different language pair

**Q: Are translations saved?**
A: Only in browser history, not on server (yet)

**Q: Can I use custom avatars?**
A: Yes! Check "Custom Avatar" and provide character name

---

## 🎉 Success Indicators

You'll know it's working when:
- ✅ Listener count shows connected users
- ✅ Avatar appears and speaks in listener view
- ✅ Translations appear in real-time
- ✅ History builds up correctly
- ✅ No errors in console

---

## 🔗 Quick Links

- **Full Guide**: `SPEAKER_LISTENER_GUIDE.md`
- **Testing**: `TESTING_CHECKLIST.md`
- **Implementation**: `IMPLEMENTATION_SUMMARY.md`
- **README**: `README.md`

---

**Made with ❤️ using Azure Speech Services**
