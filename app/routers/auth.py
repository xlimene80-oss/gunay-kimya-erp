import asyncio
import ipaddress
import datetime
import logging
import re
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("auth")

from app.core.config import settings, get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_admin_user, check_module_permission
)
from app.models.auth import (
    User, Role, UserRole, ModulePermission, UserRoleEnum,
    Department, LoginAttempt, ALL_MODULES, MODULE_ACTIONS, get_default_department_permissions
)
from app.models.cari import CariAccount
from app.schemas.auth import (
    UserCreate, UserUpdate, UserResponse, UserPermissionsUpdate, UserPasswordReset,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    Token, LoginRequest, RoleCreate, RoleResponse, PermissionCheck
)

router = APIRouter(prefix="/auth", tags=["User Authentication & RBAC"])

# ---------------------------------------------------------
# Security: Trusted Client IP Extraction (Render & Cloudflare)
# ---------------------------------------------------------
def get_trusted_client_ip(request: Request) -> str:
    """
    Extracts the trusted client IP address behind reverse proxies (Render / Cloudflare).

    MİMARİ GÜVENLİK MODELİ (RENDER PROXY & IP SPOOFING KORUMASI):
    ---------------------------------------------------------------------------------
    1. Render altyapısı, gelen HTTP trafiğini Cloudflare edge katmanı üzerinden karşılar.
    2. Cloudflare, TCP soket bağlantısını kuran gerçek istemci IP'sini 'CF-Connecting-IP'
       ve 'True-Client-IP' başlıklarına yazar ve istemciden gelen harici sahte değerleri
       temizler/üzerine yazar (strip & overwrite). Bu başlıklar istemci tarafından
       kesinlikle taklit edilemez (spoof-proof).
    3. 'X-Forwarded-For' başlığı ise bir proxy zinciridir:
       Eğer kötü niyetli bir istemci 'X-Forwarded-For: 1.2.3.4' başlığı enjekte ederse,
       Render proxy'si istemcinin gerçek IP'sini bu zincirin SAĞINA (sonuna) ekler:
       '1.2.3.4, <gerçek_istemci_ip>'.
       Bu nedenle X-Forwarded-For başlığının ilk elemanını (split(',')[0]) almak GÜVENSİZDİR
       ve doğrudan IP taklidine (spoofing) yol açar.
    4. Bu fonksiyonda güvenilir IP çözümleme sırası:
       a) 'CF-Connecting-IP' veya 'True-Client-IP' (varsa doğrudan kullanılır).
       b) 'X-Forwarded-For' başlığı varsa: Sağdan sola taranarak Render/Cloudflare dahili
          alt ağları (RFC 1918 private IP'ler: 10.x, 172.16-31.x, 127.x) elenir ve
          proxy tarafından zincire eklenmiş ilk geçerli genel IP alınır.
       c) Fallback: request.client.host (yerel geliştirme ve test istemcileri).
    ---------------------------------------------------------------------------------
    """
    # 1. Edge-verified Cloudflare headers on Render
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and cf_ip.strip():
        return cf_ip.split(",")[0].strip()

    true_client_ip = request.headers.get("true-client-ip")
    if true_client_ip and true_client_ip.strip():
        return true_client_ip.split(",")[0].strip()

    # 2. X-Forwarded-For header (right-to-left inspection)
    xff = request.headers.get("x-forwarded-for")
    if xff:
        ips = [ip.strip() for ip in xff.split(",") if ip.strip()]
        for candidate in reversed(ips):
            try:
                ip_obj = ipaddress.ip_address(candidate)
                # Skip internal private hops if multiple hops exist
                if len(ips) > 1 and (ip_obj.is_private or ip_obj.is_loopback):
                    continue
                return candidate
            except ValueError:
                continue
        if ips:
            return ips[-1]

    # 3. Direct socket connection fallback
    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"



