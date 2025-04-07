// Nag Digital Twin v2.0.0 - UI and Event Handling

// Define handler functions
function handleToggleClick() {
  console.log("Toggle button clicked");
  try {
    if (window.unlockAudio) window.unlockAudio();
    
    if (window.nagState.listening) {
      console.log("Stopping conversation...");
      if (window.logDebug) window.logDebug("⏹️ Stopping conversation...");
      if (window.nagElements.toggleBtn) {
        window.nagElements.toggleBtn.textContent = "Start Conversation";
      }
      if (window.stopListening) window.stopListening();
      if (window.nagElements.orb) {
        window.nagElements.orb.classList.remove("listening", "speaking", "thinking");
        window.nagElements.orb.classList.add("idle");
      }
      if (window.addMessage) window.addMessage("Conversation stopped", true);
    } else {
      console.log("Starting conversation...");
      if (window.logDebug) window.logDebug("▶️ Starting conversation...");
      if (window.nagElements.toggleBtn) {
        window.nagElements.toggleBtn.textContent = "Stop Conversation";
      }
      window.nagState.interrupted = false;
      window.nagState.isPaused = false;
      if (window.nagElements.pauseBtn) {
        window.nagElements.pauseBtn.textContent = "Pause";
        window.nagElements.pauseBtn.classList.remove("paused");
      }
      if (window.startListening) window.startListening();
      if (window.addMessage) window.addMessage("Conversation started", true);
    }
    if (window.updateButtonStates) window.updateButtonStates();
  } catch (error) {
    console.error("Error in toggle button:", error);
    if (window.logDebug) window.logDebug("❌ Error: " + error.message);
  }
}

function handlePauseClick() {
  console.log("Pause button clicked");
  if (!window.nagState.listening) return;
  
  if (window.nagState.isPaused) {
    // Resume conversation
    window.nagState.isPaused = false;
    if (window.nagElements.pauseBtn) {
      window.nagElements.pauseBtn.textContent = "Pause";
      window.nagElements.pauseBtn.classList.remove("paused");
    }
    if (window.logDebug) window.logDebug("▶️ Conversation resumed");
    if (window.addMessage) window.addMessage("Conversation resumed", true);
    
    if (!window.nagState.isWalkieTalkieMode && window.startListening) {
      window.startListening();
    }
  } else {
    // Pause conversation
    window.nagState.isPaused = true;
    if (window.nagElements.pauseBtn) {
      window.nagElements.pauseBtn.textContent = "Resume";
      window.nagElements.pauseBtn.classList.add("paused");
    }
    if (window.logDebug) window.logDebug("⏸️ Conversation paused");
    if (window.addMessage) window.addMessage("Conversation paused", true);
    
    if (window.nagState.mediaRecorder && 
        window.nagState.mediaRecorder.state === "recording" && 
        window.stopRecording) {
      window.stopRecording();
    }
  }
}

function handleModeToggleClick() {
  console.log("Mode toggle clicked");
  window.nagState.isWalkieTalkieMode = !window.nagState.isWalkieTalkieMode;
  
  if (window.nagState.isWalkieTalkieMode) {
    if (window.nagElements.modeToggle) {
      window.nagElements.modeToggle.textContent = "Switch to Continuous";
    }
    if (window.updateModeHint) {
      window.updateModeHint("Click & hold the orb to use walkie-talkie mode");
    }
    if (window.logDebug) window.logDebug("🎤 Switched to walkie-talkie mode");
    if (window.addMessage) window.addMessage("Switched to walkie-talkie mode", true);
    
    if (window.nagState.mediaRecorder && 
        window.nagState.mediaRecorder.state === "recording" && 
        window.stopRecording) {
      window.stopRecording();
    }
  } else {
    if (window.nagElements.modeToggle) {
      window.nagElements.modeToggle.textContent = "Switch to Walkie-Talkie";
    }
    if (window.updateModeHint) {
      window.updateModeHint("Nag will listen continuously for your voice");
    }
    if (window.logDebug) window.logDebug("🎤 Switched to continuous mode");
    if (window.addMessage) window.addMessage("Switched to continuous mode", true);
    
    if (window.nagState.listening && !window.nagState.isPaused && window.startListening) {
      window.startListening();
    }
  }
}

