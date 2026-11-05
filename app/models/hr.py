import enum
import datetime
from typing import Optional
from sqlalchemy import (
    Integer, String, Text, ForeignKey, DateTime, Date, 
    func, Enum as SQLEnum, Float
)
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
    position: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    status: Mapped[InterviewStatus] = mapped_column(
        SQLEnum(InterviewStatus, values_callable=lambda x: [e.value for e in x], name="interview_status_enum", native_enum=False),
        default=InterviewStatus.GORUSME_HALINDE,
        nullable=False
    )
    sub_status: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # "1. Mülakat", "Teknik Değerlendirme", "Teklif Aşaması"
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # Onaylandığında atanacak departman
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # Kabul veya ret detay gerekçesi
    interview_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class HRPersonnel(Base, TimestampMixin):
    """
    Company personnel master record with department and title assignments.
    """
    __tablename__ = "hr_personnel"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    registration_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False) # Sicil No
    full_name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    department: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # e.g. "Üretim", "Satış", "Satın Alma", "Depo", "Muhasebe", "İK", "Kalite"
    title: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "Kimyasal Proses Operatörü"
    hire_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Aktif", nullable=False) # "Aktif", "Ayrıldı", "Taslak"
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    salary_note: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("auth_users.id", ondelete="SET NULL"), nullable=True)


class HRLeave(Base, TimestampMixin):
    """
    Employee leave requests and approval records.
    """
    __tablename__ = "hr_leaves"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    personnel_id: Mapped[int] = mapped_column(ForeignKey("hr_personnel.id", ondelete="CASCADE"), index=True, nullable=False)
    personnel_name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False) # "Yıllık İzin", "Mazeret İzni", "Ücretsiz İzin", "Sağlık Raporu"
    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    days_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Talep Edildi", nullable=False) # "Talep Edildi", "Onaylandı", "Reddedildi"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class HRAttendance(Base, TimestampMixin):
    """
    Employee daily time & attendance records (puantaj).
    """
    __tablename__ = "hr_attendances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    personnel_id: Mapped[int] = mapped_column(ForeignKey("hr_personnel.id", ondelete="CASCADE"), index=True, nullable=False)
    personnel_name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    date: Mapped[datetime.date] = mapped_column(Date, index=True, nullable=False)
    check_in: Mapped[Optional[str]] = mapped_column(String(20), nullable=True) # "08:00"
    check_out: Mapped[Optional[str]] = mapped_column(String(20), nullable=True) # "17:00"
    overtime_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Geldi", nullable=False) # "Geldi", "İzinli", "Devamsız", "Raporlu"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class HRMovement(Base, TimestampMixin):
    """
    Personnel lifecycle career movements (onboarding, promotion, department change, compensation update, exit).
    """
    __tablename__ = "hr_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    personnel_id: Mapped[int] = mapped_column(ForeignKey("hr_personnel.id", ondelete="CASCADE"), index=True, nullable=False)
    personnel_name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    movement_type: Mapped[str] = mapped_column(String(50), nullable=False) # "İşe Giriş", "Departman Değişikliği", "Unvan Değişikliği", "Ücret Güncellemesi", "İşten Çıkış"
    movement_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    old_value: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
