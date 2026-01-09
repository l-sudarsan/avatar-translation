# Copyright (c) Microsoft. All rights reserved.
# Licensed under the MIT license.

"""
Speech Translation Avatar Application
Provides real-time speech translation with Azure Avatar synthesis
"""

import azure.cognitiveservices.speech as speechsdk
import base64
import datetime
import html
import json
import os
from pathlib import Path
import random
import requests
import string
import threading
import time
import uuid
from dotenv import load_dotenv
from flask import Flask, Response, render_template, request, redirect, url_for
from flask_socketio import SocketIO, join_room, emit

# Load environment variables from .env file (use explicit path to ensure correct file is loaded)
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# Debug: Print loaded config
print(f"[Config] Loaded .env from: {env_path}")
print(f"[Config] SPEECH_REGION = {os.environ.get('SPEECH_REGION')}")
print(f"[Config] SPEECH_KEY = {os.environ.get('SPEECH_KEY')}")
# Create the Flask app
app = Flask(__name__, template_folder='.')

# Create the SocketIO instance
socketio = SocketIO(app)

# Environment variables
# Speech resource (required)
speech_region = os.environ.get('SPEECH_REGION')  # e.g. westus2
speech_key = os.environ.get('SPEECH_KEY')
speech_private_endpoint = os.environ.get('SPEECH_PRIVATE_ENDPOINT')  # Optional
enable_token_auth_for_speech = os.environ.get('ENABLE_TOKEN_AUTH', 'false').lower() == 'true'

# Customized ICE server (optional)
ice_server_url = os.environ.get('ICE_SERVER_URL')
ice_server_url_remote = os.environ.get('ICE_SERVER_URL_REMOTE')
ice_server_username = os.environ.get('ICE_SERVER_USERNAME')
ice_server_password = os.environ.get('ICE_SERVER_PASSWORD')

# Default settings
default_tts_voice = 'DragonLatestNeural'
enable_websockets = True

# Global variables
client_contexts = {}  # Client contexts
speech_token = None  # Speech token
ice_token = None  # ICE token
sessions = {}  # Active translation sessions
session_listeners = {}  # Track listeners per session


def initializeClient() -> uuid.UUID:
    """Initialize a new client session"""
    client_id = uuid.uuid4()
    client_contexts[client_id] = {
        'speech_synthesizer': None,
        'speech_synthesizer_connection': None,
        'speech_synthesizer_connected': False,
        'tts_voice': default_tts_voice,
        'translation_recognizer': None,
        'custom_voice_endpoint_id': None,
        'session_id': None,  # Link to translation session
        'push_audio_stream': None  # For browser audio streaming
    }
    print(f'[Client] New client initialized: {client_id}')
    return client_id


def generateSessionCode() -> str:
    """Generate a unique 6-digit session code"""
    while True:
        code = ''.join(random.choices(string.digits, k=6))
        if code not in sessions:
            return code


