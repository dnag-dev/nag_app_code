// Nag Digital Twin v2.0.0 - Transcription and Chat Functions

// Process recorded audio and get transcription
async function processAudioAndTranscribe() {
    const orb = window.nagElements.orb;
    
    try {
      // Get the appropriate MIME type for the blob
      let mimeType = "";
      if (window.nagState.mediaRecorder) {
        mimeType = window.nagState.mediaRecorder.mimeType || "";
      }
      
      // If we don't have a MIME type from the recorder, try to get it from the chunks
      if (!mimeType && window.nagState.audioChunks.length > 0 && window.nagState.audioChunks[0].type) {
        mimeType = window.nagState.audioChunks[0].type;
      }
      
      // Create blob with appropriate type
      const blob = new Blob(window.nagState.audioChunks, mimeType ? { type: mimeType } : {});
      const formData = new FormData();
      
      // Determine file extension based on MIME type
      let fileExt = "audio";
      if (mimeType.includes("webm")) fileExt = "webm";
      else if (mimeType.includes("mp4") || mimeType.includes("mpeg")) fileExt = "mp3";
      else if (mimeType.includes("ogg")) fileExt = "ogg";
      
      // Add file to form data
      formData.append("file", blob, `input.${fileExt}`);
  
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
      
      window.nagState.isUploading = false;
  
      // Process response
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
  
      // Get transcribed message
      const message = (data.transcription || "").trim();
      logDebug("📝 Transcribed: " + (message || "No speech detected"));
  
      // Check for repeated identical transcriptions to avoid loops
      if (message === window.nagState.lastTranscription) {
        window.nagState.consecutiveIdenticalTranscriptions++;
        
        if (window.nagState.consecutiveIdenticalTranscriptions >= 2) {
          logDebug("⚠️ Multiple identical transcriptions detected. Skipping to avoid loop.");
          handleTranscriptionError();
          
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
      if (!message || message === "undefined" || wordCount <= 1) {
        logDebug("⚠️ Too short or empty message. Continuing to listen...");
        window.nagState.emptyTranscriptionCount++;
        
        if (window.nagState.emptyTranscriptionCount >= 3) {
          window.nagState.emptyTranscriptionCount = 0;
          await sendToChat("I didn't hear enough. Please try speaking a complete sentence.");
        } else {
          handleTranscriptionError();
        }
        return;
      }
  
      // Reset empty count and send message to chat
      window.nagState.emptyTranscriptionCount = 0;
      await sendToChat(message);
    } catch (e) {
      window.nagState.isUploading = false;
      logDebug("❌ Transcription error: " + e.message);
      handleTranscriptionError();
    }
  }
  
  // Handle error when transcription fails
  function handleTranscriptionError() {
    const orb = window.nagElements.orb;
    
    orb.classList.remove("thinking");
    orb.classList.add("idle");
    if (!window.nagState.isWalkieTalkieMode && !window.nagState.isPaused) {
      setTimeout(() => {
        if (!window.nagState.interrupted && !window.nagState.isPaused) startListening();
      }, 1000);
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
        body: JSON.stringify({ message })
      });
      window.nagState.isUploading = false;
  
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