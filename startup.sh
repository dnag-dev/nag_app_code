#!/bin/bash

# Exit on any error
set -e

echo "🔍 Checking environment..."
echo "Current directory: $(pwd)"
echo "Python version: $(python3 --version)"

# Activate virtual environment if it exists
if [ -d "antenv" ]; then
    echo "📦 Activating virtual environment..."
    source antenv/bin/activate
    echo "Using Python from: $(which python3)"
else
    echo "❌ Error: Virtual environment 'antenv' not found"
    exit 1
fi

# Verify gunicorn installation
if ! python3 -m pip list | grep -q "gunicorn"; then
    echo "🔧 Installing gunicorn..."
    python3 -m pip install gunicorn uvicorn[standard]
fi

# Verify uvicorn installation
if ! python3 -m pip list | grep -q "uvicorn"; then
    echo "🔧 Installing uvicorn..."
    python3 -m pip install uvicorn[standard]
fi

echo "📋 Installed packages:"
python3 -m pip list

echo "🚀 Starting Nag app with Gunicorn..."
exec gunicorn main:app --bind=0.0.0.0:8000 --workers=1 --worker-class=uvicorn.workers.UvicornWorker --timeout 600 --access-logfile - --error-logfile -
