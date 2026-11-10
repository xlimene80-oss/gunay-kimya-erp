import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class ProformaQuoteItemCreate(BaseModel):
    item_id: int
    quantity: Decimal = Field(..., gt=0)
    unit: str = "adet"
    unit_price: Decimal = Field(..., ge=0)
    discount_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    tax_rate: Decimal = Field(default=Decimal("20.00"), ge=0)

class ProformaQuoteItemResponse(BaseModel):
    id: int
    quote_id: int
    item_id: int
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    quantity: Decimal
    unit: str
    unit_price: Decimal
    discount_rate: Decimal
    discount_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    total_price: Decimal

    model_config = ConfigDict(from_attributes=True)

class ProformaQuoteCreate(BaseModel):
    cari_id: int
    valid_until: datetime.date
    currency: str = "TRY"
    exchange_rate: Decimal = Field(default=Decimal("1.0000"), gt=0)
    discount_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    tax_rate: Decimal = Field(default=Decimal("20.00"), ge=0)
    payment_terms: str = "30 Gün Vade / Banka Havalesi"
    delivery_terms: str = "Fabrika Teslim (EXW) - Kemalpaşa Depo"
    notes: Optional[str] = None
    items: List[ProformaQuoteItemCreate]

class ProformaQuoteUpdate(BaseModel):
    cari_id: Optional[int] = None
    valid_until: Optional[datetime.date] = None
    currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    discount_rate: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    items: Optional[List[ProformaQuoteItemCreate]] = None

class ProformaApprovalAction(BaseModel):
    action: str = Field(..., description="'approve' or 'reject'")
    notes: Optional[str] = None

class ProformaCustomerResponse(BaseModel):
    action: str = Field(..., description="'accept' or 'reject'")
    notes: Optional[str] = None

class ProformaSettingUpdate(BaseModel):
    max_discount_without_approval: Optional[Decimal] = Field(default=None, ge=0, le=100)
    company_name: Optional[str] = None
    company_title: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    company_web: Optional[str] = None
    tax_office: Optional[str] = None
    tax_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    iban_try: Optional[str] = None
    iban_usd: Optional[str] = None
    iban_eur: Optional[str] = None
    default_validity_days: Optional[int] = None
    default_payment_terms: Optional[str] = None
    default_delivery_terms: Optional[str] = None
    footer_note: Optional[str] = None

class ProformaSettingResponse(BaseModel):
    id: int
    max_discount_without_approval: Decimal
    company_name: str
    company_title: str
    company_address: str
    company_phone: str
    company_email: str
    company_web: str
    tax_office: str
    tax_number: str
    bank_name: str
    bank_branch: str
    iban_try: str
    iban_usd: str
    iban_eur: str
    default_validity_days: int
    default_payment_terms: str
    default_delivery_terms: str
    footer_note: str

    model_config = ConfigDict(from_attributes=True)

class ProformaQuoteResponse(BaseModel):
    id: int
    quote_number: str
    cari_id: int
    cari_name: Optional[str] = None
    cari_code: Optional[str] = None
    cari_tax_office: Optional[str] = None
    cari_tax_number: Optional[str] = None
    cari_address: Optional[str] = None
    cari_phone: Optional[str] = None
    cari_email: Optional[str] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    quote_date: datetime.datetime
    valid_until: datetime.date
    status: str
    currency: str
    exchange_rate: Decimal
    discount_rate: Decimal
    discount_amount: Decimal
    subtotal: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    grand_total: Decimal
    payment_terms: str
    delivery_terms: str
    notes: Optional[str] = None
    requires_approval: bool
    approval_status: str
    approval_notes: Optional[str] = None
    approved_by_id: Optional[int] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime.datetime] = None
    converted_order_id: Optional[int] = None
    items: List[ProformaQuoteItemResponse] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
