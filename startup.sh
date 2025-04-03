#!/bin/bash

# Check if we're running on Azure
if [ -d "/home/LogFiles" ]; then
    # Create necessary directories for Azure
    mkdir -p /home/LogFiles/data
    mkdir -p /home/LogFiles/static
    mkdir -p /home/LogFiles/cache
    mkdir -p /home/LogFiles/memory
else
    # Create necessary directories for local development
    mkdir -p data
    mkdir -p static
    mkdir -p cache
    mkdir -p memory
fi

# Set environment variables
export PYTHONPATH=$PYTHONPATH:$(pwd)
export PYTHONUNBUFFERED=1

# Start the application with minimal configuration
echo "Starting Nag App with gunicorn..."
gunicorn main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind=0.0.0.0:8000 --timeout 120 --log-level debug 