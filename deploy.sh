#!/bin/bash

# Create a temporary directory for the deployment package
echo "Creating deployment package..."
DEPLOY_DIR="deploy_package"
mkdir -p $DEPLOY_DIR

# Copy essential files
echo "Copying essential files..."
cp main.py $DEPLOY_DIR/
cp requirements.txt $DEPLOY_DIR/
cp web.config $DEPLOY_DIR/
cp startup.sh $DEPLOY_DIR/
cp startup.txt $DEPLOY_DIR/
cp .deployment $DEPLOY_DIR/
cp test_startup.py $DEPLOY_DIR/

# Create necessary directories
mkdir -p $DEPLOY_DIR/data
mkdir -p $DEPLOY_DIR/static
mkdir -p $DEPLOY_DIR/cache
mkdir -p $DEPLOY_DIR/memory

# Copy default context files if they exist
if [ -f "data/dinakara_context_full.json" ]; then
    cp data/dinakara_context_full.json $DEPLOY_DIR/data/
fi

if [ -f "data/book_memory.json" ]; then
    cp data/book_memory.json $DEPLOY_DIR/data/
fi

# Create a zip file for deployment
echo "Creating zip file for deployment..."
cd $DEPLOY_DIR
zip -r ../deploy.zip .
cd ..

# Clean up
echo "Cleaning up..."
rm -rf $DEPLOY_DIR

echo "Deployment package created: deploy.zip"
echo "You can now deploy this package to Azure App Service." 