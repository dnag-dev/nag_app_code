#!/bin/bash

echo "🔄 Creating Azure deployment package..."

# Remove old zip if it exists
rm -f deploy.zip

# Build zip with relevant files
zip -r deploy.zip \
  main.py \
  requirements.txt \
  styles.css \
  index.html \
  nag*.js \
  static/ \
  templates/ \
  .env

echo "✅ deploy.zip created successfully."