def connectAvatarInternal(client_id: uuid.UUID, local_sdp: str, avatar_character: str, 
                         avatar_style: str, background_color: str, is_custom_avatar: bool, 
                         transparent_background: bool, video_crop: bool, use_built_in_voice: bool = False) -> str:
    """Internal method to connect avatar - returns remote SDP"""
    client_context = client_contexts.get(client_id)
    if not client_context:
        raise Exception('Client not found')
    
    # Disconnect if already connected
    if client_context['speech_synthesizer']:
        disconnectAvatarInternal(client_id)
    
    avatar_character = (avatar_character or 'lisa').strip()
    avatar_style = (avatar_style or '').strip()
    background_color = (background_color or '#FFFFFFFF').strip()
    is_custom_avatar = bool(is_custom_avatar)
    use_built_in_voice = bool(use_built_in_voice)

    print(f"[Avatar] Connecting - Character: {avatar_character}, Custom: {is_custom_avatar}, Voice: {client_context['tts_voice']}")
    print(f"[Avatar] Using Region: {speech_region}, Key Present: {bool(speech_key)}")
    
    # Configure speech service
    if speech_private_endpoint:
        speech_private_endpoint_wss = speech_private_endpoint.replace('https://', 'wss://')
        if enable_token_auth_for_speech:
            speech_config = speechsdk.SpeechConfig(
                endpoint=f'{speech_private_endpoint_wss}/tts/cognitiveservices/websocket/v1?enableTalkingAvatar=true')
            speech_config.authorization_token = speech_token
        else:
            speech_config = speechsdk.SpeechConfig(
                subscription=speech_key,
                endpoint=f'{speech_private_endpoint_wss}/tts/cognitiveservices/websocket/v1?enableTalkingAvatar=true')
    else:
        if enable_token_auth_for_speech:
            speech_config = speechsdk.SpeechConfig(
                endpoint=f'wss://{speech_region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?enableTalkingAvatar=true')
            speech_config.authorization_token = speech_token
        else:
            speech_config = speechsdk.SpeechConfig(
                subscription=speech_key,
                endpoint=f'wss://{speech_region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?enableTalkingAvatar=true')
    
    # Create speech synthesizer
    client_context['speech_synthesizer'] = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
    speech_synthesizer = client_context['speech_synthesizer']
    
    # Get ICE server configuration
    ice_token_obj = json.loads(ice_token)
    if ice_server_url and ice_server_username and ice_server_password:
        ice_token_obj = {
            'Urls': [ice_server_url_remote] if ice_server_url_remote else [ice_server_url],
            'Username': ice_server_username,
            'Password': ice_server_password
        }
    
    # Build avatar configuration
    effective_style = '' if is_custom_avatar else avatar_style
    
    avatar_config = {
        'synthesis': {
            'video': {
                'protocol': {
                    'name': "WebRTC",
                    'webrtcConfig': {
                        'clientDescription': local_sdp,
                        'iceServers': [{
                            'urls': [ice_token_obj['Urls'][0]],
                            'username': ice_token_obj['Username'],
                            'credential': ice_token_obj['Password']
                        }]
                    },
                },
                'format': {
                    'crop': {
                        'topLeft': {
                            'x': 600 if video_crop else 0,
                            'y': 0
                        },
                        'bottomRight': {
                            'x': 1320 if video_crop else 1920,
                            'y': 1080
                        }
                    },
                    'bitrate': 1000000
                },
                'talkingAvatar': {
                    'customized': is_custom_avatar,
                    'character': avatar_character,
                    **({'style': effective_style} if effective_style else {}),
                    'background': {
                        'color': '#00FF00FF' if transparent_background else background_color
                    },
                    'useBuiltInVoice': use_built_in_voice
                }
            }
        }
    }
    
    # Debug: Print avatar config
    print(f"[Avatar Config] talkingAvatar: {json.dumps(avatar_config['synthesis']['video']['talkingAvatar'], indent=2)}")
    
    # Setup connection callbacks
    connection = speechsdk.Connection.from_speech_synthesizer(speech_synthesizer)
    connection.connected.connect(lambda evt: print('[Avatar] Connected to avatar service'))
    
    def tts_disconnected_cb(evt):
        print('[Avatar] Disconnected from avatar service')
        client_context['speech_synthesizer_connection'] = None
        client_context['speech_synthesizer_connected'] = False
    
    connection.disconnected.connect(tts_disconnected_cb)
    connection.set_message_property('speech.config', 'context', json.dumps(avatar_config))
    client_context['speech_synthesizer_connection'] = connection
    client_context['speech_synthesizer_connected'] = True
    
    # Initiate connection by speaking empty string
    speech_synthesis_result = speech_synthesizer.speak_text_async('').get()
    
    if speech_synthesis_result.reason == speechsdk.ResultReason.Canceled:
        cancellation_details = speech_synthesis_result.cancellation_details
        raise Exception(f"Avatar connection failed: {cancellation_details.error_details}")
    
    # Get remote SDP from result
    turn_start_message = speech_synthesizer.properties.get_property_by_name('SpeechSDKInternal-ExtraTurnStartMessage')
    remote_sdp = json.loads(turn_start_message)['webrtc']['connectionString']
    
    print('[Avatar] ✅ Connection established')
    return remote_sdp


def refreshSpeechToken():
    """Background thread to refresh speech token"""
    global speech_token
    while True:
        try:
            if speech_private_endpoint:
                # For private endpoint, use DefaultAzureCredential
                from azure.identity import DefaultAzureCredential
                credential = DefaultAzureCredential()
                token = credential.get_token('https://cognitiveservices.azure.com/.default')
                speech_token = token.token
                print('[Auth] Speech token refreshed (private endpoint)')
            else:
                # For public endpoint, use subscription key to get token
                url = f'https://{speech_region}.api.cognitive.microsoft.com/sts/v1.0/issueToken'
                headers = {'Ocp-Apim-Subscription-Key': speech_key}
                response = requests.post(url, headers=headers)
                if response.status_code == 200:
                    speech_token = response.text
                    print('[Auth] Speech token refreshed')
                else:
                    print(f'[Auth] Failed to refresh speech token: {response.status_code}')
        except Exception as e:
            print(f'[Auth] Error refreshing speech token: {e}')
        
        time.sleep(540)  # Refresh every 9 minutes (tokens valid for 10 minutes)


