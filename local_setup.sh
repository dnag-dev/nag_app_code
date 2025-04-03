#!/bin/bash

# Check if we're in an excluded directory
CURRENT_DIR=$(basename "$PWD")
if [[ "$CURRENT_DIR" == "NagAppNew" || "$CURRENT_DIR" == "NagAppNew2" || "$CURRENT_DIR" == "NagAppNewPure" || "$CURRENT_DIR" == "NagAppDev" ]]; then
    echo "This directory is excluded from deployment."
    exit 0
fi

# Create necessary directories
echo "Creating required directories..."
mkdir -p data
mkdir -p audio
mkdir -p static
mkdir -p models

# Set proper permissions
echo "Setting directory permissions..."
chmod 755 data
chmod 755 audio
chmod 755 static
chmod 755 models

# Create default files if they don't exist
echo "Creating default files if they don't exist..."

# Create dinakara_context_full.json if it doesn't exist
if [ ! -f "data/dinakara_context_full.json" ]; then
    echo "Creating default dinakara_context_full.json..."
    cat > data/dinakara_context_full.json << 'EOL'
{
    "personality": {
        "traits": ["empathetic", "knowledgeable", "professional"],
        "style": "friendly and engaging"
    },
    "knowledge_base": {
        "expertise": ["technology", "business", "leadership"],
        "specialties": ["AI", "digital transformation", "innovation"]
    },
    "modes": {
        "chat": {
            "prompt": "You are engaging in a general conversation.",
            "style": "conversational"
        },
        "book": {
            "prompt": "You are discussing books and reading habits.",
            "style": "educational"
        },
        "voice": {
            "prompt": "You are providing voice responses.",
            "style": "clear and articulate"
        }
    }
}
EOL
fi

# Create book_memory.json if it doesn't exist
if [ ! -f "data/book_memory.json" ]; then
    echo "Creating default book_memory.json..."
    cat > data/book_memory.json << 'EOL'
{
    "current_book": null,
    "completed_books": [],
    "reading_stats": {
        "current_streak": 0,
        "total_books_read": 0
    }
}
EOL
fi

# Create .gitkeep files to ensure directories are tracked
echo "Creating .gitkeep files..."
touch data/.gitkeep
touch audio/.gitkeep
touch static/.gitkeep
touch models/.gitkeep

# Set proper permissions for files
echo "Setting file permissions..."
chmod 644 data/*.json
chmod 644 data/.gitkeep
chmod 644 audio/.gitkeep
chmod 644 static/.gitkeep
chmod 644 models/.gitkeep

# Download Whisper model if not already present
echo "Checking for Whisper model..."
if [ ! -d "models/whisper-base" ]; then
    echo "Downloading Whisper base model..."
    python3 -c "import whisper; whisper.load_model('base')"
    echo "Whisper model downloaded successfully!"
else
    echo "Whisper model already exists."
fi

echo "Deployment setup completed successfully!" 