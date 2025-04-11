// Nag Digital Twin v3.5.0 - Recording Module
console.log("Loading nag-recording.js");

// Get the best audio format for the browser with extended format detection
function getBestAudioFormat() {
    // Create extended format array with codecs for better browser detection
    const extendedFormats = [
        { mimeType: 'audio/webm;codecs=opus', priority: 10 },
        { mimeType: 'audio/webm', priority: 9 },
        { mimeType: 'audio/mp4;codecs=mp4a.40.2', priority: 8 },
        { mimeType: 'audio/mp4', priority: 7 },
        { mimeType: 'audio/ogg;codecs=opus', priority: 6 },
        { mimeType: 'audio/ogg', priority: 5 },
        { mimeType: 'audio/webm;codecs=pcm', priority: 4 },
        { mimeType: 'audio/wav', priority: 3 },
        { mimeType: 'audio/mpeg', priority: 2 },
        { mimeType: '', priority: 1 } // Default fallback
    ];
    
    // Safari/iOS-specific format prioritization
    if (window.nagState.isSafari || window.nagState.isiOS) {
        // Prioritize mp4/aac for Safari
        const supportedFormats = extendedFormats
            .filter(format => {
                if (format.mimeType === '') return true; // Empty is always "supported"
                try {
                    return MediaRecorder.isTypeSupported(format.mimeType);
                } catch (e) {
                    return false;
                }
            })
            .sort((a, b) => {
                // Higher priority for MP4 formats on Safari
                if (a.mimeType.includes('mp4') && !b.mimeType.includes('mp4')) return -1;
                if (!a.mimeType.includes('mp4') && b.mimeType.includes('mp4')) return 1;
                return b.priority - a.priority; // Higher priority first
            });
        
        if (supportedFormats.length > 0) {
            window.logDebug(`Safari format selected: ${supportedFormats[0].mimeType}`);
            return supportedFormats[0].mimeType;
        }
    } else {
        // Standard format detection for other browsers
        const supportedFormats = extendedFormats
            .filter(format => {
                if (format.mimeType === '') return true; // Empty is always "supported"
                try {
                    return MediaRecorder.isTypeSupported(format.mimeType);
                } catch (e) {
                    return false;
                }
            })
            .sort((a, b) => b.priority - a.priority); // Higher priority first
        
        if (supportedFormats.length > 0) {
            window.logDebug(`Format selected: ${supportedFormats[0].mimeType}`);
            return supportedFormats[0].mimeType;
        }
    }
    
    // If nothing works, return empty string (browser default)
    return '';
}

// Test specific mime type support
function testMimeTypeSupport(mimeType) {
    try {
        return MediaRecorder.isTypeSupported(mimeType);
    } catch (e) {
        window.logDebug(`Error testing mime type ${mimeType}: ${e.message}`);
        return false;
    }
}

