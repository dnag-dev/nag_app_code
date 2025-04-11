// Nag Digital Twin v2.0.0 - Transcription and Chat Functions

// REMOVED: Removed duplicate processAudioAndTranscribe function
// Now only using the version in nag-core.js to avoid conflicts

// Update the handleTranscriptionError function to show messages
function handleTranscriptionError(error) {
  console.error("Transcription error:", error);
  if (window.logDebug) window.logDebug("❌ Transcription error: " + (error.message || error));
  
  // Update UI to show error
  if (window.nagElements && window.nagElements.modeHint) {
    window.nagElements.modeHint.textContent = "Error transcribing audio. Please try again.";
    window.nagElements.modeHint.style.display = "block";
    setTimeout(() => {
      if (window.nagElements.modeHint) {
        window.nagElements.modeHint.style.display = "none";
      }
    }, 5000);
  }
  
  // Reset state
  if (window.nagState) {
    window.nagState.isUploading = false;
    window.nagState.listening = false;
  }
  
  // Reset UI
  if (window.nagElements && window.nagElements.orb) {
    window.nagElements.orb.classList.remove("thinking", "listening");
    window.nagElements.orb.classList.add("idle");
  }
  
  // Update button states
  if (window.updateButtonStates) window.updateButtonStates();
}

// Send message to chat endpoint
async function sendToChat(message) {
  try {
    logDebug("💬 Sending to Nag...");
    window.nagState.isUploading = true;
    
    const res = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ 
        message: message,
        mode: "voice",
        request_id: Date.now().toString(),
        // Add browser/device info to help server processing
        browser: window.nagState.isSafari ? "safari" : 
                 window.nagState.isChrome ? "chrome" : 
                 window.nagState.isFirefox ? "firefox" : 
                 window.nagState.isEdge ? "edge" : "other",
        device: window.nagState.isiOS ? "ios" : "desktop"
      })
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Failed to get response from Nag");
    }
    
    const data = await res.json();
    logDebug("🧠 Nag: " + data.response);
    
    // Log full response structure for debugging
    logDebug("📝 Chat response structure: " + JSON.stringify(data));
    
    // Display the AI's text response
    if (data.response) {
      addStatusMessage(data.response, 'assistant');
    }
    
    // Check for different possible response formats
    if (data.audio_url) {
      await playAudioResponse(data.audio_url);
    } else if (data.tts_url) {
      await playAudioResponse(data.tts_url);
    } else if (data.audio) {
      // Create a blob URL from the base64 audio data
      const audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
      const audioUrl = URL.createObjectURL(audioBlob);
      await playAudioResponse(audioUrl);
      // Clean up the blob URL after playing
      URL.revokeObjectURL(audioUrl);
    } else {
      logDebug("⚠️ No audio returned.");
      handleChatError();
    }
    
    window.nagState.isUploading = false;
  } catch (error) {
    logDebug("❌ Chat error: " + error.message);
    handleChatError();
  }
}

// Helper function to convert base64 to blob
function base64ToBlob(base64, type) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: type });
}

// Handle error when chat fails
function handleChatError() {
  const orb = window.nagElements.orb;
  
  orb.classList.remove("thinking");
  orb.classList.add("idle");
  if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused) {
    setTimeout(() => {
      if (!window.nagState.interrupted && !window.nagState.isPaused) startListening();
    }, 1000);
  }
}

