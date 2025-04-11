// Nag Digital Twin v3.5.0 - Core Module
console.log("Nag Digital Twin v3.5.0 loading...");

// Initialize the application when ready
function initializeApp() {
    console.log("Initializing application...");
    window.logDebug("Starting application initialization");
    
    // Ensure DOM elements are cached
    cacheElements();
    
    // Setup event listeners
    setupEventListeners();
    
    // Try to unlock audio context (especially important for Safari)
    unlockAudioContext().then(unlocked => {
        console.log("Audio context unlock attempt:", unlocked ? "success" : "waiting for user interaction");
        window.logDebug("Audio context unlock: " + (unlocked ? "success" : "waiting for user interaction"));
    });
    
    // Setup WebSocket connection if needed
    try {
        connectWebSocket();
    } catch (error) {
        console.error("Failed to connect WebSocket:", error);
        window.logDebug("WebSocket connection error: " + error.message);
    }
    
    // Initialize browser detection
    detectBrowserCapabilities();
    
    // Mark as initialized
    window.nagState.initialized = true;
    console.log("Application initialized successfully");
    window.addStatusMessage("Ready to start conversation", "info");
}

// Function to cache DOM elements
function cacheElements() {
    window.nagElements = {
        orb: document.getElementById('orb'),
        audio: document.getElementById('audio'),
        volumeBar: document.getElementById('volumeBar'),
        toggleBtn: document.getElementById('toggleBtn'),
        pauseBtn: document.getElementById('pauseBtn'),
        modeToggle: document.getElementById('modeToggle'),
        modeHint: document.getElementById('modeHint'),
        debugPanel: document.getElementById('debugPanel'),
        statusPanel: document.getElementById('statusPanel'),
        messageContainer: document.getElementById('messageContainer'),
        debugToggle: document.getElementById('debugToggle')
    };
    
    // Verify all required elements
    const required = ['orb', 'audio', 'toggleBtn', 'pauseBtn', 'modeToggle', 'statusPanel', 'messageContainer'];
    const missing = required.filter(id => !window.nagElements[id]);
    
    if (missing.length > 0) {
        console.error("Missing required UI elements:", missing);
        window.logDebug("Missing required UI elements: " + missing.join(', '));
    }
}

