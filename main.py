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
        request_id = data.get('request_id')
        message = data.get('message')

        if not message:
            raise HTTPException(status_code=400, detail="No message provided")

        response = await get_gpt_response(message)
        audio_url = await generate_tts(response)
        if not audio_url:
            raise HTTPException(status_code=500, detail="TTS audio generation failed")

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
    try:
        logger.info(f"Uploaded MIME: {file.content_type}, name: {file.filename}")
        content = await file.read()
        file_size = len(content)

        if file_size < 1000:
            return JSONResponse(
                status_code=400,
                content={"error": "Audio too short", "bytes": file_size}
            )

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(content)
            input_path = tmp.name
        output_path = input_path.replace(".mp4", ".wav")

        try:
            logger.info(f"Probing {input_path} for metadata...")
            probe = ffmpeg.probe(input_path)
            logger.info(json.dumps(probe, indent=2))

            logger.info(f"Converting to WAV: {output_path}")
            ffmpeg.input(input_path).output(
                output_path,
                format='wav',
                acodec='pcm_s16le',
                ac=1,
                ar='16000'
            ).overwrite_output().run(capture_stdout=True, capture_stderr=True)

            if not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
                raise Exception("Output file too small or missing")

            wav_size = os.path.getsize(output_path)
            logger.info(f"Final WAV file ready: {output_path} ({wav_size} bytes)")

            with open(output_path, "rb") as audio_file:
                try:
                    logger.info("Sending audio to OpenAI Whisper API...")
                    transcript = await client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="en"
                    )
                    logger.info(f"Transcription response: {transcript}")
                except httpx.TimeoutException:
                    logger.error("Timeout while calling OpenAI Whisper")
                    raise HTTPException(status_code=504, detail="Transcription timed out")
                except Exception as e:
                    logger.error(f"OpenAI Whisper API error: {str(e)}")
                    raise HTTPException(status_code=500, detail=f"OpenAI Whisper failed: {str(e)}")

            if not transcript or not transcript.text:
                return JSONResponse(status_code=500, content={"error": "No transcription returned"})

            return {"transcription": transcript.text.strip()}

        except ffmpeg.Error as e:
            error_msg = e.stderr.decode() if e.stderr else str(e)
            logger.error(f"FFmpeg error: {error_msg}")
            return JSONResponse(status_code=500, content={"error": "FFmpeg conversion failed miserably ", "details": error_msg})
        except Exception as e:
            logger.error(f"Transcription processing error: {str(e)}")
            return JSONResponse(status_code=500, content={"error": "Transcription failed", "details": str(e)})
        finally:
            for f in [input_path, output_path]:
                try:
                    if os.path.exists(f): os.remove(f)
                except Exception as e:
                    logger.warning(f"File cleanup failed: {f} - {str(e)}")
    except Exception as e:
        logger.error(f"Unhandled error in transcription: {str(e)}")
        return JSONResponse(status_code=500, content={"error": "Unexpected failure", "details": str(e)})

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
