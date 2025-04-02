import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, SafeAreaView, Dimensions, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL, API_ENDPOINTS, API_HEADERS } from '../config/api';

const { width } = Dimensions.get('window');

export default function LandingScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(false);
  const [userSettings, setUserSettings] = useState(null);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.settings}`, {
        headers: API_HEADERS
      });
      if (response.ok) {
        const data = await response.json();
        setUserSettings(data);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      Alert.alert('Error', 'Failed to load user settings');
    }
  };

  const handleStartChat = () => {
    navigation.navigate('Chat');
  };

  const handleStartVoiceChat = () => {
    navigation.navigate('VoiceChat');
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to NagApp</Text>
            <Text style={styles.subtitle}>Your AI Assistant</Text>
          </View>

          <View style={styles.introContainer}>
            <Text style={styles.introText}>
              Nag is your intelligent companion, ready to help you with any task. 
              Whether you prefer typing or speaking, Nag is here to assist you.
            </Text>
          </View>

          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>Features</Text>
            <View style={styles.featureItem}>
              <Text style={styles.featureText}>• Natural Language Understanding</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureText}>• Voice Recognition & Response</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureText}>• Real-time Conversations</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureText}>• Contextual Responses</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.chatButton]}
              onPress={handleStartChat}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Start Text Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.voiceButton]}
              onPress={handleStartVoiceChat}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Start Voice Chat</Text>
            </TouchableOpacity>
          </View>

          {userSettings && (
            <View style={styles.settingsContainer}>
              <Text style={styles.settingsTitle}>Your Settings</Text>
              <Text style={styles.settingsText}>
                Language: {userSettings.language}
              </Text>
              <Text style={styles.settingsText}>
                Theme: {userSettings.theme}
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#CCCCCC',
    marginBottom: 40,
  },
  introContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
  },
  introText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
    textAlign: 'center',
  },
  featuresContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 10,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 20,
  },
  button: {
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButton: {
    backgroundColor: '#007AFF',
  },
  voiceButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  settingsContainer: {
    marginTop: 40,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    width: '100%',
    maxWidth: 300,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  settingsText: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 5,
  },
}); 