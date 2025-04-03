#!/bin/bash

# Debug information
echo "Current directory: $(pwd)"
echo "Listing directory contents:"
ls -la
echo "Checking Python installation:"
which python3 || echo "python3 not found"
which python || echo "python not found"
find / -name python -type f -executable 2>/dev/null || echo "No Python found in system"

# Create necessary directories
mkdir -p /home/LogFiles/data
mkdir -p /home/LogFiles/static
mkdir -p /home/LogFiles/cache
mkdir -p /home/LogFiles/memory

# Install pip if it's not available
if ! command -v pip &> /dev/null; then
    echo "Installing pip..."
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3 get-pip.py
    rm get-pip.py
fi

# Install dependencies
echo "Installing dependencies..."
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
python3 test_startup.py
if [ $? -ne 0 ]; then
    echo "Startup tests failed. Check the logs for details."
    exit 1
fi

echo "Deployment completed successfully. Application will be started by Azure's web.config configuration." 