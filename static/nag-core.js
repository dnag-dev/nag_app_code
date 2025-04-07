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
  isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
  
  // Initialization flag
  initialized: false
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

// New helper function to ensure all elements are available
function allElementsAvailable() {
    return window.nagElements.orb && 
           window.nagElements.toggleBtn && 
           window.nagElements.pauseBtn && 
           window.nagElements.modeToggle;
}

// New function to cache all DOM elements in one place
function cacheAllDOMElements() {
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
        debugToggle: document.getElementById("showAllLogs"),
        debugContent: document.querySelector('.debug-content')
    };
    
    // Debug log for all elements
    console.log("Checking UI elements:", window.nagElements);
    Object.entries(window.nagElements).forEach(([key, element]) => {
        console.log(`Element ${key}: ${element ? "Found" : "Not found"}`);
    });
}

// Function to initialize app
function initializeApp() {
    console.log("Initializing app...");
    logMessage("Starting app initialization", "info");
    
    // FIRST - Cache all DOM elements
    cacheAllDOMElements();
    
    // SECOND - Initialize logging and UI
    initializeLogging();
    
    // THIRD - Setup all event listeners
    if (allElementsAvailable()) {
        setupEventListeners(); 
        // Only call these if the main setup succeeds
        if (typeof setupUI === 'function') setupUI();
        if (typeof setupWalkieTalkieMode === 'function') setupWalkieTalkieMode();
        if (typeof setupInterruptionHandling === 'function') setupInterruptionHandling();
    } else {
        logMessage("Warning: Some UI elements not found. Some features may be disabled.", "warning");
    }
    
    // FOURTH - Log browser capabilities for debugging
    if (typeof logBrowserInfo === 'function') {
        logBrowserInfo();
        logMessage("Browser info logged", "debug");
    }
    
    // FINALLY - Connect WebSocket, but continue if it fails
    connectWebSocket();
    
    logMessage("Nag Digital Twin v3.5.0-dev initialized and ready", "success");
}

// Function to update all button states based on current state
function updateButtonStates() {
  if (!window.nagElements) return;
  
  // Update toggle button
  if (window.nagElements.toggleBtn) {
    window.nagElements.toggleBtn.textContent = window.nagState.listening ? "Stop Conversation" : "Start Conversation";
    window.nagElements.toggleBtn.classList.toggle("active", window.nagState.listening);
  }
  
  // Update pause button
  if (window.nagElements.pauseBtn) {
    window.nagElements.pauseBtn.textContent = window.nagState.isPaused ? "Resume" : "Pause";
    window.nagElements.pauseBtn.classList.toggle("paused", window.nagState.isPaused);
  }
  
  // Update mode toggle
  if (window.nagElements.modeToggle) {
    window.nagElements.modeToggle.textContent = window.nagState.isWalkieTalkieMode ? 
      "Switch to continuous mode" : "Switch to walkie-talkie mode";
  }
  
  // Update mode hint
  if (window.nagElements.modeHint) {
    window.nagElements.modeHint.textContent = window.nagState.isWalkieTalkieMode ?
      "Click & hold the orb to use walkie-talkie mode" : "Nag will listen continuously for your voice";
  }
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

// Nag Digital Twin v2.0.0 - Core State Management

// Single source of truth for state initialization
function initializeState() {
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
        isWalkieTalkieMode: false,
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
        
        // Browser detection
        isiOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || 
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
        isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
        
        // Initialization flag
        initialized: false
    };
}

// Function to cache DOM elements
window.cacheElements = function() {
    try {
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
            return false;
        }
        
        return true;
    } catch (error) {
        console.error("Error caching elements:", error);
        return false;
    }
};

