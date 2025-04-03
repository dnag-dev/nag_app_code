import os
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def check_environment():
    """Check the environment in Azure."""
    logger.info("Checking environment in Azure...")
    
    # Log environment variables
    logger.info("Environment variables:")
    for key, value in os.environ.items():
        logger.info(f"{key}: {value}")
    
    # Log current directory
    logger.info(f"Current directory: {os.getcwd()}")
    logger.info(f"Files in current directory: {os.listdir(os.getcwd())}")
    
    # Check if we're running on Azure
    is_azure = os.path.exists("/home/site/wwwroot")
    logger.info(f"Running on Azure: {is_azure}")
    
    # Check if main.py exists
    main_path = os.path.join(os.getcwd(), "main.py")
    if os.path.exists(main_path):
        logger.info(f"main.py found at {main_path}")
    else:
        logger.error(f"main.py not found at {main_path}")
        # Try to find main.py in the parent directory
        parent_dir = os.path.dirname(os.getcwd())
        main_path = os.path.join(parent_dir, "main.py")
        if os.path.exists(main_path):
            logger.info(f"Found main.py at {main_path}")
        else:
            logger.error(f"main.py not found at {main_path}")
            # List files in parent directory
            logger.info(f"Files in parent directory: {os.listdir(parent_dir)}")
    
    # Check if uvicorn is installed
    try:
        import uvicorn
        logger.info(f"uvicorn version: {uvicorn.__version__}")
    except ImportError:
        logger.error("uvicorn is not installed")
    
    # Check if gunicorn is installed
    try:
        import gunicorn
        logger.info(f"gunicorn version: {gunicorn.__version__}")
    except ImportError:
        logger.error("gunicorn is not installed")
    
    # Check if fastapi is installed
    try:
        import fastapi
        logger.info(f"fastapi version: {fastapi.__version__}")
    except ImportError:
        logger.error("fastapi is not installed")

if __name__ == "__main__":
    check_environment() 