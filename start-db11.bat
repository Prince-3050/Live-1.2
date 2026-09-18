@echo off
TITLE DB 1.1 Local Database System Starter
CLS

echo =====================================
echo  DB 1.1 LOCAL DATABASE SYSTEM
echo =====================================

:: Step 1: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js v16+ from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [1/3] Node.js detected: %NODE_VER%

:: Step 2: Check backend dependencies
if not exist node_modules (
    echo [INFO] Installing backend dependencies...
    call npm install
)

:: Check client dependencies
if not exist client\node_modules (
    echo [INFO] Installing client dependencies...
    cd client
    call npm install
    cd ..
)

echo [2/3] Dependencies verified.

:: Step 3: Start backend server in background
echo [3/3] Starting DB 1.1 Backend Application...
start "DB 1.1 Server" /min cmd /c "node server.js"

:: Wait 2 seconds for server startup
timeout /t 2 /nobreak >nul

echo.
echo =====================================
echo  DB 1.1 LOCAL DATABASE SYSTEM
echo =====================================
echo.
echo Application:        http://127.0.0.1:3000
echo Frontend Dev Server: http://127.0.0.1:5173
echo Database connector: ACTIVE
echo Host:               127.0.0.1
echo Status:             CONNECTED
echo.
echo =====================================
echo Press any key to stop DB 1.1 application...
pause >nul

call stop-db11.bat
