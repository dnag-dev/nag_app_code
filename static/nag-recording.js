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
        window.logDebug("Volume visualization error: " + error.message);
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
        
        // Continue updating
        requestAnimationFrame(updateVolumeVisualization);
    } catch (error) {
        console.error("Error updating volume visualization:", error);
        window.logDebug("Volume update error: " + error.message);
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
        
        // For Safari, use lower bitrate and ensure it's properly configured
        if (window.nagState.isSafari || window.nagState.isiOS) {
            options.audioBitsPerSecond = 96000; // Lower bitrate for Safari
            if (mimeType === 'audio/mp4') {
                options.mimeType = mimeType;
            }
        }
        
        // Create the MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, options);
        window.nagState.mediaRecorder = mediaRecorder;
        window.nagState.audioChunks = [];
        
        // Setup event handlers with improved chunk collection
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                window.nagState.audioChunks.push(event.data);
                window.logDebug(`Audio chunk #${window.nagState.audioChunks.length} received: ${event.data.size} bytes`);
            } else {
                window.logDebug("Received empty audio chunk");
            }
        };
        
        // Improved onstop handler to ensure complete audio processing
        mediaRecorder.onstop = () => {
            window.logDebug(`MediaRecorder stopped. Processing ${window.nagState.audioChunks.length} chunks...`);
            
            // Process audio if we have any chunks
            if (window.nagState.audioChunks && window.nagState.audioChunks.length > 0) {
                // Calculate total audio size
                const totalSize = window.nagState.audioChunks.reduce((acc, chunk) => acc + chunk.size, 0);
                window.logDebug(`Total audio size: ${totalSize} bytes in ${window.nagState.audioChunks.length} chunks`);
                
                if (totalSize > 1000) { // Minimum size threshold (1KB)
                    if (window.processAudioAndTranscribe) {
                        window.processAudioAndTranscribe();
                    } else {
                        window.logDebug("processAudioAndTranscribe function not available");
                        
                        // Reset UI
                        if (window.nagElements && window.nagElements.orb) {
                            window.nagElements.orb.classList.remove("listening", "thinking");
                            window.nagElements.orb.classList.add("idle");
                        }
                        
                        window.addStatusMessage("Error processing audio: transcription function not found", "error");
                    }
                } else {
                    window.logDebug("Audio too small, not processing");
                    window.addStatusMessage("Not enough audio recorded. Please try again.", "info");
                    
                    // Reset UI
                    if (window.nagElements && window.nagElements.orb) {
                        window.nagElements.orb.classList.remove("listening", "thinking");
                        window.nagElements.orb.classList.add("idle");
                    }
                }
            } else {
                // No audio chunks or empty chunks
                window.logDebug("No valid audio chunks recorded");
                window.addStatusMessage("No audio recorded. Please try again.", "info");
                
                // Reset UI
                if (window.nagElements && window.nagElements.orb) {
                    window.nagElements.orb.classList.remove("listening", "thinking");
                    window.nagElements.orb.classList.add("idle");
                }
            }
        };
        
        mediaRecorder.onerror = (event) => {
            console.error("MediaRecorder error:", event.error);
            window.logDebug(`MediaRecorder error: ${event.error ? event.error.name : 'unknown'}`);
            window.addStatusMessage("Recording error. Please try again.", "error");
            
            // Reset UI
            if (window.nagElements && window.nagElements.orb) {
                window.nagElements.orb.classList.remove("listening", "thinking");
                window.nagElements.orb.classList.add("idle");
            }
        };
        
        return mediaRecorder;
    } catch (error) {
        console.error("Error initializing MediaRecorder:", error);
        window.logDebug("MediaRecorder initialization error: " + error.message);
        window.addStatusMessage("Error initializing recorder: " + error.message, "error");
        return null;
    }
}

