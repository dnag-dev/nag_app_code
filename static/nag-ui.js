// Nag Digital Twin v3.5.0 - UI Module
console.log("Loading nag-ui.js");

// Update button states based on current state
function updateButtonStates() {
    const { listening, isPaused, isWalkieTalkieMode } = window.nagState;
    const { toggleBtn, pauseBtn, modeToggle, orb } = window.nagElements;
    
    // Toggle button
    if (toggleBtn) {
        toggleBtn.textContent = listening ? "Stop Conversation" : "Start Conversation";
        toggleBtn.classList.toggle("active", listening);
    }
    
    // Pause button
    if (pauseBtn) {
        pauseBtn.textContent = isPaused ? "Resume" : "Pause";
        pauseBtn.classList.toggle("paused", isPaused);
        pauseBtn.disabled = !listening;
    }
    
    // Mode toggle
    if (modeToggle) {
        modeToggle.textContent = isWalkieTalkieMode ? 
            "Switch to Continuous Mode" : "Switch to Walkie-Talkie Mode";
    }
    
    // Mode hint
    if (window.nagElements.modeHint) {
        window.nagElements.modeHint.textContent = isWalkieTalkieMode ?
            "Press and hold the orb to speak" : "Click the orb to start listening";
    }
    
    window.logDebug(`Button states updated: listening=${listening}, paused=${isPaused}, walkieTalkie=${isWalkieTalkieMode}`);
}

// Set orb state (idle, listening, thinking, speaking)
function setOrbState(state) {
    const orb = window.nagElements.orb;
    if (!orb) return;
    
    // Remove all states
    orb.classList.remove("idle", "listening", "thinking", "speaking");
    
    // Add new state
    orb.classList.add(state);
    
    window.logDebug(`Orb state set to: ${state}`);
}

// Add a message to the message container
function addMessage(text, isUser = false) {
    const container = window.nagElements.messageContainer;
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    messageDiv.textContent = text;
    
    // Add to container
    container.appendChild(messageDiv);
    
    // Scroll to latest message
    container.scrollTop = container.scrollHeight;
    
    return messageDiv;
}

// Show temporary hint message
function showHint(message, duration = 3000) {
    const modeHint = window.nagElements.modeHint;
    if (!modeHint) return;
    
    // Save original text
    const originalText = modeHint.textContent;
    
    // Show hint
    modeHint.textContent = message;
    modeHint.style.display = 'block';
    
    // Reset after duration
    if (window.nagState.modeHintTimeout) {
        clearTimeout(window.nagState.modeHintTimeout);
    }
    
    window.nagState.modeHintTimeout = setTimeout(() => {
        modeHint.textContent = originalText;
    }, duration);
}

// Setup walkie-talkie mode
function setupWalkieTalkieMode() {
    const orb = window.nagElements.orb;
    if (!orb) return;
    
    // Mouse events for desktop
    orb.addEventListener('mousedown', function(e) {
        if (!window.nagState.isWalkieTalkieMode || window.nagState.isPaused) return;
        
        window.nagState.walkieTalkieActive = true;
        setOrbState("listening");
        
        if (window.startRecording) {
            window.startRecording();
        }
    });
    
    orb.addEventListener('mouseup', function() {
        if (!window.nagState.isWalkieTalkieMode || !window.nagState.walkieTalkieActive) return;
        
        window.nagState.walkieTalkieActive = false;
        setOrbState("idle");
        
        if (window.stopRecording) {
            window.stopRecording();
        }
    });
    
    orb.addEventListener('mouseleave', function() {
        if (!window.nagState.isWalkieTalkieMode || !window.nagState.walkieTalkieActive) return;
        
        window.nagState.walkieTalkieActive = false;
        setOrbState("idle");
        
        if (window.stopRecording) {
            window.stopRecording();
        }
    });
    
    // Touch events for mobile
    orb.addEventListener('touchstart', function(e) {
        if (!window.nagState.isWalkieTalkieMode || window.nagState.isPaused) return;
        
        // Prevent default behavior (important for iOS)
        e.preventDefault();
        
        window.nagState.walkieTalkieActive = true;
        setOrbState("listening");
        
        if (window.startRecording) {
            window.startRecording();
        }
    }, { passive: false }); // passive: false is crucial for iOS
    
    orb.addEventListener('touchend', function() {
        if (!window.nagState.isWalkieTalkieMode || !window.nagState.walkieTalkieActive) return;
        
        window.nagState.walkieTalkieActive = false;
        setOrbState("idle");
        
        if (window.stopRecording) {
            window.stopRecording();
        }
    });
    
    orb.addEventListener('touchcancel', function() {
        if (!window.nagState.isWalkieTalkieMode || !window.nagState.walkieTalkieActive) return;
        
        window.nagState.walkieTalkieActive = false;
        setOrbState("idle");
        
        if (window.stopRecording) {
            window.stopRecording();
        }
    });
    
    window.logDebug("Walkie-talkie mode set up");
}

// Setup continuous mode
function setupContinuousMode() {
    const orb = window.nagElements.orb;
    if (!orb) return;
    
    orb.addEventListener('click', function() {
        if (window.nagState.isWalkieTalkieMode || window.nagState.isPaused) return;
        
        if (window.nagState.listening) {
            // Already listening, stop
            if (window.stopListening) {
                window.stopListening();
            }
            setOrbState("idle");
        } else {
            // Not listening, start
            if (window.startListening) {
                window.startListening();
            }
            setOrbState("listening");
        }
    });
    
    window.logDebug("Continuous mode set up");
}

// Setup debug panel
function setupDebugPanel() {
    const debugToggle = document.getElementById('debugToggle');
    if (!debugToggle) return;
    
    debugToggle.addEventListener('change', function() {
        const isChecked = this.checked;
        document.body.classList.toggle('show-debug', isChecked);
        window.nagState.debugEnabled = isChecked;
        localStorage.setItem('nagDebugEnabled', isChecked);
        
        window.logDebug(`Debug mode ${isChecked ? 'enabled' : 'disabled'}`);
    });
    
    // Initialize from localStorage
    const showDebug = localStorage.getItem('nagDebugEnabled') === 'true';
    debugToggle.checked = showDebug;
    document.body.classList.toggle('show-debug', showDebug);
    window.nagState.debugEnabled = showDebug;
    
    window.logDebug("Debug panel set up");
}

// Initialize UI
function initializeUI() {
    // Set up both modes
    setupWalkieTalkieMode();
    setupContinuousMode();
    
    // Set up debug panel
    setupDebugPanel();
    
    // Initial button states
    updateButtonStates();
    
    window.logDebug("UI initialized");
}

// Make functions globally available
window.updateButtonStates = updateButtonStates;
window.setOrbState = setOrbState;
window.addMessage = addMessage;
window.showHint = showHint;
window.initializeUI = initializeUI;

// Initialize UI when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUI);
} else {
    // If already loaded, initialize immediately
    initializeUI();
}

console.log("nag-ui.js loaded");