// FIXED: Improved setup for volume visualization
function setupVolumeVisualization(stream) {
    try {
        if (!window.nagState.audioContext) {
            window.nagState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Create analyzer node with better FFT size for more precise measurement
        const analyser = window.nagState.audioContext.createAnalyser();
        analyser.fftSize = 2048; // Larger FFT for more detailed analysis
        analyser.smoothingTimeConstant = 0.8; // Better smoothing
        
        // Connect microphone to analyzer
        const source = window.nagState.audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        // Create data array for volume levels
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        window.nagState.volumeDataArray = dataArray;
        window.nagState.analyserNode = analyser;
        
        // FIXED: Safely check for AudioWorklet - Skip loading audioWorklet.js since it doesn't exist
        // Only use AudioWorklet if it's properly supported and we're NOT on Safari/iOS
        const hasAudioWorklet = window.nagState.audioContext && 
                               'audioWorklet' in window.nagState.audioContext;
                               
        if (hasAudioWorklet && 
            !window.nagState.usingWorklet && 
            !window.nagState.isSafari && 
            !window.nagState.isiOS) {
            
            window.logDebug("AudioWorklet detected but skipping load to avoid 404");
            // We're simply not loading the audioWorklet.js file since it's causing 404 errors
        } else {
            window.logDebug("Using standard AnalyserNode for volume visualization");
        }
        
        // Start visualization loop
        updateVolumeVisualization();
        
        return true;
    } catch (error) {
        console.error("Error setting up volume visualization:", error);
        window.logDebug("Volume visualization error: " + error.message);
        return false;
    }
}

// Update volume visualization
function updateVolumeVisualization() {
    // If we're not listening or don't have an analyser, stop
    if (!window.nagState.listening || !window.nagState.analyserNode) {
        return;
    }
    
    try {
        // Get volume data
        window.nagState.analyserNode.getByteFrequencyData(window.nagState.volumeDataArray);
        
        // Calculate average volume with frequency weighting to better represent human speech
        let sum = 0;
        let count = 0;
        
        // Focus on frequency range typical for human speech (85-255 Hz)
        const lowerBound = Math.floor(85 * window.nagState.analyserNode.frequencyBinCount / (window.nagState.audioContext.sampleRate / 2));
        const upperBound = Math.ceil(255 * window.nagState.analyserNode.frequencyBinCount / (window.nagState.audioContext.sampleRate / 2));
        
        for (let i = lowerBound; i <= upperBound; i++) {
            if (i < window.nagState.volumeDataArray.length) {
                sum += window.nagState.volumeDataArray[i];
                count++;
            }
        }
        
        // Calculate weighted average
        const avg = count > 0 ? (sum / count) : 0;
        
        // Apply non-linear scaling to better represent perceived volume
        const volume = Math.min(100, Math.max(0, Math.pow(avg / 128, 1.5) * 100));
        
        // Update volume bar
        if (window.nagElements.volumeBar) {
            window.nagElements.volumeBar.style.width = `${volume}%`;
            
            // Change color based on volume
            if (volume > 75) {
                window.nagElements.volumeBar.style.backgroundColor = '#dc3545'; // Red
            } else if (volume > 40) {
                window.nagElements.volumeBar.style.backgroundColor = '#ffc107'; // Yellow
            } else {
                window.nagElements.volumeBar.style.backgroundColor = '#28a745'; // Green
            }
        }
        
        // Check for silence if enabled
        if (window.nagState.silenceDetectionEnabled) {
            detectSilence(volume);
        }
        
        // Continue updating
        requestAnimationFrame(updateVolumeVisualization);
    } catch (error) {
        console.error("Error updating volume visualization:", error);
        window.logDebug("Volume update error: " + error.message);
    }
}

// Request microphone access with enhanced settings
async function requestMicrophoneAccess() {
    try {
        if (window.nagState.audioStream) {
            // Already have a stream
            return window.nagState.audioStream;
        }
        
        // Request microphone access with enhanced settings
        window.logDebug("Requesting microphone access...");
        
        // Define advanced constraints including audio quality settings
        const constraints = {
            audio: {
                echoCancellation: { ideal: true },
                noiseSuppression: { ideal: true },
                autoGainControl: { ideal: true },
                channelCount: { ideal: 1 },
                sampleRate: { ideal: 44100 },
                sampleSize: { ideal: 16 }
            }
        };
        
        // Browser-specific constraint adjustments
        if (window.nagState.isSafari || window.nagState.isiOS) {
            // Safari works better with simpler constraints
            constraints.audio = true;
        } else if (/Firefox/.test(navigator.userAgent)) {
            // Firefox specific settings
            constraints.audio.mozNoiseSuppression = { ideal: true };
            constraints.audio.mozAutoGainControl = { ideal: true };
        }
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Success - store stream
        window.nagState.audioStream = stream;
        window.logDebug("Microphone access granted");
        
        // Set up volume visualization
        setupVolumeVisualization(stream);
        
        return stream;
    } catch (error) {
        console.error("Error accessing microphone:", error);
        window.logDebug("Microphone access error: " + error.message);
        window.addStatusMessage("Error accessing microphone. Please check permissions.", "error");
        return null;
    }
}

// Initialize MediaRecorder with optimized settings
function initializeMediaRecorder(stream) {
    try {
        if (!stream) {
            throw new Error("No audio stream provided");
        }
        
        // Get the best format for this browser
        const mimeType = getBestAudioFormat();
        window.logDebug(`Using audio format: ${mimeType || 'browser default'}`);
        
        // Create MediaRecorder with optimized options
        const options = {
            audioBitsPerSecond: 128000
        };
        
        if (mimeType) {
            options.mimeType = mimeType;
        }
        
        // Browser-specific recorder configurations
        if (window.nagState.isSafari || window.nagState.isiOS) {
            // Safari needs lower bitrate for stability
            options.audioBitsPerSecond = 96000;
            
            // Always use MP4 format for Safari when available
            if (testMimeTypeSupport('audio/mp4')) {
                options.mimeType = 'audio/mp4';
                window.logDebug("Using audio/mp4 for Safari");
            }
            
            // Force setting to ensure compatibility
            window.nagState.forceSafariHandling = true;
        } else if (/Firefox/.test(navigator.userAgent)) {
            // Firefox works well with opus codec
            if (testMimeTypeSupport('audio/webm;codecs=opus')) {
                options.mimeType = 'audio/webm;codecs=opus';
            }
        } else if (/Chrome/.test(navigator.userAgent)) {
            // Chrome can handle higher bitrate
            options.audioBitsPerSecond = 192000;
        }
        
        // Log chosen options for debugging
        window.logDebug(`MediaRecorder options: ${JSON.stringify(options)}`);
        
        // Create the MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, options);
        window.nagState.mediaRecorder = mediaRecorder;
        window.nagState.audioChunks = [];
        
        // Setup event handlers with improved chunk collection
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                window.nagState.audioChunks.push(event.data);
                window.logDebug(`Audio chunk #${window.nagState.audioChunks.length} received: ${event.data.size} bytes`);
            } else {
                window.logDebug("Received empty audio chunk");
            }
        };
        
        // FIXED: Improved onstop handler to ensure complete audio processing
        mediaRecorder.onstop = function() {
            window.logDebug(`MediaRecorder stopped. Processing ${window.nagState.audioChunks.length} chunks...`);
            
            // Process audio if we have any chunks
            if (window.nagState.audioChunks && window.nagState.audioChunks.length > 0) {
                // Calculate total audio size
                const totalSize = window.nagState.audioChunks.reduce((acc, chunk) => acc + chunk.size, 0);
                window.logDebug(`Total audio size: ${totalSize} bytes in ${window.nagState.audioChunks.length} chunks`);
                
                // FIXED: For Safari, check if we have enough data, but allow processing 
                // of a single chunk if it's large enough
                const isSafari = window.nagState.isSafari || window.nagState.isiOS;
                const forceProcess = window.nagState.forceSafariProcessing || false;
                
                if (isSafari && window.nagState.audioChunks.length < 2 && !forceProcess) {
                    // If the single chunk is big enough, process it anyway
                    if (totalSize > 5000) {
                        window.logDebug("Safari: Single chunk is large enough (>5KB), processing anyway");
                    } else {
                        window.logDebug("Safari: Single chunk too small, not processing");
                        window.addStatusMessage("Not enough audio recorded. Please speak longer.", "info");
                        
                        // Reset UI
                        resetRecordingUI();
                        return;
                    }
                }
                
                if (totalSize > 1000) { // Minimum size threshold (1KB)
                    // IMPORTANT: We call processAudioAndTranscribe from core to avoid duplicates
                    if (window.processAudioAndTranscribe) {
                        // FIXED: For Safari, add a delay before processing
                        if (isSafari) {
                            window.logDebug("Safari: waiting 300ms before processing audio");
                            setTimeout(() => {
                                window.processAudioAndTranscribe();
                            }, 300);
                        } else {
                            window.processAudioAndTranscribe();
                        }
                    } else {
                        window.logDebug("processAudioAndTranscribe function not available");
                        
                        // Reset UI
                        resetRecordingUI();
                        window.addStatusMessage("Error processing audio: transcription function not found", "error");
                    }
                } else {
                    window.logDebug("Audio too small, not processing");
                    window.addStatusMessage("Not enough audio recorded. Please try again.", "info");
                    
                    // Reset UI
                    resetRecordingUI();
                }
            } else {
                // No audio chunks or empty chunks
                window.logDebug("No valid audio chunks recorded");
                window.addStatusMessage("No audio recorded. Please try again.", "info");
                
                // Reset UI
                resetRecordingUI();
            }
        };
        
        mediaRecorder.onerror = (event) => {
            console.error("MediaRecorder error:", event.error);
            window.logDebug(`MediaRecorder error: ${event.error ? event.error.name : 'unknown'}`);
            window.addStatusMessage("Recording error. Please try again.", "error");
            
            // Reset UI
            resetRecordingUI();
        };
        
        return mediaRecorder;
    } catch (error) {
        console.error("Error initializing MediaRecorder:", error);
        window.logDebug("MediaRecorder initialization error: " + error.message);
        window.addStatusMessage("Error initializing recorder: " + error.message, "error");
        return null;
    }
}

