/**
 * Speaker Mode - Translation Control
 * Handles session creation, translation control, and listener management
 */

// Global state
let clientId;
let sessionId;
let socket;
let translationActive = false;
let sessionActive = false;
let audioLevelInterval;

// Audio streaming state
let mediaStream = null;
let audioContext = null;
let audioWorkletNode = null;
let mediaStreamSource = null;

/**
 * Initialize the speaker application
 */
function initializeApp() {
    clientId = document.getElementById('clientId').value;
    sessionId = document.getElementById('sessionId').value;
    log('Speaker mode initialized');
    initializeSocketIO();
}

/**
 * Log message to UI and console
 */
function log(message) {
    const timestamp = new Date().toISOString();
    const loggingElement = document.getElementById('logging');
    loggingElement.innerHTML = `[${timestamp}] ${message}\n` + loggingElement.innerHTML;
    console.log(`[${timestamp}] ${message}`);
}

/**
 * Initialize Socket.IO connection
 */
function initializeSocketIO() {
    socket = io();
    
    socket.on('connect', () => {
        log('Socket.IO connected');
        socket.emit('join', { room: sessionId });
    });
    
    socket.on('disconnect', () => {
        log('Socket.IO disconnected');
    });
    
    socket.on('response', (data) => {
        if (data.path === 'api.translation') {
            handleTranslationResponse(data);
        } else if (data.path === 'api.listenerUpdate') {
            updateListenerCount(data.listenerCount);
        }
    });
}

/**
 * Handle incoming translation responses
 */
function handleTranslationResponse(data) {
    log(`Translation: ${data.sourceText} → ${data.translatedText}`);
    
    // Update live transcription
    document.getElementById('sourceTranscription').innerHTML = 
        `<p style="margin: 0; font-size: 14px;"><strong>${data.sourceLanguage}:</strong> ${data.sourceText}</p>`;
    document.getElementById('targetTranscription').innerHTML = 
        `<p style="margin: 0; font-size: 14px;"><strong>${data.targetLanguage}:</strong> ${data.translatedText}</p>`;
    
    // Add to history
    addTranslationResult(data.sourceText, data.translatedText, data.sourceLanguage, data.targetLanguage);
}

/**
 * Update listener count display
 */
function updateListenerCount(count) {
    document.getElementById('listenerCount').textContent = count;
    const statusDot = document.getElementById('statusDot');
    if (count > 0) {
        statusDot.className = 'status-indicator status-active';
    } else {
        statusDot.className = 'status-indicator status-inactive';
    }
}

/**
 * Add translation result to history
 */
function addTranslationResult(sourceText, translatedText, sourceLang, targetLang) {
    const resultsDiv = document.getElementById('translationResults');
    const resultEntry = document.createElement('div');
    resultEntry.style.marginBottom = '15px';
    resultEntry.style.padding = '10px';
    resultEntry.style.backgroundColor = '#fff';
    resultEntry.style.borderLeft = '3px solid #4CAF50';
    
    resultEntry.innerHTML = `
        <div style="color: #666; font-size: 12px; margin-bottom: 5px;">
            ${new Date().toLocaleTimeString()} | ${sourceLang} → ${targetLang}
        </div>
        <div style="margin-bottom: 5px;">
            <strong>Original:</strong> ${sourceText}
        </div>
        <div style="color: #2196F3;">
            <strong>Translated:</strong> ${translatedText}
        </div>
    `;
    
    resultsDiv.insertBefore(resultEntry, resultsDiv.firstChild);
}

/**
 * Simulate audio level animation
 */
function updateAudioLevel() {
    const bar = document.getElementById('audioLevelBar');
    const randomLevel = Math.random() * 60 + 20;
    bar.style.width = randomLevel + '%';
}

/**
 * Get avatar configuration from UI
 */
function getAvatarConfig() {
    const isCustom = document.getElementById('customizedAvatar').checked;
    return {
        character: document.getElementById('talkingAvatarCharacter').value,
        style: document.getElementById('talkingAvatarStyle').value,
        isCustomAvatar: isCustom,
        useBuiltInVoice: isCustom ? document.getElementById('useBuiltInVoice').checked : false,
        backgroundColor: document.getElementById('backgroundColor').value,
        transparentBackground: document.getElementById('transparentBackground').checked,
        videoCrop: document.getElementById('videoCrop').checked
    };
}

