@echo off
start "Gunay Kimya Backend" /min .venv\Scripts\uvicorn.exe app.api:app --reload --port 8000 --app-dir .
start "Gunay Kimya Frontend" /min cmd /c "cd /d frontend && npm run dev"
