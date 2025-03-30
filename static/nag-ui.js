// Nag Digital Twin v1.6.0 - UI Functions

// Add debug message to log
function logDebug(msg) {
  const debugBox = document.getElementById("debug");
  const p = document.createElement("p");
  p.textContent = msg;
  debugBox.appendChild(p);
  debugBox.scrollTop = debugBox.scrollHeight;
}

// Remove play button if exists
function removePlayButton() {
  if (window.nagState.currentPlayButton) {
    window.nagState.currentPlayButton.remove();
    window.nagState.currentPlayButton = null;
  }
}

// Setup initial UI
function setupUI() {
  // No specific UI setup needed at the moment
}

// Show play button for audio playback
function showPlayButton(audioUrl) {
  document.getElementById("orb").classList.remove("speaking", "thinking");
  document.getElementById("orb").classList.add("idle");
  
  removePlayButton();
  
  let playButton = document.createElement("button");
  playButton.innerText = "▶️ Play Response";
  playButton.className = "play-button";
  
  if (window.nagState.isSafari) {
    playButton.className = "play-button safari";
    playButton.innerText = "▶️ Tap to Play Response";
  }
  
  window.nagState.currentPlayButton = playButton;
  
  document.body.insertBefore(playButton, document.getElementById("debug"));
  setTimeout(() => playButton.focus(), 100);
  
  playButton.onclick = () => {
    // Unlock audio for future playbacks
    window.nagState.audioUnlocked = true;
    
    document.getElementById("orb").classList.remove("idle");
    document.getElementById("orb").classList.add("speaking");
    
    const audio = document.getElementById("audio");
    audio.src = audioUrl;
    audio.load();
    
    audio.play()
      .then(() => {
        removePlayButton();
      })
      .catch(err => {
        logDebug("🔇 Manual play failed: " + err.message);
        document.getElementById("orb").classList.remove("speaking");
        document.getElementById("orb").classList.add("idle");
      });
    
    audio.onended = () => {
      document.getElementById("orb").classList.remove("speaking");
      document.getElementById("orb").classList.add("idle");
      if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused && !window.nagState.interrupted) {
        startListening();
      }
    };
  };
}

// Handle error when chat fails
function handleChatError() {
  document.getElementById("orb").classList.remove("thinking");
  document.getElementById("orb").classList.add("idle");
  if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused) {
    setTimeout(() => {
      if (!window.nagState.interrupted && !window.nagState.isPaused) startListening();
    }, 1000);
  }
}

// Handle error when transcription fails
function handleTranscriptionError() {
  document.getElementById("orb").classList.add("idle");
  if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused) {
    setTimeout(() => {
      if (!window.nagState.interrupted && !window.nagState.isPaused) startListening();
    }, 1000);
  }
}