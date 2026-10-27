from fastapi import APIRouter
from app.routers.auth import router as auth_router
from app.routers.inventory import router as inventory_router
from app.routers.manufacturing import router as manufacturing_router
from app.routers.cari import router as cari_router
from app.routers.accounting import router as accounting_router
from app.routers.notifications import router as notifications_router

api_router = APIRouter()

# Register core domain routers
api_router.include_router(auth_router)
api_router.include_router(inventory_router)
api_router.include_router(manufacturing_router)
api_router.include_router(cari_router)
api_router.include_router(accounting_router)
api_router.include_router(notifications_router)
