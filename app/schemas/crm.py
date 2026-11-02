import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class CariNoteBase(BaseModel):
    cari_id: int = Field(..., description="İlişkili Cari Kart ID'si")
    note: str = Field(..., min_length=1, description="CRM görüşme / ziyaret notu")

class CariNoteCreate(CariNoteBase):
    pass

class CariNoteResponse(CariNoteBase):
    id: int
    created_by_id: Optional[int] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
