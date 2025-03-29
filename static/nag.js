// Nag Digital Twin v1.5.0 - Safari Compatible Voice Assistant
console.log("Nag Digital Twin v1.5.0 loaded");

// DOM elements
const orb = document.getElementById("orb");
const audio = document.getElementById("audio");
const debugBox = document.getElementById("debug");
const toggleBtn = document.getElementById("toggle-btn");
const pauseBtn = document.getElementById("pause-btn");
const volumeBar = document.querySelector(".volume-bar");
const modeToggle = document.getElementById("mode-toggle");
const modeHint = document.getElementById("mode-hint");

// State variables
let mediaRecorder;
let audioChunks = [];
let stream;
let listening = false;
let interrupted = false;
let currentPlayButton = null;
let emptyTranscriptionCount = 0;
let isUploading = false;
let isPaused = false;
let isWalkieTalkieMode = true;
let analyserNode = null;
let walkieTalkieActive = false;
let silenceTimer = null;
let longRecordingTimer = null;
let lastTranscription = "";
let consecutiveIdenticalTranscriptions = 0;

// Browser detection
const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
let audioUnlocked = false;

// Helper functions
function logDebug(msg) {
  const p = document.createElement("p");
  p.textContent = msg;
  debugBox.appendChild(p);
  debugBox.scrollTop = debugBox.scrollHeight;
}

function unlockAudio() {
  if (audioUnlocked) return Promise.resolve(true);
  
  return new Promise((resolve) => {
    const silentAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADQgD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwAQAAAAAAAAAAABSAJAJAQgAAgAAAA0L2YLwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZB4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=");
    silentAudio.play().then(() => {
      audioUnlocked = true;
      logDebug("🔊 Audio unlocked successfully");
      resolve(true);
    }).catch(e => {
      logDebug("⚠️ Could not unlock audio automatically: " + e.message);
      resolve(false);
    });
  });
}

function removePlayButton() {
  if (currentPlayButton) {
    currentPlayButton.remove();
    currentPlayButton = null;
  }
}

// Audio visualization
function setupVolumeVisualization(stream) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyserNode = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;
    microphone.connect(analyserNode);
    
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function updateVolume() {
      if (!analyserNode || !listening) return;
      
      analyserNode.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      
      const average = sum / bufferLength;
      const volume = Math.min(100, Math.max(0, average * 2.5));
      
      volumeBar.style.height = `${volume}%`;
      
      if (isWalkieTalkieMode && !walkieTalkieActive) {
        requestAnimationFrame(updateVolume);
        return;
      }
      
      // Speech threshold - use higher threshold to avoid false activations
      const SPEECH_THRESHOLD = isSafari ? 15 : 10; // Higher for Safari
      
      if (!isWalkieTalkieMode && volume < SPEECH_THRESHOLD) {
        if (!silenceTimer) {
          silenceTimer = setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
              logDebug("🔇 Silence detected, stopping recording");
              stopRecording();
            }
            silenceTimer = null;
          }, 1500);
        }
      } else {
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      }
      
      requestAnimationFrame(updateVolume);
    }
    
    requestAnimationFrame(updateVolume);
  } catch (e) {
    logDebug("⚠️ Volume visualization not available: " + e.message);
  }
}

