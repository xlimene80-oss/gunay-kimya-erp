import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models.accounting import (
    AccountType, JournalStatus, PeriodStatus, EInvoiceDirection, EInvoiceStatus
)

# ---------------------------------------------------------
# Company Schemas
# ---------------------------------------------------------
class CompanyBase(BaseModel):
    code: str = Field(..., max_length=20, description="Company unique identifier code")
    name: str = Field(..., max_length=200, description="Legal company name")
    tax_number: str = Field(..., max_length=20, description="Tax identification number (VKN)")
    tax_office: str = Field(..., max_length=100, description="Tax office title")
    base_currency: str = Field(default="TRY", max_length=3, description="ISO currency code")

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase):
    id: int
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Fiscal Period Schemas
# ---------------------------------------------------------
class FiscalPeriodBase(BaseModel):
    company_id: int = Field(..., description="Foreign key to company")
    fiscal_year: int = Field(..., ge=2000, le=2100, description="Accounting year, e.g. 2026")
    period_number: int = Field(..., ge=1, le=12, description="Period month (1 to 12)")
    start_date: datetime.date = Field(..., description="Period opening date")
    end_date: datetime.date = Field(..., description="Period closing date")
    status: PeriodStatus = Field(default=PeriodStatus.OPEN, description="Period status: OPEN, CLOSED, LOCKED")

    @model_validator(mode="after")
    def validate_dates_and_year(self):
        if self.end_date < self.start_date:
            raise ValueError(f"end_date ({self.end_date}) cannot precede start_date ({self.start_date})")
        if self.start_date.year != self.fiscal_year and self.end_date.year != self.fiscal_year:
            raise ValueError(f"start_date or end_date must align with fiscal_year {self.fiscal_year}")
        return self

class FiscalPeriodCreate(FiscalPeriodBase):
    pass

class FiscalPeriodUpdate(BaseModel):
    status: Optional[PeriodStatus] = None

class FiscalPeriodResponse(FiscalPeriodBase):
    id: int
    closed_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Chart of Accounts Schemas
# ---------------------------------------------------------
class AccountCreate(BaseModel):
    company_id: int
    account_code: str = Field(..., max_length=30, description="Account code e.g. 100.01, 120.01.001")
    name: str = Field(..., max_length=200)
    account_type: AccountType
    currency: str = Field(default="TRY", max_length=3)
    is_group: bool = False

class AccountResponse(AccountCreate):
    id: int
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Journal Item (Entry Line) Schemas
# ---------------------------------------------------------
class JournalItemBase(BaseModel):
    account_id: int = Field(..., description="Foreign key to account")
    line_number: int = Field(default=1, ge=1, description="Line sequence number")
    debit: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), description="Debit amount (Borç)")
    credit: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), description="Credit amount (Alacak)")
    description: Optional[str] = Field(default=None, max_length=255)
    cost_center: Optional[str] = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def validate_debit_credit_exclusivity(self):
        if self.debit > Decimal("0.00") and self.credit > Decimal("0.00"):
            raise ValueError("A single journal item line cannot have both positive debit and credit amounts simultaneously.")
        if self.debit == Decimal("0.00") and self.credit == Decimal("0.00"):
            raise ValueError("A journal item line must have either a positive debit or credit amount.")
        return self

class JournalItemCreate(JournalItemBase):
    pass

class JournalItemResponse(JournalItemBase):
    id: int
    journal_entry_id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

# Compatibility aliases
JournalEntryLineInput = JournalItemCreate
JournalEntryLineResponse = JournalItemResponse


# ---------------------------------------------------------
# Journal Entry (Voucher) Schemas
# ---------------------------------------------------------
class JournalEntryBase(BaseModel):
    company_id: int = Field(..., description="Foreign key to company")
    period_id: int = Field(..., description="Foreign key to open fiscal period")
    entry_number: int = Field(..., ge=1, description="Sequential voucher number within period")
    entry_date: datetime.date = Field(..., description="Voucher transaction date")
    description: str = Field(..., min_length=3, description="Voucher explanation")

class JournalEntryCreate(JournalEntryBase):
    lines: List[JournalItemCreate] = Field(..., min_length=2, description="At least two lines required for double-entry bookkeeping")

    @model_validator(mode="after")
    def validate_double_entry_balance(self):
        """Strictly enforces that total debits equal total credits across all items."""
        total_debit = sum(line.debit for line in self.lines)
        total_credit = sum(line.credit for line in self.lines)
        
        if total_debit != total_credit:
            raise ValueError(
                f"Double-entry bookkeeping balance error: Total Debit ({total_debit}) != Total Credit ({total_credit}). Balance difference: {abs(total_debit - total_credit)}"
            )
        return self

class JournalEntryResponse(JournalEntryBase):
    id: int
    status: JournalStatus
    is_immutable: bool
    total_debit: Decimal
    total_credit: Decimal
    immutable_hash: Optional[str] = None
    posted_at: Optional[datetime.datetime] = None
    lines: List[JournalItemResponse] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
