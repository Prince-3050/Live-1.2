@echo off
TITLE DB 1.1 System Status & Diagnostics
CLS

echo =====================================
echo  DB 1.1 SYSTEM STATUS & DIAGNOSTICS
echo =====================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
    echo Node.js Runtime:     INSTALLED (%NODE_VER%)
) else (
    echo Node.js Runtime:     NOT FOUND
)

:: Check OpenSSH
where ssh >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%v in ('ssh -V 2^>^&1') do set SSH_VER=%%v
    echo OpenSSH Client:     INSTALLED (%SSH_VER%)
) else (
    echo OpenSSH Client:     NOT INSTALLED (Required for Demo Tunnel)
)

:: Check Backend Port 3000
netstat -aon | findstr :3000 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Backend API (3000):  ONLINE (http://127.0.0.1:3000)
) else (
    echo Backend API (3000):  OFFLINE (Run start-db11.bat)
)

:: Check Frontend Port 5173
netstat -aon | findstr :5173 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Frontend App (5173): ONLINE (http://127.0.0.1:5173)
) else (
    echo Frontend App (5173): OFFLINE
)

:: Check Local MySQL Port 3306
netstat -aon | findstr :3306 | findstr LISTENING >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo MySQL Server (3306): LISTENING (XAMPP / Native MySQL Active)
) else (
    echo MySQL Server (3306): NOT DETECTED on 127.0.0.1:3306
)

echo.
echo =====================================
echo API LIVE STATUS RESPONSE:
echo =====================================
curl -s http://127.0.0.1:3000/api/status 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo (Backend server not responding)
)
echo.
echo =====================================
pause
