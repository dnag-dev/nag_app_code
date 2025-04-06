// Nag Digital Twin v3.5.0-dev - Core Module
console.log("Nag Digital Twin v3.5.0-dev loading...");

// Initialize logging configuration
if (typeof LOG_CONFIG === 'undefined') {
  window.LOG_CONFIG = {
    showAllLogs: false,
    keyMessages: [
      "Nag Digital Twin",
      "Connected to server",
      "Disconnected from server",
      "Error",
      "Warning",
      "Failed",
      "Exception",
      "Timeout",
      "Retry",
      "Reconnect"
    ]
  };
}

// Function to check if a message is a key message
function isKeyMessage(message) {
  return LOG_CONFIG.keyMessages.some(keyword => 
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

// Function to log messages with different levels
function logMessage(message, level = 'info') {
  if (!window.nagElements || !window.nagElements.debugBox) return;
  
  const debugContent = window.nagElements.debugBox.querySelector('.debug-content');
  if (!debugContent) return;
  
  // Check if we should show this message
  if (!LOG_CONFIG.showAllLogs && !isKeyMessage(message)) return;
  
  // Create log entry
  const entry = document.createElement('div');
  entry.className = `log-entry ${level}`;
  
  // Add timestamp
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  // Add to the beginning of the container
  debugContent.insertBefore(entry, debugContent.firstChild);
}

// Add global error handler
window.addEventListener('error', function(event) {
  console.error('Global error:', event.error);
  
  // Add visible error on screen
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '10px';
  errorDiv.style.left = '10px';
  errorDiv.style.backgroundColor = 'red';
  errorDiv.style.color = 'white';
  errorDiv.style.padding = '10px';
  errorDiv.style.zIndex = '9999';
  errorDiv.textContent = 'JavaScript Error: ' + (event.error ? event.error.message : 'Unknown error');
  document.body.appendChild(errorDiv);
});

// Global state object for sharing between modules
window.nagState = {
  // Recording state
  mediaRecorder: null,
  audioChunks: [],
  stream: null,
  listening: false,
  isUploading: false,
  
  // UI state
  interrupted: false,
  isPaused: false,
  
  // Mode state
  isWalkieTalkieMode: true,
  walkieTalkieActive: false,
  
  // Audio processing
  analyserNode: null,
  silenceTimer: null,
  longRecordingTimer: null,
  audioUnlocked: false,
  speechDetected: false,
  
  // Transcription handling
  lastTranscription: "",
  consecutiveIdenticalTranscriptions: 0,
  emptyTranscriptionCount: 0,
  
  // UI elements cache
  currentPlayButton: null,
  
  // Connection state
  isConnected: false,
  connectionAttempted: false,
  
  // Browser detection
  isiOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
};

// DOM references - will be populated once document is loaded
window.nagElements = {
  orb: null,
  audio: null,
  volumeBar: null,
  toggleBtn: null,
  pauseBtn: null,
  modeToggle: null,
  modeHint: null,
  debugBox: null,
  statusEl: null,
  messagesContainer: null,
  debugToggle: null
};

// Helper to load scripts sequentially with error handling
function loadScript(url, callback) {
  const script = document.createElement('script');
  script.src = url;
  script.onload = callback;
  script.onerror = function() {
    console.error(`Failed to load script: ${url}`);
    if (window.nagElements.debugBox) {
      const p = document.createElement("p");
      p.textContent = `❌ Failed to load: ${url}`;
      p.style.color = "#ff3333";
      window.nagElements.debugBox.appendChild(p);
    }
  };
  document.head.appendChild(script);
}

// Function to update status display
function updateStatus(message, type = 'info') {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = message;
    status.className = `status ${type}`;
  }
  // Also log status changes
  logMessage(message, type);
}

// WebSocket connection with fallback
let nagWebSocket = null;
let nagReconnectAttempts = 0;
const NAG_MAX_RECONNECT_ATTEMPTS = 3;

function connectWebSocket() {
  // If we already attempted and failed, don't try again
  if (window.nagState.connectionAttempted && !window.nagState.isConnected) {
    return;
  }
  
  window.nagState.connectionAttempted = true;
  
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    console.log(`Attempting WebSocket connection to: ${wsUrl}`);
    
    nagWebSocket = new WebSocket(wsUrl);
    
    nagWebSocket.onopen = () => {
      console.log('WebSocket connection established');
      window.nagState.isConnected = true;
      nagReconnectAttempts = 0;
      
      // Update UI to show connected status
      logDebug('✅ Connected to server successfully');
      updateStatus('Connected to server', 'success');
    };
    
    nagWebSocket.onclose = () => {
      window.nagState.isConnected = false;
      console.log('WebSocket closed');
      
      if (nagReconnectAttempts < NAG_MAX_RECONNECT_ATTEMPTS) {
        nagReconnectAttempts++;
        logDebug(`🔄 Connection lost. Retrying (${nagReconnectAttempts}/${NAG_MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(connectWebSocket, 3000);
      } else {
        logDebug('❌ Failed to establish WebSocket connection. Continuing in offline mode.');
        updateStatus('Operating in offline mode', 'info');
      }
    };
    
    nagWebSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      logDebug('⚠️ WebSocket connection error. Continuing in offline mode.');
      updateStatus('Operating in offline mode', 'info');
    };
    
    nagWebSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          updateStatus(data.message, data.status || 'info');
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };
  } catch (e) {
    console.error('WebSocket initialization error:', e);
    logDebug('⚠️ Could not initialize WebSocket. Continuing in offline mode.');
    updateStatus('Operating in offline mode', 'info');
  }
}

// Function to log debug messages
function logDebug(message) {
  if (window.nagElements && window.nagElements.debugBox) {
    const p = document.createElement("p");
    p.textContent = message;
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    p.textContent = `[${timestamp}] ${message}`;
    // Add to the beginning of the container
    window.nagElements.debugBox.querySelector('.debug-content').insertBefore(p, window.nagElements.debugBox.querySelector('.debug-content').firstChild);
  }
}

// Initialize logging toggle
function initializeLogging() {
  const showAllLogsCheckbox = document.getElementById('showAllLogs');
  if (showAllLogsCheckbox) {
    showAllLogsCheckbox.addEventListener('change', function() {
      LOG_CONFIG.showAllLogs = this.checked;
      // Update debug container visibility
      if (window.nagElements.debugBox) {
        window.nagElements.debugBox.classList.toggle('visible', this.checked);
      }
      // Refresh the log display
      const debugContent = window.nagElements.debugBox?.querySelector('.debug-content');
      if (debugContent) {
        const entries = Array.from(debugContent.children);
        debugContent.innerHTML = '';
        entries.forEach(entry => {
          const message = entry.textContent.split('] ').slice(2).join('] ');
          const level = entry.className.split(' ')[1];
          logMessage(message, level);
        });
      }
    });
  }
}

// Function to initialize app
function initializeApp() {
  console.log("Initializing app...");
  logMessage("Starting app initialization", "info");
  
  // Cache DOM elements
  window.nagElements = {
    orb: document.getElementById("orb"),
    audio: document.getElementById("audio"),
    volumeBar: document.querySelector(".volume-bar"),
    toggleBtn: document.getElementById("toggle-btn"),
    pauseBtn: document.getElementById("pause-btn"),
    modeToggle: document.getElementById("mode-toggle"),
    modeHint: document.getElementById("mode-hint"),
    debugBox: document.getElementById("debug"),
    statusEl: document.getElementById("status"),
    messagesContainer: document.getElementById("messages"),
    debugToggle: document.getElementById("showAllLogs")
  };
  
  // Debug log for all elements
  logMessage("Checking UI elements:", "debug");
  Object.entries(window.nagElements).forEach(([key, element]) => {
    logMessage(`${key}: ${element ? "Found" : "Not found"}`, "debug");
  });
  
  // Initialize mode hint with default text
  if (window.nagElements.modeHint) {
    window.nagElements.modeHint.textContent = "Click & hold the orb to use walkie-talkie mode";
    window.nagElements.modeHint.style.display = "block";
    logMessage("Mode hint initialized", "debug");
  }
  
  // Initialize debug container visibility
  if (window.nagElements.debugBox && window.nagElements.debugToggle) {
    window.nagElements.debugBox.classList.toggle('visible', window.nagElements.debugToggle.checked);
    logMessage(`Debug container ${window.nagElements.debugToggle.checked ? "shown" : "hidden"}`, "debug");
  }
  
  // Initialize logging
  initializeLogging();
  logMessage("Logging system initialized", "debug");
  
  // Initialize modules only if elements exist
  if (window.nagElements.toggleBtn && window.nagElements.pauseBtn && window.nagElements.modeToggle) {
    logMessage("Setting up event listeners", "debug");
    
    // Set initial button states
    window.nagElements.toggleBtn.textContent = "Start Conversation";
    window.nagElements.pauseBtn.textContent = "Pause";
    window.nagElements.modeToggle.textContent = "Switch to continuous mode";
    logMessage("Button states initialized", "debug");
    
    // Add click handlers directly
    window.nagElements.toggleBtn.onclick = async function() {
      logMessage("Toggle button clicked", "debug");
      try {
        if (window.nagState.listening) {
          logMessage("Stopping conversation", "debug");
          window.nagElements.toggleBtn.textContent = "Start Conversation";
          await stopListening();
        } else {
          logMessage("Starting conversation", "debug");
          window.nagElements.toggleBtn.textContent = "Stop Conversation";
          await startListening();
        }
      } catch (error) {
        logMessage(`Error in toggle button: ${error.message}`, "error");
      }
    };
    
    window.nagElements.pauseBtn.onclick = function() {
      logMessage("Pause button clicked", "debug");
      if (window.nagState.isPaused) {
        window.nagState.isPaused = false;
        window.nagElements.pauseBtn.textContent = "Pause";
        window.nagElements.pauseBtn.classList.remove("paused");
        logMessage("Resuming conversation", "debug");
      } else {
        window.nagState.isPaused = true;
        window.nagElements.pauseBtn.textContent = "Resume";
        window.nagElements.pauseBtn.classList.add("paused");
        logMessage("Pausing conversation", "debug");
      }
    };
    
    window.nagElements.modeToggle.onclick = function() {
      logMessage("Mode toggle clicked", "debug");
      window.nagState.isWalkieTalkieMode = !window.nagState.isWalkieTalkieMode;
      
      if (window.nagState.isWalkieTalkieMode) {
        window.nagElements.modeToggle.textContent = "Switch to continuous mode";
        window.nagElements.modeHint.textContent = "Click & hold the orb to use walkie-talkie mode";
        logMessage("Switched to walkie-talkie mode", "debug");
      } else {
        window.nagElements.modeToggle.textContent = "Switch to walkie-talkie mode";
        window.nagElements.modeHint.textContent = "Nag will listen continuously for your voice";
        logMessage("Switched to continuous mode", "debug");
      }
    };
    
    // Initialize UI components
    logMessage("Initializing UI components", "debug");
    if (typeof setupUI === 'function') {
      setupUI();
      logMessage("UI setup completed", "debug");
    }
    if (typeof setupWalkieTalkieMode === 'function') {
      setupWalkieTalkieMode();
      logMessage("Walkie-talkie mode setup completed", "debug");
    }
    if (typeof setupEventListeners === 'function') {
      setupEventListeners();
      logMessage("Event listeners setup completed", "debug");
    }
    if (typeof setupInterruptionHandling === 'function') {
      setupInterruptionHandling();
      logMessage("Interruption handling setup completed", "debug");
    }
  } else {
    logMessage("Warning: Some UI elements not found. Some features may be disabled.", "warning");
  }
  
  // Log browser capabilities for debugging
  if (typeof logBrowserInfo === 'function') {
    logBrowserInfo();
    logMessage("Browser info logged", "debug");
  }
  
  // Try to connect WebSocket, but continue if it fails
  connectWebSocket();
  
  logMessage("Nag Digital Twin v3.5.0-dev initialized and ready", "success");
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded, initializing app...");
  initializeApp();
});

// Function to safely play audio with Safari checks
function safePlayAudio(audioElement) {
  if (!audioElement) return;
  
  // Check if we're on mobile Safari
  const isSafariMobile = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) && 
                        /iPhone|iPad|iPod/.test(navigator.userAgent);
  
  if (isSafariMobile) {
    // For Safari, ensure we're in a user gesture context
    audioElement.play().catch(error => {
      logMessage(`Audio playback error: ${error.message}`, 'error');
      // Show hint again if audio fails
      const hint = document.querySelector('.safari-hint');
      if (hint) {
        hint.style.display = 'block';
      }
    });
  } else {
    // For other browsers, proceed normally
    audioElement.play().catch(error => {
      logMessage(`Audio playback error: ${error.message}`, 'error');
    });
  }
}

// Update the setupWalkieTalkieMode function
function setupWalkieTalkieMode() {
  if (!window.nagElements || !window.nagElements.modeToggle) return;
  
  const modeToggle = window.nagElements.modeToggle;
  const modeHint = window.nagElements.modeHint;
  
  modeToggle.addEventListener('change', function() {
    if (this.checked) {
      modeHint.textContent = "Walkie-Talkie Mode: Hold to speak";
      modeHint.style.display = "block";
      
      // Initialize audio only after user interaction
      if (window.nagElements.audio) {
        safePlayAudio(window.nagElements.audio);
      }
    } else {
      modeHint.textContent = "Continuous Mode: Click to start/stop";
      modeHint.style.display = "block";
    }
  });
}

// Update the handleTTSResponse function
function handleTTSResponse(response) {
  if (!response || !response.audio_url) {
    logMessage("No audio URL in TTS response", "error");
    return;
  }

  const audio = window.nagElements.audio;
  if (!audio) {
    logMessage("Audio element not found", "error");
    return;
  }

  audio.src = response.audio_url;
  audio.onloadeddata = () => {
    logMessage("TTS audio loaded and ready", "success");
    updateStatus("Speaking...", "speaking");
    safePlayAudio(audio);
  };
  
  audio.onended = () => {
    updateStatus("Ready", "idle");
    logMessage("TTS playback completed", "info");
  };
  
  audio.onerror = (error) => {
    logMessage(`TTS playback error: ${error.message}`, "error");
    updateStatus("Error playing audio", "error");
  };
}

// Helper to safely update mode hint text
function updateModeHint(text) {
  if (window.nagElements && window.nagElements.modeHint) {
    window.nagElements.modeHint.textContent = text;
  } else {
    console.warn('Mode hint element not initialized yet');
  }
}