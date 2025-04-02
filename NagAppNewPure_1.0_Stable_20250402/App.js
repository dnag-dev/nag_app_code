import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LandingScreen from './src/screens/LandingScreen';
import ChatScreen from './src/screens/ChatScreen';
import VoiceChatScreen from './src/screens/VoiceChatScreen';

// Initialize environment variables
if (!process.env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY is not set in environment variables');
}

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Landing"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1a1a1a',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            headerBackTitleVisible: false,
          }}
        >
          <Stack.Screen 
            name="Landing" 
            component={LandingScreen}
            options={{ 
              title: 'NagApp',
              headerLargeTitle: true,
            }}
          />
          <Stack.Screen 
            name="Chat" 
            component={ChatScreen}
            options={{ title: 'Text Chat' }}
          />
          <Stack.Screen 
            name="VoiceChat" 
            component={VoiceChatScreen}
            options={{ title: 'Voice Chat' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
} 