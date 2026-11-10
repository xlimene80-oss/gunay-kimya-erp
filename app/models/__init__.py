import datetime
from typing import Optional
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime, func

class Base(DeclarativeBase):
    """Base model with standard metadata and timestamp mixins."""
    pass

class TimestampMixin:
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False
    )

# 0. User Authentication & RBAC Models
from app.models.auth import (
    User, Role, UserRole, ModulePermission, UserRoleEnum, UserType
)

# 1. Automated Notifications & Event Logs
from app.models.notifications import Notification

# 2. Inventory, Chemicals & Operational Movements
from app.models.inventory import (
    Item, BatchLot, ItemCategory, LotBatch,
    GoodsReceipt, GoodsReceiptItem,
    StockTransfer, StockTransferItem,
    DispatchOrder, DispatchItem, DispatchStatus,
    BarcodeUnit, BarcodeType, BarcodeStatus,
    StockMovement
)

# 2.1 Hazmat, Warehouse Zones & Storage Compatibility
from app.models.hazmat import (
    WarehouseZone, WarehouseBin, StorageIncompatibilityRule,
    WarehousePlacementAudit, SystemConfig
)

# 3. Manufacturing, Recipes & Greenfield Traceability Footprint
from app.models.manufacturing import (
    Recipe, RecipeIngredient, ProductionOrder, ProductionStatus,
    ProductionIngredientConsumption, RecallSimulationAudit,
    BillOfMaterials, BOMItem, WorkOrder, WorkOrderStatus
)

# 4. Multi-period Accounting & Ledger
from app.models.accounting import (
    Company, FiscalPeriod, Account, JournalEntry, JournalEntryLine, EInvoicePlaceholder,
    PeriodStatus, AccountType, JournalStatus, EInvoiceDirection, EInvoiceStatus
)

# 5. Cari & Risk Engine
from app.models.cari import (
    CariGroup, CariAccount, CheckBond, GroupDiscountRule,
    CariType, RiskStatus, CheckBondType, CheckBondStatus
)

# 6. Quality Management & Laboratory CoA
from app.models.quality import (
    LotStatus, InspectionDecision,
    QualityTestTemplate, QualityTestItem,
    QualityInspection, QualityInspectionResult,
    QualityCertificateOfAnalysis
)

# 7. CRM & Customer Interactions
from app.models.crm import (
    CariNote
)

# 8. Sales Orders & B2B Dispatch Planning
from app.models.orders import (
    Order, Planning, OrderItem, SiparisKalemleri, B2BBayiFiyatlari, B2BDealerPrice
)

# 9. Procurement & Internal Purchase Requisitions
from app.models.purchasing import (
    PurchaseRequest
)

# 10. Human Resources & Talent Acquisition
from app.models.hr import (
    HRInterview, InterviewStatus,
    HRPersonnel, HRLeave, HRAttendance, HRMovement
)

# 11. Staff & Sales Reporting
from app.models.reports import (
    EmployeeReport
)

# 12. Order-triggered production work queue
from app.models.production_alerts import UretimEmri

# 13. Proforma Quotes & Discount Authorization
from app.models.proforma import (
    ProformaQuote, ProformaQuoteItem, ProformaSetting
)
