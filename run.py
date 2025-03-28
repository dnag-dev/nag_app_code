import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

if __name__ == "__main__":
    print("Starting server on http://0.0.0.0:9000")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=9000,
        log_level="debug"
    ) 