import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import LandingScreen from './src/screens/LandingScreen';
import ChatScreen from './src/screens/ChatScreen';
import VoiceChatScreen from './src/screens/VoiceChatScreen';

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Landing">
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="VoiceChat" component={VoiceChatScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App; 