def refreshIceToken():
    """Background thread to refresh ICE token"""
    global ice_token
    while True:
        try:
            if speech_private_endpoint:
                url = f'{speech_private_endpoint}/tts/cognitiveservices/avatar/relay/token/v1'
                if enable_token_auth_for_speech:
                    headers = {'Authorization': f'Bearer {speech_token}'}
                else:
                    headers = {'Ocp-Apim-Subscription-Key': speech_key}
            else:
                url = f'https://{speech_region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1'
                if enable_token_auth_for_speech:
                    headers = {'Authorization': f'Bearer {speech_token}'}
                else:
                    headers = {'Ocp-Apim-Subscription-Key': speech_key}
            
            import requests
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                ice_token = response.text
                print('[ICE] ICE token refreshed')
            else:
                print(f'[ICE] Failed to refresh ICE token: {response.status_code}')
        except Exception as e:
            print(f'[ICE] Error refreshing ICE token: {e}')
        
        time.sleep(540)  # Refresh every 9 minutes


# Routes
@app.route("/")
def index():
    """Root route - redirect to speaker mode"""
    return redirect(url_for('speakerView'))


@app.route("/speaker")
def speakerView():
    """Speaker control interface"""
    client_id = initializeClient()
    return render_template("speaker.html", client_id=client_id)


@app.route("/listener/<session_id>")
def listenerView(session_id):
    """Listener interface for specific session"""
    # Verify session exists
    if session_id not in sessions:
        return Response("Session not found", status=404)
    
    client_id = initializeClient()
    return render_template("listener.html", client_id=client_id, session_id=session_id)


@app.route("/translate")
def translateView():
    """Legacy translation page route (combined interface)"""
    return render_template("translate.html", methods=["GET"], client_id=initializeClient())


@app.route("/api/createSession", methods=["POST"])
def createSession() -> Response:
    """Create a new translation session"""
    try:
        data = request.get_json()
        session_id = generateSessionCode()

        # Normalize incoming values to avoid whitespace issues
        session_name = (data.get('sessionName') or f'Session {session_id}').strip()
        source_language = (data.get('sourceLanguage') or 'en-US').strip()
        target_language = (data.get('targetLanguage') or 'es-ES').strip()
        target_voice = (data.get('targetVoice') or '').strip()
        avatar_character = (data.get('avatarCharacter') or 'lisa').strip()
        avatar_style = (data.get('avatarStyle') or 'casual-sitting').strip()
        background_color = (data.get('backgroundColor') or '#FFFFFFFF').strip()
        is_custom_avatar = bool(data.get('isCustomAvatar', False))
        use_built_in_voice = bool(data.get('useBuiltInVoice', False))
        transparent_background = bool(data.get('transparentBackground', False))
        video_crop = bool(data.get('videoCrop', False))

        # Store session configuration
        sessions[session_id] = {
            'id': session_id,
            'name': session_name,
            'sourceLanguage': source_language,
            'targetLanguage': target_language,
            'targetVoice': target_voice or None,
            'avatarCharacter': avatar_character,
            'avatarStyle': avatar_style,
            'backgroundColor': background_color,
            'isCustomAvatar': is_custom_avatar,
            'useBuiltInVoice': use_built_in_voice,  # For custom avatar voice sync
            'transparentBackground': transparent_background,
            'videoCrop': video_crop,
            'created_at': datetime.datetime.now().isoformat(),
            'active': False,
            'speaker_client_id': None
        }
        
        # Initialize listener tracking
        session_listeners[session_id] = set()
        
        # Generate listener URL
        listener_url = f"{request.host_url}listener/{session_id}"
        
        print(f"[Session] Created: {session_id} - {sessions[session_id]['name']}")
        
        return Response(json.dumps({
            'sessionId': session_id,
            'listenerUrl': listener_url,
            'sessionInfo': sessions[session_id]
        }), status=200, mimetype='application/json')
        
    except Exception as e:
        error_msg = f"Failed to create session: {str(e)}"
        print(f"[Session] {error_msg}")
        return Response(json.dumps({'error': error_msg}), status=400, mimetype='application/json')


