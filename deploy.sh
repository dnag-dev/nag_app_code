#!/bin/bash

# Exit on any error
set -e

echo "🔄 Cleaning old deploy.zip if exists..."
rm -f deploy.zip

echo "📁 Creating zip package for Azure deployment..."
zip -r deploy.zip \
    main.py \
    requirements.txt \
    entrypoint.py \
    healthcheck.py \
    startup.py \
    web.config \
    test_startup.py \
    static/ \
    data/ \
    audio/.gitkeep \
    models/.gitkeep \
    .deployment \
    .github/ \
    .github/workflows/ \
    check_env.py \
    check_uvicorn.py \
    azure.yaml \
    deploy.config.json

echo "✅ Zipping complete: deploy.zip ready"

# Optional: Deploy using Azure CLI or GitHub Actions
# az webapp deployment source config-zip --resource-group <your-rg> --name <your-app-name> --src deploy.zip
