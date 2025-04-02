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
from pydantic import BaseModel, EmailStr

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

# -------------------- Load Context Files --------------------
try:
    # Try Azure path first
    context_path = "/home/LogFiles/data/dinakara_context_full.json"
    memory_path = "/home/LogFiles/data/book_memory.json"
    
    # If Azure paths don't exist, try local paths
    if not os.path.exists(context_path):
        context_path = "data/dinakara_context_full.json"
    if not os.path.exists(memory_path):
        memory_path = "data/book_memory.json"
    
    # Create data directory if it doesn't exist
    os.makedirs(os.path.dirname(context_path), exist_ok=True)
    os.makedirs(os.path.dirname(memory_path), exist_ok=True)
    
    # Load context files
    with open(context_path, "r") as f:
        dinakara_context = json.load(f)
    logger.info(f"Successfully loaded context from {context_path}")
    
    with open(memory_path, "r") as f:
        book_memory = json.load(f)
    logger.info(f"Successfully loaded memory from {memory_path}")
    
except FileNotFoundError as e:
    logger.error(f"Failed to load context files: {str(e)}")
    # Create default context if files don't exist
    dinakara_context = {
        "personal_info": {
            "name": "Dinakara Nagalla",
            "email": "dlnagalla@Mac.attlocal.net",
            "role": "Digital Twin",
            "version": "2.0.0"
        },
        "personality": {
            "traits": ["soulful", "wise", "blunt", "empathetic", "creative"],
            "tone": "Indian immigrant",
            "communication_style": "direct and caring",
            "values": ["authenticity", "growth", "connection", "wisdom"]
        }
    }
    book_memory = {
        "books": {
            "currently_reading": [],
            "completed": [],
            "to_read": []
        },
        "statistics": {
            "total_books_read": 0,
            "books_this_year": 0,
            "average_rating": 0,
            "favorite_genre": "",
            "reading_streak": 0,
            "last_updated": datetime.now().isoformat()
        }
    }
    # Save default files
    with open(context_path, "w") as f:
        json.dump(dinakara_context, f, indent=2)
    with open(memory_path, "w") as f:
        json.dump(book_memory, f, indent=2)
    logger.info("Created default context files")
except json.JSONDecodeError as e:
    logger.error(f"Failed to parse context files: {str(e)}")
    raise
except Exception as e:
    logger.error(f"Unexpected error loading context files: {str(e)}")
    raise

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
# Define base paths for different environments
STATIC_BASE = "/home/LogFiles/static" if os.path.exists("/home/LogFiles") else "static"
CACHE_BASE = "/home/LogFiles/cache" if os.path.exists("/home/LogFiles") else "cache"
MEMORY_BASE = "/home/LogFiles/memory" if os.path.exists("/home/LogFiles") else "memory"

# Create necessary directories
for directory in [STATIC_BASE, CACHE_BASE, MEMORY_BASE]:
    os.makedirs(directory, exist_ok=True)

# Mount static files directory
app.mount("/static", StaticFiles(directory=STATIC_BASE), name="static")

# -------------------- Helper Functions --------------------
def get_memory_path(email: str) -> str:
    """Get the appropriate memory file path based on environment."""
    # Try Azure path first
    azure_path = f"/home/LogFiles/memory/{email}.json"
    local_path = f"memory/{email}.json"
    
    if os.path.exists(azure_path):
        return azure_path
    return local_path

def load_user_memory(email: str) -> dict:
    """Load user memory from file, creating default if not exists."""
    try:
        filepath = get_memory_path(email)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        if os.path.exists(filepath):
            with open(filepath, "r") as f:
                return json.load(f)
        
        # Create default memory structure
        default_memory = {
            "history": [],
            "preferences": {},
            "mode": "Mentor",
            "last_updated": datetime.now().isoformat()
        }
        
        # Save default memory
        with open(filepath, "w") as f:
            json.dump(default_memory, f, indent=2)
        
        return default_memory
    except Exception as e:
        logger.error(f"Error loading user memory: {str(e)}")
        return {"history": [], "preferences": {}, "mode": "Mentor"}

def save_user_memory(email: str, data: dict) -> None:
    """Save user memory to file."""
    try:
        filepath = get_memory_path(email)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        data["last_updated"] = datetime.now().isoformat()
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving user memory: {str(e)}")
        raise

# -------------------- Text-to-Speech Function --------------------
async def text_to_speech(text: str, request_id: str) -> str:
    try:
        file_path = os.path.join(STATIC_BASE, f"audio_{request_id}.mp3")
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
                return f"/static/audio_{request_id}.mp3"

            except requests.RequestException as e:
                logger.warning(f"Voice gen failed attempt {attempt+1}: {e}")
                await asyncio.sleep(1)

        raise RuntimeError("Voice generation failed after retries")

    except Exception as e:
        logger.exception("Voice generation error")
        raise HTTPException(status_code=500, detail="Voice generation failed")

# Add request model
class ChatRequest(BaseModel):
    message: str
    email: Optional[EmailStr] = None
    mode: Optional[str] = None

@app.post("/chat")
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    """Process a chat message and return audio response."""
    request_id = str(uuid.uuid4())
    try:
        user_input = request.message.strip()

        if not user_input:
            raise HTTPException(status_code=400, detail="Empty message.")

        # Log request details
        logger.info(f"Chat request from {request.email or 'anonymous'} in {request.mode or 'default'} mode")

        # Check cache for existing response
        msg_hash = hashlib.md5(user_input.encode()).hexdigest()
        cached = get_cached_gpt_response(msg_hash)

        if cached:
            message = cached
            logger.info(f"Using cached response for: {user_input[:30]}...")
        else:
            # Generate new response from GPT
            system_prompt = "You are Nag, Dinakara Nagalla's digital twin — therapist, companion, unfiltered mirror. Be soulful, wise, blunt, Indian immigrant tone."
            
            # Adjust system prompt based on mode
            if request.mode == "Author":
                system_prompt += " You are in Author mode - be more creative and expressive in your responses."
            elif request.mode == "Therapist":
                system_prompt += " You are in Therapist mode - focus on emotional support and guidance."
            
            completion = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
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
            "cached": bool(cached),
            "mode": request.mode,
            "email": request.email
        }

    except Exception as e:
        logger.exception(f"Chat error: {str(e)}")
        return JSONResponse(
            status_code=500, 
            content={
                "response": "", 
                "audio_url": "", 
                "error": str(e),
                "request_id": request_id,
                "mode": request.mode,
                "email": request.email
            }
        )
