import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------------------------------------------------------
# Permission & Role Schemas
# ---------------------------------------------------------
class ModulePermissionBase(BaseModel):
    module_name: str = Field(..., max_length=50, description="manufacturing, inventory, accounting, cari")
    can_read: bool = Field(default=True)
    can_write: bool = Field(default=False)
    can_delete: bool = Field(default=False)

class ModulePermissionCreate(ModulePermissionBase):
    pass

class ModulePermissionResponse(ModulePermissionBase):
    id: int
    role_id: int
    model_config = ConfigDict(from_attributes=True)

class RoleBase(BaseModel):
    role_name: str = Field(..., max_length=50, description="e.g. ADMIN, FABRIKA_MUDURU, DEPO_SORUMLUSU, MUHASEBE")
    description: Optional[str] = Field(default=None, max_length=255)

class RoleCreate(RoleBase):
    permissions: List[ModulePermissionCreate] = []

class RoleResponse(RoleBase):
    id: int
    permissions: List[ModulePermissionResponse] = []
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)


from app.models.auth import UserRoleEnum

# ---------------------------------------------------------
# User Schemas
# ---------------------------------------------------------
class UserBase(BaseModel):
    email: str = Field(..., max_length=120, description="User login email")
    full_name: str = Field(..., max_length=150, description="Employee full name")
    role: UserRoleEnum = Field(default=UserRoleEnum.STAFF, description="admin, staff, customer")
    is_active: bool = Field(default=True)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Plaintext password to hash")
    role_names: List[str] = Field(default=["DEPO_SORUMLUSU"], description="Assigned role names e.g. ADMIN, MUHASEBE")
    cari_id: Optional[int] = Field(default=None, description="B2B müşteri kullanıcısı ise zorunlu olan CariAccount ID")

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRoleEnum] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    role_names: Optional[List[str]] = None
    cari_id: Optional[int] = None

class UserRoleSummary(BaseModel):
    id: int
    role_name: str
    model_config = ConfigDict(from_attributes=True)

class UserPermissionsUpdate(BaseModel):
    permissions: Dict[str, bool] = Field(..., description="Mapping of permission keys to boolean enabled states")

class UserResponse(UserBase):
    id: int
    cari_id: Optional[int] = None
    cari_title: Optional[str] = None
    cari_code: Optional[str] = None
    created_at: datetime.datetime
    roles: List[str] = []
    permissions: Optional[Dict[str, bool]] = None
    effective_permissions: Dict[str, bool] = {}

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Token & Session Schemas
# ---------------------------------------------------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    roles: List[str] = []
    cari_id: Optional[int] = None
    user_role: Optional[str] = None
    permissions: Optional[Dict[str, bool]] = None

class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
    roles: List[str] = []
    cari_id: Optional[int] = None
    user_role: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class PermissionCheck(BaseModel):
    module_name: str
    can_read: bool
    can_write: bool
    can_delete: bool
