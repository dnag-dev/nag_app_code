from fastapi import FastAPI, Request, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from openai import OpenAI
import os
from dotenv import load_dotenv
import requests
import uuid
import aiofiles
import logging
from datetime import datetime
import hashlib
import json
from pathlib import Path
import asyncio
from functools import lru_cache
import time

# Logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment
load_dotenv()
client = OpenAI()
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
dinakara_voice_id = os.getenv("DINAKARA_VOICE_ID")
CACHE_DURATION = int(os.getenv("CACHE_DURATION", "3600"))
MAX_AUDIO_AGE = int(os.getenv("MAX_AUDIO_AGE", "86400"))

if not all([client.api_key, elevenlabs_api_key, dinakara_voice_id]):
    raise RuntimeError("Missing required environment variables.")

# App Init
app = FastAPI(title="Nag - Digital Therapist", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.mount("/static", StaticFiles(directory="static"), name="static")
os.makedirs("static", exist_ok=True)

@lru_cache(maxsize=1000)
def get_cached_gpt_response(message_hash: str) -> str | None:
    try:
        cache_file = Path("cache/gpt_responses.json")
        if cache_file.exists():
            with open(cache_file, "r") as f:
                return json.load(f).get(message_hash)
    except Exception as e:
        logger.error(f"Cache read error: {e}")
    return None

def cache_gpt_response(message_hash: str, response: str):
    try:
        cache_file = Path("cache/gpt_responses.json")
        cache_file.parent.mkdir(exist_ok=True)
        cache = {}
        if cache_file.exists():
            with open(cache_file, "r") as f:
                cache = json.load(f)
        cache[message_hash] = response
        with open(cache_file, "w") as f:
            json.dump(cache, f)
    except Exception as e:
        logger.error(f"Cache write error: {e}")

def cleanup_old_audio_files():
    try:
        current_time = time.time()
        for file in os.listdir("static"):
            if file.startswith("audio_"):
                path = os.path.join("static", file)
                if current_time - os.path.getctime(path) > MAX_AUDIO_AGE:
                    os.remove(path)
                    logger.info(f"Deleted old file: {file}")
    except Exception as e:
        logger.error(f"Cleanup error: {e}")

@app.get("/")
async def serve_index():
    return FileResponse("static/index.html")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "time": datetime.now().isoformat()}

@app.post("/chat")
async def chat(request: Request, background_tasks: BackgroundTasks):
    request_id = str(uuid.uuid4())
    try:
        data = await request.json()
        message = data.get("message", "").strip()

        if not message:
            return JSONResponse(status_code=400, content={"error": "Empty message."})

        message_hash = hashlib.md5(message.encode()).hexdigest()
        cached = get_cached_gpt_response(message_hash)

        if cached:
            logger.info(f"Using cached response for: {message_hash}")
            final_response = cached
        else:
            completion = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are Nag, the digital extension of Dinakara Nagalla’s mind — therapist, companion, unfiltered mirror. Speak with soul, depth, and edge. Feel deeply, think boldly."},
                    {"role": "user", "content": message}
                ]
            )
            final_response = completion.choices[0].message.content
            cache_gpt_response(message_hash, final_response)

        audio_url = await text_to_speech(final_response, request_id)
        background_tasks.add_task(cleanup_old_audio_files)

        return {
            "response": final_response,
            "audio_url": audio_url,
            "request_id": request_id,
            "cached": bool(cached)
        }

    except Exception as e:
        logger.exception("Chat processing failed")
        return JSONResponse(status_code=500, content={
            "response": "",
            "audio_url": "",
            "error": str(e),
            "request_id": request_id
        })

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    request_id = str(uuid.uuid4())
    try:
        if not file.filename.endswith((".webm", ".mp3", ".wav", ".m4a")):
            return JSONResponse(status_code=400, content={"error": "Unsupported file type", "request_id": request_id})

        temp_path = f"temp_{request_id}.webm"
        async with aiofiles.open(temp_path, 'wb') as out:
            await out.write(await file.read())

        with open(temp_path, "rb") as audio:
            transcript = client.audio.transcriptions.create(model="whisper-1", file=audio)

        os.remove(temp_path)
        return {
            "transcription": getattr(transcript, "text", "") or "undefined",
            "request_id": request_id
        }

    except Exception as e:
        logger.exception("Transcription failed")
        return JSONResponse(status_code=500, content={
            "transcription": "undefined",
            "error": str(e),
            "request_id": request_id
        })

async def text_to_speech(text: str, request_id: str) -> str:
    try:
        output_path = f"static/audio_{request_id}.mp3"
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

        for attempt in range(3):
            try:
                response = requests.post(endpoint, headers=headers, json=payload)
                response.raise_for_status()
                with open(output_path, "wb") as f:
                    f.write(response.content)
                return output_path
            except requests.RequestException as e:
                logger.warning(f"Retry {attempt + 1}/3 failed: {e}")
                await asyncio.sleep(1)

        raise RuntimeError("Voice generation failed after retries.")

    except Exception as e:
        logger.exception("Voice generation error")
        raise HTTPException(status_code=500, detail="Voice synthesis error")
