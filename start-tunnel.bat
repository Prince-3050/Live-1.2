@echo off
TITLE DB 1.1 SSH Demonstration Tunnel Launcher
CLS

echo ===================================================
echo  DB 1.1 DEMONSTRATION SSH TUNNEL LAUNCHER
echo ===================================================
echo.

:: Step 1: Check OpenSSH availability
where ssh >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Windows OpenSSH Client 'ssh' is not installed or not in PATH!
    echo To enable OpenSSH on Windows 10/11:
    echo   Settings -^> Apps -^> Optional Features -^> Add 'OpenSSH Client'
    echo Or run PowerShell as Administrator:
    echo   Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('ssh -V 2^>^&1') do set SSH_VER=%%v
echo [✓] OpenSSH Detected: %SSH_VER%
echo.

:: Tunnel Configuration Placeholders
set LOCAL_PORT=3000
set REMOTE_PORT=8080
set REMOTE_USER=user
set REMOTE_HOST=your-remote-ssh-server.com

echo ---------------------------------------------------
echo  TUNNEL ARCHITECTURE:
echo  Remote User (Port %REMOTE_PORT%) -^> SSH Tunnel -^> Local PC (Port %LOCAL_PORT%) -^> Local DB (127.0.0.1:3306)
echo ---------------------------------------------------
echo  Local App Port:   %LOCAL_PORT%
echo  Remote Tunnel:    %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_PORT%
echo ---------------------------------------------------
echo.
echo NOTE: To launch reverse tunnel, update REMOTE_USER & REMOTE_HOST in start-tunnel.bat.
echo.
echo Executing command:
echo ssh -N -R %REMOTE_PORT%:127.0.0.1:%LOCAL_PORT% %REMOTE_USER%@%REMOTE_HOST%
echo.

:: Update backend tunnel mode status
curl -s -X POST http://127.0.0.1:3000/api/status/tunnel -H "Content-Type: application/json" -d "{\"active\": true}" >nul 2>&1

echo Starting tunnel in background...
start "DB 1.1 SSH Tunnel" /min ssh -N -R %REMOTE_PORT%:127.0.0.1:%LOCAL_PORT% %REMOTE_USER%@%REMOTE_HOST%

echo.
echo ✅ Tunnel process spawned.
echo DB 1.1 status set to: TUNNEL ACTIVE
echo.
echo Press any key to stop tunnel and exit...
pause >nul

call stop-tunnel.bat
