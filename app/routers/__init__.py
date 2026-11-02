from fastapi import APIRouter
from app.routers.auth import router as auth_router
from app.routers.inventory import router as inventory_router
from app.routers.manufacturing import router as manufacturing_router
from app.routers.cari import router as cari_router
from app.routers.accounting import router as accounting_router
from app.routers.notifications import router as notifications_router
from app.routers.quality import router as quality_router
from app.routers.hazmat import router as hazmat_router
from app.routers.production_router import router as production_router
from app.routers.orders import router as orders_router
from app.routers.crm import router as crm_router
from app.routers.purchasing import router as purchasing_router
from app.routers.hr import router as hr_router
from app.routers.reports import router as reports_router

api_router = APIRouter()

# Register core domain routers
api_router.include_router(auth_router)
api_router.include_router(inventory_router)
api_router.include_router(manufacturing_router)
api_router.include_router(production_router)
api_router.include_router(cari_router)
api_router.include_router(accounting_router)
api_router.include_router(notifications_router)
api_router.include_router(quality_router)
api_router.include_router(hazmat_router)

# Register new enterprise ERP expansion routers
api_router.include_router(orders_router)
api_router.include_router(crm_router)
api_router.include_router(purchasing_router)
api_router.include_router(hr_router)
api_router.include_router(reports_router)
