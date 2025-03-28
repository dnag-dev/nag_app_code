
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import openai
import os
from dotenv import load_dotenv
import requests
import uuid

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
dinakara_voice_id = os.getenv("DINAKARA_VOICE_ID")

app = FastAPI()

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def get_index():
    return FileResponse("static/index.html")

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    user_input = body.get("message")

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "user", "content": user_input}]
        )
        message = response["choices"][0]["message"]["content"]
        audio_url = await text_to_speech(message)
        return {"response": message, "audio_url": audio_url}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

async def text_to_speech(text):
    output_path = f"static/audio_{uuid.uuid4().hex}.mp3"
    endpoint = f"https://api.elevenlabs.io/v1/text-to-speech/{dinakara_voice_id}"
    headers = {
        "xi-api-key": elevenlabs_api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "text": text,
        "voice_settings": {
            "stability": 0.45,
            "similarity_boost": 0.85
        }
    }
    response = requests.post(endpoint, json=payload, headers=headers)
    if response.status_code == 200:
        with open(output_path, "wb") as f:
            f.write(response.content)
        return f"/{output_path}"
    else:
        raise Exception(f"Voice generation failed: {response.text}")
