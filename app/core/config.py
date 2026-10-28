import os
from typing import AsyncGenerator, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

class Settings(BaseSettings):
    PROJECT_NAME: str = "Gunay Kimya ERP Backend"
    API_V1_STR: str = "/api/v1"
    PORT: int = int(os.getenv("PORT", "8000"))
    FRONTEND_URL: Optional[str] = os.getenv("FRONTEND_URL", None)
    
    # PostgreSQL (Render / Neon compatible) connection URI or fallback to local SQLite
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite+aiosqlite:///./app.db"
    )

    # JWT / Security Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Admin123!")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

# Normalize database URL for Render and Neon PostgreSQL asyncpg driver
raw_db_url = settings.DATABASE_URL.strip()

# Check for placeholder strings in dev
if (
    "YOUR_NEON_PASSWORD" in raw_db_url 
    or "ep-sample-123456" in raw_db_url 
    or "your_secure_password_here" in raw_db_url
    or raw_db_url == ""
):
    print("[DATABASE INFO] DATABASE_URL contains placeholder. Falling back to persistent local SQLite: 'sqlite+aiosqlite:///./app.db'")
    raw_db_url = "sqlite+aiosqlite:///./app.db"

# Convert standard postgresql:// or postgres:// to postgresql+asyncpg://
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif raw_db_url.startswith("postgresql://") and not raw_db_url.startswith("postgresql+asyncpg://"):
    raw_db_url = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Strip channel_binding if present (Neon default param not supported by asyncpg)
if "channel_binding=" in raw_db_url:
    import re
    raw_db_url = re.sub(r"[?&]channel_binding=[^&]+", "", raw_db_url)
    if "?" not in raw_db_url and "&" in raw_db_url:
        raw_db_url = raw_db_url.replace("&", "?", 1)

# Handle sslmode query parameter if present for asyncpg compatibility
if "sslmode=" in raw_db_url:
    raw_db_url = raw_db_url.replace("sslmode=require", "ssl=require").replace("sslmode=prefer", "ssl=prefer").replace("sslmode=disable", "ssl=disable")

db_url = raw_db_url
is_sqlite = db_url.startswith("sqlite")

engine_kwargs = {
    "echo": False,
    "future": True,
    "pool_pre_ping": True,
}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Production PostgreSQL pool configuration
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

# Async SQLAlchemy Engine & Session Factory
engine = create_async_engine(
    db_url,
    **engine_kwargs
)

async_session_factory = async_sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing database sessions per request."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