// Set up event listeners
function setupEventListeners() {
    console.log("Setting up event listeners");
    
    const { orb, toggleBtn, pauseBtn, modeToggle } = window.nagElements;
    
    // Toggle button controls start/stop conversation
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            window.logDebug("Toggle button clicked");
            
            if (window.nagState.listening) {
                // Stop listening
                stopListening();
                toggleBtn.textContent = "Start Conversation";
                window.addStatusMessage("Conversation stopped", "info");
            } else {
                // Start listening
                startListening();
                toggleBtn.textContent = "Stop Conversation";
                window.addStatusMessage("Conversation started", "info");
            }
        });
    }
    
    // Pause button temporarily pauses conversation
    if (pauseBtn) {
        pauseBtn.addEventListener('click', function() {
            window.logDebug("Pause button clicked");
            
            if (window.nagState.isPaused) {
                // Resume conversation
                window.nagState.isPaused = false;
                pauseBtn.textContent = "Pause";
                window.addStatusMessage("Conversation resumed", "info");
                
                if (!window.nagState.isWalkieTalkieMode) {
                    startListening();
                }
            } else {
                // Pause conversation
                window.nagState.isPaused = true;
                pauseBtn.textContent = "Resume";
                window.addStatusMessage("Conversation paused", "info");
                
                if (window.nagState.listening) {
                    stopListening();
                }
            }
        });
    }
    
    // Mode toggle switches between continuous and walkie-talkie modes
    if (modeToggle) {
        modeToggle.addEventListener('click', function() {
            window.logDebug("Mode toggle button clicked");
            
            // Toggle mode
            window.nagState.isWalkieTalkieMode = !window.nagState.isWalkieTalkieMode;
            
            // Update UI
            modeToggle.textContent = window.nagState.isWalkieTalkieMode ? 
                "Switch to Continuous Mode" : "Switch to Walkie-Talkie Mode";
            
            // Update hint
            if (window.nagElements.modeHint) {
                window.nagElements.modeHint.textContent = window.nagState.isWalkieTalkieMode ?
                    "Press and hold the orb to speak" : "Click the orb to start listening";
            }
            
            // Enable or disable silence detection based on mode
            if (window.setSilenceDetection) {
                // Only use silence detection in continuous mode
                window.setSilenceDetection(!window.nagState.isWalkieTalkieMode);
            }
            
            window.addStatusMessage(
                window.nagState.isWalkieTalkieMode ? 
                "Switched to walkie-talkie mode" : "Switched to continuous mode", 
                "info"
            );
        });
    }
    
    // Orb interactions
    if (orb) {
        // Main click handler with coordinated prevention to avoid duplicate events
        orb.addEventListener('click', function(e) {
            // If this is a simulated click from touchend, ignore it
            if (window.nagState.ignoringNextClick) {
                window.nagState.ignoringNextClick = false;
                return;
            }
            
            window.logDebug("Orb clicked");
            
            // Always try to unlock audio on click
            unlockAudioContext().then(() => {
                if (window.nagState.isWalkieTalkieMode) return; // Don't handle click in walkie-talkie mode
                
                if (window.nagState.isPaused) {
                    window.addStatusMessage("Conversation is paused. Press Resume to continue.", "info");
                    return;
                }
                
                // If we're in the middle of processing audio, ignore clicks
                if (orb.classList.contains("thinking") || orb.classList.contains("speaking")) {
                    // Already processing or speaking, do nothing
                    window.logDebug("Ignoring orb click while processing/speaking");
                } else if (orb.classList.contains("listening")) {
                    // We're listening, stop
                    if (window.stopRecording) {
                        window.stopRecording();
                    }
                } else {
                    // We're idle, start recording
                    if (window.startRecording) {
                        window.startRecording();
                    }
                }
            });
        });
        
        // For walkie-talkie mode: mousedown/mouseup with enhanced touch handling
        orb.addEventListener('mousedown', function(e) {
            if (!window.nagState.isWalkieTalkieMode || window.nagState.isPaused) return;
            
            // Try to unlock audio
            unlockAudioContext().then(() => {
                e.preventDefault();
                window.nagState.walkieTalkieActive = true;
                orb.classList.remove("idle");
                orb.classList.add("listening");
                
                if (window.startRecording) {
                    window.startRecording();
                }
            });
        });
        
        orb.addEventListener('mouseup', function() {
            if (!window.nagState.isWalkieTalkieMode || !window.nagState.walkieTalkieActive) return;
            
            window.nagState.walkieTalkieActive = false;
            orb.classList.remove("listening");
            orb.classList.add("thinking");
            
            if (window.stopRecording) {
                window.stopRecording();
            }
        });
        
        // Ensure we catch mouse leaving the element
        orb.addEventListener('mouseleave', function() {
            if (!window.nagState.isWalkieTalkieMode || !window.nagState.walkieTalkieActive) return;
            
            window.nagState.walkieTalkieActive = false;
            orb.classList.remove("listening");
            orb.classList.add("thinking");
            
            if (window.stopRecording) {
                window.stopRecording();
            }
        });
        
        // Touch events for mobile with better coordination
        orb.addEventListener('touchstart', function(e) {
            if (!window.nagState.isWalkieTalkieMode || window.nagState.isPaused) return;
            
            // Try to unlock audio (crucial for iOS)
            unlockAudioContext().then(() => {
                e.preventDefault(); // Important for mobile
                window.nagState.walkieTalkieActive = true;
                orb.classList.remove("idle");
                orb.classList.add("listening");
                
                if (window.startRecording) {
                    window.startRecording();
                }
            });
        }, { passive: false }); // Non-passive to allow preventDefault
        
        orb.addEventListener('touchend', function(e) {
            if (!window.nagState.isWalkieTalkieMode || !window.nagState.walkieTalkieActive) return;
            
            // Set flag to ignore the next click event (which might be generated by this touchend)
            window.nagState.ignoringNextClick = true;
            setTimeout(() => {
                window.nagState.ignoringNextClick = false;
            }, 300); // Reset after 300ms
            
            e.preventDefault();
            window.nagState.walkieTalkieActive = false;
            orb.classList.remove("listening");
            orb.classList.add("thinking");
            
            if (window.stopRecording) {
                window.stopRecording();
            }
        }, { passive: false });
        
        orb.addEventListener('touchcancel', function() {
            if (!window.nagState.isWalkieTalkieMode || !window.nagState.walkieTalkieActive) return;
            
            window.nagState.walkieTalkieActive = false;
            orb.classList.remove("listening");
            orb.classList.add("idle"); // Go back to idle on cancel, not thinking
            
            if (window.stopRecording) {
                window.stopRecording();
            }
        });
    }
    
    // Setup key controls if enabled
    setupKeyboardControls();
    
    // Setup global error handling
    window.addEventListener('error', function(event) {
        window.logDebug("Global error: " + event.message);
        // Don't reset UI on all errors, just log them
    });
}

