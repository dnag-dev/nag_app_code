#!/bin/bash

# Exit on error
set -e

# Configure logging
log_file="/home/LogFiles/startup.log"
if [ ! -d "/home/LogFiles" ]; then
    log_file="startup.log"
fi

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$log_file"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    # Determine if we're running on Azure or locally
    if [ -d "/home/site/wwwroot" ]; then
        base_path="/home/site/wwwroot"
    else
        base_path="$(pwd)"
    fi
    
    # Create required directories
    for dir in data static cache memory audio models; do
        dir_path="$base_path/$dir"
        mkdir -p "$dir_path"
        log "Created directory: $dir_path"
    done
}

# Check and install Python dependencies
install_dependencies() {
    log "Checking Python dependencies..."
    
    # Check if virtual environment exists
    if [ ! -d ".venv" ]; then
        log "Creating virtual environment..."
        python -m venv .venv
    fi
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Install required packages
    log "Installing required packages..."
    pip install -r requirements.txt
    
    # Additional packages needed for deployment
    pip install uvicorn gunicorn fastapi
}

# Start the application
start_application() {
    log "Starting the application..."
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Set environment variables
    export PORT=${PORT:-8000}
    export GUNICORN_WORKERS=${GUNICORN_WORKERS:-2}
    export GUNICORN_TIMEOUT=${GUNICORN_TIMEOUT:-120}
    export GUNICORN_MAX_REQUESTS=${GUNICORN_MAX_REQUESTS:-1000}
    export GUNICORN_MAX_REQUESTS_JITTER=${GUNICORN_MAX_REQUESTS_JITTER:-50}
    
    # Start uvicorn
    log "Starting uvicorn with workers=$GUNICORN_WORKERS, port=$PORT"
    uvicorn main:app \
        --host 0.0.0.0 \
        --port $PORT \
        --workers $GUNICORN_WORKERS \
        --timeout-keep-alive $GUNICORN_TIMEOUT \
        --limit-concurrency $GUNICORN_MAX_REQUESTS \
        --limit-max-requests $GUNICORN_MAX_REQUESTS_JITTER \
        --log-level debug
}

# Main execution
log "Starting startup script..."
log "Current directory: $(pwd)"
log "Python version: $(python --version)"

# Create directories
create_directories

# Install dependencies
install_dependencies

# Start the application
start_application 