import requests
import json
import time
import os

class NagLocalClient:
    def __init__(self, base_url="http://127.0.0.1:9000"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def send_message(self, message):
        """Send a message to the chat endpoint"""
        try:
            print(f"\nSending message: {message}")
            response = self.session.post(
                f"{self.base_url}/chat",
                json={"message": message}
            )
            
            if response.status_code == 200:
                data = response.json()
                print("\nResponse:")
                print(f"Text: {data.get('response', 'No response text')}")
                if 'audio_url' in data:
                    print(f"Audio URL: {data['audio_url']}")
                if 'debug' in data:
                    print("\nDebug info:")
                    print(json.dumps(data['debug'], indent=2))
            else:
                print(f"Error: {response.status_code}")
                print(response.text)
                
        except Exception as e:
            print(f"Error sending message: {str(e)}")

def main():
    client = NagLocalClient()
    
    print("=== Nag Local Client ===")
    print("Type 'quit' to exit")
    print("Type 'test' to send a test message")
    
    while True:
        message = input("\nEnter your message: ").strip()
        
        if message.lower() == 'quit':
            break
        elif message.lower() == 'test':
            message = "Hi, this is a test message"
        
        if message:
            client.send_message(message)
            time.sleep(1)  # Small delay between messages

if __name__ == "__main__":
    main() 