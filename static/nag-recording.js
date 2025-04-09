// Nag Digital Twin v2.0.0 - Recording Functions

// Add this at the top of the file
window.audioContext = null;
window.audioContextUnlocked = false;

// Setup volume visualization for the orb
function setupVolumeVisualization(stream) {
  try {
    const volumeBar = window.nagElements.volumeBar;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    window.nagState.analyserNode = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    
    window.nagState.analyserNode.fftSize = 256;
    window.nagState.analyserNode.smoothingTimeConstant = 0.8;
    microphone.connect(window.nagState.analyserNode);
    
    const bufferLength = window.nagState.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function updateVolume() {
      if (!window.nagState.analyserNode || !window.nagState.listening) return;
      
      window.nagState.analyserNode.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      
      const average = sum / bufferLength;
      // Amplify the volume display for better visual feedback
      const volume = Math.min(100, Math.max(0, average * 2.5));
      
      // Safely update volume bar if it exists
      const volumeBar = document.querySelector('.volume-bar');
      if (volumeBar) {
        volumeBar.style.height = `${volume}%`;
        volumeBar.style.backgroundColor = `hsl(${120 + (volume * 1.2)}, 70%, 50%)`;
      }
      
      // Skip voice activity detection in walkie-talkie mode when not active
      if (window.nagState.isWalkieTalkieMode && !window.nagState.walkieTalkieActive) {
        requestAnimationFrame(updateVolume);
        return;
      }
      
      // Voice activity detection for continuous mode
      if (!window.nagState.isWalkieTalkieMode) {
        // Speech threshold - use higher threshold for Safari to avoid false activations
        const SPEECH_THRESHOLD = window.nagState.isSafari ? 8 : 10; // Lowered threshold for Safari
        // Silence duration before stopping - longer for Safari
        const SILENCE_DELAY = window.nagState.isSafari ? 3000 : 1500; // Increased silence delay for Safari
        
        if (volume < SPEECH_THRESHOLD) {
          if (!window.nagState.silenceTimer) {
            window.nagState.silenceTimer = setTimeout(() => {
              // Only stop if we detected actual speech before
              if (window.nagState.mediaRecorder && 
                  window.nagState.mediaRecorder.state === "recording" && 
                  window.nagState.speechDetected) {
                logDebug("🔇 Silence detected, stopping recording");
                stopRecording();
              } else if (window.nagState.mediaRecorder && 
                         window.nagState.mediaRecorder.state === "recording") {
                // If no speech was detected at all, restart recording
                logDebug("🔇 No speech detected, restarting recording");
                stopRecording();
                // Give a short break before restarting
                setTimeout(() => {
                  if (!window.nagState.interrupted && !window.nagState.isPaused) {
                    startListening();
                  }
                }, 500);
              }
              window.nagState.silenceTimer = null;
            }, SILENCE_DELAY);
          }
        } else {
          // Reset the silence timer if we hear something
          if (volume > SPEECH_THRESHOLD) {
            window.nagState.speechDetected = true;
          }
          if (window.nagState.silenceTimer) {
            clearTimeout(window.nagState.silenceTimer);
            window.nagState.silenceTimer = null;
          }
        }
      }
      
      requestAnimationFrame(updateVolume);
    }
    
    requestAnimationFrame(updateVolume);
  } catch (e) {
    logDebug("⚠️ Volume visualization not available: " + e.message);
  }
}

