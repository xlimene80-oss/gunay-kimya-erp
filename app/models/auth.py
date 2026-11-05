import enum
import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    String, Text, Boolean, Integer, ForeignKey, 
    DateTime, func, UniqueConstraint, Enum as SQLEnum, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class UserRoleEnum(str, enum.Enum):
    ADMIN = "admin"
    STAFF = "staff"       # Şirket çalışanları / Operatörler
    CUSTOMER = "customer" # B2B Müşterileri (cari_id zorunlu)

UserType = UserRoleEnum

MODULE_ACTIONS = ["read", "create", "update", "delete", "approve"]

ALL_MODULES = [
    # 1. Ana Panel
    {"id": "ana_panel", "name": "Ana Panel", "category": "Ana Panel"},
    # 2. Satış & B2B
    {"id": "orders", "name": "Siparişler", "category": "Satış & B2B"},
    {"id": "b2b", "name": "B2B Bayi Siparişleri", "category": "Satış & B2B"},
    {"id": "customers", "name": "Müşteriler", "category": "Satış & B2B"},
    {"id": "logistics", "name": "Sevkiyat / İrsaliye", "category": "Satış & B2B"},
    {"id": "manual_orders_planning", "name": "Fiyat Listeleri", "category": "Satış & B2B"},
    # 3. Satın Alma
    {"id": "suppliers", "name": "Tedarikçiler", "category": "Satın Alma"},
    {"id": "purchasing_requests", "name": "Satın Alma Siparişleri", "category": "Satın Alma"},
    {"id": "goods_receipt", "name": "Mal Kabul", "category": "Satın Alma"},
    # 4. Stok & Depo
    {"id": "products_raw_materials", "name": "Ürünler", "category": "Stok & Depo"},
    {"id": "products_sds_warning", "name": "Hammaddeler", "category": "Stok & Depo"},
    {"id": "inventory_stock", "name": "Stok Durumu", "category": "Stok & Depo"},
    {"id": "warehouse_layout", "name": "Depo Hareketleri", "category": "Stok & Depo"},
    {"id": "scanner", "name": "Sayım", "category": "Stok & Depo"},
    # 5. Üretim
    {"id": "factory_dashboard", "name": "Üretim Emirleri", "category": "Üretim"},
    {"id": "bom_management", "name": "Reçeteler", "category": "Üretim"},
    {"id": "pallet_box_center", "name": "Koli / Palet Barkod", "category": "Üretim"},
    {"id": "traceability", "name": "Kalite & İzlenebilirlik", "category": "Üretim"},
    # 6. Finans
    {"id": "fin_invoices", "name": "Faturalar", "category": "Finans"},
    {"id": "fin_payments", "name": "Tahsilat / Ödeme", "category": "Finans"},
    {"id": "fin_accounts", "name": "Cari Hesaplar", "category": "Finans"},
    {"id": "dashboard", "name": "Raporlar", "category": "Finans"},
    # 7. İnsan Kaynakları
    {"id": "hr_interviews", "name": "İş Başvuruları", "category": "İnsan Kaynakları"},
    {"id": "hr_personnel", "name": "Personel", "category": "İnsan Kaynakları"},
    {"id": "hr_leave", "name": "İzinler", "category": "İnsan Kaynakları"},
    {"id": "hr_attendance", "name": "Puantaj", "category": "İnsan Kaynakları"},
    {"id": "hr_movements", "name": "Personel Hareketleri", "category": "İnsan Kaynakları"},
    {"id": "reports_employee", "name": "Faaliyet Raporları", "category": "İnsan Kaynakları"},
    # 8. Ayarlar
    {"id": "settings_users", "name": "Kullanıcılar", "category": "Ayarlar"},
    {"id": "settings_permissions", "name": "Yetkiler", "category": "Ayarlar"},
    {"id": "settings_system", "name": "Sistem", "category": "Ayarlar"}
]

def get_empty_permissions() -> Dict[str, Dict[str, bool]]:
    """Returns a fresh dictionary with all modules and actions set to False."""
    return {
        m["id"]: {act: False for act in MODULE_ACTIONS}
        for m in ALL_MODULES
    }

def get_admin_permissions() -> Dict[str, Dict[str, bool]]:
    """Full permissions across all modules and actions."""
    return {
        m["id"]: {act: True for act in MODULE_ACTIONS}
        for m in ALL_MODULES
    }

