/**
 * Translation Avatar Application
 * Handles speech translation with real-time avatar output
 */

// Global state variables
let clientId;
let peerConnection;
let sessionActive = false;
let translationActive = false;
let socket;
let audioLevelInterval;

/**
 * Initialize the application
 */
function initializeApp() {
    clientId = document.getElementById('clientId').value;
    log('Page loaded, initializing...');
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
 * Initialize Socket.IO connection for real-time translation updates
 */
function initializeSocketIO() {
    socket = io();
    
    socket.on('connect', () => {
        log('Socket.IO connected');
        socket.emit('join', { room: clientId });
    });
    
    socket.on('disconnect', () => {
        log('Socket.IO disconnected');
    });
    
    socket.on('response', (data) => {
        if (data.path === 'api.translation') {
            handleTranslationResponse(data);
        }
    });
}

/**
 * Handle incoming translation responses from server
 */
function handleTranslationResponse(data) {
    log(`Translation received: ${data.sourceText} → ${data.translatedText}`);
    
    // Update live transcription boxes
    document.getElementById('sourceTranscription').innerHTML = 
        `<p style="margin: 0; font-size: 14px;"><strong>${data.sourceLanguage}:</strong> ${data.sourceText}</p>`;
    document.getElementById('targetTranscription').innerHTML = 
        `<p style="margin: 0; font-size: 14px;"><strong>${data.targetLanguage}:</strong> ${data.translatedText}</p>`;
    
    // Add to history
    addTranslationResult(data.sourceText, data.translatedText, data.sourceLanguage, data.targetLanguage);
}

/**
 * Simulate audio level animation while listening
 */
function updateAudioLevel() {
    const bar = document.getElementById('audioLevelBar');
    const randomLevel = Math.random() * 60 + 20; // Random between 20-80%
    bar.style.width = randomLevel + '%';
}

/**
 * Add translation result to history display
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
            ${sourceLang} → ${targetLang}
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
 * Fetch ICE token for WebRTC connection
 */
async function fetchIceToken() {
    try {
        const response = await fetch('/api/getIceToken');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        log(`Error fetching ICE token: ${error.message}`);
        throw error;
    }
}

/**
 * Setup WebRTC peer connection with event handlers
 */
function setupPeerConnection(iceServerInfo) {
    peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: iceServerInfo.Urls,
            username: iceServerInfo.Username,
            credential: iceServerInfo.Password
        }],
        iceTransportPolicy: 'relay'  // Use relay policy (matches basic.js)
    });
    
    log('RTCPeerConnection created');
    
    // Handle incoming media tracks (video/audio)
    peerConnection.ontrack = handleTrackEvent;
    
    // Monitor ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
        log(`WebRTC ICE connection state: ${peerConnection.iceConnectionState}`);
        if (peerConnection.iceConnectionState === 'connected') {
            log('✅ WebRTC connection established successfully');
        } else if (peerConnection.iceConnectionState === 'failed') {
            log('❌ WebRTC ICE connection failed - check firewall/network');
        } else if (peerConnection.iceConnectionState === 'disconnected') {
            log('⚠️ WebRTC ICE connection disconnected');
        }
    };
    
    // Monitor overall connection state
    peerConnection.onconnectionstatechange = () => {
        log(`WebRTC connection state: ${peerConnection.connectionState}`);
        if (peerConnection.connectionState === 'failed') {
            log('❌ WebRTC connection failed - avatar service may have disconnected');
        }
    };
    
    // Monitor ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            log(`ICE candidate: ${event.candidate.type} - ${event.candidate.protocol}`);
        } else {
            log('ICE gathering completed');
        }
    };
    
    // Monitor ICE gathering state
    peerConnection.onicegatheringstatechange = () => {
        log(`ICE gathering state: ${peerConnection.iceGatheringState}`);
    };
    
    // Add transceivers for video and audio (sendrecv matches basic.js)
    peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    
    return peerConnection;
}

/**
 * Handle incoming media tracks from avatar service
 */
