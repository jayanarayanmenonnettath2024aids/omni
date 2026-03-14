@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_EXE=%~dp0..\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

echo [INFO] Using Python: %PYTHON_EXE%
"%PYTHON_EXE%" run_smoke_tests.py
set "SMOKE_EXIT=%ERRORLEVEL%"

"%PYTHON_EXE%" run_compliance_tests.py
set "COMPLIANCE_EXIT=%ERRORLEVEL%"

set "EXIT_CODE=0"
if not "%SMOKE_EXIT%"=="0" set "EXIT_CODE=%SMOKE_EXIT%"
if not "%COMPLIANCE_EXIT%"=="0" set "EXIT_CODE=%COMPLIANCE_EXIT%"

if "%EXIT_CODE%"=="0" (
    echo [INFO] Smoke and compliance tests passed.
) else (
    echo [ERROR] One or more test suites failed with exit code %EXIT_CODE%.
)

exit /b %EXIT_CODE%
