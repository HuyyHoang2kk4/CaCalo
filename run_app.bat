@echo off
chcp 65001 > nul
echo ============================================================
echo   🚀 KHỞI ĐỘNG DỰ ÁN CACALO (BACKEND + FRONTEND)
echo ============================================================
echo.

echo [1/2] Đang khởi động Backend FastAPI (Port 8000)...
start "CaCalo Backend" cmd /k "cd /d d:\My_Project\CaCalo\backend && ..\.venv\Scripts\python.exe run.py"

timeout /t 3 /nobreak > nul

echo [2/2] Đang khởi động Frontend Vite (Port 5173)...
start "CaCalo Frontend" cmd /k "cd /d d:\My_Project\CaCalo\frontend && npm run dev"

echo.
echo ============================================================
echo   ✅ ĐÃ KHỞI CHẠY THÀNH CÔNG!
echo   👉 Backend API Docs: http://localhost:8000/docs
echo   👉 Frontend App:     http://localhost:5173
echo ============================================================
pause
