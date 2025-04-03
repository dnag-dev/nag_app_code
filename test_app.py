import os
import sys
import logging
import requests
import time

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def test_app():
    """Test if the application can start correctly."""
    try:
        # Import the app
        logger.info("Importing app...")
        from main import app
        logger.info("Successfully imported app")
        
        # Check if the app has the expected routes
        logger.info("Checking app routes...")
        routes = [route.path for route in app.routes]
        logger.info(f"App routes: {routes}")
        
        # Check if the health endpoint exists
        if "/health" in routes:
            logger.info("Health endpoint exists")
        else:
            logger.error("Health endpoint does not exist")
            
        # Check if the chat endpoint exists
        if "/chat" in routes:
            logger.info("Chat endpoint exists")
        else:
            logger.error("Chat endpoint does not exist")
            
        # Check if the transcribe endpoint exists
        if "/transcribe" in routes:
            logger.info("Transcribe endpoint exists")
        else:
            logger.error("Transcribe endpoint does not exist")
            
        logger.info("App test completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error testing app: {e}")
        return False

if __name__ == "__main__":
    success = test_app()
    sys.exit(0 if success else 1) 