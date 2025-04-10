// Nag Digital Twin v2.0.0 - Audio Playback Functions

// Function to play audio response with Safari compatibility
async function playAudioResponse(audioUrl) {
    try {
        // Check if we're in Safari
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        // For Safari, ensure audio is unlocked and user has interacted
        if (isSafari && !window.audioUnlocked) {
            await unlockAudio();
        }

        // Create audio element
        const audio = new Audio(audioUrl);
        
        // Set up event listeners
        audio.addEventListener('canplaythrough', () => {
            console.log('Audio ready to play');
        });

        audio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            showPlayButton(audioUrl);
        });

        // Try to play
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log('Auto-play prevented:', error.message);
                    if (isSafari) {
                        showPlayButton(audioUrl);
                    } else {
                        // For non-Safari browsers, retry once
                        setTimeout(() => {
                            audio.play().catch(e => {
                                console.error('Retry play failed:', e);
                                showPlayButton(audioUrl);
                            });
                        }, 1000);
                    }
                });
            }
        } catch (error) {
            console.error('Play failed:', error);
            showPlayButton(audioUrl);
        }
    } catch (error) {
        console.error('Audio setup failed:', error);
        showPlayButton(audioUrl);
    }
}

// Show play button for manual audio playback
function showPlayButton(audioUrl) {
    const playButton = document.createElement('button');
    playButton.textContent = 'Play Response';
    playButton.className = 'play-button';
    playButton.onclick = async () => {
        try {
            const audio = new Audio(audioUrl);
            await audio.play();
            playButton.remove();
        } catch (error) {
            console.error('Manual play failed:', error);
        }
    };
    
    // Add to UI
    const responseDiv = document.querySelector('.response-container');
    if (responseDiv) {
        responseDiv.appendChild(playButton);
    }
}

// Nag Digital Twin v2.0.0 - Audio Module

// Improved audio unlocking for Safari
async function unlockAudio() {
    try {
        // Create and play a silent audio buffer
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        // Resume audio context
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        window.audioUnlocked = true;
        console.log('Audio successfully unlocked');
    } catch (error) {
        console.error('Failed to unlock audio:', error);
    }
}

// Function to start listening
async function startListening() {
  console.log("Starting to listen...");
  try {
    if (!window.nagState.audioUnlocked) {
      await unlockAudio();
    }
    
    window.nagState.listening = true;
    window.nagElements.orb.classList.remove("idle", "speaking", "thinking");
    window.nagElements.orb.classList.add("listening");
    
    // Start recording if available
    if (typeof startRecording === 'function') {
      await startRecording();
    }
    
    return true;
  } catch (error) {
    console.error("Error starting to listen:", error);
    return false;
  }
}

// Function to stop listening
async function stopListening() {
  console.log("Stopping listening...");
  try {
    window.nagState.listening = false;
    window.nagElements.orb.classList.remove("listening", "speaking", "thinking");
    window.nagElements.orb.classList.add("idle");
    
    // Stop recording if available
    if (typeof stopRecording === 'function') {
      await stopRecording();
    }
    
    return true;
  } catch (error) {
    console.error("Error stopping listening:", error);
    return false;
  }
}

// Function to start recording
async function startRecording() {
    console.log("Starting recording...");
    try {
        // Ensure audio context is initialized
        if (!window.nagState.audioUnlocked) {
            const unlocked = await unlockAudio();
            if (!unlocked) {
                throw new Error("Audio context not unlocked");
            }
        }

        // Get audio stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        window.nagState.stream = stream;
        window.nagState.audioChunks = []; // Reset audio chunks

        // Initialize MediaRecorder with proper format
        const mimeType = window.nagState.isSafari ? "audio/mp4" : "audio/webm";
        window.nagState.mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            audioBitsPerSecond: 128000
        });

        // Set up event handlers
        window.nagState.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                window.nagState.audioChunks.push(e.data);
                logDebug(`🔊 Audio chunk received: ${e.data.size} bytes`);
            }
        };

        window.nagState.mediaRecorder.onstop = async () => {
            logDebug("✅ MediaRecorder stopped successfully");
            logDebug(`📊 Audio chunks collected: ${window.nagState.audioChunks.length}`);
            
            if (window.nagState.audioChunks.length > 0) {
                // Process the audio and transcribe
                await processAudioAndTranscribe();
            }
            
            // Clean up
            if (window.nagState.stream) {
                window.nagState.stream.getTracks().forEach(track => track.stop());
                window.nagState.stream = null;
            }
            window.nagState.mediaRecorder = null;
            window.nagState.audioChunks = [];
        };

        // Start recording
        window.nagState.mediaRecorder.start();
        window.nagState.recording = true;
        logDebug("🎤 Recording started");

        return true;
    } catch (error) {
        console.error("Error starting recording:", error);
        return false;
    }
}

// Function to stop recording
async function stopRecording() {
    console.log("Stopping recording...");
    try {
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
            // For Safari, request final data before stopping
            if (window.nagState.isSafari) {
                window.nagState.mediaRecorder.requestData();
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            window.nagState.mediaRecorder.stop();
            
            // Clean up stream
            if (window.nagState.stream) {
                window.nagState.stream.getTracks().forEach(track => track.stop());
                window.nagState.stream = null;
            }
            
            window.nagState.recording = false;
            logDebug("✅ Recording stopped");
        }
        return true;
    } catch (error) {
        console.error("Error stopping recording:", error);
        return false;
    }
}

// Export functions
window.unlockAudio = unlockAudio;
window.startListening = startListening;
window.stopListening = stopListening;
window.startRecording = startRecording;
window.stopRecording = stopRecording;