/**
 * Get translation configuration
 */
function getTranslationConfig() {
    return {
        sessionName: document.getElementById('sessionName').value,
        sourceLanguage: document.getElementById('sourceLanguage').value,
        targetLanguage: document.getElementById('targetLanguage').value,
        targetVoice: document.getElementById('targetVoice').value
    };
}

/**
 * Create a new translation session
 */
async function createSession() {
    log('Creating translation session...');
    
    const config = getTranslationConfig();
    const avatarConfig = getAvatarConfig();
    
    try {
        const response = await fetch('/api/createSession', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ClientId': clientId
            },
            body: JSON.stringify({
                sessionName: config.sessionName,
                sourceLanguage: config.sourceLanguage,
                targetLanguage: config.targetLanguage,
                targetVoice: config.targetVoice,
                avatarCharacter: avatarConfig.character,
                avatarStyle: avatarConfig.style,
                isCustomAvatar: avatarConfig.isCustomAvatar,
                useBuiltInVoice: avatarConfig.useBuiltInVoice,
                backgroundColor: avatarConfig.backgroundColor,
                transparentBackground: avatarConfig.transparentBackground,
                videoCrop: avatarConfig.videoCrop
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            sessionId = result.sessionId;
            document.getElementById('sessionId').value = sessionId;
            
            // Normalize info from backend (handle both old and new API response formats)
            const sessionCodeValue = result.sessionCode || result.sessionId || '------';
            const listenerUrlValue = (result.listenerUrl || `${window.location.origin}/listener/${sessionId}`)
                .replace(/^http:/, 'https:');
            
            // Update session info display
            document.getElementById('sessionInfo').style.display = 'block';
            document.getElementById('sessionCode').textContent = sessionCodeValue;
            document.getElementById('listenerUrl').textContent = listenerUrlValue;
            document.getElementById('copyBtn').disabled = false;
            document.getElementById('shareBtn').disabled = false;
            
            // Join the session room
            socket.emit('join', { room: sessionId });
            
            sessionActive = true;
            updateUIState('sessionCreated');
            
            log(`✅ Session created: ${sessionCodeValue}`);
            log(`Listener URL: ${listenerUrlValue}`);
        } else {
            log(`❌ Failed to create session: ${result.error}`);
            alert(`Failed to create session: ${result.error}`);
        }
    } catch (error) {
        log(`Error creating session: ${error.message}`);
        alert(`Error: ${error.message}`);
    }
}

/**
 * Start translation
 */
async function startTranslation() {
    if (!sessionActive) {
        log('Please create a session first');
        alert('Please create a session first');
        return;
    }
    
    const config = getTranslationConfig();
    log(`Starting translation: ${config.sourceLanguage} → ${config.targetLanguage}`);
    
    try {
        // First, request microphone access from the browser
        log('Requesting microphone access...');
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            } 
        });
        log('✅ Microphone access granted');
        
        // Initialize audio context for streaming
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        mediaStreamSource = audioContext.createMediaStreamSource(mediaStream);
        
        // Create script processor for audio data (deprecated but widely supported)
        const bufferSize = 4096;
        const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        scriptProcessor.onaudioprocess = (event) => {
            if (!translationActive) return;
            
            const inputData = event.inputBuffer.getChannelData(0);
            // Convert float32 to int16
            const int16Data = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                int16Data[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)));
            }
            
            // Send audio data via Socket.IO
            socket.emit('audioData', {
                sessionId: sessionId,
                clientId: clientId,
                audio: Array.from(int16Data)
            });
        };
        
        mediaStreamSource.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
        
        // Store for cleanup
        audioWorkletNode = scriptProcessor;
        
        // Start server-side translation with streaming mode
        const response = await fetch('/api/startTranslation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ClientId': clientId
            },
            body: JSON.stringify({
                sessionId: sessionId,
                sourceLanguage: config.sourceLanguage,
                targetLanguage: config.targetLanguage,
                targetVoice: config.targetVoice,
                useStreaming: true  // Enable streaming mode
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            log('✅ Translation started - speak into your microphone');
            translationActive = true;
            updateUIState('translationStarted');
            
            // Start audio level animation
            audioLevelInterval = setInterval(updateAudioLevel, 200);
        } else {
            log(`❌ Failed to start translation: ${result.error}`);
            alert(`Failed: ${result.error}`);
            stopAudioCapture();
        }
    } catch (error) {
        log(`Error starting translation: ${error.message}`);
        if (error.name === 'NotAllowedError') {
            alert('Microphone access denied. Please allow microphone access and try again.');
        } else {
            alert(`Error: ${error.message}`);
        }
        stopAudioCapture();
    }
}

