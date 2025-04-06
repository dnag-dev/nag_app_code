// Nag Digital Twin v2.0.0 - UI and Event Handling

// Initialize UI elements
function setupUI() {
    // Currently not needed as we're handling UI initialization in the core module
    // This is a placeholder for any future UI setup needs
  }
  
  // Setup all event listeners for UI controls
  function setupEventListeners() {
    if (!window.nagElements) {
      console.error('nagElements not initialized');
      return;
    }

    const toggleBtn = window.nagElements.toggleBtn;
    const pauseBtn = window.nagElements.pauseBtn;
    const modeToggle = window.nagElements.modeToggle;
    
    if (!toggleBtn || !pauseBtn || !modeToggle) {
      console.error('Required UI elements not found');
      return;
    }
    
    // Toggle button (Start/Stop conversation)
    toggleBtn.addEventListener("click", async () => {
      await unlockAudio();
      
      if (window.nagState.listening) {
        logDebug("⏹️ Stopping conversation...");
        toggleBtn.textContent = "Resume Conversation";
        await stopListening();
        window.nagElements.orb.classList.remove("listening", "speaking", "thinking");
        window.nagElements.orb.classList.add("idle");
      } else {
        logDebug("▶️ Starting conversation...");
        toggleBtn.textContent = "Stop Conversation";
        window.nagState.interrupted = false;
        window.nagState.isPaused = false;
        if (pauseBtn) {
          pauseBtn.textContent = "Pause";
          pauseBtn.classList.remove("paused");
        }
        await startListening();
      }
    });
    
    // Pause button
    pauseBtn.addEventListener("click", function() {
      if (!window.nagState.listening) return;
      
      if (window.nagState.isPaused) {
        // Resume conversation
        window.nagState.isPaused = false;
        pauseBtn.textContent = "Pause";
        pauseBtn.classList.remove("paused");
        logDebug("▶️ Conversation resumed");
        addMessage("Conversation resumed", true);
        
        if (!window.nagState.isWalkieTalkieMode) {
          startListening();
        }
      } else {
        // Pause conversation
        window.nagState.isPaused = true;
        pauseBtn.textContent = "Resume";
        pauseBtn.classList.add("paused");
        logDebug("⏸️ Conversation paused");
        addMessage("Conversation paused", true);
        
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
          stopRecording();
        }
      }
    });
    
    // Mode toggle (Walkie-Talkie/Continuous)
    modeToggle.addEventListener("click", function() {
      window.nagState.isWalkieTalkieMode = !window.nagState.isWalkieTalkieMode;
      
      if (window.nagState.isWalkieTalkieMode) {
        modeToggle.textContent = "Switch to continuous mode";
        updateModeHint("Click & hold the orb to use walkie-talkie mode");
        logDebug("🎤 Switched to walkie-talkie mode");
        addMessage("Switched to walkie-talkie mode", true);
        
        if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
          stopRecording();
        }
      } else {
        modeToggle.textContent = "Switch to walkie-talkie mode";
        updateModeHint("Nag will listen continuously for your voice");
        logDebug("🎤 Switched to continuous mode");
        addMessage("Switched to continuous mode", true);
        
        if (window.nagState.listening && !window.nagState.isPaused) {
          startListening();
        }
      }
    });
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