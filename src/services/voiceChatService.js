export const processVoiceChat = async (audioUri) => {
  try {
    console.log('Starting voice chat processing...');
    console.log('Audio URI:', audioUri);

    // First, transcribe the audio
    console.log('Transcribing audio...');
    const transcription = await transcribeAudio(audioUri);
    console.log('Transcription result:', transcription);

    if (!transcription || !transcription.text) {
      throw new Error('No transcription text received');
    }

    // Then, send the transcription to the chat API
    console.log('Sending transcription to chat API...');
    const chatResponse = await sendMessage(transcription.text);
    console.log('Chat API response:', JSON.stringify(chatResponse, null, 2));

    if (!chatResponse || !chatResponse.message) {
      throw new Error('No message received from chat API');
    }

    // Finally, convert the response to speech
    console.log('Converting response to speech...');
    const audioUrl = await textToSpeech(chatResponse.message);
    console.log('Generated audio URL:', audioUrl);

    return {
      transcription: transcription.text,
      response: chatResponse.message,
      audioUrl,
    };
  } catch (error) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      fullError: JSON.stringify(error, null, 2)
    };
    console.error('Error in processVoiceChat:', errorDetails);
    throw new Error(`Voice Chat Error: ${error.message}\nServer Response: ${JSON.stringify(error.response?.data, null, 2)}`);
  }
};

export const sendMessage = async (message) => {
  try {
    console.log('Sending message to chat API:', message);
    console.log('Using endpoint:', AZURE_API_ENDPOINTS.chat);
    
    const response = await axios.post(AZURE_API_ENDPOINTS.chat, {
      message,
      conversationId: currentConversationId,
    });

    console.log('Chat API response status:', response.status);
    console.log('Chat API response data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data,
        headers: error.config?.headers
      },
      fullError: JSON.stringify(error, null, 2)
    };
    console.error('Error in sendMessage:', errorDetails);
    throw new Error(`Chat API Error: ${error.message}\nServer Response: ${JSON.stringify(error.response?.data, null, 2)}`);
  }
}; 