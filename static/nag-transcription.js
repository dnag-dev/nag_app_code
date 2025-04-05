// Nag Digital Twin v2.0.0 - Transcription and Chat Functions

// Process recorded audio and get transcription
async function processAudioAndTranscribe() {
  const orb = window.nagElements.orb;
  
  try {
    // Safari-specific debugging and optimization
    if (window.nagState.isSafari) {
      logDebug("📊 Safari audio processing - chunks: " + window.nagState.audioChunks.length);
      
      // For Safari, ensure we have enough audio data
      if (window.nagState.audioChunks.length < 2) {
        logDebug("⚠️ Not enough audio chunks for Safari (need at least 2)");
        handleTranscriptionError("Not enough audio data. Please try speaking again.");
        return;
      }
      
      // Calculate total size of audio chunks
      const totalSize = window.nagState.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
      logDebug(`📊 Safari: Total audio size before processing: ${totalSize} bytes`);
      
      // For Safari, ensure we request a larger time slice for data
      if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
        try {
          // Request data now to ensure we get the current buffer
          window.nagState.mediaRecorder.requestData();
          await new Promise(resolve => setTimeout(resolve, 300)); // Wait for data to be processed
        } catch (e) {
          logDebug("⚠️ requestData error: " + e.message);
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
    
    // Log blob size for Safari debugging
    if (window.nagState.isSafari) {
      logDebug(`📊 Safari: Final blob size: ${blob.size} bytes`);
      logDebug(`📊 Safari: Using MIME type: ${mimeType}`);
    }
    
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
    }

    // Show uploading state
    window.nagState.isUploading = true;
    orb.classList.remove("listening");
    orb.classList.add("thinking");
    logDebug("📤 Uploading voice...");
    
    // Add retry logic for transcription
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        // Send to server for transcription
        const res = await fetch("/transcribe", { 
          method: "POST", 
          body: formData 
        });
        
        // Process response
        const data = await res.json();
        
        // If successful, process response
        if (res.ok) {
          window.nagState.isUploading = false;
          
          // Get transcribed message
          const message = (data.transcription || "").trim();
          logDebug("📝 Transcribed: " + (message || "No speech detected"));
          
          // Check for repeated identical transcriptions to avoid loops
          if (message === window.nagState.lastTranscription) {
            window.nagState.consecutiveIdenticalTranscriptions++;
            
            if (window.nagState.consecutiveIdenticalTranscriptions >= 2) {
              logDebug("⚠️ Multiple identical transcriptions detected. Skipping to avoid loop.");
              handleTranscriptionError("Multiple identical transcriptions detected. Please try speaking again.");
              
              // Reset and wait longer before trying again
              window.nagState.consecutiveIdenticalTranscriptions = 0;
              window.nagState.lastTranscription = "";
              return;
            }
          } else {
            // Different transcription, reset counter
            window.nagState.consecutiveIdenticalTranscriptions = 0;
            window.nagState.lastTranscription = message;
          }
          
          // Check for empty or short messages
          const wordCount = message.split(/\s+/).filter(Boolean).length;
          if (wordCount < 2) {
            logDebug("⚠️ Too short or empty message. Continuing to listen...");
            handleTranscriptionError("Message too short. Please speak at least two words.");
            if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused) {
              setTimeout(() => {
                if (!window.nagState.interrupted && !window.nagState.isPaused) startListening();
              }, 1000);
            }
            return;
          }
          
          // Send to chat if we have a valid message
          await sendToChat(message);
          
          // Successful, break out of retry loop
          break;
        } else {
          // Handle error response
          attempts++;
          logDebug(`❌ Transcription request failed (attempt ${attempts}/${maxAttempts}). Status: ${res.status}`);
          logDebug(`Error details: ${data.error || 'No error details provided'}`);
          
          if (attempts >= maxAttempts) {
            handleTranscriptionError(`Failed to transcribe audio: ${data.error || 'Unknown error'}`);
            window.nagState.isUploading = false;
            return;
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (fetchError) {
        attempts++;
        logDebug(`❌ Fetch error during transcription (attempt ${attempts}/${maxAttempts}): ${fetchError.message}`);
        
        if (attempts >= maxAttempts) {
          handleTranscriptionError("Network error while transcribing. Please check your connection.");
          window.nagState.isUploading = false;
          return;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (e) {
    logDebug("❌ Processing error: " + e.message);
    handleTranscriptionError("Error processing audio: " + e.message);
  }
}

// Update the handleTranscriptionError function to show messages
function handleTranscriptionError(message) {
  const orb = window.nagElements.orb;
  const statusText = window.nagElements.statusText;
  
  orb.classList.remove("listening", "thinking");
  orb.classList.add("idle");
  
  if (statusText) {
    statusText.textContent = message;
    statusText.style.display = "block";
    
    // Hide the message after 3 seconds
    setTimeout(() => {
      statusText.style.display = "none";
    }, 3000);
  }
}

// Send message to chat endpoint
async function sendToChat(message) {
  const orb = window.nagElements.orb;
  
  if (window.nagState.isUploading || window.nagState.isPaused) {
    logDebug("⏳ Still processing or paused, please wait...");
    return;
  }
  
  removePlayButton();
  orb.classList.remove("listening", "idle", "speaking");
  orb.classList.add("thinking");
  logDebug("💬 Sending to Nag...");

  try {
    window.nagState.isUploading = true;
    const res = await fetch("/chat", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json"
      },
      body: JSON.stringify({ 
        text: message,
        mode: "voice",
        request_id: Date.now().toString()
      })
    });
    window.nagState.isUploading = false;

    if (!res.ok) {
      const errorText = await res.text();
      logDebug(`❌ Server error: ${res.status} - ${errorText}`);
      
      if (res.status === 422) {
        logDebug("⚠️ Invalid message format. Please try speaking again.");
        handleChatError();
        return;
      }
      
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
    window.nagState.isUploading = false;
    logDebug("❌ Chat error: " + e.message);
    handleChatError();
  }
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