import os
import uvicorn

port = int(os.getenv("PORT", 8000))

uvicorn.run(
    "main:app",
    host="0.0.0.0",
    port=port,
    log_level="debug"
) 