#!/bin/bash

echo "📦 Zipping app for Azure deployment..."

rm -f deploy.zip

# Include all necessary files from the nag_app_code folder
zip -r deploy.zip \
  nag_app_code \
  static \
  data \
  requirements.txt
