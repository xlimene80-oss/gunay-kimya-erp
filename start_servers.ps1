# Start FastAPI and Vite as detached background processes in Windows
Write-Host "Günay Kimya ERP: Sunucular arka planda başlatılıyor..." -ForegroundColor Cyan

# 1. Start FastAPI Backend detached
Start-Process -NoNewWindow -FilePath ".venv\Scripts\uvicorn.exe" -ArgumentList "app.api:app", "--reload", "--host", "127.0.0.1", "--port", "8000"

# 2. Start Vite Frontend detached
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev"

Write-Host "✅ FastAPI: http://127.0.0.1:8000 (Swagger: /docs)" -ForegroundColor Green
Write-Host "✅ Vite Frontend: http://127.0.0.1:3000" -ForegroundColor Green
Write-Host "Sunucular arka planda çalışıyor, terminal serbest bırakıldı." -ForegroundColor Yellow
