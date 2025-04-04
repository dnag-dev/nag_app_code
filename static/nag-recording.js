// Nag Digital Twin v2.0.0 - Recording Functions

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
      
      volumeBar.style.height = `${volume}%`;
      
      // Skip voice activity detection in walkie-talkie mode when not active
      if (window.nagState.isWalkieTalkieMode && !window.nagState.walkieTalkieActive) {
        requestAnimationFrame(updateVolume);
        return;
      }
      
      // Voice activity detection for continuous mode
      if (!window.nagState.isWalkieTalkieMode) {
        // Speech threshold - use higher threshold for Safari to avoid false activations
        const SPEECH_THRESHOLD = window.nagState.isSafari ? 15 : 10;
        // Silence duration before stopping - longer for Safari
        const SILENCE_DELAY = window.nagState.isSafari ? 2000 : 1500;
        
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

// Setup walkie-talkie mode controls
function setupWalkieTalkieMode() {
  const orb = window.nagElements.orb;
  
  // Mouse events for desktop
  orb.addEventListener("mousedown", function(e) {
    if (!window.nagState.isWalkieTalkieMode || !window.nagState.listening || 
        window.nagState.isUploading || window.nagState.isPaused) return;
    
    window.nagState.walkieTalkieActive = true;
    logDebug("🔊 Walkie-talkie active - speak now");
    orb.classList.add("listening");
    
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state !== "recording") {
      startRecording();
    }
  });
  
  // Touch events for mobile
  orb.addEventListener("touchstart", function(e) {
    if (!window.nagState.isWalkieTalkieMode || !window.nagState.listening || 
        window.nagState.isUploading || window.nagState.isPaused) return;
    e.preventDefault(); // Prevent default touch behavior
    
    window.nagState.walkieTalkieActive = true;
    logDebug("🔊 Walkie-talkie active (touch) - speak now");
    orb.classList.add("listening");
    
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state !== "recording") {
      startRecording();
    }
  });
  
  // Handler for ending walkie-talkie mode
  const endWalkieTalkie = function() {
    if (!window.nagState.walkieTalkieActive) return;
    
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
    e.preventDefault();
    endWalkieTalkie();
  });
  orb.addEventListener("touchcancel", function(e) {
    e.preventDefault();
    endWalkieTalkie();
  });
}

// Start recording audio
function startRecording() {
  if (!window.nagState.mediaRecorder || window.nagState.mediaRecorder.state === "recording") return;
  
  logDebug("🎙️ Starting recording...");
  window.nagState.audioChunks = [];
  window.nagState.speechDetected = false;
  
  try {
    // Special handling for Safari to use timeslices
    if (window.nagState.isSafari) {
      // For Safari, use shorter timeslices to get more frequent chunks
      window.nagState.mediaRecorder.start(300); // Get data every 300ms
      logDebug("🎙️ Safari recording with 300ms timeslices");
      
      // Add Safari-specific event handler for dataavailable
      window.nagState.mediaRecorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) {
          // For Safari, we need to ensure the chunk is large enough to contain meaningful audio
          if (e.data.size > 1000) { // Only add chunks larger than 1KB
            window.nagState.audioChunks.push(e.data);
            logDebug(`🔊 Audio chunk received: ${e.data.size} bytes`);
            
            // Update speech detection based on chunk size
            if (e.data.size > 5000) { // Consider chunks > 5KB as likely containing speech
              window.nagState.speechDetected = true;
            }
          }
        }
      };
    } else {
      window.nagState.mediaRecorder.start();
    }
    
    // Use different recording durations based on browser
    // Safari needs shorter recordings for reliability
    const maxRecordingTime = window.nagState.isSafari ? 10000 : 20000;
    
    // Set a maximum recording time to prevent hanging
    window.nagState.longRecordingTimer = setTimeout(() => {
      if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
        logDebug("⏱️ Maximum recording time reached");
        stopRecording();
      }
    }, maxRecordingTime);
  } catch (e) {
    logDebug("❌ Error starting recording: " + e.message);
  }
}