// Helper function to reset UI if recording fails
function resetRecordingUI() {
    if (window.nagElements && window.nagElements.orb) {
        window.nagElements.orb.classList.remove("thinking", "listening");
        window.nagElements.orb.classList.add("idle");
    }
    
    // Reset any visualization states
    if (window.nagElements && window.nagElements.volumeBar) {
        window.nagElements.volumeBar.style.width = "0%";
    }
    
    // Reset additional UI elements if needed
    if (window.nagState.visualizationAnimationFrame) {
        cancelAnimationFrame(window.nagState.visualizationAnimationFrame);
        window.nagState.visualizationAnimationFrame = null;
    }
}

// Start recording audio
function startRecording() {
  if (!window.nagState.mediaRecorder || window.nagState.mediaRecorder.state === "recording") return;
  
  logDebug("🎙️ Starting recording...");
  window.nagState.audioChunks = [];
  window.nagState.speechDetected = false;
  window.nagState.recordingStartTime = Date.now(); // Track when recording started
  
  try {
    // Special handling for Safari to use timeslices
    if (window.nagState.isSafari) {
      // For Safari, use even shorter timeslices to get more frequent chunks
      window.nagState.mediaRecorder.start(50); // Reduced from 100ms to 50ms for more chunks
      logDebug("🎙️ Safari recording with 50ms timeslices");
      
      // Add Safari-specific event handler for dataavailable
      window.nagState.mediaRecorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) {
          // For Safari, add all non-empty chunks
          window.nagState.audioChunks.push(e.data);
          logDebug(`🔊 Audio chunk received: ${e.data.size} bytes`);
          
          // Update speech detection based on chunk size
          if (e.data.size > 500) { // Reduced threshold to 500 bytes
            window.nagState.speechDetected = true;
          }
        }
      };
      
      // For continuous mode in Safari, enforce minimum recording duration
      if (!window.nagState.isWalkieTalkieMode) {
        // Set a minimum recording duration flag (3 seconds)
        window.nagState.enforceMinRecordingTime = true;
        window.nagState.minRecordingDuration = 3000; // 3 seconds
        logDebug("📊 Enforcing minimum 3 second recording for Safari continuous mode");
      }
    } else {
      // For non-Safari, use 250ms timeslice instead of default
      window.nagState.mediaRecorder.start(250);
      logDebug("🎙️ Standard recording with 250ms timeslices");
    }
    
    // Set up UI and state
    const orb = window.nagElements.orb;
    if (orb) {
      orb.classList.remove("idle");
      orb.classList.add("listening");
    }
    
    return true;
  } catch (error) {
    logDebug("❌ Error starting recording: " + error.message);
    return false;
  }
}

