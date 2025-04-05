import os
import sys
import subprocess
import logging
import time
import platform
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('startup.log'),
    ]
)

logger = logging.getLogger(__name__)

def create_directories():
    """Create necessary directories if they don't exist."""
    try:
        os.makedirs('static', exist_ok=True)
        logger.info("Created static directory")
    except Exception as e:
        logger.error(f"Failed to create directories: {e}")

def check_and_install_dependencies():
    """Check if required packages are installed and install them if needed."""
    try:
        import fastapi
        import openai
        logger.info("All required packages are installed")
    except ImportError as e:
        logger.error(f"Missing dependency: {e}")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

def start_application():
    """Start the FastAPI application with uvicorn."""
    try:
        logger.info("Starting application with uvicorn...")
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=False,
            ws='auto',
            log_level="info"
        )
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise

if __name__ == "__main__":
    logger.info("Starting startup script...")
    logger.info(f"Python version: {platform.python_version()}")
    logger.info(f"Current directory: {os.getcwd()}")
    logger.info(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")
    
    # Create necessary directories
    create_directories()
    
    # Check and install dependencies
    check_and_install_dependencies()
    
    # Start the application
    start_application() 