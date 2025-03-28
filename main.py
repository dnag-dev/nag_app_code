from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from openai import OpenAI
import os
import uuid
import requests

# Load environment variables
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
dinakara_voice_id = os.getenv("DINAKARA_VOICE_ID")

# Initialize OpenAI client (v1+)
client = OpenAI(api_key=openai_api_key)

app = FastAPI()

# Serve static files like index.html and audio
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def get_index():
    return FileResponse("static/index.html")


@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    user_input = body.get("message")

    debug_output = {}

    try:
        # OpenAI GPT-4 call using v1+ SDK
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": user_input}],
            temperature=0.7
        )
        message = response.choices[0].message.content.strip()
        debug_output["gpt_response"] = message

        # Generate speech using ElevenLabs
        audio_url = await text_to_speech(message, debug_output)
        return {"response": message, "audio_url": audio_url, "debug": debug_output}

    except Exception as e:
        debug_output["error"] = str(e)
        return JSONResponse(status_code=500, content=debug_output)


async def text_to_speech(text, debug_output):
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
    debug_output["voice_status_code"] = response.status_code

    if response.status_code == 200:
        with open(output_path, "wb") as f:
            f.write(response.content)
        debug_output["audio_file"] = output_path
        return f"/{output_path}"
    else:
        debug_output["voice_error"] = response.text
        raise Exception(f"Voice generation failed: {response.text}")
