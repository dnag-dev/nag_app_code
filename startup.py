import os
import sys
import subprocess
import logging
import time
import platform

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/LogFiles/startup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def create_directories():
    """Create necessary directories for the application."""
    logger.info("Creating necessary directories...")
    
    # Determine if we're running on Azure or locally
    is_azure = os.path.exists('/home/site/wwwroot')
    base_path = '/home/site/wwwroot' if is_azure else os.path.dirname(os.path.abspath(__file__))
    
    # Create directories
    dirs = ['data', 'static', 'cache', 'memory']
    for dir_name in dirs:
        dir_path = os.path.join(base_path, dir_name)
        os.makedirs(dir_path, exist_ok=True)
        logger.info(f"Created directory: {dir_path}")

def check_and_install_dependencies():
    """Check if required packages are installed and install them if needed."""
    logger.info("Checking required packages...")
    
    required_packages = ['uvicorn', 'gunicorn', 'fastapi']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            logger.info(f"Package {package} is already installed")
        except ImportError:
            logger.warning(f"Package {package} is not installed")
            missing_packages.append(package)
    
    if missing_packages:
        logger.info(f"Installing missing packages: {', '.join(missing_packages)}")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing_packages)
            logger.info("All required packages installed successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install packages: {e}")
            sys.exit(1)

def start_application():
    """Start the FastAPI application."""
    logger.info("Starting the application...")
    
    # Get environment variables
    port = int(os.environ.get('PORT', 8000))
    workers = int(os.environ.get('GUNICORN_WORKERS', 2))
    timeout = int(os.environ.get('GUNICORN_TIMEOUT', 120))
    max_requests = int(os.environ.get('GUNICORN_MAX_REQUESTS', 1000))
    max_requests_jitter = int(os.environ.get('GUNICORN_MAX_REQUESTS_JITTER', 50))
    
    # Determine if we're running on Azure or locally
    is_azure = os.path.exists('/home/site/wwwroot')
    base_path = '/home/site/wwwroot' if is_azure else os.path.dirname(os.path.abspath(__file__))
    
    # Change to the application directory
    os.chdir(base_path)
    logger.info(f"Changed directory to: {os.getcwd()}")
    
    # Check if main.py exists
    main_path = os.path.join(base_path, 'main.py')
    if not os.path.exists(main_path):
        logger.error(f"main.py not found at {main_path}")
        sys.exit(1)
    
    # Start the application
    try:
        logger.info(f"Starting uvicorn with workers={workers}, port={port}")
        import uvicorn
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=port,
            workers=workers,
            timeout_keep_alive=timeout,
            limit_concurrency=max_requests,
            limit_max_requests=max_requests_jitter,
            log_level="debug"
        )
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        sys.exit(1)

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