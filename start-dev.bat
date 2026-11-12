@echo off
title Chaat Kulture OS - Backend & Frontend Server
cd /d "%~dp0"
echo ========================================================
echo   CHAAT KULTURE OS - Multi-Location Operations Platform
echo   Local Backend (Port 3001) + Frontend PWA (Port 5173)
echo ========================================================
echo.
echo Starting Local Backend Server and Vite Frontend...
echo Application URL: http://localhost:5173
echo Backend API URL: http://localhost:3001/api/health
echo Database File:   data\local_db.json
echo.
npm run dev
pause
