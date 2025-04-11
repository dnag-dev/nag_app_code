// Voice level processor for volume detection
class VoiceLevelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._volume = 0;
    this._updateInterval = 25; // Update interval in ms
    this._nextUpdateFrame = this._updateInterval * sampleRate / 1000;
  }

  process(inputs, outputs, parameters) {
    // Get the first input channel
    const input = inputs[0];
    if (!input || !input.length || !input[0] || !input[0].length) {
      // No input data, keep processor alive
      return true;
    }

    const channel = input[0];
    
    // Calculate RMS value as volume
    let sum = 0;
    for (let i = 0; i < channel.length; i++) {
      sum += channel[i] * channel[i];
    }
    
    const rms = Math.sqrt(sum / channel.length);
    
    // Apply some smoothing
    this._volume = Math.max(rms, this._volume * 0.95);
    
    // Send volume updates at regular intervals
    this._nextUpdateFrame -= channel.length;
    if (this._nextUpdateFrame <= 0) {
      this._nextUpdateFrame = this._updateInterval * sampleRate / 1000;
      this.port.postMessage({
        type: 'volume',
        volume: this._volume * 100
      });
    }
    
    // Always return true to keep the processor running
    return true;
  }
}

// Register the processor
registerProcessor('voice-level-processor', VoiceLevelProcessor); 