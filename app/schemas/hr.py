import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.hr import InterviewStatus

class HRInterviewBase(BaseModel):
    candidate_name: str = Field(..., max_length=150, description="Aday Adı Soyadı")
    position: str = Field(..., max_length=100, description="Başvurulan Pozisyon")
    status: InterviewStatus = Field(default=InterviewStatus.GORUSME_HALINDE)
    sub_status: Optional[str] = Field(default=None, max_length=100, description="Mülakat aşaması veya departman (Depo, Üretim, vb.)")
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