// Manual recording mode with user controls
async function startRecording() {
    try {
        // First try to unlock audio context
        try {
            if (window.unlockAudioContext) {
                await window.unlockAudioContext();
            }
        } catch (e) {
            window.logDebug("Audio context unlock warning: " + e.message);
            // Continue anyway - we'll try to record
        }
        
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
            
            // Use different timeslice values based on browser
            let timeslice = 500; // Default 500ms for most browsers
            
            // For Safari, use larger timeslice to avoid excessive chunks
            if (window.nagState.isSafari || window.nagState.isiOS) {
                timeslice = 1000; // 1 second for Safari
            }
            
            // Use timeslice to get data chunks during recording
            window.nagState.mediaRecorder.start(timeslice);
            window.logDebug(`Recording started with timeslice: ${timeslice}ms`);
            
            // Update UI
            if (window.nagElements.orb) {
                window.nagElements.orb.classList.remove("idle");
                window.nagElements.orb.classList.add("listening");
            }
            
            // Set a safety timeout to ensure recordings don't go too long
            if (window.nagState.recordingTimeout) {
                clearTimeout(window.nagState.recordingTimeout);
            }
            
            // Safety timeout - stop after 30 seconds max
            window.nagState.recordingTimeout = setTimeout(() => {
                if (window.nagState.mediaRecorder && 
                    window.nagState.mediaRecorder.state === "recording") {
                    window.logDebug("Maximum recording time reached (30 seconds), stopping");
                    
                    // First update UI to show we're stopping
                    if (window.nagElements.orb) {
                        window.nagElements.orb.classList.remove("listening");
                        window.nagElements.orb.classList.add("thinking");
                    }
                    
                    stopRecording();
                }
            }, 30000); // 30 seconds max recording time
            
            // Show recording time indicator
            window.nagState.recordingStartTime = Date.now();
            updateRecordingTimeIndicator();
            
            // Clear any existing instruction timeouts
            if (window.nagState.instructionTimeout) {
                clearTimeout(window.nagState.instructionTimeout);
            }
            
            // Show instruction to click again when done speaking
            if (window.nagElements.modeHint) {
                window.nagElements.modeHint.textContent = "Recording... Click orb again when done speaking";
                
                // Keep this instruction visible for 5 seconds
                window.nagState.instructionTimeout = setTimeout(() => {
                    if (window.nagElements.modeHint && window.nagState.recordingStartTime) {
                        updateRecordingTimeIndicator(); // Switch to time indicator
                    }
                }, 5000);
            }
        }
        
        return true;
    } catch (error) {
        console.error("Error starting recording:", error);
        window.logDebug("Error starting recording: " + error.message);
        window.addStatusMessage("Error starting recording: " + error.message, "error");
        
        // Reset UI in case of error
        if (window.nagElements && window.nagElements.orb) {
            window.nagElements.orb.classList.remove("listening", "thinking");
            window.nagElements.orb.classList.add("idle");
        }
        
        return false;
    }
}

// Manual stop recording with improved reliability
function stopRecording() {
    try {
        // Clear safety timeout
        if (window.nagState.recordingTimeout) {
            clearTimeout(window.nagState.recordingTimeout);
            window.nagState.recordingTimeout = null;
        }
        
        // Clear instruction timeout
        if (window.nagState.instructionTimeout) {
            clearTimeout(window.nagState.instructionTimeout);
            window.nagState.instructionTimeout = null;
        }
        
        // Reset recording time indicator
        window.nagState.recordingStartTime = null;
        if (window.nagElements.modeHint) {
            if (window.nagState.isWalkieTalkieMode) {
                window.nagElements.modeHint.textContent = "Press and hold the orb to speak";
            } else {
                window.nagElements.modeHint.textContent = "Click the orb to start recording";
            }
        }
        
        // Update UI first to show we're processing
        if (window.nagElements && window.nagElements.orb) {
            window.nagElements.orb.classList.remove("listening");
            window.nagElements.orb.classList.add("thinking");
        }
        
        // If we're recording, stop
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
            // Different handling based on browser
            if (window.nagState.isSafari || window.nagState.isiOS) {
                // For Safari, we need to be extra careful with timing
                try {
                    // First request the current data
                    window.nagState.mediaRecorder.requestData();
                    
                    // Log the current chunks count
                    window.logDebug(`Stopping Safari recording with ${window.nagState.audioChunks.length} chunks so far`);
                    
                    // Allow a bit more time for Safari to process the data
                    setTimeout(() => {
                        try {
                            window.nagState.mediaRecorder.stop();
                            window.logDebug("Safari recording stopped after timeout");
                        } catch (e) {
                            window.logDebug("Error stopping Safari recording: " + e.message);
                            // In case of error, try to reset the UI
                            resetRecordingUI();
                        }
                    }, 300); // Increased delay for Safari
                } catch (e) {
                    window.logDebug("Error in Safari recording stop sequence: " + e.message);
                    // Try direct stop as fallback
                    try {
                        window.nagState.mediaRecorder.stop();
                    } catch (e2) {
                        window.logDebug("Fallback stop also failed: " + e2.message);
                        resetRecordingUI();
                    }
                }
            } else {
                // For other browsers, simpler approach
                try {
                    // Ensure we get the final chunk of data
                    window.nagState.mediaRecorder.requestData();
                    
                    // Small delay to ensure all data is captured
                    setTimeout(() => {
                        try {
                            window.nagState.mediaRecorder.stop();
                            window.logDebug("Recording stopped successfully");
                        } catch (e) {
                            window.logDebug("Error stopping recording: " + e.message);
                            resetRecordingUI();
                        }
                    }, 100);
                } catch (e) {
                    window.logDebug("Error in recording stop sequence: " + e.message);
                    // Try direct stop as fallback
                    try {
                        window.nagState.mediaRecorder.stop();
                    } catch (e2) {
                        window.logDebug("Fallback stop also failed: " + e2.message);
                        resetRecordingUI();
                    }
                }
            }
            
            window.logDebug("Recording stop sequence initiated");
            return true;
        } else {
            // We weren't recording, reset UI
            resetRecordingUI();
            return false;
        }
    } catch (error) {
        console.error("Error stopping recording:", error);
        window.logDebug("Error stopping recording: " + error.message);
        resetRecordingUI();
        return false;
    }
}

