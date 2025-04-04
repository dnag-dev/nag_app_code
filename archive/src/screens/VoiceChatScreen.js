import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
  Clipboard,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useChatStore from '../store/chatStore';
import chatService from '../services/chatService';
import { 
  AZURE_API_ENDPOINTS, 
  AZURE_API_BASE_URL,
  checkApiHealth,
  HEALTH_CHECK_CONFIG,
  AZURE_API_ERRORS
} from '../config/azureApi';
import RNFS from 'react-native-fs';
import Sound from 'react-native-sound';
import Ionicons from 'react-native-vector-icons/Ionicons';
import OrbAnimation from '../components/OrbAnimation';
import Voice from '@react-native-voice/voice';
import AudioService from '../services/audioService';

const { width } = Dimensions.get('window');
const ORB_SIZE = width * 0.6;

const BUILD_NUMBER = '1.0.0';

// Initialize voice event emitter
const voiceEmitter = new NativeEventEmitter(Voice);

export default function VoiceChatScreen() {
  const navigation = useNavigation();
  const {
    messages,
    addMessage,
    isRecording,
    isProcessing,
    isPlaying,
    currentTranscription,
    setIsRecording,
    setIsProcessing,
    setIsPlaying,
    setCurrentTranscription,
    clearTranscription
  } = useChatStore();

  // Initialize AudioService
  const audioService = useRef(new AudioService()).current;

  const [logs, setLogs] = useState([]);
  const [audioUri, setAudioUri] = useState(null);

  const addLog = (message, type = 'info') => {
    setLogs(prevLogs => [...prevLogs, { message, type, timestamp: new Date().toISOString() }]);
  };

  useEffect(() => {
    // Log API configuration on component mount
    addLog(`API Base URL: ${AZURE_API_BASE_URL}`, 'info');
    addLog(`Chat Endpoint: ${AZURE_API_ENDPOINTS.chat}`, 'info');
    addLog(`Transcribe Endpoint: ${AZURE_API_ENDPOINTS.transcribe}`, 'info');
    addLog(`Text-to-Speech Endpoint: ${AZURE_API_ENDPOINTS.textToSpeech}`, 'info');

    // Set up voice event listeners
    const onSpeechStart = () => {
      addLog('Speech recognition started', 'info');
      setIsRecording(true);
    };

    const onSpeechEnd = () => {
      addLog('Speech recognition ended', 'info');
      setIsRecording(false);
    };

    const onSpeechResults = (e) => {
      const text = e.value[0];
      addLog(`Speech recognized: ${text}`, 'success');
      setAudioUri(text);
    };

    const onSpeechError = (e) => {
      addLog(`Speech recognition error: ${e.error?.message}`, 'error');
      setIsRecording(false);
    };

    voiceEmitter.addListener('onSpeechStart', onSpeechStart);
    voiceEmitter.addListener('onSpeechEnd', onSpeechEnd);
    voiceEmitter.addListener('onSpeechResults', onSpeechResults);
    voiceEmitter.addListener('onSpeechError', onSpeechError);

    return () => {
      voiceEmitter.removeAllListeners('onSpeechStart');
      voiceEmitter.removeAllListeners('onSpeechEnd');
      voiceEmitter.removeAllListeners('onSpeechResults');
      voiceEmitter.removeAllListeners('onSpeechError');
    };
  }, []);

  const handleStartRecording = async () => {
    if (azureStatus !== 'connected') {
      addLog('Cannot start recording: Azure API is not connected', 'error');
      Alert.alert(
        'Connection Error',
        'Please wait for the Azure API connection to be established before recording.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsRecording(true);
      setOrbColor(ORB_COLORS.LISTENING);
      addLog('Starting recording...', 'info');
      
      // Initialize audio components
      await audioService.initializeComponents();
      
      // Start recording
      const uri = await audioService.startRecording();
      setAudioUri(uri);
      addLog(`Recording started at: ${uri}`, 'success');
      
      // Start voice recognition
      await audioService.startVoiceRecognition();
      addLog('Voice recognition started', 'success');
    } catch (error) {
      console.error('Error starting recording:', error);
      addLog(`Error starting recording: ${error.message}`, 'error');
      setIsRecording(false);
      setOrbColor(ORB_COLORS.ERROR);
      Alert.alert(
        'Recording Error',
        'Failed to start recording. Please check your microphone permissions and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleStopRecording = async () => {
    try {
      setIsRecording(false);
      setOrbColor(ORB_COLORS.PROCESSING);
      addLog('Stopping recording...', 'info');
      
      // Stop recording
      const result = await audioService.stopRecording();
      addLog('Recording stopped', 'success');
      
      // Stop voice recognition
      await audioService.stopVoiceRecognition();
      addLog('Voice recognition stopped', 'success');
      
      if (currentTranscription) {
        setIsProcessing(true);
        addLog(`Processing transcription: ${currentTranscription}`, 'info');
        
        // Process the voice chat
        const response = await audioService.processVoiceChat(currentTranscription);
        
        if (!response || !response.audio_url) {
          throw new Error('Invalid response from Azure API');
        }
        
        addLog('Voice chat processed successfully', 'success');
        addMessage({
          text: currentTranscription,
          isUser: true,
          timestamp: new Date().toISOString()
        });
        
        addMessage({
          text: response.text || 'No text response',
          isUser: false,
          timestamp: new Date().toISOString()
        });
        
        clearTranscription();
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      addLog(`Error stopping recording: ${error.message}`, 'error');
      setOrbColor(ORB_COLORS.ERROR);
      Alert.alert(
        'Processing Error',
        'Failed to process the recording. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
      setOrbColor(ORB_COLORS.IDLE);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.button, isRecording ? styles.recordingButton : null]}
          onPress={handleStartRecording}
        >
          <Icon 
            name={isRecording ? "stop-circle" : "mic"} 
            size={24} 
            color="#fff" 
          />
          <Text style={styles.buttonText}>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={handleStopRecording}
        >
          <Icon name="play-circle" size={24} color="#fff" />
          <Text style={styles.buttonText}>Process Voice Chat</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>Debug Logs:</Text>
        <ScrollView style={styles.logScroll}>
          {logs.map((log, index) => (
            <Text 
              key={index} 
              style={[
                styles.logText,
                log.type === 'error' && styles.errorLog,
                log.type === 'success' && styles.successLog
              ]}
            >
              {`[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  logScroll: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    marginBottom: 2,
  },
  errorLog: {
    color: 'red',
  },
  successLog: {
    color: 'green',
  },
}); 