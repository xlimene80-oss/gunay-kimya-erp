import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.notifications import Notification
from app.models.auth import UserRoleEnum
from app.schemas.notifications import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications & Event System"])


@router.get("/production", response_model=List[NotificationResponse])
async def list_production_notifications(
    unread_only: bool = Query(True),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Production team's polling queue for order-triggered shortage alerts."""
    department_code = str(getattr(getattr(current_user, "department", None), "code", "")).upper()
    role_names = " ".join(str(getattr(role, "role_name", "")) for role in (current_user.roles or [])).lower()
    allowed = (
        current_user.role == UserRoleEnum.ADMIN
        or department_code in {"URETIM", "YONETIM"}
        or "uretim" in role_names
        or "fabrika_muduru" in role_names
        or "yonetici" in role_names
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Üretim bildirimleri için yetkiniz bulunmuyor.")

    query = select(Notification).where(Notification.event_type == "ORDER_STOCK_SHORTAGE")
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    result = await db.scalars(query.order_by(Notification.created_at.desc()).limit(limit))
    return list(result.all())

@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    role: Optional[str] = Query(None, description="Filter by recipient role e.g. DEPO_SORUMLUSU, MUHASEBE, BAYI"),
    unread_only: bool = Query(False, description="Filter only unread notifications"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve real-time event notifications for inter-departmental workflows.
    """
    query = select(Notification)
    if role is not None:
        query = query.where(Notification.recipient_role == role.upper())
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.scalars(query)
    return list(result.all())

@router.patch("/{id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read."""
    notif = await db.get(Notification, id)
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification with ID {id} not found."
        )
    notif.is_read = True
    await db.commit()
    await db.refresh(notif)
    return notif

@router.get("/unread-count")
async def get_unread_count(
    role: str = Query(..., description="Role to check e.g. DEPO_SORUMLUSU, MUHASEBE, BAYI"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get total unread notification count for an operational department or dealer."""
    count = await db.scalar(
        select(func.count(Notification.id)).where(
            and_(
                Notification.recipient_role == role.upper(),
                Notification.is_read == False
            )
        )
    )
    return {"role": role.upper(), "unread_count": count or 0}
