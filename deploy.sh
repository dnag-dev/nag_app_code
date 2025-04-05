#!/bin/bash

# Exit on any error
set -e

echo "🔄 Cleaning old deploy.zip if exists..."
rm -f deploy.zip

echo "📁 Creating zip package for Azure deployment..."
zip -r deploy.zip \
    main.py \
    requirements.txt \
    web.config \
    .deployment \
    check_env.py \
    check_uvicorn.py \
    startup.py \
    azure.yaml \
    deploy.config.json \
    static/ \
    data/ \
    audio/.gitkeep \
    models/.gitkeep

echo "✅ Zipping complete: deploy.zip ready"

# Optional: Deploy using Azure CLI or GitHub Actions
# az webapp deployment source config-zip --resource-group <your-rg> --name <your-app-name> --src deploy.zip
