// Nag Digital Twin v2.0.0 - UI and Event Handling

// More aggressive attribute cleanup
function cleanupButtonAttributes(element) {
    if (!element) return;

    const essentialAttrs = ['id', 'class', 'role', 'tabindex', 'aria-label', 'disabled', 'type'];
    const attrs = element.attributes;

    // Remove all attributes EXCEPT essential ones
    for (let i = attrs.length - 1; i >= 0; i--) {
        const attrName = attrs[i].name.toLowerCase();
        if (!essentialAttrs.includes(attrName) && !attrName.startsWith('on')) { // Keep event handlers
            try {
                element.removeAttribute(attrs[i].name);
            } catch (e) {
                console.warn(`Failed to remove attribute ${attrs[i].name}:`, e);
            }
        }
    }

    // Ensure basic styles (important for Safari)
    // We need to be careful not to override intended styles completely
    // Let's apply only the absolute necessary resets for Safari issues
    element.style.webkitAppearance = 'none';
    element.style.appearance = 'none';
    element.style.webkitTapHighlightColor = 'transparent';
    // Avoid setting background/border/padding here as it might override intentional styles
}

// Ensure all buttons are cleaned up initially and on mutations
function cleanupAllButtons() {
    const buttons = document.querySelectorAll('button, [role="button"], .orb');
    buttons.forEach(button => {
        cleanupButtonAttributes(button);
    });
}

// Call cleanupAllButtons after DOM is loaded and observe mutations
document.addEventListener('DOMContentLoaded', function() {
    cleanupAllButtons();

    const observer = new MutationObserver(function(mutations) {
        let needsCleanup = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes') {
                 // If an attribute changed on a button-like element, re-clean it
                 if (mutation.target.matches('button, [role="button"], .orb')) {
                     cleanupButtonAttributes(mutation.target);
                     needsCleanup = true; // Mark that a cleanup happened
                 }
            } else if (mutation.addedNodes.length) {
                // If new nodes were added, check if any are buttons and clean them
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('button, [role="button"], .orb')) {
                        cleanupButtonAttributes(node);
                        needsCleanup = true;
                    }
                    // Also check descendants of added nodes
                    if (node.nodeType === 1 && node.querySelectorAll) {
                         node.querySelectorAll('button, [role="button"], .orb').forEach(btn => {
                            cleanupButtonAttributes(btn);
                            needsCleanup = true;
                         });
                    }
                });
            }
        });
        // Optional: log if cleanup occurred within mutation observer
        // if (needsCleanup) console.log("Mutation observer triggered button cleanup.");
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true, // Observe attribute changes too
        attributeFilter: ['iconName', 'layoutTraits', 'src', 'style', 'class'] // Focus on relevant attributes
    });
});

// Define handler functions (ensure cleanup is called within them)
function handleToggleClick() {
  console.log("Toggle button clicked");
  try {
    if (window.unlockAudio) window.unlockAudio();

    const toggleBtn = window.nagElements.toggleBtn;
    const orb = window.nagElements.orb;

    if (window.nagState.listening) {
      console.log("Stopping conversation...");
      if (window.logDebug) window.logDebug("⏹️ Stopping conversation...");
      if (toggleBtn) {
        toggleBtn.textContent = "Start Conversation";
        toggleBtn.classList.remove("active");
        cleanupButtonAttributes(toggleBtn); // Clean after state change
      }
      if (window.stopListening) window.stopListening();
      if (orb) {
        orb.classList.remove("listening", "speaking", "thinking");
        orb.classList.add("idle");
        cleanupButtonAttributes(orb); // Clean after state change
      }
      if (window.addMessage) window.addMessage("Conversation stopped", true);
    } else {
      console.log("Starting conversation...");
      if (window.logDebug) window.logDebug("▶️ Starting conversation...");
      if (toggleBtn) {
        toggleBtn.textContent = "Stop Conversation";
        toggleBtn.classList.add("active");
        cleanupButtonAttributes(toggleBtn); // Clean after state change
      }
      window.nagState.interrupted = false;
      window.nagState.isPaused = false;
      if (window.nagElements.pauseBtn) {
        const pauseBtn = window.nagElements.pauseBtn;
        pauseBtn.textContent = "Pause";
        pauseBtn.classList.remove("paused");
        cleanupButtonAttributes(pauseBtn); // Clean after state change
      }
      if (window.startListening) window.startListening();
      if (window.addMessage) window.addMessage("Conversation started", true);
    }
    if (window.updateButtonStates) window.updateButtonStates(); // Ensure this also cleans if needed
  } catch (error) {
    console.error("Error in toggle button:", error);
    if (window.logDebug) window.logDebug("❌ Error: " + error.message);
  }
}

