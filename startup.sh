#!/bin/bash

# Set environment variables
export PYTHONPATH=/home/site/wwwroot
export PYTHONUNBUFFERED=1

# Create necessary directories
mkdir -p /home/site/wwwroot/data
mkdir -p /home/site/wwwroot/static
mkdir -p /home/site/wwwroot/cache
mkdir -p /home/site/wwwroot/memory

# Change to the application directory
cd /home/site/wwwroot

# Install uvicorn if it's not already installed
/home/site/wwwroot/antenv/bin/python -m pip install uvicorn[standard] gunicorn fastapi

# Start the application
/home/site/wwwroot/antenv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2 