def get_customer_permissions() -> Dict[str, Dict[str, bool]]:
    """Isolated B2B Customer permissions."""
    perms = get_empty_permissions()
    # B2B Bayi can read/create orders and view statement
    for m in ["b2b", "orders"]:
        perms[m] = {"read": True, "create": True, "update": False, "delete": False, "approve": False}
    return perms

def get_default_department_permissions(code: str) -> Dict[str, Dict[str, bool]]:
    """Generates standard default permissions for base corporate departments."""
    perms = get_empty_permissions()
    c = code.upper().strip()

    # Everyone internal can read Ana Panel
    perms["ana_panel"]["read"] = True

    if c in ["YONETIM", "ADMIN"]:
        return get_admin_permissions()

    elif c == "URETIM":
        for m in ["factory_dashboard", "bom_management", "pallet_box_center", "traceability"]:
            perms[m] = {"read": True, "create": True, "update": True, "delete": False, "approve": True}
        for m in ["products_raw_materials", "products_sds_warning", "inventory_stock"]:
            perms[m]["read"] = True

    elif c == "SATIS":
        for m in ["orders", "b2b", "customers", "logistics", "manual_orders_planning"]:
            perms[m] = {"read": True, "create": True, "update": True, "delete": False, "approve": False}
        perms["reports_employee"] = {"read": True, "create": True, "update": False, "delete": False, "approve": False}
        perms["inventory_stock"]["read"] = True

    elif c == "SATINALMA":
        for m in ["suppliers", "purchasing_requests", "goods_receipt"]:
            perms[m] = {"read": True, "create": True, "update": True, "delete": False, "approve": True}
        for m in ["products_raw_materials", "products_sds_warning", "inventory_stock"]:
            perms[m]["read"] = True

    elif c == "DEPO":
        for m in ["products_raw_materials", "products_sds_warning", "inventory_stock", "warehouse_layout", "scanner", "goods_receipt", "pallet_box_center"]:
            perms[m] = {"read": True, "create": True, "update": True, "delete": False, "approve": True}
        perms["logistics"]["read"] = True

    elif c == "MUHASEBE":
        for m in ["fin_invoices", "fin_payments", "fin_accounts", "dashboard"]:
            perms[m] = {"read": True, "create": True, "update": True, "delete": False, "approve": True}
        for m in ["orders", "customers", "logistics", "purchasing_requests"]:
            perms[m]["read"] = True

    elif c == "IK":
        for m in ["hr_interviews", "hr_personnel", "hr_leave", "hr_attendance", "hr_movements", "reports_employee"]:
            perms[m] = {"read": True, "create": True, "update": True, "delete": False, "approve": True}

    elif c == "KALITE":
        for m in ["traceability", "products_sds_warning"]:
            perms[m] = {"read": True, "create": True, "update": True, "delete": False, "approve": True}
        for m in ["factory_dashboard", "bom_management", "inventory_stock"]:
            perms[m]["read"] = True

    return perms


class Department(Base, TimestampMixin):
    """
    Corporate department master entity with default permissions matrix.
    """
    __tablename__ = "auth_departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Granular 5-column permissions: { "orders": { "read": True, "create": True, ... } }
    permissions: Mapped[Optional[dict]] = mapped_column(JSON, default=dict, nullable=True)

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User", 
        back_populates="department",
        lazy="selectin"
    )

    def get_effective_permissions(self) -> Dict[str, Dict[str, bool]]:
        """Returns normalized 5-column permissions matrix for the department."""
        base = get_default_department_permissions(self.code)
        if self.permissions and isinstance(self.permissions, dict):
            for mod_id, acts in self.permissions.items():
                if mod_id in base and isinstance(acts, dict):
                    base[mod_id].update(acts)
                elif isinstance(acts, dict):
                    base[mod_id] = acts
        return base


