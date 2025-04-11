// Nag Digital Twin v3.5.0 - Recording Module
console.log("Loading nag-recording.js");

// Get the best audio format for the browser
function getBestAudioFormat() {
    // Safari needs different format prioritization
    if (window.nagState.isSafari || window.nagState.isiOS) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            return 'audio/mp4';
        }
    }
    
    // Try webm first for other browsers
    if (MediaRecorder.isTypeSupported('audio/webm')) {
        return 'audio/webm';
    }
    
    // Fall back to other formats
    const formats = ['audio/mp4', 'audio/ogg', 'audio/wav'];
    for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
            return format;
        }
    }
    
    // Return empty if none supported (MediaRecorder will use default)
    return '';
}

// Improved setup for volume visualization
function setupVolumeVisualization(stream) {
    try {
        if (!window.nagState.audioContext) {
            window.nagState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Create analyzer node
        const analyser = window.nagState.audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        // Connect microphone to analyzer
        const source = window.nagState.audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        // Create data array for volume levels
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        window.nagState.volumeDataArray = dataArray;
        window.nagState.analyserNode = analyser;
        
        // Start visualization loop
        updateVolumeVisualization();
        
        return true;
    } catch (error) {
        console.error("Error setting up volume visualization:", error);
        return false;
    }
}

// Update volume visualization
function updateVolumeVisualization() {
    // If we're not listening or don't have an analyser, stop
    if (!window.nagState.listening || !window.nagState.analyserNode) {
        return;
    }
    
    try {
        // Get volume data
        window.nagState.analyserNode.getByteFrequencyData(window.nagState.volumeDataArray);
        
        // Calculate average volume
        const sum = window.nagState.volumeDataArray.reduce((a, b) => a + b, 0);
        const avg = sum / window.nagState.volumeDataArray.length;
        
        // Scale to 0-100%
        const volume = Math.min(100, Math.max(0, avg * 2.5));
        
        // Update volume bar
        if (window.nagElements.volumeBar) {
            window.nagElements.volumeBar.style.width = `${volume}%`;
            
            // Change color based on volume
            if (volume > 60) {
                window.nagElements.volumeBar.style.backgroundColor = '#dc3545'; // Red
            } else if (volume > 30) {
                window.nagElements.volumeBar.style.backgroundColor = '#ffc107'; // Yellow
            } else {
                window.nagElements.volumeBar.style.backgroundColor = '#28a745'; // Green
            }
        }
        
        // Voice activity detection for silence detection
        if (!window.nagState.isWalkieTalkieMode) {
            const SILENCE_THRESHOLD = 5; // Adjusted threshold
            const SILENCE_DURATION = 2500; // Extended silence threshold for longer recordings (2.5 seconds)
            
            if (volume < SILENCE_THRESHOLD) {
                // If silence is detected and timer isn't running yet
                if (!window.nagState.silenceTimer && window.nagState.speechDetected) {
                    window.nagState.silenceTimer = setTimeout(() => {
                        if (window.nagState.mediaRecorder && 
                            window.nagState.mediaRecorder.state === "recording") {
                            window.logDebug("Silence detected, stopping recording");
                            stopRecording();
                        }
                        window.nagState.silenceTimer = null;
                    }, SILENCE_DURATION);
                }
            } else {
                // Speech detected, clear silence timer and mark speech detected
                window.nagState.speechDetected = true;
                if (window.nagState.silenceTimer) {
                    clearTimeout(window.nagState.silenceTimer);
                    window.nagState.silenceTimer = null;
                }
            }
        }
        
        // Continue updating
        requestAnimationFrame(updateVolumeVisualization);
    } catch (error) {
        console.error("Error updating volume visualization:", error);
    }
}

// Request microphone access with improved settings
async function requestMicrophoneAccess() {
    try {
        if (window.nagState.audioStream) {
            // Already have a stream
            return window.nagState.audioStream;
        }
        
        // Request microphone access with enhanced settings
        window.logDebug("Requesting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 44100  // Use standard sample rate
            } 
        });
        
        window.nagState.audioStream = stream;
        window.logDebug("Microphone access granted");
        
        // Set up volume visualization
        setupVolumeVisualization(stream);
        
        return stream;
    } catch (error) {
        console.error("Error accessing microphone:", error);
        window.logDebug("Microphone access error: " + error.message);
        window.addStatusMessage("Error accessing microphone. Please check permissions.", "error");
        return null;
    }
}

// Initialize MediaRecorder with better settings 
function initializeMediaRecorder(stream) {
    try {
        if (!stream) {
            throw new Error("No audio stream provided");
        }
        
        // Get the best format for this browser
        const mimeType = getBestAudioFormat();
        window.logDebug(`Using audio format: ${mimeType || 'browser default'}`);
        
        // Create MediaRecorder with optimized options
        const options = {
            audioBitsPerSecond: 128000
        };
        
        if (mimeType) {
            options.mimeType = mimeType;
        }
        
        const mediaRecorder = new MediaRecorder(stream, options);
        window.nagState.mediaRecorder = mediaRecorder;
        window.nagState.audioChunks = [];
        window.nagState.speechDetected = false; // Reset speech detection
        
        // Setup event handlers
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                window.nagState.audioChunks.push(event.data);
                window.logDebug(`Audio chunk received: ${event.data.size} bytes`);
            }
        };
        
        // Improved onstop handler that ensures we get complete audio
        mediaRecorder.onstop = () => {
            window.logDebug("Media recorder stopped");
            
            // Process audio if we have any chunks
            if (window.nagState.audioChunks && window.nagState.audioChunks.length > 0) {
                // Calculate total audio size
                const totalSize = window.nagState.audioChunks.reduce((acc, chunk) => acc + chunk.size, 0);
                window.logDebug(`Total audio size: ${totalSize} bytes`);
                
                if (totalSize > 1000) { // Minimum size threshold (1KB)
                    if (window.processAudioAndTranscribe) {
                        window.processAudioAndTranscribe();
                    }
                } else {
                    window.logDebug("Audio too small, not processing");
                    window.addStatusMessage("Not enough audio recorded. Please try again.", "info");
                    
                    // Reset UI state
                    if (window.nagElements.orb) {
                        window.nagElements.orb.classList.remove("listening", "thinking");
                        window.nagElements.orb.classList.add("idle");
                    }
                }
            }
        };
        
        mediaRecorder.onerror = (event) => {
            console.error("MediaRecorder error:", event.error);
            window.logDebug(`MediaRecorder error: ${event.error.name}`);
        };
        
        return mediaRecorder;
    } catch (error) {
        console.error("Error initializing MediaRecorder:", error);
        window.logDebug("MediaRecorder initialization error: " + error.message);
        return null;
    }
}

