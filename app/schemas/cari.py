import datetime
import re
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.cari import (
    CariType, RiskStatus, CheckBondType, CheckBondStatus
)

# ---------------------------------------------------------
# Cari Group Schemas
# ---------------------------------------------------------
class CariGroupBase(BaseModel):
    code: str = Field(..., max_length=30, description="Group code, e.g. DIST_A, WHOLESALER, OEM_IND")
    name: str = Field(..., max_length=100, description="Group title")
    default_payment_term_days: int = Field(default=30, ge=0, description="Default credit payment term in days")
    default_discount_percentage: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("100.00"), description="Base discount % for group")

class CariGroupCreate(CariGroupBase):
    pass

class CariGroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    default_payment_term_days: Optional[int] = Field(default=None, ge=0)
    default_discount_percentage: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), le=Decimal("100.00"))

class CariGroupResponse(CariGroupBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Cari Account Schemas
# ---------------------------------------------------------
class CariAccountBase(BaseModel):
    code: str = Field(..., max_length=50, description="Cari code e.g. 120.01.0045")
    title: str = Field(..., max_length=250, description="Commercial title / Company name")
    cari_type: CariType = Field(default=CariType.CUSTOMER, description="Counterparty type: CUSTOMER, SUPPLIER, BOTH")
    group_id: Optional[int] = Field(default=None, description="Foreign key to CariGroup")
    tax_number: Optional[str] = Field(default=None, max_length=20, description="10-digit VKN or 11-digit TCKN")
    tax_office: Optional[str] = Field(default=None, max_length=100, description="Tax administration office")
    contact_person: Optional[str] = Field(default=None, max_length=150, description="Authorized contact person")
    phone: Optional[str] = Field(default=None, max_length=50, description="Phone number")
    email: Optional[str] = Field(default=None, max_length=120, description="Billing/contact email address")
    address: Optional[str] = Field(default=None, description="Company address")
    payment_term_days: int = Field(default=30, ge=0, description="Payment maturity term in days")
    supplied_product_ids: Optional[str] = Field(default=None, description="JSON list of supplied Item IDs (for suppliers)")
    credit_limit: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), description="Max granted credit limit")
    check_risk_limit: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), description="Max uncollected checks portfolio limit")
    allow_overlimit_sales: bool = Field(default=False, description="Whether to permit sales if credit limit is exceeded")
    is_active: bool = Field(default=True, description="Account active status")

    @field_validator("tax_number")
    @classmethod
    def validate_tax_number(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_cleaned = v.strip()
            if v_cleaned:
                if not v_cleaned.isdigit() or len(v_cleaned) not in (10, 11):
                    raise ValueError("tax_number must consist of exactly 10 digits (VKN) or 11 digits (TCKN)")
                return v_cleaned
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_cleaned = v.strip()
            if v_cleaned:
                pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
                if not re.match(pattern, v_cleaned):
                    raise ValueError(f"Invalid email address format: '{v_cleaned}'")
                return v_cleaned
        return v

class CariAccountCreate(CariAccountBase):
    pass

class CariAccountUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=250)
    cari_type: Optional[CariType] = None
    group_id: Optional[int] = None
    tax_number: Optional[str] = Field(default=None, max_length=20)
    tax_office: Optional[str] = Field(default=None, max_length=100)
    contact_person: Optional[str] = Field(default=None, max_length=150)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=120)
    address: Optional[str] = None
    payment_term_days: Optional[int] = Field(default=None, ge=0)
    supplied_product_ids: Optional[str] = None
    credit_limit: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    check_risk_limit: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    allow_overlimit_sales: Optional[bool] = None
    is_active: Optional[bool] = None

    @field_validator("tax_number")
    @classmethod
    def validate_tax_number(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_cleaned = v.strip()
            if v_cleaned:
                if not v_cleaned.isdigit() or len(v_cleaned) not in (10, 11):
                    raise ValueError("tax_number must consist of exactly 10 digits (VKN) or 11 digits (TCKN)")
                return v_cleaned
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_cleaned = v.strip()
            if v_cleaned:
                pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
                if not re.match(pattern, v_cleaned):
                    raise ValueError(f"Invalid email address format: '{v_cleaned}'")
                return v_cleaned
        return v

class CariAccountResponse(CariAccountBase):
    id: int
    current_balance: Decimal
    open_orders_balance: Decimal
    open_uncollected_checks: Decimal
    risk_status: RiskStatus
    e_invoice_registered: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Risk Limit Schema
# ---------------------------------------------------------
class RiskLimitResponse(BaseModel):
    cari_id: int
    cari_code: str
    title: str
    max_credit_limit: Decimal
    current_risk: Decimal
    utilization_pct: Decimal
    risk_status: RiskStatus
    is_blocked: bool
    message: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Check & Bond (Çek/Senet) Schemas
# ---------------------------------------------------------
class CheckBondBase(BaseModel):
    cari_id: int = Field(..., description="Foreign key to CariAccount")
    instrument_type: CheckBondType = Field(..., description="RECEIVABLE_CHECK, PAYABLE_CHECK, RECEIVABLE_BOND, PAYABLE_BOND")
    portfolio_number: str = Field(..., max_length=50, description="Internal portfolio tracking code")
    serial_number: str = Field(..., max_length=50, description="Check/Bond physical serial number")
    bank_name: str = Field(..., max_length=100, description="Bank name")
    branch_name: Optional[str] = Field(default=None, max_length=100)
    account_number: Optional[str] = Field(default=None, max_length=50)
    debtor_name: str = Field(..., max_length=200, description="Signer / debtor company or person")
    issue_date: datetime.date = Field(..., description="Date of issuance")
    maturity_date: datetime.date = Field(..., description="Due / Maturity date (vade)")
    amount: Decimal = Field(..., gt=Decimal("0.00"), description="Face value")
    currency: str = Field(default="TRY", max_length=3, description="Currency ISO code")

class CheckBondCreate(CheckBondBase):
    status: Optional[CheckBondStatus] = Field(default=CheckBondStatus.IN_PORTFOLIO)

class CheckBondUpdate(BaseModel):
    status: Optional[CheckBondStatus] = None
    amount: Optional[Decimal] = Field(default=None, gt=Decimal("0.00"))
    maturity_date: Optional[datetime.date] = None
    bounced_date: Optional[datetime.date] = None
    collected_date: Optional[datetime.date] = None

class CheckBondResponse(CheckBondBase):
    id: int
    status: CheckBondStatus
    bounced_date: Optional[datetime.date] = None
    collected_date: Optional[datetime.date] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
