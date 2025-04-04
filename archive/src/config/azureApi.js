// Azure API Configuration
export const AZURE_API_BASE_URL = 'https://nag-app-new.azurewebsites.net';

console.log('AZURE_API_BASE_URL:', AZURE_API_BASE_URL);

export const AZURE_API_ENDPOINTS = {
  chat: `${AZURE_API_BASE_URL}/chat`,
  transcribe: `${AZURE_API_BASE_URL}/transcribe`,
  textToSpeech: `${AZURE_API_BASE_URL}/text-to-speech`,
  health: `${AZURE_API_BASE_URL}/health`,
};

export const AZURE_API_HEADERS = {
  'Content-Type': 'application/json',
};

// API error messages
export const AZURE_API_ERRORS = {
  NO_API_URL: 'Azure API URL not configured. Please check your .env file.',
  INVALID_RESPONSE: 'Invalid response from Azure API',
  NETWORK_ERROR: 'Network error occurred while calling Azure API',
  TRANSCRIPTION_ERROR: 'Error transcribing audio',
  SPEECH_ERROR: 'Error generating speech',
}; 