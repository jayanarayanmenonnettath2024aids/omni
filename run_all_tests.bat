@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_EXE=%~dp0..\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

echo [INFO] Using Python: %PYTHON_EXE%
"%PYTHON_EXE%" run_smoke_tests.py
set "EXIT_CODE=%ERRORLEVEL%"

if "%EXIT_CODE%"=="0" (
    echo [INFO] All smoke tests passed.
) else (
    echo [ERROR] Smoke tests failed with exit code %EXIT_CODE%.
)

exit /b %EXIT_CODE%
