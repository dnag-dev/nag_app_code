import { OPENAI_API_KEY, ELEVENLABS_API_KEY, DINAKARA_VOICE_ID } from '@env';
import OpenAI from 'openai';

// OpenAI client configuration
export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// OpenAI API Configuration
export const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';
export const OPENAI_API_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${OPENAI_API_KEY}`,
};

// ElevenLabs API Configuration
export const ELEVENLABS_API_BASE_URL = 'https://api.elevenlabs.io/v1';
export const ELEVENLABS_API_HEADERS = {
  'Content-Type': 'application/json',
  'xi-api-key': ELEVENLABS_API_KEY,
};

// Chat Configuration
export const CHAT_CONFIG = {
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  max_tokens: 1000,
  presence_penalty: 0.6,
  frequency_penalty: 0.5,
};

// Whisper Configuration
export const WHISPER_CONFIG = {
  model: 'whisper-1',
  language: 'en',
  temperature: 0,
  response_format: 'json',
};

// Text-to-Speech Configuration
export const TTS_CONFIG = {
  // ElevenLabs Configuration
  elevenlabs: {
    voice_id: DINAKARA_VOICE_ID,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
    }
  },
  // OpenAI TTS Configuration (fallback)
  openai: {
    model: 'tts-1',
    voice: 'alloy',
    speed: 1,
    response_format: 'mp3',
  }
};

// API error messages
export const API_ERRORS = {
  NO_API_KEY: 'OpenAI API key not configured. Please check your .env file.',
  INVALID_RESPONSE: 'Invalid response from OpenAI API',
  NETWORK_ERROR: 'Network error occurred while calling OpenAI API',
  TRANSCRIPTION_ERROR: 'Error transcribing audio',
  SPEECH_ERROR: 'Error generating speech',
}; 