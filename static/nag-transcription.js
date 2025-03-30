// Nag Digital Twin v1.6.0 - Core
console.log("Nag Digital Twin v1.6.0 loaded");

// Import other modules
document.addEventListener('DOMContentLoaded', function() {
  // Load additional script files
  loadScript('/static/nag-audio.js', function() {
    loadScript('/static/nag-ui.js', function() {
      loadScript('/static/nag-recording.js', function() {
        loadScript('/static/nag-transcription.js', function() {
          // Initialize after all scripts are loaded
          initializeApp();
        });
      });
    });
  });
});

// Helper to load scripts sequentially
function loadScript(url, callback) {
  const script = document.createElement('script');
  script.src = url;
  script.onload = callback;
  document.head.appendChild(script);
}

// Global state for sharing between modules
window.nagState = {
  mediaRecorder: null,
  audioChunks: [],
  stream: null,
  listening: false,
  interrupted: false,
  currentPlayButton: null,
  emptyTranscriptionCount: 0,
  isUploading: false,
  isPaused: false,
  isWalkieTalkieMode: true,
  analyserNode: null,
  walkieTalkieActive: false,
  silenceTimer: null,
  longRecordingTimer: null,
  lastTranscription: "",
  consecutiveIdenticalTranscriptions: 0,
  speechDetected: false,
  audioUnlocked: false,
  
  // Browser detection
  isiOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
};

// Main initialization function (called after all scripts load)
function initializeApp() {
  setupUI();
  setupWalkieTalkieMode();
  setupInterruptionHandling();
  
  // Set up event listeners
  setupEventListeners();
  
  // Log browser capabilities
  logInfo();
}

// Setup interruption handling
function setupInterruptionHandling() {
  document.addEventListener('click', function(e) {
    if (e.target === document.getElementById("toggle-btn") || 
        e.target === document.getElementById("pause-btn") ||
        e.target === document.getElementById("mode-toggle") ||
        e.target === document.getElementById("orb") ||
        (window.nagState.currentPlayButton && 
         (e.target === window.nagState.currentPlayButton || 
          window.nagState.currentPlayButton.contains(e.target)))) {
      return;
    }
    
    if (document.getElementById("orb").classList.contains("speaking")) {
      logDebug("🔄 Interrupting AI response...");
      const audio = document.getElementById("audio");
      audio.pause();
      audio.currentTime = 0;
      document.getElementById("orb").classList.remove("speaking");
      document.getElementById("orb").classList.add("idle");
      
      if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused) {
        setTimeout(() => {
          if (!window.nagState.interrupted && !window.nagState.isPaused) startListening();
        }, 500);
      }
    }
  });
}

// Setup all event listeners
function setupEventListeners() {
  // Toggle button
  document.getElementById("toggle-btn").addEventListener("click", async () => {
    await unlockAudio();
    
    if (window.nagState.listening) {
      logDebug("⏹️ Stopping conversation...");
      document.getElementById("toggle-btn").textContent = "Resume Conversation";
      await stopListening();
      document.getElementById("orb").classList.remove("listening", "speaking", "thinking");
      document.getElementById("orb").classList.add("idle");
      window.nagState.listening = false;
      window.nagState.walkieTalkieActive = false;
    } else {
      logDebug("▶️ Starting conversation...");
      document.getElementById("toggle-btn").textContent = "Stop Conversation";
      window.nagState.interrupted = false;
      window.nagState.isPaused = false;
      document.getElementById("pause-btn").textContent = "Pause";
      document.getElementById("pause-btn").classList.remove("paused");
      await startListening();
      window.nagState.listening = true;
    }
  });
  
  // Pause button
  document.getElementById("pause-btn").addEventListener("click", function() {
    if (!window.nagState.listening) return;
    
    if (window.nagState.isPaused) {
      // Resume conversation
      window.nagState.isPaused = false;
      document.getElementById("pause-btn").textContent = "Pause";
      document.getElementById("pause-btn").classList.remove("paused");
      logDebug("▶️ Conversation resumed");
      
      if (!window.nagState.isWalkieTalkieMode) {
        startListening();
      }
    } else {
      // Pause conversation
      window.nagState.isPaused = true;
      document.getElementById("pause-btn").textContent = "Resume";
      document.getElementById("pause-btn").classList.add("paused");
      logDebug("⏸️ Conversation paused");
      
      if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
        window.nagState.mediaRecorder.stop();
      }
    }
  });
  
  // Mode toggle
  document.getElementById("mode-toggle").addEventListener("click", function() {
    window.nagState.isWalkieTalkieMode = !window.nagState.isWalkieTalkieMode;
    
    if (window.nagState.isWalkieTalkieMode) {
      document.getElementById("mode-toggle").textContent = "Switch to continuous mode";
      document.getElementById("mode-hint").textContent = "Click & hold the orb to use walkie-talkie mode";
      logDebug("🎤 Switched to walkie-talkie mode");
      
      if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
        window.nagState.mediaRecorder.stop();
      }
    } else {
      document.getElementById("mode-toggle").textContent = "Switch to walkie-talkie mode";
      document.getElementById("mode-hint").textContent = "Nag will listen continuously for your voice";
      logDebug("🎤 Switched to continuous mode");
      
      if (window.nagState.listening && !window.nagState.isPaused) {
        startListening();
      }
    }
  });
}

// Log browser capabilities
function logInfo() {
  if (window.MediaRecorder) {
    logDebug("✅ MediaRecorder is supported in this browser");
    logDebug(window.nagState.isiOS ? "📱 iOS device detected" : "💻 Desktop browser detected");
    logDebug(window.nagState.isSafari ? "🧭 Safari browser detected" : "🌐 Non-Safari browser detected");
    
    const supportedTypes = [
      "audio/webm", 
      "audio/mp4", 
      "audio/mpeg", 
      "audio/ogg;codecs=opus"
    ];
    for (const type of supportedTypes) {
      logDebug(`${type}: ${MediaRecorder.isTypeSupported(type) ? '✅' : '❌'}`);
    }
  } else {
    logDebug("⚠️ MediaRecorder API not supported in this browser");
    document.getElementById("toggle-btn").disabled = true;
    document.getElementById("toggle-btn").textContent = "Not supported in this browser";
  }
}