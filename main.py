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

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

client = OpenAI()
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
dinakara_voice_id = os.getenv("DINAKARA_VOICE_ID")
CACHE_DURATION = int(os.getenv("CACHE_DURATION", "3600"))
MAX_AUDIO_AGE = int(os.getenv("MAX_AUDIO_AGE", "86400"))

if not all([client.api_key, elevenlabs_api_key, dinakara_voice_id]):
    raise ValueError("Missing required environment variables")

app = FastAPI(
    title="Nag - Digital Therapist",
    description="A digital extension of Dinakara's mind — therapist, companion, unfiltered mirror.",
    version="1.0.0"
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.mount("/static", StaticFiles(directory="static"), name="static")
os.makedirs("static", exist_ok=True)

@lru_cache(maxsize=1000)
def get_cached_gpt_response(message_hash: str) -> str | None:
    cache_file = Path("cache/gpt_responses.json")
    if cache_file.exists():
        try:
            with open(cache_file, "r") as f:
                return json.load(f).get(message_hash)
        except Exception as e:
            logger.error(f"Cache read error: {e}")
    return None

def cache_gpt_response(message_hash: str, response: str):
    cache_file = Path("cache/gpt_responses.json")
    cache_file.parent.mkdir(exist_ok=True)
    try:
        cache = {}
        if cache_file.exists():
            with open(cache_file, "r") as f:
                cache = json.load(f)
        cache[message_hash] = response
        with open(cache_file, "w") as f:
            json.dump(cache, f)
    except Exception as e:
        logger.error(f"Cache write error: {e}")

def cleanup_old_audio_files(max_age_seconds=MAX_AUDIO_AGE):
    try:
        current_time = time.time()
        for filename in os.listdir("static"):
            if filename.startswith("audio_"):
                path = os.path.join("static", filename)
                if current_time - os.path.getctime(path) > max_age_seconds:
                    os.remove(path)
    except Exception as e:
        logger.error(f"Audio cleanup error: {e}")

async def cleanup_background(background_tasks: BackgroundTasks):
    background_tasks.add_task(cleanup_old_audio_files)

@app.get("/")
async def get_index():
    return FileResponse("static/index.html")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/chat")
async def chat(request: Request, background_tasks: BackgroundTasks):
    request_id = str(uuid.uuid4())
    try:
        body = await request.json()
        user_input = body.get("message", "").strip()

        if not user_input:
            return JSONResponse(status_code=400, content={"error": "Empty message."})

        message_hash = hashlib.md5(user_input.encode()).hexdigest()
        cached = get_cached_gpt_response(message_hash)

        if cached:
            message = cached
        else:
            completion = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are Nag, the digital extension of Dinakara Nagalla’s mind — therapist, companion, unfiltered mirror. Speak with emotion, empathy, soul, and boldness. Always sound like you're thinking like Dinakara."},
                    {"role": "user", "content": user_input}
                ]
            )
            message = completion.choices[0].message.content
            cache_gpt_response(message_hash, message)

        audio_url = await text_to_speech(message, request_id)
        await cleanup_background(background_tasks)

        return {
            "response": message,
            "audio_url": audio_url,
            "request_id": request_id,
            "cached": bool(cached)
        }

    except Exception as e:
        logger.exception("Chat error")
        return JSONResponse(status_code=500, content={"response": "", "audio_url": "", "error": str(e)})

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    request_id = str(uuid.uuid4())

    try:
        if not file.filename.endswith((".mp3", ".wav", ".m4a", ".webm")):
            return JSONResponse(status_code=400, content={
                "transcription": "undefined",
                "error": "Unsupported format",
                "request_id": request_id
            })

        temp_file = f"temp_{request_id}.mp3"
        async with aiofiles.open(temp_file, "wb") as out_file:
            await out_file.write(await file.read())

        with open(temp_file, "rb") as f:
            transcript = client.audio.transcriptions.create(model="whisper-1", file=f)

        text = getattr(transcript, 'text', None) or transcript.get('text') or "undefined"
        if not text.strip():
            return JSONResponse(status_code=200, content={"transcription": "undefined", "request_id": request_id})

        return {
            "transcription": text,
            "request_id": request_id,
            "raw": transcript
        }

    except Exception as e:
        logger.exception("Transcription error")
        return JSONResponse(status_code=500, content={
            "transcription": "undefined",
            "error": str(e),
            "request_id": request_id
        })

    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

async def text_to_speech(text: str, request_id: str) -> str:
    try:
        path = f"static/audio_{request_id}.mp3"
        headers = {
            "xi-api-key": elevenlabs_api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.85}
        }

        for _ in range(3):
            try:
                response = requests.post(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{dinakara_voice_id}",
                    headers=headers, json=payload
                )
                response.raise_for_status()
                with open(path, "wb") as f:
                    f.write(response.content)
                return path
            except requests.RequestException as e:
                logger.warning(f"Retrying ElevenLabs: {e}")
                await asyncio.sleep(1)

        raise RuntimeError("Voice generation failed after retries.")

    except Exception as e:
        logger.exception("Voice gen failed")
        raise HTTPException(status_code=500, detail="Voice generation failed")
