from fastapi import FastAPI, Request, UploadFile, File, HTTPException, WebSocket
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from openai import AsyncOpenAI
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr
from enum import Enum
import os
import logging
import datetime
import tempfile
import uuid
import httpx
import json
from typing import Optional, List
from fastapi import WebSocketDisconnect
from elevenlabs.client import ElevenLabs
import ffmpeg

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

client = AsyncOpenAI(api_key=api_key, http_client=httpx.AsyncClient(timeout=30.0, verify=True))
tts_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

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

STATIC_BASE = "static"
os.makedirs(os.path.join(STATIC_BASE, "audio"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_BASE), name="static")

# -------------------- WebSocket Manager --------------------
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
        return FileResponse(os.path.join(STATIC_BASE, "index.html"), media_type="text/html")
    except Exception as e:
        logger.error(f"Error serving index.html: {str(e)}")
        raise HTTPException(status_code=500, detail="Error loading application")

@app.get("/health")
async def health():
    try:
        api_key_status = "present" if os.getenv("OPENAI_API_KEY") else "missing"
        return {
            "status": "ok",
            "timestamp": datetime.datetime.now().isoformat(),
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
            "timestamp": datetime.datetime.now().isoformat()
        }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection accepted")
    manager.active_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Message received: {data}")
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    finally:
        manager.disconnect(websocket)

