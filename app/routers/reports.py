from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_current_user
from app.models.auth import User, UserRoleEnum
from app.models.reports import EmployeeReport
from app.schemas.reports import (
    EmployeeReportCreate, EmployeeReportResponse
)

router = APIRouter(prefix="/reports", tags=["Employee & Sales Reporting"])

@router.post("/employee", response_model=EmployeeReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_employee_report(
    report_in: EmployeeReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit daily/monthly activity or sales report by staff.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="B2B Müşterileri personel raporu giremez.")

    new_report = EmployeeReport(
        user_id=current_user.id,
        report_type=report_in.report_type,
        title=report_in.title,
        content=report_in.content
    )
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)
    return new_report


@router.get("/employee", response_model=List[EmployeeReportResponse])
async def list_employee_reports(
    user_id: Optional[int] = Query(None, description="Filtrelemek istenen kullanıcı ID (sadece admin)"),
    report_type: Optional[str] = Query(None, description="Gunluk, Aylik, Satis, Saha"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List employee activity reports. Staff members see their own reports; Admins see all.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim.")

    user_role_names = [r.role_name for r in current_user.roles]
    is_admin = "ADMIN" in user_role_names or current_user.role == UserRoleEnum.ADMIN

    stmt = select(EmployeeReport).order_by(desc(EmployeeReport.created_at))

    if not is_admin:
        # Non-admins can only see their own submitted reports
        stmt = stmt.where(EmployeeReport.user_id == current_user.id)
    else:
        if user_id is not None:
            stmt = stmt.where(EmployeeReport.user_id == user_id)

    if report_type:
        stmt = stmt.where(EmployeeReport.report_type == report_type)

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/employee/{report_id}", response_model=EmployeeReportResponse)
async def get_employee_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(EmployeeReport).where(EmployeeReport.id == report_id)
    res = await db.execute(stmt)
    rep = res.scalar_one_or_none()
    if not rep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rapor bulunamadı.")

    user_role_names = [r.role_name for r in current_user.roles]
    is_admin = "ADMIN" in user_role_names or current_user.role == UserRoleEnum.ADMIN
    if not is_admin and rep.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim: Başka bir personele ait rapor görüntülenemez.")

    return rep
