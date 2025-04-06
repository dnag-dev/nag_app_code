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
import traceback

# -------------------- Logging Setup --------------------
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            'timestamp': datetime.datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        
        if record.exc_info:
            log_data['exc_info'] = self.formatException(record.exc_info)
            
        if hasattr(record, 'extra'):
            log_data.update(record.extra)
            
        return json.dumps(log_data)

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Add JSON handler
json_handler = logging.StreamHandler()
json_handler.setFormatter(JSONFormatter())
logger.addHandler(json_handler)

# Add regular handler for non-JSON logs
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(console_handler)

logger.info("Starting application with debug logging enabled")

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

# -------------------- Load Environment Variables --------------------
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OPENAI_API_KEY not found in environment variables")
    raise ValueError("OPENAI_API_KEY environment variable is required")

client = AsyncOpenAI(api_key=api_key, http_client=httpx.AsyncClient(timeout=30.0, verify=True))
tts_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

# -------------------- App Setup --------------------
app = FastAPI(title="Nag - Digital Twin", version="3.0.0")

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
        logger.info("[chat] Request received")
        
        # Get message from either "message" or "text" parameter
        user_message = data.get("message", data.get("text", ""))
        logger.info("[chat] Processing message")
        
        if not user_message:
            error_msg = "No message provided"
            logger.error(error_msg)
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid request", "details": error_msg}
            )
        
        # Get response from OpenAI
        try:
            # Create system prompt from context
            system_prompt = create_system_prompt()
            logger.info("[chat] Using personalized system prompt")
            
            response = await client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7
            )
            
            assistant_message = response.choices[0].message.content
            logger.info("[chat] Response generated")
            
            # Generate TTS
            try:
                audio_url = await generate_tts(assistant_message)
                logger.info("[chat] TTS generated successfully")
                return {
                    "message": assistant_message,
                    "audio_url": audio_url,
                    "tts_url": audio_url  # For backward compatibility
                }
            except Exception as e:
                logger.error(f"[chat] TTS generation failed: {str(e)}")
                logger.error(traceback.format_exc())
                return {
                    "message": assistant_message,
                    "error": "TTS generation failed",
                    "audio_url": None,
                    "tts_url": None  # For backward compatibility
                }
        except Exception as e:
            error_msg = f"Error generating response: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            return JSONResponse(
                status_code=500,
                content={"error": "Internal server error", "details": error_msg}
            )
    except Exception as e:
        error_msg = f"Error processing request: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "details": error_msg}
        )

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    temp_file_path = None
    try:
        # Log the incoming file details
        logger.info(f"Received file: {file.filename} ({file.content_type})")
        
        # Validate content type with fallback for Safari
        if not file.content_type or not (file.content_type.startswith('audio/') or file.content_type.startswith('video/')):
            logger.warning(f"Fallback MIME type logic triggered. Original type: {file.content_type}")
            file.content_type = "audio/mp4"  # Default for Safari
            logger.info(f"Using fallback MIME type: {file.content_type}")
        
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
        file_ext = os.path.splitext(file.filename)[1] if file.filename and '.' in file.filename else ".mp4"
        temp_file_path = os.path.join(tempfile.gettempdir(), f"input_{uuid.uuid4()}{file_ext}")
        with open(temp_file_path, "wb") as f:
            f.write(content)
        logger.info(f"Saved input file: {temp_file_path} ({os.path.getsize(temp_file_path)} bytes)")
        
        # Directly use the file with OpenAI Whisper API
        logger.info(f"Sending audio directly to Whisper API")
        
        # Create a client with longer timeout for transcription
        whisper_client = AsyncOpenAI(
            api_key=api_key, 
            http_client=httpx.AsyncClient(timeout=60.0, verify=True)  # Longer timeout
        )
        
        try:
            with open(temp_file_path, "rb") as audio_file:
                # Log API details for debugging
                logger.info(f"OpenAI API key (first/last 3 chars): {api_key[:3]}...{api_key[-3:]}")
                logger.info(f"File size being sent to API: {os.path.getsize(temp_file_path)} bytes")
                
                # Send to OpenAI Whisper API
                transcript = await whisper_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
                
                # Log successful response
                logger.info(f"Transcription successful. Text length: {len(transcript.text)}")
                logger.info(f"Transcription text: {transcript.text[:100]}...")
                
                return {"transcription": transcript.text.strip()}
                
        except httpx.TimeoutException:
            error_msg = "Transcription request timed out"
            logger.error(error_msg)
            return JSONResponse(
                status_code=504,
                content={"error": "Transcription timed out", "details": error_msg}
            )
        except httpx.HTTPStatusError as http_err:
            # This captures HTTP errors with the full response
            error_msg = f"HTTP error from OpenAI: {http_err.response.status_code}"
            logger.error(f"{error_msg} - Response: {http_err.response.text}")
            return JSONResponse(
                status_code=500,
                content={"error": "OpenAI API error", "details": error_msg}
            )
        except Exception as e:
            # Log the full exception details
            logger.error("Error during Whisper API call:")
            logger.error(traceback.format_exc())
            return JSONResponse(
                status_code=500,
                content={"error": "Transcription failed", "details": str(e)}
            )
        
    except Exception as e:
        logger.error("Unhandled error in transcription endpoint:")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": "Transcription failed", "details": str(e)}
        )
    finally:
        # Clean up temporary files
        try:
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)
                logger.info(f"Cleaned up file: {temp_file_path}")
        except Exception as e:
            logger.error(f"Error cleaning up file {temp_file_path}: {str(e)}")

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
        voice_id = os.getenv("DINAKARA_VOICE_ID", "q8zvC54Cb4AB0IZViZqT")
        logger.info(f"Generating TTS with voice ID: {voice_id}")
        
        # Get the audio as a generator
        audio_generator = tts_client.generate(
            text=text,
            voice=voice_id,
            model="eleven_monolingual_v1",
            stream=False
        )
        
        # Convert generator to bytes
        if hasattr(audio_generator, '__iter__'):
            # It's a generator, convert to bytes
            audio_bytes = b''.join(chunk for chunk in audio_generator)
        else:
            # It's already bytes
            audio_bytes = audio_generator
        
        filename = f"audio_{uuid.uuid4()}.mp3"
        filepath = os.path.join("static", "audio", filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        
        audio_url = f"/static/audio/{filename}"
        logger.info(f"TTS audio saved at: {audio_url}")
        return audio_url
    except Exception as e:
        logger.error(f"TTS generation failed: {str(e)}")
        return None

# -------------------- Local Debug --------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)