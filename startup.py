
import os
import sys
import subprocess
import logging
import time
import platform
import uvicorn
from datetime import datetime

# Configure logging
azure_log_path = "/home/LogFiles/application/app.log"
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.StreamHandler(sys.stderr),
        logging.FileHandler('deployment.log', mode='a'),
        logging.FileHandler(azure_log_path, mode='a')
    ]
)

logger = logging.getLogger(__name__)

def create_directories():
    try:
        os.makedirs('static/audio', exist_ok=True)
        logger.info("Created static/audio directory")
    except Exception as e:
        logger.exception(f"Failed to create directories: {e}", exc_info=True)

def check_and_install_dependencies():
    try:
        import fastapi
        import openai
        import elevenlabs
        import ffmpeg
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

        import pkg_resources
        installed_packages = [f"{pkg.key}=={pkg.version}" for pkg in pkg_resources.working_set]
        logger.info(f"Installed packages: {installed_packages}")

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
        logger.exception("Error during application startup", exc_info=True)
        sys.stdout.flush()
        sys.stderr.flush()
        raise

if __name__ == "__main__":
    logger.info("Starting deployment process...")
    logger.info("Starting startup script...")
    logger.info(f"Python version: {platform.python_version()}")
    logger.info(f"Current directory: {os.getcwd()}")
    logger.info(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")

    create_directories()
    check_and_install_dependencies()
    start_application()
