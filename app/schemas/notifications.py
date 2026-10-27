import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class NotificationResponse(BaseModel):
    id: int
    recipient_role: str
    recipient_user_id: Optional[int] = None
    title: str
    message: str
    event_type: str
    reference_module: Optional[str] = None
    reference_id: Optional[int] = None
    is_read: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class NotificationCreate(BaseModel):
    recipient_role: str
    recipient_user_id: Optional[int] = None
    title: str
    message: str
    event_type: str
    reference_module: Optional[str] = None
    reference_id: Optional[int] = None
