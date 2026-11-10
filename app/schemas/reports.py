import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class EmployeeReportBase(BaseModel):
    report_type: str = Field(..., max_length=50, description="Rapor tipi: 'Gunluk', 'Aylik', 'Satis', 'Saha'")
    title: Optional[str] = Field(default=None, max_length=200, description="Rapor başlığı")
    content: str = Field(..., min_length=1, description="Rapor içeriği ve faaliyet detayları")

class EmployeeReportCreate(EmployeeReportBase):
    pass

class EmployeeReportResponse(EmployeeReportBase):
    id: int
    user_id: int
    author_name: Optional[str] = None
    user_email: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