// Recording functions
async function startListening() {
  if (isUploading || isPaused) return;
  
  try {
    removePlayButton();
    emptyTranscriptionCount = 0;
    
    orb.classList.remove("idle", "speaking", "thinking");
    orb.classList.add("listening");
    logDebug("🎙️ Listening... (v1.5.0 - " + (isWalkieTalkieMode ? "walkie-talkie mode" : "continuous mode") + ")");

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupVolumeVisualization(stream);

    let mimeType = "";
    const supportedTypes = (isiOS || isSafari) 
      ? ["audio/mp4", "audio/mpeg", "audio/webm", "audio/ogg;codecs=opus", ""]
      : ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg;codecs=opus", ""];
    
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        logDebug(`Using audio format: ${mimeType || "browser default"}`);
        break;
      }
    }
    
    // Create MediaRecorder with optimized settings for Safari
    const recorderOptions = {
      mimeType: mimeType || undefined,
      audioBitsPerSecond: 128000  // Consistent bitrate
    };
    
    mediaRecorder = new MediaRecorder(stream, mimeType ? recorderOptions : {});
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

    mediaRecorder.onstop = async () => {
      if (interrupted) return;
      orb.classList.remove("listening");
      
      if (longRecordingTimer) {
        clearTimeout(longRecordingTimer);
        longRecordingTimer = null;
      }
      
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      
      if (audioChunks.length === 0) {
        logDebug("⚠️ No audio recorded. Please try again.");
        orb.classList.add("idle");
        if (!isWalkieTalkieMode && !isPaused) {
          setTimeout(() => {
            if (!interrupted && !isPaused) startListening();
          }, 1000);
        }
        return;
      }
      
      await processAudioAndTranscribe();
    };

    if (!isWalkieTalkieMode) {
      startRecording();
    }
    
    pauseBtn.disabled = false;
  } catch (e) {
    logDebug("🚫 Mic access failed: " + e.message);
    orb.classList.remove("listening");
    orb.classList.add("idle");
  }
}

async function processAudioAndTranscribe() {
  try {
    // Get the appropriate MIME type for the blob
    let mimeType = mediaRecorder.mimeType || "";
    if (!mimeType && audioChunks.length > 0 && audioChunks[0].type) {
      mimeType = audioChunks[0].type;
    }
    
    const blob = new Blob(audioChunks, mimeType ? { type: mimeType } : {});
    const formData = new FormData();
    
    let fileExt = "audio";
    if (mimeType.includes("webm")) fileExt = "webm";
    else if (mimeType.includes("mp4") || mimeType.includes("mpeg")) fileExt = "mp3";
    else if (mimeType.includes("ogg")) fileExt = "ogg";
    
    formData.append("file", blob, `input.${fileExt}`);

    isUploading = true;
    logDebug("📤 Uploading voice...");
    
    const res = await fetch("/transcribe", { 
      method: "POST", 
      body: formData 
    });
    
    isUploading = false;

    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (jsonErr) {
      logDebug("❌ JSON parse failed: " + jsonErr.message);
      logDebug("Raw response: " + rawText.substring(0, 100) + "...");
      handleTranscriptionError();
      return;
    }

    const message = (data.transcription || "").trim();
    logDebug("📝 Transcribed: " + (message || "No speech detected"));

    // Check for repeated identical transcriptions
    if (message === lastTranscription) {
      consecutiveIdenticalTranscriptions++;
      
      if (consecutiveIdenticalTranscriptions >= 2) {
        logDebug("⚠️ Multiple identical transcriptions detected. Skipping to avoid loop.");
        handleTranscriptionError();
        
        // Reset and wait longer before trying again
        consecutiveIdenticalTranscriptions = 0;
        lastTranscription = "";
        return;
      }
    } else {
      // Different transcription, reset counter
      consecutiveIdenticalTranscriptions = 0;
      lastTranscription = message;
    }

    // Check for empty or short messages
    const wordCount = message.split(/\s+/).filter(Boolean).length;
    if (!message || message === "undefined" || wordCount <= 1) {
      logDebug("⚠️ Too short or empty message. Continuing to listen...");
      emptyTranscriptionCount++;
      
      if (emptyTranscriptionCount >= 3) {
        emptyTranscriptionCount = 0;
        await sendToChat("I didn't hear enough. Please try speaking a complete sentence.");
      } else {
        handleTranscriptionError();
      }
      return;
    }

    emptyTranscriptionCount = 0;
    await sendToChat(message);
  } catch (e) {
    isUploading = false;
    logDebug("❌ Transcription error: " + e.message);
    handleTranscriptionError();
  }
}

function handleTranscriptionError() {
  orb.classList.add("idle");
  if (!isWalkieTalkieMode && !isPaused) {
    setTimeout(() => {
      if (!interrupted && !isPaused) startListening();
    }, 1000);
  }
}

