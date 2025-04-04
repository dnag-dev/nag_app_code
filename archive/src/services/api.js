import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const chatService = {
  sendMessage: async (message) => {
    try {
      const response = await api.post(API_ENDPOINTS.chat, { message });
      return response.data;
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  },
};

export const uploadService = {
  uploadAudio: async (audioFile) => {
    try {
      const formData = new FormData();
      formData.append('file', audioFile);
      
      const response = await api.post(API_ENDPOINTS.upload, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  },
}; 