// Function to set up event listeners
window.setupEventListeners = function() {
    try {
        // Setup debug toggle
        if (window.nagElements.debugToggle) {
            window.nagElements.debugToggle.onclick = function() {
                window.nagElements.debugPanel.classList.toggle('active');
            };
        }
        
        // Setup button event listeners
        if (window.nagElements.toggleBtn) {
            window.nagElements.toggleBtn.onclick = window.handleToggleClick;
        }
        if (window.nagElements.pauseBtn) {
            window.nagElements.pauseBtn.onclick = window.handlePauseClick;
        }
        if (window.nagElements.modeToggle) {
            window.nagElements.modeToggle.onclick = window.handleModeToggleClick;
        }
        
        // Setup orb interactions
        if (window.nagElements.orb) {
            window.setupOrbInteractions(window.nagElements.orb);
        }
        
        return true;
    } catch (error) {
        console.error("Error setting up event listeners:", error);
        return false;
    }
};

// Unified Safari audio unlocking
window.unlockAudioContext = async function() {
    if (window.nagState.audioUnlocked) return true;
    
    try {
        // Create and immediately suspend an audio context
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // For Safari, we need to resume the context during a user gesture
        await audioContext.resume();
        
        // Create and play a silent buffer (crucial for Safari)
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        
        source.start(0);
        
        // Also try to play the audio element if it exists
        if (window.nagElements && window.nagElements.audio) {
            const audio = window.nagElements.audio;
            
            audio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADQgD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwAQAAAAAAAAAAABSAJAJAQgAAgAAAA0L2YLwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZB4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";
            
            try {
                await audio.play();
                audio.pause();
                audio.currentTime = 0;
            } catch (e) {
                console.log("Auto-play prevented: User interaction needed");
            }
        }
        
        window.nagState.audioUnlocked = true;
        return true;
    } catch (error) {
        console.error("Error unlocking audio:", error);
        return false;
    }
};

// Get the best audio format for the browser
window.getBestAudioFormat = function() {
    const formats = [
        'audio/webm;codecs=opus', 
        'audio/webm', 
        'audio/mp4', 
        'audio/mpeg', 
        'audio/ogg;codecs=opus'
    ];
    
    // Safari needs different format prioritization
    if (window.nagState.isSafari || window.nagState.isiOS) {
        formats.unshift('audio/mp4');
    }
    
    for (const format of formats) {
        try {
            if (MediaRecorder.isTypeSupported(format)) {
                console.log(`Using audio format: ${format}`);
                return format;
            }
        } catch (e) {
            console.error(`Error checking format support for ${format}:`, e);
        }
    }
    
    return ''; // fallback to browser default
};

// Master initialization function
window.initializeApp = function() {
    console.log("Initializing app...");
    
    try {
        // First initialize state
        initializeState();
        
        // Cache DOM elements
        const elementsAvailable = window.cacheElements();
        
        if (!elementsAvailable) {
            console.error("Critical DOM elements missing. Cannot initialize app.");
            return;
        }
        
        // Set up event listeners
        window.setupEventListeners();
        
        // Try to unlock audio context
        window.unlockAudioContext().then(unlocked => {
            console.log("Audio context unlock attempt:", unlocked ? "success" : "waiting for user interaction");
        });
        
        // Add welcome message
        if (window.addMessage) {
            window.addMessage("Welcome to Nag. Click the orb to start.", false);
        }
        
        // Log browser capabilities
        logBrowserInfo();
        
        // Mark as initialized
        window.nagState.initialized = true;
        console.log("App initialization complete");
    } catch (error) {
        console.error("Error during app initialization:", error);
    }
};

// Function to log browser info
function logBrowserInfo() {
    console.log("Browser Info:", {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isSafari: window.nagState.isSafari,
        isiOS: window.nagState.isiOS,
        audioUnlocked: window.nagState.audioUnlocked
    });
}

// Export functions for global use
window.initializeApp = initializeApp;
window.initializeState = initializeState;
window.unlockAudioContext = unlockAudioContext;
window.getBestAudioFormat = getBestAudioFormat;
window.cacheElements = cacheElements;
window.setupEventListeners = setupEventListeners;