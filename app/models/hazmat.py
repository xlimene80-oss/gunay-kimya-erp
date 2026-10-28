import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey, Index, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class WarehouseZone(Base, TimestampMixin):
    """
    Warehouse Zone (Bölge) classification based on chemical storage compatibility classes.
    Examples: Genel Depo, Asit Bölgesi, Baz Bölgesi, Yanıcı Bölgesi, Soğuk Oda, Karantina.
    """
    __tablename__ = "warehouse_zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False) # e.g. ZONE-GENEL, ZONE-ASIT
    storage_class: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # Genel, Yanıcı, Aşındırıcı-Asit, Aşındırıcı-Baz, Yükseltgen, Soğuk (2-8 °C), Zehirli, Karantina
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    bins: Mapped[List["WarehouseBin"]] = relationship(
        "WarehouseBin",
        back_populates="zone",
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class WarehouseBin(Base, TimestampMixin):
    """
    Shelf / Bin (Raf / Göz) inside a Warehouse Zone.
    Examples: A-01, B-01, Q-01 with weight and pallet capacities.
    """
    __tablename__ = "warehouse_bins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    zone_id: Mapped[int] = mapped_column(
        ForeignKey("warehouse_zones.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    code: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # e.g. A-01, B-01
    capacity_kg: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=Decimal("5000.000"), nullable=False)
    capacity_pallet: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    zone: Mapped["WarehouseZone"] = relationship(
        "WarehouseZone",
        back_populates="bins",
        lazy="selectin"
    )


class StorageIncompatibilityRule(Base, TimestampMixin):
    """
    Chemical storage incompatibility rules (Çapraz Uyumsuzluk Matrisi).
    Default rules: Aşındırıcı-Asit & Aşındırıcı-Baz, Yükseltgen & Yanıcı cannot share zones.
    """
    __tablename__ = "storage_incompatibility_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_a: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    class_b: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("idx_incompatibility_pair", "class_a", "class_b"),
    )


class WarehousePlacementAudit(Base):
    """
    Immutable audit trail for warehouse placement, shelf transfers, overrides, and SDS file changes.
    """
    __tablename__ = "warehouse_placement_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_lot_id: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)
    lot_number: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    item_id: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)
    item_name: Mapped[str] = mapped_column(String(150), nullable=False)
    
    action_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # BIN_TRANSFER, MAL_KABUL_PLACEMENT, OVERRIDE_PLACEMENT, SDS_UPLOAD, SDS_DELETE
    previous_bin_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    previous_bin_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_bin_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    new_bin_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    is_mismatched: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    item_storage_class: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bin_storage_class: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    override_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    user_email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )


class SystemConfig(Base, TimestampMixin):
    """
    Dynamic system configuration key-value storage (e.g. sds_validity_months, label_disclaimer).
    """
    __tablename__ = "system_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    config_value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
