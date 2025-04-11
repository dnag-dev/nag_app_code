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
        console.log("Audio context unlock attempt: " + (unlocked ? "success" : "waiting for user interaction"));
        window.logDebug("Audio context unlock: " + (unlocked ? "success" : "waiting for user interaction"));
    });
    
    // Setup WebSocket connection if needed
    try {
        connectWebSocket();
    } catch (error) {
        console.error("Failed to connect WebSocket:", error);
        window.logDebug("WebSocket connection error: " + error.message);
    }
    
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
            
            window.addStatusMessage(
                window.nagState.isWalkieTalkieMode ? 
                "Switched to walkie-talkie mode" : "Switched to continuous mode", 
                "info"
            );
        });
    }
    
    // Orb interactions
    if (orb) {
        // For manual recording mode
        orb.addEventListener('click', function() {
            window.logDebug("Orb clicked");
            
            // Always try to unlock audio on click
            unlockAudioContext().then(() => {
                if (window.nagState.isWalkieTalkieMode) return; // Don't handle click in walkie-talkie mode
                
                if (window.nagState.isPaused) {
                    window.addStatusMessage("Conversation is paused. Press Resume to continue.", "info");
                    return;
                }
                
                // If we're in the middle of processing audio, ignore clicks
                if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
                    // Stop the current recording
                    stopRecording();
                } else if (orb.classList.contains("thinking") || orb.classList.contains("speaking")) {
                    // Already processing or speaking, do nothing
                    window.logDebug("Ignoring orb click while processing/speaking");
                } else if (orb.classList.contains("listening")) {
                    // We're listening, stop
                    stopListening();
                } else {
                    // We're idle, start recording
                    startRecording();
                }
            });
        });
        
        // For walkie-talkie mode: mousedown/mouseup
        orb.addEventListener('mousedown', function(e) {
            if (!window.nagState.isWalkieTalkieMode || window.nagState.isPaused) return;
            
            // Try to unlock audio
            unlockAudioContext().then(() => {
                e.preventDefault();
                window.nagState.walkieTalkieActive = true;
                orb.classList.remove("idle");
                orb.classList.add("listening");
                startRecording();
            });
        });
        
        orb.addEventListener('mouseup', function() {
            if (!window.nagState.isWalkieTalkieMode || !window.nagState.walkieTalkieActive) return;
            
            window.nagState.walkieTalkieActive = false;
            orb.classList.remove("listening");
            orb.classList.add("thinking");
            stopRecording();
        });
        
        // Touch events for mobile
        orb.addEventListener('touchstart', function(e) {
            if (!window.nagState.isWalkieTalkieMode || window.nagState.isPaused) return;
            
            // Try to unlock audio (crucial for iOS)
            unlockAudioContext().then(() => {
                e.preventDefault(); // Important for mobile
                window.nagState.walkieTalkieActive = true;
                orb.classList.remove("idle");
                orb.classList.add("listening");
                startRecording();
            });
        }, { passive: false }); // Non-passive to allow preventDefault
        
        orb.addEventListener('touchend', function() {
            if (!window.nagState.isWalkieTalkieMode || !window.nagState.walkieTalkieActive) return;
            
            window.nagState.walkieTalkieActive = false;
            orb.classList.remove("listening");
            orb.classList.add("thinking");
            stopRecording();
        });
    }
}

// WebSocket connection with fallback
function connectWebSocket() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        console.log(`Attempting WebSocket connection to: ${wsUrl}`);
        
        const nagWebSocket = new WebSocket(wsUrl);
        
        nagWebSocket.onopen = () => {
            console.log('WebSocket connection established');
            window.logDebug('Connected to server successfully');
            window.addStatusMessage('Connected to server', 'info');
        };
        
        nagWebSocket.onclose = () => {
            console.log('WebSocket closed');
            window.logDebug('WebSocket connection closed');
        };
        
        nagWebSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            window.logDebug('WebSocket connection error');
            window.addStatusMessage('Server connection failed', 'info');
        };
        
        nagWebSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'status') {
                    window.addStatusMessage(data.message, data.status || 'info');
                }
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
            }
        };
        
        return nagWebSocket;
    } catch (e) {
        console.error('WebSocket initialization error:', e);
        window.logDebug('Could not initialize WebSocket');
        window.addStatusMessage('Operating in offline mode', 'info');
        return null;
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

// Start listening for audio
async function startListening() {
    try {
        // If we're already listening, don't do anything
        if (window.nagState.listening) return true;
        
        // Unlock audio context first
        await unlockAudioContext();
        
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 44100
            } 
        });
        window.nagState.audioStream = stream;
        
        // Setup recording
        setupRecording(stream);
        
        // Update UI
        window.nagState.listening = true;
        window.nagElements.orb.classList.remove("idle");
        window.nagElements.orb.classList.add("listening");
        window.nagElements.toggleBtn.textContent = "Stop Conversation";
        window.nagElements.pauseBtn.disabled = false;
        
        window.logDebug("Started listening");
        return true;
    } catch (error) {
        console.error("Error starting listening:", error);
        window.logDebug("Error starting listening: " + error.message);
        window.addStatusMessage("Error accessing microphone. Please check permissions.", "error");
        return false;
    }
}