// Stop recording audio
async function stopRecording() {
  if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
    try {
      logDebug("🛑 Attempting to stop MediaRecorder...");
      
      // For Safari, request final data before stopping
      if (window.nagState.isSafari) {
        // Request data multiple times to ensure we get all chunks
        for (let i = 0; i < 3; i++) {
          window.nagState.mediaRecorder.requestData();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Wait a short time to ensure the data is processed
        setTimeout(() => {
          window.nagState.mediaRecorder.stop();
          logDebug("✅ MediaRecorder stopped successfully");
          
          // Log the state of audio chunks
          logDebug(`📊 Audio chunks collected: ${window.nagState.audioChunks.length}`);
          if (window.nagState.audioChunks.length > 0) {
            logDebug(`📊 First chunk size: ${window.nagState.audioChunks[0].size} bytes`);
            logDebug(`📊 Last chunk size: ${window.nagState.audioChunks[window.nagState.audioChunks.length - 1].size} bytes`);
          }
          
          // Log MediaRecorder state
          logDebug(`📊 MediaRecorder state after stop: ${window.nagState.mediaRecorder.state}`);
          
          // Log stream state
          if (window.nagState.stream) {
            const tracks = window.nagState.stream.getTracks();
            logDebug(`📊 Active tracks: ${tracks.length}`);
            tracks.forEach(track => {
              logDebug(`📊 Track ${track.kind} state: ${track.readyState}`);
            });
          }
        }, 500);
      } else {
        window.nagState.mediaRecorder.stop();
        logDebug("✅ MediaRecorder stopped successfully");
      }
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
      }
      
      // Restart process after error
      if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused && !window.nagState.interrupted) {
        logDebug("🔄 Scheduling restart after error...");
        setTimeout(() => startListening(), 1000);
      }
    }
  } else {
    logDebug("⚠️ Cannot stop recording - MediaRecorder not in recording state");
    logDebug(`📊 MediaRecorder state: ${window.nagState.mediaRecorder ? window.nagState.mediaRecorder.state : 'null'}`);
  }
}

// Start listening for audio
async function startListening() {
  const orb = window.nagElements.orb;
  const pauseBtn = window.nagElements.pauseBtn;
  
  if (window.nagState.isUploading || window.nagState.isPaused) return;
  
  try {
    removePlayButton();
    window.nagState.emptyTranscriptionCount = 0;
    window.nagState.speechDetected = false;
    
    orb.classList.remove("idle", "speaking", "thinking");
    orb.classList.add("listening");
    
    // Log detailed mode info
    logDebug("🎙️ Listening... (" + 
      (window.nagState.isWalkieTalkieMode ? "walkie-talkie mode" : "continuous mode") + 
      (window.nagState.isSafari ? ", Safari optimized)" : ")"));

    // Get microphone access with optimal constraints for Safari
    window.nagState.stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Safari-specific optimizations:
        sampleRate: 44100,
        channelCount: 1,
        // Try higher bitrate for clearer audio
        googEchoCancellation: true,
        googAutoGainControl: true,
        googNoiseSuppression: true
      },
      video: false
    });
    
    // Setup volume visualization
    setupVolumeVisualization(window.nagState.stream);

    // Get the best MIME type for this browser
    const mimeType = getBestAudioMimeType();
    logDebug(`Using audio format: ${mimeType || "browser default"}`);
    
    // Create MediaRecorder with optimized settings
    const recorderOptions = {
      mimeType: mimeType || undefined,
      audioBitsPerSecond: window.nagState.isSafari ? 256000 : 128000  // Higher bitrate for Safari
    };
    
    // Create new recorder
    try {
      window.nagState.mediaRecorder = new MediaRecorder(window.nagState.stream, mimeType ? recorderOptions : {});
    } catch (e) {
      // If specified MIME type fails, try with default options
      logDebug(`❌ MediaRecorder error with mime type: ${e.message}, trying default`);
      window.nagState.mediaRecorder = new MediaRecorder(window.nagState.stream);
    }
    
    window.nagState.audioChunks = [];

    // Handle data from recorder with more detailed logging for Safari
    window.nagState.mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) {
        window.nagState.audioChunks.push(e.data);
        // Log chunk size for debugging
        if (window.nagState.isSafari) {
          logDebug(`🔊 Audio chunk received: ${e.data.size} bytes`);
        }
      } else {
        logDebug("⚠️ Empty audio chunk received");
      }
    };

    // Handle recording stopped
    window.nagState.mediaRecorder.onstop = async () => {
      if (window.nagState.interrupted) return;
      orb.classList.remove("listening");
      
      // Clear timers
      if (window.nagState.longRecordingTimer) {
        clearTimeout(window.nagState.longRecordingTimer);
        window.nagState.longRecordingTimer = null;
      }
      
      if (window.nagState.silenceTimer) {
        clearTimeout(window.nagState.silenceTimer);
        window.nagState.silenceTimer = null;
      }
      
      // Check if we got any audio
      if (window.nagState.audioChunks.length === 0) {
        logDebug("⚠️ No audio recorded. Please try again.");
        orb.classList.add("idle");
        if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused) {
          setTimeout(() => {
            if (!window.nagState.interrupted && !window.nagState.isPaused) startListening();
          }, 1000);
        }
        return;
      }
      
      // Process the recorded audio
      await processAudioAndTranscribe();
    };

    // Start recording immediately in continuous mode
    if (!window.nagState.isWalkieTalkieMode) {
      startRecording();
    }
    
    pauseBtn.disabled = false;
    window.nagState.listening = true;
  } catch (e) {
    logDebug("🚫 Mic access failed: " + e.message);
    orb.classList.remove("listening");
    orb.classList.add("idle");
    
    // If permissions were denied, provide guidance
    if (e.name === 'NotAllowedError') {
      logDebug("🎤 Microphone access was denied. Please allow microphone access in your browser settings.");
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