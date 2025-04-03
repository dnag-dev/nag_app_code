import os
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def test_import():
    """Test importing the main module."""
    logger.info("Testing import of main module...")
    
    # Log the Python path for debugging
    logger.info(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}")
    logger.info(f"Current directory: {os.getcwd()}")
    logger.info(f"Files in current directory: {os.listdir(os.getcwd())}")
    
    try:
        import main
        logger.info("Successfully imported main module")
        return True
    except ImportError as e:
        logger.error(f"Failed to import main module: {e}")
        return False

if __name__ == "__main__":
    test_import() 