function handlePauseClick() {
  console.log("Pause button clicked");
  if (!window.nagState.listening) return;

  const pauseBtn = window.nagElements.pauseBtn;
  if (!pauseBtn) return;

  if (window.nagState.isPaused) {
    // Resume conversation
    window.nagState.isPaused = false;
    pauseBtn.textContent = "Pause";
    pauseBtn.classList.remove("paused");
    cleanupButtonAttributes(pauseBtn); // Clean after state change
    if (window.logDebug) window.logDebug("▶️ Conversation resumed");
    if (window.addMessage) window.addMessage("Conversation resumed", true);

    if (!window.nagState.isWalkieTalkieMode && window.startListening) {
      window.startListening(); // Restart listening if needed
    }
  } else {
    // Pause conversation
    window.nagState.isPaused = true;
    pauseBtn.textContent = "Resume";
    pauseBtn.classList.add("paused");
    cleanupButtonAttributes(pauseBtn); // Clean after state change
    if (window.logDebug) window.logDebug("⏸️ Conversation paused");
    if (window.addMessage) window.addMessage("Conversation paused", true);

    // Stop recording immediately when paused
    if (window.nagState.mediaRecorder &&
        window.nagState.mediaRecorder.state === "recording" &&
        window.stopRecording) {
      window.stopRecording();
    }
  }
}


function handleModeToggleClick() {
  console.log("Mode toggle clicked");
  try {
    if (!window.nagState) {
      console.error("Nag state not initialized");
      return;
    }
    const modeToggle = window.nagElements.modeToggle;
    const modeHint = window.nagElements.modeHint;


    // Toggle walkie-talkie mode
    window.nagState.isWalkieTalkieMode = !window.nagState.isWalkieTalkieMode;

    // Update mode toggle button
    if (modeToggle) {
      // Update button text
      modeToggle.textContent = window.nagState.isWalkieTalkieMode ?
        "Switch to Continuous Mode" : "Switch to Walkie-Talkie Mode";
      // Update button class
      modeToggle.classList.toggle("walkie-talkie", window.nagState.isWalkieTalkieMode);
      cleanupButtonAttributes(modeToggle); // Clean after state change
    }

    // Update mode hint
    if (modeHint) {
        const hintText = window.nagState.isWalkieTalkieMode ?
          "Click & hold the orb to use walkie-talkie mode" :
          "Nag will listen continuously for your voice";
        // Update hint text only if it exists
        if (modeHint.firstChild && modeHint.firstChild.nodeType === Node.TEXT_NODE) {
            modeHint.firstChild.nodeValue = hintText;
        } else {
            modeHint.textContent = hintText; // Fallback if structure is different
        }
      modeHint.style.display = "block"; // Ensure hint is visible

      // Hide hint after 5 seconds (use a variable to manage timeout)
      if (window.modeHintTimeout) clearTimeout(window.modeHintTimeout);
      window.modeHintTimeout = setTimeout(() => {
        if (window.nagElements.modeHint) { // Check if element still exists
          window.nagElements.modeHint.style.display = "none";
        }
      }, 5000);
    }

    // Log mode change
    if (window.logDebug) {
      window.logDebug(window.nagState.isWalkieTalkieMode ?
        "🎤 Switched to walkie-talkie mode" :
        "🎤 Switched to continuous mode");
    }

    // If switching *out* of walkie-talkie mode and currently listening, ensure continuous listening starts
    if (!window.nagState.isWalkieTalkieMode && window.nagState.listening && !window.nagState.isPaused) {
        if (window.startListening) window.startListening();
    }
    // If switching *into* walkie-talkie mode and listening, stop continuous recording
    else if (window.nagState.isWalkieTalkieMode && window.nagState.listening) {
       if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording" && window.stopRecording) {
           window.stopRecording(); // Stop continuous recording
           console.log("Stopped continuous recording for walkie-talkie mode.");
       }
    }

     if (window.updateButtonStates) window.updateButtonStates(); // Ensure this also cleans if needed

  } catch (error) {
    console.error("Error in mode toggle button:", error);
    if (window.logDebug) window.logDebug(`❌ Error: ${error.message}`);
  }
}

// Central function to update button states based on nagState
function updateButtonStates() {
    const { listening, isPaused, isWalkieTalkieMode } = window.nagState;
    const { toggleBtn, pauseBtn, modeToggle, orb } = window.nagElements;

    // Toggle Button
    if (toggleBtn) {
        toggleBtn.textContent = listening ? "Stop Conversation" : "Start Conversation";
        toggleBtn.classList.toggle("active", listening);
        toggleBtn.disabled = false; // Generally enabled unless specific conditions
        cleanupButtonAttributes(toggleBtn);
    }

    // Pause Button
    if (pauseBtn) {
        pauseBtn.textContent = isPaused ? "Resume" : "Pause";
        pauseBtn.classList.toggle("paused", isPaused);
        pauseBtn.disabled = !listening; // Can only pause/resume if listening
        cleanupButtonAttributes(pauseBtn);
    }

    // Mode Toggle Button
    if (modeToggle) {
        modeToggle.textContent = isWalkieTalkieMode ? "Switch to Continuous Mode" : "Switch to Walkie-Talkie Mode";
        modeToggle.classList.toggle("walkie-talkie", isWalkieTalkieMode);
        modeToggle.disabled = listening; // Disable mode switching during active conversation
        cleanupButtonAttributes(modeToggle);
    }

    // Orb State (visual only, not disabled state)
    if (orb) {
        // Clear previous states
        orb.classList.remove("idle", "listening", "thinking", "speaking");

        if (listening && !isPaused) {
             // Reflecting recording state more accurately might need access to mediaRecorder state
             // For now, just use 'listening' if conversation is active
            orb.classList.add("listening");
            // Potentially add 'thinking' or 'speaking' based on other state flags if available
        } else {
            orb.classList.add("idle");
        }
        cleanupButtonAttributes(orb);
    }

    console.log("Button states updated:", { listening, isPaused, isWalkieTalkieMode });
}


