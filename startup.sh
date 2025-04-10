#!/bin/bash

# Exit on error
set -e

# Configure logging
log_file="/home/LogFiles/startup.log"
[ ! -d "/home/LogFiles" ] && log_file="startup.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$log_file"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."

    base_path="/home/site/wwwroot"

    for dir in data static cache memory audio models; do
        dir_path="$base_path/$dir"
        mkdir -p "$dir_path"
        log "Ensured directory exists: $dir_path"
    done
}

# Install dependencies using Azure's default Python
install_dependencies() {
    log "Installing Python dependencies (without venv)..."
    pip install --upgrade pip
    pip install --no-cache-dir -r /home/site/wwwroot/requirements.txt
}

# Enable debug logging
export PYTHONUNBUFFERED=1
export LOG_LEVEL=DEBUG

# Start uvicorn in the foreground
echo "Starting uvicorn server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --log-level debug --reload

# Note: Using exec replaces the shell process with uvicorn
# This ensures proper signal handling and prevents the container from terminating

log "🚀 Startup script initiated..."
log "Python version: $(python --version)"

create_directories
install_dependencies
