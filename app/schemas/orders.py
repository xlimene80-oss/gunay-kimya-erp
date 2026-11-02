import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------
# Planning Schemas
# ---------------------------------------------------------
class PlanningBase(BaseModel):
    work_order_no: str = Field(..., max_length=100, description="Üretim / Sevkiyat iş planlama kodu")
    target_warehouse: str = Field(default="Ana Depo", max_length=100)
    shipment_date: Optional[datetime.datetime] = None
    status: str = Field(default="Planlandı", description="Planlandı, İşleme Alındı, Tamamlandı")
    notes: Optional[str] = None

class PlanningCreate(PlanningBase):
    order_id: int

class PlanningUpdate(BaseModel):
    target_warehouse: Optional[str] = None
    shipment_date: Optional[datetime.datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PlanningResponse(PlanningBase):
    id: int
    order_id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Order Schemas
# ---------------------------------------------------------
class OrderBase(BaseModel):
    total_amount: Decimal = Field(default=Decimal("0.00"), description="Toplam sipariş tutarı")
    items_summary: Optional[str] = Field(default=None, description="Sipariş verilen ürünler / kalem detayları")
    notes: Optional[str] = Field(default=None, description="Sipariş notları")

class OrderCreate(OrderBase):
    cari_id: int = Field(..., description="Siparişi veren Cari ID")
    status: str = Field(default="Beklemede")
    is_b2b_order: bool = Field(default=False)

class OrderB2BCreate(OrderBase):
    """
    B2B Portal sipariş oluşturma şeması. 
    cari_id istemez; oturum açan müşterinin token'ından (current_user.cari_id) güvenle atanır.
    """
    pass

class OrderUpdate(BaseModel):
    status: Optional[str] = Field(None, description="Beklemede, Onaylandı, Üretimde, Sevkiyatta, Tamamlandı, İptal")
    total_amount: Optional[Decimal] = None
    items_summary: Optional[str] = None
    notes: Optional[str] = None

class OrderResponse(OrderBase):
    id: int
    cari_id: int
    order_date: datetime.datetime
    status: str
    is_b2b_order: bool
    planning: Optional[PlanningResponse] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
