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
    
    try:
        import main
        logger.info("Successfully imported main module")
        return True
    except ImportError as e:
        logger.error(f"Failed to import main module: {e}")
        return False

if __name__ == "__main__":
    test_import() 