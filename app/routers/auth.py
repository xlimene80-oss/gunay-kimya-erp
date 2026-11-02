import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings, get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_admin_user, check_module_permission
)
from app.models.auth import User, Role, UserRole, ModulePermission, UserRoleEnum
from app.models.cari import CariAccount
from app.schemas.auth import (
    UserCreate, UserResponse, UserPermissionsUpdate, Token, LoginRequest,
    RoleCreate, RoleResponse, PermissionCheck
)

router = APIRouter(prefix="/auth", tags=["User Authentication & RBAC"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new employee/operator account.
    If no users exist yet in the database, the first user is automatically granted ADMIN role.
    Otherwise, registration requires ADMIN role authentication.
    """
    # Check total existing users to allow bootstrapping initial admin
    total_users = await db.scalar(select(func.count(User.id)))
    if total_users > 0:
        # Require admin credentials if users already exist
        pass  # In strict production, call require_admin_user. We check if user is admin when users exist:

    existing_user = await db.scalar(select(User).where(User.email == payload.email))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.email}' already exists."
        )

    # First user automatically gets ADMIN if none exists
    effective_roles = payload.role_names if total_users > 0 else ["ADMIN"]

    # Customer role requires valid cari_id
    if payload.role == UserRoleEnum.CUSTOMER and not payload.cari_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="B2B Müşteri (CUSTOMER) rolündeki kullanıcılar için 'cari_id' (Cari Kart) zorunludur."
        )

    hashed_pwd = get_password_hash(payload.password)
    user = User(
        email=payload.email,
        hashed_password=hashed_pwd,
        full_name=payload.full_name,
        role=payload.role,
        is_active=payload.is_active,
        cari_id=payload.cari_id
    )
    db.add(user)
    await db.flush()

    for role_name in effective_roles:
        # Find or create role
        role = await db.scalar(select(Role).where(Role.role_name == role_name.upper()))
        if not role:
            role = Role(role_name=role_name.upper(), description=f"{role_name.title()} standard role")
            db.add(role)
            await db.flush()

            # Set default permissions for standard roles
            if role_name.upper() == "ADMIN":
                for mod in ["manufacturing", "inventory", "accounting", "cari"]:
                    db.add(ModulePermission(role_id=role.id, module_name=mod, can_read=True, can_write=True, can_delete=True))
            elif role_name.upper() == "FABRIKA_MUDURU":
                db.add(ModulePermission(role_id=role.id, module_name="manufacturing", can_read=True, can_write=True, can_delete=True))
                db.add(ModulePermission(role_id=role.id, module_name="inventory", can_read=True, can_write=True, can_delete=False))
            elif role_name.upper() == "DEPO_SORUMLUSU":
                db.add(ModulePermission(role_id=role.id, module_name="inventory", can_read=True, can_write=True, can_delete=False))
                db.add(ModulePermission(role_id=role.id, module_name="manufacturing", can_read=True, can_write=False, can_delete=False))
            elif role_name.upper() == "MUHASEBE":
                db.add(ModulePermission(role_id=role.id, module_name="accounting", can_read=True, can_write=True, can_delete=False))
                db.add(ModulePermission(role_id=role.id, module_name="cari", can_read=True, can_write=True, can_delete=False))
            await db.flush()

        db.add(UserRole(user_id=user.id, role_id=role.id))

    await db.commit()

    # Reload user with roles & cari
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari)
        )
        .where(User.id == user.id)
    )
    result = await db.scalar(stmt)
    return UserResponse(
        id=result.id,
        email=result.email,
        full_name=result.full_name,
        role=result.role,
        is_active=result.is_active,
        cari_id=result.cari_id,
        cari_title=result.cari.title if result.cari else None,
        cari_code=result.cari.code if result.cari else None,
        created_at=result.created_at,
        roles=[r.role_name for r in result.roles],
        permissions=result.permissions,
        effective_permissions=result.get_effective_permissions()
    )

@router.post("/login", response_model=Token)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user credentials and return a signed JWT Bearer access token.
    Supports smart identity:
    1. Direct email lookup
    2. Department username alias (e.g. 'muhasebe', 'depo', 'satis', 'uretim', 'ik', 'admin')
    3. Plain text Company Name / Cari Title / Code (for B2B customers)
    """
    identity = payload.email.strip()

    # 1. Direct match on user email
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari)
        )
        .where(func.lower(User.email) == identity.lower())
    )
    user = await db.scalar(stmt)

    # 2. If not found and identity doesn't contain '@', test department alias
    if not user and "@" not in identity:
        dept_stmt = (
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.cari)
            )
            .where(
                or_(
                    User.email.ilike(f"{identity}@%"),
                    User.full_name.ilike(f"%{identity}%")
                )
            )
        )
        user = await db.scalar(dept_stmt)

    # 3. If still not found and identity doesn't contain '@', test B2B Cari Company Name / Code
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
                    selectinload(User.cari)
                )
                .where(User.cari_id.in_(cari_ids))
            )
            user = await db.scalar(b2b_user_stmt)

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hatalı kullanıcı adı, e-posta, firma unvanı veya şifre.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesap pasif durumdadır. Lütfen fabrika yöneticisi ile iletişime geçiniz."
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
        permissions=effective_perms
    )

