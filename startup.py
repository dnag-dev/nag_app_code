import os
import sys
import logging
import uvicorn

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def create_directories():
    """Create necessary directories."""
    logger.info("Creating required directories...")
    
    # Check if we're running on Azure
    is_azure = os.path.exists("/home/LogFiles")
    
    # Define directories based on environment
    if is_azure:
        dirs = [
            "/home/site/wwwroot/data",
            "/home/site/wwwroot/static",
            "/home/site/wwwroot/cache",
            "/home/site/wwwroot/memory"
        ]
    else:
        dirs = [
            "data",
            "static",
            "cache",
            "memory"
        ]
    
    for dir_path in dirs:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
            logger.info(f"Created directory: {dir_path}")

def start_application():
    """Start the FastAPI application with uvicorn."""
    logger.info("Starting Nag App with uvicorn...")
    
    # Set environment variables
    os.environ["PYTHONPATH"] = os.environ.get("PYTHONPATH", "") + ":" + os.getcwd()
    os.environ["PYTHONUNBUFFERED"] = "1"
    
    # Get configuration from environment variables
    port = int(os.environ.get("PORT", 8000))
    workers = int(os.environ.get("GUNICORN_WORKERS", 2))
    timeout = int(os.environ.get("GUNICORN_TIMEOUT", 120))
    max_requests = int(os.environ.get("GUNICORN_MAX_REQUESTS", 1000))
    max_requests_jitter = int(os.environ.get("GUNICORN_MAX_REQUESTS_JITTER", 50))
    
    # Start uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="debug",
        access_log=True,
        reload=False,  # Disable reload to prevent duplicate processes
        workers=workers,
        timeout_keep_alive=timeout,
        limit_concurrency=max_requests,
        limit_max_requests=max_requests + max_requests_jitter
    )

if __name__ == "__main__":
    try:
        # Create directories
        create_directories()
        
        # Start application
        start_application()
    except Exception as e:
        logger.error(f"Error starting application: {e}")
        sys.exit(1) 