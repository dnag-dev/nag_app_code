import os
import sys
import logging
import platform
import subprocess

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/LogFiles/check_env.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def check_environment():
    """Check the environment and log details."""
    logger.info("Checking environment...")
    
    # Log environment variables
    logger.info("Environment variables:")
    for key, value in os.environ.items():
        if key in ['PYTHONPATH', 'PATH', 'HOME', 'WEBSITE_SITE_NAME', 'WEBSITE_HOSTNAME']:
            logger.info(f"  {key}: {value}")
    
    # Log current directory
    current_dir = os.getcwd()
    logger.info(f"Current directory: {current_dir}")
    
    # Log files in current directory
    logger.info("Files in current directory:")
    for file in os.listdir(current_dir):
        logger.info(f"  {file}")
    
    # Check if we're running on Azure
    is_azure = os.path.exists('/home/site/wwwroot')
    logger.info(f"Running on Azure: {is_azure}")
    
    if is_azure:
        # Check if main.py exists
        main_path = os.path.join('/home/site/wwwroot', 'main.py')
        logger.info(f"main.py exists: {os.path.exists(main_path)}")
        
        # Check if virtual environment exists
        venv_path = os.path.join('/home/site/wwwroot', 'antenv')
        logger.info(f"Virtual environment exists: {os.path.exists(venv_path)}")
        
        if os.path.exists(venv_path):
            # Check if uvicorn is installed in the virtual environment
            try:
                python_path = os.path.join(venv_path, 'bin', 'python')
                if os.path.exists(python_path):
                    result = subprocess.run(
                        [python_path, '-c', 'import uvicorn; print(uvicorn.__version__)'],
                        capture_output=True,
                        text=True
                    )
                    logger.info(f"uvicorn version: {result.stdout.strip()}")
                else:
                    logger.error("Python executable not found in virtual environment")
            except Exception as e:
                logger.error(f"Error checking uvicorn: {e}")
    
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
    
    # Log Python version
    logger.info(f"Python version: {platform.python_version()}")
    logger.info(f"Python executable: {sys.executable}")

if __name__ == "__main__":
    check_environment() 