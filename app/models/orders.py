import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    Integer, String, Text, Boolean, Numeric, ForeignKey, 
    DateTime, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class Order(Base, TimestampMixin):
    """
    Sales and B2B customer orders linked directly to CariAccount.
    """
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cari_id: Mapped[int] = mapped_column(
        ForeignKey("cari_accounts.id", ondelete="RESTRICT"),
        index=True,
        nullable=False
    )
    order_date: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        default=func.now(), 
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), 
        default="Beklemede", 
        index=True, 
        nullable=False
    )  # Beklemede, Onaylandı, Üretimde, Sevkiyatta, Tamamlandı, İptal
    is_b2b_order: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    items_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # Ürün kalemleri / JSON
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    cari: Mapped["CariAccount"] = relationship("CariAccount", back_populates="orders", lazy="selectin")
    planning: Mapped[Optional["Planning"]] = relationship(
        "Planning", 
        back_populates="order", 
        uselist=False, 
        cascade="all, delete-orphan", 
        lazy="selectin"
    )


class Planning(Base, TimestampMixin):
    """
    Production planning and warehouse dispatch allocation for an Order.
    """
    __tablename__ = "planning"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), 
        unique=True, 
        index=True, 
        nullable=False
    )
    work_order_no: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    target_warehouse: Mapped[str] = mapped_column(String(100), default="Ana Depo", nullable=False)
    shipment_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Planlandı", index=True, nullable=False) # Planlandı, İşleme Alındı, Tamamlandı
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="planning")