// Improved walkie-talkie setup 
function setupWalkieTalkieMode() {
    const orb = window.nagElements.orb;
    if (!orb) {
        console.error("Orb element not found for walkie-talkie setup");
        return;
    }
    
    console.log("Setting up walkie-talkie mode");
    
    // Clear any existing handlers to prevent duplicates
    const oldMouseDown = orb.onmousedown;
    const oldMouseUp = orb.onmouseup;
    const oldTouchStart = orb.ontouchstart;
    const oldTouchEnd = orb.ontouchend;
    
    // Mouse events for desktop
    orb.addEventListener("mousedown", function walkieTalkieDown(e) {
        if (!window.nagState.isWalkieTalkieMode || 
            window.nagState.isUploading || 
            window.nagState.isPaused) return;
        
        console.log("Walkie-talkie activated (mouse)");
        window.nagState.walkieTalkieActive = true;
        logDebug("🔊 Walkie-talkie active - speak now");
        orb.classList.add("listening");
        
        // Unlock audio context (important for Safari)
        unlockAudio().then(() => {
            if (window.nagState.stream) {
                if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state !== "recording") {
                    startRecording();
                }
            } else {
                // If no stream exists yet, create one
                startListening();
            }
        });
    });
    
    // Touch events for mobile (crucial for Safari)
    orb.addEventListener("touchstart", function walkieTalkieTouch(e) {
        // Must prevent default on Safari to avoid triggering click
        e.preventDefault();
        
        if (!window.nagState.isWalkieTalkieMode || 
            window.nagState.isUploading || 
            window.nagState.isPaused) return;
        
        console.log("Walkie-talkie activated (touch)");
        window.nagState.walkieTalkieActive = true;
        logDebug("🔊 Walkie-talkie active (touch) - speak now");
        orb.classList.add("listening");
        
        // Unlock audio context (important for Safari)
        unlockAudio().then(() => {
            if (window.nagState.stream) {
                if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state !== "recording") {
                    startRecording();
                }
            } else {
                // If no stream exists yet, create one
                startListening();
            }
        });
    }, { passive: false }); // passive: false essential for Safari
    
    // Handler for ending walkie-talkie mode
    const endWalkieTalkie = function() {
        if (!window.nagState.walkieTalkieActive) return;
        
        console.log("Walkie-talkie released");
        window.nagState.walkieTalkieActive = false;
        logDebug("🔊 Walkie-talkie released");
        
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
            stopRecording();
        }
    };
    
    // Add all mouse/touch end events
    orb.addEventListener("mouseup", endWalkieTalkie);
    orb.addEventListener("mouseleave", endWalkieTalkie);
    orb.addEventListener("touchend", function(e) {
        e.preventDefault(); // Essential for Safari
        endWalkieTalkie();
    }, { passive: false });
    orb.addEventListener("touchcancel", function(e) {
        e.preventDefault(); // Essential for Safari
        endWalkieTalkie();
    }, { passive: false });
    
    console.log("Walkie-talkie mode setup complete");
}

// Start recording audio
async function startRecording() {
    try {
        if (!window.nagState.mediaRecorder) {
            throw new Error("MediaRecorder not initialized");
        }
        
        if (window.nagState.mediaRecorder.state === 'recording') {
            logDebug("🎤 Already recording");
            return;
        }
        
        window.nagState.mediaRecorder.start();
        window.nagState.recording = true;
        logDebug("🎤 Recording started");
        
        if (window.updateButtonStates) {
            window.updateButtonStates();
        }
    } catch (e) {
        logDebug("❌ Error starting recording: " + e.message);
        if (window.addMessage) {
            window.addMessage("Error starting recording. Please try again.", true);
        }
        window.nagState.recording = false;
        if (window.updateButtonStates) {
            window.updateButtonStates();
        }
    }
}

// Stop recording audio
async function stopRecording() {
  try {
    if (!window.nagState.mediaRecorder) {
      logDebug("⚠️ Cannot stop recording - MediaRecorder not initialized");
      return;
    }

    if (window.nagState.mediaRecorder.state !== "recording") {
      logDebug("⚠️ Cannot stop recording - MediaRecorder not in recording state");
      return;
    }

    logDebug("🛑 Attempting to stop MediaRecorder...");
    
    // For Safari, request final data before stopping
    if (window.nagState.isSafari) {
      // Request data multiple times to ensure we get all chunks
      for (let i = 0; i < 5; i++) {
        window.nagState.mediaRecorder.requestData();
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Wait a short time to ensure the data is processed
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Stop the recorder
    window.nagState.mediaRecorder.stop();
    logDebug("✅ MediaRecorder stopped successfully");
    
    // Clean up stream if it exists
    if (window.nagState.stream) {
      window.nagState.stream.getTracks().forEach(track => track.stop());
      window.nagState.stream = null;
    }
    
    // Reset state
    window.nagState.mediaRecorder = null;
    window.nagState.audioChunks = [];
    
  } catch (e) {
    logDebug("❌ Error stopping recording: " + e.message);
    logDebug("❌ Error stack: " + e.stack);
    
    // Force cleanup in case of error
    if (window.nagState.stream) {
      logDebug("🔄 Forcing stream cleanup...");
      window.nagState.stream.getTracks().forEach(track => {
        logDebug(`🔄 Stopping ${track.kind} track`);
        track.stop();
      });
      window.nagState.stream = null;
    }
    
    // Reset state
    window.nagState.mediaRecorder = null;
    window.nagState.audioChunks = [];
    
    // Restart process after error
    if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused && !window.nagState.interrupted) {
      logDebug("🔄 Scheduling restart after error...");
      setTimeout(() => startListening(), 1000);
    }
  }
}

// Add this function
async function initializeAudioContext() {
    try {
        if (!window.audioContext) {
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            logDebug("🎵 AudioContext created");
        }
        
        if (window.audioContext.state === 'suspended') {
            await window.audioContext.resume();
            logDebug("🎵 AudioContext resumed");
        }
        
        window.audioContextUnlocked = true;
        return true;
    } catch (e) {
        logDebug("❌ Error initializing AudioContext: " + e.message);
        if (window.addMessage) {
            window.addMessage("Error initializing audio. Please refresh the page and try again.", true);
        }
        return false;
    }
}

// Start listening for audio
async function startListening() {
    try {
        if (!window.nagState.audioContext) {
            await initializeAudioContext();
        }
        
        if (!window.nagState.audioContext) {
            throw new Error("Failed to initialize audio context");
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!stream) {
            throw new Error("Failed to access microphone");
        }
        
        window.nagState.mediaStream = stream;
        window.nagState.mediaRecorder = new MediaRecorder(stream);
        window.nagState.audioChunks = [];
        
        window.nagState.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                window.nagState.audioChunks.push(e.data);
            }
        };
        
        window.nagState.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(window.nagState.audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
        };
        
        logDebug("🎤 Microphone access granted");
        if (window.addMessage) {
            window.addMessage("Microphone access granted. You can start recording.", false);
        }
    } catch (e) {
        logDebug("❌ Error accessing microphone: " + e.message);
        if (window.addMessage) {
            window.addMessage("Error accessing microphone. Please check your permissions and try again.", true);
        }
    }
}

