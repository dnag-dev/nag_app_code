import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Dimensions, SafeAreaView, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../config/api';

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
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, []);

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

      // Simulate transcription (replace with actual transcription API)
      setIsTranscribing(true);
      simulateTranscription();
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

  const simulateTranscription = () => {
    const phrases = [
      "I understand what you're saying...",
      "Let me process that...",
      "That's interesting...",
      "I'm listening...",
      "Please continue..."
    ];
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      if (!isRecording) {
        clearInterval(interval);
        return;
      }
      
      setCurrentTranscription(prev => {
        const newPhrase = phrases[currentIndex];
        currentIndex = (currentIndex + 1) % phrases.length;
        return prev ? `${prev}\n${newPhrase}` : newPhrase;
      });
    }, 2000);
  };

  const setupAudio = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (err) {
      console.error('Audio setup failed:', err);
    }
  };

  async function startRecording() {
    try {
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      await recording.startAsync();
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }

  async function stopRecording() {
    if (!recording) return;
    
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      if (recordingDuration < 1) {
        return;
      }

      setIsProcessing(true);
      await sendAudioToServer(uri);
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  }

  async function sendAudioToServer(uri) {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      });

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      const userMessage = { 
        text: `🎤 [Voice Message - ${formatDuration(recordingDuration)}]`, 
        sender: 'user',
        audioUri: uri,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);

      const botMessage = { 
        text: data.response, 
        sender: 'bot',
        audioUri: data.audio_url,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, botMessage]);

      if (data.audio_url) {
        await playAudio(data.audio_url);
      }
    } catch (error) {
      console.error('Error sending audio:', error);
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

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  async function togglePlayback(audioUri) {
    if (isPlaying) {
      await sound?.pauseAsync();
    } else {
      await playAudio(audioUri);
    }
  }

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const orbColors = orbColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#007AFF', '#FF3B30']
  });

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesListContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.message,
                message.sender === 'user' ? styles.userMessage : styles.botMessage
              ]}
            >
              <Text style={styles.messageText}>{message.text}</Text>
              {message.audioUri && (
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={() => togglePlayback(message.audioUri)}
                >
                  <Text style={styles.audioButtonText}>
                    {isPlaying ? '⏸️ Pause' : '🔊 Play'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.orbContainer}>
          <Animated.View
            style={[
              styles.orb,
              {
                transform: [
                  { scale: pulseAnim },
                  { scale: orbScaleAnim }
                ],
                backgroundColor: orbColors
              }
            ]}
          >
            <TouchableOpacity
              style={styles.orbButton}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
            >
              <Text style={styles.orbButtonText}>
                {isProcessing ? 'Processing...' : isRecording ? 'Stop' : 'Start'}
              </Text>
              {isRecording && (
                <Text style={styles.durationText}>
                  {formatDuration(recordingDuration)}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {isTranscribing && (
            <View style={styles.transcriptionContainer}>
              <Text style={styles.transcriptionText}>
                {currentTranscription}
              </Text>
            </View>
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
  messagesListContent: {
    padding: 16,
  },
  message: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
  },
  audioButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  audioButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  orbContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  orbButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  durationText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 8,
  },
  transcriptionContainer: {
    width: '100%',
    padding: 16,
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    maxHeight: 150,
  },
  transcriptionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
}); 