import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_current_user
from app.models.auth import User, UserRoleEnum
from app.models.hr import (
    HRInterview, InterviewStatus,
    HRPersonnel, HRLeave, HRAttendance, HRMovement
)
from app.schemas.hr import (
    HRInterviewCreate, HRInterviewUpdate, HRInterviewResponse,
    HRPersonnelCreate, HRPersonnelUpdate, HRPersonnelResponse,
    HRLeaveCreate, HRLeaveUpdate, HRLeaveResponse,
    HRAttendanceCreate, HRAttendanceUpdate, HRAttendanceResponse,
    HRMovementCreate, HRMovementResponse
)

router = APIRouter(prefix="/hr", tags=["Human Resources & Talent Management"])

def check_hr_access(current_user: User):
    """Enforce staff/admin role; customer accounts have no access to HR."""
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="B2B Müşteri rolündeki kullanıcılar İnsan Kaynakları modülüne erişemez."
        )


# =============================================================
# 1. MÜLAKATLAR & İŞ BAŞVURULARI
# =============================================================
@router.post("/interviews", response_model=HRInterviewResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate_interview(
    interview_in: HRInterviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    interview_date = interview_in.interview_date or datetime.datetime.now(datetime.timezone.utc)

    new_interview = HRInterview(
        candidate_name=interview_in.candidate_name,
        position=interview_in.position,
        status=interview_in.status,
        sub_status=interview_in.sub_status or "1. Mülakat",
        department=interview_in.department,
        reason=interview_in.reason,
        interview_date=interview_date,
        phone=interview_in.phone,
        email=interview_in.email,
        notes=interview_in.notes
    )
    db.add(new_interview)
    await db.flush()

    # If already created as approved, auto-create draft personnel
    if new_interview.status == InterviewStatus.ONAYLANDI:
        await _on_interview_approved(new_interview, db, current_user.full_name)

    await db.commit()
    await db.refresh(new_interview)
    return new_interview


@router.get("/interviews", response_model=List[HRInterviewResponse])
async def list_interviews(
    status_filter: Optional[InterviewStatus] = Query(None, alias="status"),
    position: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
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
    check_hr_access(current_user)
    interview = await db.get(HRInterview, interview_id)
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mülakat kaydı bulunamadı.")
    return interview


@router.patch("/interviews/{interview_id}", response_model=HRInterviewResponse)
async def update_interview(
    interview_id: int,
    interview_in: HRInterviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    interview = await db.get(HRInterview, interview_id)
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mülakat kaydı bulunamadı.")

    prev_status = interview.status
    if interview_in.candidate_name is not None:
        interview.candidate_name = interview_in.candidate_name
    if interview_in.position is not None:
        interview.position = interview_in.position
    if interview_in.status is not None:
        interview.status = interview_in.status
    if interview_in.sub_status is not None:
        interview.sub_status = interview_in.sub_status
    if interview_in.department is not None:
        interview.department = interview_in.department
    if interview_in.reason is not None:
        interview.reason = interview_in.reason
    if interview_in.phone is not None:
        interview.phone = interview_in.phone
    if interview_in.email is not None:
        interview.email = interview_in.email
    if interview_in.notes is not None:
        interview.notes = interview_in.notes

    # If transitioned to approved, trigger auto-creation of draft personnel & movement
    if interview.status == InterviewStatus.ONAYLANDI and prev_status != InterviewStatus.ONAYLANDI:
        await _on_interview_approved(interview, db, current_user.full_name)

    await db.commit()
    await db.refresh(interview)
    return interview


async def _on_interview_approved(interview: HRInterview, db: AsyncSession, operator_name: str):
    """Automatically create draft personnel and an onboarding movement when candidate is approved."""
    # Generate sequential registration number
    existing_count = (await db.scalar(select(func.count(HRPersonnel.id)))) or 0
    reg_no = f"SICIL-{101 + existing_count:04d}"

    dept = interview.department or "Üretim"
    personnel = HRPersonnel(
        registration_no=reg_no,
        full_name=interview.candidate_name,
        department=dept,
        title=interview.position,
        hire_date=datetime.date.today(),
        status="Taslak (Mülakat Onaylı)",
        phone=interview.phone,
        email=interview.email,
        salary_note="Mülakat teklif onay aşamasında"
    )
    db.add(personnel)
    await db.flush()

    movement = HRMovement(
        personnel_id=personnel.id,
        personnel_name=personnel.full_name,
        department=dept,
        movement_type="İşe Giriş",
        movement_date=datetime.date.today(),
        old_value="Aday Havuzu",
        new_value=f"{dept} - {interview.position}",
        notes=f"'{interview.candidate_name}' mülakatı onaylanarak taslak personel kartı oluşturuldu.",
        created_by=operator_name
    )
    db.add(movement)


# =============================================================
# 2. PERSONEL KARTLARI
# =============================================================
@router.get("/personnel", response_model=List[HRPersonnelResponse])
async def list_personnel(
    department: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    stmt = select(HRPersonnel).order_by(HRPersonnel.id.asc())
    if department and department != "ALL":
        stmt = stmt.where(HRPersonnel.department == department)
    if status_filter and status_filter != "ALL":
        stmt = stmt.where(HRPersonnel.status == status_filter)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/personnel", response_model=HRPersonnelResponse, status_code=status.HTTP_201_CREATED)
async def create_personnel(
    payload: HRPersonnelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    # Check registration number unique
    existing = await db.scalar(select(HRPersonnel).where(HRPersonnel.registration_no == payload.registration_no))
    if existing:
        raise HTTPException(status_code=400, detail=f"'{payload.registration_no}' sicil numaralı personel zaten mevcut.")

    personnel = HRPersonnel(
        registration_no=payload.registration_no,
        full_name=payload.full_name,
        department=payload.department,
        title=payload.title,
        hire_date=payload.hire_date or datetime.date.today(),
        status=payload.status or "Aktif",
        phone=payload.phone,
        email=payload.email,
        salary_note=payload.salary_note,
        user_id=payload.user_id
    )
    db.add(personnel)
    await db.flush()

    # Log initial movement
    mov = HRMovement(
        personnel_id=personnel.id,
        personnel_name=personnel.full_name,
        department=personnel.department,
        movement_type="İşe Giriş",
        movement_date=personnel.hire_date,
        new_value=f"{personnel.department} / {personnel.title}",
        notes="Personel kartı doğrudan sisteme kaydedildi.",
        created_by=current_user.full_name
    )
    db.add(mov)

    await db.commit()
    await db.refresh(personnel)
    return personnel


@router.patch("/personnel/{personnel_id}", response_model=HRPersonnelResponse)
async def update_personnel(
    personnel_id: int,
    payload: HRPersonnelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    personnel = await db.get(HRPersonnel, personnel_id)
    if not personnel:
        raise HTTPException(status_code=404, detail="Personel bulunamadı.")

    old_dept = personnel.department
    old_title = personnel.title

    if payload.full_name is not None:
        personnel.full_name = payload.full_name
    if payload.department is not None:
        personnel.department = payload.department
    if payload.title is not None:
        personnel.title = payload.title
    if payload.status is not None:
        personnel.status = payload.status
    if payload.phone is not None:
        personnel.phone = payload.phone
    if payload.email is not None:
        personnel.email = payload.email
    if payload.salary_note is not None:
        personnel.salary_note = payload.salary_note

    # Track department or title changes in movements
    if payload.department and payload.department != old_dept:
        db.add(HRMovement(
            personnel_id=personnel.id,
            personnel_name=personnel.full_name,
            department=payload.department,
            movement_type="Departman Değişikliği",
            movement_date=datetime.date.today(),
            old_value=old_dept,
            new_value=payload.department,
            notes="Personel kartı güncellemesi ile departman aktarımı yapıldı.",
            created_by=current_user.full_name
        ))

    if payload.title and payload.title != old_title:
        db.add(HRMovement(
            personnel_id=personnel.id,
            personnel_name=personnel.full_name,
            department=personnel.department,
            movement_type="Unvan Değişikliği",
            movement_date=datetime.date.today(),
            old_value=old_title,
            new_value=payload.title,
            notes="Unvan revizyonu kaydedildi.",
            created_by=current_user.full_name
        ))

    await db.commit()
    await db.refresh(personnel)
    return personnel


@router.delete("/personnel/{personnel_id}")
async def delete_personnel(
    personnel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    personnel = await db.get(HRPersonnel, personnel_id)
    if not personnel:
        raise HTTPException(status_code=404, detail="Personel bulunamadı.")
    await db.delete(personnel)
    await db.commit()
    return {"message": f"'{personnel.full_name}' personeli silindi."}


# =============================================================
# 3. İZİN YÖNETİMİ
# =============================================================
@router.get("/leaves", response_model=List[HRLeaveResponse])
async def list_leaves(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    stmt = select(HRLeave).order_by(desc(HRLeave.start_date))
    if status_filter and status_filter != "ALL":
        stmt = stmt.where(HRLeave.status == status_filter)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/leaves", response_model=HRLeaveResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_request(
    payload: HRLeaveCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    personnel = await db.get(HRPersonnel, payload.personnel_id)
    p_name = personnel.full_name if personnel else payload.personnel_name
    dept = personnel.department if personnel else payload.department

    days = payload.days_count
    if days <= 0:
        days = max((payload.end_date - payload.start_date).days + 1, 1)

    leave = HRLeave(
        personnel_id=payload.personnel_id,
        personnel_name=p_name,
        department=dept,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        days_count=days,
        status=payload.status or "Talep Edildi",
        notes=payload.notes
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)
    return leave


@router.patch("/leaves/{leave_id}/status", response_model=HRLeaveResponse)
async def update_leave_status(
    leave_id: int,
    status_val: str = Query(..., description="Onaylandı, Reddedildi, Talep Edildi"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    leave = await db.get(HRLeave, leave_id)
    if not leave:
        raise HTTPException(status_code=404, detail="İzin kaydı bulunamadı.")
    leave.status = status_val
    leave.approved_by = current_user.full_name
    await db.commit()
    await db.refresh(leave)
    return leave


# =============================================================
# 4. PUANTAJ & DEVAM TAKİBİ
# =============================================================
@router.get("/attendances", response_model=List[HRAttendanceResponse])
async def list_attendances(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    department: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    stmt = select(HRAttendance).order_by(desc(HRAttendance.date), HRAttendance.personnel_name.asc())
    if department and department != "ALL":
        stmt = stmt.where(HRAttendance.department == department)
    if status_filter and status_filter != "ALL":
        stmt = stmt.where(HRAttendance.status == status_filter)
    if month:
        # e.g. 2026-11
        try:
            year, m = map(int, month.split("-"))
            start_d = datetime.date(year, m, 1)
            end_d = datetime.date(year, m + 1, 1) if m < 12 else datetime.date(year + 1, 1, 1)
            stmt = stmt.where(HRAttendance.date >= start_d, HRAttendance.date < end_d)
        except Exception:
            pass

    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/attendances", response_model=HRAttendanceResponse, status_code=status.HTTP_201_CREATED)
async def create_attendance(
    payload: HRAttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    personnel = await db.get(HRPersonnel, payload.personnel_id)
    p_name = personnel.full_name if personnel else payload.personnel_name
    dept = personnel.department if personnel else payload.department

    att = HRAttendance(
        personnel_id=payload.personnel_id,
        personnel_name=p_name,
        department=dept,
        date=payload.date,
        check_in=payload.check_in,
        check_out=payload.check_out,
        overtime_hours=payload.overtime_hours,
        status=payload.status or "Geldi",
        notes=payload.notes
    )
    db.add(att)
    await db.commit()
    await db.refresh(att)
    return att


# =============================================================
# 5. PERSONEL HAREKETLERİ (MOVEMENTS)
# =============================================================
@router.get("/movements", response_model=List[HRMovementResponse])
async def list_movements(
    personnel_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    stmt = select(HRMovement).order_by(desc(HRMovement.movement_date), desc(HRMovement.id))
    if personnel_id:
        stmt = stmt.where(HRMovement.personnel_id == personnel_id)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/movements", response_model=HRMovementResponse, status_code=status.HTTP_201_CREATED)
async def create_movement(
    payload: HRMovementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_hr_access(current_user)
    mov = HRMovement(
        personnel_id=payload.personnel_id,
        personnel_name=payload.personnel_name,
        department=payload.department,
        movement_type=payload.movement_type,
        movement_date=payload.movement_date,
        old_value=payload.old_value,
        new_value=payload.new_value,
        notes=payload.notes,
        created_by=current_user.full_name
    )
    db.add(mov)
    await db.commit()
    await db.refresh(mov)
    return mov