// Setup keyboard shortcuts
function setupKeyboardControls() {
    document.addEventListener('keydown', function(e) {
        // Only handle if keyboard controls are enabled
        if (!window.nagState.keyboardControlsEnabled) return;
        
        // Space bar to toggle recording when not in an input
        if (e.key === ' ' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            
            if (window.nagState.isPaused) return;
            
            const orb = window.nagElements.orb;
            if (orb.classList.contains("listening")) {
                if (window.stopRecording) window.stopRecording();
            } else if (orb.classList.contains("idle")) {
                if (window.startRecording) window.startRecording();
            }
        }
        
        // Escape key to cancel recording
        if (e.key === 'Escape') {
            const orb = window.nagElements.orb;
            if (orb.classList.contains("listening")) {
                // Stop without processing
                if (window.cleanupRecording) window.cleanupRecording();
                orb.classList.remove("listening");
                orb.classList.add("idle");
                window.addStatusMessage("Recording canceled", "info");
            }
        }
    });
}

// WebSocket connection with fallback and reconnection
function connectWebSocket() {
    try {
        // Close any existing connection
        if (window.nagState.webSocket) {
            try {
                window.nagState.webSocket.close();
            } catch (e) {
                // Ignore errors closing previous connection
            }
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        console.log(`Attempting WebSocket connection to: ${wsUrl}`);
        
        const nagWebSocket = new WebSocket(wsUrl);
        window.nagState.webSocket = nagWebSocket;
        
        nagWebSocket.onopen = () => {
            console.log('WebSocket connection established');
            window.logDebug('Connected to server successfully');
            window.addStatusMessage('Connected to server', 'info');
            
            // Reset reconnect attempts
            window.nagState.wsReconnectAttempts = 0;
            
            // Setup periodic ping to keep connection alive
            if (window.nagState.wsPingInterval) {
                clearInterval(window.nagState.wsPingInterval);
            }
            
            window.nagState.wsPingInterval = setInterval(() => {
                if (nagWebSocket.readyState === WebSocket.OPEN) {
                    try {
                        nagWebSocket.send(JSON.stringify({ type: 'ping' }));
                    } catch (e) {
                        window.logDebug("Error sending ping: " + e.message);
                    }
                }
            }, 30000); // Every 30 seconds
        };
        
        nagWebSocket.onclose = (event) => {
            console.log('WebSocket closed', event.code, event.reason);
            window.logDebug(`WebSocket connection closed: ${event.code} - ${event.reason || 'No reason provided'}`);
            
            // Clear ping interval
            if (window.nagState.wsPingInterval) {
                clearInterval(window.nagState.wsPingInterval);
                window.nagState.wsPingInterval = null;
            }
            
            // Attempt reconnection if appropriate
            if (window.nagState.wsReconnectAttempts < 5) {
                window.nagState.wsReconnectAttempts = (window.nagState.wsReconnectAttempts || 0) + 1;
                const delay = Math.min(30000, Math.pow(2, window.nagState.wsReconnectAttempts) * 1000);
                
                window.logDebug(`Attempting to reconnect in ${delay/1000} seconds (attempt ${window.nagState.wsReconnectAttempts})`);
                
                setTimeout(() => {
                    if (!window.nagState.webSocket || window.nagState.webSocket.readyState !== WebSocket.OPEN) {
                        connectWebSocket();
                    }
                }, delay);
            } else {
                window.addStatusMessage('Server connection lost, operating in offline mode', 'error');
            }
        };
        
        nagWebSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            window.logDebug('WebSocket connection error');
        };
        
        nagWebSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle different message types
                switch (data.type) {
                    case 'status':
                        window.addStatusMessage(data.message, data.status || 'info');
                        break;
                    case 'pong':
                        window.logDebug("Received pong from server");
                        break;
                    case 'command':
                        handleServerCommand(data);
                        break;
                    default:
                        window.logDebug("Received unknown message type: " + data.type);
                }
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
                window.logDebug("Error parsing WebSocket message: " + e.message);
            }
        };
        
        return nagWebSocket;
    } catch (e) {
        console.error('WebSocket initialization error:', e);
        window.logDebug('Could not initialize WebSocket: ' + e.message);
        window.addStatusMessage('Operating in offline mode', 'info');
        return null;
    }
}

