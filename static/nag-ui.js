// Nag Digital Twin v2.0.0 - UI and Event Handling

// Define handler functions for global use
window.handleToggleClick = async function() {
  console.log("Toggle button clicked");
  try {
    if (window.unlockAudio) await window.unlockAudio();
    
    if (window.nagState.listening) {
      console.log("Stopping conversation...");
      if (window.logDebug) window.logDebug("⏹️ Stopping conversation...");
      if (window.nagElements.toggleBtn) {
        window.nagElements.toggleBtn.textContent = "Start Conversation";
      }
      if (window.stopListening) await window.stopListening();
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
      if (window.startListening) await window.startListening();
      if (window.addMessage) window.addMessage("Conversation started", true);
    }
    if (window.updateButtonStates) window.updateButtonStates();
  } catch (error) {
    console.error("Error in toggle button:", error);
    if (window.logDebug) window.logDebug("❌ Error: " + error.message);
  }
};

window.handlePauseClick = function() {
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
};

window.handleModeToggleClick = function() {
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
};

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

// Initialize UI elements
window.setupUI = function() {
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
  if (window.addMessage) {
    window.addMessage("Welcome to Nag's Digital Twin. How can I help you today?", false);
  }
  
  // Make sure debug container is properly set up
  const debugToggle = document.getElementById('showAllLogs');
  const debugContainer = document.getElementById('debug');
  
  if (debugToggle && debugContainer) {
    // Set initial visibility based on checkbox
    debugContainer.classList.toggle('visible', debugToggle.checked);
    
    // Debug visibility toggle
    debugToggle.onclick = function() {
      debugContainer.classList.toggle('visible', this.checked);
    };
    
    console.log("Debug panel setup complete");
  }
};

// Improved Safari-compatible orb interaction setup
window.setupOrbInteractions = function(orb) {
  if (!orb) {
    console.error("Orb element not found for interaction setup");
    return;
  }
  
  console.log("Setting up orb interactions");
  
  // Clean any existing listeners first
  orb.onclick = null;
  orb.onmousedown = null;
  orb.onmouseup = null;
  orb.onmouseleave = null;
  orb.ontouchstart = null;
  orb.ontouchend = null;
  
  // Now add our direct handlers - more reliable than addEventListener for iOS
  orb.onclick = window.handleOrbClick;
  orb.onmousedown = window.handleOrbDown;
  orb.onmouseup = window.handleOrbUp;
  orb.ontouchstart = window.handleOrbTouchStart;
  orb.ontouchend = window.handleOrbTouchEnd;
  
  console.log("Orb interactions setup complete");
};

// Setup all event listeners for UI controls
window.setupEventListeners = function() {
  console.log("Setting up event listeners...");
  
  if (!window.nagElements) {
    console.error('nagElements not initialized');
    return;
  }

  const toggleBtn = window.nagElements.toggleBtn;
  const pauseBtn = window.nagElements.pauseBtn;
  const modeToggle = window.nagElements.modeToggle;
  const orb = window.nagElements.orb;
  
  if (!toggleBtn || !pauseBtn || !modeToggle || !orb) {
    console.error('Required UI elements not found:', {
      toggleBtn: !!toggleBtn,
      pauseBtn: !!pauseBtn,
      modeToggle: !!modeToggle,
      orb: !!orb
    });
    return;
  }
  
  console.log("All UI elements found, setting up event listeners");
  
  // Use direct assignment for most reliable event handling on iOS/Safari
  toggleBtn.onclick = window.handleToggleClick;
  pauseBtn.onclick = window.handlePauseClick;
  modeToggle.onclick = window.handleModeToggleClick;
  
  // Add special debugging to verify button event handlers
  console.log("Verifying event handlers assigned:", {
    toggleBtn: typeof toggleBtn.onclick === 'function',
    pauseBtn: typeof pauseBtn.onclick === 'function',
    modeToggle: typeof modeToggle.onclick === 'function'
  });
  
  // Set up Safari-friendly orb interactions
  window.setupOrbInteractions(orb);
  
  // Test click to ensure handlers are working
  setTimeout(() => {
    console.log("Event binding test complete");
    if (window.logDebug) window.logDebug("Event listeners configured successfully");
  }, 500);
  
  console.log("Event listeners setup complete");
};

// Setup interruption handling for better UX
window.setupInterruptionHandling = function() {
  console.log("Setting up interruption handling");
  
  // Create a function for the interruption handler
  function handleInterruptionClick(e) {
    // Don't interrupt if clicking on controls
    const target = e.target;
    
    if (target === window.nagElements.toggleBtn || 
        target === window.nagElements.pauseBtn ||
        target === window.nagElements.modeToggle ||
        target === window.nagElements.orb ||
        target.id === 'showAllLogs' ||
        (window.nagState.currentPlayButton && 
         (target === window.nagState.currentPlayButton || 
          window.nagState.currentPlayButton.contains(target)))) {
      return;
    }
    
    // If orb is speaking, interrupt it
    const orb = window.nagElements.orb;
    const audio = window.nagElements.audio;
    
    if (orb && orb.classList.contains("speaking")) {
      if (window.logDebug) window.logDebug("🔄 Interrupting AI response...");
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      orb.classList.remove("speaking");
      orb.classList.add("idle");
      
      if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused) {
        setTimeout(() => {
          if (!window.nagState.interrupted && !window.nagState.isPaused && window.startListening) {
            window.startListening();
          }
        }, 500);
      }
    }
  }
  
  // Use onclick for more reliable handling on mobile
  document.onclick = handleInterruptionClick;
  
  console.log("Interruption handling setup complete");
};

// Function to add a message to the chat
window.addMessage = function(text, isUser = false) {
  // Use the global window.addMessage function if it exists separately
  if (typeof window.addMessage !== window.addMessage && typeof window.addMessage === 'function') {
    window.addMessage(text, isUser);
    return;
  }
  
  // Fallback to direct DOM manipulation
  const messagesContainer = document.getElementById('messages');
  if (!messagesContainer) {
    console.error("Messages container not found");
    return;
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
  messageDiv.textContent = text;
  
  // Add at the bottom (normal chat order)
  messagesContainer.appendChild(messageDiv);
  
  // Scroll to show the new message
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

// Helper function to update mode hint
window.updateModeHint = function(text) {
  const modeHint = document.getElementById('mode-hint');
  if (modeHint) {
    modeHint.textContent = text;
    modeHint.style.display = "block";
    
    // Auto-hide after a few seconds
    setTimeout(() => {
      modeHint.style.display = "none";
    }, 3000);
  }
};