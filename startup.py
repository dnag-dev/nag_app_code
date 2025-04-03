import os
import sys
import subprocess
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def create_directories():
    """Create necessary directories."""
    logger.info("Creating required directories...")
    dirs = [
        "/home/LogFiles/data",
        "/home/LogFiles/static",
        "/home/LogFiles/cache",
        "/home/LogFiles/memory"
    ]
    
    for dir_path in dirs:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
            logger.info(f"Created directory: {dir_path}")

def start_application():
    """Start the FastAPI application with gunicorn."""
    logger.info("Starting Nag App with gunicorn...")
    
    # Set environment variables
    os.environ["PYTHONPATH"] = os.environ.get("PYTHONPATH", "") + ":" + os.getcwd()
    os.environ["PYTHONUNBUFFERED"] = "1"
    
    # Start gunicorn
    cmd = [
        "gunicorn",
        "main:app",
        "--workers", "1",
        "--worker-class", "uvicorn.workers.UvicornWorker",
        "--bind", "0.0.0.0:8000",
        "--timeout", "120",
        "--log-level", "debug"
    ]
    
    logger.info(f"Running command: {' '.join(cmd)}")
    
    # Execute gunicorn
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True
    )
    
    # Stream output
    for line in process.stdout:
        print(line, end='')
    
    # Wait for process to complete
    process.wait()
    
    # Return the exit code
    return process.returncode

if __name__ == "__main__":
    try:
        # Create directories
        create_directories()
        
        # Start application
        exit_code = start_application()
        
        # Exit with the same code
        sys.exit(exit_code)
    except Exception as e:
        logger.error(f"Error starting application: {e}")
        sys.exit(1) 