@app.post("/chat")
async def chat(request: Request):
    try:
        data = await request.json()
        user_message = data.get("message", "")
        logger.info(f"Received chat message: {user_message[:100]}...")
        
        if not user_message:
            error_msg = "No message provided"
            logger.error(error_msg)
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid request", "details": error_msg}
            )
        
        # Get response from OpenAI
        try:
            response = await client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7
            )
            
            if not response.choices:
                error_msg = "No response from OpenAI"
                logger.error(error_msg)
                return JSONResponse(
                    status_code=500,
                    content={"error": "Chat failed", "details": error_msg}
                )
            
            assistant_message = response.choices[0].message.content
            logger.info(f"OpenAI response: {assistant_message[:100]}...")
            
            # Generate TTS
            try:
                tts_url = await generate_tts(assistant_message)
                return {
                    "message": assistant_message,
                    "tts_url": tts_url
                }
            except Exception as e:
                error_msg = f"TTS generation failed: {str(e)}"
                logger.error(error_msg)
                return JSONResponse(
                    status_code=500,
                    content={"error": "TTS generation failed", "details": error_msg}
                )
                
        except httpx.HTTPStatusError as http_err:
            error_msg = f"HTTP error from OpenAI: {http_err.response.status_code} - {http_err.response.text}"
            logger.error(error_msg)
            return JSONResponse(
                status_code=500,
                content={"error": "OpenAI API error", "details": error_msg}
            )
        except Exception as e:
            error_msg = f"OpenAI API error: {str(e)}"
            logger.error(error_msg)
            return JSONResponse(
                status_code=500,
                content={"error": "Chat failed", "details": error_msg}
            )
            
    except Exception as e:
        error_msg = f"Unhandled error in chat: {str(e)}"
        logger.error(error_msg)
        return JSONResponse(
            status_code=500,
            content={"error": "Chat failed", "details": error_msg}
        )

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    input_path = None
    output_path = None
    try:
        # Log the incoming file details
        logger.info(f"Received file: {file.filename} ({file.content_type})")
        
        # Validate content type
        if not file.content_type or not file.content_type.startswith('audio/'):
            error_msg = f"Invalid content type: {file.content_type}. Expected audio/*"
            logger.error(error_msg)
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid file type", "details": error_msg}
            )
        
        # Read and validate file content
        content = await file.read()
        file_size = len(content)
        logger.info(f"Received audio file size: {file_size} bytes")
        
        if file_size < 1000:
            error_msg = f"File too small: {file_size} bytes"
            logger.error(error_msg)
            return JSONResponse(
                status_code=400,
                content={"error": "File too small", "details": error_msg}
            )
        
        # Save the uploaded file
        input_path = os.path.join(tempfile.gettempdir(), f"input_{uuid.uuid4()}.mp4")
        with open(input_path, "wb") as f:
            f.write(content)
        logger.info(f"Saved input file: {input_path} ({os.path.getsize(input_path)} bytes)")
        
        # Prepare output path
        output_path = os.path.join(tempfile.gettempdir(), f"output_{uuid.uuid4()}.wav")
        
        # Convert to WAV using FFmpeg
        try:
            logger.info(f"Converting {input_path} to WAV format...")
            ffmpeg.input(input_path).output(
                output_path,
                format='wav',
                acodec='pcm_s16le',
                ac=1,
                ar='16000'
            ).overwrite_output().run(capture_stdout=True, capture_stderr=True)
        except ffmpeg.Error as e:
            error_msg = f"FFmpeg conversion error: {str(e)}"
            logger.error(error_msg)
            return JSONResponse(
                status_code=500,
                content={"error": "Audio conversion failed", "details": error_msg}
            )
        
        # Verify the conversion
        if not os.path.exists(output_path):
            error_msg = f"FFmpeg conversion failed - output file not found: {output_path}"
            logger.error(error_msg)
            return JSONResponse(
                status_code=500,
                content={"error": "Audio conversion failed", "details": error_msg}
            )
        
        output_size = os.path.getsize(output_path)
        logger.info(f"Converted audio file size: {output_size} bytes")
        
        if output_size < 1000:
            error_msg = f"Converted audio file too small: {output_size} bytes"
            logger.error(error_msg)
            return JSONResponse(
                status_code=400,
                content={"error": "Audio file too small", "details": error_msg}
            )
        
        # Log the start of transcription
        logger.info(f"Starting transcription with Whisper...")
        logger.info(f"OpenAI client config: {client.api_key[:5]}...{client.api_key[-5:]}")
        
        # Send to OpenAI Whisper
        with open(output_path, "rb") as audio_file:
            try:
                logger.info(f"Sending WAV to Whisper: {output_path} ({os.path.getsize(output_path)} bytes)")
                transcript = await client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
                logger.info(f"Transcription response: {transcript}")
            except httpx.HTTPStatusError as http_err:
                error_msg = f"HTTP error from OpenAI: {http_err.response.status_code} - {http_err.response.text}"
                logger.error(error_msg)
                return JSONResponse(
                    status_code=500,
                    content={"error": "OpenAI API error", "details": error_msg}
                )
            except Exception as e:
                error_msg = f"Whisper exception: {str(e)}"
                logger.error(error_msg)
                return JSONResponse(
                    status_code=500,
                    content={"error": "Transcription failed", "details": error_msg}
                )
        
        return {"transcript": transcript.text}
        
    except Exception as e:
        error_msg = f"Unhandled error in transcription: {str(e)}"
        logger.error(error_msg)
        return JSONResponse(
            status_code=500,
            content={"error": "Transcription failed", "details": error_msg}
        )
    finally:
        # Clean up temporary files
        for f in [input_path, output_path]:
            try:
                if f and os.path.exists(f):
                    os.remove(f)
                    logger.info(f"Cleaned up file: {f}")
            except Exception as e:
                error_msg = f"Error cleaning up file {f}: {str(e)}"
                logger.error(error_msg)
                # Don't return error for cleanup failures, just log them

@app.get("/{file_path:path}")
async def serve_static(file_path: str):
    file_location = os.path.join(STATIC_BASE, file_path)
    if os.path.isfile(file_location):
        return FileResponse(file_location)
    else:
        raise HTTPException(status_code=404, detail=f"File {file_path} not found")

@app.on_event("startup")
async def on_startup():
    logger.info("App startup")

@app.on_event("shutdown")
async def on_shutdown():
    logger.info("App shutdown")

# -------------------- GPT & ElevenLabs --------------------
async def get_gpt_response(prompt: str) -> str:
    try:
        response = await client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"GPT error: {str(e)}")
        raise HTTPException(status_code=500, detail="GPT generation failed")

async def generate_tts(text: str) -> str:
    try:
        audio = tts_client.generate(
            text=text,
            voice="Nag",
            model="eleven_monolingual_v1",
            stream=False
        )
        filename = f"audio_{uuid.uuid4()}.mp3"
        filepath = os.path.join("static", "audio", filename)
        with open(filepath, "wb") as f:
            f.write(audio)
        return f"/static/audio/{filename}"
    except Exception as e:
        logger.error(f"TTS generation failed: {str(e)}")
        return None

# -------------------- Local Debug --------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
