import enum
import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Text, Numeric, Integer, Boolean, ForeignKey, 
    DateTime, Date, Enum as SQLEnum, Index, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class ItemCategory(str, enum.Enum):
    RAW_MATERIAL = "Raw Material"           # Hammadde
    INTERMEDIATE = "Intermediate"           # Yarı Mamul
    FINISHED_GOOD = "Finished Good"         # Mamul
    PACKAGING = "Packaging"                 # Ambalaj

class DispatchStatus(str, enum.Enum):
    PENDING = "PENDING"
    READY = "READY"
    SHIPPED = "SHIPPED"

class BarcodeType(str, enum.Enum):
    BOX = "BOX"       # Koli / Kutu
    PALLET = "PALLET" # Palet (SSCC-18)

class BarcodeStatus(str, enum.Enum):
    IN_STOCK = "IN_STOCK"
    SHIPPED = "SHIPPED"

class Item(Base, TimestampMixin):
    """
    Inventory chemical and packaging master item (SKU).
    """
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="kg", nullable=False)  # kg, liter, pcs, adet
    category: Mapped[ItemCategory] = mapped_column(
        SQLEnum(ItemCategory), 
        index=True, 
        nullable=False
    )
    
    # Chemical specifications
    cas_number: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    density: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 4), nullable=True)  # g/cm3

    # Inventory constraints & Hazard classification
    min_stock: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    shelf_life_days: Mapped[Optional[int]] = mapped_column(Integer, default=365, nullable=True)
    hazard_class: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    batches: Mapped[List["BatchLot"]] = relationship(
        "BatchLot", 
        back_populates="item", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    @property
    def sku_code(self) -> str:
        return self.sku


class BatchLot(Base, TimestampMixin):
    """
    Batch and lot tracking for raw chemicals, intermediate bulks, and finished lots per warehouse.
    Explicitly tracks incoming supplier goods receipt item for complete traceability.
    """
    __tablename__ = "inventory_batch_lots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_number: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="RESTRICT"), 
        index=True, 
        nullable=False
    )
    warehouse: Mapped[str] = mapped_column(String(100), default="Hammadde Deposu", index=True, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    expiration_date: Mapped[Optional[datetime.date]] = mapped_column(Date, index=True, nullable=True)
    received_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Greenfield Traceability link: Points to exact supplier purchase receipt item
    goods_receipt_item_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_goods_receipt_items.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )

    # Relationships
    item: Mapped["Item"] = relationship("Item", back_populates="batches", lazy="selectin")
    goods_receipt_item: Mapped[Optional["GoodsReceiptItem"]] = relationship("GoodsReceiptItem", foreign_keys=[goods_receipt_item_id], lazy="selectin")

    __table_args__ = (
        Index("idx_batch_item_warehouse", "item_id", "warehouse"),
        Index("idx_batch_item_expiry", "item_id", "expiration_date"),
    )


