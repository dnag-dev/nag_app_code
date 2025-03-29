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
from typing import Union

# -------------------- Logging --------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.info("Starting application...")

# -------------------- Load .env --------------------
load_dotenv()

client = OpenAI()
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
dinakara_voice_id = os.getenv("DINAKARA_VOICE_ID")

# -------------------- Check Variables --------------------
if not all([client.api_key, elevenlabs_api_key, dinakara_voice_id]):
    logger.warning("⚠️ Missing required environment variables. App may not function fully.")

# -------------------- App Setup --------------------
app = FastAPI(title="Nag - Digital Twin", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1000)

# -------------------- Paths --------------------
os.makedirs("static", exist_ok=True)
os.makedirs("cache", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# -------------------- Caching --------------------
@lru_cache(maxsize=1000)
def get_cached_gpt_response(message_hash: str) -> Union[str, None]:
    try:
        with open("cache/gpt_responses.json", "r") as f:
            return json.load(f).get(message_hash)
    except:
        return None

def cache_gpt_response(message_hash: str, response: str):
    try:
        with open("cache/gpt_responses.json", "r") as f:
            cache = json.load(f)
    except:
        cache = {}
    cache[message_hash] = response
    with open("cache/gpt_responses.json", "w") as f:
        json.dump(cache, f)

# -------------------- Cleanup --------------------
def cleanup_old_audio_files(max_age=86400):
    try:
        now = time.time()
        for f in os.listdir("static"):
            path = os.path.join("static", f)
            if f.startswith("audio_") and now - os.path.getctime(path) > max_age:
                os.remove(path)
    except Exception as e:
        logger.warning(f"Cleanup failed: {e}")

@app.on_event("startup")
async def startup_event():
    logger.info("App startup.")
    logger.info(f"Static exists: {os.path.exists('static')}, cache exists: {os.path.exists('cache')}")
    
    # Create initial cache file if it doesn't exist
    if not os.path.exists("cache/gpt_responses.json"):
        with open("cache/gpt_responses.json", "w") as f:
            f.write("{}")
            logger.info("Created empty cache file")

@app.get("/")
async def index():
    if os.path.exists("static/index.html"):
        return FileResponse("static/index.html")
    else:
        logger.error("index.html not found in static directory")
        return JSONResponse(
            status_code=500, 
            content={"error": "index.html not found. Please check your deployment."}
        )

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/chat")
async def chat(request: Request, background_tasks: BackgroundTasks):
    request_id = str(uuid.uuid4())
    try:
        body = await request.json()
        user_input = body.get("message", "").strip()

        if not user_input:
            raise HTTPException(status_code=400, detail="Empty message.")

        msg_hash = hashlib.md5(user_input.encode()).hexdigest()
        cached = get_cached_gpt_response(msg_hash)

        if cached:
            message = cached
        else:
            completion = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are Nag, Dinakara Nagalla's digital twin — therapist, companion, unfiltered mirror. Be soulful, wise, blunt, Indian immigrant tone."},
                    {"role": "user", "content": user_input}
                ]
            )
            message = completion.choices[0].message.content
            cache_gpt_response(msg_hash, message)

        audio_url = await text_to_speech(message, request_id)
        background_tasks.add_task(cleanup_old_audio_files)

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
        # Determine file extension based on content-type or filename
        file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
        
        if not file_ext and file.content_type:
            # Map MIME types to extensions
            content_type_map = {
                "audio/webm": ".webm",
                "audio/mp4": ".mp4",
                "audio/mpeg": ".mp3",
                "audio/ogg": ".ogg"
            }
            file_ext = content_type_map.get(file.content_type, ".audio")
        
        # Default to .audio if we still don't have an extension
        if not file_ext:
            file_ext = ".audio"
            
        temp = f"temp_{request_id}{file_ext}"
        logger.info(f"Processing audio file with type: {file.content_type}, extension: {file_ext}")
        
        async with aiofiles.open(temp, "wb") as out:
            await out.write(await file.read())

        with open(temp, "rb") as f:
            transcript = client.audio.transcriptions.create(model="whisper-1", file=f)

        os.remove(temp)

        text = getattr(transcript, "text", None) or "undefined"
        return {"transcription": text.strip(), "request_id": request_id}

    except Exception as e:
        logger.exception(f"Transcription failed: {str(e)}")
        # Clean up temp file if it exists
        if 'temp' in locals() and os.path.exists(temp):
            try:
                os.remove(temp)
            except:
                pass
                
        return JSONResponse(status_code=500, content={
            "transcription": "undefined", "error": str(e), "request_id": request_id
        })

async def text_to_speech(text: str, request_id: str) -> str:
    try:
        file_path = f"static/audio_{request_id}.mp3"
        headers = {
            "xi-api-key": elevenlabs_api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.85}
        }

        for attempt in range(3):
            try:
                res = requests.post(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{dinakara_voice_id}",
                    headers=headers,
                    json=payload
                )
                res.raise_for_status()
                with open(file_path, "wb") as f:
                    f.write(res.content)
                return file_path
            except requests.RequestException as e:
                logger.warning(f"Voice gen failed attempt {attempt+1}: {e}")
                await asyncio.sleep(1)

        raise RuntimeError("Voice generation failed after retries")

    except Exception as e:
        logger.exception("Voice generation error")
        raise HTTPException(status_code=500, detail="Voice generation failed")