// Orb Interaction Logic (Walkie-Talkie Mode)
function setupWalkieTalkieMode() {
    const orb = window.nagElements.orb;
    if (!orb) return;

    let isHeld = false;

    // Mouse events
    orb.addEventListener('mousedown', (e) => {
        if (!window.nagState.isWalkieTalkieMode || !window.nagState.listening) return;
        e.preventDefault(); // Prevent text selection/drag
        isHeld = true;
        orb.classList.add('listening'); // Show active state
        if (window.startRecording) window.startRecording();
    });

    orb.addEventListener('mouseup', () => {
        if (!window.nagState.isWalkieTalkieMode || !isHeld) return;
        isHeld = false;
        orb.classList.remove('listening');
        if (window.stopRecording) window.stopRecording();
    });

    orb.addEventListener('mouseleave', () => {
        if (!window.nagState.isWalkieTalkieMode || !isHeld) return;
        isHeld = false;
        orb.classList.remove('listening');
        if (window.stopRecording) window.stopRecording(); // Stop if mouse leaves while held
    });

    // Touch events
    orb.addEventListener('touchstart', (e) => {
        if (!window.nagState.isWalkieTalkieMode || !window.nagState.listening) return;
        e.preventDefault(); // Important for mobile to prevent scrolling/zooming
        isHeld = true;
        orb.classList.add('listening');
        if (window.startRecording) window.startRecording();
    }, { passive: false }); // Need passive: false to call preventDefault

    orb.addEventListener('touchend', () => {
        if (!window.nagState.isWalkieTalkieMode || !isHeld) return;
        isHeld = false;
        orb.classList.remove('listening');
        if (window.stopRecording) window.stopRecording();
    });

     orb.addEventListener('touchcancel', () => {
        if (!window.nagState.isWalkieTalkieMode || !isHeld) return;
        isHeld = false;
        orb.classList.remove('listening');
        if (window.stopRecording) window.stopRecording(); // Stop if touch is cancelled
    });
}


// Add event listeners after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const { toggleBtn, pauseBtn, modeToggle, orb } = window.nagElements;

    if (toggleBtn) {
        toggleBtn.onclick = handleToggleClick;
    } else {
        console.error("Toggle button not found for event listener.");
    }

    if (pauseBtn) {
        pauseBtn.onclick = handlePauseClick;
    } else {
        console.error("Pause button not found for event listener.");
    }

    if (modeToggle) {
        modeToggle.onclick = handleModeToggleClick;
    } else {
        console.error("Mode toggle button not found for event listener.");
    }

    // Orb click listener (for non-walkie-talkie mode start)
    if (orb) {
        orb.onclick = () => {
            // Only trigger if not listening and not in walkie-talkie mode (handled by touch/mouse)
            if (!window.nagState.listening && !window.nagState.isWalkieTalkieMode) {
                handleToggleClick(); // Simulate start button click
            }
        };
        setupWalkieTalkieMode(); // Setup mouse/touch handlers for walkie-talkie
    } else {
         console.error("Orb element not found for event listener.");
    }

    // Initial state update
    if (window.updateButtonStates) updateButtonStates();

    console.log("UI Event listeners attached.");
});

// Example function to update orb state (call this from core logic)
function setOrbState(state) { // state can be 'idle', 'listening', 'thinking', 'speaking'
    const orb = window.nagElements.orb;
    if (!orb) return;
    orb.classList.remove('idle', 'listening', 'thinking', 'speaking');
    orb.classList.add(state);
    cleanupButtonAttributes(orb); // Clean after state change
    console.log(`Orb state set to: ${state}`);
}

// Ensure updateButtonStates exists globally if called from elsewhere
if (typeof window !== 'undefined') {
    window.updateButtonStates = updateButtonStates;
    window.setOrbState = setOrbState;
    window.cleanupButtonAttributes = cleanupButtonAttributes; // Make cleanup accessible if needed
    window.cleanupAllButtons = cleanupAllButtons; // Make full cleanup accessible if needed
}

console.log("nag-ui.js loaded");

// Final check after everything
window.addEventListener('load', () => {
    console.log("Window load event: Running final button cleanup.");
    cleanupAllButtons();
});