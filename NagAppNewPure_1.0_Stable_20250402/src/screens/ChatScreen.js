import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useChatStore from '../store/chatStore';
import chatService from '../services/chatService';

export default function ChatScreen() {
  const navigation = useNavigation();
  const inputRef = useRef(null);
  const flatListRef = useRef(null);
  const [inputText, setInputText] = React.useState('');
  const { 
    messages,
    addMessage,
    isProcessing,
    setIsProcessing
  } = useChatStore();

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable 
          onPress={() => navigation.navigate('VoiceChat')}
          style={styles.headerButton}
          android_ripple={null}
          pressable={false}
        >
          <Text style={styles.headerButtonText}>🎤</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const handleSend = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage = {
      id: Date.now(),
      text: inputText.trim(),
      type: 'user',
      timestamp: new Date().toISOString()
    };

    addMessage(userMessage);
    setInputText('');
    setIsProcessing(true);

    try {
      let assistantResponse = '';
      
      await chatService.streamChatCompletion(
        [
          { role: 'system', content: 'You are a helpful AI assistant.' },
          ...messages.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.text
          })),
          { role: 'user', content: userMessage.text }
        ],
        (token) => {
          assistantResponse += token;
          addMessage({
            id: Date.now(),
            text: assistantResponse,
            type: 'assistant',
            timestamp: new Date().toISOString(),
            isStreaming: true
          });
        },
        (error) => {
          console.error('Error in chat:', error);
          addMessage({
            id: Date.now(),
            text: 'Sorry, there was an error processing your request.',
            type: 'assistant',
            timestamp: new Date().toISOString()
          });
        },
        () => {
          addMessage({
            id: Date.now(),
            text: assistantResponse,
            type: 'assistant',
            timestamp: new Date().toISOString()
          });
        }
      );
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderMessage = ({ item, index }) => (
    <View style={[
      styles.messageBubble,
      item.type === 'user' ? styles.userMessage : styles.assistantMessage
    ]}>
      <Text style={styles.messageText}>{item.text}</Text>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
        />

        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor="#666"
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
          />
          <Pressable
            style={[
              styles.sendButton,
              (!inputText.trim() || isProcessing) && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isProcessing}
            android_ripple={null}
            pressable={false}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  messageList: {
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
    backgroundColor: '#333',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#2a2a2a',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    marginRight: 8,
    color: '#fff',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#555',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  headerButton: {
    marginRight: 16,
  },
  headerButtonText: {
    fontSize: 24,
  },
}); 