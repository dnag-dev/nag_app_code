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

# Check OpenAI SDK version
try:
    import openai
    logger.info(f"OpenAI SDK version: {openai.__version__}")
except Exception as e:
    logger.error(f"OpenAI SDK not installed or import failed: {str(e)}")
    raise

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
        request_id = data.get('request_id')
        message = data.get('message')

        if not message:
            raise HTTPException(status_code=400, detail="No message provided")

        response = await get_gpt_response(message)
        audio_url = await generate_tts(response)

        return {
            "response": response,
            "audio_url": audio_url,
            "request_id": request_id
        }
    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    input_path = None
    output_path = None
    try:
        # Log incoming file details
        logger.info(f"Starting transcription request")
        logger.info(f"Uploaded MIME type: {file.content_type}")
        logger.info(f"Uploaded filename: {file.filename}")
        
        # Validate content type
        content_type = file.content_type.lower()
        if not any(x in content_type for x in ['audio', 'video']):
            logger.error(f"Invalid content type: {content_type}")
            raise HTTPException(status_code=400, detail=f"Invalid file type: {content_type}")

        # Read and validate file content
        content = await file.read()
        file_size = len(content)
        logger.info(f"Received audio file size: {file_size} bytes")
        
        if file_size < 1000:
            logger.error(f"File too small: {file_size} bytes")
            raise HTTPException(
                status_code=400, 
                detail=f"Audio too short ({file_size} bytes). Please speak for at least 1 second."
            )

        # Save original file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(content)
            input_path = tmp.name
            logger.info(f"Saved original audio to: {input_path}")
            logger.info(f"Original file size: {os.path.getsize(input_path)} bytes")
            logger.info(f"Original file exists: {os.path.exists(input_path)}")

        # Convert to WAV with specific settings for Whisper
        output_path = input_path.replace(".mp4", ".wav")
        logger.info(f"Preparing to convert audio to WAV: {output_path}")
        
        try:
            # Log ffmpeg command and settings
            ffmpeg_cmd = (
                f"ffmpeg -i {input_path} -f wav -acodec pcm_s16le -ac 1 -ar 16000 {output_path}"
            )
            logger.info(f"FFmpeg command: {ffmpeg_cmd}")
            
            # Run ffmpeg conversion
            ffmpeg.input(input_path).output(
                output_path,
                format='wav',
                acodec='pcm_s16le',
                ac=1,
                ar='16000'
            ).run(capture_stdout=True, capture_stderr=True)
            
            # Verify conversion
            if not os.path.exists(output_path):
                logger.error("FFmpeg conversion failed: output file not created")
                raise HTTPException(status_code=500, detail="Audio conversion failed")
            
            output_size = os.path.getsize(output_path)
            logger.info(f"Converted WAV file size: {output_size} bytes")
            logger.info(f"Converted file exists: {os.path.exists(output_path)}")
            
            if output_size < 1000:
                logger.error(f"Converted file too small: {output_size} bytes")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Converted audio too small ({output_size} bytes)"
                )

        except ffmpeg.Error as e:
            logger.error(f"FFmpeg conversion error: {str(e)}")
            logger.error(f"FFmpeg stdout: {e.stdout.decode() if e.stdout else 'None'}")
            logger.error(f"FFmpeg stderr: {e.stderr.decode() if e.stderr else 'None'}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to convert audio format: {str(e)}"
            )

        # Transcribe the converted WAV file
        logger.info(f"Starting OpenAI transcription")
        logger.info(f"OpenAI client config: base_url={client.base_url}, api_key_present={bool(client.api_key)}")
        
        with open(output_path, "rb") as audio_file:
            try:
                transcript = await client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
                logger.info(f"OpenAI transcription successful")
                logger.info(f"Transcript length: {len(transcript.text)} characters")
                
                if not transcript or not transcript.text:
                    logger.error("Empty transcription received from OpenAI")
                    raise HTTPException(
                        status_code=500,
                        detail="No transcription returned from OpenAI"
                    )

                return {"transcription": transcript.text.strip()}

            except httpx.TimeoutException as e:
                logger.error(f"OpenAI API timeout: {str(e)}")
                raise HTTPException(
                    status_code=504,
                    detail="Transcription request timed out. Please try again."
                )
            except Exception as e:
                logger.error(f"OpenAI API error: {str(e)}")
                logger.error(f"Error type: {type(e).__name__}")
                logger.error(f"Error args: {e.args}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Transcription failed: {str(e)}"
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in transcription: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error args: {e.args}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )
    finally:
        # Clean up temporary files
        try:
            if input_path and os.path.exists(input_path):
                os.unlink(input_path)
                logger.info(f"Cleaned up input file: {input_path}")
            if output_path and os.path.exists(output_path):
                os.unlink(output_path)
                logger.info(f"Cleaned up output file: {output_path}")
        except Exception as e:
            logger.error(f"Error cleaning up temporary files: {str(e)}")

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
    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    )
    return response.choices[0].message.content.strip()

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
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

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