# ---------------------------------------------------------
# Metadata: Modules & Actions
# ---------------------------------------------------------
@router.get("/permissions/modules")
async def get_modules_metadata(
    current_user: User = Depends(get_current_user)
):
    """
    Returns the complete list of system modules and available actions
    (Görüntüle, Ekle, Düzenle, Sil, Onayla) to render the dynamic permission matrix.
    """
    return {
        "modules": ALL_MODULES,
        "actions": [
            {"id": "read", "name": "Görüntüle"},
            {"id": "create", "name": "Ekle"},
            {"id": "update", "name": "Düzenle"},
            {"id": "delete", "name": "Sil"},
            {"id": "approve", "name": "Onayla"},
        ]
    }


# ---------------------------------------------------------
# Department Endpoints (CRUD)
# ---------------------------------------------------------
@router.get("/departments", response_model=List[DepartmentResponse])
async def list_departments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all corporate departments with active user counts."""
    stmt = (
        select(Department, func.count(User.id).label("user_count"))
        .outerjoin(User, User.department_id == Department.id)
        .group_by(Department.id)
        .order_by(Department.id.asc())
    )
    res = await db.execute(stmt)
    rows = res.all()
    
    output = []
    for dept, count in rows:
        output.append(
            DepartmentResponse(
                id=dept.id,
                name=dept.name,
                code=dept.code,
                description=dept.description,
                is_active=dept.is_active,
                permissions=dept.get_effective_permissions(),
                user_count=count or 0,
                created_at=dept.created_at
            )
        )
    return output


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new corporate department (Admin only)."""
    code_up = payload.code.strip().upper()
    name_clean = payload.name.strip()

    # Check uniqueness
    existing = await db.scalar(
        select(Department).where(or_(Department.code == code_up, Department.name == name_clean))
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{name_clean}' isimli veya '{code_up}' kodlu departman zaten sistemde mevcut."
        )

    # Initialize default permissions if not provided
    perms = payload.permissions or get_default_department_permissions(code_up)

    new_dept = Department(
        name=name_clean,
        code=code_up,
        description=payload.description,
        is_active=payload.is_active,
        permissions=perms
    )
    db.add(new_dept)
    await db.commit()
    await db.refresh(new_dept)

    return DepartmentResponse(
        id=new_dept.id,
        name=new_dept.name,
        code=new_dept.code,
        description=new_dept.description,
        is_active=new_dept.is_active,
        permissions=new_dept.get_effective_permissions(),
        user_count=0,
        created_at=new_dept.created_at
    )


@router.get("/departments/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Department, func.count(User.id).label("user_count"))
        .outerjoin(User, User.department_id == Department.id)
        .where(Department.id == department_id)
        .group_by(Department.id)
    )
    res = await db.execute(stmt)
    row = res.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departman bulunamadı.")
    dept, count = row
    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        code=dept.code,
        description=dept.description,
        is_active=dept.is_active,
        permissions=dept.get_effective_permissions(),
        user_count=count or 0,
        created_at=dept.created_at
    )


@router.put("/departments/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Update department info or permissions matrix (Admin only)."""
    dept = await db.scalar(select(Department).where(Department.id == department_id))
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departman bulunamadı.")

    if payload.name is not None:
        name_clean = payload.name.strip()
        other = await db.scalar(select(Department).where(Department.name == name_clean, Department.id != department_id))
        if other:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"'{name_clean}' isimli başka bir departman var.")
        dept.name = name_clean

    if payload.code is not None:
        code_up = payload.code.strip().upper()
        other = await db.scalar(select(Department).where(Department.code == code_up, Department.id != department_id))
        if other:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"'{code_up}' kodlu başka bir departman var.")
        dept.code = code_up

    if payload.description is not None:
        dept.description = payload.description
    if payload.is_active is not None:
        dept.is_active = payload.is_active
    if payload.permissions is not None:
        current_perms = dict(dept.permissions or {})
        for mod_id, act_dict in payload.permissions.items():
            if isinstance(act_dict, dict):
                if mod_id not in current_perms:
                    current_perms[mod_id] = {}
                current_perms[mod_id].update(act_dict)
            elif isinstance(act_dict, bool):
                if mod_id not in current_perms:
                    current_perms[mod_id] = {}
                current_perms[mod_id]["read"] = act_dict
        dept.permissions = current_perms

    await db.commit()
    await db.refresh(dept)

    count = await db.scalar(select(func.count(User.id)).where(User.department_id == department_id)) or 0
    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        code=dept.code,
        description=dept.description,
        is_active=dept.is_active,
        permissions=dept.get_effective_permissions(),
        user_count=count,
        created_at=dept.created_at
    )