// Handle commands from server
function handleServerCommand(data) {
    try {
        switch (data.command) {
            case 'refresh':
                window.logDebug("Received refresh command from server");
                window.location.reload();
                break;
            case 'play':
                if (data.url && window.nagElements.audio) {
                    window.logDebug("Playing audio from server: " + data.url);
                    window.nagElements.audio.src = data.url;
                    window.nagElements.audio.play().catch(e => {
                        window.logDebug("Error playing server audio: " + e.message);
                    });
                }
                break;
            case 'message':
                if (data.message) {
                    window.addStatusMessage(data.message, data.level || 'info');
                }
                break;
            default:
                window.logDebug("Unknown server command: " + data.command);
        }
    } catch (e) {
        window.logDebug("Error handling server command: " + e.message);
    }
}

// Audio context unlocking (important for Safari)
async function unlockAudioContext() {
    if (window.nagState.audioContextUnlocked) return true;
    
    try {
        // Create audio context if not exists
        if (!window.nagState.audioContext) {
            window.nagState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume context (needed for Safari)
        if (window.nagState.audioContext.state === 'suspended') {
            await window.nagState.audioContext.resume();
        }
        
        // Create and play a silent buffer (crucial for Safari)
        const buffer = window.nagState.audioContext.createBuffer(1, 1, 22050);
        const source = window.nagState.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(window.nagState.audioContext.destination);
        source.start(0);
        
        // Also try to play the audio element (extra safety for Safari)
        if (window.nagElements.audio) {
            const audio = window.nagElements.audio;
            audio.preload = "auto";
            audio.controls = false;
            audio.muted = true;
            audio.volume = 0;
            audio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADQgD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwAQAAAAAAAAAAABSAJAJAQgAAgAAAA0L2YLwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZB4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";
            audio.setAttribute('playsinline', '');
            audio.setAttribute('webkit-playsinline', '');
            
            try {
                await audio.play();
                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;
                audio.volume = 1.0;
            } catch (e) {
                console.log("Auto-play prevented: User interaction needed");
                window.logDebug("Auto-play prevented: " + e.message);
                return false;
            }
        }
        
        window.nagState.audioContextUnlocked = true;
        window.logDebug("Audio context unlocked successfully");
        return true;
    } catch (error) {
        console.error("Error unlocking audio context:", error);
        window.logDebug("Error unlocking audio context: " + error.message);
        return false;
    }
}

// FIXED: Browser detection and capability checks
function detectBrowserCapabilities() {
    // Detect browser type
    const userAgent = navigator.userAgent;
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isEdge = /Edg/.test(userAgent);
    
    // Store in global state
    window.nagState.isSafari = isSafari;
    window.nagState.isiOS = isIOS;
    window.nagState.isChrome = isChrome;
    window.nagState.isFirefox = isFirefox;
    window.nagState.isEdge = isEdge;
    
    // Check for MediaRecorder support
    window.nagState.hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    
    // Check for WebRTC support
    window.nagState.hasWebRTC = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    
    // Check for AudioContext support
    window.nagState.hasAudioContext = !!(window.AudioContext || window.webkitAudioContext);
    
    // FIXED: Safely check for AudioWorklet support without causing errors
    window.nagState.hasAudioWorklet = false; // Default to false
    
    if (window.nagState.hasAudioContext) {
        try {
            // Only check if we already have an initialized audioContext
            if (window.nagState.audioContext) {
                // Safely check if audioWorklet is available using property check
                const hasWorkletProperty = 'audioWorklet' in window.nagState.audioContext;
                window.nagState.hasAudioWorklet = hasWorkletProperty;
            }
        } catch (e) {
            console.error("Error checking AudioWorklet support:", e);
            window.logDebug("AudioWorklet check error: " + e.message);
        }
    }
    
    // Log capabilities
    window.logDebug(`Browser detection: ${isSafari ? 'Safari' : isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isEdge ? 'Edge' : 'Other'}`);
    window.logDebug(`iOS device: ${isIOS}`);
    window.logDebug(`MediaRecorder support: ${window.nagState.hasMediaRecorder}`);
    window.logDebug(`WebRTC support: ${window.nagState.hasWebRTC}`);
    window.logDebug(`AudioContext support: ${window.nagState.hasAudioContext}`);
    window.logDebug(`AudioWorklet support: ${window.nagState.hasAudioWorklet}`);
    
    // Apply browser-specific settings
    applyBrowserSpecificSettings();
}

// Apply browser-specific optimizations
function applyBrowserSpecificSettings() {
    // iOS/Safari specific optimizations
    if (window.nagState.isSafari || window.nagState.isiOS) {
        // Enable audio quality adjustments for Safari
        if (window.adjustAudioQuality) {
            window.adjustAudioQuality("medium"); // Use medium quality for Safari
        }
        
        // Add iOS-specific event handlers for audio elements
        if (window.nagElements.audio) {
            const audio = window.nagElements.audio;
            
            // On iOS, we need this to enable inline playback
            audio.setAttribute('playsinline', '');
            audio.setAttribute('webkit-playsinline', '');
            
            // iOS often pauses audio when app goes to background
            // Resume playback when becoming visible again
            document.addEventListener('visibilitychange', function() {
                if (document.visibilityState === 'visible' && 
                    audio.paused && 
                    audio.currentTime > 0 && 
                    audio.currentTime < audio.duration) {
                    
                    audio.play().catch(e => {
                        window.logDebug("Error resuming audio: " + e.message);
                    });
                }
            });
        }
    }
    
    // Chrome-specific optimizations
    if (window.nagState.isChrome) {
        // Chrome can handle higher quality audio
        if (window.adjustAudioQuality) {
            window.adjustAudioQuality("high");
        }
    }
    
    // Firefox-specific optimizations
    if (window.nagState.isFirefox) {
        // Firefox works well with opus codec
        if (window.testMimeTypeSupport && window.testMimeTypeSupport('audio/webm;codecs=opus')) {
            window.logDebug("Using opus codec for Firefox");
        }
    }
}

// Start listening for audio - delegate to recording module
async function startListening() {
    try {
        // Unlock audio context first
        await unlockAudioContext();
        
        // If we already have a dedicated recording function, use it
        if (window.startRecording) {
            const result = await window.startRecording();
            
            // Update UI that's not handled by the recording module
            if (result) {
                window.nagState.listening = true;
                window.nagElements.toggleBtn.textContent = "Stop Conversation";
                window.nagElements.pauseBtn.disabled = false;
            }
            
            return result;
        } else {
            console.error("startRecording function not available");
            window.logDebug("Error: startRecording function missing");
            window.addStatusMessage("Error starting recording: function not found", "error");
            return false;
        }
    } catch (error) {
        console.error("Error starting listening:", error);
        window.logDebug("Error starting listening: " + error.message);
        window.addStatusMessage("Error accessing microphone. Please check permissions.", "error");
        return false;
    }
}

// Stop listening - delegate to recording module
function stopListening() {
    try {
        // If we have a dedicated recording function, use it
        if (window.stopRecording) {
            const result = window.stopRecording();
            
            // Update UI that's not handled by the recording module
            window.nagState.listening = false;
            window.nagElements.toggleBtn.textContent = "Start Conversation";
            window.nagElements.pauseBtn.disabled = true;
            
            // Also clean up resources if we have that function
            if (window.cleanupRecording) {
                window.cleanupRecording();
            }
            
            return result;
        } else {
            console.error("stopRecording function not available");
            window.logDebug("Error: stopRecording function missing");
            window.addStatusMessage("Error stopping recording: function not found", "error");
            return false;
        }
    } catch (error) {
        console.error("Error stopping listening:", error);
        window.logDebug("Error stopping listening: " + error.message);
        return false;
    }
}

// FIXED: Process audio and send for transcription
async function processAudioAndTranscribe() {
    try {
        // Update UI to show processing
        window.nagElements.orb.classList.remove("listening");
        window.nagElements.orb.classList.add("thinking");
        window.addStatusMessage("Processing audio...", "info");
        
        // Determine correct mime type
        let mimeType = window.nagState.isSafari ? "audio/mp4" : "audio/webm";
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.mimeType) {
            mimeType = window.nagState.mediaRecorder.mimeType;
        }
        
        // Enhanced Safari-specific validation
        if (window.nagState.isSafari || window.nagState.isiOS) {
            window.logDebug(`Safari audio processing - chunks: ${window.nagState.audioChunks.length}`);
            
            // FIXED: Allow processing with single chunk for Safari if it's big enough
            if (window.nagState.audioChunks.length < 2 && !window.nagState.forceSafariProcessing) {
                const totalSize = window.nagState.audioChunks.reduce((acc, chunk) => acc + chunk.size, 0);
                if (totalSize < 5000) {  // If less than 5KB and only one chunk
                    window.logDebug("Safari: Single chunk is too small, might be truncated audio");
                    window.addStatusMessage("Not enough audio recorded. Please speak longer next time.", "info");
                    
                    // Reset UI
                    window.nagElements.orb.classList.remove("thinking");
                    window.nagElements.orb.classList.add("idle");
                    return;
                } else {
                    // Single chunk but big enough
                    window.logDebug("Safari: Single chunk is large enough to process");
                }
            }
            
            // Force audio/mp4 for Safari
            mimeType = "audio/mp4";
            window.logDebug("Forcing audio/mp4 for Safari processing");
        }
        
        // Enhanced logging of chunks for debugging
        window.logDebug(`Processing ${window.nagState.audioChunks.length} audio chunks:`);
        window.nagState.audioChunks.forEach((chunk, index) => {
            window.logDebug(`  Chunk ${index+1}: ${chunk.size} bytes`);
        });
        
        // Create blob from chunks - this combines all audio chunks into a single file
        const audioBlob = new Blob(window.nagState.audioChunks, { type: mimeType });
        window.logDebug(`Audio blob created: ${audioBlob.size} bytes, type: ${mimeType}`);
        
        // Check if audio is too small
        if (audioBlob.size < 1000) { // Less than 1KB is probably just noise
            window.logDebug("Audio too small to process: " + audioBlob.size + " bytes");
            window.addStatusMessage("Audio too quiet or too short. Please speak louder or longer.", "info");
            
            // Reset UI
            window.nagElements.orb.classList.remove("thinking");
            window.nagElements.orb.classList.add("idle");
            return;
        }
        
        // Create form data with additional metadata to help server process correctly
        const formData = new FormData();
        const fileExt = mimeType.includes("webm") ? "webm" : "mp4";
        formData.append("file", audioBlob, `recording.${fileExt}`);
        
        // Add browser-specific info to help server process
        formData.append("browser", window.nagState.isSafari ? "safari" : 
                                  window.nagState.isChrome ? "chrome" : 
                                  window.nagState.isFirefox ? "firefox" : 
                                  window.nagState.isEdge ? "edge" : "other");
        formData.append("mime_type", mimeType);
        formData.append("chunk_count", window.nagState.audioChunks.length.toString());
        formData.append("total_size", audioBlob.size.toString());
        
        // If we have a device ID, include it
        if (window.nagState.selectedDeviceId) {
            formData.append("device_id", window.nagState.selectedDeviceId);
        }
        
        // ENHANCED: Add Safari-specific flags
        if (window.nagState.isSafari || window.nagState.isiOS) {
            formData.append("safari", "true");
            formData.append("ios", window.nagState.isiOS ? "true" : "false");
            formData.append("format", "mp4");
            formData.append("sample_rate", "44100");
        }
        
        // Set a timeout to prevent getting stuck - longer for Safari
        const timeoutDuration = (window.nagState.isSafari || window.nagState.isiOS) ? 15000 : 10000;
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Transcription request timed out")), timeoutDuration);
        });
        
        // Send to server
        window.logDebug("Sending audio for transcription...");
        const fetchPromise = fetch("/transcribe", {
            method: "POST",
            body: formData
        });
        
        // Use Promise.race to implement timeout
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Transcription failed");
        }
        
        const data = await response.json();
        window.logDebug("Transcription response received");
        
        // Process transcription
        const transcription = data.transcription || data.transcript || "";
        if (transcription.trim()) {
            window.logDebug(`Transcription: ${transcription}`);
            // Add user message to UI
            window.addStatusMessage(transcription, "user");
            
            // Send to chat endpoint
            await sendToChat(transcription);
        } else {
            window.logDebug("Empty transcription received");
            window.addStatusMessage("No speech detected. Please try again.", "info");
            
            // Reset UI
            window.nagElements.orb.classList.remove("thinking");
            window.nagElements.orb.classList.add("idle");
        }
    } catch (error) {
        console.error("Error processing audio:", error);
        window.logDebug("Error processing audio: " + error.message);
        window.addStatusMessage("Error processing audio: " + error.message, "error");
        
        // Reset UI
        window.nagElements.orb.classList.remove("thinking");
        window.nagElements.orb.classList.add("idle");
    }
}