function handleTrackEvent(event) {
    log(`✅ Track received: ${event.track.kind}`);
    console.log('Track event:', event);
    
    // Remove existing element of the same type
    const remoteVideoDiv = document.getElementById('remoteVideo');
    for (let i = 0; i < remoteVideoDiv.childNodes.length; i++) {
        if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
            remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i]);
        }
    }
    
    // Create and append the media element
    const mediaPlayer = document.createElement(event.track.kind);
    mediaPlayer.id = event.track.kind;
    mediaPlayer.srcObject = event.streams[0];
    mediaPlayer.autoplay = true;
    mediaPlayer.playsInline = true;
    mediaPlayer.controls = false;
    mediaPlayer.muted = false;
    
    if (event.track.kind === 'video') {
        setupVideoElement(mediaPlayer);
        log('✅ Video track added to player');
    } else if (event.track.kind === 'audio') {
        log('🔊 Audio track added to player');
    }
    
    remoteVideoDiv.appendChild(mediaPlayer);
    log(`📦 Media element appended to DOM, total elements: ${remoteVideoDiv.childNodes.length}`);
}

/**
 * Setup video element with styling and event handlers
 */
function setupVideoElement(videoElement) {
    videoElement.style.width = '960px';
    videoElement.style.height = 'auto';
    videoElement.style.display = 'block';
    videoElement.style.backgroundColor = '#000';
    
    // Log when video actually starts playing
    videoElement.onloadedmetadata = () => {
        log(`📹 Video metadata loaded: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        console.log('Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
    };
    
    videoElement.onloadeddata = () => {
        log('📹 Video data loaded');
    };
    
    videoElement.oncanplay = () => {
        log('📹 Video can play');
    };
    
    videoElement.onplay = () => {
        log('▶️ Video started playing');
    };
    
    videoElement.onplaying = () => {
        log('▶️ Video is now playing');
    };
    
    videoElement.onstalled = () => {
        log('⚠️ Video stalled - waiting for data');
    };
    
    videoElement.onwaiting = () => {
        log('⏳ Video waiting for data');
    };
    
    videoElement.onerror = (e) => {
        log(`❌ Video error: ${e.type}`);
        console.error('Video error:', e, videoElement.error);
    };
    
    // Check readyState
    videoElement.addEventListener('loadstart', () => {
        log(`📹 Video load started, readyState: ${videoElement.readyState}`);
    });
}

/**
 * Get avatar configuration from UI
 */
function getAvatarConfig() {
    return {
        character: document.getElementById('talkingAvatarCharacter').value,
        style: document.getElementById('talkingAvatarStyle').value,
        isCustomAvatar: document.getElementById('customizedAvatar').checked,
        useBuiltInVoice: document.getElementById('useBuiltInVoice').checked,
        backgroundColor: document.getElementById('backgroundColor').value,
        transparentBackground: document.getElementById('transparentBackground').checked,
        videoCrop: document.getElementById('videoCrop').checked
    };
}

/**
 * Start avatar session
 */
async function startSession() {
    log('Starting avatar session...');
    
    try {
        // Fetch ICE token for WebRTC
        const iceToken = await fetchIceToken();
        log('ICE token fetched successfully');
        const iceServerInfo = JSON.parse(iceToken);
        
        // Setup WebRTC peer connection
        setupPeerConnection(iceServerInfo);
        
        // Create and set local SDP offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        log('Local SDP offer created');
        
        // Wait for ICE gathering to complete before connecting
        // This is critical - the server needs all ICE candidates
        await waitForIceGathering();
        
        // Connect to avatar service
        await connectToAvatarService(peerConnection);
        
    } catch (error) {
        log(`Error starting session: ${error.message}`);
        console.error('Session start error:', error);
    }
}

/**
 * Wait for ICE gathering to complete
 * Returns a promise that resolves when gathering is done or times out
 */
function waitForIceGathering() {
    return new Promise((resolve) => {
        // If already complete, resolve immediately
        if (peerConnection.iceGatheringState === 'complete') {
            log('ICE gathering already complete');
            resolve();
            return;
        }
        
        // Set up listener for gathering completion
        const checkState = () => {
            if (peerConnection.iceGatheringState === 'complete') {
                log('✅ ICE gathering complete');
                resolve();
            }
        };
        
        peerConnection.addEventListener('icegatheringstatechange', checkState);
        
        // Timeout after 10 seconds (same as basic.js)
        setTimeout(() => {
            peerConnection.removeEventListener('icegatheringstatechange', checkState);
            log('⏱️ ICE gathering timeout (10s) - proceeding with connection');
            resolve();
        }, 10000);
    });
}

/**
 * Connect to Azure Avatar Service
 */
async function connectToAvatarService(peerConnection) {
    const localSdp = btoa(JSON.stringify(peerConnection.localDescription));
    const avatarConfig = getAvatarConfig();
    
    log(`Connecting to avatar: ${avatarConfig.character}, custom: ${avatarConfig.isCustomAvatar}, voice sync: ${avatarConfig.useBuiltInVoice}`);
    
    const headers = {
        'ClientId': clientId,
        'AvatarCharacter': avatarConfig.character,
        'AvatarStyle': avatarConfig.style,
        'BackgroundColor': avatarConfig.backgroundColor,
        'IsCustomAvatar': avatarConfig.isCustomAvatar,
        'UseBuiltInVoice': avatarConfig.useBuiltInVoice,
        'TransparentBackground': avatarConfig.transparentBackground,
        'VideoCrop': avatarConfig.videoCrop
    };
    
    try {
        log('Sending connection request to /api/connectAvatar...');
        const response = await fetch('/api/connectAvatar', {
            method: 'POST',
            headers: headers,
            body: localSdp
        });
        
        if (response.ok) {
            const remoteSdp = await response.text();
            log('Received remote SDP from server');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(remoteSdp))));
            log('Remote SDP set successfully');
            log('✅ Avatar connected successfully!');
            log('ℹ️ Video will appear when avatar starts speaking (start translation and speak)');
            
            // Update UI state
            sessionActive = true;
            updateUIState('sessionStarted');
        } else {
            const errorText = await response.text();
            log(`Failed to connect avatar (HTTP ${response.status}): ${errorText}`);
        }
    } catch (error) {
        log(`Error connecting to avatar: ${error.message}`);
        console.error('Connection error:', error);
    }
}

/**
 * Test avatar speech - speaks a test phrase to verify connection
 */
async function testSpeak() {
    if (!sessionActive) {
        log('Please connect avatar first');
        return;
    }
    
    log('🔊 Testing avatar speech...');
    
    try {
        // Create SSML for test speech
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>
                        <voice name='en-US-JennyNeural'>
                            <mstts:leadingsilence-exact value='0'/>
                            Hello! This is a test. The avatar is working correctly.
                        </voice>
                      </speak>`;
        
        const response = await fetch('/api/speak', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'ClientId': clientId
            },
            body: ssml
        });
        
        if (response.ok) {
            log('✅ Test speech sent - avatar should speak now and video should appear');
        } else {
            const error = await response.text();
            log(`❌ Test speech failed: ${error}`);
        }
    } catch (error) {
        log(`Error testing speech: ${error.message}`);
    }
}

