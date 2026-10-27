import enum
import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Text, Numeric, Integer, Boolean, ForeignKey, 
    DateTime, Date, Enum as SQLEnum, Index, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class CariType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"                   # Müşteri
    SUPPLIER = "SUPPLIER"                   # Tedarikçi (Hammaddeler, Ambalaj vb.)
    BOTH = "BOTH"

class RiskStatus(str, enum.Enum):
    HEALTHY = "HEALTHY"                     # Normal risk limits
    APPROACHING_LIMIT = "APPROACHING_LIMIT" # 80%+ limit utilized
    BLOCKED = "BLOCKED"                     # Over-limit or bounced checks, no dispatch allowed

class CheckBondType(str, enum.Enum):
    RECEIVABLE_CHECK = "RECEIVABLE_CHECK"   # Alınan Çek
    PAYABLE_CHECK = "PAYABLE_CHECK"         # Verilen Çek
    RECEIVABLE_BOND = "RECEIVABLE_BOND"     # Alınan Senet
    PAYABLE_BOND = "PAYABLE_BOND"           # Verilen Senet

class CheckBondStatus(str, enum.Enum):
    IN_PORTFOLIO = "IN_PORTFOLIO"           # Portföyde
    IN_BANK_COLLECTION = "IN_BANK_COLLECTION" # Bankada tahsilde
    ENDORSED = "ENDORSED"                   # Ciro edildi (örn. hammadde tedarikçisine verildi)
    COLLECTED = "COLLECTED"                 # Tahsil edildi
    BOUNCED = "BOUNCED"                     # Karşılıksız / Protestolu
    RETURNED = "RETURNED"                   # İade edildi

class CariGroup(Base, TimestampMixin):
    """Customer / Supplier classification groups (e.g. Industrial Bulk, Wholesalers, Retail Chains)."""
    __tablename__ = "cari_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False) # e.g. "DIST_A", "OEM_IND"
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    default_payment_term_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    default_discount_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    
    caris: Mapped[List["CariAccount"]] = relationship(back_populates="group")
    discount_rules: Mapped[List["GroupDiscountRule"]] = relationship(back_populates="group", cascade="all, delete-orphan")

class CariAccount(Base, TimestampMixin):
    """Cari master record with real-time exposure and credit risk limits."""
    __tablename__ = "cari_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False) # e.g. "120.01.0045"
    title: Mapped[str] = mapped_column(String(250), index=True, nullable=False)
    cari_type: Mapped[CariType] = mapped_column(SQLEnum(CariType), default=CariType.CUSTOMER, index=True, nullable=False)
    group_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cari_groups.id"), nullable=True)

    # Tax Credentials
    tax_number: Mapped[Optional[str]] = mapped_column(String(20), index=True, nullable=True) # VKN or TCKN
    tax_office: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    e_invoice_registered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Contact & Commercial Details
    contact_person: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_term_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    supplied_product_ids: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON list of item IDs for suppliers
    
    # Financial Balances
    current_balance: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False) # (+) Receivable, (-) Payable
    open_orders_balance: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False) # Orders in queue
    
    # Credit Risk Limit Engine
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    check_risk_limit: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    open_uncollected_checks: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    
    risk_status: Mapped[RiskStatus] = mapped_column(SQLEnum(RiskStatus), default=RiskStatus.HEALTHY, index=True, nullable=False)
    allow_overlimit_sales: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    group: Mapped[Optional["CariGroup"]] = relationship(back_populates="caris")
    check_bonds: Mapped[List["CheckBond"]] = relationship(
        "CheckBond",
        foreign_keys="[CheckBond.cari_id]",
        back_populates="cari"
    )

class CheckBond(Base, TimestampMixin):
    """Maturity and risk monitoring for Checks and Promissory Notes (Çek/Senet)."""
    __tablename__ = "cari_check_bonds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cari_id: Mapped[int] = mapped_column(ForeignKey("cari_accounts.id"), index=True, nullable=False)
    
    instrument_type: Mapped[CheckBondType] = mapped_column(SQLEnum(CheckBondType), index=True, nullable=False)
    status: Mapped[CheckBondStatus] = mapped_column(
        SQLEnum(CheckBondStatus), 
        default=CheckBondStatus.IN_PORTFOLIO, 
        index=True, 
        nullable=False
    )
    
    portfolio_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    serial_number: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Banking details
    bank_name: Mapped[str] = mapped_column(String(100), nullable=False)
    branch_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    debtor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    
    # Financials & Dates
    issue_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    maturity_date: Mapped[datetime.date] = mapped_column(Date, index=True, nullable=False) # Vade
    amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="TRY", nullable=False)
    
    endorsed_to_supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cari_accounts.id"), nullable=True)
    bounced_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    collected_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)

    cari: Mapped["CariAccount"] = relationship("CariAccount", foreign_keys=[cari_id], back_populates="check_bonds")

class GroupDiscountRule(Base, TimestampMixin):
    """Discount matrices configured per group and chemical category / SKU."""
    __tablename__ = "cari_group_discount_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("cari_groups.id", ondelete="CASCADE"), index=True, nullable=False)
    item_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True) # RAW_MATERIAL, PACKAGED_GOOD, etc.
    item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_items.id"), nullable=True)
    
    discount_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False) # e.g. 7.50 %
    min_order_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    valid_from: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    group: Mapped["CariGroup"] = relationship(back_populates="discount_rules")
