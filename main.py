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
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    logger.info(f"New WebSocket connection established")
    try:
        while True:
            try:
                data = await websocket.receive_text()
                logger.info(f"Received message: {data}")
                await manager.broadcast(f"Message received: {data}")
            except WebSocketDisconnect:
                logger.info("Client disconnected")
                break
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}")
                break
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        manager.disconnect(websocket)
        logger.info("WebSocket connection closed")

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        system_message = "You are a helpful assistant."
        completion = await client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": request.text}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        reply = completion.choices[0].message.content
        return {"response": reply}
    except Exception as e:
        logger.exception("Chat error:")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        logger.info(f"Received audio file: {file.filename}")

        content_type = file.content_type.lower()
        if not any(x in content_type for x in ['audio', 'video']):
            raise HTTPException(status_code=400, detail="Invalid file type. Please upload an audio file.")

        content = await file.read()
        logger.info(f"Audio file size: {len(content)} bytes")

        logger.info("Starting transcription with Whisper...")

        audio_file = io.BytesIO(content)
        audio_file.name = file.filename  # Required by OpenAI SDK

        transcript = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )

        logger.info("Transcription completed successfully")
        return {"transcription": transcript.text}

    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
