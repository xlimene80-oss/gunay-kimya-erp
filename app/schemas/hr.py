import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.hr import InterviewStatus

# -------------------------------------------------------------
# 1. HR Interview Schemas
# -------------------------------------------------------------
class HRInterviewBase(BaseModel):
    candidate_name: str = Field(..., max_length=150, description="Aday Adı Soyadı")
    position: str = Field(..., max_length=100, description="Başvurulan Pozisyon")
    status: InterviewStatus = Field(default=InterviewStatus.GORUSME_HALINDE)
    sub_status: Optional[str] = Field(default=None, max_length=100, description="Mülakat aşaması")
    department: Optional[str] = Field(default=None, max_length=100, description="Onaylandığında atanacak departman")
    reason: Optional[str] = Field(default=None, description="Kabul veya red detay gerekçesi")
    interview_date: Optional[datetime.datetime] = None
    phone: Optional[str] = Field(default=None, description="Aday iletişim numarası")
    email: Optional[str] = Field(default=None, description="Aday e-posta adresi")
    notes: Optional[str] = Field(default=None, description="Mülakat değerlendirme notları")

class HRInterviewCreate(HRInterviewBase):
    pass

class HRInterviewUpdate(BaseModel):
    candidate_name: Optional[str] = None
    position: Optional[str] = None
    status: Optional[InterviewStatus] = None
    sub_status: Optional[str] = None
    department: Optional[str] = None
    reason: Optional[str] = None
    interview_date: Optional[datetime.datetime] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None

class HRInterviewResponse(HRInterviewBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 2. HR Personnel Schemas
# -------------------------------------------------------------
class HRPersonnelBase(BaseModel):
    registration_no: str = Field(..., max_length=50, description="Sicil No")
    full_name: str = Field(..., max_length=150, description="Ad Soyad")
    department: str = Field(..., max_length=100, description="Departman")
    title: str = Field(..., max_length=100, description="Unvan / Görev")
    hire_date: datetime.date = Field(default_factory=datetime.date.today, description="İşe Başlama Tarihi")
    status: str = Field(default="Aktif", description="Aktif, Ayrıldı, Taslak")
    phone: Optional[str] = None
    email: Optional[str] = None
    salary_note: Optional[str] = None
    user_id: Optional[int] = None

class HRPersonnelCreate(HRPersonnelBase):
    pass

class HRPersonnelUpdate(BaseModel):
    registration_no: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    hire_date: Optional[datetime.date] = None
    status: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    salary_note: Optional[str] = None
    user_id: Optional[int] = None

class HRPersonnelResponse(HRPersonnelBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 3. HR Leave Schemas
# -------------------------------------------------------------
class HRLeaveBase(BaseModel):
    personnel_id: int
    personnel_name: str
    department: str
    leave_type: str = Field(default="Yıllık İzin", description="Yıllık İzin, Mazeret İzni, Ücretsiz İzin, Sağlık Raporu")
    start_date: datetime.date
    end_date: datetime.date
    days_count: int = Field(default=1, ge=1)
    status: str = Field(default="Talep Edildi", description="Talep Edildi, Onaylandı, Reddedildi")
    notes: Optional[str] = None
    approved_by: Optional[str] = None

class HRLeaveCreate(HRLeaveBase):
    pass

class HRLeaveUpdate(BaseModel):
    leave_type: Optional[str] = None
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    days_count: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    approved_by: Optional[str] = None

class HRLeaveResponse(HRLeaveBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 4. HR Attendance Schemas (Puantaj)
# -------------------------------------------------------------
class HRAttendanceBase(BaseModel):
    personnel_id: int
    personnel_name: str
    department: str
    date: datetime.date
    check_in: Optional[str] = "08:00"
    check_out: Optional[str] = "17:00"
    overtime_hours: float = 0.0
    status: str = Field(default="Geldi", description="Geldi, İzinli, Devamsız, Raporlu")
    notes: Optional[str] = None

class HRAttendanceCreate(HRAttendanceBase):
    pass

class HRAttendanceUpdate(BaseModel):
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    overtime_hours: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class HRAttendanceResponse(HRAttendanceBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 5. HR Movement Schemas
# -------------------------------------------------------------
class HRMovementBase(BaseModel):
    personnel_id: int
    personnel_name: str
    department: str
    movement_type: str = Field(..., description="İşe Giriş, Departman Değişikliği, Unvan Değişikliği, Ücret Güncellemesi, İşten Çıkış")
    movement_date: datetime.date = Field(default_factory=datetime.date.today)
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None

class HRMovementCreate(HRMovementBase):
    pass

class HRMovementResponse(HRMovementBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
