#!/bin/bash

# Debug information
echo "Current directory: $(pwd)"
echo "Listing directory contents:"
ls -la
echo "Checking Python installation:"
which python3 || echo "python3 not found"
which python || echo "python not found"

# Set up environment
export PYTHONPATH=/home/site/wwwroot
export PYTHONUNBUFFERED=1

# Create necessary directories
mkdir -p /home/LogFiles/data
mkdir -p /home/LogFiles/static
mkdir -p /home/LogFiles/cache
mkdir -p /home/LogFiles/memory

# Install dependencies
echo "Installing dependencies..."
cd /home/site/wwwroot
python3 -m pip install --no-cache-dir -r requirements.txt

# Copy default context files if they don't exist
if [ ! -f "/home/LogFiles/data/dinakara_context_full.json" ]; then
    cp data/dinakara_context_full.json /home/LogFiles/data/ 2>/dev/null || echo "No default context file found"
fi

if [ ! -f "/home/LogFiles/data/book_memory.json" ]; then
    cp data/book_memory.json /home/LogFiles/data/ 2>/dev/null || echo "No default memory file found"
fi

# Run startup tests
echo "Running startup tests..."
if [ -f "test_startup.py" ]; then
    python3 test_startup.py
    if [ $? -ne 0 ]; then
        echo "Startup tests failed. Check the logs for details."
        exit 1
    fi
else
    echo "test_startup.py not found, skipping tests"
fi

echo "Deployment completed successfully. Application will be started by Azure's web.config configuration." 