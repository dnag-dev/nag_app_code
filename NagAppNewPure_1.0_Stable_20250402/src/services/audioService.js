import { Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Voice from '@react-native-voice/voice';
import Sound from 'react-native-sound';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import RNFS from 'react-native-fs';
import { AZURE_API_BASE_URL } from '../config/azureApi';

// Enable playback in silence mode and configure Sound
Sound.setCategory('Playback');
Sound.setMode('Default');

class AudioService {
  constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer();
    this.recordingPath = Platform.select({
      ios: 'audio.m4a',
      android: 'audio.mp4',
    });
    this.isRecording = false;
    this.isPlaying = false;
    this.silenceTimeout = null;
    this.silenceThreshold = -50; // dB threshold for silence detection
    this.silenceDuration = 1500; // ms of silence before stopping
    this.noiseReductionEnabled = true;
    this.currentSound = null;

    // Initialize Voice recognition handlers
    Voice.onSpeechStart = this.handleSpeechStart.bind(this);
    Voice.onSpeechEnd = this.handleSpeechEnd.bind(this);
    Voice.onSpeechResults = this.handleSpeechResults.bind(this);
    Voice.onSpeechError = this.handleSpeechError.bind(this);
  }

  async initializeComponents() {
    try {
      console.log('Initializing audio components...');
      
      // Request microphone permission
      const permission = Platform.select({
        ios: PERMISSIONS.IOS.MICROPHONE,
        android: PERMISSIONS.ANDROID.RECORD_AUDIO,
      });

      console.log('Checking microphone permission...');
      const result = await check(permission);
      console.log('Permission status:', result);
      
      if (result !== RESULTS.GRANTED) {
        console.log('Requesting microphone permission...');
        const requestResult = await request(permission);
        console.log('Permission request result:', requestResult);
        
        if (requestResult !== RESULTS.GRANTED) {
          throw new Error('Microphone permission not granted');
        }
      }

      // Initialize Voice recognition
      const isVoiceAvailable = await Voice.isAvailable();
      console.log('Voice recognition available:', isVoiceAvailable);
      
      if (!isVoiceAvailable) {
        throw new Error('Voice recognition is not available on this device');
      }

      // Configure audio recorder settings
      await this.audioRecorderPlayer.setSubscriptionDuration(0.1); // 100ms

      console.log('Audio components initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio components:', error);
      throw error;
    }
  }

  async startRecording() {
    try {
      if (this.isRecording) {
        console.warn('Recording is already in progress');
        return;
      }

      console.log('Starting recording...');
      this.isRecording = true;

      const audioSet = Platform.select({
        ios: {
          AVFormatIDKey: 'aac',
          AVSampleRateKey: 16000,
          AVNumberOfChannelsKey: 1,
          AVEncoderAudioQualityKey: 'high',
        },
        android: {
          AudioEncoder: 3, // AAC
          AudioSource: 6, // MIC
          OutputFormat: 2, // MPEG_4
          AudioSamplingRate: 16000,
          AudioChannels: 1,
          AudioEncodingBitRate: 128000,
        },
      });

      // Start recording with audio monitoring
      const uri = await this.audioRecorderPlayer.startRecorder(
        this.recordingPath,
        audioSet
      );

      // Start monitoring audio levels
      this.audioRecorderPlayer.addRecordBackListener((e) => {
        if (e.currentPosition > 0) {
          this.handleAudioLevel(e.currentMetering);
        }
      });

      console.log('Recording started at:', uri);
      return uri;
    } catch (error) {
      console.error('Error starting recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  async stopRecording() {
    try {
      if (!this.isRecording) {
        console.warn('No recording in progress');
        return null;
      }

      console.log('Stopping recording...');
      this.isRecording = false;
      this.stopAudioLevelMonitoring();

      const result = await this.audioRecorderPlayer.stopRecorder();
      this.audioRecorderPlayer.removeRecordBackListener();
      console.log('Recording stopped:', result);
      return result;
    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    }
  }

  handleAudioLevel(metering) {
    if (metering < this.silenceThreshold) {
      if (!this.silenceTimeout) {
        this.silenceTimeout = setTimeout(() => {
          console.log('Silence detected, stopping recording...');
          this.stopRecording();
        }, this.silenceDuration);
      }
    } else {
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
    }
  }

  stopAudioLevelMonitoring() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  async startVoiceRecognition() {
    try {
      await Voice.start('en-US');
      console.log('Voice recognition started');
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      throw error;
    }
  }

  async stopVoiceRecognition() {
    try {
      await Voice.stop();
      console.log('Voice recognition stopped');
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      throw error;
    }
  }

  async playAudio(base64Audio) {
    try {
      if (this.isPlaying) {
        await this.stopAudio();
      }

      this.isPlaying = true;
      
      // Create a temporary file path with mp3 extension for OpenAI TTS
      const tempPath = `${RNFS.CachesDirectoryPath}/temp_audio_${Date.now()}.mp3`;
      
      console.log('Writing audio file to:', tempPath);
      
      try {
        // Convert base64 to binary and write to file
        await RNFS.writeFile(tempPath, base64Audio, 'base64');
        console.log('Successfully wrote audio file');
      } catch (writeError) {
        console.error('Error writing audio file:', writeError);
        throw writeError;
      }
      
      return new Promise((resolve, reject) => {
        // Configure sound before loading
        Sound.setCategory('Playback', true);
        
        console.log('Creating Sound instance with file:', tempPath);
        
        // Create a new Sound instance with the temporary file
        this.currentSound = new Sound(tempPath, '', (error) => {
          if (error) {
            console.error('Error loading audio:', error);
            this.isPlaying = false;
            RNFS.unlink(tempPath).catch(err => 
              console.error('Error deleting temporary file:', err)
            );
            reject(error);
            return;
          }

          console.log('Audio loaded successfully');
          console.log('Audio duration:', this.currentSound.getDuration(), 'seconds');
          
          // Configure playback settings
          this.currentSound.setCategory('Playback');
          this.currentSound.setVolume(1.0);
          this.currentSound.setNumberOfLoops(0);
          
          // Play the audio
          this.currentSound.play((success) => {
            if (success) {
              console.log('Audio played successfully');
            } else {
              console.log('Audio playback failed');
            }
            this.isPlaying = false;
            this.currentSound.release();
            this.currentSound = null;
            
            // Clean up the temporary file
            RNFS.unlink(tempPath).catch(err => 
              console.error('Error deleting temporary file:', err)
            );
            
            resolve(success);
          });
        });
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      this.isPlaying = false;
      throw error;
    }
  }

  async stopAudio() {
    try {
      if (this.currentSound) {
        this.currentSound.stop();
        this.currentSound.release();
        this.currentSound = null;
      }
      this.isPlaying = false;
    } catch (error) {
      console.error('Error stopping audio:', error);
      this.isPlaying = false;
      this.currentSound = null;
      throw error;
    }
  }

  handleSpeechStart() {
    console.log('Speech started');
  }

  handleSpeechEnd() {
    console.log('Speech ended');
  }

  handleSpeechResults(e) {
    if (e.value && e.value[0]) {
      console.log('Speech results:', e.value[0]);
    }
  }

  handleSpeechError(e) {
    console.error('Voice recognition error:', e.error?.message || 'Unknown error');
  }

  async destroy() {
    try {
      if (this.isPlaying) {
        await this.stopAudio();
      }
      
      if (this.isRecording) {
        await this.stopRecording();
      }
      
      this.audioRecorderPlayer.removeRecordBackListener();
      this.audioRecorderPlayer.removePlayBackListener();
      Voice.destroy().then(Voice.removeAllListeners);
      
      this.stopAudioLevelMonitoring();
      
      console.log('Audio service destroyed successfully');
    } catch (error) {
      console.error('Error destroying audio service:', error);
    }
  }

  async sendAudioToAzure(audioUri) {
    try {
      if (!audioUri) {
        console.error('No audio file provided');
        return null;
      }

      console.log('Preparing to send audio to Azure:', audioUri);

      // Get the actual file path without the file:// prefix
      const filePath = audioUri.replace('file://', '');

      // Verify file exists and is not empty
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        console.error('Audio file does not exist at path:', filePath);
        return null;
      }

      const stats = await RNFS.stat(filePath);
      if (stats.size === 0) {
        console.error('Audio file is empty at path:', filePath);
        return null;
      }

      console.log('Audio file verified, size:', stats.size, 'bytes');

      // Create FormData and append the file
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? audioUri : `file://${filePath}`,
        type: Platform.OS === 'ios' ? 'audio/x-m4a' : 'audio/mpeg',
        name: Platform.OS === 'ios' ? 'recording.m4a' : 'recording.mp3'
      });

      // Add browser param to help server handle Safari-like clients
      formData.append('browser', Platform.OS === 'ios' ? 'safari' : 'other');

      // Send to Azure
      const response = await fetch(`${AZURE_API_BASE_URL}/transcribe`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Azure API error:', errorData);
        throw new Error(errorData.error || response.statusText);
      }

      const result = await response.json();
      console.log('Azure transcription result:', result);
      return result;
    } catch (error) {
      console.error('Error sending audio to Azure:', error);
      throw error;
    }
  }
}

export default new AudioService(); 