@echo off
TITLE DB 1.1 Connector Diagnostics & Tests
CLS

echo Running DB 1.1 Connector Tests...
echo.

node database/testConnectors.js

echo.
pause
