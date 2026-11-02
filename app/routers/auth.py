import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings, get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_admin_user, check_module_permission
)
from app.models.auth import (
    User, Role, UserRole, ModulePermission, UserRoleEnum,
    Department, ALL_MODULES, MODULE_ACTIONS, get_default_department_permissions
)
from app.models.cari import CariAccount
from app.schemas.auth import (
    UserCreate, UserUpdate, UserResponse, UserPermissionsUpdate, UserPasswordReset,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    Token, LoginRequest, RoleCreate, RoleResponse, PermissionCheck
)

router = APIRouter(prefix="/auth", tags=["User Authentication & RBAC"])


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
def serialize_user_response(u: User) -> UserResponse:
    """Helper to cleanly serialize user with department and effective permissions."""
    return UserResponse(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        is_active=u.is_active,
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
    db: AsyncSession = Depends(get_db)
):
    """
    Register or create a new user account (Staff, Admin, or B2B Customer).
    Auto-assigns Department and Role, and enforces B2B Cari isolation.
    """
    existing_user = await db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{payload.email}' e-posta adresiyle kayıtlı bir kullanıcı zaten mevcut."
        )

    total_users = await db.scalar(select(func.count(User.id)))
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

    hashed_pwd = get_password_hash(payload.password)
    user = User(
        email=payload.email.strip().lower(),
        hashed_password=hashed_pwd,
        full_name=payload.full_name.strip(),
        role=effective_role,
        is_active=payload.is_active,
        cari_id=payload.cari_id,
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
    return serialize_user_response(result)


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all system users with department details and permission matrix."""
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
    return [serialize_user_response(u) for u in users]


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
    return serialize_user_response(user)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user profile, department, role, or active status (Admin only).
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
    return serialize_user_response(user)


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
    return serialize_user_response(user)


@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def toggle_user_status(
    user_id: int,
    is_active: Optional[bool] = Query(default=None),
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle or set user active/passive status (Admin only)."""
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

    if is_active is not None:
        user.is_active = is_active
    else:
        user.is_active = not user.is_active

    await db.commit()
    await db.refresh(user)
    return serialize_user_response(user)


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
    return serialize_user_response(user)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete user permanently (Admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kendi hesabınızı silemezsiniz.")

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    await db.delete(user)
    await db.commit()
    return {"message": f"'{user.email}' kullanıcısı başarıyla silindi."}


# ---------------------------------------------------------
# Login & Authentication
# ---------------------------------------------------------
@router.post("/login", response_model=Token)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user credentials and issue JWT access token."""
    identity = payload.email.strip()

    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari),
            selectinload(User.department)
        )
        .where(func.lower(User.email) == identity.lower())
    )
    user = await db.scalar(stmt)

    # Alias fallback
    if not user and "@" not in identity:
        dept_stmt = (
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.cari),
                selectinload(User.department)
            )
            .where(
                or_(
                    User.email.ilike(f"{identity}@%"),
                    User.full_name.ilike(f"%{identity}%")
                )
            )
        )
        user = await db.scalar(dept_stmt)

    if not user and "@" not in identity:
        cari_stmt = (
            select(CariAccount)
            .where(
                or_(
                    CariAccount.title.ilike(f"%{identity}%"),
                    CariAccount.code.ilike(f"%{identity}%")
                )
            )
        )
        caris = (await db.scalars(cari_stmt)).all()
        if caris:
            cari_ids = [c.id for c in caris]
            b2b_user_stmt = (
                select(User)
                .options(
                    selectinload(User.user_roles).selectinload(UserRole.role),
                    selectinload(User.cari),
                    selectinload(User.department)
                )
                .where(User.cari_id.in_(cari_ids))
            )
            user = await db.scalar(b2b_user_stmt)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kullanıcı adı/e-posta veya şifre."
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kullanıcı adı/e-posta veya şifre."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabınız pasif duruma getirilmiştir. Lütfen yöneticinizle görüşün."
        )

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