// Stop listening
function stopListening() {
    try {
        // If we're not listening, don't do anything
        if (!window.nagState.listening) return true;
        
        // Stop all active media
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
            window.nagState.mediaRecorder.stop();
        }
        
        if (window.nagState.audioStream) {
            window.nagState.audioStream.getTracks().forEach(track => track.stop());
            window.nagState.audioStream = null;
        }
        
        // Reset state
        window.nagState.listening = false;
        window.nagState.mediaRecorder = null;
        window.nagState.audioChunks = [];
        
        // Update UI
        window.nagElements.orb.classList.remove("listening", "thinking", "speaking");
        window.nagElements.orb.classList.add("idle");
        window.nagElements.toggleBtn.textContent = "Start Conversation";
        window.nagElements.pauseBtn.disabled = true;
        
        window.logDebug("Stopped listening");
        return true;
    } catch (error) {
        console.error("Error stopping listening:", error);
        window.logDebug("Error stopping listening: " + error.message);
        return false;
    }
}

// Setup recording with the given stream
function setupRecording(stream) {
    try {
        // Determine best MIME type for browser
        let mimeType = "audio/webm";
        
        // For Safari, use audio/mp4
        if (window.nagState.isSafari) {
            mimeType = "audio/mp4";
        }
        
        // Fall back if not supported
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            const supportedTypes = ["audio/webm", "audio/mp4", "audio/ogg", ""];
            for (const type of supportedTypes) {
                if (type === "" || MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }
        }
        
        // Initialize MediaRecorder
        window.nagState.mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType || undefined,
            audioBitsPerSecond: 128000
        });
        
        window.nagState.audioChunks = [];
        
        // Handle data availability
        window.nagState.mediaRecorder.ondataavailable = function(e) {
            if (e.data && e.data.size > 0) {
                window.nagState.audioChunks.push(e.data);
                window.logDebug(`Audio chunk received: ${e.data.size} bytes`);
            }
        };
        
        // Handle recording stop
        window.nagState.mediaRecorder.onstop = function() {
            window.logDebug("MediaRecorder stopped");
            
            // Process audio if we have enough data
            if (window.nagState.audioChunks.length > 0) {
                const totalSize = window.nagState.audioChunks.reduce((size, chunk) => size + chunk.size, 0);
                window.logDebug(`Total audio size: ${totalSize} bytes`);
                
                if (totalSize > 1000) { // Minimum size threshold
                    processAudioAndTranscribe();
                } else {
                    window.logDebug("Audio too small to process");
                    window.addStatusMessage("Not enough audio captured. Please try again.", "info");
                    
                    // Reset UI
                    window.nagElements.orb.classList.remove("thinking");
                    window.nagElements.orb.classList.add("idle");
                }
            } else {
                // No audio chunks received
                window.logDebug("No audio chunks received");
                window.addStatusMessage("No audio recorded. Please try again.", "info");
                
                // Reset UI
                window.nagElements.orb.classList.remove("thinking");
                window.nagElements.orb.classList.add("idle");
            }
        };
        
        // Start recording
        window.nagState.mediaRecorder.start();
        window.logDebug("Started recording");
        
        return true;
    } catch (error) {
        console.error("Error setting up recording:", error);
        window.logDebug("Error setting up recording: " + error.message);
        return false;
    }
}