// Modified stop recording function
function stopRecording() {
  try {
    // Check if we need to enforce minimum recording duration for Safari continuous mode
    if (window.nagState.isSafari && 
        window.nagState.enforceMinRecordingTime && 
        window.nagState.recordingStartTime) {
      
      const elapsedTime = Date.now() - window.nagState.recordingStartTime;
      const minDuration = window.nagState.minRecordingDuration || 3000;
      
      if (elapsedTime < minDuration) {
        const remainingTime = minDuration - elapsedTime;
        logDebug(`📊 Enforcing minimum recording time, waiting ${remainingTime}ms more before stopping`);
        
        // Update UI to show we're still recording
        if (window.nagElements.modeHint) {
          window.nagElements.modeHint.textContent = "Still recording...";
        }
        
        // Delay the actual stop
        setTimeout(() => {
          logDebug("📊 Minimum recording time reached, now stopping");
          actuallyStopRecording();
        }, remainingTime);
        
        return true;
      }
    }
    
    return actuallyStopRecording();
  } catch (error) {
    logDebug("❌ Error in stopRecording: " + error.message);
    return false;
  }
}

// The original stop recording logic moved to a separate function
function actuallyStopRecording() {
  try {
    // Update UI first
    const orb = window.nagElements.orb;
    if (orb) {
      orb.classList.remove("listening");
      orb.classList.add("thinking");
    }
    
    if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
      // For Safari, use enhanced stop sequence
      if (window.nagState.isSafari) {
        // First request current data
        window.nagState.mediaRecorder.requestData();
        
        // Multiple staged requests with delays for Safari
        setTimeout(() => {
          try {
            window.nagState.mediaRecorder.requestData();
            logDebug("📊 Safari: requested additional data");
            
            setTimeout(() => {
              try {
                window.nagState.mediaRecorder.requestData();
                logDebug("📊 Safari: requested final data");
                
                // Finally stop the recorder
                setTimeout(() => {
                  window.nagState.mediaRecorder.stop();
                  logDebug("📊 Safari recording stopped after enhanced sequence");
                }, 200);
              } catch (e) {
                logDebug("❌ Error in Safari stop sequence: " + e.message);
                window.nagState.mediaRecorder.stop();
              }
            }, 200);
          } catch (e) {
            logDebug("❌ Error in Safari data request: " + e.message);
            window.nagState.mediaRecorder.stop();
          }
        }, 300);
      } else {
        // For other browsers
        window.nagState.mediaRecorder.requestData();
        setTimeout(() => {
          window.nagState.mediaRecorder.stop();
        }, 200);
      }
      
      logDebug("📊 Recording stop sequence initiated");
      return true;
    } else {
      logDebug("⚠️ Not recording, nothing to stop");
      return false;
    }
  } catch (error) {
    logDebug("❌ Error stopping recording: " + error.message);
    return false;
  }
}

