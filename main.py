from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import openai
import os
from dotenv import load_dotenv
import requests
import uuid
import logging
from datetime import datetime, timedelta
import json
import time
from typing import Optional, Dict
from pydantic import BaseModel, EmailStr
from enum import Enum

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

# -------------------- Logging --------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -------------------- Load Environment --------------------
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
client = openai.OpenAI(api_key=openai_api_key)

# -------------------- Paths --------------------
STATIC_BASE = "/home/site/wwwroot/static" if os.path.exists("/home/site/wwwroot") else "static"
DATA_BASE = "/home/site/wwwroot/data" if os.path.exists("/home/site/wwwroot") else "data"
os.makedirs(STATIC_BASE, exist_ok=True)
os.makedirs(DATA_BASE, exist_ok=True)

# -------------------- Load Context --------------------
context_path = os.path.join(DATA_BASE, "dinakara_context_full.json")
memory_path = os.path.join(DATA_BASE, "book_memory.json")
try:
    with open(context_path) as f:
        dinakara_context = json.load(f)
    with open(memory_path) as f:
        book_memory = json.load(f)
except:
    dinakara_context = {"personal_info": {}, "personality": {}, "knowledge_base": {}}
    book_memory = {"current_book": None, "completed_books": [], "reading_stats": {}}

# -------------------- App Setup --------------------
app = FastAPI(title="Nag - Digital Twin")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.mount("/static", StaticFiles(directory=STATIC_BASE), name="static")

@app.get("/")
async def index():
    return FileResponse(os.path.join(STATIC_BASE, "index.html"))

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        system_message = f"""You are Dinakara Nagalla's digital twin, operating in {request.mode} mode."""
        response = await client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": request.text}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        return {
            "response": response.choices[0].message.content,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            buffer.write(await file.read())

        with open(temp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="en"
            )
        os.remove(temp_path)
        return {"text": transcript.text}
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
