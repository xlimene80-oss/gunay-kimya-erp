import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class EmployeeReport(Base, TimestampMixin):
    """
    Staff daily/monthly activities, field visit reports, and sales log reports.
    """
    __tablename__ = "employee_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    report_type: Mapped[str] = mapped_column(
        String(50), 
        index=True, 
        nullable=False
    )  # "Gunluk", "Aylik", "Satis", "Saha"
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")
