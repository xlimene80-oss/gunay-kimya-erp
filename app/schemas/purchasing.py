import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class PurchaseRequestBase(BaseModel):
    item_name: str = Field(..., max_length=200, description="Talep edilen hammadde veya malzeme adı")
    quantity: Decimal = Field(..., gt=0, description="Talep miktarı")
    unit: str = Field(default="kg", max_length=30, description="Birim: kg, lt, adet, ton, varil")
    supplier_name: Optional[str] = Field(default=None, description="Tedarikçi firma adı")
    unit_price: Optional[Decimal] = Field(default=None, description="Birim fiyat")
    delivery_date: Optional[datetime.datetime] = Field(default=None, description="Tahmini teslim tarihi")
    is_manual: Optional[bool] = Field(default=True, description="Manuel satın alma kaydı mı")
    vendor_email: Optional[str] = Field(default=None, description="Tedarikçi e-posta adresi")
    vendor_phone: Optional[str] = Field(default=None, description="Tedarikçi telefon / WhatsApp numarası (+90...)")
    notes: Optional[str] = Field(default=None, description="İç talep veya teklif notları")

class PurchaseRequestCreate(PurchaseRequestBase):
    status: Optional[str] = Field(default="Taslak")

class PurchaseRequestUpdate(BaseModel):
    item_name: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    supplier_name: Optional[str] = None
    unit_price: Optional[Decimal] = None
    delivery_date: Optional[datetime.datetime] = None
    status: Optional[str] = Field(None, description="Taslak, Onaylandı, Sipariş Verildi, Mal Kabul Bekliyor, Reddedildi")
    vendor_email: Optional[str] = None
    vendor_phone: Optional[str] = None
    notes: Optional[str] = None

class PurchaseRequestResponse(PurchaseRequestBase):
    id: int
    requested_by_id: Optional[int] = None
    status: str
    whatsapp_url: Optional[str] = None
    mailto_url: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
