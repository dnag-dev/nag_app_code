// Nag Digital Twin v2.0.0 - Utility Functions

// Add debug message to log
function logDebug(msg) {
  const debugBox = window.nagElements.debugBox;
  if (!debugBox) return;
  
  const p = document.createElement("p");
  
  // Add timestamp for detailed debugging
  if (window.nagState && window.nagState.isSafari) {
    const time = new Date().toTimeString().substring(0, 8);
    p.textContent = `[${time}] ${msg}`;
  } else {
    p.textContent = msg;
  }
  
  debugBox.appendChild(p);
  debugBox.scrollTop = debugBox.scrollHeight;
  
  // Also log to console for developer debugging
  console.log(msg);
}

// Safely parse JSON with error handling
function safeJsonParse(text) {
  try {
    return { result: JSON.parse(text), error: null };
  } catch (e) {
    logDebug(`JSON parse error: ${e.message}`);
    return { result: null, error: e };
  }
}

// Function to unlock audio on Safari/iOS
function unlockAudio() {
  if (window.nagState.audioUnlocked) return Promise.resolve(true);
  
  return new Promise((resolve) => {
    // For Safari, we need to be more cautious about audio unlocking
    if (window.nagState.isSafari || window.nagState.isiOS) {
      logDebug("🔊 Safari/iOS detected - attempting to unlock audio");
      
      // Create and play silent audio
      const silentAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADQgD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwAQAAAAAAAAAAABSAJAJAQgAAgAAAA0L2YLwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZB4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=");
      silentAudio.play().then(() => {
        window.nagState.audioUnlocked = true;
        logDebug("🔊 Audio unlocked successfully");
        resolve(true);
      }).catch(e => {
        logDebug("⚠️ Could not unlock audio automatically: " + e.message);
        logDebug("🔊 Audio will play after user interaction");
        resolve(false);
      });
    } else {
      // Non-Safari browsers usually don't need special handling
      window.nagState.audioUnlocked = true;
      resolve(true);
    }
  });
}

// Helper to wait for a specified time (ms)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Safely check if a MIME type is supported
function isMimeTypeSupported(mimeType) {
  try {
    return MediaRecorder.isTypeSupported(mimeType);
  } catch (e) {
    logDebug(`Error checking MIME type support for ${mimeType}: ${e.message}`);
    return false;
  }
}

// Get the best supported audio MIME type for this browser
function getBestAudioMimeType() {
  // Prioritize different types based on browser
  const supportedTypes = (window.nagState.isiOS || window.nagState.isSafari) 
    ? ["audio/mp4", "audio/mpeg", "audio/webm", "audio/ogg;codecs=opus", ""]
    : ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg;codecs=opus", ""];
  
  for (const type of supportedTypes) {
    if (type === "" || isMimeTypeSupported(type)) {
      return type;
    }
  }
  
  // Fallback to browser default
  return "";
}

// Log browser capabilities for debugging
function logBrowserInfo() {
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
      try {
        logDebug(`${type}: ${MediaRecorder.isTypeSupported(type) ? '✅' : '❌'}`);
      } catch (e) {
        logDebug(`${type}: ❌ (Error checking support)`);
      }
    }
  } else {
    logDebug("⚠️ MediaRecorder API not supported in this browser");
    window.nagElements.toggleBtn.disabled = true;
    window.nagElements.toggleBtn.textContent = "Not supported in this browser";
  }
}