@app.route("/api/getSession/<session_id>", methods=["GET"])
def getSession(session_id) -> Response:
    """Get session information"""
    if session_id not in sessions:
        return Response(json.dumps({'error': 'Session not found'}), status=404, mimetype='application/json')
    
    session = sessions[session_id]
    # Return with field names expected by frontend
    session_info = {
        'sessionId': session_id,
        'sessionCode': session_id,
        'sessionName': session.get('name', f'Session {session_id}'),
        'sourceLanguage': session.get('sourceLanguage', 'en-US'),
        'targetLanguage': session.get('targetLanguage', 'es-ES'),
        'targetVoice': session.get('targetVoice'),
        'avatarCharacter': session.get('avatarCharacter', 'lisa'),
        'avatarStyle': session.get('avatarStyle', 'casual-sitting'),
        'active': session.get('active', False),
        'listenerCount': len(session_listeners.get(session_id, set()))
    }
    
    return Response(json.dumps(session_info), status=200, mimetype='application/json')


@app.route("/api/endSession", methods=["POST"])
def endSession() -> Response:
    """End a translation session"""
    try:
        data = request.get_json()
        session_id = data.get('sessionId')
        
        if session_id not in sessions:
            return Response(json.dumps({'error': 'Session not found'}), status=404, mimetype='application/json')
        
        # Notify all listeners
        socketio.emit('sessionEnded', {'sessionId': session_id}, room=session_id)
        
        # Clean up
        del sessions[session_id]
        if session_id in session_listeners:
            del session_listeners[session_id]
        
        print(f"[Session] Ended: {session_id}")
        
        return Response(json.dumps({'status': 'ended'}), status=200, mimetype='application/json')
        
    except Exception as e:
        error_msg = f"Failed to end session: {str(e)}"
        print(f"[Session] {error_msg}")
        return Response(json.dumps({'error': error_msg}), status=400, mimetype='application/json')


@app.route("/api/getSpeechToken", methods=["GET"])
def getSpeechToken() -> Response:
    """Get speech token for client-side SDK"""
    response = Response(speech_token, status=200)
    response.headers['SpeechRegion'] = speech_region
    if speech_private_endpoint:
        response.headers['SpeechPrivateEndpoint'] = speech_private_endpoint
    return response


@app.route("/api/getIceToken", methods=["GET"])
def getIceToken() -> Response:
    """Get ICE token for WebRTC connection"""
    # Apply customized ICE server if provided
    if ice_server_url and ice_server_username and ice_server_password:
        custom_ice_token = json.dumps({
            'Urls': [ice_server_url],
            'Username': ice_server_username,
            'Password': ice_server_password
        })
        return Response(custom_ice_token, status=200)
    return Response(ice_token, status=200)


@app.route("/api/getStatus", methods=["GET"])
def getStatus() -> Response:
    """Get client session status"""
    client_id = uuid.UUID(request.headers.get('ClientId'))
    client_context = client_contexts.get(client_id)
    if not client_context:
        return Response(json.dumps({'error': 'Client not found'}), status=404)
    
    status = {
        'speechSynthesizerConnected': client_context['speech_synthesizer_connected']
    }
    return Response(json.dumps(status), status=200)


