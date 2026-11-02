import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_current_user
from app.models.auth import User, UserRoleEnum
from app.models.hr import HRInterview, InterviewStatus
from app.schemas.hr import (
    HRInterviewCreate, HRInterviewUpdate, HRInterviewResponse
)

router = APIRouter(prefix="/hr", tags=["Human Resources & Talent Management"])

@router.post("/interviews", response_model=HRInterviewResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate_interview(
    interview_in: HRInterviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Schedule or log a candidate job interview.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim.")

    interview_date = interview_in.interview_date or datetime.datetime.now(datetime.timezone.utc)

    new_interview = HRInterview(
        candidate_name=interview_in.candidate_name,
        position=interview_in.position,
        status=interview_in.status,
        sub_status=interview_in.sub_status,
        reason=interview_in.reason,
        interview_date=interview_date,
        phone=interview_in.phone,
        email=interview_in.email,
        notes=interview_in.notes
    )
    db.add(new_interview)
    await db.commit()
    await db.refresh(new_interview)

    return new_interview


@router.get("/interviews", response_model=List[HRInterviewResponse])
async def list_interviews(
    status_filter: Optional[InterviewStatus] = Query(None, alias="status"),
    position: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List candidate interviews with optional status filtering ('onaylandi', 'reddedildi', 'gorusme_halinde').
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim.")

    stmt = select(HRInterview).order_by(desc(HRInterview.interview_date))
    if status_filter:
        stmt = stmt.where(HRInterview.status == status_filter)
    if position:
        stmt = stmt.where(HRInterview.position.ilike(f"%{position}%"))

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/interviews/{interview_id}", response_model=HRInterviewResponse)
async def get_interview(
    interview_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim.")

    stmt = select(HRInterview).where(HRInterview.id == interview_id)
    res = await db.execute(stmt)
    interview = res.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mülakat kaydı bulunamadı.")
    return interview


@router.patch("/interviews/{interview_id}", response_model=HRInterviewResponse)
async def update_interview_status_and_notes(
    interview_id: int,
    interview_in: HRInterviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update interview decision/status ('onaylandi', 'reddedildi', 'gorusme_halinde'), sub_status, and reason.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim.")

    stmt = select(HRInterview).where(HRInterview.id == interview_id)
    res = await db.execute(stmt)
    interview = res.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mülakat kaydı bulunamadı.")

    if interview_in.candidate_name is not None:
        interview.candidate_name = interview_in.candidate_name
    if interview_in.position is not None:
        interview.position = interview_in.position
    if interview_in.status is not None:
        interview.status = interview_in.status
    if interview_in.sub_status is not None:
        interview.sub_status = interview_in.sub_status
    if interview_in.reason is not None:
        interview.reason = interview_in.reason
    if interview_in.interview_date is not None:
        interview.interview_date = interview_in.interview_date
    if interview_in.phone is not None:
        interview.phone = interview_in.phone
    if interview_in.email is not None:
        interview.email = interview_in.email
    if interview_in.notes is not None:
        interview.notes = interview_in.notes

    await db.commit()
    await db.refresh(interview)
    return interview
