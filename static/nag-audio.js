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
        
        // Enhanced Safari compatibility settings
        audio.preload = "auto";
        audio.controls = false;
        audio.controlsList = "nodownload nofullscreen noremoteplayback";
        audio.disableRemotePlayback = true; // Disable Airplay
        audio.setAttribute('playsinline', ''); // Keep playback in element
        audio.setAttribute('webkit-playsinline', ''); // For older iOS
        audio.muted = true; // Start muted (important for iOS)
        audio.volume = 0;
        
        // Set silent audio source
        audio.src = silentAudio;
        
        try {
            await audio.play();
            // Reset after successful play
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
            audio.volume = 1.0;
            
            window.nagState.audioContextUnlocked = true;
            window.logDebug("Audio context unlocked successfully");
            return true;
        } catch (e) {
            console.log("Silent audio play prevented, will unlock on user interaction");
            window.logDebug("Silent audio play error: " + e.message);
            return false;
        }
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
        
        // Enhanced configuration for iOS/Safari
        audio.preload = "auto"; 
        audio.controls = false;
        audio.controlsList = "nodownload nofullscreen noremoteplayback";
        audio.disableRemotePlayback = true; // Disable Airplay
        audio.setAttribute('playsinline', ''); // Keep playback in element
        audio.setAttribute('webkit-playsinline', ''); // For older iOS
        audio.muted = false;
        audio.volume = 1.0;
        
        // Set source with cache-busting parameter
        const cacheBust = Date.now();
        audio.src = audioUrl.includes('?') ? `${audioUrl}&_=${cacheBust}` : `${audioUrl}?_=${cacheBust}`;
        
        // Update UI
        if (window.nagElements.orb) {
            window.nagElements.orb.classList.remove("thinking", "listening");
            window.nagElements.orb.classList.add("speaking");
        }
        
        // Cancel any existing playback timeouts
        if (window.nagState.playbackTimeout) {
            clearTimeout(window.nagState.playbackTimeout);
        }
        
        // Set a timeout to prevent getting stuck in speaking state
        window.nagState.playbackTimeout = setTimeout(() => {
            window.logDebug("Audio playback safeguard timeout triggered");
            if (window.nagElements.orb.classList.contains("speaking")) {
                // Reset UI
                window.nagElements.orb.classList.remove("speaking");
                window.nagElements.orb.classList.add("idle");
                
                // Try to stop audio
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (e) {
                    console.error("Error stopping audio:", e);
                }
            }
        }, 60000); // 1 minute safeguard
        
        // Setup event listeners
        audio.onloadeddata = () => {
            window.logDebug("Audio loaded, playing...");
            try {
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error("Error playing audio:", error);
                        window.logDebug("Audio playback error: " + error.message);
                        
                        // Reset UI
                        window.nagElements.orb.classList.remove("speaking");
                        window.nagElements.orb.classList.add("idle");
                        
                        // Show manual play button
                        showPlayButton(audioUrl);
                    });
                }
            } catch (error) {
                console.error("Error playing audio:", error);
                window.logDebug("Audio play error: " + error.message);
                
                // Reset UI
                window.nagElements.orb.classList.remove("speaking");
                window.nagElements.orb.classList.add("idle");
                
                showPlayButton(audioUrl);
            }
        };
        
        audio.onended = () => {
            window.logDebug("Audio playback ended");
            
            // Clear timeout
            if (window.nagState.playbackTimeout) {
                clearTimeout(window.nagState.playbackTimeout);
            }
            
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
            
            // Clear timeout
            if (window.nagState.playbackTimeout) {
                clearTimeout(window.nagState.playbackTimeout);
            }
            
            // Reset UI
            if (window.nagElements.orb) {
                window.nagElements.orb.classList.remove("speaking");
                window.nagElements.orb.classList.add("idle");
            }
            
            // Show manual play button
            showPlayButton(audioUrl);
        };
        
        // Add event listener for audio canplay (Safari compatibility)
        audio.addEventListener('canplay', () => {
            window.logDebug("Audio can play event triggered");
            try {
                audio.play().catch(e => {
                    window.logDebug("Play from canplay failed: " + e.message);
                });
            } catch (e) {
                window.logDebug("Error in canplay handler: " + e.message);
            }
        }, { once: true });
        
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
    // Remove any existing button first
    removePlayButton();
    
    // Create button if it doesn't exist
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
    
    // Set up click handler
    button.onclick = async () => {
        try {
            // Update UI
            if (window.nagElements.orb) {
                window.nagElements.orb.classList.remove("idle", "thinking");
                window.nagElements.orb.classList.add("speaking");
            }
            
            // Create a temporary audio element (doesn't interfere with main audio)
            const audio = new Audio(audioUrl);
            
            // Configure for Safari
            audio.preload = "auto";
            audio.controls = false;
            audio.controlsList = "nodownload nofullscreen noremoteplayback";
            audio.disableRemotePlayback = true;
            audio.setAttribute('playsinline', '');
            audio.setAttribute('webkit-playsinline', '');
            
            // Set up ended handler to clean up button and reset UI
            audio.onended = () => {
                removePlayButton();
                if (window.nagElements.orb) {
                    window.nagElements.orb.classList.remove("speaking");
                    window.nagElements.orb.classList.add("idle");
                }
            };
            
            // Set error handler
            audio.onerror = () => {
                window.logDebug("Manual play failed - audio error");
                removePlayButton();
                if (window.nagElements.orb) {
                    window.nagElements.orb.classList.remove("speaking");
                    window.nagElements.orb.classList.add("idle");
                }
            };
            
            await audio.play();
        } catch (error) {
            console.error("Manual play failed:", error);
            window.logDebug("Manual play failed: " + error.message);
            removePlayButton();
            
            // Reset UI
            if (window.nagElements.orb) {
                window.nagElements.orb.classList.remove("speaking");
                window.nagElements.orb.classList.add("idle");
            }
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
        audio.preload = "auto";
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