@router.delete("/departments/{department_id}")
async def delete_department(
    department_id: int,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a department (Admin only). Unlinks users safely."""
    dept = await db.scalar(select(Department).where(Department.id == department_id))
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departman bulunamadı.")

    # Unlink users from this department
    users = (await db.scalars(select(User).where(User.department_id == department_id))).all()
    for u in users:
        u.department_id = None

    await db.delete(dept)
    await db.commit()
    return {"message": f"'{dept.name}' departmanı başarıyla silindi ve {len(users)} kullanıcı unlinked edildi."}


# ---------------------------------------------------------
# User Registration & Management Endpoints
# ---------------------------------------------------------
def is_attempt_locked(attempt: Optional[LoginAttempt]) -> bool:
    """Helper to verify if a login attempt record is currently in active 15m lockout."""
    if not attempt or not attempt.locked_until:
        return False
    lock_until = attempt.locked_until
    if lock_until.tzinfo is None:
        lock_until = lock_until.replace(tzinfo=datetime.timezone.utc)
    return lock_until > datetime.datetime.now(datetime.timezone.utc)


async def check_user_locked(db: AsyncSession, user: User) -> bool:
    """Checks whether the user account is currently locked out by brute force attempts across identity or IP."""
    keys = [user.email.lower().strip()]
    if user.user_code:
        keys.append(user.user_code.lower().strip())
    
    conditions = [LoginAttempt.identity_key.in_(keys)]
    for k in keys:
        conditions.append(LoginAttempt.identity_key.like(f"{k}|%"))

    attempts = (await db.scalars(
        select(LoginAttempt).where(or_(*conditions))
    )).all()
    for att in attempts:
        if is_attempt_locked(att):
            return True
    return False


def serialize_user_response(u: User, is_locked: bool = False) -> UserResponse:
    """Helper to cleanly serialize user with department, user_code, lock status and effective permissions."""
    return UserResponse(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        is_active=u.is_active,
        user_code=u.user_code,
        is_locked=is_locked,
        department_id=u.department_id,
        department_name=u.department.name if u.department else None,
        department_code=u.department.code if u.department else None,
        cari_id=u.cari_id,
        cari_title=u.cari.title if u.cari else None,
        cari_code=u.cari.code if u.cari else None,
        created_at=u.created_at,
        roles=[r.role_name for r in u.roles],
        permissions=u.permissions or {},
        effective_permissions=u.get_effective_permissions()
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_or_create_user(
    payload: UserCreate,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Register or create a new user account (Staff, Admin, or B2B Customer).
    Auto-assigns Department and Role, enforces B2B Cari isolation, and generates sequential B2B-XXXX code.
    """
    total_users = await db.scalar(select(func.count(User.id)))
    # If users exist, only authenticated ADMIN users can create new accounts
    if total_users > 0:
        if not current_user or current_user.role != UserRoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Yalnızca sistem yöneticileri yeni kullanıcı oluşturabilir."
            )

    existing_user = await db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{payload.email}' e-posta adresiyle kayıtlı bir kullanıcı zaten mevcut."
        )

    # First user automatically gets ADMIN
    effective_role = UserRoleEnum.ADMIN if total_users == 0 else payload.role

    # Customer role requires valid cari_id
    if effective_role == UserRoleEnum.CUSTOMER and not payload.cari_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="B2B Müşteri (CUSTOMER) rolündeki kullanıcılar için 'cari_id' (Cari Kart) seçimi zorunludur."
        )

    # Department lookup or resolution
    assigned_dept_id = payload.department_id
    if not assigned_dept_id and payload.role_names and len(payload.role_names) > 0:
        first_role = payload.role_names[0].upper()
        dept_match = await db.scalar(select(Department).where(Department.code == first_role))
        if dept_match:
            assigned_dept_id = dept_match.id

    # Sequential B2B user code generation (server-side only)
    generated_user_code = None
    if effective_role == UserRoleEnum.CUSTOMER:
        existing_codes_res = await db.scalars(
            select(User.user_code).where(User.user_code.is_not(None))
        )
        existing_codes = set(existing_codes_res.all())
        
        max_seq = 0
        for code in existing_codes:
            match = re.match(r"^B2B-(\d+)$", code or "", re.IGNORECASE)
            if match:
                try:
                    seq_val = int(match.group(1))
                    if seq_val > max_seq:
                        max_seq = seq_val
                except ValueError:
                    pass

        next_seq = max_seq + 1
        candidate_code = f"B2B-{next_seq:04d}"
        while candidate_code in existing_codes:
            next_seq += 1
            candidate_code = f"B2B-{next_seq:04d}"

        generated_user_code = candidate_code

    hashed_pwd = get_password_hash(payload.password)
    user = User(
        email=payload.email.strip().lower(),
        hashed_password=hashed_pwd,
        full_name=payload.full_name.strip(),
        role=effective_role,
        is_active=payload.is_active,
        cari_id=payload.cari_id,
        user_code=generated_user_code,
        department_id=assigned_dept_id,
        permissions={}
    )
    db.add(user)
    await db.flush()

    # Assign roles
    roles_to_assign = payload.role_names if payload.role_names else []
    if effective_role == UserRoleEnum.ADMIN and "ADMIN" not in roles_to_assign:
        roles_to_assign.append("ADMIN")
    elif effective_role == UserRoleEnum.CUSTOMER and "B2B_CUSTOMER" not in roles_to_assign:
        roles_to_assign.append("B2B_CUSTOMER")
    elif not roles_to_assign and assigned_dept_id:
        dept = await db.scalar(select(Department).where(Department.id == assigned_dept_id))
        if dept:
            roles_to_assign.append(dept.code)

    for role_name in roles_to_assign:
        r_up = role_name.upper().strip()
        role = await db.scalar(select(Role).where(Role.role_name == r_up))
        if not role:
            role = Role(role_name=r_up, description=f"{r_up} standard role")
            db.add(role)
            await db.flush()
        db.add(UserRole(user_id=user.id, role_id=role.id))

    await db.commit()

    # Reload with relations
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari),
            selectinload(User.department)
        )
        .where(User.id == user.id)
    )
    result = await db.scalar(stmt)
    return serialize_user_response(result, is_locked=False)


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all system users with department details, user_code and lock status."""
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari),
            selectinload(User.department)
        )
        .order_by(User.id.desc())
    )
    users = (await db.scalars(stmt)).all()

    # Pre-fetch active locked attempts
    attempts = (await db.scalars(select(LoginAttempt).where(LoginAttempt.locked_until.is_not(None)))).all()
    locked_identities = set()
    for att in attempts:
        if is_attempt_locked(att):
            locked_identities.add(att.identity_key.lower().strip())

    output = []
    for u in users:
        u_locked = (u.email.lower().strip() in locked_identities) or (
            bool(u.user_code and u.user_code.lower().strip() in locked_identities)
        )
        output.append(serialize_user_response(u, is_locked=u_locked))
    return output


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari),
            selectinload(User.department)
        )
        .where(User.id == user_id)
    )
    user = await db.scalar(stmt)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")
    is_locked = await check_user_locked(db, user)
    return serialize_user_response(user, is_locked=is_locked)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user profile, department, role, or active status (Admin only).
    Protects last active Admin from deactivation or role downgrade.
    """
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari),
            selectinload(User.department)
        )
        .where(User.id == user_id)
    )
    user = await db.scalar(stmt)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    # Guard: protect last active admin
    is_current_active_admin = (user.role == UserRoleEnum.ADMIN and user.is_active)
    will_be_active = payload.is_active if payload.is_active is not None else user.is_active
    will_be_admin = (payload.role == UserRoleEnum.ADMIN) if payload.role is not None else (user.role == UserRoleEnum.ADMIN)

    if is_current_active_admin and (not will_be_active or not will_be_admin):
        active_admins_count = await db.scalar(
            select(func.count(User.id))
            .where(and_(User.role == UserRoleEnum.ADMIN, User.is_active == True, User.id != user_id))
        )
        if (active_admins_count or 0) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sistemde en az 1 aktif Sistem Yöneticisi (Admin) bulunmalıdır. Son aktif yönetici pasife alınamaz veya rolü değiştirilemez."
            )

    if payload.email is not None:
        clean_email = payload.email.strip().lower()
        other = await db.scalar(select(User).where(User.email == clean_email, User.id != user_id))
        if other:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"'{clean_email}' e-posta adresi başka bir kullanıcıya ait.")
        user.email = clean_email

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.role is not None:
        user.role = payload.role
    if payload.department_id is not None:
        user.department_id = payload.department_id
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.cari_id is not None:
        user.cari_id = payload.cari_id
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)

    if payload.permissions is not None:
        current_perms = dict(user.permissions or {})
        for mod_id, act_dict in payload.permissions.items():
            if isinstance(act_dict, dict):
                if mod_id not in current_perms:
                    current_perms[mod_id] = {}
                current_perms[mod_id].update(act_dict)
            elif isinstance(act_dict, bool):
                if mod_id not in current_perms:
                    current_perms[mod_id] = {}
                current_perms[mod_id]["read"] = act_dict
        user.permissions = current_perms

    await db.commit()
    await db.refresh(user)
    is_locked = await check_user_locked(db, user)
    return serialize_user_response(user, is_locked=is_locked)