@app.route("/api/connectListenerAvatar", methods=["POST"])
def connectListenerAvatar() -> Response:
    """Connect listener to avatar service via WebRTC"""
    try:
        # Get client_id and session_id from headers (how listener.js sends them)
        client_id_str = request.headers.get('ClientId')
        session_id = request.headers.get('SessionId')
        
        # Get SDP from body - already base64 encoded JSON from listener.js
        # This is the same format as translate.js sends: btoa(JSON.stringify(localDescription))
        local_sdp = request.data.decode('utf-8')
        
        if not client_id_str:
            return Response('ClientId header is required', status=400)
        
        if not session_id or session_id not in sessions:
            return Response(f'Invalid session: {session_id}', status=404)
        
        if not local_sdp:
            return Response('SDP body is required', status=400)
        
        print(f"[Avatar] Received local SDP (length={len(local_sdp)})")
        
        client_id = uuid.UUID(client_id_str)
        client_context = client_contexts.get(client_id)
        if not client_context:
            return Response(f'Client not found: {client_id}', status=404)
        
        # Get session configuration
        session = sessions[session_id]
        
        # Debug: Print session config (without sensitive data)
        safe_session = {k: v for k, v in session.items() if 'key' not in k.lower() and 'secret' not in k.lower()}
        print(f"[Avatar] Session config: {json.dumps({k: str(v) for k, v in safe_session.items()}, indent=2)}")
        
        # Connect avatar with session configuration
        avatar_character = (session.get('avatarCharacter') or 'lisa').strip()
        avatar_style = (session.get('avatarStyle') or '').strip()
        background_color = (session.get('backgroundColor') or '#FFFFFFFF').strip()
        is_custom_avatar = bool(session.get('isCustomAvatar', False))
        transparent_background = bool(session.get('transparentBackground', False))
        video_crop = bool(session.get('videoCrop', False))
        use_built_in_voice = bool(session.get('useBuiltInVoice', False))

        target_voice = session.get('targetVoice') or default_tts_voice
        client_context['tts_voice'] = target_voice.strip() if isinstance(target_voice, str) else default_tts_voice
        client_context['session_id'] = session_id
        
        print(f"[Avatar] Connecting listener {client_id} to avatar for session {session_id}")
        print(f"[Avatar] Config: character={avatar_character}, style={avatar_style}, custom={is_custom_avatar}, useBuiltInVoice={use_built_in_voice}")
        
        remote_sdp = connectAvatarInternal(client_id, local_sdp, avatar_character, avatar_style, 
                                          background_color, is_custom_avatar, transparent_background, 
                                          video_crop, use_built_in_voice)
        
        print(f"[Avatar] ✅ Listener avatar connected successfully")
        
        # Return remote SDP as-is - it's already base64 encoded from Azure
        # listener.js will do atob(remoteSdp) -> JSON.parse()
        return Response(remote_sdp, status=200, mimetype='text/plain')
        
    except Exception as e:
        error_msg = f"Listener avatar connection error: {str(e)}"
        print(f"[Avatar] {error_msg}")
        import traceback
        traceback.print_exc()
        return Response(error_msg, status=400, mimetype='text/plain')


@app.route("/api/connectAvatar", methods=["POST"])
def connectAvatar() -> Response:
    """Connect to Azure Avatar Service via WebRTC (legacy route)"""
    client_id = uuid.UUID(request.headers.get('ClientId'))
    client_context = client_contexts.get(client_id)
    if not client_context:
        return Response('Client not found', status=404)
    
    # Get avatar configuration from headers
    avatar_character = request.headers.get('AvatarCharacter', 'lisa')
    avatar_style = request.headers.get('AvatarStyle', 'casual-sitting')
    background_color = request.headers.get('BackgroundColor', '#FFFFFFFF')
    is_custom_avatar = request.headers.get('IsCustomAvatar', 'false').lower() == 'true'
    use_built_in_voice = request.headers.get('UseBuiltInVoice', 'false').lower() == 'true'
    transparent_background = request.headers.get('TransparentBackground', 'false').lower() == 'true'
    video_crop = request.headers.get('VideoCrop', 'false').lower() == 'true'
    client_context['tts_voice'] = request.headers.get('TtsVoice', default_tts_voice)
    
    # Get client SDP from request body
    local_sdp = request.data.decode('utf-8')
    
    try:
        remote_sdp = connectAvatarInternal(client_id, local_sdp, avatar_character, avatar_style,
                                          background_color, is_custom_avatar, transparent_background,
                                          video_crop, use_built_in_voice)
        return Response(remote_sdp, status=200)
    except Exception as e:
        error_msg = str(e)
        print(f"[Avatar] {error_msg}")
        return Response(error_msg, status=400)


def disconnectAvatarInternal(client_id: uuid.UUID):
    """Internal method to disconnect avatar"""
    client_context = client_contexts.get(client_id)
    if not client_context:
        return
    
    if client_context['speech_synthesizer_connection']:
        client_context['speech_synthesizer_connection'].close()
        client_context['speech_synthesizer_connection'] = None
    
    if client_context['speech_synthesizer']:
        client_context['speech_synthesizer'] = None
    
    client_context['speech_synthesizer_connected'] = False
    print(f'[Avatar] Disconnected for client {client_id}')


@app.route("/api/disconnectAvatar", methods=["POST"])
def disconnectAvatar() -> Response:
    """Disconnect from avatar service"""
    client_id = uuid.UUID(request.headers.get('ClientId'))
    disconnectAvatarInternal(client_id)
    return Response('Avatar disconnected', status=200)


