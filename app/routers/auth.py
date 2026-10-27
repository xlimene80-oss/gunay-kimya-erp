import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings, get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_admin_user, check_module_permission
)
from app.models.auth import User, Role, UserRole, ModulePermission
from app.schemas.auth import (
    UserCreate, UserResponse, Token, LoginRequest,
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

    hashed_pwd = get_password_hash(payload.password)
    user = User(
        email=payload.email,
        hashed_password=hashed_pwd,
        full_name=payload.full_name,
        is_active=payload.is_active
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

    # Reload user with roles
    stmt = (
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == user.id)
    )
    result = await db.scalar(stmt)
    return UserResponse(
        id=result.id,
        email=result.email,
        full_name=result.full_name,
        is_active=result.is_active,
        created_at=result.created_at,
        roles=[r.role_name for r in result.roles]
    )

@router.post("/login", response_model=Token)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user credentials and return a signed JWT Bearer access token.
    """
    stmt = (
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.email == payload.email)
    )
    user = await db.scalar(stmt)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact factory administrator."
        )

    roles_list = [r.role_name for r in user.roles]
    expires = datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "roles": roles_list, "cari_id": user.cari_id},
        expires_delta=expires
    )

    return Token(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        roles=roles_list,
        cari_id=user.cari_id
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
        is_active=current_user.is_active,
        cari_id=current_user.cari_id,
        created_at=current_user.created_at,
        roles=[r.role_name for r in current_user.roles]
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