class User(Base, TimestampMixin):
    """
    System user master account for ERP operators, managers, accountants, and B2B customers.
    """
    __tablename__ = "auth_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[UserRoleEnum] = mapped_column(
        SQLEnum(UserRoleEnum, values_callable=lambda x: [e.value for e in x], name="user_role_enum", native_enum=False),
        default=UserRoleEnum.STAFF,
        nullable=False,
        server_default="staff"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    cari_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cari_accounts.id", ondelete="SET NULL"), index=True, nullable=True)

    # B2B unique customer user code (e.g. B2B-0001)
    user_code: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True, nullable=True)

    # Department association
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("auth_departments.id", ondelete="SET NULL"), index=True, nullable=True)

    # User-specific permissions override matrix (overrides department defaults)
    permissions: Mapped[Optional[dict]] = mapped_column(JSON, default=dict, nullable=True)

    # Relationships
    department: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_id], lazy="selectin", back_populates="users")
    cari: Mapped[Optional["CariAccount"]] = relationship("CariAccount", foreign_keys=[cari_id], lazy="selectin", back_populates="users")
    user_roles: Mapped[List["UserRole"]] = relationship(
        "UserRole", 
        back_populates="user", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    @property
    def roles(self) -> List["Role"]:
        return [ur.role for ur in self.user_roles if ur.role is not None]

    def get_effective_permissions(self) -> Dict[str, Dict[str, bool]]:
        """
        Calculates dynamic effective permissions:
        1. If ADMIN: All modules & actions are True.
        2. If CUSTOMER: Restricted B2B customer permissions.
        3. If STAFF: Inherits Department permissions, overridden by user-specific permissions.
        """
        if self.role == UserRoleEnum.ADMIN:
            return get_admin_permissions()

        if self.role == UserRoleEnum.CUSTOMER:
            base = get_customer_permissions()
        elif self.department:
            base = self.department.get_effective_permissions()
        else:
            base = get_empty_permissions()
            base["ana_panel"]["read"] = True

        # Apply user-specific overrides
        if self.permissions and isinstance(self.permissions, dict):
            for mod_id, acts in self.permissions.items():
                if isinstance(acts, dict):
                    if mod_id not in base:
                        base[mod_id] = {act: False for act in MODULE_ACTIONS}
                    base[mod_id].update(acts)
                elif isinstance(acts, bool):
                    # Legacy flat boolean format support
                    if mod_id not in base:
                        base[mod_id] = {act: False for act in MODULE_ACTIONS}
                    base[mod_id]["read"] = acts

        return base

    def has_permission(self, module_id: str, action: str = "read") -> bool:
        """Evaluates whether the user holds active permission for a module/operation."""
        if self.role == UserRoleEnum.ADMIN:
            return True
        perms = self.get_effective_permissions()
        mod_perms = perms.get(module_id)
        if isinstance(mod_perms, dict):
            return bool(mod_perms.get(action, False))
        elif isinstance(mod_perms, bool):
            return mod_perms
        return False


class Role(Base, TimestampMixin):
    """
    Access roles defining permissions (e.g., ADMIN, FABRIKA_MUDURU, DEPO_SORUMLUSU, MUHASEBE).
    """
    __tablename__ = "auth_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    user_roles: Mapped[List["UserRole"]] = relationship(
        "UserRole", 
        back_populates="role", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    permissions: Mapped[List["ModulePermission"]] = relationship(
        "ModulePermission", 
        back_populates="role", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class UserRole(Base, TimestampMixin):
    """
    Junction table mapping users to one or multiple organizational roles.
    """
    __tablename__ = "auth_user_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("auth_users.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    role_id: Mapped[int] = mapped_column(
        ForeignKey("auth_roles.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="user_roles")
    role: Mapped["Role"] = relationship("Role", back_populates="user_roles", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )


class ModulePermission(Base, TimestampMixin):
    """
    Granular RBAC privileges on ERP functional domains.
    """
    __tablename__ = "auth_module_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(
        ForeignKey("auth_roles.id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    module_name: Mapped[str] = mapped_column(
        String(50), 
        index=True, 
        nullable=False
    )
    can_read: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_write: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    role: Mapped["Role"] = relationship("Role", back_populates="permissions")

    __table_args__ = (
        UniqueConstraint("role_id", "module_name", name="uq_role_module_permission"),
    )


class LoginAttempt(Base):
    """
    Tracks failed login attempts and multi-layer brute-force security locks:
    - (Identity + IP): 5 consecutive failed attempts trigger a 15-minute lockout.
    - (IP only): 20 failed attempts in 15 minutes trigger a 15-minute IP block.
    - (Global Identity): 50 failed attempts trigger rate-limiting progressive delay and security warning.
    """
    __tablename__ = "auth_login_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    identity_key: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), index=True, nullable=True)
    failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_attempt_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False
    )
