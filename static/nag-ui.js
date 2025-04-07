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

  // Event handler functions
  async function handleToggleClick() {
    try {
        if (!window.nagState.listening) {
            await startListening();
        } else {
            await stopListening();
        }
        updateButtonStates();
    } catch (error) {
        console.error('Error in toggle click handler:', error);
        updateButtonStates();
    }
  }

  async function handlePauseClick() {
    try {
        if (window.nagState.isPaused) {
            await resumeListening();
        } else {
            await pauseListening();
        }
        updateButtonStates();
    } catch (error) {
        console.error('Error in pause click handler:', error);
        updateButtonStates();
    }
  }

  async function handleModeToggleClick() {
    try {
        if (window.nagState.isWalkieTalkieMode) {
            await switchToContinuousMode();
        } else {
            await switchToWalkieTalkieMode();
        }
        updateButtonStates();
    } catch (error) {
        console.error('Error in mode toggle click handler:', error);
        updateButtonStates();
    }
  }

  function handleOrbClick() {
    try {
        if (window.nagState.isWalkieTalkieMode) {
            if (!window.nagState.listening) {
                startListening();
            } else {
                stopListening();
            }
        } else {
            if (!window.nagState.listening) {
                startListening();
            } else {
                stopListening();
            }
        }
        updateButtonStates();
    } catch (error) {
        console.error('Error in orb click handler:', error);
        updateButtonStates();
    }
  }

  function handleOrbMouseDown() {
    try {
        if (window.nagState.isWalkieTalkieMode && !window.nagState.listening) {
            startListening();
            updateButtonStates();
        }
    } catch (error) {
        console.error('Error in orb mousedown handler:', error);
    }
  }

  function handleOrbMouseUp() {
    try {
        if (window.nagState.isWalkieTalkieMode && window.nagState.listening) {
            stopListening();
            updateButtonStates();
        }
    } catch (error) {
        console.error('Error in orb mouseup handler:', error);
    }
  }

  function handleOrbMouseLeave() {
    try {
        if (window.nagState.isWalkieTalkieMode && window.nagState.listening) {
            stopListening();
            updateButtonStates();
        }
    } catch (error) {
        console.error('Error in orb mouseleave handler:', error);
    }
  }

  function handleOrbTouchStart(e) {
    try {
        e.preventDefault();
        if (window.nagState.isWalkieTalkieMode && !window.nagState.listening) {
            startListening();
            updateButtonStates();
        }
    } catch (error) {
        console.error('Error in orb touchstart handler:', error);
    }
  }

  function handleOrbTouchEnd(e) {
    try {
        e.preventDefault();
        if (window.nagState.isWalkieTalkieMode && window.nagState.listening) {
            stopListening();
            updateButtonStates();
        }
    } catch (error) {
        console.error('Error in orb touchend handler:', error);
    }
  }

  function handleOrbTouchCancel(e) {
    try {
        e.preventDefault();
        if (window.nagState.isWalkieTalkieMode && window.nagState.listening) {
            stopListening();
            updateButtonStates();
        }
    } catch (error) {
        console.error('Error in orb touchcancel handler:', error);
    }
  }

  // Improved Safari-compatible orb interaction setup
  function setupOrbInteractions(orb) {
    if (!orb) return;
    
    // Remove any existing listeners to prevent duplicates
    orb.removeEventListener('click', handleOrbClick);
    orb.removeEventListener('mousedown', handleOrbMouseDown);
    orb.removeEventListener('mouseup', handleOrbMouseUp);
    orb.removeEventListener('touchstart', handleOrbTouchStart);
    orb.removeEventListener('touchend', handleOrbTouchEnd);
    
    // Add click handler - regular mode
    orb.addEventListener('click', handleOrbClick);
    
    // Add mouse handlers - walkie talkie mode
    orb.addEventListener('mousedown', handleOrbMouseDown);
    orb.addEventListener('mouseup', handleOrbMouseUp);
    
    // Add touch handlers for mobile Safari
    orb.addEventListener('touchstart', handleOrbTouchStart, { passive: false });
    orb.addEventListener('touchend', handleOrbTouchEnd, { passive: false });
  }

  function updateButtonStates() {
    // Implementation of updateButtonStates function
  }

  function startListening() {
    // Implementation of startListening function
  }

  function stopListening() {
    // Implementation of stopListening function
  }

  function resumeListening() {
    // Implementation of resumeListening function
  }

  function pauseListening() {
    // Implementation of pauseListening function
  }

  function switchToContinuousMode() {
    // Implementation of switchToContinuousMode function
  }

  function switchToWalkieTalkieMode() {
    // Implementation of switchToWalkieTalkieMode function
  }