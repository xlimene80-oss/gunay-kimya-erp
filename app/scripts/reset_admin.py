#!/usr/bin/env python3
"""
CLI Emergency Admin Recovery Script for Gunay Kimya ERP.
NOT exposed to HTTP endpoints; strictly for command-line administrative execution.

Usage:
    python -m app.scripts.reset_admin --email admin@gunaykimya.com --password "NewSecurePassword123!"
"""
import sys
import argparse
import asyncio
import datetime
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.core.config import async_session_factory
from app.core.security import get_password_hash
from app.models.auth import User, Role, UserRole, UserRoleEnum, Department, LoginAttempt


async def reset_or_create_admin(email: str, password: str) -> None:
    clean_email = email.strip().lower()
    clean_password = password.strip()

    if not clean_email or "@" not in clean_email:
        print(f"[ERROR] Geçersiz e-posta adresi: '{email}'")
        sys.exit(1)

    if len(clean_password) < 6:
        print("[ERROR] Şifre en az 6 karakter uzunluğunda olmalıdır.")
        sys.exit(1)

    hashed_pwd = get_password_hash(clean_password)
    now = datetime.datetime.now(datetime.timezone.utc)

    async with async_session_factory() as session:
        # Check if user exists
        stmt = (
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.department)
            )
            .where(func.lower(User.email) == clean_email)
        )
        user = await session.scalar(stmt)

        if user:
            # Update existing user to active Admin with new password
            user.hashed_password = hashed_pwd
            user.role = UserRoleEnum.ADMIN
            user.is_active = True

            # Clear lockout attempts
            keys = [clean_email]
            if user.user_code:
                keys.append(user.user_code.lower().strip())
            
            attempts = (await session.scalars(
                select(LoginAttempt).where(LoginAttempt.identity_key.in_(keys))
            )).all()
            for att in attempts:
                att.failed_count = 0
                att.locked_until = None
                att.last_attempt_at = now

            # Ensure ADMIN role is mapped
            existing_roles = [ur.role.role_name.upper() for ur in user.user_roles if ur.role]
            if "ADMIN" not in existing_roles:
                admin_role = await session.scalar(select(Role).where(Role.role_name == "ADMIN"))
                if not admin_role:
                    admin_role = Role(role_name="ADMIN", description="System Administrator")
                    session.add(admin_role)
                    await session.flush()
                session.add(UserRole(user_id=user.id, role_id=admin_role.id))

            await session.commit()
            print("=" * 70)
            print("[ADMIN KURTARMA BAŞARILI]")
            print(f"  Kullanıcı ID    : {user.id}")
            print(f"  E-posta         : {user.email}")
            print(f"  Tam Ad          : {user.full_name}")
            print(f"  Rol             : {user.role.value.upper()}")
            print(f"  Aktiflik Durumu : AKTİF ({user.is_active})")
            print(f"  Kilit Durumu    : KİLİT KALDIRILDI (Attempts reset)")
            print("=" * 70)
        else:
            # Find default YONETIM department if available
            dept_id = None
            yonetim_dept = await session.scalar(select(Department).where(Department.code == "YONETIM"))
            if yonetim_dept:
                dept_id = yonetim_dept.id

            new_user = User(
                email=clean_email,
                hashed_password=hashed_pwd,
                full_name="Sistem Yöneticisi",
                role=UserRoleEnum.ADMIN,
                is_active=True,
                department_id=dept_id,
                permissions={}
            )
            session.add(new_user)
            await session.flush()

            admin_role = await session.scalar(select(Role).where(Role.role_name == "ADMIN"))
            if not admin_role:
                admin_role = Role(role_name="ADMIN", description="System Administrator")
                session.add(admin_role)
                await session.flush()

            session.add(UserRole(user_id=new_user.id, role_id=admin_role.id))
            await session.commit()

            print("=" * 70)
            print("[YENİ ADMİN OLUŞTURULDU]")
            print(f"  Kullanıcı ID    : {new_user.id}")
            print(f"  E-posta         : {new_user.email}")
            print(f"  Tam Ad          : {new_user.full_name}")
            print(f"  Rol             : {new_user.role.value.upper()}")
            print(f"  Aktiflik Durumu : AKTİF")
            print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="CLI Emergency Admin Recovery Tool for Gunay Kimya ERP")
    parser.add_argument("--email", type=str, required=True, help="Admin user email address")
    parser.add_argument("--password", type=str, required=True, help="New password for admin account")
    args = parser.parse_args()

    asyncio.run(reset_or_create_admin(args.email, args.password))


if __name__ == "__main__":
    main()
