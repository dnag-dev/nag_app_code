#!/bin/bash

echo "🚀 Starting Gunicorn with UvicornWorker..."

# Set default values
APP_MODULE=${APP_MODULE:-main:app}
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}
WORKERS=${WORKERS:-1}
TIMEOUT=${TIMEOUT:-600}

# Activate virtual environment if exists
if [ -d "antenv/bin" ]; then
  echo "🔹 Activating virtual environment..."
  source antenv/bin/activate
fi

# Run Gunicorn with Uvicorn workers
exec gunicorn \
  --bind "${HOST}:${PORT}" \
  --workers "${WORKERS}" \
  --timeout "${TIMEOUT}" \
  --worker-class uvicorn.workers.UvicornWorker \
  "${APP_MODULE}"
