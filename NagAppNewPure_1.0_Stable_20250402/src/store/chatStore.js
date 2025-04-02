import { create } from 'zustand';

const useChatStore = create((set) => ({
  messages: [],
  isRecording: false,
  isProcessing: false,
  isPlaying: false,
  currentTranscription: '',
  
  // Message actions
  addMessage: (message) => set((state) => ({
    messages: state.messages.filter(m => !m.isStreaming).concat(message)
  })),
  
  clearMessages: () => set({ messages: [] }),
  
  // Recording state actions
  setIsRecording: (isRecording) => set({ isRecording }),
  
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  
  // Transcription actions
  setCurrentTranscription: (currentTranscription) => set({ currentTranscription }),
  
  clearTranscription: () => set({ currentTranscription: '' }),
}));

export default useChatStore; 