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

    # 3. Ensure primary admin user (admin@gunaykimya.com) exists with ADMIN role
    try:
        await ensure_admin_user()
    except Exception as e:
        print(f"[STARTUP ADMIN SEED ERROR] Failed to ensure admin user: {e}")

    # 4. Ensure Quality Management columns, tables and templates are migrated & seeded
    try:
        from app.quality_migration import run_quality_migration
        await run_quality_migration()
    except Exception as e:
        print(f"[STARTUP QUALITY MIGRATION ERROR] Quality module migration notice: {e}")

    # 5. Ensure Hazmat & Warehouse Zones columns, tables and seed data are migrated
    try:
        from app.hazmat_migration import run_hazmat_migration
        await run_hazmat_migration()
    except Exception as e:
        print(f"[STARTUP HAZMAT MIGRATION ERROR] Hazmat module migration notice: {e}")

    yield
    # Shutdown: Dispose engine connection pool
    await engine.dispose()

async def ensure_admin_user():
    """
    Ensure admin@gunaykimya.com exists in the database with the ADMIN role.
    If not present, automatically seeds it using the ADMIN_PASSWORD environment variable.
    """
    from sqlalchemy import select
    from app.core.config import async_session_factory, settings
    from app.core.security import get_password_hash
    from app.models.auth import User, Role, UserRole

    target_email = "admin@gunaykimya.com"
    admin_password = os.getenv("ADMIN_PASSWORD") or settings.ADMIN_PASSWORD or "Admin123!"

    async with async_session_factory() as session:
        stmt = select(User).where(User.email == target_email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if user:
            print(f"[STARTUP INFO] Admin kullanıcısı '{target_email}' veritabanında mevcut.")
            return

        print(f"[STARTUP INFO] '{target_email}' veritabanında bulunamadı. ADMIN_PASSWORD ile otomatik oluşturuluyor...")

        # Ensure ADMIN role exists
        role_stmt = select(Role).where(Role.role_name == "ADMIN")
        role_res = await session.execute(role_stmt)
        admin_role = role_res.scalar_one_or_none()

        if not admin_role:
            admin_role = Role(role_name="ADMIN", description="Tam Yetkili Sistem Yöneticisi")
            session.add(admin_role)
            await session.flush()

        # Create admin user
        new_admin = User(
            email=target_email,
            full_name="Kemal Günay (Sistem Yöneticisi)",
            hashed_password=get_password_hash(admin_password),
            is_active=True
        )
        session.add(new_admin)
        await session.flush()

        # Assign ADMIN role
        user_role = UserRole(user_id=new_admin.id, role_id=admin_role.id)
        session.add(user_role)
        await session.commit()
        print(f"[STARTUP SUCCESS] Admin kullanıcısı '{target_email}' başarıyla oluşturuldu ve ADMIN rolü atandı.")


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
