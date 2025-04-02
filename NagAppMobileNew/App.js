import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from './src/config/api';

export default function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [sound, setSound] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

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
      await recording.startAsync();
    } catch (err) {
      Alert.alert('Failed to start recording', err.message);
    }
  }

  async function stopRecording() {
    if (!recording) return;
    
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      // Send the audio file to the server
      await sendAudioToServer(uri);
    } catch (err) {
      Alert.alert('Failed to stop recording', err.message);
    }
  }

  async function sendAudioToServer(uri) {
    try {
      setIsLoading(true);
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
      
      // Add user's audio message
      const userMessage = { 
        text: "🎤 [Voice Message]", 
        sender: 'user',
        audioUri: uri 
      };
      setMessages(prev => [...prev, userMessage]);

      // Add bot's response
      const botMessage = { 
        text: data.response, 
        sender: 'bot',
        audioUri: data.audio_url 
      };
      setMessages(prev => [...prev, botMessage]);

      // Play the bot's response
      if (data.audio_url) {
        await playAudio(data.audio_url);
      }
    } catch (error) {
      console.error('Error sending audio:', error);
      Alert.alert('Error', 'Failed to process voice message');
    } finally {
      setIsLoading(false);
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
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio response');
    }
  }

  async function sendMessage() {
    if (!message.trim()) return;

    try {
      setIsLoading(true);
      const userMessage = { text: message, sender: 'user' };
      setMessages(prev => [...prev, userMessage]);
      setMessage('');

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();
      const botMessage = { text: data.response, sender: 'bot' };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <FlatList
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={[
            styles.messageContainer,
            item.sender === 'user' ? styles.userMessage : styles.botMessage
          ]}>
            <Text style={styles.messageText}>{item.text}</Text>
            {item.audioUri && (
              <TouchableOpacity
                style={styles.audioButton}
                onPress={() => playAudio(item.audioUri)}
              >
                <Text style={styles.audioButtonText}>🔊 Play</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        style={styles.messagesList}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          placeholderTextColor="#666"
          multiline
        />
        <TouchableOpacity
          style={styles.recordButton}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? '⏹️ Stop' : '🎤 Record'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendMessage}
          disabled={isLoading}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesList: {
    flex: 1,
    padding: 10,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
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
    color: '#000',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  recordButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 20,
    paddingHorizontal: 15,
    justifyContent: 'center',
    marginRight: 10,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  audioButton: {
    marginTop: 5,
    padding: 5,
  },
  audioButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
});
