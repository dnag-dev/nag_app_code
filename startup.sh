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

# Enable debug logging
export PYTHONUNBUFFERED=1
export LOG_LEVEL=DEBUG

log "🚀 Startup script initiated..."
log "Python version: $(python --version)"

# Run initialization steps
create_directories

# 🚫 Removed pip install to avoid conflicts in production

# Start uvicorn in the foreground with additional settings
log "Starting uvicorn server..."
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port ${PORT:-8000} \
    --log-level debug \
    --timeout-keep-alive 60 \
    --timeout-graceful-shutdown 30 \
    --proxy-headers \
    --forwarded-allow-ips "*"
