import datetime
from typing import Optional
from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models import Base, TimestampMixin

class Notification(Base, TimestampMixin):
    """
    Inter-departmental messaging and event notification log across
    Manufacturing, Warehouse (Depo), Accounting, and B2B Dealers.
    """
    __tablename__ = "core_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipient_role: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # DEPO_SORUMLUSU, MUHASEBE, ADMIN, BAYI
    recipient_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("auth_users.id"), nullable=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(String(60), index=True, nullable=False) # PRODUCTION_COMPLETED, DISPATCH_SHIPPED, STOCK_ALERT
    
    reference_module: Mapped[Optional[str]] = mapped_column(String(60), nullable=True) # e.g. "PRODUCTION_ORDER", "DISPATCH_ORDER"
    reference_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
