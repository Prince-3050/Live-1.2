@echo off
TITLE Stop DB 1.1 Application
CLS

echo =====================================
echo  STOPPING DB 1.1 LOCAL DATABASE SYSTEM
echo =====================================

:: Kill Node processes running server.js or Vite
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Stopping DB 1.1 Backend process (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo Stopping DB 1.1 Frontend dev process (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ✅ DB 1.1 System stopped successfully.
echo =====================================
pause
