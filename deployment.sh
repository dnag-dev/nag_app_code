#!/bin/bash
set -e

echo "🔄 Cleaning previous deploy.zip if exists..."
rm -f deploy.zip

echo "✅ Verifying required files..."
required_files=(main.py requirements.txt startup.py)
for file in "${required_files[@]}"; do
  [ ! -f "$file" ] && echo "❌ Missing: $file" && exit 1
done

echo "📁 Creating deployment zip package..."
zip -r deploy.zip \
    main.py \
    requirements.txt \
    startup.py \
    .deployment \
    azure.yaml \
    deploy.config.json \
    check_env.py \
    check_uvicorn.py \
    static/ \
    data/ \
    audio/ \
    models/ \
    .github/ \
    -x "*.DS_Store" "__pycache__/*" || { echo "❌ Zipping failed"; exit 1; }

echo "✅ Zipping complete: deploy.zip ready for Azure"

# To deploy:
# az webapp deployment source config-zip --resource-group <your-rg> --name <your-app-name> --src deploy.zip 