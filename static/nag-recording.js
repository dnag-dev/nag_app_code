// Nag Digital Twin v1.6.0 - Recording Functions

// Setup volume visualization for the orb
function setupVolumeVisualization(stream) {
  try {
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
      const volume = Math.min(100, Math.max(0, average * 2.5));
      
      document.querySelector(".volume-bar").style.height = `${volume}%`;
      
      if (window.nagState.isWalkieTalkieMode && !window.nagState.walkieTalkieActive) {
        requestAnimationFrame(updateVolume);
        return;
      }
      
      // Speech threshold - use higher threshold to avoid false activations
      const SPEECH_THRESHOLD = window.nagState.isSafari ? 15 : 10; // Higher for Safari
      const SILENCE_DELAY = window.nagState.isSafari ? 2000 : 1500; // Longer for Safari
      
      if (!window.nagState.isWalkieTalkieMode && volume < SPEECH_THRESHOLD) {
        if (!window.nagState.silenceTimer) {
          window.nagState.silenceTimer = setTimeout(() => {
            // Only stop if we detected actual speech before
            if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording" && window.nagState.speechDetected) {
              logDebug("🔇 Silence detected, stopping recording");
              stopRecording();
            } else if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
              // If no speech was detected, restart recording
              logDebug("🔇 No speech detected, restarting recording");
              stopRecording();
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
      
      requestAnimationFrame(updateVolume);
    }
    
    requestAnimationFrame(updateVolume);
  } catch (e) {
    logDebug("⚠️ Volume visualization not available: " + e.message);
  }
}

// Setup walkie-talkie mode
function setupWalkieTalkieMode() {
  const orb = document.getElementById("orb");
  
  orb.addEventListener("mousedown", function(e) {
    if (!window.nagState.isWalkieTalkieMode || !window.nagState.listening || window.nagState.isUploading || window.nagState.isPaused) return;
    
    window.nagState.walkieTalkieActive = true;
    logDebug("🔊 Walkie-talkie active - speak now");
    orb.classList.add("listening");
    
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state !== "recording") {
      startRecording();
    }
  });
  
  orb.addEventListener("touchstart", function(e) {
    if (!window.nagState.isWalkieTalkieMode || !window.nagState.listening || window.nagState.isUploading || window.nagState.isPaused) return;
    e.preventDefault();
    
    window.nagState.walkieTalkieActive = true;
    logDebug("🔊 Walkie-talkie active - speak now");
    orb.classList.add("listening");
    
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state !== "recording") {
      startRecording();
    }
  });
  
  const endWalkieTalkie = function() {
    if (!window.nagState.walkieTalkieActive) return;
    
    window.nagState.walkieTalkieActive = false;
    logDebug("🔊 Walkie-talkie released");
    
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
      stopRecording();
    }
  };
  
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

// Start recording
function startRecording() {
  if (!window.nagState.mediaRecorder || window.nagState.mediaRecorder.state === "recording") return;
  
  window.nagState.audioChunks = [];
  window.nagState.mediaRecorder.start();
  
  // Use different recording durations based on browser
  const maxRecordingTime = window.nagState.isSafari ? 8000 : 20000; // Longer for Chrome
  
  window.nagState.longRecordingTimer = setTimeout(() => {
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
      logDebug("⏱️ Maximum recording time reached");
      stopRecording();
    }
  }, maxRecordingTime);
}

// Stop recording
function stopRecording() {
  if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
    window.nagState.mediaRecorder.stop();
  }
}

// Start listening for audio
async function startListening() {
  if (window.nagState.isUploading || window.nagState.isPaused) return;
  
  try {
    removePlayButton();
    window.nagState.emptyTranscriptionCount = 0;
    window.nagState.speechDetected = false;
    
    document.getElementById("orb").classList.remove("idle", "speaking", "thinking");
    document.getElementById("orb").classList.add("listening");
    logDebug("🎙️ Listening... (v1.6.0 - " + (window.nagState.isWalkieTalkieMode ? "walkie-talkie mode" : "continuous mode") + ")");

    window.nagState.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupVolumeVisualization(window.nagState.stream);

    let mimeType = "";
    const supportedTypes = (window.nagState.isiOS || window.nagState.isSafari) 
      ? ["audio/mp4", "audio/mpeg", "audio/webm", "audio/ogg;codecs=opus", ""]
      : ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg;codecs=opus", ""];
    
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        logDebug(`Using audio format: ${mimeType || "browser default"}`);
        break;
      }
    }
    
    // Create MediaRecorder with optimized settings for Safari
    const recorderOptions = {
      mimeType: mimeType || undefined,
      audioBitsPerSecond: 128000  // Consistent bitrate
    };
    
    window.nagState.mediaRecorder = new MediaRecorder(window.nagState.stream, mimeType ? recorderOptions : {});
    window.nagState.audioChunks = [];

    window.nagState.mediaRecorder.ondataavailable = e => window.nagState.audioChunks.push(e.data);

    window.nagState.mediaRecorder.onstop = async () => {
      if (window.nagState.interrupted) return;
      document.getElementById("orb").classList.remove("listening");
      
      if (window.nagState.longRecordingTimer) {
        clearTimeout(window.nagState.longRecordingTimer);
        window.nagState.longRecordingTimer = null;
      }
      
      if (window.nagState.silenceTimer) {
        clearTimeout(window.nagState.silenceTimer);
        window.nagState.silenceTimer = null;
      }
      
      if (window.nagState.audioChunks.length === 0) {
        logDebug("⚠️ No audio recorded. Please try again.");
        document.getElementById("orb").classList.add("idle");
        if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused) {
          setTimeout(() => {
            if (!window.nagState.interrupted && !window.nagState.isPaused) startListening();
          }, 1000);
        }
        return;
      }
      
      await processAudioAndTranscribe();
    };

    if (!window.nagState.isWalkieTalkieMode) {
      startRecording();
    }
    
    document.getElementById("pause-btn").disabled = false;
  } catch (e) {
    logDebug("🚫 Mic access failed: " + e.message);
    document.getElementById("orb").classList.remove("listening");
    document.getElementById("orb").classList.add("idle");
  }
}

// Stop listening
async function stopListening() {
  window.nagState.interrupted = true;
  
  if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
    window.nagState.mediaRecorder.stop();
  }
  
  if (window.nagState.stream) {
    window.nagState.stream.getTracks().forEach(track => track.stop());
  }
  
  if (!document.getElementById("audio").paused) {
    document.getElementById("audio").pause();
    document.getElementById("audio").currentTime = 0;
  }
  
  if (window.nagState.analyserNode) {
    window.nagState.analyserNode = null;
  }
  
  document.querySelector(".volume-bar").style.height = "0%";
  removePlayButton();
  document.getElementById("pause-btn").disabled = true;
}

// Load the transcription module
loadScript('/static/nag-transcription.js');