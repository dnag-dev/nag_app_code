import React from 'react';
import {
  View,
  Text,
  Pressable,
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
        <Text style={styles.title}>Welcome to NagApp</Text>
        <Text style={styles.subtitle}>Your AI Voice Assistant</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Choose your preferred way to interact with our AI assistant:
        </Text>

        <Pressable
          style={[styles.button, styles.voiceButton]}
          onPress={() => navigation.navigate('VoiceChat')}
          android_ripple={null}
          pressable={false}
        >
          <Text style={styles.buttonText}>Voice Chat</Text>
          <Text style={styles.buttonSubtext}>Talk naturally with AI</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.textButton]}
          onPress={() => navigation.navigate('Chat')}
          android_ripple={null}
          pressable={false}
        >
          <Text style={styles.buttonText}>Text Chat</Text>
          <Text style={styles.buttonSubtext}>Type your messages</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Powered by OpenAI Technology
        </Text>
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
    marginTop: Platform.OS === 'ios' ? 20 : 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#888888',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  description: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    width: width - 40,
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  voiceButton: {
    backgroundColor: '#007AFF',
  },
  textButton: {
    backgroundColor: '#32CD32',
  },
  buttonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#888888',
  },
}); 