// Helper function to reset UI if recording fails
function resetRecordingUI() {
    if (window.nagElements && window.nagElements.orb) {
        window.nagElements.orb.classList.remove("thinking", "listening");
        window.nagElements.orb.classList.add("idle");
    }
    
    window.addStatusMessage("Recording failed or no audio captured. Please try again.", "error");
}

// Add recording time indicator
function updateRecordingTimeIndicator() {
    if (!window.nagState.recordingStartTime || 
        !window.nagState.mediaRecorder || 
        window.nagState.mediaRecorder.state !== "recording") {
        return;
    }
    
    const elapsedMs = Date.now() - window.nagState.recordingStartTime;
    const seconds = Math.floor(elapsedMs / 1000);
    
    // Update hint text with recording time
    if (window.nagElements.modeHint) {
        window.nagElements.modeHint.textContent = `Recording: ${seconds}s (Click orb to stop)`;
    }
    
    // Continue updating 
    if (seconds < 30) { // Only update until max recording time
        requestAnimationFrame(updateRecordingTimeIndicator);
    } else {
        // If we hit 30 seconds, update hint to show we're stopping
        if (window.nagElements.modeHint) {
            window.nagElements.modeHint.textContent = "Maximum recording time reached, processing...";
        }
    }
}

// Process audio and send for transcription
// This is the key function for handling the audio chunks properly
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
        
        // Log detailed information about the chunks before creating blob
        window.logDebug(`Preparing to process ${window.nagState.audioChunks.length} audio chunks:`);
        window.nagState.audioChunks.forEach((chunk, index) => {
            window.logDebug(`  Chunk ${index+1}: ${chunk.size} bytes, type: ${chunk.type || 'unknown'}`);
        });
        
        // Create blob from chunks - this combines all audio chunks into a single file
        const audioBlob = new Blob(window.nagState.audioChunks, { type: mimeType });
        window.logDebug(`Audio blob created: ${audioBlob.size} bytes, type: ${mimeType}`);
        
        // Create form data
        const formData = new FormData();
        const fileExt = mimeType.includes("webm") ? "webm" : "mp4";
        formData.append("file", audioBlob, `recording.${fileExt}`);
        
        // Add additional info to help server process the audio
        formData.append("chunk_count", window.nagState.audioChunks.length.toString());
        formData.append("total_size", audioBlob.size.toString());
        formData.append("mime_type", mimeType);
        
        // Add Safari-specific info if needed
        if (window.nagState.isSafari || window.nagState.isiOS) {
            formData.append("browser", "safari");
        }
        
        // Set a timeout to prevent getting stuck
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Transcription request timed out")), 15000);
        });
        
        // Send to server
        window.logDebug("Sending complete audio for transcription...");
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
            window.logDebug(`Transcription received: "${transcription}"`);
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
        window.logDebug("Sending transcribed text to chat endpoint...");
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

// Clean up resources
function cleanupRecording() {
    // Clear any timeouts
    if (window.nagState.recordingTimeout) {
        clearTimeout(window.nagState.recordingTimeout);
        window.nagState.recordingTimeout = null;
    }
    
    if (window.nagState.instructionTimeout) {
        clearTimeout(window.nagState.instructionTimeout);
        window.nagState.instructionTimeout = null;
    }
    
    // Stop any active recordings
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
        try {
            window.nagState.mediaRecorder.stop();
        } catch (e) {
            window.logDebug("Error stopping recorder during cleanup: " + e.message);
        }
    }
    
    // Stop and release audio stream tracks
    if (window.nagState.audioStream) {
        try {
            window.nagState.audioStream.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (e) {
                    // Ignore errors stopping individual tracks
                }
            });
        } catch (e) {
            window.logDebug("Error stopping audio stream: " + e.message);
        }
        window.nagState.audioStream = null;
    }
    
    // Reset state
    window.nagState.mediaRecorder = null;
    window.nagState.audioChunks = [];
    window.nagState.analyserNode = null;
    window.nagState.recordingStartTime = null;
    
    // Reset UI
    if (window.nagElements && window.nagElements.orb) {
        window.nagElements.orb.classList.remove("listening", "thinking");
        window.nagElements.orb.classList.add("idle");
    }
    
    if (window.nagElements && window.nagElements.modeHint) {
        window.nagElements.modeHint.textContent = window.nagState.isWalkieTalkieMode ? 
            "Press and hold the orb to speak" : "Click the orb to start recording";
    }
    
    window.logDebug("Recording resources cleaned up");
    return true;
}

// Make functions globally available
window.requestMicrophoneAccess = requestMicrophoneAccess;
window.initializeMediaRecorder = initializeMediaRecorder;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.cleanupRecording = cleanupRecording;
window.getBestAudioFormat = getBestAudioFormat;
window.setupVolumeVisualization = setupVolumeVisualization;
window.resetRecordingUI = resetRecordingUI;
window.updateRecordingTimeIndicator = updateRecordingTimeIndicator;
window.processAudioAndTranscribe = processAudioAndTranscribe;
window.sendToChat = sendToChat;

console.log("nag-recording.js loaded");