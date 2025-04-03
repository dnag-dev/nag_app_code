#!/bin/bash

# Set environment variables
export PYTHONPATH=$PYTHONPATH:/home/site/wwwroot
export PYTHONUNBUFFERED=1

# Create necessary directories
mkdir -p /home/site/wwwroot/data
mkdir -p /home/site/wwwroot/static
mkdir -p /home/site/wwwroot/cache
mkdir -p /home/site/wwwroot/memory

# Start the application
cd /home/site/wwwroot
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2 