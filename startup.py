import os
import sys
import subprocess
import logging
import time
import platform
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    return FileResponse('static/index.html')

def create_directories():
    """Create necessary directories if they don't exist."""
    try:
        os.makedirs('static', exist_ok=True)
        logging.info("Created static directory")
    except Exception as e:
        logging.error(f"Failed to create directories: {e}")

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
    logging.info("Starting startup script...")
    create_directories()
    logging.info("Starting application...")
    uvicorn.run(app, host="0.0.0.0", port=8000) 