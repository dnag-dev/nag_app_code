from fastapi import FastAPI
import openai

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Welcome to Nag Backend!"}

@app.post("/chat")
def chat_with_nag(message: str):
    # Sample OpenAI call
    openai.api_key = "your-openai-api-key"
    response = openai.Completion.create(
        model="text-davinci-003",
        prompt=message,
        max_tokens=150
    )
    return {"response": response.choices[0].text.strip()}