/**
 * Stop avatar session
 */
async function stopSession() {
    log('Stopping avatar session...');
    
    try {
        // Stop translation if active
        if (translationActive) {
            await stopTranslation();
        }
        
        // Disconnect avatar
        const response = await fetch('/api/disconnectAvatar', {
            method: 'POST',
            headers: { 'ClientId': clientId }
        });
        
        // Close WebRTC connection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
            log('WebRTC peer connection closed');
        }
        
        // Clear the video container
        const remoteVideoDiv = document.getElementById('remoteVideo');
        while (remoteVideoDiv.firstChild) {
            remoteVideoDiv.removeChild(remoteVideoDiv.firstChild);
        }
        
        // Clear transcriptions
        resetTranscriptionBoxes();
        
        // Update UI state
        sessionActive = false;
        updateUIState('sessionStopped');
        
        log('Avatar session stopped');
    } catch (error) {
        log(`Error stopping session: ${error.message}`);
    }
}

/**
 * Reset transcription boxes to initial state
 */
function resetTranscriptionBoxes() {
    document.getElementById('sourceTranscription').innerHTML = 
        '<p style="color: #999; margin: 0;">Original speech will appear here...</p>';
    document.getElementById('targetTranscription').innerHTML = 
        '<p style="color: #999; margin: 0;">Translated text will appear here...</p>';
}