// Add recording time indicator
function updateRecordingTimeIndicator() {
  if (!window.nagState.recordingStartTime || 
      !window.nagState.mediaRecorder || 
      window.nagState.mediaRecorder.state !== "recording") {
      return;
  }
  
  const elapsedMs = Date.now() - window.nagState.recordingStartTime;
  const seconds = Math.floor(elapsedMs / 1000);
  
  // Update hint text with recording time
  if (window.nagElements.modeHint) {
      window.nagElements.modeHint.textContent = `Recording: ${seconds}s (Click orb to stop)`;
  }
  
  // Continue updating 
  if (seconds < 30) { // Only update until max recording time
      window.nagState.visualizationAnimationFrame = requestAnimationFrame(updateRecordingTimeIndicator);
  } else {
      // If we hit 30 seconds, update hint to show we're stopping
      if (window.nagElements.modeHint) {
          window.nagElements.modeHint.textContent = "Maximum recording time reached, processing...";
      }
  }
}

// Silence detection implementation
function detectSilence(volume, threshold = 15, duration = 2000) {
  // If we're not in a mode where we want auto-stop, return immediately
  if (!window.nagState.silenceDetectionEnabled) {
      return false;
  }
  
  try {
      // If volume is below threshold, mark the start of silence if not already marked
      if (volume < threshold && !window.nagState.silenceStartTime) {
          window.nagState.silenceStartTime = Date.now();
          window.logDebug(`Silence detected, volume: ${volume.toFixed(1)}`);
      }
      // If volume is above threshold, reset silence start time
      else if (volume >= threshold && window.nagState.silenceStartTime) {
          window.nagState.silenceStartTime = null;
          window.logDebug(`Silence broken, volume: ${volume.toFixed(1)}`);
      }
      
      // If silence has persisted long enough and we're recording, stop recording
      if (window.nagState.silenceStartTime && 
          (Date.now() - window.nagState.silenceStartTime > duration) &&
          window.nagState.mediaRecorder && 
          window.nagState.mediaRecorder.state === "recording") {
          
          window.logDebug(`Auto-stopping after ${duration}ms of silence`);
          window.nagState.silenceStartTime = null;
          
          // Don't auto-stop in walkie-talkie mode
          if (!window.nagState.isWalkieTalkieMode) {
              stopRecording();
              return true;
          }
      }
  } catch (error) {
      window.logDebug("Error in silence detection: " + error.message);
  }
  
  return false;
}

// Enable/disable silence detection
function setSilenceDetection(enabled) {
  window.nagState.silenceDetectionEnabled = enabled;
  window.logDebug(`Silence detection ${enabled ? 'enabled' : 'disabled'}`);
  
  // Reset state when enabling
  if (enabled) {
      window.nagState.silenceStartTime = null;
  }
}

