import datetime
from decimal import Decimal
from typing import Optional, List
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
    items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    @property
    def order_items(self) -> List["OrderItem"]:
        return self.items

    @property
    def siparis_kalemleri(self) -> List["OrderItem"]:
        return self.items


class OrderItem(Base, TimestampMixin):
    """
    SiparisKalemleri: Individual product, quantity, unit price line item inside an Order.
    """
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="RESTRICT"), 
        index=True, 
        nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")
    item: Mapped["Item"] = relationship("Item", lazy="selectin")

    @property
    def item_name(self) -> Optional[str]:
        return self.item.name if self.item else None

    @property
    def item_sku(self) -> Optional[str]:
        return self.item.sku if self.item else None

    @property
    def item_unit(self) -> Optional[str]:
        return self.item.unit if self.item else None


SiparisKalemleri = OrderItem


class B2BBayiFiyatlari(Base, TimestampMixin):
    """
    B2B Bayi özel ürün fiyat listesi (B2BBayiFiyatlari).
    """
    __tablename__ = "b2b_bayi_fiyatlari"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dealer_code: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # e.g. "B2B-0001"
    cari_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cari_accounts.id", ondelete="CASCADE"), 
        index=True, 
        nullable=True
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    special_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False) # Özel Bayi Fiyatı (TL)

    item: Mapped["Item"] = relationship("Item", lazy="selectin")
    cari: Mapped[Optional["CariAccount"]] = relationship("CariAccount", lazy="selectin")


B2BDealerPrice = B2BBayiFiyatlari


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
