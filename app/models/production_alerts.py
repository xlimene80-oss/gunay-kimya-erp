from decimal import Decimal
from typing import Optional

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, TimestampMixin


class UretimEmri(Base, TimestampMixin):
    """Order triggered production work required to cover a finished-goods deficit."""

    __tablename__ = "uretim_emirleri"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    requested_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    shortage_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    status: Mapped[str] = mapped_column(
        String(80), default="Beklemede - Sipariş Tetikli", index=True, nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
