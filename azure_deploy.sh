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

# Make startup script executable
echo "Making startup script executable..."
chmod +x startup.sh

# Copy default context files if they don't exist
echo "Setting up default context files..."
if [ ! -f "/home/LogFiles/data/dinakara_context_full.json" ]; then
    cp data/dinakara_context_full.json /home/LogFiles/data/ 2>/dev/null || echo "No default context file found"
fi

if [ ! -f "/home/LogFiles/data/book_memory.json" ]; then
    cp data/book_memory.json /home/LogFiles/data/ 2>/dev/null || echo "No default memory file found"
fi

# Start the application
echo "Starting the application..."
./startup.sh 