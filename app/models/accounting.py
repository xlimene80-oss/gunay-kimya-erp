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

class PeriodStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    LOCKED = "LOCKED"

class AccountType(str, enum.Enum):
    ASSET = "ASSET"                     # Aktif (1xx, 2xx)
    LIABILITY = "LIABILITY"             # Pasif (3xx, 4xx)
    EQUITY = "EQUITY"                   # Ozkaynaklar (5xx)
    REVENUE = "REVENUE"                 # Gelir (6xx)
    EXPENSE = "EXPENSE"                 # Gider (7xx)

class JournalStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"
    REVERSED = "REVERSED"

class EInvoiceDirection(str, enum.Enum):
    OUTBOUND = "OUTBOUND"
    INBOUND = "INBOUND"

class EInvoiceStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    SENT_TO_GIB = "SENT_TO_GIB"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"

class Company(Base, TimestampMixin):
    """Multi-company support for corporate structures and subsidiaries."""
    __tablename__ = "acc_companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    tax_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    tax_office: Mapped[str] = mapped_column(String(100), nullable=False)
    base_currency: Mapped[str] = mapped_column(String(3), default="TRY", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    fiscal_periods: Mapped[List["FiscalPeriod"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    accounts: Mapped[List["Account"]] = relationship(back_populates="company")
    journal_entries: Mapped[List["JournalEntry"]] = relationship(back_populates="company")

class FiscalPeriod(Base, TimestampMixin):
    """Multi-period ledger controls for accounting isolation and monthly closing."""
    __tablename__ = "acc_fiscal_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("acc_companies.id"), index=True, nullable=False)
    fiscal_year: Mapped[int] = mapped_column(Integer, index=True, nullable=False) # e.g. 2026
    period_number: Mapped[int] = mapped_column(Integer, nullable=False) # 1 - 12 (Month)
    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    status: Mapped[PeriodStatus] = mapped_column(SQLEnum(PeriodStatus), default=PeriodStatus.OPEN, nullable=False)
    closed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    company: Mapped["Company"] = relationship(back_populates="fiscal_periods")
    journal_entries: Mapped[List["JournalEntry"]] = relationship(back_populates="period")

    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_year", "period_number", name="uq_company_year_period"),
    )

class Account(Base, TimestampMixin):
    """Chart of Accounts (Tekdüzen Hesap Planı compatible)."""
    __tablename__ = "acc_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("acc_companies.id"), index=True, nullable=False)
    account_code: Mapped[str] = mapped_column(String(30), index=True, nullable=False) # e.g. "120.01.001", "150.01.002"
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(SQLEnum(AccountType), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="TRY", nullable=False)
    is_group: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False) # Group vs child account
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    company: Mapped["Company"] = relationship(back_populates="accounts")
    lines: Mapped[List["JournalEntryLine"]] = relationship(back_populates="account")

    __table_args__ = (
        UniqueConstraint("company_id", "account_code", name="uq_company_account_code"),
    )

class JournalEntry(Base, TimestampMixin):
    """Immutable financial ledger header (Yevmiye Fişi)."""
    __tablename__ = "acc_journal_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("acc_companies.id"), index=True, nullable=False)
    period_id: Mapped[int] = mapped_column(ForeignKey("acc_fiscal_periods.id"), index=True, nullable=False)
    
    entry_number: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    entry_date: Mapped[datetime.date] = mapped_column(Date, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    status: Mapped[JournalStatus] = mapped_column(SQLEnum(JournalStatus), default=JournalStatus.DRAFT, nullable=False)
    is_immutable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False) # True when POSTED
    
    total_debit: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    total_credit: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    
    posted_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Audit hash for cryptographic immutability
    immutable_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    company: Mapped["Company"] = relationship(back_populates="journal_entries")
    period: Mapped["FiscalPeriod"] = relationship(back_populates="journal_entries")
    lines: Mapped[List["JournalEntryLine"]] = relationship(back_populates="journal_entry", cascade="all, delete-orphan")
    e_invoices: Mapped[List["EInvoicePlaceholder"]] = relationship(back_populates="journal_entry")

    __table_args__ = (
        UniqueConstraint("company_id", "period_id", "entry_number", name="uq_company_period_entry_number"),
    )

class JournalEntryLine(Base, TimestampMixin):
    """Debits and credits for double-entry bookkeeping."""
    __tablename__ = "acc_journal_entry_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journal_entry_id: Mapped[int] = mapped_column(ForeignKey("acc_journal_entries.id", ondelete="CASCADE"), index=True, nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("acc_accounts.id"), index=True, nullable=False)
    
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    debit: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    credit: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    
    cost_center: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # e.g. "MFG-REACTOR-1", "LAB"

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="lines")
    account: Mapped["Account"] = relationship(back_populates="lines")

class EInvoicePlaceholder(Base, TimestampMixin):
    """E-Invoice / E-Arşiv / E-İrsaliye document tracking for Turkish Revenue Administration (GİB)."""
    __tablename__ = "acc_einvoice_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("acc_companies.id"), index=True, nullable=False)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(ForeignKey("acc_journal_entries.id"), nullable=True)

    ettn_uuid: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False) # GİB ETTN
    invoice_number: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False) # GNY202600000001
    
    direction: Mapped[EInvoiceDirection] = mapped_column(SQLEnum(EInvoiceDirection), index=True, nullable=False)
    status: Mapped[EInvoiceStatus] = mapped_column(SQLEnum(EInvoiceStatus), default=EInvoiceStatus.QUEUED, nullable=False)
    
    invoice_profile: Mapped[str] = mapped_column(String(30), default="TICARIFATURA", nullable=False) # TICARIFATURA, TEMELFATURA
    invoice_type: Mapped[str] = mapped_column(String(30), default="SATIS", nullable=False) # SATIS, IADE, TEVKIFAT
    
    issue_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    payable_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    tax_total: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="TRY", nullable=False)

    signed_xml_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    pdf_storage_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gib_response_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    journal_entry: Mapped[Optional["JournalEntry"]] = relationship(back_populates="e_invoices")
