// Nag Digital Twin v3.5.0 - Audio Module
console.log("Loading nag-audio.js");

// Unlock audio context (crucial for Safari)
async function unlockAudio() {
    // If already unlocked, return immediately
    if (window.nagState.audioContextUnlocked) {
        return true;
    }
    
    try {
        // Create audio context if not exists
        if (!window.nagState.audioContext) {
            window.nagState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // For iOS Safari, we need this during a user gesture
        if (window.nagState.audioContext.state === 'suspended') {
            await window.nagState.audioContext.resume();
        }
        
        // Play silent buffer (required for iOS Safari)
        const buffer = window.nagState.audioContext.createBuffer(1, 1, 22050);
        const source = window.nagState.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(window.nagState.audioContext.destination);
        source.start(0);
        
        // Also try to play audio element with silent audio
        const silentAudio = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADQgD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwAQAAAAAAAAAAABSAJAJAQgAAgAAAA0L2YLwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZB4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";
        
        // Configure audio element for Safari compatibility
        const audio = window.nagElements.audio || document.getElementById('audio') || new Audio();
        
        // IMPORTANT: Disable default browser controls to prevent Safari errors
        audio.controls = false;
        audio.controlsList = "nodownload nofullscreen noremoteplayback";
        audio.disableRemotePlayback = true; // Disable Airplay
        audio.setAttribute('playsinline', ''); // Keep playback in element
        audio.setAttribute('webkit-playsinline', ''); // For older iOS
        
        // Set silent audio source
        audio.src = silentAudio;
        
        try {
            await audio.play();
            audio.pause();
            audio.currentTime = 0;
        } catch (e) {
            console.log("Silent audio play prevented, will unlock on user interaction");
            return false;
        }
        
        window.nagState.audioContextUnlocked = true;
        window.logDebug("Audio context unlocked successfully");
        return true;
    } catch (error) {
        console.error("Error unlocking audio:", error);
        window.logDebug("Error unlocking audio: " + error.message);
        return false;
    }
}

// Play audio response with Safari compatibility
async function playAudioResponse(audioUrl) {
    try {
        // First make sure audio is unlocked
        if (!window.nagState.audioContextUnlocked) {
            await unlockAudio();
        }
        
        // Get audio element
        const audio = window.nagElements.audio;
        if (!audio) {
            throw new Error("Audio element not found");
        }
        
        // Configure audio element for Safari compatibility
        audio.controls = false;
        audio.controlsList = "nodownload nofullscreen noremoteplayback";
        audio.disableRemotePlayback = true; // Disable Airplay
        audio.setAttribute('playsinline', ''); // Keep playback in element
        audio.setAttribute('webkit-playsinline', ''); // For older iOS
        
        // Set source
        audio.src = audioUrl;
        
        // Update UI
        if (window.nagElements.orb) {
            window.nagElements.orb.classList.remove("thinking", "listening");
            window.nagElements.orb.classList.add("speaking");
        }
        
        // Setup event listeners
        audio.onloadeddata = () => {
            window.logDebug("Audio loaded, playing...");
            try {
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error("Error playing audio:", error);
                        window.logDebug("Audio playback error: " + error.message);
                        
                        // Show manual play button if needed
                        showPlayButton(audioUrl);
                    });
                }
            } catch (error) {
                console.error("Error playing audio:", error);
                window.logDebug("Audio play error: " + error.message);
                showPlayButton(audioUrl);
            }
        };
        
        audio.onended = () => {
            window.logDebug("Audio playback ended");
            
            // Reset UI
            if (window.nagElements.orb) {
                window.nagElements.orb.classList.remove("speaking");
                
                if (window.nagState.listening && !window.nagState.isPaused && !window.nagState.isWalkieTalkieMode) {
                    // In continuous mode, go back to listening
                    window.nagElements.orb.classList.add("listening");
                    if (window.startListening) {
                        window.startListening();
                    }
                } else {
                    // Otherwise go back to idle
                    window.nagElements.orb.classList.add("idle");
                }
            }
        };
        
        audio.onerror = (event) => {
            console.error("Audio error:", event);
            window.logDebug(`Audio error: ${audio.error ? audio.error.code : 'unknown'}`);
            
            // Reset UI
            if (window.nagElements.orb) {
                window.nagElements.orb.classList.remove("speaking");
                window.nagElements.orb.classList.add("idle");
            }
            
            // Show manual play button
            showPlayButton(audioUrl);
        };
        
        return true;
    } catch (error) {
        console.error("Error setting up audio playback:", error);
        window.logDebug("Audio setup error: " + error.message);
        
        // Reset UI
        if (window.nagElements.orb) {
            window.nagElements.orb.classList.remove("speaking", "thinking");
            window.nagElements.orb.classList.add("idle");
        }
        
        return false;
    }
}

// Show play button for manual audio playback (fallback)
function showPlayButton(audioUrl) {
    // Create button if it doesn't exist
    if (!window.nagState.currentPlayButton) {
        const button = document.createElement('button');
        button.textContent = 'Play Response';
        button.className = 'play-button';
        button.style.marginTop = '10px';
        button.style.padding = '8px 16px';
        button.style.backgroundColor = '#007bff';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        
        // Add to UI in message container
        if (window.nagElements.messageContainer) {
            window.nagElements.messageContainer.appendChild(button);
            window.nagState.currentPlayButton = button;
        } else if (document.body) {
            // Fallback to adding to body
            document.body.appendChild(button);
            window.nagState.currentPlayButton = button;
        }
    }
    
    // Set up click handler
    window.nagState.currentPlayButton.onclick = async () => {
        try {
            // Create a temporary audio element
            const audio = new Audio(audioUrl);
            
            // Configure for Safari
            audio.controls = false;
            audio.controlsList = "nodownload nofullscreen noremoteplayback";
            audio.disableRemotePlayback = true;
            audio.setAttribute('playsinline', '');
            audio.setAttribute('webkit-playsinline', '');
            
            // Set up ended handler to clean up button
            audio.onended = () => {
                if (window.nagState.currentPlayButton) {
                    window.nagState.currentPlayButton.remove();
                    window.nagState.currentPlayButton = null;
                }
            };
            
            await audio.play();
        } catch (error) {
            console.error("Manual play failed:", error);
            window.logDebug("Manual play failed: " + error.message);
        }
    };
}

// Remove play button if it exists
function removePlayButton() {
    if (window.nagState.currentPlayButton) {
        window.nagState.currentPlayButton.remove();
        window.nagState.currentPlayButton = null;
    }
}

// Function to play audio with error catching
function playAudio(audio) {
    try {
        if (!audio) return false;
        
        // Safari compatibility
        audio.controls = false;
        audio.controlsList = "nodownload nofullscreen noremoteplayback";
        audio.disableRemotePlayback = true;
        audio.setAttribute('playsinline', '');
        audio.setAttribute('webkit-playsinline', '');
        
        // Try to play the audio with error handling
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Error playing audio:", error);
                window.logDebug("Error playing audio: " + error.message);
                // Don't try to handle the error further - just log it
            });
            return true;
        }
        return false;
    } catch (error) {
        console.error("Play audio error:", error);
        window.logDebug("Play audio error: " + error.message);
        return false;
    }
}

// Make functions globally available
window.unlockAudio = unlockAudio;
window.playAudioResponse = playAudioResponse;
window.showPlayButton = showPlayButton;
window.removePlayButton = removePlayButton;
window.playAudio = playAudio;

console.log("nag-audio.js loaded");