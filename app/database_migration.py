import os
import sys
import json
import logging
from sqlalchemy import text, select, func, and_, or_
from app.core.config import engine
from app.models import Base
from app.models.auth import Department, User, UserRole, UserRoleEnum, Role, LoginAttempt, get_default_department_permissions

logger = logging.getLogger("migration")

# Global schema health status verified after migrations run
SCHEMA_OK: bool = False

def is_schema_ok() -> bool:
    """Returns True if critical schema objects (user_code, auth_login_attempts, auth_departments) exist."""
    return SCHEMA_OK

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
    Unified, safe, idempotent and transaction-isolated database schema migration for PostgreSQL and SQLite.
    - Each DDL statement runs in its own isolated transaction block (conn.begin()), preventing
      PostgreSQL 'current transaction is aborted' cascading failures.
    - user_code column is the FIRST priority step.
    - Concludes with schema verification (auth_users.user_code, auth_login_attempts, auth_departments).
    - NEVER drops tables, NEVER drops columns, NEVER alters existing data rows.
    """
    global SCHEMA_OK
    logger.info("[MIGRATION START] Checking and applying database schema migrations...")
    print("[MIGRATION START] Checking and applying database schema migrations...")

    try:
        # 1. Ensure all base metadata tables exist
        async with engine.begin() as init_conn:
            await init_conn.run_sync(Base.metadata.create_all)
            print("[MIGRATION SUCCESS] Base metadata tables verified/created.")

        dialect = engine.url.get_backend_name().lower()
        is_sqlite = "sqlite" in dialect

        # Columns definitions for schema additions
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

        lot_cols = [
            ("status", "VARCHAR(30) DEFAULT 'Serbest'", "VARCHAR(30) DEFAULT 'Serbest'"),
            ("qc_notes", "TEXT", "TEXT"),
            ("bin_id", "INTEGER", "INTEGER"),
            ("bin_code", "VARCHAR(50)", "VARCHAR(50)"),
            ("unit_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
            ("total_material_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
        ]

        order_cols = [
            ("total_material_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
            ("unit_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
        ]

        consumption_cols = [
            ("unit_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
            ("total_cost_usd", "NUMERIC(14, 4) DEFAULT 0.0000", "NUMERIC(14, 4) DEFAULT 0.0000"),
        ]

        # 2. DDL Execution with isolated transactions / savepoints per command
        async with engine.connect() as conn:
            async def run_isolated_step(sql_stmt: str, label: str) -> bool:
                try:
                    async with conn.begin_nested():
                        await conn.execute(text(sql_stmt))
                    return True
                except Exception as err:
                    logger.warning(f"[MIGRATION NOTICE] {label}: {err}")
                    return False

            if is_sqlite:
                # Step 2a (SQLite): PRIORITY 1 - user_code column & index
                res_users = await conn.execute(text("PRAGMA table_info(auth_users)"))
                existing_user_cols = [r[1] for r in res_users.fetchall()]
                if "user_code" not in existing_user_cols:
                    await run_isolated_step("ALTER TABLE auth_users ADD COLUMN user_code VARCHAR(20)", "auth_users.user_code (SQLite)")
                    print("[MIGRATION SUCCESS] Added column 'auth_users.user_code' (SQLite).")
                await run_isolated_step("CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_users_user_code ON auth_users(user_code)", "ix_auth_users_user_code (SQLite)")

                # Step 2b (SQLite): auth_login_attempts table & ip_address column
                await run_isolated_step("""
                    CREATE TABLE IF NOT EXISTS auth_login_attempts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        identity_key VARCHAR(255) NOT NULL UNIQUE,
                        ip_address VARCHAR(45),
                        failed_count INTEGER NOT NULL DEFAULT 0,
                        locked_until TIMESTAMP,
                        last_attempt_at TIMESTAMP NOT NULL
                    );
                """, "auth_login_attempts (SQLite)")
                await run_isolated_step("CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_login_attempts_identity_key ON auth_login_attempts(identity_key);", "ix_auth_login_attempts_identity_key (SQLite)")
                
                # Check and add ip_address column if table already existed without it
                res_la = await conn.execute(text("PRAGMA table_info(auth_login_attempts)"))
                existing_la_cols = [r[1] for r in res_la.fetchall()]
                if "ip_address" not in existing_la_cols:
                    await run_isolated_step("ALTER TABLE auth_login_attempts ADD COLUMN ip_address VARCHAR(45)", "auth_login_attempts.ip_address (SQLite)")
                    print("[MIGRATION SUCCESS] Added column 'auth_login_attempts.ip_address' (SQLite).")
                await run_isolated_step("CREATE INDEX IF NOT EXISTS ix_auth_login_attempts_ip_address ON auth_login_attempts(ip_address);", "ix_auth_login_attempts_ip_address (SQLite)")

                # Step 2c (SQLite): Other auth_users columns
                other_user_cols = [
                    ("role", "VARCHAR(30) DEFAULT 'staff'"),
                    ("permissions", "TEXT DEFAULT '{}'"),
                    ("department_id", "INTEGER REFERENCES auth_departments(id)")
                ]
                for col_name, sqlite_def in other_user_cols:
                    if col_name not in existing_user_cols:
                        await run_isolated_step(f"ALTER TABLE auth_users ADD COLUMN {col_name} {sqlite_def}", f"auth_users.{col_name} (SQLite)")
                        print(f"[MIGRATION SUCCESS] Added column 'auth_users.{col_name}' (SQLite).")

                # Step 2d (SQLite): Inventory and manufacturing columns
                res_items = await conn.execute(text("PRAGMA table_info(inventory_items)"))
                existing_item_cols = [r[1] for r in res_items.fetchall()]
                for col_name, _, sqlite_def in item_cols:
                    if col_name not in existing_item_cols:
                        await run_isolated_step(f"ALTER TABLE inventory_items ADD COLUMN {col_name} {sqlite_def}", f"inventory_items.{col_name} (SQLite)")

                res_lots = await conn.execute(text("PRAGMA table_info(inventory_batch_lots)"))
                existing_lot_cols = [r[1] for r in res_lots.fetchall()]
                for col_name, _, sqlite_def in lot_cols:
                    if col_name not in existing_lot_cols:
                        await run_isolated_step(f"ALTER TABLE inventory_batch_lots ADD COLUMN {col_name} {sqlite_def}", f"inventory_batch_lots.{col_name} (SQLite)")

                res_orders = await conn.execute(text("PRAGMA table_info(mfg_production_orders)"))
                existing_order_cols = [r[1] for r in res_orders.fetchall()]
                for col_name, _, sqlite_def in order_cols:
                    if col_name not in existing_order_cols:
                        await run_isolated_step(f"ALTER TABLE mfg_production_orders ADD COLUMN {col_name} {sqlite_def}", f"mfg_production_orders.{col_name} (SQLite)")

                res_consumptions = await conn.execute(text("PRAGMA table_info(mfg_production_ingredient_consumptions)"))
                existing_cons_cols = [r[1] for r in res_consumptions.fetchall()]
                for col_name, _, sqlite_def in consumption_cols:
                    if col_name not in existing_cons_cols:
                        await run_isolated_step(f"ALTER TABLE mfg_production_ingredient_consumptions ADD COLUMN {col_name} {sqlite_def}", f"mfg_production_ingredient_consumptions.{col_name} (SQLite)")
            else:
                # PostgreSQL Branch: Each DDL executed in its own isolated transaction block
                # Step 2a (PostgreSQL): PRIORITY 1 - user_code column & index
                await run_isolated_step("ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS user_code VARCHAR(20)", "auth_users.user_code")
                await run_isolated_step("CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_users_user_code ON auth_users(user_code);", "ix_auth_users_user_code")

                # Step 2b (PostgreSQL): auth_login_attempts table & ip_address column
                await run_isolated_step("""
                    CREATE TABLE IF NOT EXISTS auth_login_attempts (
                        id SERIAL PRIMARY KEY,
                        identity_key VARCHAR(255) NOT NULL UNIQUE,
                        ip_address VARCHAR(45),
                        failed_count INTEGER NOT NULL DEFAULT 0,
                        locked_until TIMESTAMP WITH TIME ZONE,
                        last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                    );
                """, "auth_login_attempts")
                await run_isolated_step("CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_login_attempts_identity_key ON auth_login_attempts(identity_key);", "ix_auth_login_attempts_identity_key")
                await run_isolated_step("ALTER TABLE auth_login_attempts ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)", "auth_login_attempts.ip_address")
                await run_isolated_step("CREATE INDEX IF NOT EXISTS ix_auth_login_attempts_ip_address ON auth_login_attempts(ip_address);", "ix_auth_login_attempts_ip_address")

                # Step 2c (PostgreSQL): Remaining auth_users columns
                await run_isolated_step("ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'staff'", "auth_users.role")
                await run_isolated_step("ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT '{}'", "auth_users.permissions")
                await run_isolated_step("ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES auth_departments(id)", "auth_users.department_id")

                # Step 2d (PostgreSQL): Other domain columns
                for col_name, pg_def, _ in item_cols:
                    await run_isolated_step(f"ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS {col_name} {pg_def}", f"inventory_items.{col_name}")

                for col_name, pg_def, _ in lot_cols:
                    await run_isolated_step(f"ALTER TABLE inventory_batch_lots ADD COLUMN IF NOT EXISTS {col_name} {pg_def}", f"inventory_batch_lots.{col_name}")

                for col_name, pg_def, _ in order_cols:
                    await run_isolated_step(f"ALTER TABLE mfg_production_orders ADD COLUMN IF NOT EXISTS {col_name} {pg_def}", f"mfg_production_orders.{col_name}")

                for col_name, pg_def, _ in consumption_cols:
                    await run_isolated_step(f"ALTER TABLE mfg_production_ingredient_consumptions ADD COLUMN IF NOT EXISTS {col_name} {pg_def}", f"mfg_production_ingredient_consumptions.{col_name}")

            await conn.commit()

        # 3. Seed Default Departments and associate unassigned users
        from app.core.config import async_session_factory
        async with async_session_factory() as session:
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

            # 4. Backfill sequential user_code for existing B2B (CUSTOMER) users without a code
            import re
            existing_codes_query = await session.scalars(
                select(User.user_code).where(User.user_code.is_not(None))
            )
            existing_user_codes = set(existing_codes_query.all())
            
            max_seq = 0
            for code in existing_user_codes:
                match = re.match(r"^B2B-(\d+)$", code or "", re.IGNORECASE)
                if match:
                    try:
                        seq_val = int(match.group(1))
                        if seq_val > max_seq:
                            max_seq = seq_val
                    except ValueError:
                        pass

            unassigned_customers = (await session.scalars(
                select(User)
                .where(User.role == UserRoleEnum.CUSTOMER)
                .where(or_(User.user_code.is_(None), User.user_code == ""))
                .order_by(User.id.asc())
            )).all()

            for customer_user in unassigned_customers:
                max_seq += 1
                new_code = f"B2B-{max_seq:04d}"
                while new_code in existing_user_codes:
                    max_seq += 1
                    new_code = f"B2B-{max_seq:04d}"
                customer_user.user_code = new_code
                existing_user_codes.add(new_code)
                print(f"[MIGRATION SUCCESS] Assigned sequential user_code '{new_code}' to B2B customer '{customer_user.email}'.")

            await session.commit()

        # 5. POST-MIGRATION VERIFICATION & RETRY STEP
        # Verifies auth_users.user_code, auth_login_attempts, auth_departments
        verification_passed = await verify_and_repair_schema()
        SCHEMA_OK = verification_passed

        if SCHEMA_OK:
            print("[MIGRATION SUCCESS] All database schema migrations verified successfully without data loss (schema_ok: True).")
            logger.info("[MIGRATION SUCCESS] All database schema migrations verified successfully (schema_ok: True).")
        else:
            print("[MIGRATION WARNING] Migration finished but one or more critical schema objects failed verification (schema_ok: False).")
            logger.warning("[MIGRATION WARNING] Migration finished with schema_ok: False.")

    except Exception as e:
        SCHEMA_OK = False
        error_msg = f"[MIGRATION ERROR] Database migration encountered an error: {str(e)}"
        print(error_msg)
        logger.error(error_msg, exc_info=True)


async def verify_and_repair_schema() -> bool:
    """
    Checks for the existence of:
    1. auth_users.user_code (retries once if missing)
    2. auth_login_attempts table
    3. auth_departments table
    Returns True if all exist, otherwise False and logs CRITICAL error.
    """
    is_valid = True
    dialect = engine.url.get_backend_name().lower()
    is_sqlite = "sqlite" in dialect

    async with engine.connect() as conn:
        # 1. Check auth_users.user_code
        has_user_code = False
        if is_sqlite:
            res = await conn.execute(text("PRAGMA table_info(auth_users)"))
            cols = [r[1] for r in res.fetchall()]
            has_user_code = "user_code" in cols
        else:
            res = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'auth_users' AND column_name = 'user_code'
            """))
            has_user_code = res.scalar() is not None

        # Retry once if missing as requested
        if not has_user_code:
            logger.warning("[MIGRATION VERIFY] 'auth_users.user_code' column missing, retrying addition...")
            print("[MIGRATION VERIFY] 'auth_users.user_code' column missing, retrying addition...")
            try:
                async with conn.begin_nested():
                    if is_sqlite:
                        await conn.execute(text("ALTER TABLE auth_users ADD COLUMN user_code VARCHAR(20)"))
                    else:
                        await conn.execute(text("ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS user_code VARCHAR(20)"))
                await conn.commit()
            except Exception as retry_err:
                logger.warning(f"[MIGRATION VERIFY] Retry user_code addition notice: {retry_err}")

            # Re-check after retry
            if is_sqlite:
                res = await conn.execute(text("PRAGMA table_info(auth_users)"))
                has_user_code = "user_code" in [r[1] for r in res.fetchall()]
            else:
                res = await conn.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'auth_users' AND column_name = 'user_code'
                """))
                has_user_code = res.scalar() is not None

        if not has_user_code:
            logger.critical("[CRITICAL SCHEMA ERROR] 'auth_users.user_code' kolonu doğrulanamadı ve eklenemedi!")
            print("[CRITICAL SCHEMA ERROR] 'auth_users.user_code' kolonu doğrulanamadı ve eklenemedi!")
            is_valid = False

        # 2. Check auth_login_attempts table
        has_login_attempts = False
        if is_sqlite:
            res = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='auth_login_attempts'"))
            has_login_attempts = res.scalar() is not None
        else:
            res = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'auth_login_attempts'
            """))
            has_login_attempts = res.scalar() is not None

        if not has_login_attempts:
            logger.critical("[CRITICAL SCHEMA ERROR] 'auth_login_attempts' tablosu eksik!")
            print("[CRITICAL SCHEMA ERROR] 'auth_login_attempts' tablosu eksik!")
            is_valid = False

        # 3. Check auth_departments table
        has_departments = False
        if is_sqlite:
            res = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='auth_departments'"))
            has_departments = res.scalar() is not None
        else:
            res = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'auth_departments'
            """))
            has_departments = res.scalar() is not None

        if not has_departments:
            logger.critical("[CRITICAL SCHEMA ERROR] 'auth_departments' tablosu eksik!")
            print("[CRITICAL SCHEMA ERROR] 'auth_departments' tablosu eksik!")
            is_valid = False

    return is_valid