@router.post("/users/{user_id}/reset-password", response_model=UserResponse)
async def reset_user_password(
    user_id: int,
    payload: UserPasswordReset,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Reset user password directly (Admin only)."""
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari),
            selectinload(User.department)
        )
        .where(User.id == user_id)
    )
    user = await db.scalar(stmt)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    await db.refresh(user)
    is_locked = await check_user_locked(db, user)
    return serialize_user_response(user, is_locked=is_locked)


@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def toggle_user_status(
    user_id: int,
    is_active: Optional[bool] = Query(default=None),
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle or set user active/passive status (Admin only). Protects last active Admin."""
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari),
            selectinload(User.department)
        )
        .where(User.id == user_id)
    )
    user = await db.scalar(stmt)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    target_status = is_active if is_active is not None else not user.is_active
    if not target_status and user.role == UserRoleEnum.ADMIN and user.is_active:
        active_admins_count = await db.scalar(
            select(func.count(User.id))
            .where(and_(User.role == UserRoleEnum.ADMIN, User.is_active == True, User.id != user_id))
        )
        if (active_admins_count or 0) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sistemde en az 1 aktif Sistem Yöneticisi (Admin) bulunmalıdır. Son aktif yönetici pasife alınamaz."
            )

    user.is_active = target_status
    await db.commit()
    await db.refresh(user)
    is_locked = await check_user_locked(db, user)
    return serialize_user_response(user, is_locked=is_locked)