function startRecording() {
  if (!mediaRecorder || mediaRecorder.state === "recording") return;
  
  audioChunks = [];
  mediaRecorder.start();
  
  // Use different recording durations based on browser
  const maxRecordingTime = isSafari ? 8000 : 15000; // Shorter for Safari
  
  longRecordingTimer = setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      logDebug("⏱️ Maximum recording time reached");
      stopRecording();
    }
  }, maxRecordingTime);
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
}

async function stopListening() {
  interrupted = true;
  
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  
  if (!audio.paused) {
    audio.pause();
    audio.currentTime = 0;
  }
  
  if (analyserNode) {
    analyserNode = null;
  }
  
  volumeBar.style.height = "0%";
  removePlayButton();
  pauseBtn.disabled = true;
}

// Chat functions
async function sendToChat(message) {
  if (isUploading || isPaused) {
    logDebug("⏳ Still processing or paused, please wait...");
    return;
  }
  
  removePlayButton();
  orb.classList.remove("listening", "idle", "speaking");
  orb.classList.add("thinking");
  logDebug("💬 Sending to Nag...");

  try {
    isUploading = true;
    const res = await fetch("/chat", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json"
      },
      body: JSON.stringify({ message })
    });
    isUploading = false;

    if (!res.ok) {
      throw new Error(`Server error: ${res.status} ${res.statusText}`);
    }

    const rawText = await res.text();
    
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (jsonErr) {
      logDebug("❌ Chat response JSON parse failed: " + jsonErr.message);
      logDebug("Raw response: " + rawText.substring(0, 150) + "...");
      handleChatError();
      return;
    }

    logDebug("🧠 Nag: " + data.response);
    orb.classList.remove("thinking");

    if (data.audio_url) {
      await playAudioResponse(data.audio_url);
    } else {
      logDebug("⚠️ No audio returned.");
      handleChatError();
    }
  } catch (e) {
    isUploading = false;
    logDebug("❌ Chat error: " + e.message);
    handleChatError();
  }
}

function handleChatError() {
  orb.classList.remove("thinking");
  orb.classList.add("idle");
  if (!isWalkieTalkieMode && !isPaused) {
    setTimeout(() => {
      if (!interrupted && !isPaused) startListening();
    }, 1000);
  }
}

