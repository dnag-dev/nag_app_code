#!/bin/bash

echo "🚀 Starting Nag app with Gunicorn..."

# Activate virtual environment if it exists (in case of local use)
if [ -d "antenv" ]; then
  echo "🔧 Activating virtual environment..."
  source antenv/bin/activate
fi

# Set environment variables if needed
export PORT=8000
export GUNICORN_CMD_ARGS="--bind=0.0.0.0:$PORT --workers=1 --worker-class=uvicorn.workers.UvicornWorker"

# Start Gunicorn with main:app
exec gunicorn main:app
