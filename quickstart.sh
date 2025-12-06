#!/bin/bash
# UNFAIR Quick Start Script
# Run this to set up and start the entire system

echo "🚀 UNFAIR Quick Start"
echo "===================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check Python installation
echo -e "${BLUE}Checking Python installation...${NC}"
if ! command -v python &> /dev/null; then
    echo "❌ Python 3 is required. Please install Python 3.8+"
    exit 1
fi
echo -e "${GREEN}✓ Python found${NC}"

# Setup backend
echo -e "${BLUE}Setting up backend...${NC}"
cd server

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your settings"
fi

echo -e "${GREEN}✓ Backend setup complete${NC}"

# Start backend
echo -e "${BLUE}Starting backend server...${NC}"
echo "Backend will run on http://localhost:5000"
python main.py &
BACKEND_PID=$!

# Go back to root
cd ..

# Frontend setup
echo -e "${BLUE}Frontend setup instructions:${NC}"
echo "1. Go to chrome://extensions"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the 'client/public' directory"
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "1. Backend is running on http://localhost:5000"
echo "2. Load the extension in Chrome"
echo "3. Start your first recording!"
echo ""
echo "Press Ctrl+C to stop the backend server"

wait $BACKEND_PID
