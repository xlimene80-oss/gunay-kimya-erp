import enum
import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, ForeignKey, DateTime, func, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class InterviewStatus(str, enum.Enum):
    ONAYLANDI = "onaylandi"
    REDDEDILDI = "reddedildi"
    GORUSME_HALINDE = "gorusme_halinde"


class HRInterview(Base, TimestampMixin):
    """
    Human Resources candidate interview tracking and talent acquisition management.
    """
    __tablename__ = "hr_interviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    position: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # e.g. "Kimya Mühendisi", "Depo Operatörü"
    status: Mapped[InterviewStatus] = mapped_column(
        SQLEnum(InterviewStatus, values_callable=lambda x: [e.value for e in x], name="interview_status_enum", native_enum=False),
        default=InterviewStatus.GORUSME_HALINDE,
        nullable=False
    )
    sub_status: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # "1. Mülakat", "Teknik Değerlendirme", "Teklif Aşaması"
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # Kabul veya ret detay gerekçesi
    interview_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
