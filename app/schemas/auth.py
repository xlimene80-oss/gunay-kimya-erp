import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.auth import UserRoleEnum

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


# ---------------------------------------------------------
# Department Schemas
# ---------------------------------------------------------
class DepartmentBase(BaseModel):
    name: str = Field(..., max_length=100, description="Departman Adı, örn: Üretim, Satış, Depo")
    code: str = Field(..., max_length=50, description="Departman Kodu, örn: URETIM, SATIS, DEPO")
    description: Optional[str] = Field(default=None, max_length=255)
    is_active: bool = Field(default=True)
    permissions: Optional[Dict[str, Any]] = Field(default=None, description="5-kolonlu varsayılan yetki matrisi")

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[Dict[str, Any]] = None

class DepartmentResponse(DepartmentBase):
    id: int
    user_count: int = 0
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# User Schemas
# ---------------------------------------------------------
class UserBase(BaseModel):
    email: str = Field(..., max_length=120, description="User login email")
    full_name: str = Field(..., max_length=150, description="Employee full name")
    role: UserRoleEnum = Field(default=UserRoleEnum.STAFF, description="admin, staff, customer")
    is_active: bool = Field(default=True)
    department_id: Optional[int] = Field(default=None, description="Bağlı olduğu departman ID")
    user_code: Optional[str] = Field(default=None, max_length=20, description="B2B kullanıcı kodu, örn: B2B-0001")

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Plaintext password to hash")
    role_names: Optional[List[str]] = Field(default=None, description="Assigned role names e.g. ADMIN, MUHASEBE")
    cari_id: Optional[int] = Field(default=None, description="B2B müşteri kullanıcısı ise zorunlu olan CariAccount ID")

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRoleEnum] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    role_names: Optional[List[str]] = None
    cari_id: Optional[int] = None
    permissions: Optional[Dict[str, Any]] = None

class UserPasswordReset(BaseModel):
    new_password: str = Field(..., min_length=6, description="Yeni şifre")

class UserRoleSummary(BaseModel):
    id: int
    role_name: str
    model_config = ConfigDict(from_attributes=True)

class UserPermissionsUpdate(BaseModel):
    permissions: Dict[str, Any] = Field(..., description="5-kolonlu yetki matrisi override eşleşmesi")

class UserResponse(UserBase):
    id: int
    user_code: Optional[str] = None
    is_locked: bool = False
    cari_id: Optional[int] = None
    cari_title: Optional[str] = None
    cari_code: Optional[str] = None
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    created_at: datetime.datetime
    roles: List[str] = []
    permissions: Optional[Dict[str, Any]] = None
    effective_permissions: Dict[str, Any] = {}

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
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None

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
