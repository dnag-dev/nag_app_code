// Nag Digital Twin v1.6.0 - Audio Functions

// Function to unlock audio
function unlockAudio() {
  if (window.nagState.audioUnlocked) return Promise.resolve(true);
  
  // For Safari, we'll rely more on the play button
  if (window.nagState.isSafari) {
    logDebug("🔊 Safari detected - audio will play after your next click");
    return Promise.resolve(false);
  }
  
  return new Promise((resolve) => {
    const silentAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADQgD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwAQAAAAAAAAAAABSAJAJAQgAAgAAAA0L2YLwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZB4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=");
    silentAudio.play().then(() => {
      window.nagState.audioUnlocked = true;
      logDebug("🔊 Audio unlocked successfully");
      resolve(true);
    }).catch(e => {
      logDebug("⚠️ Could not unlock audio automatically: " + e.message);
      resolve(false);
    });
  });
}

// Function to play audio response
async function playAudioResponse(audioUrl) {
  document.getElementById("orb").classList.add("speaking");
  const audio = document.getElementById("audio");
  
  // Preload audio for faster response
  try {
    await new Promise((resolve) => {
      const onready = () => {
        audio.oncanplaythrough = null;
        audio.onerror = null;
        resolve();
      };
      audio.oncanplaythrough = onready;
      audio.onerror = onready; // Still resolve on error to avoid hanging
      audio.src = audioUrl;
      audio.load();
    });
  } catch (e) {
    logDebug("⚠️ Audio preload warning: " + e.message);
  }
  
  // Try to unlock audio for Safari
  await unlockAudio();
  
  try {
    // Always show play button for Safari first time
    if (window.nagState.isSafari && !window.nagState.audioUnlocked) {
      showPlayButton(audioUrl);
      return;
    }
    
    let playResult = audio.play();
    
    // Set up onended handler
    audio.onended = () => {
      document.getElementById("orb").classList.remove("speaking");
      document.getElementById("orb").classList.add("idle");
      if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused && !window.nagState.interrupted) {
        startListening();
      }
    };
    
    // Handle the play promise
    if (playResult !== undefined) {
      playResult.catch(e => {
        logDebug("🔇 Audio play failed: " + e.message);
        showPlayButton(audioUrl);
      });
    }
  } catch (e) {
    logDebug("🔇 Audio play exception: " + e.message);
    showPlayButton(audioUrl);
  }
}