#!/bin/bash

# Exit on any error
set -e

echo "🔍 Checking environment..."
echo "Current directory: $(pwd)"
echo "Python version: $(python3 --version)"

# Install python3-venv if not available
if ! python3 -c "import venv" 2>/dev/null; then
    echo "📦 Installing python3-venv..."
    apt-get update && apt-get install -y python3-venv
fi

# Create virtual environment if it doesn't exist
if [ ! -d "antenv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv antenv
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source antenv/bin/activate
echo "Using Python from: $(which python3)"

# Install/upgrade pip
echo "🔧 Installing/upgrading pip..."
python3 -m pip install --upgrade pip

# Install required packages
echo "🔧 Installing required packages..."
python3 -m pip install -r requirements.txt
python3 -m pip install gunicorn uvicorn[standard]

echo "📋 Installed packages:"
python3 -m pip list

echo "🚀 Starting Nag app with Gunicorn..."
exec gunicorn main:app --bind=0.0.0.0:8000 --workers=1 --worker-class=uvicorn.workers.UvicornWorker --timeout 600 --access-logfile - --error-logfile -
