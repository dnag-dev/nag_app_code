import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Dimensions, SafeAreaView, ScrollView, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL, API_ENDPOINTS, API_HEADERS } from '../config/api';

const { width } = Dimensions.get('window');
const ORB_SIZE = width * 0.6;

export default function VoiceChatScreen() {
  const [recording, setRecording] = useState(null);
  const [sound, setSound] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [messages, setMessages] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const scrollViewRef = useRef(null);
  
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const orbColorAnim = useRef(new Animated.Value(0)).current;
  const orbScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setupAudio();
    fetchMessages();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.messages}`, {
        headers: API_HEADERS
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    }
  };

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Start color transition
      Animated.timing(orbColorAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }).start();

      // Start real-time transcription
      startTranscription();
    } else {
      pulseAnim.setValue(1);
      Animated.timing(orbColorAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: false,
      }).start();
      setIsTranscribing(false);
      setCurrentTranscription('');
    }
  }, [isRecording]);

  const startTranscription = async () => {
    setIsTranscribing(true);
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.transcription}/start`, {
        method: 'POST',
        headers: API_HEADERS
      });
      if (!response.ok) {
        throw new Error('Failed to start transcription');
      }
    } catch (error) {
      console.error('Error starting transcription:', error);
      Alert.alert('Error', 'Failed to start transcription');
    }
  };

  const setupAudio = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone access is required for voice chat');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
      Alert.alert('Error', 'Failed to set up audio');
    }
  };

  async function startRecording() {
    try {
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          console.log('Recording status:', status);
        },
        100
      );
      setRecording(recording);
      setIsRecording(true);
      await recording.startAsync();
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  }

  async function stopRecording() {
    try {
      if (!recording) return;
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        await sendAudioToServer(uri);
      }
      setRecording(null);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  }

  async function sendAudioToServer(uri) {
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('audio', {
        uri: uri,
        type: 'audio/m4a',
        name: 'recording.m4a'
      });

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.voice}/process`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to process audio');
      }

      const data = await response.json();
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: data.transcription,
        type: 'user',
        timestamp: new Date().toISOString()
      }]);

      if (data.response) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          text: data.response,
          type: 'assistant',
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error sending audio to server:', error);
      Alert.alert('Error', 'Failed to process audio');
    } finally {
      setIsProcessing(false);
    }
  }

  async function playAudio(url) {
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  }

  async function togglePlayback(audioUri) {
    if (isPlaying) {
      await sound?.pauseAsync();
    } else {
      await sound?.playAsync();
    }
    setIsPlaying(!isPlaying);
  }

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a']}
        style={styles.gradient}
      >
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
                styles.messageBubble,
                message.type === 'user' ? styles.userMessage : styles.assistantMessage
              ]}
            >
              <Text style={styles.messageText}>{message.text}</Text>
              <Text style={styles.timestamp}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.recordButton}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            <Animated.View
              style={[
                styles.orb,
                {
                  transform: [{ scale: pulseAnim }],
                  backgroundColor: orbColorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#ff4444', '#ff0000']
                  })
                }
              ]}
            >
              <Text style={styles.recordButtonText}>
                {isRecording ? 'Stop' : 'Record'}
              </Text>
            </Animated.View>
          </TouchableOpacity>

          {isRecording && (
            <Text style={styles.duration}>
              {formatDuration(recordingDuration)}
            </Text>
          )}

          {isTranscribing && (
            <Text style={styles.transcribing}>
              {currentTranscription}
            </Text>
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  timestamp: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
    marginTop: 4,
  },
  controlsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  recordButton: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orb: {
    width: '100%',
    height: '100%',
    borderRadius: ORB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  duration: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 8,
  },
  transcribing: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
}); 