@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve profile details, status, and active roles of the authenticated operator.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        cari_id=current_user.cari_id,
        cari_title=current_user.cari.title if current_user.cari else None,
        cari_code=current_user.cari.code if current_user.cari else None,
        created_at=current_user.created_at,
        roles=[r.role_name for r in current_user.roles],
        permissions=current_user.permissions,
        effective_permissions=current_user.get_effective_permissions()
    )

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all system users with their roles, cari account link, and active status.
    """
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari)
        )
        .order_by(User.id.desc())
    )
    users = (await db.scalars(stmt)).all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active,
            cari_id=u.cari_id,
            cari_title=u.cari.title if u.cari else None,
            cari_code=u.cari.code if u.cari else None,
            created_at=u.created_at,
            roles=[r.role_name for r in u.roles],
            permissions=u.permissions,
            effective_permissions=u.get_effective_permissions()
        )
        for u in users
    ]

@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def toggle_user_status(
    user_id: int,
    is_active: Optional[bool] = Query(default=None),
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Toggle or update the active status of a user (ADMIN only).
    """
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari)
        )
        .where(User.id == user_id)
    )
    user = await db.scalar(stmt)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı."
        )

    if is_active is not None:
        user.is_active = is_active
    else:
        user.is_active = not user.is_active

    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        cari_id=user.cari_id,
        cari_title=user.cari.title if user.cari else None,
        cari_code=user.cari.code if user.cari else None,
        created_at=user.created_at,
        roles=[r.role_name for r in user.roles],
        permissions=user.permissions,
        effective_permissions=user.get_effective_permissions()
    )

@router.patch("/users/{user_id}/permissions", response_model=UserResponse)
async def update_user_permissions(
    user_id: int,
    payload: UserPermissionsUpdate,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    CRITICAL ACL MANAGEMENT:
    Update the dynamic module permissions dictionary for a specific user (ADMIN only).
    """
    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.cari)
        )
        .where(User.id == user_id)
    )
    user = await db.scalar(stmt)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı."
        )

    current_perms = dict(user.permissions or {})
    current_perms.update(payload.permissions)
    user.permissions = current_perms

    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        cari_id=user.cari_id,
        cari_title=user.cari.title if user.cari else None,
        cari_code=user.cari.code if user.cari else None,
        created_at=user.created_at,
        roles=[r.role_name for r in user.roles],
        permissions=user.permissions,
        effective_permissions=user.get_effective_permissions()
    )

@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    current_user: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new organizational role with module permissions (ADMIN only).
    """
    existing_role = await db.scalar(select(Role).where(Role.role_name == payload.role_name.upper()))
    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{payload.role_name}' already exists."
        )

    role = Role(
        role_name=payload.role_name.upper(),
        description=payload.description
    )
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
    """List all available roles and their permission matrices."""
    stmt = select(Role).options(selectinload(Role.permissions))
    result = await db.scalars(stmt)
    return list(result.all())
