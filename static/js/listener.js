/**
 * Listener Mode - Receive Translations with Avatar
 * Handles WebRTC connection for avatar and receives real-time translations
 */

// Global state
let clientId;
let sessionId;
let socket;
let peerConnection;
let avatarConnected = false;

/**
 * Initialize the listener application
 */
function initializeApp() {
    clientId = document.getElementById('clientId').value;
    sessionId = document.getElementById('sessionId').value;
    
    log('Listener mode initialized');
    log(`Session ID: ${sessionId}`);
    
    // Load session info and initialize
    loadSessionInfo();
    initializeSocketIO();
    connectToAvatar();
}

/**
 * Log message to UI and console
 */
function log(message) {
    const timestamp = new Date().toISOString();
    const loggingElement = document.getElementById('logging');
    if (loggingElement) {
        loggingElement.innerHTML = `[${timestamp}] ${message}\n` + loggingElement.innerHTML;
    }
    console.log(`[${timestamp}] ${message}`);
}

/**
 * Load session information
 */
async function loadSessionInfo() {
    try {
        const response = await fetch(`/api/getSession/${sessionId}`);
        const session = await response.json();
        
        if (response.ok) {
            document.getElementById('sessionName').textContent = session.sessionName;
            document.getElementById('sessionCode').textContent = session.sessionCode;
            document.getElementById('sourceLanguageLabel').textContent = 
                `Original (${session.sourceLanguage})`;
            document.getElementById('targetLanguageLabel').textContent = 
                `Translation (${session.targetLanguage})`;
            
            log(`✅ Joined session: ${session.sessionName}`);
        } else {
            log(`❌ Failed to load session: ${session.error}`);
            document.getElementById('sessionName').textContent = 'Session not found';
        }
    } catch (error) {
        log(`Error loading session: ${error.message}`);
    }
}

/**
 * Initialize Socket.IO connection
 */
function initializeSocketIO() {
    socket = io();
    
    socket.on('connect', () => {
        log('Socket.IO connected');
        // Join the session room to receive translations
        socket.emit('join', { room: sessionId });
        socket.emit('joinSession', { sessionId: sessionId, clientId: clientId });
        updateConnectionStatus('translation', true);
    });
    
    socket.on('disconnect', () => {
        log('Socket.IO disconnected');
        updateConnectionStatus('translation', false);
    });
    
    // Listen for new translation result format
    socket.on('translationResult', (data) => {
        log(`✅ Translation received via translationResult event`);
        handleTranslationResponse(data);
    });
    
    // Listen for session ended
    socket.on('sessionEnded', (data) => {
        log('Session ended by speaker');
        handleSessionEnded();
    });
    
    // Legacy response format (backwards compatibility)
    socket.on('response', (data) => {
        if (data.path === 'api.translation') {
            handleTranslationResponse(data);
        } else if (data.path === 'api.sessionEnded') {
            handleSessionEnded();
        } else if (data.path === 'api.speakerSpeaking') {
            showAudioIndicator(data.speaking);
        }
    });
}

/**
 * Handle incoming translation responses
 */
function handleTranslationResponse(data) {
    log(`Translation received: ${data.translatedText}`);
    
    // Update live transcription boxes
    document.getElementById('sourceTranscription').innerHTML = 
        `<p style="margin: 0;">${data.sourceText}</p>`;
    document.getElementById('targetTranscription').innerHTML = 
        `<p style="margin: 0;">${data.translatedText}</p>`;
    
    // Add to history
    addTranslationToHistory(data);
    
    // Show audio indicator briefly
    showAudioIndicator(true);
    setTimeout(() => showAudioIndicator(false), 2000);
}

/**
 * Add translation to history display
 */
