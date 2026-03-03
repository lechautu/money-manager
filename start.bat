@echo off
echo ===================================================
echo     Starting Money Manager 2 System
echo ===================================================
echo.

echo [1/4] Starting Tool Gateway (Port 3200)...
start "Tool Gateway (Port 3200)" cmd /k "cd tool-gateway && npm run dev"

:: Wait 2 seconds to ensure clean startup sequence
timeout /t 2 /nobreak > nul

echo [2/4] Starting MCP Server (Port 3100)...
start "MCP Server (Port 3100)" cmd /k "cd mcp-server && npm run dev"

timeout /t 2 /nobreak > nul

echo [3/4] Starting AI Gateway (Port 3300)...
start "AI Gateway (Port 3300)" cmd /k "cd ai-gateway && npm run dev"

timeout /t 2 /nobreak > nul

echo [4/4] Starting Frontend Client (Port 5173)...
start "Frontend Client (Port 5173)" cmd /k "npm run dev"

echo.
echo ===================================================
echo  All services have been launched in separate windows!
echo  You can close this window now.
echo ===================================================
timeout /t 5
