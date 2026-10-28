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

class LotStatus(str, enum.Enum):
    KARANTINA = "Karantina"
    SERBEST = "Serbest"
    BLOKE = "Bloke"
    REDDEDILDI = "Reddedildi"

class InspectionDecision(str, enum.Enum):
    SERBEST = "Serbest Bırakıldı"
    BLOKE = "Bloke Edildi"
    RED = "Reddedildi"

class QualityTestTemplate(Base, TimestampMixin):
    """
    Quality control test template defined per item (product/raw material).
    e.g. Liquid soap template, SLES template, NaOH template.
    """
    __tablename__ = "quality_test_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    item: Mapped["Item"] = relationship("Item", lazy="selectin")
    tests: Mapped[List["QualityTestItem"]] = relationship(
        "QualityTestItem",
        back_populates="template",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="QualityTestItem.order_index"
    )

class QualityTestItem(Base, TimestampMixin):
    """
    Individual test specification within a test template.
    e.g. pH: min 5.5, max 7.5, unit: "pH", method: "TS 518 / pH Metre"
    """
    __tablename__ = "quality_test_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("quality_test_templates.id", ondelete="CASCADE"), index=True, nullable=False)
    test_name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    min_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    max_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    expected_text: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    method: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    template: Mapped["QualityTestTemplate"] = relationship("QualityTestTemplate", back_populates="tests")

class QualityInspection(Base, TimestampMixin):
    """
    Quality control inspection and decision log for a lot (audit trail).
    Immutable decision records.
    """
    __tablename__ = "quality_inspections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inspection_number: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    batch_lot_id: Mapped[int] = mapped_column(ForeignKey("inventory_batch_lots.id", ondelete="RESTRICT"), index=True, nullable=False)
    template_id: Mapped[Optional[int]] = mapped_column(ForeignKey("quality_test_templates.id", ondelete="SET NULL"), nullable=True)
    
    source_type: Mapped[str] = mapped_column(String(30), default="MAL_KABUL", nullable=False)  # MAL_KABUL, URETIM
    decision: Mapped[str] = mapped_column(String(50), nullable=False)  # "Serbest Bırakıldı", "Bloke Edildi", "Reddedildi"
    decision_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    inspector_id: Mapped[Optional[int]] = mapped_column(ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)
    inspector_name: Mapped[str] = mapped_column(String(150), nullable=False)
    inspected_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    batch_lot: Mapped["BatchLot"] = relationship("BatchLot", lazy="selectin")
    template: Mapped[Optional["QualityTestTemplate"]] = relationship("QualityTestTemplate", lazy="selectin")
    results: Mapped[List["QualityInspectionResult"]] = relationship(
        "QualityInspectionResult",
        back_populates="inspection",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    coa: Mapped[Optional["QualityCertificateOfAnalysis"]] = relationship(
        "QualityCertificateOfAnalysis",
        back_populates="inspection",
        uselist=False,
        lazy="selectin"
    )

class QualityInspectionResult(Base, TimestampMixin):
    """
    Individual test measurement result within an inspection.
    """
    __tablename__ = "quality_inspection_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inspection_id: Mapped[int] = mapped_column(ForeignKey("quality_inspections.id", ondelete="CASCADE"), index=True, nullable=False)
    test_name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    min_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    max_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    method: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    
    measured_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    measured_text: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_passed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    inspection: Mapped["QualityInspection"] = relationship("QualityInspection", back_populates="results")

class QualityCertificateOfAnalysis(Base, TimestampMixin):
    """
    Certificate of Analysis (CoA) generated for released finished goods lots.
    """
    __tablename__ = "quality_coas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    certificate_number: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    inspection_id: Mapped[int] = mapped_column(ForeignKey("quality_inspections.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    batch_lot_id: Mapped[int] = mapped_column(ForeignKey("inventory_batch_lots.id", ondelete="RESTRICT"), index=True, nullable=False)
    
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    product_sku: Mapped[str] = mapped_column(String(50), nullable=False)
    lot_number: Mapped[str] = mapped_column(String(80), nullable=False)
    
    production_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    expiration_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    
    approved_by: Mapped[str] = mapped_column(String(150), nullable=False)
    approval_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    inspection: Mapped["QualityInspection"] = relationship("QualityInspection", back_populates="coa")
    batch_lot: Mapped["BatchLot"] = relationship("BatchLot", lazy="selectin")
