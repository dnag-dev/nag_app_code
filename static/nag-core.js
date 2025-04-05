// Nag Digital Twin v2.0.0 - Core Module
console.log("Nag Digital Twin v2.0.0 loading...");

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
  statusEl: null
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
}

// WebSocket connection with fallback
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

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
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      window.nagState.isConnected = true;
      reconnectAttempts = 0;
      
      // Update UI to show connected status
      logDebug('✅ Connected to server successfully');
      updateStatus('Connected to server', 'success');
    };
    
    ws.onclose = () => {
      window.nagState.isConnected = false;
      console.log('WebSocket closed');
      
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        logDebug(`🔄 Connection lost. Retrying (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(connectWebSocket, 3000);
      } else {
        logDebug('❌ Failed to establish WebSocket connection. Continuing in offline mode.');
        updateStatus('Operating in offline mode', 'info');
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      logDebug('⚠️ WebSocket connection error. Continuing in offline mode.');
      updateStatus('Operating in offline mode', 'info');
    };
    
    ws.onmessage = (event) => {
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

// Main initialization function (called after all scripts load)
function initializeApp() {
  // Cache DOM elements
  window.nagElements.orb = document.getElementById("orb");
  window.nagElements.audio = document.getElementById("audio");
  window.nagElements.volumeBar = document.querySelector(".volume-bar");
  window.nagElements.toggleBtn = document.getElementById("toggle-btn");
  window.nagElements.pauseBtn = document.getElementById("pause-btn");
  window.nagElements.modeToggle = document.getElementById("mode-toggle");
  window.nagElements.modeHint = document.getElementById("mode-hint");
  window.nagElements.debugBox = document.getElementById("debug");
  window.nagElements.statusEl = document.getElementById("status");
  
  // Initialize modules
  if (typeof setupUI === 'function') setupUI();
  if (typeof setupWalkieTalkieMode === 'function') setupWalkieTalkieMode();
  if (typeof setupEventListeners === 'function') setupEventListeners();
  if (typeof setupInterruptionHandling === 'function') setupInterruptionHandling();
  
  // Log browser capabilities for debugging
  if (typeof logBrowserInfo === 'function') logBrowserInfo();
  
  // Try to connect WebSocket, but continue if it fails
  connectWebSocket();
  
  console.log("Nag Digital Twin v2.0.0 initialized and ready");
}

// Main entry point - load modules in sequence
document.addEventListener('DOMContentLoaded', function() {
  // Load scripts sequentially to ensure proper dependency chain
  loadScript('/static/nag-utils.js', function() {
    loadScript('/static/nag-audio.js', function() {
      loadScript('/static/nag-recording.js', function() {
        loadScript('/static/nag-ui.js', function() {
          loadScript('/static/nag-transcription.js', function() {
            // Initialize app after all scripts are loaded
            console.log("Nag Digital Twin v2.0.0 - All modules loaded");
            initializeApp();
          });
        });
      });
    });
  });
});