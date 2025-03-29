from fastapi import FastAPI, Request, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import openai
import os
from dotenv import load_dotenv
import requests
import uuid
import aiofiles
import logging
from datetime import datetime
import shutil
from typing import Optional, Dict
import hashlib
import json
from pathlib import Path
import asyncio
from functools import lru_cache
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

# Environment variables
openai.api_key = os.getenv("OPENAI_API_KEY")
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
dinakara_voice_id = os.getenv("DINAKARA_VOICE_ID")
CACHE_DURATION = int(os.getenv("CACHE_DURATION", "3600"))  # 1 hour default
MAX_AUDIO_AGE = int(os.getenv("MAX_AUDIO_AGE", "86400"))  # 24 hours default

# Validate required environment variables
if not all([openai.api_key, elevenlabs_api_key, dinakara_voice_id]):
    raise ValueError("Missing required environment variables")

app = FastAPI(
    title="Nag - Digital Therapist",
    description="A digital extension of Dinakara's mind — therapist, companion, unfiltered mirror.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Ensure static directory exists
os.makedirs("static", exist_ok=True)

# Cache for GPT responses
@lru_cache(maxsize=1000)
def get_cached_gpt_response(message_hash: str) -> Optional[str]:
    cache_file = Path("cache/gpt_responses.json")
    if cache_file.exists():
        try:
            with open(cache_file, "r") as f:
                cache = json.load(f)
                if message_hash in cache:
                    return cache[message_hash]
        except Exception as e:
            logger.error(f"Error reading cache: {str(e)}")
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
        logger.error(f"Error writing to cache: {str(e)}")

def cleanup_old_audio_files(max_age_seconds: int = MAX_AUDIO_AGE):
    try:
        current_time = time.time()
        for filename in os.listdir("static"):
            if filename.startswith("audio_"):
                filepath = os.path.join("static", filename)
                file_time = os.path.getctime(filepath)
                if current_time - file_time > max_age_seconds:
                    os.remove(filepath)
                    logger.info(f"Cleaned up old audio file: {filename}")
    except Exception as e:
        logger.error(f"Error cleaning up audio files: {str(e)}")

async def cleanup_background(background_tasks: BackgroundTasks):
    background_tasks.add_task(cleanup_old_audio_files)

@app.get("/")
async def get_index():
    return FileResponse("static/index.html")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development")
    }

@app.post("/chat")
async def chat(request: Request, background_tasks: BackgroundTasks):
    request_id = str(uuid.uuid4())
    logger.info(f"Received chat request {request_id}")

    try:
        body = await request.json()
        user_input = body.get("message")

        if not user_input or not isinstance(user_input, str):
            raise HTTPException(status_code=400, detail="Invalid message format")

        message_hash = hashlib.md5(user_input.encode()).hexdigest()
        cached_response = get_cached_gpt_response(message_hash)

        if cached_response:
            logger.info(f"Using cached response for message hash: {message_hash}")
            message = cached_response
        else:
            completion = openai.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": user_input}]
            )
            message = completion.choices[0].message.content
            cache_gpt_response(message_hash, message)

        audio_url = await text_to_speech(message, request_id)
        await cleanup_background(background_tasks)

        return {
            "response": message,
            "audio_url": audio_url,
            "request_id": request_id,
            "cached": bool(cached_response)
        }

    except Exception as e:
        logger.error(f"Error processing chat request {request_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    request_id = str(uuid.uuid4())
    logger.info(f"Received transcription request {request_id}")

    try:
        if not file.filename.endswith((".mp3", ".wav", ".m4a", ".webm")):
            return JSONResponse(status_code=200, content={
                "transcription": "undefined",
                "error": "Unsupported file format",
                "request_id": request_id
            })

        temp_file_path = f"temp_{request_id}.mp3"
        async with aiofiles.open(temp_file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)

        try:
            with open(temp_file_path, "rb") as f:
                logger.info(f"Sending file to Whisper for transcription: {temp_file_path}")
                transcript = openai.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    response_format="json"
                )

            logger.info(f"Transcription result for {request_id}: {transcript}")
            transcript_text = getattr(transcript, 'text', None) or transcript.get('text') or "undefined"

            if not transcript_text or transcript_text.strip() == "":
                logger.warning(f"Whisper transcription returned empty for {request_id}")
                return JSONResponse(status_code=200, content={
                    "transcription": "undefined",
                    "request_id": request_id,
                    "warning": "Whisper returned no text"
                })

            return {
                "transcription": transcript_text,
                "request_id": request_id,
                "raw": transcript
            }

        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    except Exception as e:
        logger.error(f"Error processing transcription request {request_id}: {str(e)}")
        return JSONResponse(status_code=200, content={
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

        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
                break
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    raise
                logger.warning(f"ElevenLabs API attempt {attempt + 1} failed: {str(e)}")
                await asyncio.sleep(1)

        with open(output_path, "wb") as f:
            f.write(response.content)

        logger.info(f"Generated audio file: {output_path}")
        return f"static/audio_{request_id}.mp3"

    except Exception as e:
        logger.error(f"Error in text_to_speech: {str(e)}")
        raise HTTPException(status_code=500, detail="Voice generation failed")
