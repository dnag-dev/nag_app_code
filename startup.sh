#!/bin/bash

# Exit on error
set -e

# Configure logging
log_file="/home/LogFiles/startup.log"
[ ! -d "/home/LogFiles" ] && log_file="startup.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$log_file"
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
    log "Installing Python dependencies..."
    pip install -r requirements.txt
}

# Function to check if a port is in use
is_port_in_use() {
    netstat -tuln | grep -q ":$1 "
    return $?
}

# Start FastAPI app
start_application() {
    log "Starting application..."
    
    # Check if port is available
    if is_port_in_use 8000; then
        log "Port 8000 is already in use. Attempting to kill existing process..."
        fuser -k 8000/tcp
        sleep 2
    fi
    
    # Start uvicorn with proper configuration
    uvicorn main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers 4 \
        --timeout-keep-alive 120 \
        --log-level info &
    
    # Store the process ID
    echo $! > /tmp/uvicorn.pid
}

log "🚀 Startup script initiated..."
log "Python version: $(python --version)"

create_directories
install_dependencies
start_application

# Keep the container running
while true; do
    sleep 30
    # Check if uvicorn is still running
    if ! kill -0 $(cat /tmp/uvicorn.pid) 2>/dev/null; then
        log "Uvicorn process not found, restarting..."
        start_application
    fi
    log "Container heartbeat - still running"
done
