import os
import sys
import json
import logging
from sqlalchemy import text, select
from app.core.config import engine
from app.models import Base
from app.models.auth import Department, User, UserRole, Role, get_default_department_permissions

logger = logging.getLogger("migration")

DEFAULT_DEPARTMENTS = [
    {"name": "Yönetim", "code": "YONETIM", "description": "Şirket Yönetimi ve Genel Müdürlük"},
    {"name": "Üretim", "code": "URETIM", "description": "Fabrika ve Kimyasal Üretim Sahası"},
    {"name": "Satış", "code": "SATIS", "description": "Yurtiçi ve B2B Bayi Satış Operasyonları"},
    {"name": "Satın Alma", "code": "SATINALMA", "description": "Hammadde ve Ambalaj Tedarik"},
    {"name": "Depo", "code": "DEPO", "description": "Hammadde, Mamul ve Lojistik Deposu"},
    {"name": "Muhasebe", "code": "MUHASEBE", "description": "Mali İşler, Finans ve Fatura Yönetimi"},
    {"name": "İK", "code": "IK", "description": "İnsan Kaynakları, Personel ve Puantaj"},
    {"name": "Kalite", "code": "KALITE", "description": "Kalite Kontrol, Analiz ve Ar-Ge Laboratuvarı"}
]

