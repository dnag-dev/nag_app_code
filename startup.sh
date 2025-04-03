#!/bin/bash

# Create necessary directories
mkdir -p /home/LogFiles/data
mkdir -p /home/LogFiles/static
mkdir -p /home/LogFiles/cache
mkdir -p /home/LogFiles/memory

# Install dependencies
/home/site/wwwroot/antenv/bin/python -m pip install uvicorn[standard] gunicorn fastapi

# Copy default context files if they don't exist
if [ ! -f "/home/LogFiles/data/dinakara_context_full.json" ]; then
    cp data/dinakara_context_full.json /home/LogFiles/data/ 2>/dev/null || echo "No default context file found"
fi

if [ ! -f "/home/LogFiles/data/book_memory.json" ]; then
    cp data/book_memory.json /home/LogFiles/data/ 2>/dev/null || echo "No default memory file found"
fi

# Run startup tests
/home/site/wwwroot/antenv/bin/python test_startup.py
if [ $? -ne 0 ]; then
    echo "Startup tests failed. Check the logs for details."
    exit 1
fi

echo "Deployment completed successfully. Application will be started by Azure's web.config configuration." 