// Improved start recording with better timeslice
async function startRecording() {
    try {
        // Get microphone access
        const stream = await requestMicrophoneAccess();
        if (!stream) {
            throw new Error("Could not access microphone");
        }
        
        // Initialize MediaRecorder if needed
        if (!window.nagState.mediaRecorder) {
            initializeMediaRecorder(stream);
        }
        
        // Start recording if not already recording
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state !== "recording") {
            window.nagState.audioChunks = []; // Reset chunks
            
            // Use timeslice to get data more frequently - important for transcription
            window.nagState.mediaRecorder.start(500); // Get data every 500ms
            window.logDebug("Recording started with timeslice");
            
            // Update UI
            if (window.nagElements.orb) {
                window.nagElements.orb.classList.remove("idle");
                window.nagElements.orb.classList.add("listening");
            }
            
            // Set a safety timeout to ensure recordings don't go too long
            if (window.nagState.recordingTimeout) {
                clearTimeout(window.nagState.recordingTimeout);
            }
            
            // INCREASED: Maximum recording time increased to 30 seconds
            window.nagState.recordingTimeout = setTimeout(() => {
                if (window.nagState.mediaRecorder && 
                    window.nagState.mediaRecorder.state === "recording") {
                    window.logDebug("Maximum recording time reached (30 seconds), stopping");
                    stopRecording();
                }
            }, 30000); // 30 seconds max recording time
            
            // Show recording time indicator
            window.nagState.recordingStartTime = Date.now();
            updateRecordingTimeIndicator();
        }
        
        return true;
    } catch (error) {
        console.error("Error starting recording:", error);
        window.logDebug("Error starting recording: " + error.message);
        window.addStatusMessage("Error starting recording: " + error.message, "error");
        return false;
    }
}

// Add recording time indicator
function updateRecordingTimeIndicator() {
    if (!window.nagState.recordingStartTime || !window.nagState.mediaRecorder || 
        window.nagState.mediaRecorder.state !== "recording") {
        return;
    }
    
    const elapsedMs = Date.now() - window.nagState.recordingStartTime;
    const seconds = Math.floor(elapsedMs / 1000);
    
    // Update hint text with recording time
    if (window.nagElements.modeHint) {
        window.nagElements.modeHint.textContent = `Recording: ${seconds}s`;
    }
    
    // Continue updating
    if (seconds < 30) { // Only update until max recording time
        requestAnimationFrame(updateRecordingTimeIndicator);
    }
}

// Improved stop recording with safety checks
function stopRecording() {
    try {
        // Clear safety timeout
        if (window.nagState.recordingTimeout) {
            clearTimeout(window.nagState.recordingTimeout);
            window.nagState.recordingTimeout = null;
        }
        
        // Reset recording time indicator
        window.nagState.recordingStartTime = null;
        if (window.nagElements.modeHint) {
            if (window.nagState.isWalkieTalkieMode) {
                window.nagElements.modeHint.textContent = "Press and hold the orb to speak";
            } else {
                window.nagElements.modeHint.textContent = "Click the orb to start listening";
            }
        }
        
        // If we're recording, stop
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
            // For Safari, first request data
            if (window.nagState.isSafari) {
                window.nagState.mediaRecorder.requestData();
                
                // Allow a bit more time for Safari to process the data
                setTimeout(() => {
                    window.nagState.mediaRecorder.stop();
                }, 300); // Increased delay for Safari
            } else {
                // Ensure we get the final chunk of data
                window.nagState.mediaRecorder.requestData();
                
                // Small delay to ensure all data is captured
                setTimeout(() => {
                    window.nagState.mediaRecorder.stop();
                }, 100);
            }
            
            window.logDebug("Recording stopped with final data request");
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("Error stopping recording:", error);
        window.logDebug("Error stopping recording: " + error.message);
        return false;
    }
}

// Clean up resources
function cleanupRecording() {
    // Stop any active recordings
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
        window.nagState.mediaRecorder.stop();
    }
    
    // Stop and release audio stream tracks
    if (window.nagState.audioStream) {
        window.nagState.audioStream.getTracks().forEach(track => track.stop());
        window.nagState.audioStream = null;
    }
    
    // Reset state
    window.nagState.mediaRecorder = null;
    window.nagState.audioChunks = [];
    window.nagState.analyserNode = null;
    window.nagState.recordingStartTime = null;
    
    window.logDebug("Recording resources cleaned up");
}

// Make functions globally available
window.requestMicrophoneAccess = requestMicrophoneAccess;
window.initializeMediaRecorder = initializeMediaRecorder;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.cleanupRecording = cleanupRecording;
window.getBestAudioFormat = getBestAudioFormat;
window.setupVolumeVisualization = setupVolumeVisualization;

console.log("nag-recording.js loaded");