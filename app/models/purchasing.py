import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import Integer, String, Text, Numeric, ForeignKey, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class PurchaseRequest(Base, TimestampMixin):
    """
    Internal procurement / purchase requisition and manual purchase order tracking.
    """
    __tablename__ = "purchase_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requested_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        index=True,
        nullable=True
    )
    item_name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), default="kg", nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), 
        default="Taslak", 
        index=True, 
        nullable=False
    )  # Taslak, Onaylandı, Sipariş Verildi, Mal Kabul Bekliyor, Reddedildi
    supplier_name: Mapped[Optional[str]] = mapped_column(String(200), index=True, nullable=True) # Tedarikçi
    unit_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=True) # Birim Fiyat (TL/USD)
    delivery_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_manual: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    vendor_email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    vendor_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # WhatsApp sipariş/teklif hattı
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    requested_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[requested_by_id], lazy="selectin")
