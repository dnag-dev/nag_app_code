#!/bin/bash

echo "📦 Zipping app for Azure deployment..."

rm -f deploy.zip

zip -r deploy.zip \
  requirements.txt \
  nag_app_code/ \
  static/ \
  data/

echo "✅ deploy.zip created with nag_app_code/, static/, and data/"
