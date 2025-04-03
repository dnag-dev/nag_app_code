import os
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def test_imports():
    """Test that all required modules can be imported."""
    try:
        logger.info("Testing imports...")
        import fastapi
        import uvicorn
        import openai
        import gunicorn
        logger.info("All imports successful!")
        return True
    except ImportError as e:
        logger.error(f"Import error: {e}")
        return False

def test_directories():
    """Test that all required directories exist and are writable."""
    try:
        logger.info("Testing directories...")
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
            
            # Test if directory is writable
            test_file = os.path.join(dir_path, "test.txt")
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            logger.info(f"Directory {dir_path} is writable")
        
        logger.info("All directories are accessible!")
        return True
    except Exception as e:
        logger.error(f"Directory error: {e}")
        return False

def test_environment():
    """Test environment variables."""
    try:
        logger.info("Testing environment variables...")
        required_vars = [
            "OPENAI_API_KEY",
            "ELEVENLABS_API_KEY",
            "DINAKARA_VOICE_ID",
            "AZURE_API_URL"
        ]
        
        missing_vars = []
        for var in required_vars:
            if var not in os.environ:
                missing_vars.append(var)
        
        if missing_vars:
            logger.warning(f"Missing environment variables: {', '.join(missing_vars)}")
        else:
            logger.info("All environment variables are set!")
        
        return True
    except Exception as e:
        logger.error(f"Environment error: {e}")
        return False

if __name__ == "__main__":
    logger.info("Starting startup tests...")
    
    tests = [
        test_imports,
        test_directories,
        test_environment
    ]
    
    success = True
    for test in tests:
        if not test():
            success = False
    
    if success:
        logger.info("All startup tests passed!")
        sys.exit(0)
    else:
        logger.error("Some startup tests failed!")
        sys.exit(1) 