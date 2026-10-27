import datetime
from typing import Optional, List
from sqlalchemy import (
    String, Text, Boolean, Integer, ForeignKey, 
    DateTime, func, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class User(Base, TimestampMixin):
    """
    System user master account for ERP operators, managers, and accountants.
    """
    __tablename__ = "auth_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    cari_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cari_accounts.id", ondelete="SET NULL"), index=True, nullable=True)

    # Relationships
    cari: Mapped[Optional["CariAccount"]] = relationship("CariAccount", foreign_keys=[cari_id], lazy="selectin")
    user_roles: Mapped[List["UserRole"]] = relationship(
        "UserRole", 
        back_populates="user", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    @property
    def roles(self) -> List["Role"]:
        return [ur.role for ur in self.user_roles if ur.role is not None]


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
    Granular RBAC privileges on ERP functional domains:
    manufacturing, inventory, accounting, cari.
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
    )  # e.g., 'manufacturing', 'inventory', 'accounting', 'cari'
    can_read: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_write: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    role: Mapped["Role"] = relationship("Role", back_populates="permissions")

    __table_args__ = (
        UniqueConstraint("role_id", "module_name", name="uq_role_module_permission"),
    )
