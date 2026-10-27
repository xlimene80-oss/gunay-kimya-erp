"""
API Entrypoint Alias for Günay Kimya Greenfield ERP Backend.
Allows running with:
    uvicorn app.api:app --reload --port 8000
as well as:
    uvicorn app.main:app --reload --port 8000
"""
from app.main import app

__all__ = ["app"]
