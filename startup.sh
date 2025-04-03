#!/bin/bash

# Set up logging
exec 1> >(tee -a /home/LogFiles/python.log)
exec 2>&1

echo "Starting application..."

# Check if we're running on Azure
if [ -d "/home/LogFiles" ]; then
    echo "Running on Azure"
    
    # Create necessary directories
    mkdir -p /home/LogFiles/data
    mkdir -p /home/LogFiles/static
    mkdir -p /home/LogFiles/cache
    mkdir -p /home/LogFiles/memory
    
    # Set environment variables
    export PYTHONPATH=/home/site/wwwroot
    export PYTHONUNBUFFERED=1
    export PYTHONIOENCODING=utf-8
    export UVICORN_LOG_LEVEL=debug
    export UVICORN_ACCESS_LOG=true
    
    # Change to the application directory
    cd /home/site/wwwroot
    
    # Activate virtual environment
    source antenv/bin/activate
    
    # Start the application
    echo "Starting uvicorn server..."
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level debug
else
    echo "Running locally"
    
    # Create necessary directories
    mkdir -p data
    mkdir -p static
    mkdir -p cache
    mkdir -p memory
    
    # Set environment variables
    export PYTHONPATH=$(pwd)
    export PYTHONUNBUFFERED=1
    export PYTHONIOENCODING=utf-8
    export UVICORN_LOG_LEVEL=debug
    export UVICORN_ACCESS_LOG=true
    
    # Activate virtual environment if it exists
    if [ -d "venv" ]; then
        source venv/bin/activate
    elif [ -d ".venv" ]; then
        source .venv/bin/activate
    fi
    
    # Start the application
    echo "Starting uvicorn server..."
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level debug
fi 