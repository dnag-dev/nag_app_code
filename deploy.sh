#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🔄 Cleaning old deploy.zip if exists..."
rm -f deploy.zip

echo "📁 Creating zip package for Azure deployment..."

zip -r deploy.zip \
    main.py \
    requirements.txt \
    .deployment \
    check_env.py \
    check_uvicorn.py \
    startup.py \
    azure.yaml \
    deploy.config.json \
    static/ \
    data/ \
    .github/ \
    audio/ \
    models/ || { echo "❌ Zipping failed"; exit 1; }

echo "✅ Zipping complete: deploy.zip ready"

# Uncomment to test deploy locally with Azure CLI:
# az webapp deployment source config-zip --resource-group <your-rg> --name <your-app-name> --src deploy.zip