// Function to transcribe audio
async function transcribeAudio(audioBlob) {
  try {
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error("Invalid audio data");
    }
    
    // Set uploading state
    if (window.nagState) {
      window.nagState.isUploading = true;
      window.nagState.listening = false;
    }
    
    // Create form data
    const formData = new FormData();
    
    // Determine correct mime type
    let mimeType = window.nagState.isSafari ? "audio/mp4" : "audio/webm";
    const fileExt = mimeType.includes("webm") ? "webm" : "mp4";
    
    formData.append("file", audioBlob, `recording.${fileExt}`);
    
    // Add browser-specific info to help server process
    formData.append("browser", window.nagState.isSafari ? "safari" : 
                   window.nagState.isChrome ? "chrome" : 
                   window.nagState.isFirefox ? "firefox" : 
                   window.nagState.isEdge ? "edge" : "other");
    formData.append("mime_type", mimeType);
    
    // Add retry logic with exponential backoff
    let retries = 3;
    let lastError = null;
    let delay = 1000; // Start with 1 second delay
    
    while (retries > 0) {
      try {
        console.log(`Attempting transcription (${retries} attempts left)...`);
        
        const response = await fetch('/transcribe', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        // Get transcribed message
        const transcription = (data.transcription || data.transcript || "").trim();
        
        // Validate transcription text
        if (transcription === '') {
          throw new Error("Empty transcription received");
        }
        
        console.log("Transcription successful:", transcription);
        return transcription;
        
      } catch (error) {
        lastError = error;
        retries--;
        
        if (retries > 0) {
          console.log(`Transcription attempt failed: ${error.message}. Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    }
    
    throw lastError || new Error("Transcription failed after multiple attempts");
  } catch (error) {
    handleTranscriptionError(error);
    throw error;
  } finally {
    // Reset state regardless of outcome
    if (window.nagState) {
      window.nagState.isUploading = false;
    }
  }
}

// Function to handle transcription response
function handleTranscriptionResponse(text) {
  try {
    if (!text || text.trim() === '') {
      console.log("Empty transcription received");
      return;
    }
    
    // Update UI with transcription
    if (window.addMessage) {
      window.addMessage(text, true);
    }
    
    // Reset state
    if (window.nagState) {
      window.nagState.isUploading = false;
      window.nagState.listening = false;
      window.nagState.lastTranscription = text;
    }
    
    // Update button states
    if (window.updateButtonStates) {
      window.updateButtonStates();
    }
    
    // Log successful transcription
    if (window.logDebug) {
      window.logDebug(`✅ Transcription: "${text}"`);
    }
  } catch (error) {
    console.error("Error handling transcription response:", error);
    handleTranscriptionError(error);
  }
}

// Export functions for global use
window.transcribeAudio = transcribeAudio;
window.handleTranscriptionResponse = handleTranscriptionResponse;
window.handleTranscriptionError = handleTranscriptionError;
window.base64ToBlob = base64ToBlob;

// Process recorded audio and get transcription
async function processAudioAndTranscribe() {
  const orb = window.nagElements.orb;
  
  try {
    // Safari-specific debugging and optimization
    if (window.nagState.isSafari) {
      logDebug("📊 Safari audio processing - chunks: " + window.nagState.audioChunks.length);
      
      // Calculate total size of audio chunks
      const totalSize = window.nagState.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
      logDebug(`📊 Safari: Total audio size before processing: ${totalSize} bytes`);
      
      // FIXED: For Safari, allow processing even with a single large chunk
      if (window.nagState.audioChunks.length < 2) {
        if (totalSize < 5000) { // If less than 5KB and only one chunk
          logDebug("⚠️ Not enough audio data for Safari (single small chunk)");
          handleTranscriptionError("Not enough audio data. Please try speaking again.");
          return;
        } else {
          // Single chunk but big enough - proceed with processing
          logDebug("📊 Safari: Single chunk is large enough (>5KB), proceeding");
        }
      }
    }
    
    // Get the appropriate MIME type for the blob
    let mimeType = "";
    if (window.nagState.mediaRecorder) {
      mimeType = window.nagState.mediaRecorder.mimeType || "";
    }
    
    // If we don't have a MIME type from the recorder, try to get it from the chunks
    if (!mimeType && window.nagState.audioChunks.length > 0 && window.nagState.audioChunks[0].type) {
      mimeType = window.nagState.audioChunks[0].type;
    }
    
    // For Safari, ensure we're using the correct MIME type
    if (window.nagState.isSafari && !mimeType.includes("mp4")) {
      mimeType = "audio/mp4";
      logDebug("📝 Forcing audio/mp4 MIME type for Safari");
    }
    
    // Create blob with appropriate type
    const blob = new Blob(window.nagState.audioChunks, mimeType ? { type: mimeType } : {});
    
    // Log blob size for debugging
    logDebug(`📊 Final blob size: ${blob.size} bytes`);
    
    // Check if we have enough audio data
    if (blob.size < 1000) { // Less than 1KB is probably just noise
      logDebug("⚠️ Audio too small to process: " + blob.size + " bytes");
      handleTranscriptionError("Audio too quiet or too short. Please speak louder or longer.");
      return;
    }
    
    const formData = new FormData();
    
    // Determine file extension based on MIME type
    let fileExt = "mp4"; // Default to mp4 for Safari
    if (mimeType.includes("webm")) fileExt = "webm";
    else if (mimeType.includes("mp4")) fileExt = "mp4";
    else if (mimeType.includes("ogg")) fileExt = "ogg";
    
    // Add file to form data
    formData.append("file", blob, `input.${fileExt}`);
    
    // For Safari, add a flag in the form data
    if (window.nagState.isSafari) {
      formData.append("browser", "safari");
      formData.append("chunk_count", window.nagState.audioChunks.length.toString());
      formData.append("total_size", blob.size.toString());
      formData.append("mime_type", mimeType);
      formData.append("format", "mp4"); // Force MP4 format for Safari
      formData.append("sample_rate", "44100"); // Add sample rate for Safari
      formData.append("continuous_mode", !window.nagState.isWalkieTalkieMode ? "true" : "false");
    }

    // Show uploading state
    window.nagState.isUploading = true;
    orb.classList.remove("listening");
    orb.classList.add("thinking");
    logDebug("📤 Uploading voice...");
    
    // Send to server for transcription
    const res = await fetch("/transcribe", { 
      method: "POST", 
      body: formData 
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Server error: ${res.status} - ${errorText}`);
    }
    
    const data = await res.json();
    
    // Get transcribed message
    const transcription = (data.transcription || data.transcript || "").trim();
    
    // Validate transcription text
    if (transcription === '') {
      throw new Error("Empty transcription received");
    }
    
    console.log("Transcription successful:", transcription);
    return transcription;
  } catch (error) {
    handleTranscriptionError(error);
    throw error;
  }
}