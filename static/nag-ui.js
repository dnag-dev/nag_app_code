// Nag Digital Twin v2.0.0 - UI and Event Handling

// Initialize UI elements
function setupUI() {
    // Currently not needed as we're handling UI initialization in the core module
    // This is a placeholder for any future UI setup needs
  }
  
  // Setup all event listeners for UI controls
  function setupEventListeners() {
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
    
    // Remove any existing event listeners to prevent duplicates
    toggleBtn.removeEventListener('click', handleToggleClick);
    pauseBtn.removeEventListener('click', handlePauseClick);
    modeToggle.removeEventListener('click', handleModeToggleClick);
    
    // Add using named functions so they can be removed if needed
    toggleBtn.addEventListener('click', handleToggleClick);
    pauseBtn.addEventListener('click', handlePauseClick);
    modeToggle.addEventListener('click', handleModeToggleClick);
    
    // Setup Safari-friendly orb interactions
    setupOrbInteractions(orb);
    
    console.log("Event listeners setup complete");
  }
  
  // Setup interruption handling for better UX
  function setupInterruptionHandling() {
    const orb = window.nagElements.orb;
    const audio = window.nagElements.audio;
    
    document.addEventListener('click', function(e) {
      if (e.target === window.nagElements.toggleBtn || 
          e.target === window.nagElements.pauseBtn ||
          e.target === window.nagElements.modeToggle ||
          e.target === orb ||
          (window.nagState.currentPlayButton && 
           (e.target === window.nagState.currentPlayButton || 
            window.nagState.currentPlayButton.contains(e.target)))) {
        return;
      }
      
      if (orb.classList.contains("speaking")) {
        logDebug("🔄 Interrupting AI response...");
        audio.pause();
        audio.currentTime = 0;
        orb.classList.remove("speaking");
        orb.classList.add("idle");
        
        if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused) {
          setTimeout(() => {
            if (!window.nagState.interrupted && !window.nagState.isPaused) startListening();
          }, 500);
        }
      }
    });
  }

  // Function to add a message to the chat
  function addMessage(text, isUser = false) {
    if (!window.nagElements.messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
    messageDiv.textContent = text;
    
    window.nagElements.messagesContainer.appendChild(messageDiv);
    window.nagElements.messagesContainer.scrollTop = window.nagElements.messagesContainer.scrollHeight;
  }

  // Separate the handlers into named functions
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
        window.nagElements.modeToggle.textContent = "Switch to continuous mode";
        updateModeHint("Click & hold the orb to use walkie-talkie mode");
        logDebug("🎤 Switched to walkie-talkie mode");
        addMessage("Switched to walkie-talkie mode", true);
        
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
            stopRecording();
        }
    } else {
        window.nagElements.modeToggle.textContent = "Switch to walkie-talkie mode";
        updateModeHint("Nag will listen continuously for your voice");
        logDebug("🎤 Switched to continuous mode");
        addMessage("Switched to continuous mode", true);
        
        if (window.nagState.listening && !window.nagState.isPaused) {
            startListening();
        }
    }
  }

  // Improved Safari-compatible orb interaction setup
  function setupOrbInteractions(orb) {
    if (!orb) return;
    
    // Remove any existing listeners to prevent duplicates
    orb.removeEventListener('click', handleOrbClick);
    orb.removeEventListener('mousedown', handleOrbDown);
    orb.removeEventListener('mouseup', handleOrbUp);
    orb.removeEventListener('touchstart', handleOrbTouchStart);
    orb.removeEventListener('touchend', handleOrbTouchEnd);
    
    // Add click handler - regular mode
    orb.addEventListener('click', handleOrbClick);
    
    // Add mouse handlers - walkie talkie mode
    orb.addEventListener('mousedown', handleOrbDown);
    orb.addEventListener('mouseup', handleOrbUp);
    
    // Add touch handlers for mobile Safari
    orb.addEventListener('touchstart', handleOrbTouchStart, { passive: false });
    orb.addEventListener('touchend', handleOrbTouchEnd, { passive: false });
  }

  // Handler functions for orb interactions
  function handleOrbClick() {
    console.log("Orb clicked");
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

  function handleOrbDown() {
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

  function handleOrbUp() {
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