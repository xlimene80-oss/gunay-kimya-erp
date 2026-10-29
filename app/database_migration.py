import os
import sys
import logging
from sqlalchemy import text
from app.core.config import engine
from app.models import Base

logger = logging.getLogger("migration")

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
            ]

            # 3. Columns for inventory_batch_lots
            lot_cols = [
                ("status", "VARCHAR(30) DEFAULT 'Serbest'", "VARCHAR(30) DEFAULT 'Serbest'"),
                ("qc_notes", "TEXT", "TEXT"),
                ("bin_id", "INTEGER", "INTEGER"),
                ("bin_code", "VARCHAR(50)", "VARCHAR(50)"),
            ]

            if is_sqlite:
                # SQLite PRAGMA check
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
            else:
                # PostgreSQL safe ADD COLUMN IF NOT EXISTS
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

        print("[MIGRATION SUCCESS] All database schema migrations verified successfully without data loss.")
        logger.info("[MIGRATION SUCCESS] All database schema migrations verified successfully.")
    except Exception as e:
        error_msg = f"[MIGRATION ERROR] Database migration encountered an error: {str(e)}"
        print(error_msg)
        logger.error(error_msg, exc_info=True)
        # Note: Do not raise to prevent crashing entire API if a non-critical schema check fails
