import os
import sys
import subprocess
import logging
import time
import platform
import uvicorn
from datetime import datetime
import json

# Azure logging path
azure_log_path = '/home/LogFiles/application/app.log'

# Ensure log directory exists in the directory
os.makedirs(os.path.dirname(azure_log_path), exist_ok=True)

# Configure logging
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        
        if record.exc_info:
            log_data['exc_info'] = self.formatException(record.exc_info)
            
        if hasattr(record, 'extra'):
            log_data.update(record.extra)
            
        return json.dumps(log_data)

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Add JSON handler
json_handler = logging.FileHandler(azure_log_path, mode='a')
json_handler.setFormatter(JSONFormatter())
logger.addHandler(json_handler)

# Add regular handler for non-JSON logs
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(console_handler)

logger.info("Starting application with debug logging enabled")

def create_directories():
    """Create necessary directories if they don't exist."""
    try:
        os.makedirs('static', exist_ok=True)
        os.makedirs(os.path.join('static', 'audio'), exist_ok=True)
        logger.info("Created static directories")
    except Exception as e:
        logger.error(f"Failed to create directories: {e}")

def check_and_install_dependencies():
    """Check if required packages are installed and install them if needed."""
    try:
        import fastapi
        import openai
        import elevenlabs
        import ffmpeg
        import dotenv
        import uvicorn
        import aiofiles
        logger.info("All required packages are installed")
    except ImportError as e:
        logger.error(f"Missing dependency: {e}")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

def start_application():
    try:
        logger.info("Starting application...")
        logger.info(f"Python version: {sys.version}")
        logger.info(f"Current working directory: {os.getcwd()}")
        logger.info(f"Environment variables: {os.environ}")

        # Log installed packages
        try:
            import pkg_resources
            installed_packages = [f"{pkg.key}=={pkg.version}" for pkg in pkg_resources.working_set]
            logger.debug(f"Installed packages: {installed_packages}")
        except Exception as pkg_err:
            logger.warning(f"Could not log installed packages: {pkg_err}")

        # Start uvicorn
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=int(os.getenv("PORT", "8000")),
            reload=False,
            log_level="debug",
            access_log=True,
            workers=1
        )
    except Exception as e:
        logger.error(f"Error starting application: {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    logger.info("Starting deployment process...")
    logger.info("Running startup script...")
    logger.info(f"Python version: {platform.python_version()}")
    logger.info(f"Current directory: {os.getcwd()}")
    logger.info(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")

    create_directories()
    check_and_install_dependencies()
    start_application()