// Send transcription to chat endpoint
async function sendToChat(message) {
  try {
      // Update UI
      window.nagElements.orb.classList.remove("listening");
      window.nagElements.orb.classList.add("thinking");
      window.addStatusMessage("Thinking...", "info");
      
      // Set a timeout to prevent getting stuck
      const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Chat request timed out")), 15000);
      });
      
      // Prepare request with additional metadata
      const requestData = {
          message: message,
          mode: "voice",
          request_id: Date.now().toString(),
          browser: window.nagState.isSafari ? "safari" : 
                   window.nagState.isChrome ? "chrome" : 
                   window.nagState.isFirefox ? "firefox" : 
                   window.nagState.isEdge ? "edge" : "other",
          device: window.nagState.isiOS ? "ios" : "desktop"
      };
      
      // Send request
      window.logDebug("Sending to chat endpoint...");
      const fetchPromise = fetch("/chat", {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify(requestData)
      });
      
      // Use Promise.race to implement timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Chat response failed");
      }
      
      const data = await response.json();
      window.logDebug("Chat response received");
      
      // Display response message
      if (data.response) {
          window.addStatusMessage(data.response, "assistant");
      }
      
      // Play audio if available
      if (data.audio_url || data.tts_url) {
          const audioUrl = data.audio_url || data.tts_url;
          window.logDebug(`Audio URL: ${audioUrl}`);
          
          // Update UI
          window.nagElements.orb.classList.remove("thinking");
          window.nagElements.orb.classList.add("speaking");
          
          // Play audio
          const audio = window.nagElements.audio;
          
          // Add cache-busting parameter to prevent caching issues
          const cacheBuster = Date.now();
          const urlWithCacheBuster = audioUrl.includes('?') 
              ? `${audioUrl}&_cb=${cacheBuster}` 
              : `${audioUrl}?_cb=${cacheBuster}`;
          
          audio.src = urlWithCacheBuster;
          
          // Set up event handlers
          audio.onloadeddata = () => {
              window.logDebug("Audio loaded, playing...");
              audio.play().catch(error => {
                  console.error("Error playing audio:", error);
                  window.logDebug("Error playing audio: " + error.message);
                  
                  // Reset UI in case of error
                  window.nagElements.orb.classList.remove("speaking");
                  window.nagElements.orb.classList.add("idle");
                  
                  // Try showing play button as fallback
                  if (window.showPlayButton) {
                      window.showPlayButton(audioUrl);
                  }
              });
          };
          
          audio.onended = () => {
              window.logDebug("Audio playback ended");
              // Reset UI
              window.nagElements.orb.classList.remove("speaking");
              window.nagElements.orb.classList.add("idle");
              
              // In continuous mode, start listening again if not paused
              if (!window.nagState.isWalkieTalkieMode && 
                  window.nagState.listening && 
                  !window.nagState.isPaused) {
                  startListening();
              }
          };
          
          audio.onerror = (event) => {
              window.logDebug(`Audio playback error: ${event.type}`);
              // Reset UI
              window.nagElements.orb.classList.remove("speaking");
              window.nagElements.orb.classList.add("idle");
              
              // Try showing play button as fallback
              if (window.showPlayButton) {
                  window.showPlayButton(audioUrl);
              }
          };
          
          // Handle stalled playback
          audio.onstalled = () => {
              window.logDebug("Audio playback stalled");
          };
          
          // Handle audio timeupdate to monitor progress
          audio.ontimeupdate = () => {
              // Update progress if needed
              if (window.nagState.showPlaybackProgress && window.nagElements.volumeBar) {
                  const progress = (audio.currentTime / audio.duration) * 100;
                  window.nagElements.volumeBar.style.width = `${progress}%`;
              }
          };
          
          // Set a maximum playback timeout
          const maxPlaytime = setTimeout(() => {
              if (audio.currentTime > 0 && !audio.paused) {
                  window.logDebug("Maximum playback time reached");
                  audio.pause();
                  
                  // Reset UI
                  window.nagElements.orb.classList.remove("speaking");
                  window.nagElements.orb.classList.add("idle");
              }
          }, 120000); // 2 minutes max
          
          // Clear timeout when audio ends
          audio.addEventListener('ended', () => {
              clearTimeout(maxPlaytime);
          }, { once: true });
      } else {
          window.logDebug("No audio URL in response");
          // Reset UI
          window.nagElements.orb.classList.remove("thinking");
          window.nagElements.orb.classList.add("idle");
      }
  } catch (error) {
      console.error("Error sending to chat:", error);
      window.logDebug("Error sending to chat: " + error.message);
      window.addStatusMessage("Error getting response: " + error.message, "error");
      
      // Reset UI
      window.nagElements.orb.classList.remove("thinking");
      window.nagElements.orb.classList.add("idle");
  }
}

