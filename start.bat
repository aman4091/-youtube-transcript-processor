@echo off
REM Start the dev server in minimized window
start /min "Dev Server" cmd /c "npm run dev"

REM Wait 5 seconds for server to start
timeout /t 5 /nobreak >nul

REM Open browser
start http://localhost:5173

REM Exit this window immediately
exit
