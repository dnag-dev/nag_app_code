// Nag Digital Twin v2.0.0 - Audio Playback Functions

// Function to play audio response with Safari compatibility
async function playAudioResponse(audioUrl) {
    const orb = window.nagElements.orb;
    const audio = window.nagElements.audio;
    
    orb.classList.add("speaking");
    
    try {
        // Ensure audio context is initialized and unlocked
        if (!window.nagState.audioUnlocked) {
            const unlocked = await unlockAudio();
            if (!unlocked) {
                throw new Error("Audio context not unlocked");
            }
        }

        // Preload audio for faster response
        await new Promise((resolve) => {
            const onready = () => {
                audio.oncanplaythrough = null;
                audio.onerror = null;
                resolve();
            };
            
            audio.oncanplaythrough = onready;
            audio.onerror = (e) => {
                logDebug("⚠️ Audio preload error: " + (e.message || "unknown error"));
                resolve();
            };
            
            const timeout = setTimeout(() => {
                logDebug("⚠️ Audio preload timeout");
                resolve();
            }, 5000);
            
            const clearTimeoutWrapper = () => {
                clearTimeout(timeout);
                onready();
            };
            
            audio.oncanplaythrough = clearTimeoutWrapper;
            audio.onerror = clearTimeoutWrapper;
            
            audio.src = audioUrl;
            audio.load();
        });

        // Special handling for Safari/iOS first play
        if ((window.nagState.isSafari || window.nagState.isiOS) && !window.nagState.audioUnlocked) {
            logDebug("🔊 Safari/iOS first play - showing play button");
            showPlayButton(audioUrl);
            return;
        }
        
        // Attempt to play with promise handling
        const playResult = audio.play();
        
        if (playResult && playResult.then) {
            await playResult;
            logDebug("🔊 Audio playback started successfully");
        }
        
        // Set up onended handler for continuous mode
        audio.onended = () => {
            orb.classList.remove("speaking");
            orb.classList.add("idle");
            if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused && !window.nagState.interrupted) {
                startListening();
            }
        };
        
    } catch (e) {
        logDebug("🔇 Audio play exception: " + e.message);
        showPlayButton(audioUrl);
    }
}

// Show play button for manual audio playback
function showPlayButton(audioUrl) {
    const orb = window.nagElements.orb;
    const audio = window.nagElements.audio;
    const debugBox = window.nagElements.debugBox;
    
    orb.classList.remove("speaking", "thinking");
    orb.classList.add("idle");
    
    removePlayButton();
    
    let playButton = document.createElement("button");
    playButton.innerText = "▶️ Play Response";
    playButton.className = "play-button";
    
    if (window.nagState.isSafari || window.nagState.isiOS) {
        playButton.className = "play-button safari";
        playButton.innerText = "▶️ Tap to Play Response";
        
        if (!window.nagState.audioUnlocked) {
            const hint = document.createElement("p");
            hint.className = "safari-hint";
            hint.innerText = "Safari requires a tap to play audio";
            document.body.insertBefore(hint, debugBox);
        }
    }
    
    window.nagState.currentPlayButton = playButton;
    document.body.insertBefore(playButton, debugBox);
    setTimeout(() => playButton.focus(), 100);
    
    playButton.onclick = async () => {
        try {
            // Unlock audio for future playbacks
            window.nagState.audioUnlocked = true;
            
            orb.classList.remove("idle");
            orb.classList.add("speaking");
            
            audio.src = audioUrl;
            audio.load();
            
            // Remove any safari hints
            const hint = document.querySelector(".safari-hint");
            if (hint) hint.remove();
            
            await audio.play();
            removePlayButton();
            
            audio.onended = () => {
                orb.classList.remove("speaking");
                orb.classList.add("idle");
                if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused && !window.nagState.interrupted) {
                    startListening();
                }
            };
        } catch (err) {
            logDebug("🔇 Manual play failed: " + err.message);
            orb.classList.remove("speaking");
            orb.classList.add("idle");
        }
    };
}

// Remove play button if exists
function removePlayButton() {
    if (window.nagState.currentPlayButton) {
        window.nagState.currentPlayButton.remove();
        window.nagState.currentPlayButton = null;
    }
    
    const hint = document.querySelector(".safari-hint");
    if (hint) hint.remove();
}

// Nag Digital Twin v2.0.0 - Audio Module

// Improved audio unlocking for Safari
async function unlockAudio() {
    console.log("Attempting to unlock audio...");
    
    if (window.nagState.audioUnlocked) {
        console.log("Audio already unlocked");
        return true;
    }
    
    try {
        // Create and immediately suspend an audio context
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        window.nagState.audioContext = audioContext;
        
        // For Safari, we need to resume the context during a user gesture
        await audioContext.resume();
        
        // Create and play a silent buffer (crucial for Safari)
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        
        // Define a completion function
        const unlockComplete = () => {
            window.nagState.audioUnlocked = true;
            console.log("Audio successfully unlocked");
            logDebug("🔊 Audio unlocked successfully");
        };
        
        // Start the source and mark as completed
        source.onended = unlockComplete;
        source.start(0);
        
        // Backup timeout in case onended doesn't fire
        setTimeout(unlockComplete, 1000);
        
        // Also try to play the audio element if it exists
        if (window.nagElements && window.nagElements.audio) {
            const audio = window.nagElements.audio;
            
            // Set a silent audio source
            audio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADQgD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwAQAAAAAAAAAAABSAJAJAQgAAgAAAA0L2YLwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZB4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";
            
            try {
                await audio.play();
                audio.pause();
                audio.currentTime = 0;
            } catch (e) {
                console.log("Auto-play prevented: User interaction needed");
            }
        }
        
        return true;
    } catch (error) {
        console.error("Error unlocking audio:", error);
        return false;
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
            }
        };

        window.nagState.mediaRecorder.onstop = async () => {
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