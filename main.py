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
from datetime import datetime, timedelta
import hashlib
import json
import asyncio
from functools import lru_cache
import time
from typing import Union, Dict, Any, Optional
from pydantic import BaseModel, EmailStr
from enum import Enum
import openai

# -------------------- Request Models --------------------
class ChatMode(str, Enum):
    CHAT = "chat"
    BOOK = "book"
    VOICE = "voice"

class ChatRequest(BaseModel):
    text: str
    mode: ChatMode = ChatMode.CHAT
    email: Optional[EmailStr] = None
    request_id: Optional[str] = None

# -------------------- Logging Setup --------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.info("Starting application...")

# -------------------- Load Environment Variables --------------------
load_dotenv()

# Initialize API keys
openai_api_key = os.getenv("OPENAI_API_KEY")
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
dinakara_voice_id = os.getenv("DINAKARA_VOICE_ID")
azure_api_url = os.getenv("AZURE_API_URL")

# Initialize OpenAI client
client = OpenAI(api_key=openai_api_key)

# Initialize Whisper model
model = None  # We'll use OpenAI's API directly instead of local model

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
            "email": "dlnagalla@hotmail.com",
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
# Define base paths based on environment
STATIC_BASE = "/home/LogFiles/static" if os.path.exists("/home/LogFiles") else "static"
CACHE_BASE = "/home/LogFiles/cache" if os.path.exists("/home/LogFiles") else "cache"
MEMORY_BASE = "/home/LogFiles/memory" if os.path.exists("/home/LogFiles") else "memory"
DATA_BASE = "/home/LogFiles/data" if os.path.exists("/home/LogFiles") else "data"

# Create necessary directories
os.makedirs(STATIC_BASE, exist_ok=True)
os.makedirs(CACHE_BASE, exist_ok=True)
os.makedirs(MEMORY_BASE, exist_ok=True)
os.makedirs(DATA_BASE, exist_ok=True)

# Mount static files directory
app.mount("/static", StaticFiles(directory=STATIC_BASE), name="static")

# Rate limiting configuration
RATE_LIMIT = {
    "requests_per_minute": 60,
    "window_seconds": 60
}

# Session configuration
SESSION_TIMEOUT = timedelta(days=30)

# Rate limiting store
rate_limit_store: Dict[str, list] = {}

@app.get("/")
async def read_root():
    """Serve the main page."""
    try:
        return FileResponse(os.path.join(STATIC_BASE, "index.html"))
    except Exception as e:
        logger.error(f"Error serving index.html: {e}")
        raise HTTPException(status_code=500, detail="Error serving main page")

