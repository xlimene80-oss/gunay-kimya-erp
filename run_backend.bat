@echo off
cd /d "c:\Users\CASPER\Desktop\gunay kimya"
set PYTHONPATH=.
.venv\Scripts\python.exe -m uvicorn app.api:app --reload --port 8000 > backend.log 2>&1
