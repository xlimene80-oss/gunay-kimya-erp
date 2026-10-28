import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import datetime
from decimal import Decimal
from sqlalchemy import text, select
from app.core.config import engine, async_session_factory
from app.models import Base
from app.models.auth import Role, User, UserRole, ModulePermission
from app.models.inventory import Item, BatchLot, ItemCategory
from app.models.quality import (
    LotStatus, InspectionDecision,
    QualityTestTemplate, QualityTestItem,
    QualityInspection, QualityInspectionResult,
    QualityCertificateOfAnalysis
)

async def run_quality_migration():
    """
    Ensures columns and tables for Quality Management are created,
    and seeds default test templates, demo lots and CoA.
    Works for both SQLite and PostgreSQL.
    """
    print("[QUALITY MIGRATION] Starting quality module migration...")

    # 1. Ensure all tables are created
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Check and add columns on inventory_items
        is_sqlite = "sqlite" in engine.url.drivername.lower()
        if is_sqlite:
            # SQLite PRAGMA check
            res = await conn.execute(text("PRAGMA table_info(inventory_items)"))
            cols = [r[1] for r in res.fetchall()]
            if "qc_incoming_required" not in cols:
                await conn.execute(text("ALTER TABLE inventory_items ADD COLUMN qc_incoming_required BOOLEAN DEFAULT 0"))
            if "qc_outgoing_required" not in cols:
                await conn.execute(text("ALTER TABLE inventory_items ADD COLUMN qc_outgoing_required BOOLEAN DEFAULT 0"))

            res_lots = await conn.execute(text("PRAGMA table_info(inventory_batch_lots)"))
            lot_cols = [r[1] for r in res_lots.fetchall()]
            if "status" not in lot_cols:
                await conn.execute(text("ALTER TABLE inventory_batch_lots ADD COLUMN status VARCHAR(30) DEFAULT 'Serbest'"))
            if "qc_notes" not in lot_cols:
                await conn.execute(text("ALTER TABLE inventory_batch_lots ADD COLUMN qc_notes TEXT"))
        else:
            # PostgreSQL
            await conn.execute(text("""
                ALTER TABLE inventory_items 
                ADD COLUMN IF NOT EXISTS qc_incoming_required BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS qc_outgoing_required BOOLEAN DEFAULT FALSE;
            """))
            await conn.execute(text("""
                ALTER TABLE inventory_batch_lots 
                ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Serbest',
                ADD COLUMN IF NOT EXISTS qc_notes TEXT;
            """))

    # 2. Seed Quality Role, Permissions, Demo Templates, Lots and CoA
    async with async_session_factory() as session:
        # A. Ensure KALITE role exists
        role_stmt = select(Role).where(Role.role_name.in_(["KALITE", "Kalite"]))
        res = await session.execute(role_stmt)
        kalite_role = res.scalar_one_or_none()
        if not kalite_role:
            kalite_role = Role(role_name="KALITE", description="Kalite Kontrol ve Laboratuvar Sorumlusu")
            session.add(kalite_role)
            await session.flush()

            # Add permissions
            for mod in ["quality", "inventory", "manufacturing"]:
                perm = ModulePermission(
                    role_id=kalite_role.id,
                    module_name=mod,
                    can_read=True,
                    can_write=True,
                    can_delete=False
                )
                session.add(perm)

        # Grant admin quality permission as well
        admin_stmt = select(Role).where(Role.role_name == "ADMIN")
        admin_res = await session.execute(admin_stmt)
        admin_role = admin_res.scalar_one_or_none()
        if admin_role:
            perm_check = select(ModulePermission).where(
                ModulePermission.role_id == admin_role.id,
                ModulePermission.module_name == "quality"
            )
            if not (await session.execute(perm_check)).scalar_one_or_none():
                session.add(ModulePermission(
                    role_id=admin_role.id,
                    module_name="quality",
                    can_read=True,
                    can_write=True,
                    can_delete=True
                ))

        # Ensure a Quality Specialist user exists (e.g. kalite@gunaykimya.com)
        user_stmt = select(User).where(User.email.in_(["kalite@gunaykimya.com", "kalite@gunaykimya.net"]))
        q_user = (await session.execute(user_stmt)).scalar_one_or_none()
        if not q_user:
            from app.core.security import get_password_hash
            q_user = User(
                email="kalite@gunaykimya.com",
                full_name="Dr. Zeynep Kaya (Kalite Yöneticisi)",
                hashed_password=get_password_hash("Kalite123!"),
                is_active=True
            )
            session.add(q_user)
            await session.flush()
            session.add(UserRole(user_id=q_user.id, role_id=kalite_role.id))

        # B. Find or create master Items for Liquid Soap, SLES, NaOH
        items_stmt = select(Item)
        all_items = (await session.execute(items_stmt)).scalars().all()

        soap_item = next((i for i in all_items if "sabun" in i.name.lower()), None)
        sles_item = next((i for i in all_items if "sles" in i.name.lower() or "sles" in i.sku.lower()), None)
        naoh_item = next((i for i in all_items if "naoh" in i.name.lower() or "kostik" in i.name.lower()), None)

        if not soap_item:
            soap_item = Item(
                sku="MML-SBN-01",
                name="Sıvı El Sabunu 5L (Gliserinli)",
                unit="L",
                category=ItemCategory.FINISHED_GOOD,
                density=Decimal("1.025"),
                qc_outgoing_required=True,
                qc_incoming_required=False,
                is_active=True
            )
            session.add(soap_item)
            await session.flush()
        else:
            soap_item.qc_outgoing_required = True

        if not sles_item:
            sles_item = Item(
                sku="HM-SLES-70",
                name="Sodyum Lauril Eter Sülfat (SLES %70)",
                unit="kg",
                category=ItemCategory.RAW_MATERIAL,
                qc_incoming_required=True,
                qc_outgoing_required=False,
                is_active=True
            )
            session.add(sles_item)
            await session.flush()
        else:
            sles_item.qc_incoming_required = True

        if not naoh_item:
            naoh_item = Item(
                sku="HM-NAOH-48",
                name="Sıvı Kostik (NaOH %48)",
                unit="kg",
                category=ItemCategory.RAW_MATERIAL,
                qc_incoming_required=True,
                qc_outgoing_required=False,
                is_active=True
            )
            session.add(naoh_item)
            await session.flush()
        else:
            naoh_item.qc_incoming_required = True

        # C. Test Templates
        # Check if templates already exist
        tpl_stmt = select(QualityTestTemplate).limit(1)
        existing_tpl = (await session.execute(tpl_stmt)).scalar_one_or_none()
        if not existing_tpl:
            print("[QUALITY MIGRATION] Seeding standard test templates...")
            # 1. Sıvı Sabun Şablonu
            soap_tpl = QualityTestTemplate(
                item_id=soap_item.id,
                name="Sıvı Sabun Kalite Kontrol Şablonu",
                description="Mamul sıvı sabun için pH, yoğunluk, viskozite ve organoleptik testler",
                is_active=True
            )
            session.add(soap_tpl)
            await session.flush()

            soap_tests = [
                QualityTestItem(
                    template_id=soap_tpl.id,
                    test_name="pH (20°C)",
                    unit="pH",
                    min_value=Decimal("5.50"),
                    max_value=Decimal("7.50"),
                    method="TS 518 / Dijital pH Metre",
                    order_index=1
                ),
                QualityTestItem(
                    template_id=soap_tpl.id,
                    test_name="Yoğunluk (20°C)",
                    unit="g/cm³",
                    min_value=Decimal("1.0100"),
                    max_value=Decimal("1.0400"),
                    method="Piknometre (TS EN ISO 2811-1)",
                    order_index=2
                ),
                QualityTestItem(
                    template_id=soap_tpl.id,
                    test_name="Viskozite (20°C)",
                    unit="cP",
                    min_value=Decimal("2500.00"),
                    max_value=Decimal("4500.00"),
                    method="Brookfield Spindle 4 / 20 RPM",
                    order_index=3
                ),
                QualityTestItem(
                    template_id=soap_tpl.id,
                    test_name="Görünüm & Koku",
                    unit="Duyusal",
                    min_value=None,
                    max_value=None,
                    expected_text="Uygun",
                    method="Organoleptik Görsel Muayene",
                    order_index=4
                ),
            ]
            session.add_all(soap_tests)

            # 2. SLES Şablonu
            sles_tpl = QualityTestTemplate(
                item_id=sles_item.id,
                name="SLES %70 Giriş Kalite Şablonu",
                description="Hammadde mal kabul aktif madde ve safiyet kontrolü",
                is_active=True
            )
            session.add(sles_tpl)
            await session.flush()

            sles_tests = [
                QualityTestItem(
                    template_id=sles_tpl.id,
                    test_name="Aktif Madde",
                    unit="%",
                    min_value=Decimal("68.00"),
                    max_value=Decimal("72.00"),
                    method="İki Fazlı Titrasyon (TS 5606)",
                    order_index=1
                ),
                QualityTestItem(
                    template_id=sles_tpl.id,
                    test_name="pH (%10 Çözelti)",
                    unit="pH",
                    min_value=Decimal("6.50"),
                    max_value=Decimal("8.50"),
                    method="Elektrometrik pH Metre",
                    order_index=2
                ),
                QualityTestItem(
                    template_id=sles_tpl.id,
                    test_name="Görünüm",
                    unit="Duyusal",
                    min_value=None,
                    max_value=None,
                    expected_text="Uygun",
                    method="Şeffaf Sarımsı Macun Görünümü",
                    order_index=3
                ),
            ]
            session.add_all(sles_tests)

            # 3. NaOH Şablonu
            naoh_tpl = QualityTestTemplate(
                item_id=naoh_item.id,
                name="Sıvı Kostik (NaOH) Giriş Kontrol Şablonu",
                description="Asit-baz titrasyonu ile derişim ve safiyet kontrolü",
                is_active=True
            )
            session.add(naoh_tpl)
            await session.flush()

            naoh_tests = [
                QualityTestItem(
                    template_id=naoh_tpl.id,
                    test_name="Konsantrasyon (NaOH)",
                    unit="%",
                    min_value=Decimal("48.00"),
                    max_value=Decimal("51.00"),
                    method="Asit-Baz Nötralizasyon Titrasyonu",
                    order_index=1
                ),
                QualityTestItem(
                    template_id=naoh_tpl.id,
                    test_name="Yoğunluk (20°C)",
                    unit="g/cm³",
                    min_value=Decimal("1.5000"),
                    max_value=Decimal("1.5400"),
                    method="Hidrometre / Areometre",
                    order_index=2
                ),
            ]
            session.add_all(naoh_tests)

        # D. Seed 3 Specific Demo Lots required by Spec:
        # 1 hammadde lotu karantinada (bekleyen)
        # 1 lot FAIL sonucuyla bloke
        # 1 mamul lot serbest ve CoA'sı hazır
        now = datetime.datetime.now(datetime.timezone.utc)
        today = now.date()

        # 1. Karantinadaki hammadde lotu
        q_lot_stmt = select(BatchLot).where(BatchLot.batch_number == "LOT-2026-SLES-QC")
        q_lot = (await session.execute(q_lot_stmt)).scalar_one_or_none()
        if not q_lot:
            q_lot = BatchLot(
                batch_number="LOT-2026-SLES-QC",
                item_id=sles_item.id,
                warehouse="Hammadde Deposu",
                quantity=Decimal("4500.000"),
                expiration_date=today + datetime.timedelta(days=720),
                status="Karantina",
                qc_notes="Mal kabulden yeni giriş yapıldı. Laboratuvar numune analizi bekleniyor."
            )
            session.add(q_lot)

        # 2. Bloke lot (FAIL sonucuyla)
        b_lot_stmt = select(BatchLot).where(BatchLot.batch_number == "LOT-2026-NAOH-BLOKE")
        b_lot = (await session.execute(b_lot_stmt)).scalar_one_or_none()
        if not b_lot:
            b_lot = BatchLot(
                batch_number="LOT-2026-NAOH-BLOKE",
                item_id=naoh_item.id,
                warehouse="Hammadde Deposu",
                quantity=Decimal("3000.000"),
                expiration_date=today + datetime.timedelta(days=365),
                status="Bloke",
                qc_notes="Konsantrasyon alt limitin altında (%44.20 < %48.00). Tedarikçi iadesi için bekletiliyor."
            )
            session.add(b_lot)
            await session.flush()

            # Record the failed inspection audit log
            failed_insp = QualityInspection(
                inspection_number="QC-2026-0001",
                batch_lot_id=b_lot.id,
                source_type="MAL_KABUL",
                decision="Bloke Edildi",
                decision_reason="Konsantrasyon şartname alt limitinin altında (%44.20). Tolerans dışı kabul edilemez.",
                inspector_id=q_user.id if q_user else None,
                inspector_name=q_user.full_name if q_user else "Dr. Zeynep Kaya",
                notes="Tedarikçi BASF Kimya ile görüşülerek iade irsaliyesi düzenlenecektir."
            )
            session.add(failed_insp)
            await session.flush()

            insp_res1 = QualityInspectionResult(
                inspection_id=failed_insp.id,
                test_name="Konsantrasyon (NaOH)",
                unit="%",
                min_value=Decimal("48.00"),
                max_value=Decimal("51.00"),
                method="Asit-Baz Nötralizasyon Titrasyonu",
                measured_value=Decimal("44.20"),
                is_passed=False
            )
            insp_res2 = QualityInspectionResult(
                inspection_id=failed_insp.id,
                test_name="Yoğunluk (20°C)",
                unit="g/cm³",
                min_value=Decimal("1.5000"),
                max_value=Decimal("1.5400"),
                method="Hidrometre / Areometre",
                measured_value=Decimal("1.5120"),
                is_passed=True
            )
            session.add_all([insp_res1, insp_res2])

        # 3. Serbest mamul lot ve CoA hazır
        s_lot_stmt = select(BatchLot).where(BatchLot.batch_number == "LOT-2026-SBN-088")
        s_lot = (await session.execute(s_lot_stmt)).scalar_one_or_none()
        if not s_lot:
            s_lot = BatchLot(
                batch_number="LOT-2026-SBN-088",
                item_id=soap_item.id,
                warehouse="Mamul Ürün Deposu",
                quantity=Decimal("2400.000"),
                expiration_date=today + datetime.timedelta(days=730),
                status="Serbest",
                qc_notes="Tüm mikrobiyolojik ve fizikokimyasal testler onaylandı. Satış ve sevkiyata uygundur."
            )
            session.add(s_lot)
            await session.flush()

            # Record passed inspection and CoA
            pass_insp = QualityInspection(
                inspection_number="QC-2026-0002",
                batch_lot_id=s_lot.id,
                source_type="URETIM",
                decision="Serbest Bırakıldı",
                decision_reason="Tüm parametreler TS ve firma şartnamelerine tam uygundur.",
                inspector_id=q_user.id if q_user else None,
                inspector_name=q_user.full_name if q_user else "Dr. Zeynep Kaya",
                notes="Reaktör-01 dolum hattı son numunesi. Stabilite ve viskozite mükemmel."
            )
            session.add(pass_insp)
            await session.flush()

            soap_res1 = QualityInspectionResult(
                inspection_id=pass_insp.id,
                test_name="pH (20°C)",
                unit="pH",
                min_value=Decimal("5.50"),
                max_value=Decimal("7.50"),
                method="TS 518 / Dijital pH Metre",
                measured_value=Decimal("6.42"),
                is_passed=True
            )
            soap_res2 = QualityInspectionResult(
                inspection_id=pass_insp.id,
                test_name="Yoğunluk (20°C)",
                unit="g/cm³",
                min_value=Decimal("1.0100"),
                max_value=Decimal("1.0400"),
                method="Piknometre (TS EN ISO 2811-1)",
                measured_value=Decimal("1.0260"),
                is_passed=True
            )
            soap_res3 = QualityInspectionResult(
                inspection_id=pass_insp.id,
                test_name="Viskozite (20°C)",
                unit="cP",
                min_value=Decimal("2500.00"),
                max_value=Decimal("4500.00"),
                method="Brookfield Spindle 4 / 20 RPM",
                measured_value=Decimal("3450.00"),
                is_passed=True
            )
            soap_res4 = QualityInspectionResult(
                inspection_id=pass_insp.id,
                test_name="Görünüm & Koku",
                unit="Duyusal",
                min_value=None,
                max_value=None,
                method="Organoleptik Görsel Muayene",
                measured_text="Uygun (Berrak Mavi, Homojen)",
                is_passed=True
            )
            session.add_all([soap_res1, soap_res2, soap_res3, soap_res4])

            # CoA
            coa = QualityCertificateOfAnalysis(
                certificate_number="COA-2026-0001",
                inspection_id=pass_insp.id,
                batch_lot_id=s_lot.id,
                product_name=soap_item.name,
                product_sku=soap_item.sku,
                lot_number=s_lot.batch_number,
                production_date=today - datetime.timedelta(days=2),
                expiration_date=s_lot.expiration_date,
                approved_by=q_user.full_name if q_user else "Dr. Zeynep Kaya",
                approval_date=now,
                notes="Ürün, Türk Standartları Enstitüsü kozmetik deterjan direktiflerine ve Günay Kimya kalite standartlarına tam uygundur."
            )
            session.add(coa)

        await session.commit()
        print("[QUALITY MIGRATION] Quality module tables, templates and demo records initialized successfully!")

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_quality_migration())
