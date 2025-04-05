import os
import sys
import subprocess
import logging
import time
import platform
import uvicorn
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('deployment.log')
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
    try:
        logger.info("Starting application...")
        logger.info(f"Python version: {sys.version}")
        logger.info(f"Current working directory: {os.getcwd()}")
        logger.info(f"Environment variables: {os.environ}")
        
        # Log installed packages
        import pkg_resources
        installed_packages = [f"{pkg.key}=={pkg.version}" for pkg in pkg_resources.working_set]
        logger.info(f"Installed packages: {installed_packages}")
        
        # Start uvicorn with detailed logging
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
        logger.error(f"Error starting application: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {str(e)}")
        raise

if __name__ == "__main__":
    logger.info("Starting deployment process...")
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