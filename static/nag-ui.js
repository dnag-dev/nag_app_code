// Nag Digital Twin v2.0.0 - UI and Event Handling

// Define handler functions at the top level so they're available before use
async function handleToggleClick() {
  console.log("Toggle button clicked");
  try {
    await unlockAudio();
    
    if (window.nagState.listening) {
      console.log("Stopping conversation...");
      logDebug("⏹️ Stopping conversation...");
      window.nagElements.toggleBtn.textContent = "Start Conversation";
      await stopListening();
      window.nagElements.orb.classList.remove("listening", "speaking", "thinking");
      window.nagElements.orb.classList.add("idle");
      addMessage("Conversation stopped", true);
    } else {
      console.log("Starting conversation...");
      logDebug("▶️ Starting conversation...");
      window.nagElements.toggleBtn.textContent = "Stop Conversation";
      window.nagState.interrupted = false;
      window.nagState.isPaused = false;
      if (window.nagElements.pauseBtn) {
        window.nagElements.pauseBtn.textContent = "Pause";
        window.nagElements.pauseBtn.classList.remove("paused");
      }
      await startListening();
      addMessage("Conversation started", true);
    }
    updateButtonStates();
  } catch (error) {
    console.error("Error in toggle button:", error);
    logDebug("❌ Error: " + error.message);
  }
}

function handlePauseClick() {
  console.log("Pause button clicked");
  if (!window.nagState.listening) return;
  
  if (window.nagState.isPaused) {
    // Resume conversation
    window.nagState.isPaused = false;
    window.nagElements.pauseBtn.textContent = "Pause";
    window.nagElements.pauseBtn.classList.remove("paused");
    logDebug("▶️ Conversation resumed");
    addMessage("Conversation resumed", true);
    
    if (!window.nagState.isWalkieTalkieMode) {
      startListening();
    }
  } else {
    // Pause conversation
    window.nagState.isPaused = true;
    window.nagElements.pauseBtn.textContent = "Resume";
    window.nagElements.pauseBtn.classList.add("paused");
    logDebug("⏸️ Conversation paused");
    addMessage("Conversation paused", true);
    
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
      stopRecording();
    }
  }
}

function handleModeToggleClick() {
  console.log("Mode toggle clicked");
  window.nagState.isWalkieTalkieMode = !window.nagState.isWalkieTalkieMode;
  
  if (window.nagState.isWalkieTalkieMode) {
    window.nagElements.modeToggle.textContent = "Switch to Continuous";
    updateModeHint("Click & hold the orb to use walkie-talkie mode");
    logDebug("🎤 Switched to walkie-talkie mode");
    addMessage("Switched to walkie-talkie mode", true);
    
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
      stopRecording();
    }
  } else {
    window.nagElements.modeToggle.textContent = "Switch to Walkie-Talkie";
    updateModeHint("Nag will listen continuously for your voice");
    logDebug("🎤 Switched to continuous mode");
    addMessage("Switched to continuous mode", true);
    
    if (window.nagState.listening && !window.nagState.isPaused) {
      startListening();
    }
  }
}

// Handler functions for orb interactions
function handleOrbClick(e) {
  console.log("Orb clicked", e);
  logDebug("Orb clicked");
  
  // Only handle click in continuous mode
  if (!window.nagState.isWalkieTalkieMode) {
    if (!window.nagState.listening) {
      logDebug("Starting conversation via orb");
      startListening();
      window.nagState.listening = true;
      if (window.nagElements.toggleBtn) {
        window.nagElements.toggleBtn.textContent = "Stop Conversation";
        window.nagElements.toggleBtn.classList.add("active");
      }
    } else {
      logDebug("Stopping conversation via orb");
      stopListening();
      window.nagState.listening = false;
      if (window.nagElements.toggleBtn) {
        window.nagElements.toggleBtn.textContent = "Start Conversation";
        window.nagElements.toggleBtn.classList.remove("active");
      }
    }
    updateButtonStates();
  }
}