# -------------------- API Routes --------------------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/chat")
async def chat(request: ChatRequest):
    """Handle chat requests."""
    try:
        # Rate limiting
        client_id = request.email or "anonymous"
        if not check_rate_limit(client_id):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later."
            )

        request_id = str(uuid.uuid4())
        logger.info(f"Received chat request: {request_id}")
        logger.info(f"Request details: {request.dict()}")

        # Validate mode
        if request.mode and request.mode not in [mode.value for mode in ChatMode]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid mode. Must be one of: {', '.join([mode.value for mode in ChatMode])}"
            )

        # Check cache first
        cache_key = f"{request.text}_{request.mode}"
        cached_response = await get_cached_response(cache_key)
        if cached_response:
            logger.info(f"Cache hit for request: {request_id}")
            return cached_response

        # Load user memory
        user_memory = load_user_memory(request.email)
        logger.info(f"Loaded user memory for {request.email}")

        # Get mode-specific context
        mode_context = dinakara_context.get("modes", {}).get(request.mode, {})
        mode_prompt = mode_context.get("prompt", "")
        mode_style = mode_context.get("style", "professional")

        # Prepare system message
        system_message = f"""You are Dinakara Nagalla's digital twin, operating in {request.mode} mode.
{mode_prompt}

Your personality traits: {', '.join(dinakara_context['personality']['traits'])}
Your style: {dinakara_context['personality']['style']}
Your expertise: {', '.join(dinakara_context['knowledge_base']['expertise'])}
Your specialties: {', '.join(dinakara_context['knowledge_base']['specialties'])}

User's reading status:
Current book: {book_memory['current_book'] or 'None'}
Completed books: {', '.join(book_memory['completed_books']) or 'None'}
Reading streak: {book_memory['reading_stats']['current_streak']} days

Previous interactions: {json.dumps(user_memory['interaction_history'][-5:])}

Respond in a {mode_style} tone, maintaining Dinakara's personality while focusing on the user's needs."""

        # Get response from GPT-4
        response = await client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": request.text}
            ],
            temperature=0.7,
            max_tokens=1000
        )

        response_text = response.choices[0].message.content
        logger.info(f"Generated response for request: {request_id}")

        # Convert to speech
        audio_url = await text_to_speech(response_text, request_id)
        logger.info(f"Generated audio for request: {request_id}")

        # Update user memory
        user_memory['interaction_history'].append({
            'timestamp': datetime.now().isoformat(),
            'message': request.text,
            'response': response_text,
            'mode': request.mode
        })
        save_user_memory(request.email, user_memory)
        logger.info(f"Updated user memory for {request.email}")

        # Cache the response
        response_data = {
            "response": response_text,
            "audio_url": audio_url,
            "request_id": request_id,
            "timestamp": datetime.now().isoformat(),
            "mode": request.mode
        }
        await cache_response(cache_key, response_data)
        logger.info(f"Cached response for request: {request_id}")

        return response_data

    except Exception as e:
        logger.exception(f"Error processing chat request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Handle audio transcription requests."""
    temp_path = None
    try:
        # Validate file size (max 25MB)
        if file.size > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large")

        # Save uploaded file
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Transcribe using OpenAI's API
        with open(temp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="en"
            )
        transcription = transcript.text

        # Filter transcription
        filtered_text = filter_transcription(transcription)

        return {"text": filtered_text}

    except Exception as e:
        logger.exception(f"Error processing transcription: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                logger.error(f"Error cleaning up temp file: {e}")

# -------------------- Helper Functions --------------------
def get_memory_path(email: str) -> str:
    """Get the appropriate memory file path based on environment."""
    if os.path.exists("/home/LogFiles"):
        return os.path.join(DATA_BASE, f"{email}.json")
    return os.path.join("memory", f"{email}.json")

def load_user_memory(email: str) -> dict:
    """Load user memory from appropriate path."""
    try:
        memory_path = get_memory_path(email)
        if os.path.exists(memory_path):
            with open(memory_path, "r") as f:
                data = json.load(f)
                # Check session expiration
                last_interaction = datetime.fromisoformat(data.get("last_interaction", "2000-01-01"))
                if datetime.now() - last_interaction > SESSION_TIMEOUT:
                    # Reset memory for expired session
                    return {
                        "interaction_history": [],
                        "preferences": {},
                        "last_interaction": datetime.now().isoformat()
                    }
                return data
        return {
            "interaction_history": [],
            "preferences": {},
            "last_interaction": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error loading user memory: {e}")
        return {
            "interaction_history": [],
            "preferences": {},
            "last_interaction": datetime.now().isoformat()
        }

def save_user_memory(email: str, data: dict) -> None:
    """Save user memory to appropriate path."""
    try:
        memory_path = get_memory_path(email)
        os.makedirs(os.path.dirname(memory_path), exist_ok=True)
        data["last_interaction"] = datetime.now().isoformat()
        with open(memory_path, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving user memory: {e}")
        raise

def check_rate_limit(client_id: str) -> bool:
    """Check if the client has exceeded rate limits."""
    now = time.time()
    if client_id not in rate_limit_store:
        rate_limit_store[client_id] = []
    
    # Remove old timestamps
    rate_limit_store[client_id] = [ts for ts in rate_limit_store[client_id] 
                                 if now - ts < RATE_LIMIT["window_seconds"]]
    
    # Check if limit exceeded
    if len(rate_limit_store[client_id]) >= RATE_LIMIT["requests_per_minute"]:
        return False
    
    # Add current timestamp
    rate_limit_store[client_id].append(now)
    return True

# -------------------- Text-to-Speech Function --------------------
async def text_to_speech(text: str, request_id: str) -> str:
    """Convert text to speech using ElevenLabs API"""
    try:
        # Ensure the audio directory exists
        audio_dir = "audio"
        os.makedirs(audio_dir, exist_ok=True)
        
        # Generate audio file path
        audio_file = os.path.join(audio_dir, f"{request_id}.mp3")
        
        # Set up the API request
        headers = {
            "xi-api-key": os.getenv("ELEVENLABS_API_KEY"),
            "Content-Type": "application/json"
        }
        
        payload = {
            "text": text,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        # Make the API request
        response = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{os.getenv('DINAKARA_VOICE_ID')}",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        
        # Save the audio file
        with open(audio_file, "wb") as f:
            f.write(response.content)
        
        return audio_file
    except Exception as e:
        logger.error(f"Error in text_to_speech: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------- Startup Event --------------------
@app.on_event("startup")
async def startup_event():
    """Initialize the app."""
    try:
        # Try Azure path first
        context_path = os.path.join(DATA_BASE, "dinakara_context_full.json")
        memory_path = os.path.join(DATA_BASE, "book_memory.json")
        
        if os.path.exists(context_path):
            with open(context_path, "r") as f:
                dinakara_context = json.load(f)
            logger.info("Loaded context from Azure path")
        else:
            # Fall back to local path
            with open("data/dinakara_context_full.json", "r") as f:
                dinakara_context = json.load(f)
            logger.info("Loaded context from local path")
            
            # Copy to Azure path if we're on Azure
            if os.path.exists("/home/LogFiles"):
                os.makedirs(os.path.dirname(context_path), exist_ok=True)
                with open(context_path, "w") as f:
                    json.dump(dinakara_context, f, indent=2)
                logger.info("Copied context to Azure path")
                
        if os.path.exists(memory_path):
            with open(memory_path, "r") as f:
                book_memory = json.load(f)
            logger.info("Loaded memory from Azure path")
        else:
            # Fall back to local path
            with open("data/book_memory.json", "r") as f:
                book_memory = json.load(f)
            logger.info("Loaded memory from local path")
            
            # Copy to Azure path if we're on Azure
            if os.path.exists("/home/LogFiles"):
                os.makedirs(os.path.dirname(memory_path), exist_ok=True)
                with open(memory_path, "w") as f:
                    json.dump(book_memory, f, indent=2)
                logger.info("Copied memory to Azure path")
                
    except FileNotFoundError as e:
        logger.error(f"Context file not found: {e}")
        # Create default context if needed
        dinakara_context = {
            "personal_info": {
                "name": "Dinakara Nagalla",
                "role": "Author and Therapist",
                "background": "Experienced in both writing and therapy"
            },
            "personality": {
                "traits": ["empathetic", "knowledgeable", "professional"],
                "style": "warm and supportive"
            },
            "knowledge_base": {
                "expertise": ["grief counseling", "writing", "personal development"],
                "specialties": ["grief support", "author guidance"]
            }
        }
        book_memory = {
            "current_book": None,
            "completed_books": [],
            "to_read": [],
            "reading_stats": {
                "total_books_read": 0,
                "current_streak": 0,
                "longest_streak": 0
            },
            "reading_goals": {
                "daily_pages": 30,
                "weekly_books": 1
            }
        }
        
        # Save to both local and Azure paths if available
        for path in [context_path, "data/dinakara_context_full.json"]:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                json.dump(dinakara_context, f, indent=2)
                
        for path in [memory_path, "data/book_memory.json"]:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                json.dump(book_memory, f, indent=2)
                
        logger.info("Created default context and memory files")
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing context file: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error loading context: {e}")
        raise
