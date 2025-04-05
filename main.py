from fastapi import FastAPI, Request, UploadFile, File, HTTPException, BackgroundTasks, WebSocket
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from openai import AsyncOpenAI
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
import io
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from enum import Enum
from fastapi import WebSocketDisconnect
import json  # Added for JSON handling
import httpx
import tempfile

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

# Alternative request model for request bodies that use 'message' instead of 'text'
class MessageRequest(BaseModel):
    message: str
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
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OPENAI_API_KEY not found in environment variables")
    raise ValueError("OPENAI_API_KEY environment variable is required")

client = AsyncOpenAI(
    api_key=api_key,
    timeout=30.0,  # 30 second timeout
    max_retries=3  # Retry failed requests up to 3 times
)

# -------------------- App Setup --------------------
app = FastAPI(title="Nag - Digital Twin", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Static files
STATIC_BASE = "static"
app.mount("/static", StaticFiles(directory=STATIC_BASE), name="static")

# WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# -------------------- Routes --------------------
@app.get("/", response_class=HTMLResponse)
async def read_root():
    try:
        return FileResponse(
            os.path.join(STATIC_BASE, "index.html"),
            media_type="text/html"
        )
    except Exception as e:
        logger.error(f"Error serving index.html: {str(e)}")
        raise HTTPException(status_code=500, detail="Error loading application")

@app.get("/health")
async def health():
    try:
        api_key_status = "present" if os.getenv("OPENAI_API_KEY") else "missing"
        logger.info(f"Health check - API key status: {api_key_status}")
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "api_key_status": api_key_status,
            "openai_client": {
                "base_url": client.base_url,
                "api_key_present": bool(client.api_key)
            }
        }
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    try:
        # Accept the connection first
        await websocket.accept()
        logger.info("WebSocket connection accepted")
        
        # Add to connection manager
        manager.active_connections.append(websocket)
        
        try:
            while True:
                data = await websocket.receive_text()
                logger.info(f"Received message: {data}")
                await websocket.send_text(f"Message received: {data}")
        except WebSocketDisconnect:
            logger.info("Client disconnected")
        finally:
            # Remove from connection manager
            if websocket in manager.active_connections:
                manager.active_connections.remove(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")

@app.post("/chat")
async def chat(request_data: dict):
    try:
        logger.info(f"Received chat request: {request_data}")
        
        # Handle both formats: text and message
        user_message = request_data.get('text') or request_data.get('message')
        if not user_message:
            raise HTTPException(status_code=400, detail="Missing 'text' or 'message' field")
        
        system_message = "You are Nag, Dinakara Nagalla's digital twin — therapist, companion, unfiltered mirror. Be soulful, wise, blunt, Indian immigrant tone."
        completion = await client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        reply = completion.choices[0].message.content
        
        # Generate audio response from the reply
        # (This would require integration with a TTS service)
        audio_url = None
        # Example of how you might generate an audio URL:
        # audio_url = await generate_tts(reply)
        
        return {
            "response": reply,
            "audio_url": audio_url,
            "request_id": request_data.get('request_id')
        }
    except Exception as e:
        logger.exception("Chat error:")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        logger.info(f"Received audio file: {file.filename}")
        logger.info(f"Content type: {file.content_type}")
        logger.info(f"Headers: {file.headers}")

        content_type = file.content_type.lower()
        if not any(x in content_type for x in ['audio', 'video']):
            logger.error(f"Invalid content type: {content_type}")
            raise HTTPException(status_code=400, detail="Invalid file type. Please upload an audio file.")

        content = await file.read()
        logger.info(f"Audio file size: {len(content)} bytes")

        if len(content) < 1000:  # Less than 1KB is probably just noise
            logger.warning("Audio file too small to process")
            return JSONResponse(
                status_code=200,
                content={"transcription": "undefined", "error": "Audio too short"}
            )

        logger.info("Starting transcription with Whisper...")

        # Create a temporary file to store the audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            # Transcribe with OpenAI Whisper
            with open(tmp_path, "rb") as audio_file:
                transcript = await client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"  # Force English language detection
                )

            logger.info("Transcription completed successfully")
            return JSONResponse(
                status_code=200,
                content={"transcription": transcript.text}
            )

        finally:
            # Clean up the temporary file
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.warning(f"Error cleaning up temp file: {str(e)}")

    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"transcription": "undefined", "error": str(e)}
        )

# -------------------- Error Handlers --------------------
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=404,
        content={"detail": "Resource not found"}
    )

@app.exception_handler(500)
async def server_error_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Serve specific static files that might be requested directly
@app.get("/{file_path:path}")
async def serve_static_files(file_path: str):
    # Check if the file exists in the static directory
    file_location = os.path.join(STATIC_BASE, file_path)
    if os.path.isfile(file_location):
        return FileResponse(file_location)
    else:
        raise HTTPException(status_code=404, detail=f"File {file_path} not found")

# Add startup and shutdown events
@app.on_event("startup")
async def startup_event():
    logger.info("Application started")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Application shutdown")