@echo off
echo Gunay Kimya ERP: Sunucular arka planda baslatiliyor...

start /b "" ".venv\Scripts\uvicorn.exe" app.api:app --reload --host 127.0.0.1 --port 8000
start /b "" npm run dev

echo [OK] FastAPI: http://127.0.0.1:8000
echo [OK] Vite Frontend: http://127.0.0.1:3000
echo Sunucular arka planda calisiyor, terminal serbest.
