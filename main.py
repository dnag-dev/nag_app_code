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
import asyncio
from functools import lru_cache
import time
from typing import Union, Dict, Any, Optional

# -------------------- Logging Setup --------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.info("Starting application...")

# -------------------- Load Environment Variables --------------------
load_dotenv()

client = OpenAI()
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
dinakara_voice_id = os.getenv("DINAKARA_VOICE_ID")

if not all([client.api_key, elevenlabs_api_key, dinakara_voice_id]):
    logger.warning("⚠️ Missing required environment variables. App may not function fully.")

# -------------------- App Setup --------------------
app = FastAPI(title="Nag - Digital Twin", version="2.0.0")
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# -------------------- Directory Setup --------------------
os.makedirs("static", exist_ok=True)
os.makedirs("cache", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# -------------------- Cache Functions --------------------
@lru_cache(maxsize=1000)
def get_cached_gpt_response(message_hash: str) -> Optional[str]:
    """Retrieve a cached GPT response by hash."""
    try:
        with open("cache/gpt_responses.json", "r") as f:
            return json.load(f).get(message_hash)
    except (FileNotFoundError, json.JSONDecodeError):
        return None

def cache_gpt_response(message_hash: str, response: str) -> None:
    """Cache a GPT response by hash."""
    try:
        with open("cache/gpt_responses.json", "r") as f:
            try:
                cache = json.load(f)
            except json.JSONDecodeError:
                cache = {}
    except FileNotFoundError:
        cache = {}
        
    cache[message_hash] = response
    
    with open("cache/gpt_responses.json", "w") as f:
        json.dump(cache, f)

# -------------------- Cleanup Functions --------------------
def cleanup_old_audio_files(max_age: int = 86400) -> None:
    """Remove audio files older than max_age seconds."""
    try:
        now = time.time()
        for f in os.listdir("static"):
            path = os.path.join("static", f)
            if f.startswith("audio_") and now - os.path.getctime(path) > max_age:
                os.remove(path)
                logger.info(f"Removed old audio file: {f}")
    except Exception as e:
        logger.warning(f"Audio file cleanup failed: {e}")

def cleanup_temp_files(max_age: int = 3600) -> None:
    """Remove temporary files older than max_age seconds."""
    try:
        now = time.time()
        for f in os.listdir():
            if f.startswith("temp_") and now - os.path.getctime(f) > max_age:
                os.remove(f)
                logger.info(f"Removed temp file: {f}")
    except Exception as e:
        logger.warning(f"Temp file cleanup failed: {e}")

# -------------------- Text-to-Speech Function --------------------
async def text_to_speech(text: str, request_id: str) -> str:
    """Convert text to speech using ElevenLabs API."""
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
                    
                logger.info(f"Voice generation successful: {request_id}")
                return file_path
                
            except requests.RequestException as e:
                logger.warning(f"Voice gen failed attempt {attempt+1}: {e}")
                await asyncio.sleep(1)

        raise RuntimeError("Voice generation failed after retries")

    except Exception as e:
        logger.exception("Voice generation error")
        raise HTTPException(status_code=500, detail="Voice generation failed")

# -------------------- Transcription Helpers --------------------
def detect_safari(request: Request, browser_param: Optional[str] = None) -> bool:
    """Detect if the request is coming from Safari."""
    user_agent = request.headers.get("user-agent", "")
    is_safari = (
        browser_param == "safari" or 
        ("Safari" in user_agent and "Chrome" not in user_agent)
    )
    return is_safari

def get_file_extension(file: UploadFile) -> str:
    """Determine the appropriate file extension for an uploaded audio file."""
    # Try to get extension from filename
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    
    # If no extension in filename, try content type
    if not file_ext and file.content_type:
        content_type_map = {
            "audio/webm": ".webm",
            "audio/mp4": ".mp4",
            "audio/mpeg": ".mp3",
            "audio/ogg": ".ogg"
        }
        file_ext = content_type_map.get(file.content_type, ".audio")
    
    # Default to .audio if still no extension
    if not file_ext:
        file_ext = ".audio"
        
    return file_ext

def filter_transcription(text: str) -> str:
    """Filter out common false positives and known misidentifications."""
    if not text or text == "undefined":
        return "undefined"
        
    # Common single words that are often misrecognized
    common_false_positives = [
        "thank you.", "thank you", "you", "the", "ok", "ok.", 
        "i", "hi", "hey", "yes", "no", "um", "uh", "is", "it", "a", "an", "and"
    ]
    
    # Known Korean phrases that sometimes appear
    korean_phrases = ["mbc", "뉴스", "이덕영입니다", "워싱턴에서"]
    
    # Check for single word false positives
    if text.lower() in common_false_positives:
        logger.warning(f"Filtered out common false positive: {text}")
        return "undefined"
    
    # Check for Korean phrases
    for phrase in korean_phrases:
        if phrase.lower() in text.lower():
            logger.warning(f"Filtered out Korean phrase in: {text}")
            return "undefined"
    
    return text.strip()

# -------------------- App Startup Event --------------------
@app.on_event("startup")
async def startup_event():
    """Initialize app on startup."""
    logger.info("App startup.")
    logger.info(f"Static dir exists: {os.path.exists('static')}, cache dir exists: {os.path.exists('cache')}")
    
    # Create initial cache file if it doesn't exist
    if not os.path.exists("cache/gpt_responses.json"):
        with open("cache/gpt_responses.json", "w") as f:
            f.write("{}")
            logger.info("Created empty cache file")
    
    # Clean up any old temp files
    cleanup_temp_files()

# -------------------- API Routes --------------------
@app.get("/")
async def index():
    """Serve the main index.html page."""
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
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/chat")
async def chat(request: Request, background_tasks: BackgroundTasks):
    """Process a chat message and return audio response."""
    request_id = str(uuid.uuid4())
    try:
        body = await request.json()
        user_input = body.get("message", "").strip()

        if not user_input:
            raise HTTPException(status_code=400, detail="Empty message.")

        # Check cache for existing response
        msg_hash = hashlib.md5(user_input.encode()).hexdigest()
        cached = get_cached_gpt_response(msg_hash)

        if cached:
            message = cached
            logger.info(f"Using cached response for: {user_input[:30]}...")
        else:
            # Generate new response from GPT
            completion = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are Nag, Dinakara Nagalla's digital twin — therapist, companion, unfiltered mirror. Be soulful, wise, blunt, Indian immigrant tone."},
                    {"role": "user", "content": user_input}
                ]
            )
            message = completion.choices[0].message.content
            cache_gpt_response(msg_hash, message)
            logger.info(f"Generated new response for: {user_input[:30]}...")

        # Convert text to speech
        audio_url = await text_to_speech(message, request_id)
        
        # Schedule cleanup of old audio files
        background_tasks.add_task(cleanup_old_audio_files)

        return {
            "response": message,
            "audio_url": audio_url,
            "request_id": request_id,
            "cached": bool(cached)
        }

    except Exception as e:
        logger.exception(f"Chat error: {str(e)}")
        return JSONResponse(
            status_code=500, 
            content={
                "response": "", 
                "audio_url": "", 
                "error": str(e),
                "request_id": request_id
            }
        )