// Stop listening
async function stopListening() {
  const orb = window.nagElements.orb;
  const audio = window.nagElements.audio;
  const volumeBar = window.nagElements.volumeBar;
  const pauseBtn = window.nagElements.pauseBtn;
  
  window.nagState.interrupted = true;
  
  if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
    try {
      window.nagState.mediaRecorder.stop();
    } catch (e) {
      logDebug(`Stop recording error: ${e.message}`);
    }
  }
  
  if (window.nagState.stream) {
    window.nagState.stream.getTracks().forEach(track => track.stop());
  }
  
  if (!audio.paused) {
    audio.pause();
    audio.currentTime = 0;
  }
  
  if (window.nagState.analyserNode) {
    window.nagState.analyserNode = null;
  }
  
  volumeBar.style.height = "0%";
  removePlayButton();
  pauseBtn.disabled = true;
  window.nagState.listening = false;
}

// Initialize MediaRecorder with proper audio format
function initializeMediaRecorder(stream) {
  try {
    // For Safari, we need to use audio/mp4
    const mimeType = window.nagState.isSafari ? "audio/mp4" : "audio/webm";
    
    // Check if the MIME type is supported
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      logDebug(`❌ ${mimeType} not supported, trying alternatives...`);
      // Try other formats
      const formats = ["audio/mp4", "audio/webm", "audio/mpeg", "audio/ogg;codecs=opus"];
      for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
          logDebug(`✅ Using alternative format: ${format}`);
          window.nagState.mediaRecorder = new MediaRecorder(stream, {
            mimeType: format,
            audioBitsPerSecond: 128000
          });
          break;
        }
      }
    } else {
      window.nagState.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000
      });
    }
    
    if (!window.nagState.mediaRecorder) {
      throw new Error("No supported audio format found");
    }
    
    logDebug(`Using audio format: ${window.nagState.mediaRecorder.mimeType}`);
    
    // Set up event handlers
    window.nagState.mediaRecorder.ondataavailable = function(e) {
      if (e.data && e.data.size > 0) {
        window.nagState.audioChunks.push(e.data);
        logDebug(`🔊 Audio chunk received: ${e.data.size} bytes`);
      }
    };
    
    window.nagState.mediaRecorder.onstop = async function() {
      logDebug("✅ MediaRecorder stopped successfully");
      logDebug(`📊 Audio chunks collected: ${window.nagState.audioChunks.length}`);
      
      if (window.nagState.audioChunks.length > 0) {
        logDebug(`📊 First chunk size: ${window.nagState.audioChunks[0].size} bytes`);
        logDebug(`📊 Last chunk size: ${window.nagState.audioChunks[window.nagState.audioChunks.length - 1].size} bytes`);
        
        // Calculate total size
        const totalSize = window.nagState.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        logDebug(`📊 Total audio size: ${totalSize} bytes`);
        
        // Process the audio and transcribe
        await processAudioAndTranscribe();
      }
    };
    
    window.nagState.mediaRecorder.onerror = function(e) {
      logDebug("❌ MediaRecorder error: " + e.error.name);
    };
  } catch (e) {
    logDebug("❌ Error initializing MediaRecorder: " + e.message);
  }
}

