import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Platform, NativeModules } from 'react-native';
import { AZURE_API_ENDPOINTS, AZURE_API_BASE_URL } from '../config/azureApi';
import { processVoiceChat } from '../services/voiceChatService';
import { useNavigation } from '@react-navigation/native';
import { NativeEventEmitter } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Voice from '@react-native-voice/voice';

const { width } = Dimensions.get('window');
const ORB_SIZE = width * 0.6;

const BUILD_NUMBER = '1.0.0';

// Initialize voice event emitter
const voiceEmitter = new NativeEventEmitter(Voice);

const VoiceChatScreen = () => {
  const navigation = useNavigation();
  const [logs, setLogs] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
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

  const startRecording = async () => {
    try {
      await Voice.start('en-US');
      addLog('Started recording', 'info');
    } catch (error) {
      addLog(`Error starting recording: ${error.message}`, 'error');
    }
  };

  const stopRecording = async () => {
    try {
      await Voice.stop();
      addLog('Stopped recording', 'info');
    } catch (error) {
      addLog(`Error stopping recording: ${error.message}`, 'error');
    }
  };

  const handleVoiceChat = async () => {
    if (!audioUri) {
      addLog('No audio file available. Please record audio first.', 'error');
      return;
    }

    try {
      addLog('Starting voice chat...', 'info');
      addLog(`Using audio file: ${audioUri}`, 'info');
      
      const result = await processVoiceChat(audioUri);
      
      addLog(`Transcription: ${result.transcription}`, 'success');
      addLog(`Response: ${result.response}`, 'success');
      addLog(`Audio URL: ${result.audioUrl}`, 'success');
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
      if (error.response?.data) {
        addLog(`Server Response: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
      }
      if (error.response?.status) {
        addLog(`HTTP Status: ${error.response.status}`, 'error');
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.button, isRecording ? styles.recordingButton : null]}
          onPress={toggleRecording}
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
          onPress={handleVoiceChat}
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
};

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

export default VoiceChatScreen; 