// Clean up resources
function cleanupRecording() {
  // Clear any timeouts
  if (window.nagState.recordingTimeout) {
      clearTimeout(window.nagState.recordingTimeout);
      window.nagState.recordingTimeout = null;
  }
  
  if (window.nagState.instructionTimeout) {
      clearTimeout(window.nagState.instructionTimeout);
      window.nagState.instructionTimeout = null;
  }
  
  if (window.nagState.visualizationAnimationFrame) {
      cancelAnimationFrame(window.nagState.visualizationAnimationFrame);
      window.nagState.visualizationAnimationFrame = null;
  }
  
  // Stop silence detection
  window.nagState.silenceDetectionEnabled = false;
  window.nagState.silenceStartTime = null;
  
  // Stop any active recordings
  if (window.nagState.mediaRecorder && window.nagState.mediaRecorder.state === "recording") {
      try {
          window.nagState.mediaRecorder.stop();
      } catch (e) {
          window.logDebug("Error stopping recorder during cleanup: " + e.message);
      }
  }
  
  // Stop and release audio stream tracks
  if (window.nagState.audioStream) {
      try {
          window.nagState.audioStream.getTracks().forEach(track => {
              try {
                  track.stop();
              } catch (e) {
                  // Ignore errors stopping individual tracks
              }
          });
      } catch (e) {
          window.logDebug("Error stopping audio stream: " + e.message);
      }
      window.nagState.audioStream = null;
  }
  
  // Reset state
  window.nagState.mediaRecorder = null;
  window.nagState.audioChunks = [];
  window.nagState.analyserNode = null;
  window.nagState.recordingStartTime = null;
  
  // Reset UI
  resetRecordingUI();
  
  if (window.nagElements && window.nagElements.modeHint) {
      window.nagElements.modeHint.textContent = window.nagState.isWalkieTalkieMode ? 
          "Press and hold the orb to speak" : "Click the orb to start recording";
  }
  
  window.logDebug("Recording resources cleaned up");
  return true;
}

// Audio quality adjustment functions
function adjustAudioQuality(quality) {
  // quality should be "low", "medium", or "high"
  if (!window.nagState.mediaRecorder) return false;
  
  let bitrate = 96000; // Default medium quality
  
  switch (quality) {
      case "low":
          bitrate = 64000;
          break;
      case "medium":
          bitrate = 96000;
          break;
      case "high":
          bitrate = 128000;
          break;
      case "ultra":
          bitrate = 192000;
          break;
  }
  
  try {
      // This only affects future MediaRecorder instances
      window.nagState.preferredBitrate = bitrate;
      window.logDebug(`Audio quality set to ${quality} (${bitrate} bps)`);
      return true;
  } catch (e) {
      window.logDebug("Error adjusting audio quality: " + e.message);
      return false;
  }
}

// Device enumeration for advanced microphone selection
async function enumerateAudioDevices() {
  try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      
      window.logDebug(`Found ${audioInputDevices.length} audio input devices`);
      
      return audioInputDevices;
  } catch (error) {
      window.logDebug("Error enumerating audio devices: " + error.message);
      return [];
  }
}

// Select specific audio device
async function selectAudioDevice(deviceId) {
  try {
      // Stop current stream if exists
      if (window.nagState.audioStream) {
          window.nagState.audioStream.getTracks().forEach(track => track.stop());
          window.nagState.audioStream = null;
      }
      
      // Request the specific device
      const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
              deviceId: { exact: deviceId },
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: true },
              autoGainControl: { ideal: true }
          }
      });
      
      window.nagState.audioStream = stream;
      window.nagState.selectedDeviceId = deviceId;
      
      // Re-setup visualization
      setupVolumeVisualization(stream);
      
      window.logDebug(`Selected audio device: ${deviceId}`);
      return true;
  } catch (error) {
      window.logDebug("Error selecting audio device: " + error.message);
      return false;
  }
}

// Make functions globally available
window.requestMicrophoneAccess = requestMicrophoneAccess;
window.initializeMediaRecorder = initializeMediaRecorder;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.cleanupRecording = cleanupRecording;
window.getBestAudioFormat = getBestAudioFormat;
window.testMimeTypeSupport = testMimeTypeSupport;
window.setupVolumeVisualization = setupVolumeVisualization;
window.resetRecordingUI = resetRecordingUI;
window.updateRecordingTimeIndicator = updateRecordingTimeIndicator;
window.detectSilence = detectSilence;
window.setSilenceDetection = setSilenceDetection;
window.adjustAudioQuality = adjustAudioQuality;
window.enumerateAudioDevices = enumerateAudioDevices;
window.selectAudioDevice = selectAudioDevice;

console.log("nag-recording.js loaded");