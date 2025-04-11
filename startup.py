import os
import sys
import logging
import platform
import uvicorn
import json
import pip
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

# Azure logging paths
azure_log_path = '/home/LogFiles/application/app.log'
startup_log_path = '/home/LogFiles/startup.log'
os.makedirs(os.path.dirname(azure_log_path), exist_ok=True)

# JSON logger setup
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        if record.exc_info:
            log_data['exc_info'] = self.formatException(record.exc_info)
        if hasattr(record, 'extra'):
            log_data.update(record.extra)
        return json.dumps(log_data)

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# JSON file logger
json_handler = logging.FileHandler(azure_log_path, mode='a')
json_handler.setFormatter(JSONFormatter())
logger.addHandler(json_handler)

# Console logger
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(console_handler)

# Startup log file
startup_handler = logging.FileHandler(startup_log_path, mode='a')
startup_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(startup_handler)

logger.info("🚀 Startup script initiated...")

def create_directories():
    try:
        base_path = "/home/site/wwwroot"
        required_dirs = ['data', 'static', 'cache', 'memory', 'audio', 'models']
        
        for dir_name in required_dirs:
            dir_path = os.path.join(base_path, dir_name)
            os.makedirs(dir_path, exist_ok=True)
            logger.info(f"Ensured directory exists: {dir_path}")
            
        # Create static/audio directory
        os.makedirs('static/audio', exist_ok=True)
        logger.info("Static directories created or already exist.")
    except Exception as e:
        logger.error("Directory creation failed", exc_info=True)
        raise

def install_dependencies():
    try:
        logger.info("Installing Python dependencies...")
        pip.main(['install', '--upgrade', 'pip'])
        pip.main(['install', '--no-cache-dir', '-r', '/home/site/wwwroot/requirements.txt'])
        logger.info("Dependencies installed successfully")
    except Exception as e:
        logger.error("Dependency installation failed", exc_info=True)
        raise

def start_application():
    try:
        port = int(os.getenv("PORT", "8000"))
        logger.info(f"Environment: {os.getenv('ENV', 'production')}")
        logger.info(f"Python version: {platform.python_version()}")
        logger.info(f"Working directory: {os.getcwd()}")
        logger.info(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")
        
        # Log installed packages
        try:
            installed_packages = [f"{pkg.key}=={pkg.version}" for pkg in pip.get_installed_distributions()]
            logger.info(f"Installed packages: {installed_packages}")
        except Exception as e:
            logger.warning(f"Could not log installed packages: {str(e)}")

        logger.info(f"Starting server on port {port}")
        
        # Configure uvicorn
        config = uvicorn.Config(
            "main:app",
            host="0.0.0.0",
            port=port,
            log_level="debug",
            timeout_keep_alive=120,
            timeout_graceful_shutdown=30,
            proxy_headers=True,
            forwarded_allow_ips="*",
            reload=False,
            workers=1,
            access_log=True,
            server_header=False,
            date_header=False
        )
        
        server = uvicorn.Server(config)
        server.run()
        
    except Exception as e:
        logger.error("Failed to start application", exc_info=True)
        raise

if __name__ == "__main__":
    try:
        create_directories()
        install_dependencies()
        start_application()
    except Exception as e:
        logger.error("Startup failed", exc_info=True)
        sys.exit(1)
