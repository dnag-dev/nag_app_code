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

# Install dependencies using Azure’s default Python
install_dependencies() {
    log "Installing Python dependencies (without venv)..."
    pip install --upgrade pip
    pip install --no-cache-dir -r /home/site/wwwroot/requirements.txt
}

# Start FastAPI app
start_application() {
    log "Starting FastAPI app with Uvicorn..."

    cd /home/site/wwwroot || exit 1

    uvicorn main:app \
        --host 0.0.0.0 \
        --port ${PORT:-8000} \
        --workers ${GUNICORN_WORKERS:-2} \
        --timeout-keep-alive ${GUNICORN_TIMEOUT:-120} \
        --limit-concurrency ${GUNICORN_MAX_REQUESTS:-1000} \
        --limit-max-requests ${GUNICORN_MAX_REQUESTS_JITTER:-50} \
        --log-level debug
}

log "🚀 Startup script initiated..."
log "Python version: $(python --version)"

create_directories
install_dependencies
start_application
