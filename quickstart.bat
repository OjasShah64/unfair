@echo off
REM UNFAIR Quick Start Script for Windows
REM Run this to set up and start the entire system

echo.
echo ========================================
echo 🚀 UNFAIR Quick Start (Windows)
echo ========================================
echo.

REM Check Python installation
echo [INFO] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3 is required. Please install Python 3.8+
    pause
    exit /b 1
)
echo [OK] Python found
echo.

REM Setup backend
echo [INFO] Setting up backend...
cd server

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo [INFO] Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo [INFO] Installing dependencies...
pip install -q -r requirements.txt

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo [INFO] Creating .env file...
    copy .env.example .env
    echo [WARNING] Please edit .env with your settings
)

echo [OK] Backend setup complete
echo.

REM Start backend
echo [INFO] Starting backend server...
echo [INFO] Backend will run on http://localhost:5000
echo.
start "" python main.py

REM Go back to root
cd ..

REM Frontend setup
echo [INFO] Frontend setup instructions:
echo.
echo 1. Go to chrome://extensions
echo 2. Enable 'Developer mode' (top right)
echo 3. Click 'Load unpacked'
echo 4. Select the 'client/public' directory
echo.
echo [OK] Setup complete!
echo.
echo Next steps:
echo 1. A backend window should open
echo 2. Load the extension in Chrome (see instructions above)
echo 3. Start your first recording!
echo.
echo Press Ctrl+C in the backend window to stop the server
echo.
pause