@router.patch("/users/{user_id}/permissions", response_model=UserResponse)
async def update_user_permissions(
    user_id: int,
    payload: UserPermissionsUpdate,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    CRITICAL ACL MANAGEMENT:
    Update user-specific permission overrides (overrides department permissions).
    """
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari),
            selectinload(User.department)
        )
        .where(User.id == user_id)
    )
    user = await db.scalar(stmt)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    current_perms = dict(user.permissions or {})
    for mod_id, act_dict in payload.permissions.items():
        if isinstance(act_dict, dict):
            if mod_id not in current_perms:
                current_perms[mod_id] = {}
            current_perms[mod_id].update(act_dict)
        elif isinstance(act_dict, bool):
            if mod_id not in current_perms:
                current_perms[mod_id] = {}
            current_perms[mod_id]["read"] = act_dict

    user.permissions = current_perms
    await db.commit()
    await db.refresh(user)
    is_locked = await check_user_locked(db, user)
    return serialize_user_response(user, is_locked=is_locked)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete user permanently (Admin only). Protects last active Admin."""
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kendi hesabınızı silemezsiniz.")

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    if user.role == UserRoleEnum.ADMIN and user.is_active:
        active_admins_count = await db.scalar(
            select(func.count(User.id))
            .where(and_(User.role == UserRoleEnum.ADMIN, User.is_active == True, User.id != user_id))
        )
        if (active_admins_count or 0) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sistemde en az 1 aktif Sistem Yöneticisi (Admin) bulunmalıdır. Son aktif yönetici silinemez."
            )

    await db.delete(user)
    await db.commit()
    return {"message": f"'{user.email}' kullanıcısı başarıyla silindi."}


