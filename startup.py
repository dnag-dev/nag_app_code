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
    is_azure = os.path.exists("/home/site/wwwroot")
    
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
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.environ["PYTHONPATH"] = os.environ.get("PYTHONPATH", "") + ":" + current_dir
    os.environ["PYTHONUNBUFFERED"] = "1"
    
    # Get configuration from environment variables
    port = int(os.environ.get("PORT", 8000))
    workers = int(os.environ.get("GUNICORN_WORKERS", 2))
    timeout = int(os.environ.get("GUNICORN_TIMEOUT", 120))
    max_requests = int(os.environ.get("GUNICORN_MAX_REQUESTS", 1000))
    max_requests_jitter = int(os.environ.get("GUNICORN_MAX_REQUESTS_JITTER", 50))
    
    # Log the Python path for debugging
    logger.info(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}")
    logger.info(f"Current directory: {current_dir}")
    logger.info(f"Files in current directory: {os.listdir(current_dir)}")
    
    # Check if main.py exists
    main_path = os.path.join(current_dir, "main.py")
    if not os.path.exists(main_path):
        logger.error(f"main.py not found at {main_path}")
        # Try to find main.py in the parent directory
        parent_dir = os.path.dirname(current_dir)
        main_path = os.path.join(parent_dir, "main.py")
        if os.path.exists(main_path):
            logger.info(f"Found main.py at {main_path}")
            os.environ["PYTHONPATH"] = os.environ.get("PYTHONPATH", "") + ":" + parent_dir
        else:
            logger.error(f"main.py not found at {main_path}")
            # List files in parent directory
            logger.info(f"Files in parent directory: {os.listdir(parent_dir)}")
    
    # Start uvicorn
    try:
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
    except Exception as e:
        logger.error(f"Error starting uvicorn: {e}")
        # Try to import main directly to see if it works
        try:
            import main
            logger.info("Successfully imported main module")
            # Try to start the app directly
            from main import app
            import uvicorn
            uvicorn.run(app, host="0.0.0.0", port=port)
        except ImportError as e:
            logger.error(f"Failed to import main module: {e}")
            raise

if __name__ == "__main__":
    try:
        # Create directories
        create_directories()
        
        # Start application
        start_application()
    except Exception as e:
        logger.error(f"Error starting application: {e}")
        sys.exit(1) 