/**
 * Get translation configuration from UI
 */
function getTranslationConfig() {
    return {
        sourceLanguage: document.getElementById('sourceLanguage').value,
        targetLanguage: document.getElementById('targetLanguage').value,
        targetVoice: document.getElementById('targetVoice').value
    };
}

/**
 * Start speech translation
 */
async function startTranslation() {
    if (!sessionActive) {
        log('Please connect avatar first');
        return;
    }
    
    const config = getTranslationConfig();
    log(`Starting translation: ${config.sourceLanguage} → ${config.targetLanguage}`);
    log('🎤 Speak into your microphone...');
    
    try {
        const response = await fetch('/api/translateSpeak', {
            method: 'POST',
            headers: {
                'ClientId': clientId,
                'SourceLanguage': config.sourceLanguage,
                'TargetLanguage': config.targetLanguage,
                'TargetVoice': config.targetVoice
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            log(result.message);
            translationActive = true;
            updateUIState('translationStarted');
            
            // Start audio level animation
            audioLevelInterval = setInterval(updateAudioLevel, 200);
        } else {
            log(`Translation error: ${result.error}`);
        }
    } catch (error) {
        log(`Error starting translation: ${error.message}`);
    }
}

/**
 * Stop speech translation
 */
async function stopTranslation() {
    log('Stopping translation...');
    
    try {
        const response = await fetch('/api/stopTranslation', {
            method: 'POST',
            headers: { 'ClientId': clientId }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            log(result.message);
            translationActive = false;
            updateUIState('translationStopped');
            
            // Stop audio level animation
            if (audioLevelInterval) {
                clearInterval(audioLevelInterval);
                audioLevelInterval = null;
            }
            
            // Reset audio level bar
            document.getElementById('audioLevelBar').style.width = '0%';
        } else {
            log(`Error stopping translation: ${result.error}`);
        }
    } catch (error) {
        log(`Error: ${error.message}`);
    }
}

/**
 * Update UI button states based on application state
 */
function updateUIState(state) {
    const startSessionBtn = document.getElementById('startSession');
    const testSpeakBtn = document.getElementById('testSpeak');
    const stopSessionBtn = document.getElementById('stopSession');
    const startTranslationBtn = document.getElementById('startTranslation');
    const stopTranslationBtn = document.getElementById('stopTranslation');
    const micIndicator = document.getElementById('microphoneIndicator');
    
    switch (state) {
        case 'sessionStarted':
            startSessionBtn.disabled = true;
            testSpeakBtn.disabled = false;
            stopSessionBtn.disabled = false;
            startTranslationBtn.disabled = false;
            break;
            
        case 'sessionStopped':
            startSessionBtn.disabled = false;
            testSpeakBtn.disabled = true;
            stopSessionBtn.disabled = true;
            startTranslationBtn.disabled = true;
            stopTranslationBtn.disabled = true;
            micIndicator.style.display = 'none';
            break;
            
        case 'translationStarted':
            testSpeakBtn.disabled = true;
            startTranslationBtn.disabled = true;
            stopTranslationBtn.disabled = false;
            micIndicator.style.display = 'block';
            break;
            
        case 'translationStopped':
            testSpeakBtn.disabled = false;
            startTranslationBtn.disabled = false;
            stopTranslationBtn.disabled = true;
            micIndicator.style.display = 'none';
            break;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Expose functions to window object for onclick handlers
window.startSession = startSession;
window.testSpeak = testSpeak;
window.stopSession = stopSession;
window.startTranslation = startTranslation;
window.stopTranslation = stopTranslation;
