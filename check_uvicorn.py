import os
import sys
import subprocess
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def check_and_install_uvicorn():
    """Check if uvicorn is installed and install it if needed."""
    logger.info("Checking if uvicorn is installed...")
    
    try:
        import uvicorn
        logger.info(f"uvicorn version: {uvicorn.__version__}")
        return True
    except ImportError:
        logger.error("uvicorn is not installed. Installing...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "uvicorn[standard]"])
            logger.info("uvicorn installed successfully")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install uvicorn: {e}")
            return False

if __name__ == "__main__":
    check_and_install_uvicorn() 