// Start recording in walkie-talkie mode
function startRecording() {
    try {
        if (!window.nagState.audioContextUnlocked) {
            unlockAudioContext();
        }
        
        if (!window.nagState.audioStream) {
            // Get audio stream if not already available
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    window.nagState.audioStream = stream;
                    setupRecording(stream);
                })
                .catch(error => {
                    console.error("Error accessing microphone:", error);
                    window.logDebug("Microphone access error: " + error.message);
                    window.addStatusMessage("Error accessing microphone", "error");
                    
                    // Reset UI
                    window.nagElements.orb.classList.remove("listening", "thinking");
                    window.nagElements.orb.classList.add("idle");
                });
        } else if (window.nagState.audioStream && !window.nagState.mediaRecorder) {
            // Stream exists but recorder doesn't
            setupRecording(window.nagState.audioStream);
        } else if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state !== "recording") {
            // Recorder exists but not recording
            window.nagState.audioChunks = [];
            window.nagState.mediaRecorder.start();
            window.logDebug("Started recording (manual mode)");
        }
        
        // Set a safety timeout to prevent infinite recording
        if (window.nagState.recordingTimeout) {
            clearTimeout(window.nagState.recordingTimeout);
        }
        
        window.nagState.recordingTimeout = setTimeout(() => {
            if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
                window.logDebug("Maximum recording time reached (30 seconds)");
                
                // Update UI to show we're stopping
                window.nagElements.orb.classList.remove("listening");
                window.nagElements.orb.classList.add("thinking");
                
                // Stop recording
                stopRecording();
            }
        }, 30000); // 30 seconds max
    } catch (error) {
        console.error("Error starting recording:", error);
        window.logDebug("Error starting recording: " + error.message);
        
        // Reset UI
        window.nagElements.orb.classList.remove("listening", "thinking");
        window.nagElements.orb.classList.add("idle");
    }
}

// Stop recording in walkie-talkie mode
function stopRecording() {
    try {
        // Clear the safety timeout
        if (window.nagState.recordingTimeout) {
            clearTimeout(window.nagState.recordingTimeout);
            window.nagState.recordingTimeout = null;
        }
        
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
            // Update UI to show we're processing
            window.nagElements.orb.classList.remove("listening");
            window.nagElements.orb.classList.add("thinking");
            
            // For Safari, request final data chunk
            if (window.nagState.isSafari) {
                window.nagState.mediaRecorder.requestData();
                // Small delay to ensure data is processed
                setTimeout(() => {
                    window.nagState.mediaRecorder.stop();
                }, 300);
            } else {
                window.nagState.mediaRecorder.requestData();
                setTimeout(() => {
                    window.nagState.mediaRecorder.stop();
                }, 100);
            }
            window.logDebug("Stopped recording");
        }
    } catch (error) {
        console.error("Error stopping recording:", error);
        window.logDebug("Error stopping recording: " + error.message);
        
        // Reset UI in case of error
        window.nagElements.orb.classList.remove("thinking", "listening");
        window.nagElements.orb.classList.add("idle");
    }
}

// Process audio and send for transcription
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
        
        // Create blob from chunks
        const audioBlob = new Blob(window.nagState.audioChunks, { type: mimeType });
        window.logDebug(`Audio blob created: ${audioBlob.size} bytes, type: ${mimeType}`);
        
        // Create form data
        const formData = new FormData();
        const fileExt = mimeType.includes("webm") ? "webm" : "mp4";
        formData.append("file", audioBlob, `recording.${fileExt}`);
        
        // Add Safari-specific info if needed
        if (window.nagState.isSafari) {
            formData.append("browser", "safari");
            formData.append("mime_type", mimeType);
        }
        
        // Set a timeout to prevent getting stuck in thinking state
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Transcription request timed out")), 10000);
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
        
        // Send request
        window.logDebug("Sending to chat endpoint...");
        const fetchPromise = fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message,
                mode: "voice",
                request_id: Date.now().toString()
            })
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
            audio.src = audioUrl;
            
            // Set up event handlers
            audio.onloadeddata = () => {
                window.logDebug("Audio loaded, playing...");
                audio.play().catch(error => {
                    console.error("Error playing audio:", error);
                    window.logDebug("Error playing audio: " + error.message);
                    
                    // Reset UI in case of error
                    window.nagElements.orb.classList.remove("speaking");
                    window.nagElements.orb.classList.add("idle");
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
                    startRecording();
                }
            };
            
            audio.onerror = () => {
                window.logDebug("Audio playback error");
                // Reset UI
                window.nagElements.orb.classList.remove("speaking");
                window.nagElements.orb.classList.add("idle");
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

// Make functions globally available
window.initializeApp = initializeApp;
window.startListening = startListening;
window.stopListening = stopListening;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.unlockAudioContext = unlockAudioContext;
window.processAudioAndTranscribe = processAudioAndTranscribe;

// Initialize on document ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // If the page is already loaded, run initialization immediately
    window.setTimeout(initializeApp, 100);
}