@app.route("/api/speak", methods=["POST"])
def speak() -> Response:
    """Speak SSML using avatar"""
    client_id = uuid.UUID(request.headers.get('ClientId'))
    ssml = request.data.decode('utf-8')
    
    client_context = client_contexts.get(client_id)
    if not client_context:
        return Response('Client not found', status=404)
    
    speech_synthesizer = client_context['speech_synthesizer']
    if not speech_synthesizer:
        return Response('Avatar not connected', status=400)
    
    try:
        result = speech_synthesizer.speak_ssml_async(ssml).get()
        if result.reason == speechsdk.ResultReason.Canceled:
            cancellation_details = result.cancellation_details
            error_msg = f"Speech synthesis canceled: {cancellation_details.error_details}"
            print(f"[Speak] {error_msg}")
            return Response(error_msg, status=400)
        
        print('[Speak] ✅ Speech synthesis completed')
        return Response('Speech sent', status=200)
        
    except Exception as e:
        error_msg = f"Speech synthesis error: {str(e)}"
        print(f"[Speak] {error_msg}")
        return Response(error_msg, status=400)


@app.route("/api/startTranslation", methods=["POST"])
def startTranslation() -> Response:
    """Start translation for a session (speaker initiates)"""
    try:
        data = request.get_json()
        session_id = data.get('sessionId')
        # Get client_id from header (primary) or body (fallback)
        client_id_str = request.headers.get('ClientId') or data.get('clientId')
        use_streaming = data.get('useStreaming', False)  # Browser audio streaming mode
        
        if not client_id_str:
            return Response(json.dumps({'error': 'ClientId is required'}), status=400, mimetype='application/json')
        
        if not session_id or session_id not in sessions:
            return Response(json.dumps({'error': 'Invalid session'}), status=404, mimetype='application/json')
        
        client_id = uuid.UUID(client_id_str)
        client_context = client_contexts.get(client_id)
        if not client_context:
            return Response(json.dumps({'error': 'Client not found'}), status=404, mimetype='application/json')
        
        # Link client to session
        client_context['session_id'] = session_id
        session = sessions[session_id]
        session['active'] = True
        session['speaker_client_id'] = str(client_id)
        
        # Get translation config from session
        source_language = session['sourceLanguage']
        target_language = session['targetLanguage']
        target_voice = session.get('targetVoice')
        
        # Start translation using existing logic
        return startTranslationInternal(client_id, source_language, target_language, target_voice, session_id, use_streaming)
        
    except Exception as e:
        error_msg = f"Failed to start translation: {str(e)}"
        print(f"[Translation] {error_msg}")
        return Response(json.dumps({'error': error_msg}), status=400, mimetype='application/json')


@app.route("/api/translateSpeak", methods=["POST"])
def translateSpeak() -> Response:
    """Start continuous speech translation with avatar output (legacy route)"""
    client_id = uuid.UUID(request.headers.get('ClientId'))
    source_language = request.headers.get('SourceLanguage', 'en-US')
    target_language = request.headers.get('TargetLanguage', 'es-ES')
    target_voice = request.headers.get('TargetVoice')  # Optional: specific voice for target language
    
    client_context = client_contexts.get(client_id)
    if not client_context:
        return Response(json.dumps({'error': 'Client not found'}), status=404, mimetype='application/json')
    
    return startTranslationInternal(client_id, source_language, target_language, target_voice, None)


