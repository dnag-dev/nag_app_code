from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import openai
import os
from dotenv import load_dotenv
import requests
import uuid
import aiofiles

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
dinakara_voice_id = os.getenv("DINAKARA_VOICE_ID")

app = FastAPI()
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
        # GPT-4 response
        client = openai.OpenAI()
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": user_input}]
        )
        message = completion.choices[0].message.content
        debug_output["gpt_response"] = message

        # Text to speech
        audio_url = await text_to_speech(message, debug_output)
        return {"response": message, "audio_url": audio_url, "debug": debug_output}

    except Exception as e:
        debug_output["error"] = str(e)
        return JSONResponse(status_code=500, content=debug_output)

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    debug_output = {}
    try:
        temp_file_path = f"temp_{uuid.uuid4().hex}.mp3"
        async with aiofiles.open(temp_file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)

        client = openai.OpenAI()
        with open(temp_file_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f
            )

        os.remove(temp_file_path)
        if transcript.text:
            return {"transcription": transcript.text}
        else:
            return JSONResponse(status_code=400, content={"error": "No transcription result"})

    except Exception as e:
        debug_output["error"] = str(e)
        return JSONResponse(status_code=500, content=debug_output)

async def text_to_speech(text, debug_output):
    filename = f"audio_{uuid.uuid4().hex}.mp3"
    output_path = f"static/{filename}"
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
        return f"/static/{filename}"
    else:
        debug_output["voice_error"] = response.text
        raise Exception(f"Voice generation failed: {response.text}")