// Handler functions for orb interactions
window.handleOrbClick = function(e) {
  console.log("Orb clicked", e);
  if (window.logDebug) window.logDebug("Orb clicked");
  
  // Only handle click in continuous mode
  if (!window.nagState.isWalkieTalkieMode) {
    if (!window.nagState.listening) {
      if (window.logDebug) window.logDebug("Starting conversation via orb");
      if (window.startListening) window.startListening();
      window.nagState.listening = true;
      if (window.nagElements.toggleBtn) {
        window.nagElements.toggleBtn.textContent = "Stop Conversation";
        window.nagElements.toggleBtn.classList.add("active");
      }
    } else {
      if (window.logDebug) window.logDebug("Stopping conversation via orb");
      if (window.stopListening) window.stopListening();
      window.nagState.listening = false;
      if (window.nagElements.toggleBtn) {
        window.nagElements.toggleBtn.textContent = "Start Conversation";
        window.nagElements.toggleBtn.classList.remove("active");
      }
    }
    if (window.updateButtonStates) window.updateButtonStates();
  }
};

window.handleOrbDown = function(e) {
  console.log("Orb pressed (mouse)");
  if (window.logDebug) window.logDebug("Orb pressed");
  
  if (window.nagState.isWalkieTalkieMode) {
    if (window.startListening) window.startListening();
    window.nagState.listening = true;
    if (window.nagElements.toggleBtn) {
      window.nagElements.toggleBtn.textContent = "Stop Conversation";
      window.nagElements.toggleBtn.classList.add("active");
    }
    if (window.updateButtonStates) window.updateButtonStates();
  }
};

window.handleOrbUp = function(e) {
  console.log("Orb released (mouse)");
  if (window.logDebug) window.logDebug("Orb released");
  
  if (window.nagState.isWalkieTalkieMode) {
    if (window.stopListening) window.stopListening();
    window.nagState.listening = false;
    if (window.nagElements.toggleBtn) {
      window.nagElements.toggleBtn.textContent = "Start Conversation";
      window.nagElements.toggleBtn.classList.remove("active");
    }
    if (window.updateButtonStates) window.updateButtonStates();
  }
};

window.handleOrbTouchStart = function(e) {
  console.log("Orb touched (touchstart)");
  if (e && e.preventDefault) e.preventDefault(); // Essential for Safari
  if (window.logDebug) window.logDebug("Orb touched");
  
  // Unlock audio on first touch (critical for Safari)
  if (window.unlockAudio) window.unlockAudio();
  
  if (window.nagState.isWalkieTalkieMode) {
    if (window.startListening) window.startListening();
    window.nagState.listening = true;
    window.nagState.walkieTalkieActive = true;
    if (window.nagElements.toggleBtn) {
      window.nagElements.toggleBtn.textContent = "Stop Conversation";
      window.nagElements.toggleBtn.classList.add("active");
    }
    if (window.updateButtonStates) window.updateButtonStates();
  }
};

window.handleOrbTouchEnd = function(e) {
  console.log("Orb touch released (touchend)");
  if (e && e.preventDefault) e.preventDefault(); // Essential for Safari
  if (window.logDebug) window.logDebug("Orb touch released");
  
  if (window.nagState.isWalkieTalkieMode && window.nagState.walkieTalkieActive) {
    window.nagState.walkieTalkieActive = false;
    if (window.stopListening) window.stopListening();
    window.nagState.listening = false;
    if (window.nagElements.toggleBtn) {
      window.nagElements.toggleBtn.textContent = "Start Conversation";
      window.nagElements.toggleBtn.classList.remove("active");
    }
    if (window.updateButtonStates) window.updateButtonStates();
  }
};