def startTranslationInternal(client_id: uuid.UUID, source_language: str, target_language: str, 
                             target_voice: str, session_id: str = None, use_streaming: bool = False) -> Response:
    """Internal method to start translation"""
    client_context = client_contexts.get(client_id)
    if not client_context:
        return Response(json.dumps({'error': 'Client not found'}), status=404, mimetype='application/json')
    
    try:
        # Configure speech translation
        if speech_private_endpoint:
            translation_config = speechsdk.translation.SpeechTranslationConfig(
                subscription=speech_key, 
                endpoint=speech_private_endpoint)
        else:
            translation_config = speechsdk.translation.SpeechTranslationConfig(
                subscription=speech_key, 
                region=speech_region)
        
        # Set source language for recognition
        translation_config.speech_recognition_language = source_language
        
        # Add target language for translation
        target_lang_code = target_language.split('-')[0]  # Extract 'es' from 'es-ES'
        translation_config.add_target_language(target_lang_code)
        
        # Configure audio input based on mode
        if use_streaming:
            # Use push audio stream for browser audio streaming
            # Audio format: 16kHz, 16-bit, mono PCM
            audio_format = speechsdk.audio.AudioStreamFormat(samples_per_second=16000, bits_per_sample=16, channels=1)
            push_stream = speechsdk.audio.PushAudioInputStream(stream_format=audio_format)
            audio_config = speechsdk.audio.AudioConfig(stream=push_stream)
            
            # Store push stream for receiving audio data
            client_context['push_audio_stream'] = push_stream
            print(f"[Translation] Using browser audio streaming mode")
        else:
            # Use default microphone for local testing
            audio_config = speechsdk.audio.AudioConfig(use_default_microphone=True)
            print(f"[Translation] Using local microphone mode")
        
        # Create translation recognizer
        translation_recognizer = speechsdk.translation.TranslationRecognizer(
            translation_config=translation_config, 
            audio_config=audio_config)
        
        print(f"[Translation] Starting: {source_language} → {target_language}")
        
        # Callback for final recognition results
        def recognized_cb(evt):
            if evt.result.reason == speechsdk.ResultReason.TranslatedSpeech:
                recognized_text = evt.result.text
                if target_lang_code in evt.result.translations:
                    translated_text = evt.result.translations[target_lang_code]
                    print(f"[Translation] {recognized_text} → {translated_text}")
                    
                    # Determine voice to use for avatar speech
                    voice_to_use = target_voice if target_voice else client_context['tts_voice']
                    
                    # Build SSML for avatar speech
                    ssml = f"""<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='{target_language}'>
                                 <voice name='{voice_to_use}'>
                                     <mstts:leadingsilence-exact value='0'/>
                                     {html.escape(translated_text)}
                                 </voice>
                               </speak>"""
                    
                    # For session-based translation, speak via all listeners' avatars
                    if session_id:
                        # Find all listener clients for this session and make their avatars speak
                        listeners_spoken = 0
                        for cid, ctx in client_contexts.items():
                            if ctx.get('session_id') == session_id and ctx.get('speech_synthesizer'):
                                # This is a listener with an avatar connection
                                try:
                                    result = ctx['speech_synthesizer'].speak_ssml_async(ssml).get()
                                    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                                        listeners_spoken += 1
                                    else:
                                        print(f"[Translation] Avatar speech failed for listener {cid}: {result.reason}")
                                except Exception as speak_err:
                                    print(f"[Translation] Error speaking to listener {cid}: {speak_err}")
                        
                        if listeners_spoken > 0:
                            print(f'[Translation] ✅ Avatar spoke to {listeners_spoken} listener(s)')
                        else:
                            print(f'[Translation] ⚠️ No listeners with avatar connection found')
                    else:
                        # Legacy mode - speak via the client's own avatar
                        if client_context['speech_synthesizer']:
                            result = client_context['speech_synthesizer'].speak_ssml_async(ssml).get()
                            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                                print('[Translation] ✅ Avatar spoke translation')
                    
                    # Broadcast to session room or client room
                    if enable_websockets:
                        try:
                            room_id = session_id if session_id else str(client_id)
                            with app.app_context():
                                socketio.emit("translationResult", {
                                    'sourceText': recognized_text,
                                    'translatedText': translated_text,
                                    'sourceLanguage': source_language,
                                    'targetLanguage': target_language,
                                    'timestamp': datetime.datetime.now().isoformat()
                                }, room=room_id)
                                
                                # Also emit legacy format for backwards compatibility
                                socketio.emit("response", {
                                    'path': 'api.translation',
                                    'sourceText': recognized_text,
                                    'translatedText': translated_text,
                                    'sourceLanguage': source_language,
                                    'targetLanguage': target_language
                                }, room=room_id)
                                
                                print(f"[Translation] ✅ Result broadcast to room {room_id}")
                        except Exception as socket_err:
                            print(f"[Translation] Socket.IO error: {socket_err}")
            elif evt.result.reason == speechsdk.ResultReason.NoMatch:
                print(f"[Translation] No speech recognized")
        
        # Callback for errors
        def canceled_cb(evt):
            if evt.result.reason == speechsdk.ResultReason.Canceled:
                cancellation = evt.result.cancellation_details
                print(f"[Translation] Canceled: {cancellation.reason}")
                if cancellation.reason == speechsdk.CancellationReason.Error:
                    print(f"[Translation] Error: {cancellation.error_details}")
        
        # Connect callbacks
        translation_recognizer.recognized.connect(recognized_cb)
        translation_recognizer.canceled.connect(canceled_cb)
        
        # Start continuous recognition
        translation_recognizer.start_continuous_recognition()
        
        # Store recognizer in context for later cleanup
        client_context['translation_recognizer'] = translation_recognizer
        
        return Response(json.dumps({
            'status': 'started',
            'sourceLanguage': source_language,
            'targetLanguage': target_language,
            'message': 'Translation started. Speak into your microphone.'
        }), status=200, mimetype='application/json')
        
    except Exception as e:
        error_msg = f"Translation failed: {str(e)}"
        print(f"[Translation] {error_msg}")
        return Response(json.dumps({
            'status': 'error',
            'error': error_msg
        }), status=400, mimetype='application/json')


