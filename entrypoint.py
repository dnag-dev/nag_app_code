import os
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def main():
    """Main entry point for the application."""
    try:
        # Create necessary directories
        logger.info("Creating required directories...")
        
        # Check if we're running on Azure
        is_azure = os.path.exists("/home/LogFiles")
        
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
        
        # Set environment variables
        logger.info("Setting environment variables...")
        os.environ["PYTHONPATH"] = os.environ.get("PYTHONPATH", "") + ":" + os.getcwd()
        os.environ["PYTHONUNBUFFERED"] = "1"
        
        # Import and run the application
        logger.info("Importing and running the application...")
        from main import app
        import uvicorn
        
        # Run the application
        logger.info("Starting the application...")
        uvicorn.run(app, host="0.0.0.0", port=8000)
        
    except Exception as e:
        logger.error(f"Error starting application: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 