async function playAudioResponse(audioUrl) {
  orb.classList.add("speaking");
  
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
    let playResult = audio.play();
    
    // Set up onended handler
    audio.onended = () => {
      orb.classList.remove("speaking");
      orb.classList.add("idle");
      if (!isWalkieTalkieMode && !isPaused && !interrupted) {
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

function showPlayButton(audioUrl) {
  orb.classList.remove("speaking", "thinking");
  orb.classList.add("idle");
  
  removePlayButton();
  
  let playButton = document.createElement("button");
  playButton.innerText = "▶️ Play Response";
  playButton.className = "play-button";
  currentPlayButton = playButton;
  
  document.body.insertBefore(playButton, debugBox);
  setTimeout(() => playButton.focus(), 100);
  
  playButton.onclick = () => {
    // Unlock audio for future playbacks
    audioUnlocked = true;
    
    orb.classList.remove("idle");
    orb.classList.add("speaking");
    
    audio.src = audioUrl;
    audio.load();
    
    audio.play()
      .then(() => {
        removePlayButton();
      })
      .catch(err => {
        logDebug("🔇 Manual play failed: " + err.message);
        orb.classList.remove("speaking");
        orb.classList.add("idle");
      });
    
    audio.onended = () => {
      orb.classList.remove("speaking");
      orb.classList.add("idle");
      if (!isWalkieTalkieMode && !isPaused && !interrupted) {
        startListening();
      }
    };
  };
}

// Event handlers
function setupWalkieTalkieMode() {
  orb.addEventListener("mousedown", function(e) {
    if (!isWalkieTalkieMode || !listening || isUploading || isPaused) return;
    
    walkieTalkieActive = true;
    logDebug("🔊 Walkie-talkie active - speak now");
    orb.classList.add("listening");
    
    if (mediaRecorder && mediaRecorder.state !== "recording") {
      startRecording();
    }
  });
  
  orb.addEventListener("touchstart", function(e) {
    if (!isWalkieTalkieMode || !listening || isUploading || isPaused) return;
    e.preventDefault();
    
    walkieTalkieActive = true;
    logDebug("🔊 Walkie-talkie active - speak now");
    orb.classList.add("listening");
    
    if (mediaRecorder && mediaRecorder.state !== "recording") {
      startRecording();
    }
  });
  
  const endWalkieTalkie = function() {
    if (!walkieTalkieActive) return;
    
    walkieTalkieActive = false;
    logDebug("🔊 Walkie-talkie released");
    
    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopRecording();
    }
  };
  
  orb.addEventListener("mouseup", endWalkieTalkie);
  orb.addEventListener("mouseleave", endWalkieTalkie);
  orb.addEventListener("touchend", function(e) {
    e.preventDefault();
    endWalkieTalkie();
  });
  orb.addEventListener("touchcancel", function(e) {
    e.preventDefault();
    endWalkieTalkie();
  });
}

function setupInterruptionHandling() {
  document.addEventListener('click', function(e) {
    if (e.target === toggleBtn || 
        e.target === pauseBtn ||
        e.target === modeToggle ||
        e.target === orb ||
        (currentPlayButton && (e.target === currentPlayButton || currentPlayButton.contains(e.target)))) {
      return;
    }
    
    if (orb.classList.contains("speaking")) {
      logDebug("🔄 Interrupting AI response...");
      audio.pause();
      audio.currentTime = 0;
      orb.classList.remove("speaking");
      orb.classList.add("idle");
      
      if (!isWalkieTalkieMode && !isPaused) {
        setTimeout(() => {
          if (!interrupted && !isPaused) startListening();
        }, 500);
      }
    }
  });
}

// Button handlers
toggleBtn.addEventListener("click", async () => {
  await unlockAudio();
  
  if (listening) {
    logDebug("⏹️ Stopping conversation...");
    toggleBtn.textContent = "Resume Conversation";
    await stopListening();
    orb.classList.remove("listening", "speaking", "thinking");
    orb.classList.add("idle");
    listening = false;
    walkieTalkieActive = false;
  } else {
    logDebug("▶️ Starting conversation...");
    toggleBtn.textContent = "Stop Conversation";
    interrupted = false;
    isPaused = false;
    pauseBtn.textContent = "Pause";
    pauseBtn.classList.remove("paused");
    await startListening();
    listening = true;
  }
});

pauseBtn.addEventListener("click", function() {
  if (!listening) return;
  
  if (isPaused) {
    // Resume conversation
    isPaused = false;
    pauseBtn.textContent = "Pause";
    pauseBtn.classList.remove("paused");
    logDebug("▶️ Conversation resumed");
    
    if (!isWalkieTalkieMode) {
      startListening();
    }
  } else {
    // Pause conversation
    isPaused = true;
    pauseBtn.textContent = "Resume";
    pauseBtn.classList.add("paused");
    logDebug("⏸️ Conversation paused");
    
    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopRecording();
    }
  }
});

modeToggle.addEventListener("click", function() {
  isWalkieTalkieMode = !isWalkieTalkieMode;
  
  if (isWalkieTalkieMode) {
    modeToggle.textContent = "Switch to continuous mode";
    modeHint.textContent = "Click & hold the orb to use walkie-talkie mode";
    logDebug("🎤 Switched to walkie-talkie mode");
    
    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopRecording();
    }
  } else {
    modeToggle.textContent = "Switch to walkie-talkie mode";
    modeHint.textContent = "Nag will listen continuously for your voice";
    logDebug("🎤 Switched to continuous mode");
    
    if (listening && !isPaused) {
      startListening();
    }
  }
});

// Initialization
function initialize() {
  // Set up event handlers
  setupWalkieTalkieMode();
  setupInterruptionHandling();
  
  // Log browser capabilities
  if (window.MediaRecorder) {
    logDebug("✅ MediaRecorder is supported in this browser");
    logDebug(isiOS ? "📱 iOS device detected" : "💻 Desktop browser detected");
    logDebug(isSafari ? "🧭 Safari browser detected" : "🌐 Non-Safari browser detected");
    
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
    toggleBtn.disabled = true;
    toggleBtn.textContent = "Not supported in this browser";
  }
}

// Start the app
initialize();