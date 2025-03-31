import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, SafeAreaView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function LandingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to Nag</Text>
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
              onPress={() => navigation.navigate('Chat')}
            >
              <Text style={styles.buttonText}>Text Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.voiceButton]}
              onPress={() => navigation.navigate('VoiceChat')}
            >
              <Text style={styles.buttonText}>Voice Chat</Text>
            </TouchableOpacity>
          </View>
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
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    color: '#007AFF',
    marginBottom: 30,
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
    marginBottom: 40,
  },
  button: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  chatButton: {
    backgroundColor: '#007AFF',
  },
  voiceButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 