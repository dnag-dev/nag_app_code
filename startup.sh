#!/bin/bash

# Exit on error
set -e

# Enable verbose output
set -x

# Create necessary directories
echo "Creating required directories..."
mkdir -p /home/LogFiles/data
mkdir -p /home/LogFiles/static
mkdir -p /home/LogFiles/cache
mkdir -p /home/LogFiles/memory

# Set environment variables
echo "Setting environment variables..."
export PYTHONPATH=$PYTHONPATH:$(pwd)
export PYTHONUNBUFFERED=1

# Check if required files exist
echo "Checking required files..."
if [ ! -f "main.py" ]; then
    echo "ERROR: main.py not found!"
    exit 1
fi

if [ ! -f "requirements.txt" ]; then
    echo "ERROR: requirements.txt not found!"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start the application with detailed logging
echo "Starting Nag App with gunicorn..."
exec gunicorn main:app \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind=0.0.0.0:8000 \
    --timeout 120 \
    --log-level debug \
    --access-logfile - \
    --error-logfile - \
    --capture-output 