// Nag Digital Twin v3.5.0 - Utilities Module
console.log("Loading nag-utils.js");

// Add status message to the UI
function addStatusMessage(message, type = 'info', isDebug = false) {
    // Skip debug messages if debug is disabled
    if (isDebug && !window.nagState.debugEnabled) {
        return;
    }
    
    // Get status panel
    const statusPanel = document.getElementById('statusPanel');
    if (!statusPanel) {
        console.log(`[${type}]: ${message}`);
        return;
    }
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('status-message');
    messageDiv.classList.add(type);
    
    if (isDebug) {
        messageDiv.classList.add('debug');
    }
    
    // Add timestamp for debug messages
    if (isDebug) {
        const time = new Date().toTimeString().substring(0, 8);
        messageDiv.textContent = `[${time}] ${message}`;
    } else {
        messageDiv.textContent = message;
    }
    
    // Add to panel (prepend)
    statusPanel.insertBefore(messageDiv, statusPanel.firstChild);
    
    // Log to console
    if (type === 'error') {
        console.error(message);
    } else if (isDebug) {
        console.debug(`[DEBUG] ${message}`);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

// Add debug message
function logDebug(message) {
    addStatusMessage(message, 'debug', true);
    
    // Also add to debug panel if it exists
    const debugContent = document.querySelector('.debug-content');
    if (debugContent) {
        const timestamp = new Date().toTimeString().substring(0, 8);
        const entry = document.createElement('div');
        entry.textContent = `[${timestamp}] ${message}`;
        debugContent.insertBefore(entry, debugContent.firstChild);
    }
}

// Safe JSON parsing with error handling
function safeJsonParse(text) {
    try {
        return { result: JSON.parse(text), error: null };
    } catch (error) {
        logDebug(`JSON parse error: ${error.message}`);
        return { result: null, error };
    }
}

// Safely check if a MIME type is supported
function isMimeTypeSupported(mimeType) {
    try {
        return MediaRecorder.isTypeSupported(mimeType);
    } catch (error) {
        logDebug(`Error checking MIME type support for ${mimeType}: ${error.message}`);
        return false;
    }
}

// Get browser capabilities for debug information
function getBrowserInfo() {
    const info = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
        isiOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || 
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
        supportsMediaRecorder: typeof MediaRecorder !== 'undefined',
        // Check supported audio formats if MediaRecorder is available
        supportedFormats: {}
    };
    
    if (info.supportsMediaRecorder) {
        const formats = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
        formats.forEach(format => {
            try {
                info.supportedFormats[format] = MediaRecorder.isTypeSupported(format);
            } catch (e) {
                info.supportedFormats[format] = false;
            }
        });
    }
    
    return info;
}

// Log browser information
function logBrowserInfo() {
    const info = getBrowserInfo();
    
    logDebug("Browser information:");
    logDebug(`- User Agent: ${info.userAgent}`);
    logDebug(`- Platform: ${info.platform}`);
    logDebug(`- Safari: ${info.isSafari}`);
    logDebug(`- iOS: ${info.isiOS}`);
    logDebug(`- Supports MediaRecorder: ${info.supportsMediaRecorder}`);
    
    if (info.supportsMediaRecorder) {
        logDebug("Supported audio formats:");
        Object.entries(info.supportedFormats).forEach(([format, supported]) => {
            logDebug(`- ${format}: ${supported ? 'Yes' : 'No'}`);
        });
    }
    
    return info;
}

// Helper function to wait for a specified time
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Make utilities available globally
window.addStatusMessage = addStatusMessage;
window.logDebug = logDebug;
window.safeJsonParse = safeJsonParse;
window.isMimeTypeSupported = isMimeTypeSupported;
window.getBrowserInfo = getBrowserInfo;
window.logBrowserInfo = logBrowserInfo;
window.sleep = sleep;

// Log browser info on load
if (window.nagState) {
    window.nagState.browserInfo = getBrowserInfo();
}

console.log("nag-utils.js loaded");