@app.post("/transcribe")
async def transcribe(
    request: Request,
    file: UploadFile = File(...), 
    background_tasks: BackgroundTasks,
    browser: Optional[str] = None
):
    """Transcribe an audio file to text."""
    request_id = str(uuid.uuid4())
    temp = None  # Initialize temp file path
    
    try:
        # Detect Safari browser
        is_safari = detect_safari(request, browser)
        
        # Log request details
        logger.info(
            f"Transcribe request: id={request_id}, "
            f"filename={file.filename}, "
            f"content_type={file.content_type}, "
            f"safari={is_safari}"
        )
        
        # Get appropriate file extension
        file_ext = get_file_extension(file)
        temp = f"temp_{request_id}{file_ext}"
        
        # Read and save the audio file
        content = await file.read()
        file_size = len(content)
        logger.info(f"Audio file size: {file_size} bytes")
        
        # Validate file size
        if file_size < 100:  # Very small file, likely empty
            logger.warning(f"Audio file too small: {file_size} bytes. Likely empty or corrupted.")
            return {
                "transcription": "undefined", 
                "request_id": request_id, 
                "error": "Audio file too small"
            }
            
        # Save to temp file
        async with aiofiles.open(temp, "wb") as out:
            await out.write(content)

        # Extra logging for Safari
        if is_safari:
            logger.info(f"Safari request details: size={file_size}, type={file.content_type}")
            
        # Transcribe with retry logic
        max_retries = 2
        transcript = None
        
        for attempt in range(max_retries):
            try:
                with open(temp, "rb") as f:
                    # For Safari, we'll try with slightly higher temperature on first attempt
                    temperature = 0.2 if (is_safari and attempt == 0) else (0.3 if attempt > 0 else 0.0)
                    
                    transcript = client.audio.transcriptions.create(
                        model="whisper-1", 
                        file=f,
                        language="en",  # Force English language detection
                        temperature=temperature
                    )
                    break  # Exit the loop if successful
            except Exception as e:
                logger.warning(f"Transcription attempt {attempt+1} failed: {str(e)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)  # Wait before retry
                else:
                    raise  # Re-raise on final attempt
        
        # Schedule cleanup of temp files
        background_tasks.add_task(cleanup_temp_files)
        
        # Clean up temp file
        try:
            os.remove(temp)
            temp = None
        except Exception as e:
            logger.warning(f"Error removing temp file: {str(e)}")

        # Extract and filter text
        text = getattr(transcript, "text", None) or "undefined"
        logger.info(f"Transcription result: '{text}'")
        
        # Filter inappropriate or misrecognized transcriptions
        filtered_text = filter_transcription(text)
        
        if filtered_text != text:
            logger.info(f"Text filtered from '{text}' to '{filtered_text}'")
                
        return {
            "transcription": filtered_text, 
            "request_id": request_id
        }

    except Exception as e:
        logger.exception(f"Transcription failed: {str(e)}")
        
        # Clean up temp file if it exists
        if temp and os.path.exists(temp):
            try:
                os.remove(temp)
            except:
                pass
                
        return JSONResponse(
            status_code=500, 
            content={
                "transcription": "undefined", 
                "error": str(e), 
                "request_id": request_id
            }
        )