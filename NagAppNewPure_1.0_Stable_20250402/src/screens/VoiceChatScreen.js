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
  Clipboard
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useChatStore from '../store/chatStore';
import audioService from '../services/audioService';
import chatService from '../services/chatService';
import { 
  AZURE_API_ENDPOINTS, 
  AZURE_API_BASE_URL,
  checkApiHealth,
  HEALTH_CHECK_CONFIG,
  AZURE_API_ERRORS
} from '../config/azureApi';
import { processVoiceChat } from '../services/voiceChatService';
import RNFS from 'react-native-fs';
import Sound from 'react-native-sound';

const { width } = Dimensions.get('window');
const ORB_SIZE = width * 0.6;

const BUILD_NUMBER = '1.0.0';

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
    setCurrentTranscription
  } = useChatStore();

  // State for orb color instead of Animated.Value
  const [orbColor, setOrbColor] = useState('#4A90E2');
  // State for orb scale instead of Animated.Value
  const [orbScale, setOrbScale] = useState(1);
  
  // Refs for tracking intervals/timeouts
  const colorIntervalRef = useRef(null);
  const pulseIntervalRef = useRef(null);
  const scrollViewRef = useRef(null);
  const isUnmounting = useRef(false);
  const isInitialized = useRef(false);

  const [logs, setLogs] = useState([]);
  const [audioUri, setAudioUri] = useState(null);
  const [azureStatus, setAzureStatus] = useState('checking');

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable 
          onPress={() => navigation.navigate('Chat')}
          style={styles.headerButton}
          android_ripple={null}
          pressable={false}
        >
          <Text style={styles.headerButtonText}>💬</Text>
        </Pressable>
      ),
    });

    // Initialize audio service
    const initAudio = async () => {
      try {
        if (!isInitialized.current) {
          await audioService.initializeComponents();
          isInitialized.current = true;
          console.log('Audio service initialized successfully');
        }
      } catch (error) {
        console.error('Failed to initialize audio:', error);
        Alert.alert(
          'Audio Initialization Error',
          'Failed to initialize audio. Please check your device settings and try again.',
          [{ text: 'OK' }]
        );
      }
    };

    initAudio();

    return () => {
      isUnmounting.current = true;
      stopAnimations();
    };
  }, [navigation]);

  // Effect for animations based on recording state
  useEffect(() => {
    if (isRecording) {
      startAnimations();
    } else {
      stopAnimations();
    }
  }, [isRecording]);

  // Animation functions that don't use Animated API
  const startAnimations = () => {
    // Color animation using setInterval
    let isRed = false;
    colorIntervalRef.current = setInterval(() => {
      setOrbColor(isRed ? '#4A90E2' : '#E24A4A');
      isRed = !isRed;
    }, 1000);

    // Pulse animation using setInterval
    let isPulsed = false;
    pulseIntervalRef.current = setInterval(() => {
      setOrbScale(isPulsed ? 1 : 1.2);
      isPulsed = !isPulsed;
    }, 1000);
  };

  const stopAnimations = () => {
    if (colorIntervalRef.current) {
      clearInterval(colorIntervalRef.current);
      colorIntervalRef.current = null;
    }
    
    if (pulseIntervalRef.current) {
      clearInterval(pulseIntervalRef.current);
      pulseIntervalRef.current = null;
    }
    
    // Reset to default state
    setOrbColor('#4A90E2');
    setOrbScale(1);
  };

  useEffect(() => {
    // Check Azure connection with retries
    const checkAzureConnection = async () => {
      let retries = 0;
      while (retries < HEALTH_CHECK_CONFIG.retries) {
        try {
          addLog(`Checking Azure connection (attempt ${retries + 1}/${HEALTH_CHECK_CONFIG.retries})...`, 'info');
          const healthStatus = await checkApiHealth();
          
          if (healthStatus.status === 'connected') {
            setAzureStatus('connected');
            addLog('Azure connection successful', 'success');
            addLog(`API Details: ${JSON.stringify(healthStatus.details, null, 2)}`, 'info');
            return;
          } else {
            setAzureStatus('error');
            addLog(`Azure connection failed: ${healthStatus.message}`, 'error');
            if (healthStatus.details) {
              addLog(`Error details: ${JSON.stringify(healthStatus.details, null, 2)}`, 'error');
            }
          }
        } catch (error) {
          setAzureStatus('error');
          addLog(`Azure connection error: ${error.message}`, 'error');
        }
        
        retries++;
        if (retries < HEALTH_CHECK_CONFIG.retries) {
          addLog(`Retrying in ${HEALTH_CHECK_CONFIG.retryDelay/1000} seconds...`, 'info');
          await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_CONFIG.retryDelay));
        }
      }
      
      // If we get here, all retries failed
      setAzureStatus('error');
      addLog('All connection attempts failed. Please check your internet connection and try again.', 'error');
    };

    checkAzureConnection();
    
    // Log API configuration
    addLog(`Build: ${BUILD_NUMBER}`, 'info');
    addLog(`API Base URL: ${AZURE_API_BASE_URL}`, 'info');
    addLog(`Chat Endpoint: ${AZURE_API_ENDPOINTS.chat}`, 'info');
    addLog(`Transcribe Endpoint: ${AZURE_API_ENDPOINTS.transcribe}`, 'info');
    addLog(`Text-to-Speech Endpoint: ${AZURE_API_ENDPOINTS.textToSpeech}`, 'info');
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
      if (!isInitialized.current) {
        await audioService.initializeComponents();
        isInitialized.current = true;
      }

      // Start recording first
      await audioService.startRecording();
      
      // Then start voice recognition
      await audioService.startVoiceRecognition();
      
      // Only set recording state if both operations succeed
      setIsRecording(true);
      addLog('Recording started successfully', 'success');
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      
      let errorMessage = 'Failed to start recording. Please check microphone permissions and try again.';
      if (Platform.OS === 'ios' && error.message.includes('audio session')) {
        errorMessage = 'Audio session error. Please close other apps using the microphone and try again.';
      }
      
      addLog(`Recording Error: ${errorMessage}`, 'error');
      Alert.alert(
        'Recording Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    }
  };

  const handleStopRecording = async () => {
    try {
      // Set processing state to prevent multiple stops
      setIsProcessing(true);
      
      // Stop voice recognition first
      await audioService.stopVoiceRecognition();
      addLog('Voice recognition stopped', 'info');

      // Then stop recording to get the audio file
      const newAudioUri = await audioService.stopRecording();
      addLog(`Recording stopped. Audio URI: ${newAudioUri}`, 'info');

      if (newAudioUri) {
        // Verify file exists and is not empty
        const fileInfo = await RNFS.stat(newAudioUri.replace('file://', ''));
        addLog(`Audio file size: ${fileInfo.size} bytes`, 'info');
        
        if (fileInfo.size === 0) {
          throw new Error('Audio file is empty');
        }
        
        setAudioUri(newAudioUri);
        addLog('Audio file verified successfully', 'success');
        
        // Process the recording
        await processRecording(newAudioUri);
      } else {
        throw new Error('No audio file was recorded');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      addLog(`Recording Error: ${error.message}`, 'error');
      Alert.alert(
        'Recording Error',
        'Failed to save the recording. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      // Reset states in finally block to ensure they're always reset
      setIsRecording(false);
      setIsProcessing(false);
    }
  };

  const processRecording = async (audioUri) => {
    try {
      setIsProcessing(true);
      addLog('Starting audio processing...', 'info');
      
      // Send to Azure for transcription
      const result = await audioService.sendAudioToAzure(audioUri);
      if (result) {
        addLog('Audio sent to Azure successfully', 'success');
        // Process the transcription result
        await handleVoiceChat();
      } else {
        throw new Error('Failed to send audio to Azure');
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      addLog(`Processing Error: ${error.message}`, 'error');
      Alert.alert(
        'Error',
        'Failed to process audio. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceChat = async () => {
    if (!audioUri) {
      addLog('No audio file available. Please record audio first.', 'error');
      addLog('Current state:', 'error');
      addLog(`isRecording: ${isRecording}`, 'error');
      addLog(`isProcessing: ${isProcessing}`, 'error');
      addLog(`audioUri: ${audioUri}`, 'error');
      return;
    }

    try {
      addLog('Starting voice chat...', 'info');
      addLog(`Using audio file: ${audioUri}`, 'info');
      
      // Check if we're in simulator mode
      if (audioService.isSimulator) {
        addLog('Simulator mode detected, using mock responses', 'info');
        const mockTranscription = 'This is a mock transcription for simulator testing.';
        const mockResponse = 'This is a mock response from the AI assistant in simulator mode.';
        
        addLog(`Mock transcription: ${mockTranscription}`, 'success');
        setCurrentTranscription(mockResponse);
        
        addMessage({
          id: Date.now(),
          text: mockResponse,
          type: 'assistant',
          timestamp: new Date().toISOString()
        });

        // Simulate audio playback
        setIsPlaying(true);
        setTimeout(() => {
          setIsPlaying(false);
        }, 2000);
        return;
      }
      
      // First, transcribe the audio
      addLog('Starting transcription request...', 'info');
      addLog(`Transcription endpoint: ${AZURE_API_ENDPOINTS.transcribe}`, 'info');
      const transcription = await chatService.transcribeAudio(audioUri);
      addLog(`Transcription received: ${transcription}`, 'success');

      // Then, send the transcription to the chat API
      addLog('Starting chat completion request...', 'info');
      addLog(`Chat endpoint: ${AZURE_API_ENDPOINTS.chat}`, 'info');
      let assistantResponse = '';
      await chatService.streamChatCompletion(
        [
          { role: 'system', content: 'You are a helpful AI assistant.' },
          { role: 'user', content: transcription }
        ],
        async (token) => {
          assistantResponse += token;
          setCurrentTranscription(assistantResponse);
        },
        (error) => {
          console.error('Error in chat:', error);
          setCurrentTranscription('Sorry, there was an error processing your request.');
        },
        async () => {
          addMessage({
            id: Date.now(),
            text: assistantResponse,
            type: 'assistant',
            timestamp: new Date().toISOString()
          });

          // Generate and play speech
          setIsPlaying(true);
          try {
            addLog('Starting text-to-speech request...', 'info');
            addLog(`Text-to-speech endpoint: ${AZURE_API_ENDPOINTS.textToSpeech}`, 'info');
            addLog(`Text to convert: ${assistantResponse}`, 'info');
            const audioUrl = await chatService.generateSpeech(assistantResponse);
            await audioService.playAudio(audioUrl);
          } catch (error) {
            console.error('Error playing audio:', error);
            addLog(`Playback Error: ${error.message}`, 'error');
            addLog(`Stack trace: ${error.stack}`, 'error');
            Alert.alert(
              'Playback Error',
              'Failed to play audio response. Please try again.',
              [{ text: 'OK' }]
            );
          } finally {
            setIsPlaying(false);
          }
        }
      );
    } catch (error) {
      const errorMessage = error.message || 'Unknown error occurred';
      const errorDetails = error.response?.data ? JSON.stringify(error.response.data, null, 2) : '';
      const errorStatus = error.response?.status ? `HTTP Status: ${error.response.status}` : '';
      
      addLog(`Error: ${errorMessage}`, 'error');
      if (errorStatus) addLog(errorStatus, 'error');
      if (errorDetails) addLog(`Server Response: ${errorDetails}`, 'error');
      addLog(`Stack trace: ${error.stack}`, 'error');
      
      // Show error in UI
      Alert.alert(
        'Error Processing Voice Chat',
        `${errorMessage}\n\n${errorStatus}\n\n${errorDetails}`,
        [{ text: 'OK' }]
      );
    }
  };

  const addLog = (message, type = 'info') => {
    setLogs(prevLogs => [...prevLogs, { message, type, timestamp: new Date().toISOString() }]);
  };

  const copyLogsToClipboard = () => {
    const logText = logs
      .map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`)
      .join('\n');
    
    Clipboard.setString(logText);
    addLog('Logs copied to clipboard', 'success');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageContainer,
                message.type === 'user' ? styles.userMessage : styles.assistantMessage,
              ]}
            >
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          ))}
          {currentTranscription && (
            <View style={[styles.messageContainer, styles.assistantMessage]}>
              <Text style={styles.messageText}>{currentTranscription}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.controlsContainer}>
          <View
            style={[
              styles.orb,
              {
                backgroundColor: orbColor,
                transform: [{ scale: orbScale }]
              }
            ]}
          >
            <Pressable
              style={styles.orbButton}
              onPress={isRecording ? handleStopRecording : handleStartRecording}
              disabled={isProcessing}
              android_ripple={null}
              pressable={false}
            >
              <Text style={styles.orbButtonText}>
                {isRecording ? '⏹' : isProcessing ? '⌛' : '🎤'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable 
            style={styles.button}
            onPress={handleVoiceChat}
            android_ripple={null}
            pressable={false}
          >
            <Text style={styles.buttonText}>Process Voice Chat</Text>
          </Pressable>
        </View>

        <View style={styles.logContainer}>
          <View style={styles.logHeader}>
            <Text style={styles.logTitle}>Debug Logs:</Text>
            <Pressable 
              style={styles.copyButton}
              onPress={copyLogsToClipboard}
              android_ripple={null}
              pressable={false}
            >
              <Text style={styles.copyButtonText}>📋 Copy Logs</Text>
            </Pressable>
          </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageText: {
    fontSize: 16,
    color: '#333333',
  },
  controlsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  orbButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbButtonText: {
    fontSize: 32,
  },
  headerButton: {
    marginRight: 16,
  },
  headerButtonText: {
    fontSize: 24,
  },
  userMessage: {
    backgroundColor: '#E2F3FF',
  },
  assistantMessage: {
    backgroundColor: '#FFF9E2',
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
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
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
  copyButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 6,
    marginLeft: 10,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 