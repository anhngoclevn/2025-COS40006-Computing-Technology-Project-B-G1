@echo off
echo ========================================
echo Starting Video Processing API Server
echo Active Learning System
echo ========================================
echo.

cd /d "%~dp0"

REM Check if folders exist
if not exist "uploads" mkdir uploads
if not exist "outputs" mkdir outputs
if not exist "models" (
    echo ERROR: models folder not found!
    echo Please ensure models folder contains:
    echo   - yolov8n.pt
    echo   - student_behaviour_best.onnx
    pause
    exit /b 1
)

echo Checking Python environment...
call conda activate projectB-ai-env 2>nul
if errorlevel 1 (
    echo Warning: Could not activate conda environment
    echo Using system Python...
)

echo.
echo Checking required models...
if not exist "models\yolov8n.pt" (
    echo ERROR: yolov8n.pt not found in models folder!
    pause
    exit /b 1
)
if not exist "models\student_behaviour_best.onnx" (
    echo ERROR: student_behaviour_best.onnx not found in models folder!
    pause
    exit /b 1
)

echo.
echo Starting Flask API on port 5001...
echo Server will be available at: http://localhost:5001
echo Health check: http://localhost:5001/health
echo.
echo Press Ctrl+C to stop the server
echo.
python video_processing_api.py

pause
