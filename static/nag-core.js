// Nag Digital Twin v2.0.0 - Core Module
console.log("Nag Digital Twin v2.0.0 loading...");

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
  debugBox: null
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
  
  // Initialize modules
  if (typeof setupUI === 'function') setupUI();
  if (typeof setupWalkieTalkieMode === 'function') setupWalkieTalkieMode();
  if (typeof setupEventListeners === 'function') setupEventListeners();
  if (typeof setupInterruptionHandling === 'function') setupInterruptionHandling();
  
  // Log browser capabilities for debugging
  if (typeof logBrowserInfo === 'function') logBrowserInfo();
  
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