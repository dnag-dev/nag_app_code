from fastapi import UploadFile, APIRouter
import tempfile
import openai
import os

router = APIRouter()

@router.post("/transcribe")
async def transcribe(file: UploadFile):
    try:
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name

        with open(tmp_path, "rb") as audio_file:
            transcript = openai.Audio.transcribe("whisper-1", audio_file)

        os.remove(tmp_path)
        return {"text": transcript["text"]}
    except Exception as e:
        return {"error": str(e)}
