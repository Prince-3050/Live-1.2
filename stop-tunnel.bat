@echo off
TITLE Stop DB 1.1 SSH Tunnel
CLS

echo ===================================================
echo  STOPPING DB 1.1 DEMONSTRATION SSH TUNNEL
echo ===================================================

:: Update backend status
curl -s -X POST http://127.0.0.1:3000/api/status/tunnel -H "Content-Type: application/json" -d "{\"active\": false}" >nul 2>&1

:: Kill ssh processes launched by tunnel
taskkill /F /FI "WINDOWTITLE eq DB 1.1 SSH Tunnel*" >nul 2>&1
taskkill /F /IM ssh.exe >nul 2>&1

echo.
echo ✅ Demonstration SSH Tunnel stopped.
echo DB 1.1 status reset to: LOCAL MODE
echo ===================================================
pause
