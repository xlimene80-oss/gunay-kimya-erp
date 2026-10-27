import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings, engine
from app.models import Base
from app.routers import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup: Ensure database schema / tables are created
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Auto-seed initial demo master data if database is empty (no-op if records exist)
    try:
        from app.seed import seed_master_data
        await seed_master_data()
    except Exception as e:
        print(f"[STARTUP SEED INFO] Seed initialization notice: {e}")

    yield
    # Shutdown: Dispose engine connection pool
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-centric ERP Backend for Chemical Manufacturing (Günay Kimya)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration: Allow localhost, local network, and dynamic FRONTEND_URL
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if settings.FRONTEND_URL:
    for origin in settings.FRONTEND_URL.split(","):
        clean_origin = origin.strip().rstrip("/")
        if clean_origin and clean_origin not in allowed_origins:
            allowed_origins.append(clean_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:[0-9]+)?|https?://.*\.onrender\.com)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all domain routers under /api/v1 and alias /api
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router, prefix="/api")

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for Render.com monitoring and container orchestrators."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database_driver": engine.url.drivername,
        "database": str(engine.url.database or "app.db")
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