// Function to send a direct message to the server over WebSocket
function sendWebSocketMessage(message, type = 'message') {
  try {
      if (!window.nagState.webSocket || window.nagState.webSocket.readyState !== WebSocket.OPEN) {
          window.logDebug("WebSocket not connected, cannot send message");
          return false;
      }
      
      const payload = {
          type: type,
          message: message,
          timestamp: Date.now()
      };
      
      window.nagState.webSocket.send(JSON.stringify(payload));
      return true;
  } catch (e) {
      window.logDebug("Error sending WebSocket message: " + e.message);
      return false;
  }
}

// WebRTC-related functions if needed
function initWebRTC() {
  // Only initialize if WebRTC is supported and needed
  if (!window.nagState.hasWebRTC || window.nagState.webRTCInitialized) {
      return false;
  }
  
  try {
      // Set up WebRTC peer connection
      const configuration = {
          iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              // Add your TURN server if you have one
          ]
      };
      
      const peerConnection = new RTCPeerConnection(configuration);
      window.nagState.peerConnection = peerConnection;
      
      // Set up event handlers
      peerConnection.onicecandidate = event => {
          if (event.candidate) {
              // Send ICE candidate to the server
              sendWebSocketMessage({
                  type: 'ice-candidate',
                  candidate: event.candidate
              }, 'webrtc');
          }
      };
      
      peerConnection.onconnectionstatechange = event => {
          window.logDebug(`WebRTC connection state: ${peerConnection.connectionState}`);
          
          if (peerConnection.connectionState === 'connected') {
              window.logDebug("WebRTC connected successfully");
          } else if (peerConnection.connectionState === 'failed' || 
                     peerConnection.connectionState === 'closed') {
              window.logDebug("WebRTC connection failed or closed");
          }
      };
      
      peerConnection.ontrack = event => {
          // Handle incoming tracks
          if (event.track.kind === 'audio') {
              window.logDebug("Received audio track via WebRTC");
              
              // Add to audio element if needed
              if (window.nagElements.audio) {
                  window.nagElements.audio.srcObject = event.streams[0];
              }
          }
      };
      
      window.nagState.webRTCInitialized = true;
      window.logDebug("WebRTC initialized");
      return true;
  } catch (e) {
      window.logDebug("Error initializing WebRTC: " + e.message);
      return false;
  }
}

