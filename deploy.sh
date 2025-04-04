#!/bin/bash

echo "📦 Zipping app for Azure deployment..."

# Create deploy.zip with all necessary files
zip -r deploy.zip \
    main.py \
    requirements.txt \
    startup.sh \
    web.config \
    static \
    data \
    .deployment \
    check_env.py \
    check_uvicorn.py \
    startup.py \
    entrypoint.py \
    healthcheck.py \
    azure.yaml \
    deploy.config.json

echo "✅ Deployment package created successfully!"
