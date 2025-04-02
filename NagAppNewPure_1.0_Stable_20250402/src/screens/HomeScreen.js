import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
  ScrollView,
} from 'react-native';
import AudioService from '../services/AudioService';
import { AZURE_API_BASE_URL } from '../config/azureApi';

const HomeScreen = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const audioService = useRef(null);

  useEffect(() => {
    initializeAudioService();
    return () => {
      if (audioService.current) {
        audioService.current.cleanup();
      }
    };
  }, []);

  const initializeAudioService = async () => {
    try {
      audioService.current = AudioService;
      await audioService.current.initializeComponents();
      
      // Set up callbacks
      audioService.current.onTranscription = (text) => {
        setTranscription(text);
      };
      
      audioService.current.onAudioLevel = (level) => {
        setAudioLevel(level);
      };
      
      console.log('Audio service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio service:', error);
      setError('Failed to initialize audio service. Please restart the app.');
    }
  };

  const startRecording = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      await audioService.current.startRecording();
      setIsRecording(true);
      startPulseAnimation();
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to start recording. Please try again.');
      setIsRecording(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopRecording = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      stopPulseAnimation();
      
      // Use the new stopAll method to handle both voice recognition and recording
      console.log('Stopping all audio services...');
      const audioPath = await audioService.current.stopAll();
      
      if (!audioPath) {
        console.error('No audio path available');
        setError('Failed to get audio recording. Please try again.');
        return;
      }
      
      console.log('Audio recording successful, path:', audioPath);
      
      // Get the transcription from the current state
      if (!transcription) {
        console.error('No transcription available');
        setError('Failed to get transcription. Please try again.');
        return;
      }
      
      console.log('Transcription available:', transcription);
      
      // Process the recording with Azure and ElevenLabs
      await processWithElevenLabs(audioPath);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError('Failed to stop recording. Please try again.');
    } finally {
      setIsRecording(false);
      setIsProcessing(false);
    }
  };

  const getAIResponse = async (text) => {
    try {
      console.log('Sending request to Azure API for AI response:', text);
      const response = await fetch(`${AZURE_API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
        }),
      });

      console.log('Azure API response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Azure API error:', errorData);
        throw new Error(`Failed to get AI response: ${response.status}`);
      }

      const data = await response.json();
      console.log('Azure API response data:', data);
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Failed to get AI response:', error);
      throw new Error('Failed to get AI response');
    }
  };

  const processWithElevenLabs = async (audioPath) => {
    try {
      setIsProcessing(true);
      setError(null);
      
      console.log('Getting AI response for transcription:', transcription);
      // First, get AI response
      const aiResponse = await getAIResponse(transcription);
      console.log('Received AI response:', aiResponse);
      setAiResponse(aiResponse);
      
      // Then, convert AI response to speech using ElevenLabs
      console.log('Sending request to ElevenLabs API');
      const elevenLabsResponse = await fetch(`${AZURE_API_BASE_URL}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: aiResponse,
          voice_id: 'q8zvC54CbAAB0lZViZqT', // Using your voice ID from .env
          model_id: 'eleven_monolingual_v1',
        }),
      });

      console.log('ElevenLabs API response status:', elevenLabsResponse.status);
      
      if (!elevenLabsResponse.ok) {
        const errorData = await elevenLabsResponse.json().catch(() => ({}));
        console.error('ElevenLabs API error:', errorData);
        throw new Error(`Failed to convert text to speech: ${elevenLabsResponse.status}`);
      }

      const audioBlob = await elevenLabsResponse.blob();
      console.log('Received audio blob from ElevenLabs, size:', audioBlob.size);
      
      // Create a temporary URL for the blob
      const audioUrl = URL.createObjectURL(audioBlob);
      console.log('Created URL for audio blob:', audioUrl);
      
      try {
        await audioService.current.playAudio(audioBlob);
        console.log('Playing audio response');
      } catch (error) {
        console.error('Failed to play audio:', error);
        throw new Error('Failed to play audio response');
      } finally {
        // Clean up the temporary URL
        URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      console.error('Failed to process with ElevenLabs:', error);
      setError('Failed to process audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startPulseAnimation = () => {
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
  };

  const stopPulseAnimation = () => {
    pulseAnim.setValue(1);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.transcriptionContainer}>
          <Text style={styles.label}>Your Message:</Text>
          <Text style={styles.transcription}>{transcription || 'Start speaking...'}</Text>
        </View>

        <View style={styles.responseContainer}>
          <Text style={styles.label}>AI Response:</Text>
          <Text style={styles.response}>{aiResponse || 'Waiting for response...'}</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.controls}>
        <Animated.View style={[styles.recordButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordingButton,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.microphoneIcon}>
                <View style={[styles.micWave, { height: audioLevel * 2 }]} />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  transcriptionContainer: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  responseContainer: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  transcription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  response: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF0000',
    fontSize: 14,
  },
  controls: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  recordButtonContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  microphoneIcon: {
    width: 30,
    height: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  micWave: {
    width: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
});

export default HomeScreen; 