# ---------------------------------------------------------
# 1. Mal Kabul / Goods Receipt (Satın Alma Giriş)
# ---------------------------------------------------------
class GoodsReceipt(Base, TimestampMixin):
    """
    Purchase goods receipt logging incoming supplier shipments, invoices, and irsaliye notes.
    """
    __tablename__ = "inv_goods_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    receipt_number: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cari_accounts.id"), nullable=True)
    supplier_name: Mapped[str] = mapped_column(String(200), nullable=False)
    
    # Greenfield Traceability Fields
    invoice_number: Mapped[Optional[str]] = mapped_column(String(60), index=True, nullable=True) # Fatura No (e.g. GNY202600004102)
    dispatch_note_number: Mapped[Optional[str]] = mapped_column(String(60), index=True, nullable=True) # İrsaliye No (e.g. IRS20260001290)
    received_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    purchase_order_number: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    target_warehouse: Mapped[str] = mapped_column(String(100), default="Hammadde Deposu", nullable=False)
    receipt_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    items: Mapped[List["GoodsReceiptItem"]] = relationship(
        "GoodsReceiptItem", 
        back_populates="receipt", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class GoodsReceiptItem(Base, TimestampMixin):
    """
    Raw material or packaging line item within a Goods Receipt with assigned batch lot.
    """
    __tablename__ = "inv_goods_receipt_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    goods_receipt_id: Mapped[int] = mapped_column(
        ForeignKey("inv_goods_receipts.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), index=True, nullable=False)
    batch_number: Mapped[str] = mapped_column(String(80), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    expiration_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    unit_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), default=Decimal("0.0000"), nullable=True)

    receipt: Mapped["GoodsReceipt"] = relationship("GoodsReceipt", back_populates="items", lazy="selectin")
    item: Mapped["Item"] = relationship("Item", lazy="selectin")


# ---------------------------------------------------------
# 2. Depolar Arası Transfer / Inter-Warehouse Transfer
# ---------------------------------------------------------
class StockTransfer(Base, TimestampMixin):
    """
    Inter-warehouse transfer header between storage zones (e.g., Raw -> Plant Floor -> Finished).
    """
    __tablename__ = "inv_stock_transfers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transfer_number: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    source_warehouse: Mapped[str] = mapped_column(String(100), nullable=False)
    target_warehouse: Mapped[str] = mapped_column(String(100), nullable=False)
    transfer_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="COMPLETED", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    items: Mapped[List["StockTransferItem"]] = relationship(
        "StockTransferItem", 
        back_populates="transfer", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class StockTransferItem(Base, TimestampMixin):
    """
    Item line for stock transfer tracking specific batch lots moved.
    """
    __tablename__ = "inv_stock_transfer_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transfer_id: Mapped[int] = mapped_column(
        ForeignKey("inv_stock_transfers.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), index=True, nullable=False)
    batch_lot_id: Mapped[int] = mapped_column(ForeignKey("inventory_batch_lots.id"), index=True, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)

    transfer: Mapped["StockTransfer"] = relationship("StockTransfer", back_populates="items")
    item: Mapped["Item"] = relationship("Item", lazy="selectin")
    batch_lot: Mapped["BatchLot"] = relationship("BatchLot", lazy="selectin")


# ---------------------------------------------------------
# 3. Sevk Emri & Sevkiyat / Dispatch & Logistics Delivery
# ---------------------------------------------------------
class DispatchOrder(Base, TimestampMixin):
    """
    Sales dispatch / logistics delivery order for finished chemical products.
    """
    __tablename__ = "inv_dispatch_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dispatch_number: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    cari_id: Mapped[int] = mapped_column(ForeignKey("cari_accounts.id"), index=True, nullable=False)
    status: Mapped[DispatchStatus] = mapped_column(
        SQLEnum(DispatchStatus), 
        default=DispatchStatus.PENDING, 
        index=True, 
        nullable=False
    )
    warehouse: Mapped[str] = mapped_column(String(100), default="Mamul Ürün Deposu", nullable=False)
    dispatch_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    carrier_tracking_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    carrier_company: Mapped[Optional[str]] = mapped_column(String(150), nullable=True, default="Günay Kimya Özel Lojistik Filosu")
    vehicle_plate: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, default="34 GNY 1984")
    driver_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="Kemal Yılmaz")
    driver_tckn: Mapped[Optional[str]] = mapped_column(String(11), nullable=True, default="29810482910")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    items: Mapped[List["DispatchItem"]] = relationship(
        "DispatchItem", 
        back_populates="dispatch_order", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    cari: Mapped["CariAccount"] = relationship("CariAccount", lazy="selectin")


class DispatchItem(Base, TimestampMixin):
    """
    Finished product item line inside a dispatch order.
    """
    __tablename__ = "inv_dispatch_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dispatch_order_id: Mapped[int] = mapped_column(
        ForeignKey("inv_dispatch_orders.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), index=True, nullable=False)
    batch_lot_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_batch_lots.id"), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    scanned_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    unit_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), default=Decimal("0.0000"), nullable=True)

    dispatch_order: Mapped["DispatchOrder"] = relationship("DispatchOrder", back_populates="items")
    item: Mapped["Item"] = relationship("Item", lazy="selectin")
    batch_lot: Mapped[Optional["BatchLot"]] = relationship("BatchLot", lazy="selectin")


# ---------------------------------------------------------
# 4. Çok Kademeli Barkodlama (Koli & Palet SSCC) / Barcode Units
# ---------------------------------------------------------
class BarcodeUnit(Base, TimestampMixin):
    """
    Multi-level Barcoding hierarchy (Pallet SSCC and Box level barcodes).
    A Pallet wraps multiple Box barcodes.
    """
    __tablename__ = "inv_barcode_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    barcode_string: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)  # e.g., SSCC-18
    type: Mapped[BarcodeType] = mapped_column(SQLEnum(BarcodeType), index=True, nullable=False)

    # Self-referencing key to nest boxes inside pallets
    parent_pallet_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_barcode_units.id", ondelete="CASCADE"),
        index=True,
        nullable=True
    )

    production_order_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("mfg_production_orders.id", ondelete="SET NULL"),
        index=True,
        nullable=True
    )

    item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="RESTRICT"),
        index=True,
        nullable=False
    )

    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    status: Mapped[BarcodeStatus] = mapped_column(
        SQLEnum(BarcodeStatus),
        default=BarcodeStatus.IN_STOCK,
        index=True,
        nullable=False
    )

    # Target / Customer owner verification
    target_cari_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cari_accounts.id", ondelete="SET NULL"),
        index=True,
        nullable=True
    )

    # Linked dispatch order when scanned/shipped
    dispatch_order_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_dispatch_orders.id", ondelete="SET NULL"),
        index=True,
        nullable=True
    )

    # Relationships
    parent_pallet: Mapped[Optional["BarcodeUnit"]] = relationship(
        "BarcodeUnit",
        remote_side=[id],
        back_populates="children_boxes"
    )
    children_boxes: Mapped[List["BarcodeUnit"]] = relationship(
        "BarcodeUnit",
        back_populates="parent_pallet",
        lazy="selectin"
    )
    item: Mapped["Item"] = relationship("Item", lazy="selectin")
    target_cari: Mapped[Optional["CariAccount"]] = relationship("CariAccount", foreign_keys=[target_cari_id], lazy="selectin")
    dispatch_order: Mapped[Optional["DispatchOrder"]] = relationship("DispatchOrder", foreign_keys=[dispatch_order_id], lazy="selectin")


class LabelPrintLog(Base, TimestampMixin):
    """
    Print audit trail for warehouse barcodes and labels.
    """
    __tablename__ = "inv_label_print_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    production_order_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("mfg_production_orders.id", ondelete="SET NULL"),
        index=True,
        nullable=True
    )
    barcode_string: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    label_type: Mapped[str] = mapped_column(String(30), default="ALL", nullable=False) # PALLET, BOX, ALL
    label_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    printed_by: Mapped[str] = mapped_column(String(100), default="Operatör", nullable=False)
    printed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )
    is_reprint: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class BarcodeSequence(Base):
    """
    Persistent monotonic sequence counter for SSCC-18 and GTIN/Box barcodes.
    """
    __tablename__ = "inv_barcode_sequences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence_type: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    current_value: Mapped[int] = mapped_column(Integer, default=100, nullable=False)


LotBatch = BatchLot