function handleOrbDown(e) {
  console.log("Orb pressed (mouse)");
  logDebug("Orb pressed");
  
  if (window.nagState.isWalkieTalkieMode) {
    startListening();
    window.nagState.listening = true;
    if (window.nagElements.toggleBtn) {
      window.nagElements.toggleBtn.textContent = "Stop Conversation";
      window.nagElements.toggleBtn.classList.add("active");
    }
    updateButtonStates();
  }
}

function handleOrbUp(e) {
  console.log("Orb released (mouse)");
  logDebug("Orb released");
  
  if (window.nagState.isWalkieTalkieMode) {
    stopListening();
    window.nagState.listening = false;
    if (window.nagElements.toggleBtn) {
      window.nagElements.toggleBtn.textContent = "Start Conversation";
      window.nagElements.toggleBtn.classList.remove("active");
    }
    updateButtonStates();
  }
}

function handleOrbTouchStart(e) {
  console.log("Orb touched (touchstart)");
  e.preventDefault(); // Essential for Safari
  logDebug("Orb touched");
  
  // Unlock audio on first touch (critical for Safari)
  unlockAudio();
  
  if (window.nagState.isWalkieTalkieMode) {
    startListening();
    window.nagState.listening = true;
    if (window.nagElements.toggleBtn) {
      window.nagElements.toggleBtn.textContent = "Stop Conversation";
      window.nagElements.toggleBtn.classList.add("active");
    }
    updateButtonStates();
  }
}

function handleOrbTouchEnd(e) {
  console.log("Orb touch released (touchend)");
  e.preventDefault(); // Essential for Safari
  logDebug("Orb touch released");
  
  if (window.nagState.isWalkieTalkieMode) {
    stopListening();
    window.nagState.listening = false;
    if (window.nagElements.toggleBtn) {
      window.nagElements.toggleBtn.textContent = "Start Conversation";
      window.nagElements.toggleBtn.classList.remove("active");
    }
    updateButtonStates();
  }
}

// Initialize UI elements
function setupUI() {
  console.log("Setting up UI components...");
  
  // Initialize mode hint with default text
  if (window.nagElements.modeHint) {
    window.nagElements.modeHint.textContent = "Click & hold the orb to use walkie-talkie mode";
    window.nagElements.modeHint.style.display = "block";
  }
  
  // Show the mode hint for a few seconds then hide it
  setTimeout(() => {
    if (window.nagElements.modeHint) {
      window.nagElements.modeHint.style.display = "none";
    }
  }, 5000);
  
  // Add initial welcome message
  addMessage("Welcome to Nag's Digital Twin. How can I help you today?", false);
  
  // Make sure debug container is properly set up
  const debugToggle = document.getElementById('showAllLogs');
  const debugContainer = document.getElementById('debug');
  
  if (debugToggle && debugContainer) {
    // Set initial visibility based on checkbox
    debugContainer.classList.toggle('visible', debugToggle.checked);
    
    // Debug visibility toggle
    debugToggle.addEventListener('change', function() {
      debugContainer.classList.toggle('visible', this.checked);
    });
    
    console.log("Debug panel setup complete");
  }
}

// Improved Safari-compatible orb interaction setup
function setupOrbInteractions(orb) {
  if (!orb) {
    console.error("Orb element not found for interaction setup");
    return;
  }
  
  console.log("Setting up orb interactions");
  
  // Clean any existing listeners first
  const oldClick = orb.onclick;
  const oldMouseDown = orb.onmousedown;
  const oldMouseUp = orb.onmouseup;
  const oldTouchStart = orb.ontouchstart;
  const oldTouchEnd = orb.ontouchend;
  
  if (oldClick) orb.onclick = null;
  if (oldMouseDown) orb.onmousedown = null;
  if (oldMouseUp) orb.onmouseup = null;
  if (oldTouchStart) orb.ontouchstart = null;
  if (oldTouchEnd) orb.ontouchend = null;
  
  // Now add our direct handlers - more reliable than addEventListener for iOS
  orb.onclick = handleOrbClick;
  orb.onmousedown = handleOrbDown;
  orb.onmouseup = handleOrbUp;
  orb.ontouchstart = handleOrbTouchStart;
  orb.ontouchend = handleOrbTouchEnd;
  
  console.log("Orb interactions setup complete");
}