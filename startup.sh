#!/bin/bash

# Debug information
echo "Current directory: $(pwd)"
echo "Listing directory contents:"
ls -la

# Set up environment
export PYTHONPATH=/home/site/wwwroot
export PYTHONUNBUFFERED=1

# Create necessary directories in the correct location
echo "Creating necessary directories..."
mkdir -p /home/site/wwwroot/data
mkdir -p /home/site/wwwroot/static
mkdir -p /home/site/wwwroot/cache
mkdir -p /home/site/wwwroot/memory

# Copy files from extraction directory to the correct location
echo "Copying files to /home/site/wwwroot..."
cp -r /tmp/zipdeploy/extracted/* /home/site/wwwroot/
cp -r /tmp/zipdeploy/extracted/.* /home/site/wwwroot/ 2>/dev/null || true

# Set proper permissions
echo "Setting permissions..."
chmod -R 755 /home/site/wwwroot

# Change to the correct directory
cd /home/site/wwwroot

# Verify files are in place
echo "Verifying files in /home/site/wwwroot:"
ls -la

# Create and activate virtual environment
echo "Setting up virtual environment..."
python3 -m venv antenv
source antenv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
python -m pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
if [ -f "requirements.txt" ]; then
    echo "Installing from requirements.txt..."
    pip install --no-cache-dir -r requirements.txt
    echo "Installed packages:"
    pip list
else
    echo "ERROR: requirements.txt not found in $(pwd)"
    ls -la
    exit 1
fi

# Verify fastapi is installed
echo "Verifying fastapi installation..."
python -c "import fastapi" || {
    echo "ERROR: fastapi not installed correctly"
    pip list
    exit 1
}

# Copy default context files if they don't exist
if [ ! -f "/home/site/wwwroot/data/dinakara_context_full.json" ]; then
    cp data/dinakara_context_full.json /home/site/wwwroot/data/ 2>/dev/null || echo "No default context file found"
fi

if [ ! -f "/home/site/wwwroot/data/book_memory.json" ]; then
    cp data/book_memory.json /home/site/wwwroot/data/ 2>/dev/null || echo "No default memory file found"
fi

# Verify main.py exists
if [ ! -f "main.py" ]; then
    echo "ERROR: main.py not found in $(pwd)"
    ls -la
    exit 1
fi

# Run startup tests
echo "Running startup tests..."
if [ -f "test_startup.py" ]; then
    python test_startup.py
    if [ $? -ne 0 ]; then
        echo "Startup tests failed. Check the logs for details."
        exit 1
    fi
else
    echo "test_startup.py not found, skipping tests"
fi

echo "Deployment completed successfully. Application will be started by Azure's web.config configuration." 