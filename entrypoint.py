import os
import sys
import logging
import traceback

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def main():
    """Main entry point for the application."""
    try:
        # Log environment information
        logger.info(f"Current working directory: {os.getcwd()}")
        logger.info(f"Python version: {sys.version}")
        logger.info(f"Environment variables: {dict(os.environ)}")
        
        # Create necessary directories
        logger.info("Creating required directories...")
        
        # Check if we're running on Azure
        is_azure = os.path.exists("/home/LogFiles")
        logger.info(f"Running on Azure: {is_azure}")
        
        # Define directories based on environment
        if is_azure:
            dirs = [
                "/home/LogFiles/data",
                "/home/LogFiles/static",
                "/home/LogFiles/cache",
                "/home/LogFiles/memory"
            ]
        else:
            dirs = [
                "data",
                "static",
                "cache",
                "memory"
            ]
        
        for dir_path in dirs:
            if not os.path.exists(dir_path):
                os.makedirs(dir_path, exist_ok=True)
                logger.info(f"Created directory: {dir_path}")
            else:
                logger.info(f"Directory already exists: {dir_path}")
        
        # Set environment variables
        logger.info("Setting environment variables...")
        os.environ["PYTHONPATH"] = os.environ.get("PYTHONPATH", "") + ":" + os.getcwd()
        os.environ["PYTHONUNBUFFERED"] = "1"
        
        # Import and run the application
        logger.info("Importing and running the application...")
        try:
            from main import app
            import uvicorn
            logger.info("Successfully imported app and uvicorn")
        except ImportError as e:
            logger.error(f"Error importing app or uvicorn: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
        
        # Run the application
        logger.info("Starting the application...")
        uvicorn.run(
            app, 
            host="0.0.0.0", 
            port=8000,
            log_level="debug",
            access_log=True
        )
        
    except Exception as e:
        logger.error(f"Error starting application: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        sys.exit(1)

if __name__ == "__main__":
    main() 