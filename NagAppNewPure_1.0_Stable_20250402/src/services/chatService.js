import { Platform } from 'react-native';
import {
  AZURE_API_ENDPOINTS,
  AZURE_API_HEADERS,
  AZURE_API_ERRORS,
} from '../config/azureApi';
import { AZURE_API_URL } from '@env';

class ChatService {
  constructor() {
    if (!AZURE_API_URL) {
      console.error('Azure API URL not configured');
    }
  }

  async streamChatCompletion(messages, onToken, onError, onComplete) {
    try {
      if (!AZURE_API_URL) {
        throw new Error(AZURE_API_ERRORS.NO_API_URL);
      }

      const latestUserMessage = messages
        .filter(msg => msg.role === 'user')
        .pop();

      if (!latestUserMessage) {
        throw new Error('No user message found in messages array');
      }

      console.log('Starting chat completion with message:', latestUserMessage.content);
      console.log('Using endpoint:', AZURE_API_ENDPOINTS.chat);

      const requestBody = {
        message: latestUserMessage.content,
        request_id: Date.now().toString()
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(AZURE_API_ENDPOINTS.chat, {
        method: 'POST',
        headers: {
          ...AZURE_API_HEADERS,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Chat response status:', response.status);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
          errorDetails = JSON.stringify(errorData, null, 2);
          console.error('Server error details:', errorData);
        } catch (e) {
          try {
            errorDetails = await response.text();
            console.error('Raw error response:', errorDetails);
          } catch (textError) {
            console.error('Failed to get error response text:', textError);
          }
        }

        if (response.status === 502) {
          throw new Error('Server is temporarily unavailable. Please try again in a few moments.');
        }

        throw new Error(`${errorMessage}\nServer Response: ${errorDetails}`);
      }

      const data = await response.json();
      console.log('Chat response data:', JSON.stringify(data, null, 2));

      if (data.response) {
        onToken(data.response);
        onComplete(data);
      } else if (data.message) {
        onToken(data.message);
        onComplete(data);
      } else {
        throw new Error('No response content received from server');
      }
    } catch (error) {
      console.error('Error in streamChatCompletion:', error);
      onError(error);
    }
  }

  async transcribeAudio(audioUri) {
    try {
      if (!AZURE_API_URL) {
        throw new Error(AZURE_API_ERRORS.NO_API_URL);
      }

      console.log('Starting audio transcription for:', audioUri);
      console.log('Using endpoint:', AZURE_API_ENDPOINTS.transcribe);

      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      });

      console.log('Sending transcription request...');
      const response = await fetch(AZURE_API_ENDPOINTS.transcribe, {
        method: 'POST',
        headers: {
          ...AZURE_API_HEADERS,
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('Transcription response status:', response.status);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
          console.error('Server error details:', errorData);
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Transcription response data:', JSON.stringify(data, null, 2));

      // Try different possible response formats
      let transcriptionText = null;
      
      if (typeof data === 'string') {
        transcriptionText = data;
      } else if (data.text) {
        transcriptionText = data.text;
      } else if (data.transcription) {
        transcriptionText = data.transcription;
      } else if (data.result) {
        transcriptionText = data.result;
      } else if (data.message) {
        transcriptionText = data.message;
      } else if (Array.isArray(data) && data.length > 0) {
        transcriptionText = data[0].text || data[0].transcription || data[0].result || data[0].message;
      }

      if (!transcriptionText || typeof transcriptionText !== 'string') {
        console.error('Invalid transcription response format:', data);
        throw new Error('Invalid transcription response format. Response: ' + JSON.stringify(data));
      }

      return transcriptionText;
    } catch (error) {
      console.error('Error in transcribeAudio:', error);
      throw error;
    }
  }

  async generateSpeech(text) {
    try {
      if (!AZURE_API_URL) {
        throw new Error(AZURE_API_ERRORS.NO_API_URL);
      }

      console.log('Generating speech for text:', text);
      console.log('Using endpoint:', AZURE_API_ENDPOINTS.textToSpeech);

      const response = await fetch(AZURE_API_ENDPOINTS.textToSpeech, {
        method: 'POST',
        headers: {
          ...AZURE_API_HEADERS,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text,
          request_id: Date.now().toString()
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
          console.error('Server error details:', errorData);
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Text-to-speech response:', JSON.stringify(data, null, 2));

      if (data.error) {
        throw new Error(`Server returned error: ${JSON.stringify(data.error)}`);
      }

      if (!data.audio_url) {
        throw new Error('No audio URL received from server');
      }

      return data.audio_url;
    } catch (error) {
      console.error('Error in generateSpeech:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw error;
    }
  }
}

export default new ChatService(); 