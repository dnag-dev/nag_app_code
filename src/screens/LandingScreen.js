import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function LandingScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Voice Assistant</Text>
        <Text style={styles.subtitle}>Your AI Companion</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Choose your preferred way to interact:
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.voiceButton]}
          onPress={() => navigation.navigate('VoiceChat')}
        >
          <Text style={styles.buttonText}>Voice Chat</Text>
          <Text style={styles.buttonSubtext}>Talk naturally with AI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.textButton]}
          onPress={() => navigation.navigate('Chat')}
        >
          <Text style={styles.buttonText}>Text Chat</Text>
          <Text style={styles.buttonSubtext}>Type your messages</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  description: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  buttonSubtext: {
    color: '#fff',
    opacity: 0.8,
    fontSize: 14,
  },
}); 