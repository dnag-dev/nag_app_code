#!/bin/bash

# Azure deployment script for Nag App

# Exit on error
set -e

echo "Starting Azure deployment process..."

# Create necessary directories
echo "Creating required directories..."
mkdir -p /home/LogFiles/data
mkdir -p /home/LogFiles/static
mkdir -p /home/LogFiles/cache
mkdir -p /home/LogFiles/memory

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Copy default context files if they don't exist
echo "Setting up default context files..."
if [ ! -f "/home/LogFiles/data/dinakara_context_full.json" ]; then
    cp data/dinakara_context_full.json /home/LogFiles/data/ 2>/dev/null || echo "No default context file found"
fi

if [ ! -f "/home/LogFiles/data/book_memory.json" ]; then
    cp data/book_memory.json /home/LogFiles/data/ 2>/dev/null || echo "No default memory file found"
fi

# Run startup tests
echo "Running startup tests..."
python test_startup.py
if [ $? -ne 0 ]; then
    echo "Startup tests failed. Check the logs for details."
    exit 1
fi

echo "Deployment completed successfully. Application will be started by Azure's starup.py 