// Initialize UI components
window.setupUI = function() {
  console.log("Setting up UI components...");
  
  // Prevent recursive initialization
  if (window.nagState && window.nagState.initialized) {
    console.log("UI already initialized, skipping...");
    return;
  }
  
  // Ensure DOM is ready
  if (document.readyState !== 'complete') {
    console.log("DOM not ready, waiting...");
    return;
  }
  
  // Initialize state if not exists
  if (!window.nagState) {
    window.nagState = {
      initialized: false,
      listening: false,
      isPaused: false,
      isWalkieTalkieMode: false,
      interrupted: false
    };
  }
  
  // Cache DOM elements
  window.nagElements = {
    messageContainer: document.getElementById('messageContainer'),
    orb: document.getElementById('orb'),
    toggleBtn: document.getElementById('toggleBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    modeToggle: document.getElementById('modeToggle'),
    modeHint: document.getElementById('modeHint'),
    debugPanel: document.getElementById('debugPanel'),
    debugToggle: document.getElementById('debugToggle'),
    audio: document.getElementById('audio'),
    volumeBar: document.getElementById('volumeBar')
  };
  
  // Verify all required elements exist
  const requiredElements = ['messageContainer', 'orb', 'toggleBtn', 'pauseBtn', 'modeToggle', 'modeHint', 'audio'];
  const missingElements = requiredElements.filter(id => !window.nagElements[id]);
  
  if (missingElements.length > 0) {
    console.error("Missing required elements:", missingElements);
    return;
  }

  // Setup orb interactions
  setupOrbInteractions(window.nagElements.orb);
  
  // Setup button event listeners
  window.nagElements.toggleBtn.onclick = handleToggleClick;
  window.nagElements.pauseBtn.onclick = handlePauseClick;
  window.nagElements.modeToggle.onclick = handleModeToggleClick;
  
  // Initialize mode hint with default text
  window.nagElements.modeHint.textContent = "Nag will listen continuously for your voice";
  window.nagElements.modeHint.style.display = "block";
  
  // Show the mode hint for a few seconds then hide it
  setTimeout(() => {
    if (window.nagElements.modeHint) {
      window.nagElements.modeHint.style.display = "none";
    }
  }, 5000);
  
  // Add initial welcome message if not already added
  if (window.addMessage && !window.nagState.initialized) {
    window.addMessage("Welcome to Nag's Digital Twin. How can I help you today?", false);
  }
  
  // Setup debug panel
  if (window.nagElements.debugToggle && window.nagElements.debugPanel) {
    window.nagElements.debugToggle.onclick = function() {
      window.nagElements.debugPanel.classList.toggle('active');
    };
  }
  
  // Mark UI as initialized
  window.nagState.initialized = true;
  console.log("UI setup complete");
};

// Improved Safari-compatible orb interaction setup
window.setupOrbInteractions = function(orb) {
  if (!orb) {
    console.error("Orb element not found for interaction setup");
    return;
  }

  // Remove any existing event listeners
  orb.onclick = null;
  orb.onmousedown = null;
  orb.onmouseup = null;
  orb.onmouseleave = null;
  orb.ontouchstart = null;
  orb.ontouchend = null;
  orb.ontouchcancel = null;

  // Setup new event listeners
  orb.onclick = handleOrbClick;
  orb.onmousedown = handleOrbDown;
  orb.onmouseup = handleOrbUp;
  orb.onmouseleave = handleOrbUp;
  
  // Touch events for mobile/Safari
  orb.ontouchstart = handleOrbTouchStart;
  orb.ontouchend = handleOrbTouchEnd;
  orb.ontouchcancel = handleOrbTouchEnd;
  
  console.log("Orb interactions setup complete");
};

// Helper function to update mode hint
window.updateModeHint = function(text) {
  if (window.nagElements && window.nagElements.modeHint) {
    window.nagElements.modeHint.textContent = text;
    window.nagElements.modeHint.style.display = "block";
    
    // Auto-hide after a few seconds
    setTimeout(() => {
      if (window.nagElements.modeHint) {
        window.nagElements.modeHint.style.display = "none";
      }
    }, 3000);
  }
};

// Export functions for global use
window.handleToggleClick = handleToggleClick;
window.handlePauseClick = handlePauseClick;
window.handleModeToggleClick = handleModeToggleClick;
window.handleOrbClick = handleOrbClick;
window.handleOrbDown = handleOrbDown;
window.handleOrbUp = handleOrbUp;
window.handleOrbTouchStart = handleOrbTouchStart;
window.handleOrbTouchEnd = handleOrbTouchEnd;

// Initialize UI when the script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    if (!window.nagState || !window.nagState.initialized) {
      setupUI();
    }
  });
} else if (!window.nagState || !window.nagState.initialized) {
  setupUI();
}