function updateVolume(analyserNode) {
  if (!analyserNode) return;
  
  const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(dataArray);
  
  // Calculate average volume
  const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
  const volume = Math.min(100, Math.round((average / 255) * 100));
  
  // Safely update volume bar if it exists
  const volumeBar = document.querySelector('.volume-bar');
  if (volumeBar) {
    volumeBar.style.width = `${volume}%`;
    volumeBar.style.backgroundColor = `hsl(${120 + (volume * 1.2)}, 70%, 50%)`;
  }
  
  // Log volume level for debugging
  logDebug(`Volume level: ${volume}%`);
  
  return volume;
}

// Update volume bar visualization
function updateVolumeBar(volume) {
  const volumeBar = document.getElementById('volumeBar');
  if (!volumeBar) return; // Early return if element doesn't exist
  
  // Convert volume to percentage (0-100)
  const percentage = Math.min(100, Math.max(0, Math.round(volume * 100)));
  
  // Update volume bar width
  volumeBar.style.width = `${percentage}%`;
  
  // Update color based on volume level
  if (percentage > 80) {
    volumeBar.style.backgroundColor = '#ff4444'; // Red for loud
  } else if (percentage > 50) {
    volumeBar.style.backgroundColor = '#ffbb33'; // Yellow for medium
  } else {
    volumeBar.style.backgroundColor = '#00C851'; // Green for quiet
  }
}

// Stop listening and recording
window.stopListening = async function() {
  console.log("Stopping listening...");
  if (window.logDebug) window.logDebug("⏹️ Stopping listening...");
  
  try {
    // Stop volume visualization
    if (window.volumeInterval) {
      clearInterval(window.volumeInterval);
      window.volumeInterval = null;
    }
    
    // Reset volume bar if it exists
    const volumeBar = document.getElementById('volumeBar');
    if (volumeBar) {
      volumeBar.style.width = '0%';
      volumeBar.style.backgroundColor = '#00C851';
    }
    
    // Stop media recorder if active
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === 'recording') {
      window.nagState.mediaRecorder.stop();
      window.nagState.mediaRecorder = null;
    }
    
    // Stop audio stream if active
    if (window.nagState.stream) {
      window.nagState.stream.getTracks().forEach(track => track.stop());
      window.nagState.stream = null;
    }
    
    // Reset state
    window.nagState.listening = false;
    window.nagState.audioChunks = [];
    
    // Update UI
    if (window.nagElements.orb) {
      window.nagElements.orb.classList.remove('listening', 'speaking', 'thinking');
      window.nagElements.orb.classList.add('idle');
    }
    
    if (window.nagElements.toggleBtn) {
      window.nagElements.toggleBtn.textContent = "Start Conversation";
      window.nagElements.toggleBtn.classList.remove('active');
    }
    
    if (window.updateButtonStates) {
      window.updateButtonStates();
    }
    
    console.log("Successfully stopped listening");
    if (window.logDebug) window.logDebug("✅ Successfully stopped listening");
  } catch (error) {
    console.error("Error stopping listening:", error);
    if (window.logDebug) window.logDebug(`❌ Error stopping listening: ${error.message}`);
  }
};

async function processAudioAndTranscribe() {
    try {
        if (!window.nagState.audioChunks || window.nagState.audioChunks.length === 0) {
            logDebug("No audio chunks to process");
            return;
        }

        // Create a blob from the audio chunks
        const audioBlob = new Blob(window.nagState.audioChunks, { type: 'audio/wav' });
        
        // Create a FormData object to send the audio
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        
        // Add any additional data needed for transcription
        formData.append('mode', window.nagState.isWalkieTalkieMode ? 'walkie-talkie' : 'continuous');
        
        logDebug("📤 Sending audio for transcription...");
        
        // Send the audio to the server for transcription
        const response = await fetch('/transcribe', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Transcription failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.text) {
            logDebug(`📝 Transcription: ${result.text}`);
            if (window.addMessage) {
                window.addMessage(result.text, true);
            }
            
            // Process the transcribed text
            if (window.processTranscribedText) {
                window.processTranscribedText(result.text);
            }
        } else {
            logDebug("No transcription returned");
        }
        
    } catch (error) {
        logDebug(`❌ Error processing audio: ${error.message}`);
        if (window.addMessage) {
            window.addMessage("Error processing audio. Please try again.", true);
        }
    }
}