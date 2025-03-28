import uvicorn
import logging
import os
import sys
import signal
import socket
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('nag_app.log')
    ]
)
logger = logging.getLogger(__name__)

def is_port_in_use(port: int) -> bool:
    """Check if a port is in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('0.0.0.0', port))
            return False
        except socket.error:
            return True

def find_available_port(start_port: int = 9000, max_port: int = 9010) -> int:
    """Find an available port in the given range."""
    for port in range(start_port, max_port + 1):
        if not is_port_in_use(port):
            return port
    raise RuntimeError(f"No available ports found between {start_port} and {max_port}")

def check_environment():
    """Check if all required environment variables are set."""
    required_vars = [
        "OPENAI_API_KEY",
        "ELEVENLABS_API_KEY",
        "DINAKARA_VOICE_ID"
    ]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info("Received shutdown signal. Cleaning up...")
    sys.exit(0)

def main():
    """Main entry point for the application."""
    try:
        # Set up signal handlers
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Check environment
        check_environment()
        
        # Get configuration from environment or use defaults
        host = os.getenv("HOST", "0.0.0.0")
        port = int(os.getenv("PORT", "9000"))
        log_level = os.getenv("LOG_LEVEL", "info")
        reload = os.getenv("RELOAD", "false").lower() == "true"
        workers = int(os.getenv("WORKERS", "1"))
        
        # Find available port if default is in use
        if is_port_in_use(port):
            port = find_available_port()
            logger.warning(f"Default port {os.getenv('PORT', '9000')} is in use. Using port {port} instead.")
        
        logger.info(f"Starting server on http://{host}:{port}")
        logger.info(f"Log level: {log_level}")
        logger.info(f"Auto-reload: {reload}")
        logger.info(f"Workers: {workers}")
        
        # Start the server
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            log_level=log_level,
            reload=reload,
            workers=workers,
            access_log=True,
            proxy_headers=True,
            forwarded_allow_ips="*"
        )
        
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 