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
    User, Role, UserRole, ModulePermission
)

# 1. Automated Notifications & Event Logs
from app.models.notifications import Notification

# 2. Inventory, Chemicals & Operational Movements
from app.models.inventory import (
    Item, BatchLot, ItemCategory, LotBatch,
    GoodsReceipt, GoodsReceiptItem,
    StockTransfer, StockTransferItem,
    DispatchOrder, DispatchItem, DispatchStatus,
    BarcodeUnit, BarcodeType, BarcodeStatus
)

# 3. Manufacturing, Recipes & Greenfield Traceability Footprint
from app.models.manufacturing import (
    Recipe, RecipeIngredient, ProductionOrder, ProductionStatus,
    ProductionIngredientConsumption,
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
