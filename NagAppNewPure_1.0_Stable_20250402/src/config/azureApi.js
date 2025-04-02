import { AZURE_API_URL } from '@env';

// Azure API Configuration
export const AZURE_API_BASE_URL = AZURE_API_URL || 'https://nag-app-new.azurewebsites.net';

export const AZURE_API_ENDPOINTS = {
  chat: `${AZURE_API_BASE_URL}/chat`,
  transcribe: `${AZURE_API_BASE_URL}/transcribe`,
  textToSpeech: `${AZURE_API_BASE_URL}/text-to-speech`,
  health: `${AZURE_API_BASE_URL}/health`,
};

export const AZURE_API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// API error messages
export const AZURE_API_ERRORS = {
  NO_API_URL: 'Azure API URL not configured. Please check your .env file.',
  INVALID_RESPONSE: 'Invalid response from Azure API',
  NETWORK_ERROR: 'Network error occurred while calling Azure API',
  TRANSCRIPTION_ERROR: 'Error transcribing audio',
  SPEECH_ERROR: 'Error generating speech',
  HEALTH_CHECK_FAILED: 'Health check failed - API may be unavailable',
  SERVER_ERROR: 'Server error occurred - please try again later',
};

// Health check configuration
export const HEALTH_CHECK_CONFIG = {
  timeout: 5000, // 5 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
};

// Helper function to check API health
export const checkApiHealth = async () => {
  try {
    const response = await fetch(AZURE_API_ENDPOINTS.health, {
      method: 'GET',
      headers: AZURE_API_HEADERS,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        status: 'error',
        message: errorData.error?.message || `Health check failed with status ${response.status}`,
        details: errorData
      };
    }

    const data = await response.json();
    return {
      status: 'connected',
      message: 'API is healthy',
      details: data
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message || 'Failed to connect to API',
      details: error
    };
  }
}; 