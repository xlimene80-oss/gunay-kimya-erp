from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_current_user
from app.models.auth import User, UserRoleEnum
from app.models.cari import CariAccount
from app.models.crm import CariNote
from app.schemas.crm import CariNoteCreate, CariNoteResponse

router = APIRouter(prefix="/crm", tags=["CRM & Cari Notes"])

@router.post("/notes", response_model=CariNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_cari_note(
    note_in: CariNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a visit / communication / interaction CRM note to a CariAccount.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="B2B Müşterileri dahili CRM notu ekleyemez."
        )

    # Verify CariAccount exists
    stmt = select(CariAccount).where(CariAccount.id == note_in.cari_id)
    res = await db.execute(stmt)
    cari = res.scalar_one_or_none()
    if not cari:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cari hesap bulunamadı.")

    new_note = CariNote(
        cari_id=note_in.cari_id,
        created_by_id=current_user.id,
        note=note_in.note
    )
    db.add(new_note)
    await db.commit()
    await db.refresh(new_note)
    return new_note


@router.get("/notes/cari/{cari_id}", response_model=List[CariNoteResponse])
async def list_cari_notes(
    cari_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch all CRM interaction notes for a specific customer/supplier account.
    """
    if current_user.role == UserRoleEnum.CUSTOMER and current_user.cari_id != cari_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yetkisiz erişim: Başka bir cari hesaba ait notlar görüntülenemez."
        )

    stmt = select(CariNote).where(CariNote.cari_id == cari_id).order_by(desc(CariNote.created_at))
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/notes", response_model=List[CariNoteResponse])
async def list_all_notes(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List CRM notes with role validation.
    """
    stmt = select(CariNote).order_by(desc(CariNote.created_at))
    if current_user.role == UserRoleEnum.CUSTOMER:
        if not current_user.cari_id:
            return []
        stmt = stmt.where(CariNote.cari_id == current_user.cari_id)

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()
