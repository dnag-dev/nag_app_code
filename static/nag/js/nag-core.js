// Core application state and functionality
class NagApp {
    constructor() {
        this.state = {
            isListening: false,
            isProcessing: false,
            isSpeaking: false
        };
        
        this.elements = {
            orb: document.getElementById('orb'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            statusPanel: document.getElementById('statusPanel')
        };
        
        this.initialize();
    }
    
    initialize() {
        this.setupEventListeners();
        this.updateOrbState();
        this.addMessage('Welcome to Nag! Click Start to begin.', 'assistant');
    }
    
    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.startListening());
        this.elements.stopBtn.addEventListener('click', () => this.stopListening());
    }
    
    startListening() {
        this.state.isListening = true;
        this.updateOrbState();
        this.elements.startBtn.disabled = true;
        this.elements.stopBtn.disabled = false;
        this.addMessage('Listening...', 'assistant');
    }
    
    stopListening() {
        this.state.isListening = false;
        this.updateOrbState();
        this.elements.startBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        this.addMessage('Stopped listening', 'assistant');
    }
    
    updateOrbState() {
        this.elements.orb.className = 'orb';
        if (this.state.isListening) this.elements.orb.classList.add('listening');
        else if (this.state.isProcessing) this.elements.orb.classList.add('thinking');
        else if (this.state.isSpeaking) this.elements.orb.classList.add('speaking');
    }
    
    addMessage(text, type = 'assistant') {
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        this.elements.statusPanel.appendChild(message);
        this.elements.statusPanel.scrollTop = this.elements.statusPanel.scrollHeight;
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.nagApp = new NagApp();
}); 