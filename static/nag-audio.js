// Nag Digital Twin v2.0.0 - Audio Playback Functions

// Function to play audio response with Safari compatibility
async function playAudioResponse(audioUrl) {
    const orb = window.nagElements.orb;
    const audio = window.nagElements.audio;
    
    orb.classList.add("speaking");
    
    // Preload audio for faster response
    try {
      await new Promise((resolve) => {
        const onready = () => {
          audio.oncanplaythrough = null;
          audio.onerror = null;
          resolve();
        };
        
        // Set both success and error handlers to resolve
        // to avoid hanging if the audio file has issues
        audio.oncanplaythrough = onready;
        audio.onerror = (e) => {
          logDebug("⚠️ Audio preload error: " + (e.message || "unknown error"));
          resolve(); // Still resolve to continue the flow
        };
        
        // Set a timeout to avoid hanging if events don't fire
        const timeout = setTimeout(() => {
          logDebug("⚠️ Audio preload timeout");
          resolve();
        }, 5000);
        
        // When either event fires, clear the timeout
        const clearTimeoutWrapper = () => {
          clearTimeout(timeout);
          onready();
        };
        
        audio.oncanplaythrough = clearTimeoutWrapper;
        audio.onerror = clearTimeoutWrapper;
        
        // Set source and load
        audio.src = audioUrl;
        audio.load();
      });
    } catch (e) {
      logDebug("⚠️ Audio preload exception: " + e.message);
    }
    
    // Try to unlock audio again (every time for Safari)
    const unlocked = await unlockAudio();
    
    try {
      // Special handling for Safari/iOS first play
      if ((window.nagState.isSafari || window.nagState.isiOS) && !window.nagState.audioUnlocked) {
        logDebug("🔊 Safari/iOS first play - showing play button");
        showPlayButton(audioUrl);
        return;
      }
      
      // Attempt to play with promise handling
      let playResult = audio.play();
      
      // Set up onended handler for continuous mode
      audio.onended = () => {
        orb.classList.remove("speaking");
        orb.classList.add("idle");
        if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused && !window.nagState.interrupted) {
          startListening();
        }
      };
      
      // Handle the play promise (modern browsers return a promise)
      if (playResult && playResult.then) {
        playResult.catch(e => {
          logDebug("🔇 Auto-play failed: " + e.message);
          // Fall back to manual play button
          showPlayButton(audioUrl);
        });
      }
    } catch (e) {
      logDebug("🔇 Audio play exception: " + e.message);
      showPlayButton(audioUrl);
    }
  }
  
  // Show play button for manual audio playback (for Safari/iOS autoplay restrictions)
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
    
    // Make it more visible on Safari/iOS
    if (window.nagState.isSafari || window.nagState.isiOS) {
      playButton.className = "play-button safari";
      playButton.innerText = "▶️ Tap to Play Response";
      
      // Add hint for Safari users
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
    
    playButton.onclick = () => {
      // Unlock audio for future playbacks
      window.nagState.audioUnlocked = true;
      
      orb.classList.remove("idle");
      orb.classList.add("speaking");
      
      audio.src = audioUrl;
      audio.load();
      
      // Remove any safari hints
      const hint = document.querySelector(".safari-hint");
      if (hint) hint.remove();
      
      audio.play()
        .then(() => {
          removePlayButton();
        })
        .catch(err => {
          logDebug("🔇 Manual play failed: " + err.message);
          orb.classList.remove("speaking");
          orb.classList.add("idle");
        });
      
      audio.onended = () => {
        orb.classList.remove("speaking");
        orb.classList.add("idle");
        if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused && !window.nagState.interrupted) {
          startListening();
        }
      };
    };
  }
  
  // Remove play button if exists
  function removePlayButton() {
    if (window.nagState.currentPlayButton) {
      window.nagState.currentPlayButton.remove();
      window.nagState.currentPlayButton = null;
    }
    
    // Also remove any safari hints
    const hint = document.querySelector(".safari-hint");
    if (hint) hint.remove();
  }

// Nag Digital Twin v2.0.0 - Audio Module

// Function to unlock audio context
async function unlockAudio() {
  console.log("Attempting to unlock audio...");
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    
    // Create and play a silent buffer
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    
    window.nagState.audioUnlocked = true;
    console.log("Audio unlocked successfully");
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    window.nagState.stream = stream;
    
    const mediaRecorder = new MediaRecorder(stream);
    window.nagState.mediaRecorder = mediaRecorder;
    window.nagState.audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      window.nagState.audioChunks.push(event.data);
    };
    
    mediaRecorder.start();
    console.log("Recording started");
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
      window.nagState.mediaRecorder.stop();
      window.nagState.stream.getTracks().forEach(track => track.stop());
    }
    console.log("Recording stopped");
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