// Function to toggle keyboard controls
function toggleKeyboardControls(enabled) {
  window.nagState.keyboardControlsEnabled = enabled;
  window.logDebug(`Keyboard controls ${enabled ? 'enabled' : 'disabled'}`);
  
  if (enabled) {
      window.addStatusMessage("Keyboard controls enabled. Use Space to start/stop recording, Esc to cancel.", "info");
  }
}

// Function to toggle playback progress display
function togglePlaybackProgress(enabled) {
  window.nagState.showPlaybackProgress = enabled;
  window.logDebug(`Playback progress display ${enabled ? 'enabled' : 'disabled'}`);
}

// Make functions globally available
window.initializeApp = initializeApp;
window.startListening = startListening;
window.stopListening = stopListening;
window.unlockAudioContext = unlockAudioContext;
window.processAudioAndTranscribe = processAudioAndTranscribe;
window.sendToChat = sendToChat;
window.sendWebSocketMessage = sendWebSocketMessage;
window.initWebRTC = initWebRTC;
window.toggleKeyboardControls = toggleKeyboardControls;
window.togglePlaybackProgress = togglePlaybackProgress;
window.detectBrowserCapabilities = detectBrowserCapabilities;

// Initialize additional state properties
window.nagState.keyboardControlsEnabled = false; // Disabled by default
window.nagState.showPlaybackProgress = false; // Disabled by default
window.nagState.wsReconnectAttempts = 0;
window.nagState.ignoringNextClick = false;

// Initialize on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // If the page is already loaded, run initialization immediately
  window.setTimeout(initializeApp, 100);
}