@app.route("/api/stopTranslation", methods=["POST"])
def stopTranslation() -> Response:
    """Stop continuous speech translation"""
    client_id = uuid.UUID(request.headers.get('ClientId'))
    
    client_context = client_contexts.get(client_id)
    if not client_context:
        return Response(json.dumps({'error': 'Client not found'}), status=404, mimetype='application/json')
    
    try:
        translation_recognizer = client_context.get('translation_recognizer')
        
        if translation_recognizer:
            translation_recognizer.stop_continuous_recognition()
            client_context['translation_recognizer'] = None
            print("[Translation] Stopped")
        
        # Close push audio stream if exists
        push_stream = client_context.get('push_audio_stream')
        if push_stream:
            push_stream.close()
            client_context['push_audio_stream'] = None
            print("[Translation] Audio stream closed")
        
        return Response(json.dumps({
            'status': 'stopped',
            'message': 'Translation stopped.'
        }), status=200, mimetype='application/json')
        
    except Exception as e:
        error_msg = f"Failed to stop translation: {str(e)}"
        print(f"[Translation] {error_msg}")
        return Response(json.dumps({
            'status': 'error',
            'error': error_msg
        }), status=400, mimetype='application/json')


# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f'[SocketIO] Client connected: {request.sid}')


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f'[SocketIO] Client disconnected: {request.sid}')
    
    # Remove from session listeners if applicable
    for session_id, listeners in list(session_listeners.items()):
        if request.sid in listeners:
            listeners.remove(request.sid)
            print(f'[SocketIO] Removed {request.sid} from session {session_id}')
            
            # Update listener count for session
            emit('listenerCountUpdated', {
                'count': len(listeners)
            }, room=session_id)


@socketio.on('join')
def handle_join(data):
    """Handle client joining room"""
    room = data['room']
    join_room(room)
    print(f'[SocketIO] Client {request.sid} joined room {room}')


@socketio.on('joinSession')
def handle_join_session(data):
    """Handle listener joining a translation session"""
    session_id = data.get('sessionId')
    
    if not session_id or session_id not in sessions:
        emit('error', {'message': 'Invalid session'})
        return
    
    # Add to session room
    join_room(session_id)
    
    # Track listener
    if session_id not in session_listeners:
        session_listeners[session_id] = set()
    session_listeners[session_id].add(request.sid)
    
    print(f'[SocketIO] Listener {request.sid} joined session {session_id}')
    
    # Notify speaker of new listener
    emit('listenerJoined', {
        'sessionId': session_id,
        'listenerCount': len(session_listeners[session_id])
    }, room=session_id)
    
    # Send updated count to all in session
    emit('listenerCountUpdated', {
        'count': len(session_listeners[session_id])
    }, room=session_id)


@socketio.on('audioData')
def handle_audio_data(data):
    """Handle incoming audio data from speaker's browser"""
    try:
        session_id = data.get('sessionId')
        client_id_str = data.get('clientId')
        audio_data = data.get('audio')  # Int16 array
        
        if not session_id or not client_id_str or not audio_data:
            return
        
        client_id = uuid.UUID(client_id_str)
        client_context = client_contexts.get(client_id)
        
        if not client_context:
            return
        
        # Get the push audio stream for this client
        push_stream = client_context.get('push_audio_stream')
        if push_stream:
            # Convert int16 array back to bytes
            import struct
            audio_bytes = struct.pack(f'{len(audio_data)}h', *audio_data)
            push_stream.write(audio_bytes)
    except Exception as e:
        print(f'[AudioData] Error processing audio: {e}')


# Start background threads
if enable_token_auth_for_speech or speech_private_endpoint:
    speech_token_refresh_thread = threading.Thread(target=refreshSpeechToken, daemon=True)
    speech_token_refresh_thread.start()

ice_token_refresh_thread = threading.Thread(target=refreshIceToken, daemon=True)
ice_token_refresh_thread.start()


if __name__ == '__main__':
    # Run with eventlet for WebSocket support
    import eventlet
    import eventlet.wsgi
    
    # Monkey patch for eventlet compatibility
    eventlet.monkey_patch()
    
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 5000))
    
    print(f"""
╔═══════════════════════════════════════════════════════════╗
║  Speech Translation Avatar Application                    ║
║  Listening on http://0.0.0.0:{port}                      ║
║  Press Ctrl+C to stop                                     ║
╚═══════════════════════════════════════════════════════════╝
    """)
    
    # Run with socketio
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