function addTranslationToHistory(data) {
    const historyDiv = document.getElementById('translationHistory');
    
    // Remove "no translations" message if present
    if (historyDiv.querySelector('p')) {
        historyDiv.innerHTML = '';
    }
    
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <div class="history-meta">
            ${new Date().toLocaleTimeString()} | 
            ${data.sourceLanguage} → ${data.targetLanguage}
        </div>
        <div class="history-text">
            <strong>Original:</strong> ${data.sourceText}
        </div>
        <div class="history-text" style="color: #667eea;">
            <strong>Translation:</strong> ${data.translatedText}
        </div>
    `;
    
    historyDiv.insertBefore(historyItem, historyDiv.firstChild);
}

/**
 * Show/hide audio indicator
 */
function showAudioIndicator(show) {
    const indicator = document.getElementById('audioIndicator');
    indicator.style.display = show ? 'block' : 'none';
}

/**
 * Handle session ended event
 */
function handleSessionEnded() {
    log('Session ended by speaker');
    alert('This translation session has ended.');
    
    // Disconnect avatar
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    updateConnectionStatus('avatar', false);
    updateConnectionStatus('translation', false);
}

/**
 * Update connection status display
 */
function updateConnectionStatus(type, connected) {
    if (type === 'avatar') {
        const statusDot = document.getElementById('avatarStatus');
        const statusText = document.getElementById('avatarStatusText');
        if (connected) {
            statusDot.className = 'status-dot status-connected';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot status-disconnected';
            statusText.textContent = 'Disconnected';
        }
    } else if (type === 'translation') {
        const statusDot = document.getElementById('translationStatus');
        const statusText = document.getElementById('translationStatusText');
        if (connected) {
            statusDot.className = 'status-dot status-connected';
            statusText.textContent = 'Active';
        } else {
            statusDot.className = 'status-dot status-disconnected';
            statusText.textContent = 'Waiting';
        }
    }
}

/**
 * Connect to avatar service via WebRTC
 */
async function connectToAvatar() {
    log('Connecting to avatar service...');
    
    try {
        // Fetch ICE token
        const iceToken = await fetchIceToken();
        log('ICE token fetched');
        const iceServerInfo = JSON.parse(iceToken);
        
        // Setup WebRTC peer connection
        setupPeerConnection(iceServerInfo);
        
        // Create and set local SDP offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        log('Local SDP offer created');
        
        // Wait for ICE gathering
        await waitForIceGathering();
        
        // Connect to avatar service
        await connectToAvatarService(peerConnection);
        
    } catch (error) {
        log(`❌ Error connecting to avatar: ${error.message}`);
        console.error('Avatar connection error:', error);
    }
}

/**
 * Fetch ICE token for WebRTC
 */
async function fetchIceToken() {
    const response = await fetch('/api/getIceToken');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
}

/**
 * Setup WebRTC peer connection
 */
function setupPeerConnection(iceServerInfo) {
    peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: iceServerInfo.Urls,
            username: iceServerInfo.Username,
            credential: iceServerInfo.Password
        }],
        iceTransportPolicy: 'relay'
    });
    
    log('RTCPeerConnection created');
    
    // Handle incoming media tracks
    peerConnection.ontrack = handleTrackEvent;
    
    // Monitor connection states
    peerConnection.oniceconnectionstatechange = () => {
        log(`ICE connection state: ${peerConnection.iceConnectionState}`);
        if (peerConnection.iceConnectionState === 'connected') {
            log('✅ WebRTC connection established');
            updateConnectionStatus('avatar', true);
            avatarConnected = true;
        } else if (peerConnection.iceConnectionState === 'failed') {
            log('❌ WebRTC connection failed');
            updateConnectionStatus('avatar', false);
        }
    };
    
    peerConnection.onconnectionstatechange = () => {
        log(`Connection state: ${peerConnection.connectionState}`);
    };
    
    // Add transceivers
    peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    
    return peerConnection;
}

/**
 * Wait for ICE gathering to complete
 */
function waitForIceGathering() {
    return new Promise((resolve) => {
        if (peerConnection.iceGatheringState === 'complete') {
            log('ICE gathering already complete');
            resolve();
            return;
        }
        
        const checkState = () => {
            if (peerConnection.iceGatheringState === 'complete') {
                log('✅ ICE gathering complete');
                resolve();
            }
        };
        
        peerConnection.addEventListener('icegatheringstatechange', checkState);
        
        setTimeout(() => {
            peerConnection.removeEventListener('icegatheringstatechange', checkState);
            log('⏱️ ICE gathering timeout (10s)');
            resolve();
        }, 10000);
    });
}

/**
 * Connect to Azure Avatar Service
 */
async function connectToAvatarService(peerConnection) {
    const localSdp = btoa(JSON.stringify(peerConnection.localDescription));
    
    try {
        log('Sending connection request to avatar service...');
        const response = await fetch('/api/connectListenerAvatar', {
            method: 'POST',
            headers: {
                'ClientId': clientId,
                'SessionId': sessionId
            },
            body: localSdp
        });
        
        if (response.ok) {
            const remoteSdp = await response.text();
            log('Received remote SDP');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(remoteSdp))));
            log('✅ Avatar connected - video will appear when speaker talks');
        } else {
            const errorText = await response.text();
            log(`❌ Failed to connect avatar (HTTP ${response.status}): ${errorText}`);
            updateConnectionStatus('avatar', false);
        }
    } catch (error) {
        log(`Error connecting to avatar: ${error.message}`);
        console.error('Connection error:', error);
        updateConnectionStatus('avatar', false);
    }
}

/**
 * Handle incoming media tracks from avatar service
 */
function handleTrackEvent(event) {
    log(`✅ Track received: ${event.track.kind}`);
    console.log('Track event:', event);
    
    const remoteVideoDiv = document.getElementById('remoteVideo');
    
    // Remove existing element of the same type
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
    
    if (event.track.kind === 'video') {
        mediaPlayer.muted = true; // Video can be muted (audio is separate track)
        setupVideoElement(mediaPlayer);
        log('✅ Video track added to player');
    } else if (event.track.kind === 'audio') {
        mediaPlayer.muted = false;
        // Try to play audio - may need user interaction
        mediaPlayer.play().then(() => {
            log('🔊 Audio playing successfully');
        }).catch(err => {
            log(`⚠️ Audio autoplay blocked - click page to enable audio`);
            console.warn('Audio autoplay blocked:', err);
            // Show a message to user
            showAudioUnmutePrompt();
        });
        log('🔊 Audio track added to player');
    }
    
    remoteVideoDiv.appendChild(mediaPlayer);
}

/**
 * Show prompt to user to enable audio
 */
function showAudioUnmutePrompt() {
    // Check if prompt already exists
    if (document.getElementById('audioPrompt')) return;
    
    const prompt = document.createElement('div');
    prompt.id = 'audioPrompt';
    prompt.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ff9800;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        cursor: pointer;
        z-index: 1000;
        font-weight: bold;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;
    prompt.innerHTML = '🔇 Click here to enable audio';
    prompt.onclick = () => {
        const audioElement = document.getElementById('audio');
        if (audioElement) {
            audioElement.muted = false;
            audioElement.play().then(() => {
                log('🔊 Audio enabled by user');
            }).catch(e => console.error('Still cannot play:', e));
        }
        prompt.remove();
    };
    document.body.appendChild(prompt);
    
    // Also enable on any click on the page
    document.addEventListener('click', function enableAudio() {
        const audioElement = document.getElementById('audio');
        if (audioElement) {
            audioElement.muted = false;
            audioElement.play().catch(e => {});
        }
        const promptEl = document.getElementById('audioPrompt');
        if (promptEl) promptEl.remove();
        document.removeEventListener('click', enableAudio);
    }, { once: true });
}

/**
 * Setup video element with styling and event handlers
 */
function setupVideoElement(videoElement) {
    videoElement.style.width = '100%';
    videoElement.style.height = 'auto';
    videoElement.style.display = 'block';
    
    videoElement.onloadedmetadata = () => {
        log(`📹 Video loaded: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        // Ensure video plays
        videoElement.play().catch(e => console.log('Video play error:', e));
    };
    
    videoElement.onplay = () => {
        log('▶️ Video started playing');
    };
    
    videoElement.onpause = () => {
        log('⏸️ Video paused - attempting to resume');
        // Try to resume if paused unexpectedly
        setTimeout(() => {
            if (videoElement.paused && avatarConnected) {
                videoElement.play().catch(e => console.log('Resume error:', e));
            }
        }, 100);
    };
    
    videoElement.onerror = (e) => {
        log(`❌ Video error: ${e.type}`);
        console.error('Video error:', e, videoElement.error);
    };
    
    videoElement.onended = () => {
        log('⚠️ Video ended');
    };
}

/**
 * Handle start button click - enables audio context and initializes app
 */
function handleStartClick() {
    // Remove overlay
    const overlay = document.getElementById('startOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
    
    // Create and resume audio context to enable audio playback
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.resume().then(() => {
            console.log('AudioContext resumed successfully');
        });
    } catch (e) {
        console.log('AudioContext not needed:', e);
    }
    
    // Now initialize the app
    initializeApp();
}

// Initialize when DOM is ready - but wait for user click
document.addEventListener('DOMContentLoaded', () => {
    // Setup click handlers for start overlay
    const overlay = document.getElementById('startOverlay');
    const startButton = document.getElementById('startButton');
    
    if (overlay) {
        overlay.addEventListener('click', handleStartClick);
    }
    if (startButton) {
        startButton.addEventListener('click', (e) => {
            e.stopPropagation();
            handleStartClick();
        });
    }
});