/**
 * Stop audio capture and cleanup resources
 */
function stopAudioCapture() {
    if (audioWorkletNode) {
        audioWorkletNode.disconnect();
        audioWorkletNode = null;
    }
    if (mediaStreamSource) {
        mediaStreamSource.disconnect();
        mediaStreamSource = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

/**
 * Stop translation
 */
async function stopTranslation() {
    log('Stopping translation...');
    
    // Stop audio capture first
    stopAudioCapture();
    
    try {
        const response = await fetch('/api/stopTranslation', {
            method: 'POST',
            headers: {
                'ClientId': clientId
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            log('✅ Translation stopped');
            translationActive = false;
            updateUIState('translationStopped');
            
            // Stop audio level animation
            if (audioLevelInterval) {
                clearInterval(audioLevelInterval);
                audioLevelInterval = null;
            }
            document.getElementById('audioLevelBar').style.width = '0%';
        } else {
            log(`❌ Failed to stop translation: ${result.error}`);
        }
    } catch (error) {
        log(`Error stopping translation: ${error.message}`);
    }
}

/**
 * End the session
 */
async function endSession() {
    if (!confirm('Are you sure you want to end this session? All listeners will be disconnected.')) {
        return;
    }
    
    log('Ending session...');
    
    // Stop translation if active
    if (translationActive) {
        await stopTranslation();
    }
    
    try {
        const response = await fetch('/api/endSession', {
            method: 'POST',
            headers: {
                'ClientId': clientId,
                'SessionId': sessionId
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            log('✅ Session ended');
            sessionActive = false;
            document.getElementById('sessionInfo').style.display = 'none';
            updateUIState('sessionEnded');
        } else {
            log(`❌ Failed to end session: ${result.error}`);
        }
    } catch (error) {
        log(`Error ending session: ${error.message}`);
    }
}

/**
 * Copy listener URL to clipboard
 */
function copyListenerUrl() {
    const url = document.getElementById('listenerUrl').textContent;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('copyBtn');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
        log('Listener URL copied to clipboard');
    });
}

/**
 * Share listener URL using Web Share API
 */
function shareListenerUrl() {
    const url = document.getElementById('listenerUrl').textContent;
    const sessionName = document.getElementById('sessionName').value;
    
    if (navigator.share) {
        navigator.share({
            title: 'Join Translation Session',
            text: `Join my translation session: ${sessionName}`,
            url: url
        }).then(() => {
            log('Listener URL shared');
        }).catch((error) => {
            log(`Error sharing: ${error.message}`);
        });
    } else {
        // Fallback to copy
        copyListenerUrl();
    }
}

/**
 * Update UI button states
 */
function updateUIState(state) {
    const createBtn = document.getElementById('createSession');
    const startBtn = document.getElementById('startTranslation');
    const stopBtn = document.getElementById('stopTranslation');
    const endBtn = document.getElementById('endSession');
    const micIndicator = document.getElementById('microphoneIndicator');
    
    switch (state) {
        case 'sessionCreated':
            createBtn.disabled = true;
            startBtn.disabled = false;
            endBtn.disabled = false;
            break;
            
        case 'translationStarted':
            startBtn.disabled = true;
            stopBtn.disabled = false;
            micIndicator.style.display = 'block';
            break;
            
        case 'translationStopped':
            startBtn.disabled = false;
            stopBtn.disabled = true;
            micIndicator.style.display = 'none';
            break;
            
        case 'sessionEnded':
            createBtn.disabled = false;
            startBtn.disabled = true;
            stopBtn.disabled = true;
            endBtn.disabled = true;
            micIndicator.style.display = 'none';
            break;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Expose functions to window object
window.createSession = createSession;
window.startTranslation = startTranslation;
window.stopTranslation = stopTranslation;
window.endSession = endSession;
window.copyListenerUrl = copyListenerUrl;
window.shareListenerUrl = shareListenerUrl;
