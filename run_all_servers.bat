@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "PYTHON_EXE=%ROOT_DIR%..\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

set "NPM_EXE=npm"
if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_EXE=%ProgramFiles%\nodejs\npm.cmd"
if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "NPM_EXE=%ProgramFiles(x86)%\nodejs\npm.cmd"

echo [INFO] Root: %ROOT_DIR%
echo [INFO] Python: %PYTHON_EXE%
echo [INFO] NPM: %NPM_EXE%

if /I "%~1"=="--dry-run" goto :dry_run

echo [INFO] Starting ERP API on http://127.0.0.1:8000 ...
start "ERP API" cmd /k "cd /d "%ROOT_DIR%" && "%PYTHON_EXE%" -m uvicorn erp_mock:app --host 127.0.0.1 --port 8000"

echo [INFO] Starting Store Mock API on http://127.0.0.1:8001 ...
start "Store Mock API" cmd /k "cd /d "%ROOT_DIR%" && "%PYTHON_EXE%" -m uvicorn store_mock:app --host 127.0.0.1 --port 8001"

echo [INFO] Starting Frontend Dev Server on http://127.0.0.1:5173 ...
start "Frontend Dev Server" cmd /k "cd /d "%ROOT_DIR%frontend" && "%NPM_EXE%" run dev -- --host 127.0.0.1 --port 5173"

echo [INFO] All server windows launched.
echo [INFO] ERP API:      http://127.0.0.1:8000
echo [INFO] Store Mock:   http://127.0.0.1:8001
echo [INFO] Frontend Dev: http://127.0.0.1:5173
goto :eof

:dry_run
echo [DRY RUN] ERP API command:
echo "%PYTHON_EXE%" -m uvicorn erp_mock:app --host 127.0.0.1 --port 8000
echo [DRY RUN] Store Mock API command:
echo "%PYTHON_EXE%" -m uvicorn store_mock:app --host 127.0.0.1 --port 8001
echo [DRY RUN] Frontend command:
echo "%NPM_EXE%" run dev -- --host 127.0.0.1 --port 5173
endlocal