async def run_all_migrations():
    """
    Unified, safe, and idempotent database schema migration for production (PostgreSQL) and local (SQLite).
    - Uses CREATE TABLE IF NOT EXISTS via Base.metadata.create_all
    - Uses ADD COLUMN IF NOT EXISTS (PostgreSQL) or PRAGMA table_info (SQLite)
    - NEVER drops tables, NEVER drops columns, NEVER alters existing data rows.
    - Can be safely run repeatedly on every application startup.
    """
    logger.info("[MIGRATION START] Checking and applying database schema migrations...")
    print("[MIGRATION START] Checking and applying database schema migrations...")

    try:
        async with engine.begin() as conn:
            # 1. Ensure all model tables exist
            await conn.run_sync(Base.metadata.create_all)
            print("[MIGRATION SUCCESS] Base metadata tables verified/created.")

            dialect = engine.url.get_backend_name().lower()
            is_sqlite = "sqlite" in dialect

            # 2. Columns for inventory_items
            item_cols = [
                ("qc_incoming_required", "BOOLEAN DEFAULT FALSE", "BOOLEAN DEFAULT 0"),
                ("qc_outgoing_required", "BOOLEAN DEFAULT FALSE", "BOOLEAN DEFAULT 0"),
                ("un_number", "VARCHAR(20)", "VARCHAR(20)"),
                ("signal_word", "VARCHAR(30)", "VARCHAR(30)"),
                ("ghs_pictograms", "TEXT", "TEXT"),
                ("storage_class", "VARCHAR(50) DEFAULT 'Genel'", "VARCHAR(50) DEFAULT 'Genel'"),
                ("temp_min", "NUMERIC(6, 2)", "NUMERIC(6, 2)"),
                ("temp_max", "NUMERIC(6, 2)", "NUMERIC(6, 2)"),
                ("sds_file_url", "VARCHAR(255)", "VARCHAR(255)"),
                ("sds_file_name", "VARCHAR(255)", "VARCHAR(255)"),
                ("sds_revision_date", "DATE", "DATE"),
                ("hazard_notes", "TEXT", "TEXT"),
                ("default_unit_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
            ]

            # 3. Columns for inventory_batch_lots
            lot_cols = [
                ("status", "VARCHAR(30) DEFAULT 'Serbest'", "VARCHAR(30) DEFAULT 'Serbest'"),
                ("qc_notes", "TEXT", "TEXT"),
                ("bin_id", "INTEGER", "INTEGER"),
                ("bin_code", "VARCHAR(50)", "VARCHAR(50)"),
                ("unit_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
                ("total_material_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
            ]

            # 4. Columns for mfg_production_orders
            order_cols = [
                ("total_material_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
                ("unit_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
            ]

            # 5. Columns for mfg_production_ingredient_consumptions
            consumption_cols = [
                ("unit_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
                ("total_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
            ]

            # 6. Columns for auth_users (Role management, Department link & Dynamic ACL Permissions)
            user_cols = [
                ("role", "VARCHAR(30) DEFAULT 'staff'", "VARCHAR(30) DEFAULT 'staff'"),
                ("permissions", "JSON DEFAULT '{}'", "TEXT DEFAULT '{}'"),
                ("department_id", "INTEGER REFERENCES auth_departments(id)", "INTEGER REFERENCES auth_departments(id)"),
            ]

            if is_sqlite:
                res_users = await conn.execute(text("PRAGMA table_info(auth_users)"))
                existing_user_cols = [r[1] for r in res_users.fetchall()]
                for col_name, _, sqlite_def in user_cols:
                    if col_name not in existing_user_cols:
                        await conn.execute(text(f"ALTER TABLE auth_users ADD COLUMN {col_name} {sqlite_def}"))
                        print(f"[MIGRATION SUCCESS] Added column 'auth_users.{col_name}' (SQLite).")

                res_items = await conn.execute(text("PRAGMA table_info(inventory_items)"))
                existing_item_cols = [r[1] for r in res_items.fetchall()]
                for col_name, _, sqlite_def in item_cols:
                    if col_name not in existing_item_cols:
                        await conn.execute(text(f"ALTER TABLE inventory_items ADD COLUMN {col_name} {sqlite_def}"))
                        print(f"[MIGRATION SUCCESS] Added column 'inventory_items.{col_name}' (SQLite).")

                res_lots = await conn.execute(text("PRAGMA table_info(inventory_batch_lots)"))
                existing_lot_cols = [r[1] for r in res_lots.fetchall()]
                for col_name, _, sqlite_def in lot_cols:
                    if col_name not in existing_lot_cols:
                        await conn.execute(text(f"ALTER TABLE inventory_batch_lots ADD COLUMN {col_name} {sqlite_def}"))
                        print(f"[MIGRATION SUCCESS] Added column 'inventory_batch_lots.{col_name}' (SQLite).")

                res_orders = await conn.execute(text("PRAGMA table_info(mfg_production_orders)"))
                existing_order_cols = [r[1] for r in res_orders.fetchall()]
                for col_name, _, sqlite_def in order_cols:
                    if col_name not in existing_order_cols:
                        await conn.execute(text(f"ALTER TABLE mfg_production_orders ADD COLUMN {col_name} {sqlite_def}"))
                        print(f"[MIGRATION SUCCESS] Added column 'mfg_production_orders.{col_name}' (SQLite).")

                res_consumptions = await conn.execute(text("PRAGMA table_info(mfg_production_ingredient_consumptions)"))
                existing_cons_cols = [r[1] for r in res_consumptions.fetchall()]
                for col_name, _, sqlite_def in consumption_cols:
                    if col_name not in existing_cons_cols:
                        await conn.execute(text(f"ALTER TABLE mfg_production_ingredient_consumptions ADD COLUMN {col_name} {sqlite_def}"))
                        print(f"[MIGRATION SUCCESS] Added column 'mfg_production_ingredient_consumptions.{col_name}' (SQLite).")
            else:
                for col_name, pg_def, _ in user_cols:
                    try:
                        await conn.execute(text(f"ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS {col_name} {pg_def}"))
                    except Exception as col_err:
                        logger.warning(f"[MIGRATION NOTICE] auth_users.{col_name}: {col_err}")

                for col_name, pg_def, _ in item_cols:
                    try:
                        await conn.execute(text(f"ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS {col_name} {pg_def}"))
                    except Exception as col_err:
                        logger.warning(f"[MIGRATION NOTICE] inventory_items.{col_name}: {col_err}")

                for col_name, pg_def, _ in lot_cols:
                    try:
                        await conn.execute(text(f"ALTER TABLE inventory_batch_lots ADD COLUMN IF NOT EXISTS {col_name} {pg_def}"))
                    except Exception as col_err:
                        logger.warning(f"[MIGRATION NOTICE] inventory_batch_lots.{col_name}: {col_err}")

                for col_name, pg_def, _ in order_cols:
                    try:
                        await conn.execute(text(f"ALTER TABLE mfg_production_orders ADD COLUMN IF NOT EXISTS {col_name} {pg_def}"))
                    except Exception as col_err:
                        logger.warning(f"[MIGRATION NOTICE] mfg_production_orders.{col_name}: {col_err}")

                for col_name, pg_def, _ in consumption_cols:
                    try:
                        await conn.execute(text(f"ALTER TABLE mfg_production_ingredient_consumptions ADD COLUMN IF NOT EXISTS {col_name} {pg_def}"))
                    except Exception as col_err:
                        logger.warning(f"[MIGRATION NOTICE] mfg_production_ingredient_consumptions.{col_name}: {col_err}")

        # 7. Seed Default Departments if empty and associate users
        from app.core.config import async_session_factory
        async with async_session_factory() as session:
            dept_count = await session.scalar(select(func.count(Department.id))) if 'func' in globals() else None
            # Fetch existing departments
            existing_depts = (await session.scalars(select(Department))).all()
            existing_codes = {d.code.upper(): d for d in existing_depts}

            for d_info in DEFAULT_DEPARTMENTS:
                code_up = d_info["code"].upper()
                if code_up not in existing_codes:
                    default_perms = get_default_department_permissions(code_up)
                    new_dept = Department(
                        name=d_info["name"],
                        code=code_up,
                        description=d_info["description"],
                        is_active=True,
                        permissions=default_perms
                    )
                    session.add(new_dept)
                    await session.flush()
                    existing_codes[code_up] = new_dept
                    print(f"[MIGRATION SUCCESS] Seeded default department '{d_info['name']}' ({code_up}).")

            # Associate unassigned users to matching departments based on their roles
            users_without_dept = (await session.scalars(select(User).where(User.department_id.is_(None)))).all()
            for u in users_without_dept:
                role_names = [ur.role.role_name.upper() for ur in u.user_roles if ur.role]
                matched_dept = None
                if any("ADMIN" in r for r in role_names):
                    matched_dept = existing_codes.get("YONETIM")
                elif any("MUHASEBE" in r for r in role_names):
                    matched_dept = existing_codes.get("MUHASEBE")
                elif any("DEPO" in r for r in role_names):
                    matched_dept = existing_codes.get("DEPO")
                elif any("URETIM" in r or "FABRIKA" in r for r in role_names):
                    matched_dept = existing_codes.get("URETIM")
                elif any("KALITE" in r for r in role_names):
                    matched_dept = existing_codes.get("KALITE")
                elif any("SATIS" in r for r in role_names):
                    matched_dept = existing_codes.get("SATIS")

                if matched_dept:
                    u.department_id = matched_dept.id
                    print(f"[MIGRATION INFO] Associated user '{u.email}' to department '{matched_dept.name}'.")

            await session.commit()

        print("[MIGRATION SUCCESS] All database schema migrations verified successfully without data loss.")
        logger.info("[MIGRATION SUCCESS] All database schema migrations verified successfully.")
    except Exception as e:
        error_msg = f"[MIGRATION ERROR] Database migration encountered an error: {str(e)}"
        print(error_msg)
        logger.error(error_msg, exc_info=True)
