#!/bin/bash

# Debug information
echo "Current directory: $(pwd)"
echo "Listing directory contents:"
ls -la

# Set up environment
export PYTHONPATH=/home/site/wwwroot
export PYTHONUNBUFFERED=1

# Find Python installation
echo "Finding Python installation..."
PYTHON_PATH=$(which python3)
if [ -z "$PYTHON_PATH" ]; then
    echo "ERROR: Python3 not found"
    exit 1
fi
echo "Using Python at: $PYTHON_PATH"

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

# Create virtual environment in a temporary location
echo "Setting up virtual environment..."
TEMP_VENV="/tmp/antenv"
rm -rf $TEMP_VENV
python3 -m venv $TEMP_VENV

# Activate virtual environment
echo "Activating virtual environment..."
source $TEMP_VENV/bin/activate

# Install pip directly
echo "Installing pip..."
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python3 get-pip.py --no-warn-script-location
rm get-pip.py

# Upgrade pip
echo "Upgrading pip..."
python3 -m pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
if [ -f "requirements.txt" ]; then
    echo "Installing from requirements.txt..."
    python3 -m pip install --no-cache-dir -r requirements.txt
    echo "Installed packages:"
    python3 -m pip list
else
    echo "ERROR: requirements.txt not found in $(pwd)"
    ls -la
    exit 1
fi

# Verify critical packages are installed
echo "Verifying critical package installations..."
for package in "fastapi" "uvicorn" "gunicorn"; do
    echo "Checking $package..."
    python3 -c "import $package" || {
        echo "ERROR: $package not installed correctly"
        echo "Attempting to reinstall $package..."
        if [ "$package" = "uvicorn" ]; then
            python3 -m pip install --no-cache-dir "uvicorn[standard]"
        else
            python3 -m pip install --no-cache-dir $package
        fi
        python3 -c "import $package" || {
            echo "ERROR: Failed to install $package"
            python3 -m pip list
            exit 1
        }
    }
done

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

# Set up Python path for the application
echo "Setting up Python path..."
export PYTHONPATH=/home/site/wwwroot:$PYTHONPATH
echo "PYTHONPATH: $PYTHONPATH"

# Verify main module can be imported
echo "Verifying main module can be imported..."
python3 -c "import main" || {
    echo "ERROR: main module cannot be imported"
    echo "Current directory: $(pwd)"
    echo "Directory contents:"
    ls -la
    exit 1
}

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

# Copy virtual environment to final location
echo "Copying virtual environment to final location..."
rm -rf antenv
cp -r $TEMP_VENV antenv
chmod -R 755 antenv

# Verify uvicorn worker is available
echo "Verifying uvicorn worker availability..."
python3 -c "from uvicorn.workers import UvicornWorker" || {
    echo "ERROR: UvicornWorker not found"
    echo "Attempting to reinstall uvicorn[standard]..."
    python3 -m pip install --no-cache-dir "uvicorn[standard]"
    python3 -c "from uvicorn.workers import UvicornWorker" || {
        echo "ERROR: Failed to install uvicorn[standard]"
        exit 1
    }
}

# Final verification of uvicorn installation
echo "Final verification of uvicorn installation..."
python3 -c "import uvicorn; print('Uvicorn version:', uvicorn.__version__)" || {
    echo "ERROR: Final uvicorn verification failed"
    exit 1
}

echo "Deployment completed successfully. Application will be started by Azure's web.config configuration." 