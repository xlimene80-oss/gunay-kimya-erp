import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import Integer, String, Text, Numeric, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class PurchaseRequest(Base, TimestampMixin):
    """
    Internal procurement / purchase requisition tracking with vendor notification support.
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
        default="Onay Bekliyor", 
        index=True, 
        nullable=False
    )  # Onay Bekliyor, Onaylandı, Satınalma Yapıldı, Reddedildi
    vendor_email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    vendor_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # WhatsApp sipariş/teklif hattı
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    requested_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[requested_by_id], lazy="selectin")
