import datetime
import hashlib
from typing import Optional, List, Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        bcrypt.__about__ = type("About", (), {"__version__": getattr(bcrypt, "__version__", "4.0.1")})()
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

    def get_password_hash(password: str) -> str:
        try:
            return pwd_context.hash(password)
        except Exception:
            return hashlib.sha256(password.encode()).hexdigest()
except ImportError:
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

    def get_password_hash(password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

try:
    from jose import JWTError, jwt
except ImportError:
    import jwt
    from jwt import PyJWTError as JWTError

from app.core.config import settings, get_db
from app.models.auth import User, Role, UserRole, ModulePermission
from app.schemas.auth import TokenData

security_scheme = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Create a signed JWT access token with user claims and expiration."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Extract and validate the active user from the JWT Bearer token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: Optional[str] = payload.get("sub")
        user_id: Optional[int] = payload.get("user_id")
        if email is None and user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles)
            .selectinload(UserRole.role)
            .selectinload(Role.permissions)
        )
        .where(User.email == email if email else User.id == user_id)
    )
    user = await db.scalar(stmt)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account."
        )
    return user

async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Gracefully extract user if Bearer token present, else return None without raising 401."""
    if not credentials or not credentials.credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: Optional[str] = payload.get("sub")
        user_id: Optional[int] = payload.get("user_id")
        if not email and not user_id:
            return None
        stmt = (
            select(User)
            .options(
                selectinload(User.user_roles)
                .selectinload(UserRole.role)
                .selectinload(Role.permissions)
            )
            .where(User.email == email if email else User.id == user_id)
        )
        user = await db.scalar(stmt)
        return user if user and user.is_active else None
    except Exception:
        return None

async def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Ensure the authenticated user holds the ADMIN role."""
    user_roles = [r.role_name for r in current_user.roles]
    if "ADMIN" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges (ADMIN role) required."
        )
    return current_user

def check_module_permission(module_name: str, action: str = "write") -> Callable:
    """
    CRITICAL SECURITY GUARDRAILS:
    Factory dependency checking whether current user holds the required permission
    on a specific functional module ('manufacturing', 'inventory', 'accounting', 'cari').
    
    1. ADMINs automatically bypass all module restrictions.
    2. Sub-users are checked against can_read, can_write, or can_delete.
    3. Throws HTTP 403 Forbidden if not authorized.
    """
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_names = [r.role_name for r in current_user.roles]
        if "ADMIN" in user_role_names:
            return current_user

        # Inspect permissions across all assigned roles
        has_permission = False
        for user_role in current_user.user_roles:
            role = user_role.role
            if not role:
                continue
            for perm in role.permissions:
                if perm.module_name.lower() == module_name.lower():
                    if action == "write" and perm.can_write:
                        has_permission = True
                        break
                    elif action == "read" and perm.can_read:
                        has_permission = True
                        break
                    elif action == "delete" and perm.can_delete:
                        has_permission = True
                        break
            if has_permission:
                break

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: You do not hold '{action}' privileges for the '{module_name}' module."
            )
        return current_user

    return permission_checker
