import enum
import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Text, Numeric, Integer, Boolean, ForeignKey, 
    DateTime, Enum as SQLEnum, Index, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class ProductionStatus(str, enum.Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class Recipe(Base, TimestampMixin):
    """
    Recipe / Bill of Materials (BOM) definition for chemical formulations.
    e.g., 1000 Liters Liquid Soap formula.
    """
    __tablename__ = "mfg_recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Target chemical or packaged good produced
    output_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="RESTRICT"), 
        index=True, 
        nullable=False
    )
    base_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 3), 
        default=Decimal("1000.000"), 
        nullable=False
    )  # e.g., 1000.000 (liters or kg)

    # Relationships
    output_item: Mapped["Item"] = relationship(
        "Item", 
        foreign_keys=[output_item_id],
        lazy="selectin"
    )
    ingredients: Mapped[List["RecipeIngredient"]] = relationship(
        "RecipeIngredient", 
        back_populates="recipe", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    production_orders: Mapped[List["ProductionOrder"]] = relationship(
        "ProductionOrder", 
        back_populates="recipe",
        lazy="selectin"
    )


class RecipeIngredient(Base, TimestampMixin):
    """
    Individual raw chemical ingredient and quantity required for the recipe's base quantity.
    """
    __tablename__ = "mfg_recipe_ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("mfg_recipes.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    raw_material_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="RESTRICT"), 
        index=True, 
        nullable=False
    )
    required_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 3), 
        nullable=False
    )  # e.g., 150 kg SLES, 50 kg LABSA, etc.

    # Relationships
    recipe: Mapped["Recipe"] = relationship("Recipe", back_populates="ingredients")
    raw_material: Mapped["Item"] = relationship(
        "Item", 
        foreign_keys=[raw_material_item_id],
        lazy="selectin"
    )


class ProductionOrder(Base, TimestampMixin):
    """
    Order-driven manufacturing batch order tracking target output, lifecycle,
    and exact raw chemical lot footprint.
    """
    __tablename__ = "mfg_production_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_number: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("mfg_recipes.id", ondelete="RESTRICT"), 
        index=True, 
        nullable=False
    )
    target_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    status: Mapped[ProductionStatus] = mapped_column(
        SQLEnum(ProductionStatus), 
        default=ProductionStatus.PENDING, 
        index=True, 
        nullable=False
    )
    cari_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cari_accounts.id", ondelete="SET NULL"), 
        index=True, 
        nullable=True
    )
    phase: Mapped[str] = mapped_column(String(50), default="SIPARIS_ALINDI", nullable=False)
    reactor_name: Mapped[Optional[str]] = mapped_column(String(100), default="Reaktör-01 (Paslanmaz Mikser)", nullable=True)
    carbon_footprint_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=True)
    lot_number: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    box_barcode: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pallet_barcode: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    dispatch_order_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("inv_dispatch_orders.id", ondelete="SET NULL"), 
        index=True, 
        nullable=True
    )
    is_printed: Mapped[bool] = mapped_column(Boolean if 'Boolean' in locals() else Integer, default=0, nullable=False)
    printed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    printed_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    recipe: Mapped["Recipe"] = relationship("Recipe", back_populates="production_orders", lazy="selectin")
    cari: Mapped[Optional["CariAccount"]] = relationship("CariAccount", foreign_keys=[cari_id], lazy="selectin")
    dispatch_order: Mapped[Optional["DispatchOrder"]] = relationship("DispatchOrder", foreign_keys=[dispatch_order_id], lazy="selectin")
    ingredient_consumptions: Mapped[List["ProductionIngredientConsumption"]] = relationship(
        "ProductionIngredientConsumption",
        back_populates="production_order",
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class ProductionIngredientConsumption(Base, TimestampMixin):
    """
    Greenfield Traceability Junction Table:
    Records EXACTLY which supplier raw material lot (BatchLot) was consumed,
    in what quantity, for a specific ProductionOrder batch.
    """
    __tablename__ = "mfg_production_ingredient_consumptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    production_order_id: Mapped[int] = mapped_column(
        ForeignKey("mfg_production_orders.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    raw_material_batch_lot_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_batch_lots.id", ondelete="RESTRICT"), 
        index=True, 
        nullable=False
    )
    quantity_consumed: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)

    # Relationships
    production_order: Mapped["ProductionOrder"] = relationship("ProductionOrder", back_populates="ingredient_consumptions")
    raw_material_batch_lot: Mapped["BatchLot"] = relationship("BatchLot", lazy="selectin")


class RecallSimulationAudit(Base, TimestampMixin):
    """
    Immutable audit trail for Product Recall Simulations (Geri Çağırma Simülasyonları).
    Tracks when a simulation was run, by whom, for what mandatory reason,
    how many orders/lots/customers were affected, and whether affected lots were blocked.
    """
    __tablename__ = "mfg_recall_simulations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    simulation_number: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    query_identifier: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    affected_orders_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    affected_lots_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    affected_customers_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    total_produced_qty: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    total_dispatched_qty: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)
    total_in_stock_qty: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=Decimal("0.000"), nullable=False)

    affected_customers_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    in_stock_pallets_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    execution_duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    performed_by: Mapped[str] = mapped_column(String(150), default="Sistem Yöneticisi", nullable=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    blocked_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


# Backward-compatibility aliases
BillOfMaterials = Recipe
BOMItem = RecipeIngredient
WorkOrder = ProductionOrder
WorkOrderStatus = ProductionStatus