@router.post("/users/{user_id}/unlock", response_model=UserResponse)
async def unlock_user(
    user_id: int,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Unlocks a locked user account (Admin only).
    Resets failed login attempt counter and clears lock expiry.
    Logs immutable audit record.
    """
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari),
            selectinload(User.department)
        )
        .where(User.id == user_id)
    )
    user = await db.scalar(stmt)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    keys = [user.email.lower().strip()]
    if user.user_code:
        keys.append(user.user_code.lower().strip())

    conditions = [LoginAttempt.identity_key.in_(keys)]
    for k in keys:
        conditions.append(LoginAttempt.identity_key.like(f"{k}|%"))
        conditions.append(LoginAttempt.identity_key == f"global:{k}")

    attempts = (await db.scalars(
        select(LoginAttempt).where(or_(*conditions))
    )).all()
    
    associated_ips = set()
    for att in attempts:
        att.failed_count = 0
        att.locked_until = None
        att.last_attempt_at = datetime.datetime.now(datetime.timezone.utc)
        if att.ip_address:
            associated_ips.add(att.ip_address)

    # Clear IP-only locks associated with this user
    if associated_ips:
        ip_keys = [f"ip:{ip}" for ip in associated_ips]
        ip_attempts = (await db.scalars(
            select(LoginAttempt).where(LoginAttempt.identity_key.in_(ip_keys))
        )).all()
        for ip_att in ip_attempts:
            ip_att.failed_count = 0
            ip_att.locked_until = None
            ip_att.last_attempt_at = datetime.datetime.now(datetime.timezone.utc)

    await db.commit()

    # Immutable Audit Log
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    audit_msg = (
        f"[AUDIT] Admin '{current_user.email}' (ID: {current_user.id}) unlocked user account "
        f"'{user.email}' (ID: {user.id}, Code: {user.user_code}) at {now_iso}."
    )
    logger.info(audit_msg)
    print(audit_msg)

    return serialize_user_response(user, is_locked=False)


# ---------------------------------------------------------
# Login & Authentication
# ---------------------------------------------------------
@router.post("/login", response_model=Token)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user credentials and issue JWT access token.
    Strict Authentication Policy:
    - Login identity can be exact full email OR B2B user code (case-insensitive, trimmed).
    - Rejects SQL LIKE wildcards (% and _).
    - Protects against brute-force attacks via auth_login_attempts:
      5 failed consecutive attempts result in a 15-minute lockout.
    - Generic error message: 'Geçersiz kullanıcı adı/e-posta veya şifre.'
    """
    identity = payload.email.strip()
    ident_key = identity.lower()

    # Reject wildcard injections immediately
    if "%" in identity or "_" in identity:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kullanıcı adı/e-posta veya şifre."
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    client_ip = get_trusted_client_ip(request)

    pair_key = f"{ident_key}|{client_ip}"
    ip_key = f"ip:{client_ip}"
    global_key = f"global:{ident_key}"

    # 1. Fetch attempt records for IP, (identity + IP), global identity, and legacy keys
    keys_to_query = [pair_key, ip_key, global_key, ident_key]
    attempts = (await db.scalars(
        select(LoginAttempt).where(LoginAttempt.identity_key.in_(keys_to_query))
    )).all()
    attempt_map = {a.identity_key: a for a in attempts}
    pair_attempt = attempt_map.get(pair_key)
    ip_attempt = attempt_map.get(ip_key)
    global_attempt = attempt_map.get(global_key)
    legacy_attempt = attempt_map.get(ident_key)

    # 1a. IP-level Lockout: 20 failed attempts in 15 mins blocks the entire IP
    if is_attempt_locked(ip_attempt):
        lock_until = ip_attempt.locked_until
        if lock_until.tzinfo is None:
            lock_until = lock_until.replace(tzinfo=datetime.timezone.utc)
        remaining_seconds = int((lock_until - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kullanıcı adı/e-posta veya şifre.",
            headers={"Retry-After": str(max(remaining_seconds, 1))}
        )

    # 1b. (Identity + IP) Lockout: 5 failed attempts from same IP blocks that specific user on this IP
    active_pair_lock = is_attempt_locked(pair_attempt) or is_attempt_locked(legacy_attempt)
    if active_pair_lock:
        lock_rec = pair_attempt if is_attempt_locked(pair_attempt) else legacy_attempt
        lock_until = lock_rec.locked_until
        if lock_until.tzinfo is None:
            lock_until = lock_until.replace(tzinfo=datetime.timezone.utc)
        remaining_seconds = int((lock_until - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kullanıcı adı/e-posta veya şifre.",
            headers={"Retry-After": str(max(remaining_seconds, 1))}
        )

    # 1c. Global Identity Throttle: 50 failed attempts across all IPs delays processing
    if global_attempt and global_attempt.failed_count >= 50:
        lat = global_attempt.last_attempt_at
        if lat.tzinfo is None:
            lat = lat.replace(tzinfo=datetime.timezone.utc)
        if (now - lat) <= datetime.timedelta(minutes=15):
            logger.warning(
                f"[SECURITY ALERT] Global brute-force rate threshold (50 attempts) exceeded for '{ident_key}'. "
                f"Throttling response to slow down automated attack."
            )
            await asyncio.sleep(1.0)
        else:
            global_attempt.failed_count = 0

    # 2. Look up user by exact email OR exact user_code OR Cari title
    stmt = (
        select(User)
        .outerjoin(CariAccount, User.cari_id == CariAccount.id)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari),
            selectinload(User.department)
        )
        .where(
            or_(
                func.lower(User.email) == ident_key,
                and_(User.user_code.is_not(None), func.upper(User.user_code) == identity.upper()),
                and_(User.cari_id.is_not(None), func.lower(CariAccount.title) == ident_key)
            )
        )
    )
    user = await db.scalar(stmt)

    # 3. Verify credentials
    credentials_valid = False
    if user and verify_password(payload.password, user.hashed_password):
        credentials_valid = True

    if not credentials_valid:
        # A) Update (Identity + IP) Counter: 5 failures within 15 min = 15m lockout
        if not pair_attempt:
            pair_attempt = LoginAttempt(
                identity_key=pair_key,
                ip_address=client_ip,
                failed_count=1,
                last_attempt_at=now
            )
            db.add(pair_attempt)
        else:
            if pair_attempt.last_attempt_at:
                lat = pair_attempt.last_attempt_at if pair_attempt.last_attempt_at.tzinfo else pair_attempt.last_attempt_at.replace(tzinfo=datetime.timezone.utc)
                if (now - lat) > datetime.timedelta(minutes=15) and not is_attempt_locked(pair_attempt):
                    pair_attempt.failed_count = 0
            pair_attempt.failed_count += 1
            pair_attempt.last_attempt_at = now
            pair_attempt.ip_address = client_ip
            if pair_attempt.failed_count >= 5:
                pair_attempt.locked_until = now + datetime.timedelta(minutes=15)

        # B) Update IP-only Counter: 20 failures within 15 min = 15m IP lockout
        if not ip_attempt:
            ip_attempt = LoginAttempt(
                identity_key=ip_key,
                ip_address=client_ip,
                failed_count=1,
                last_attempt_at=now
            )
            db.add(ip_attempt)
        else:
            if ip_attempt.last_attempt_at:
                lat = ip_attempt.last_attempt_at if ip_attempt.last_attempt_at.tzinfo else ip_attempt.last_attempt_at.replace(tzinfo=datetime.timezone.utc)
                if (now - lat) > datetime.timedelta(minutes=15) and not is_attempt_locked(ip_attempt):
                    ip_attempt.failed_count = 0
            ip_attempt.failed_count += 1
            ip_attempt.last_attempt_at = now
            ip_attempt.ip_address = client_ip
            if ip_attempt.failed_count >= 20:
                ip_attempt.locked_until = now + datetime.timedelta(minutes=15)

        # C) Update Global Identity Counter: 50 failures within 15 min = warning & delay
        if not global_attempt:
            global_attempt = LoginAttempt(
                identity_key=global_key,
                ip_address=None,
                failed_count=1,
                last_attempt_at=now
            )
            db.add(global_attempt)
        else:
            if global_attempt.last_attempt_at:
                lat = global_attempt.last_attempt_at if global_attempt.last_attempt_at.tzinfo else global_attempt.last_attempt_at.replace(tzinfo=datetime.timezone.utc)
                if (now - lat) > datetime.timedelta(minutes=15):
                    global_attempt.failed_count = 0
            global_attempt.failed_count += 1
            global_attempt.last_attempt_at = now
            if global_attempt.failed_count >= 50:
                logger.warning(
                    f"[SECURITY WARNING] Global brute-force threshold (50 failures) reached for identity '{ident_key}'."
                )

        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kullanıcı adı/e-posta veya şifre."
        )

    # 4. Check active status
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabınız pasif duruma getirilmiştir. Lütfen yöneticinizle görüşün."
        )

    # 5. Successful login: Reset pair attempt and global counter for this user and this IP
    keys_to_reset = [
        pair_key,
        global_key,
        ident_key,
        user.email.lower().strip()
    ]
    if user.user_code:
        keys_to_reset.append(user.user_code.lower().strip())
        keys_to_reset.append(f"{user.user_code.lower().strip()}|{client_ip}")
        keys_to_reset.append(f"global:{user.user_code.lower().strip()}")

    reset_attempts = (await db.scalars(
        select(LoginAttempt).where(LoginAttempt.identity_key.in_(keys_to_reset))
    )).all()
    for att in reset_attempts:
        att.failed_count = 0
        att.locked_until = None
        att.last_attempt_at = now

    await db.commit()

    roles_list = [r.role_name for r in user.roles]
    effective_perms = user.get_effective_permissions()
    expires = datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    ua_header = request.headers.get("user-agent", "")
    token = create_access_token(
        data={
            "sub": user.email,
            "user_id": user.id,
            "roles": roles_list,
            "cari_id": user.cari_id,
            "user_role": user.role.value,
            "department_id": user.department_id,
            "permissions": effective_perms
        },
        expires_delta=expires,
        user_agent=ua_header
    )

    return Token(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        roles=roles_list,
        cari_id=user.cari_id,
        user_role=user.role.value,
        department_id=user.department_id,
        department_name=user.department.name if user.department else None,
        permissions=effective_perms
    )


@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    """Retrieve authenticated user's profile with effective permissions matrix."""
    return serialize_user_response(current_user)


# ---------------------------------------------------------
# Legacy Roles Endpoints
# ---------------------------------------------------------
@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    existing_role = await db.scalar(select(Role).where(Role.role_name == payload.role_name.upper()))
    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{payload.role_name}' already exists."
        )

    role = Role(role_name=payload.role_name.upper(), description=payload.description)
    db.add(role)
    await db.flush()

    for perm_in in payload.permissions:
        perm = ModulePermission(
            role_id=role.id,
            module_name=perm_in.module_name.lower(),
            can_read=perm_in.can_read,
            can_write=perm_in.can_write,
            can_delete=perm_in.can_delete
        )
        db.add(perm)

    await db.commit()
    stmt = select(Role).options(selectinload(Role.permissions)).where(Role.id == role.id)
    result = await db.scalar(stmt)
    return result


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Role).options(selectinload(Role.permissions))
    result = await db.scalars(stmt)
    return list(result.all())
