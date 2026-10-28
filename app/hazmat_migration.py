import os
import sys
import datetime
from decimal import Decimal
import json

# Ensure parent directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text, select
from app.core.config import engine, async_session_factory
from app.models.hazmat import (
    WarehouseZone, WarehouseBin, StorageIncompatibilityRule,
    WarehousePlacementAudit, SystemConfig
)
from app.models.inventory import Item, BatchLot

async def run_hazmat_migration():
    """
    Automatic DDL migration and seed data initialization for:
    1. Product hazard columns (UN no, signal word, GHS pictograms, storage class, SDS PDF metadata)
    2. Batch lot shelf/bin tracking
    3. Warehouse zones & bins
    4. Incompatibility matrix rules
    5. Audit trail & system configs
    """
    print("[HAZMAT MIGRATION] Starting Hazmat & Warehouse Zones migration...")

    # 1. DDL Schema Updates & Table Creation
    async with engine.begin() as conn:
        from app.models import Base
        await conn.run_sync(Base.metadata.create_all)

        dialect = engine.url.get_backend_name()

        # Check & add columns to inventory_items
        item_columns = [
            ("un_number", "VARCHAR(20)"),
            ("signal_word", "VARCHAR(30)"),
            ("ghs_pictograms", "TEXT"),
            ("storage_class", "VARCHAR(50) DEFAULT 'Genel'"),
            ("temp_min", "NUMERIC(6, 2)"),
            ("temp_max", "NUMERIC(6, 2)"),
            ("sds_file_url", "VARCHAR(255)"),
            ("sds_file_name", "VARCHAR(255)"),
            ("sds_revision_date", "DATE"),
            ("hazard_notes", "TEXT"),
        ]

        for col_name, col_type in item_columns:
            try:
                if dialect == "sqlite":
                    check_query = text(f"PRAGMA table_info(inventory_items)")
                    res = await conn.execute(check_query)
                    existing_cols = [row[1] for row in res.fetchall()]
                    if col_name not in existing_cols:
                        await conn.execute(text(f"ALTER TABLE inventory_items ADD COLUMN {col_name} {col_type}"))
                        print(f"[HAZMAT MIGRATION] Added column '{col_name}' to 'inventory_items'.")
                else:
                    check_query = text("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'inventory_items' AND column_name = :col
                    """)
                    res = await conn.execute(check_query, {"col": col_name})
                    if not res.scalar_one_or_none():
                        await conn.execute(text(f"ALTER TABLE inventory_items ADD COLUMN {col_name} {col_type}"))
                        print(f"[HAZMAT MIGRATION] Added column '{col_name}' to 'inventory_items' (Postgres).")
            except Exception as e:
                print(f"[HAZMAT MIGRATION WARN] Column '{col_name}' check error: {e}")

        # Check & add columns to inventory_batch_lots
        lot_columns = [
            ("bin_id", "INTEGER"),
            ("bin_code", "VARCHAR(50)"),
        ]
        for col_name, col_type in lot_columns:
            try:
                if dialect == "sqlite":
                    check_query = text(f"PRAGMA table_info(inventory_batch_lots)")
                    res = await conn.execute(check_query)
                    existing_cols = [row[1] for row in res.fetchall()]
                    if col_name not in existing_cols:
                        await conn.execute(text(f"ALTER TABLE inventory_batch_lots ADD COLUMN {col_name} {col_type}"))
                        print(f"[HAZMAT MIGRATION] Added column '{col_name}' to 'inventory_batch_lots'.")
                else:
                    check_query = text("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'inventory_batch_lots' AND column_name = :col
                    """)
                    res = await conn.execute(check_query, {"col": col_name})
                    if not res.scalar_one_or_none():
                        await conn.execute(text(f"ALTER TABLE inventory_batch_lots ADD COLUMN {col_name} {col_type}"))
                        print(f"[HAZMAT MIGRATION] Added column '{col_name}' to 'inventory_batch_lots' (Postgres).")
            except Exception as e:
                print(f"[HAZMAT MIGRATION WARN] Column '{col_name}' check error: {e}")

    # Ensure uploads directory exists for SDS files
    uploads_sds_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "sds"))
    os.makedirs(uploads_sds_dir, exist_ok=True)

    # Create dummy sample SDS files so "GBF'yi Görüntüle" button can open a valid PDF in browser
    sample_files = ["LABSA_Guvenlik_Bilgi_Formu.pdf", "Kostik_Soda_Guvenlik_Bilgi_Formu.pdf", "Gliserin_GBF_2025.pdf", "SLES_70_GBF.pdf"]
    for sample_fn in sample_files:
        sample_path = os.path.join(uploads_sds_dir, sample_fn)
        if not os.path.exists(sample_path):
            with open(sample_path, "wb") as f:
                # Minimal valid PDF binary header
                f.write(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF\n")

    # 2. Master Data Seed
    async with async_session_factory() as session:
        # A. System Configs
        configs_to_seed = [
            ("sds_validity_months", "36", "GBF / SDS geçerlilik süresi (ay). Bu süreden eski revizyonlarda uyarı gösterilir."),
            ("label_disclaimer", "Etiket tehlike bilgisi taslaktır, yasal etiket yerine geçmez.", "Paketleme etiketi ve sistem genelinde yasal uyum uyarısı."),
        ]
        for key, val, desc in configs_to_seed:
            cfg_stmt = select(SystemConfig).where(SystemConfig.config_key == key)
            cfg_res = await session.execute(cfg_stmt)
            if not cfg_res.scalar_one_or_none():
                session.add(SystemConfig(config_key=key, config_value=val, description=desc))
        await session.commit()

        # B. Incompatibility Rules
        incompat_rules = [
            ("Aşındırıcı-Asit", "Aşındırıcı-Baz", "Şiddetli ekzotermik nötralizasyon, kaynama, sıçrama ve aşırı ısı açığa çıkışı riski."),
            ("Yükseltgen", "Yanıcı", "Oksitleyici madde varlığında yanıcı maddelerin kendiliğinden tutuşması veya yangının şiddetlenmesi riski."),
        ]
        for ca, cb, reason in incompat_rules:
            rule_stmt = select(StorageIncompatibilityRule).where(
                StorageIncompatibilityRule.class_a == ca,
                StorageIncompatibilityRule.class_b == cb
            )
            rule_res = await session.execute(rule_stmt)
            if not rule_res.scalar_one_or_none():
                session.add(StorageIncompatibilityRule(class_a=ca, class_b=cb, reason=reason, is_active=True))
        await session.commit()

        # C. Warehouse Zones and Bins
        zones_data = [
            {
                "name": "Genel Depo",
                "code": "ZONE-GENEL",
                "storage_class": "Genel",
                "description": "Genel kimyasallar, inert hammaddeler ve nötr mamul ürünler.",
                "bins": ["A-01", "A-02", "A-03", "A-04"]
            },
            {
                "name": "Asit Bölgesi",
                "code": "ZONE-ASIT",
                "storage_class": "Aşındırıcı-Asit",
                "description": "Asit havuzlu zemin, havalandırmalı aşındırıcı inorganik ve organik asitler.",
                "bins": ["B-01", "B-02"]
            },
            {
                "name": "Baz Bölgesi",
                "code": "ZONE-BAZ",
                "storage_class": "Aşındırıcı-Baz",
                "description": "Alkali dayanımlı zemin, kostik soda ve bazik hammadde alanı.",
                "bins": ["C-01", "C-02"]
            },
            {
                "name": "Yanıcı Bölgesi",
                "code": "ZONE-YANICI",
                "storage_class": "Yanıcı",
                "description": "Ex-proof aydınlatma, topraklama barası ve yangın damperli solvent/esans deposu.",
                "bins": ["D-01"]
            },
            {
                "name": "Soğuk Oda",
                "code": "ZONE-SOGUK",
                "storage_class": "Soğuk (2-8 °C)",
                "description": "Isıya duyarlı aktif maddeler için sıcaklık kontrollü depo (2-8 °C).",
                "bins": ["E-01"]
            },
            {
                "name": "Karantina Bölgesi",
                "code": "ZONE-KARANTINA",
                "storage_class": "Karantina",
                "description": "Kalite kontrol onayı bekleyen, şüpheli veya blokeli parti/lot karantina alanı.",
                "bins": ["Q-01", "Q-02"]
            },
        ]

        bin_map = {}
        for z_data in zones_data:
            z_stmt = select(WarehouseZone).where(WarehouseZone.code == z_data["code"])
            z_res = await session.execute(z_stmt)
            zone = z_res.scalar_one_or_none()
            if not zone:
                zone = WarehouseZone(
                    name=z_data["name"],
                    code=z_data["code"],
                    storage_class=z_data["storage_class"],
                    description=z_data["description"],
                    is_active=True
                )
                session.add(zone)
                await session.flush()
                print(f"[HAZMAT MIGRATION] Created Zone: {zone.name} ({zone.code})")

            # Create bins for zone
            for b_code in z_data["bins"]:
                b_stmt = select(WarehouseBin).where(WarehouseBin.zone_id == zone.id, WarehouseBin.code == b_code)
                b_res = await session.execute(b_stmt)
                bin_obj = b_res.scalar_one_or_none()
                if not bin_obj:
                    bin_obj = WarehouseBin(
                        zone_id=zone.id,
                        code=b_code,
                        capacity_kg=Decimal("10000.000"),
                        capacity_pallet=8 if "A-" in b_code else 4,
                        is_active=True,
                        description=f"{zone.name} - Raf {b_code}"
                    )
                    session.add(bin_obj)
                    await session.flush()
                bin_map[b_code] = bin_obj

        await session.commit()

        # D. Update Existing Items with Realistic Chemical Hazmat Data
        hazmat_items_payload = [
            {
                "match_sku_or_name": "LABSA",
                "cas_number": "27176-87-0",
                "un_number": "2586",
                "hazard_class": "Sınıf 8 (Aşındırıcı Sıvı)",
                "signal_word": "Tehlike",
                "ghs_pictograms": ["CORROSIVE", "EXCLAMATION"],
                "storage_class": "Aşındırıcı-Asit",
                "temp_min": Decimal("10.00"),
                "temp_max": Decimal("35.00"),
                "sds_file_name": "LABSA_Guvenlik_Bilgi_Formu.pdf",
                "sds_file_url": "/api/v1/hazmat/sds-files/LABSA_Guvenlik_Bilgi_Formu.pdf",
                "sds_revision_date": datetime.date(2025, 6, 15), # Güncel
                "hazard_notes": "Örnek veri, bilgilendirme amaçlıdır. Ciddi cilt yanıklarına ve göz hasarına yol açar.",
                "default_bin": "B-01"
            },
            {
                "match_sku_or_name": "Kostik",
                "cas_number": "1310-73-2",
                "un_number": "1824",
                "hazard_class": "Sınıf 8 (Aşındırıcı Sıvı)",
                "signal_word": "Tehlike",
                "ghs_pictograms": ["CORROSIVE"],
                "storage_class": "Aşındırıcı-Baz",
                "temp_min": Decimal("15.00"),
                "temp_max": Decimal("40.00"),
                "sds_file_name": "Kostik_Soda_Guvenlik_Bilgi_Formu.pdf",
                "sds_file_url": "/api/v1/hazmat/sds-files/Kostik_Soda_Guvenlik_Bilgi_Formu.pdf",
                "sds_revision_date": datetime.date(2021, 2, 10), # Eski (>36 ay, uyarı tetikler)
                "hazard_notes": "Örnek veri, bilgilendirme amaçlıdır. Metalleri aşındırabilir, kuvvetli alkali.",
                "default_bin": "C-01"
            },
            {
                "match_sku_or_name": "Esans",
                "cas_number": "8002-09-3",
                "un_number": "1272",
                "hazard_class": "Sınıf 3 (Yanıcı Sıvı)",
                "signal_word": "Tehlike",
                "ghs_pictograms": ["FLAME", "ENVIRONMENT", "EXCLAMATION"],
                "storage_class": "Yanıcı",
                "temp_min": Decimal("5.00"),
                "temp_max": Decimal("25.00"),
                "sds_file_name": None,
                "sds_file_url": None,
                "sds_revision_date": None, # Eksik (Uyarı tetikler)
                "hazard_notes": "Örnek veri, bilgilendirme amaçlıdır. Alevlenir sıvı ve buhar. Sucul ortamda uzun süre kalıcı toksik etki.",
                "default_bin": "D-01"
            },
            {
                "match_sku_or_name": "Gliserin",
                "cas_number": "56-81-5",
                "un_number": None,
                "hazard_class": "Genel Kimyasal",
                "signal_word": "Yok",
                "ghs_pictograms": [],
                "storage_class": "Genel",
                "temp_min": Decimal("15.00"),
                "temp_max": Decimal("30.00"),
                "sds_file_name": "Gliserin_GBF_2025.pdf",
                "sds_file_url": "/api/v1/hazmat/sds-files/Gliserin_GBF_2025.pdf",
                "sds_revision_date": datetime.date(2025, 1, 20), # Güncel
                "hazard_notes": "Örnek veri, bilgilendirme amaçlıdır. Tehlikeli madde kapsamında değildir.",
                "default_bin": "A-02"
            },
            {
                "match_sku_or_name": "SLES",
                "cas_number": "68891-38-3",
                "un_number": None,
                "hazard_class": "Sürfaktan / Tahriş Edici",
                "signal_word": "Dikkat",
                "ghs_pictograms": ["EXCLAMATION"],
                "storage_class": "Genel",
                "temp_min": Decimal("15.00"),
                "temp_max": Decimal("35.00"),
                "sds_file_name": "SLES_70_GBF.pdf",
                "sds_file_url": "/api/v1/hazmat/sds-files/SLES_70_GBF.pdf",
                "sds_revision_date": datetime.date(2024, 11, 1), # Güncel
                "hazard_notes": "Örnek veri, bilgilendirme amaçlıdır. Cilt ve göz tahrişine yol açar.",
                "default_bin": "A-01"
            },
            {
                "match_sku_or_name": "Sabun",
                "cas_number": None,
                "un_number": None,
                "hazard_class": "Kozmetik / Temizlik Mamulü",
                "signal_word": "Yok",
                "ghs_pictograms": [],
                "storage_class": "Genel",
                "temp_min": Decimal("5.00"),
                "temp_max": Decimal("30.00"),
                "sds_file_name": None,
                "sds_file_url": None,
                "sds_revision_date": None,
                "hazard_notes": "Örnek veri, bilgilendirme amaçlıdır. Tüketici mamulü.",
                "default_bin": "A-03"
            }
        ]

        items_res = await session.execute(select(Item))
        all_items = items_res.scalars().all()

        for item in all_items:
            # find match
            matched = None
            for p in hazmat_items_payload:
                key = p["match_sku_or_name"].lower()
                if key in item.name.lower() or key in item.sku.lower():
                    matched = p
                    break

            if matched:
                item.cas_number = matched["cas_number"]
                item.un_number = matched["un_number"]
                item.hazard_class = matched["hazard_class"]
                item.signal_word = matched["signal_word"]
                item.ghs_pictograms = json.dumps(matched["ghs_pictograms"])
                item.storage_class = matched["storage_class"]
                item.temp_min = matched["temp_min"]
                item.temp_max = matched["temp_max"]
                item.sds_file_name = matched["sds_file_name"]
                item.sds_file_url = matched["sds_file_url"]
                item.sds_revision_date = matched["sds_revision_date"]
                item.hazard_notes = matched["hazard_notes"]

        await session.commit()

        # E. Assign Bins to Existing Batch Lots
        lots_res = await session.execute(select(BatchLot))
        all_lots = lots_res.scalars().all()

        for lot in all_lots:
            # If lot is in Karantina, assign to Q-01 or Q-02
            if lot.status == "Karantina":
                q_bin = bin_map.get("Q-01")
                if q_bin:
                    lot.bin_id = q_bin.id
                    lot.bin_code = q_bin.code
            elif lot.status in ("Bloke", "Reddedildi"):
                q_bin = bin_map.get("Q-02")
                if q_bin:
                    lot.bin_id = q_bin.id
                    lot.bin_code = q_bin.code
            else:
                # Assign based on product match
                lot_item = lot.item
                if lot_item:
                    st_class = lot_item.storage_class
                    if st_class == "Aşındırıcı-Asit":
                        b = bin_map.get("B-01")
                    elif st_class == "Aşındırıcı-Baz":
                        b = bin_map.get("C-01")
                    elif st_class == "Yanıcı":
                        b = bin_map.get("D-01")
                    elif st_class == "Soğuk (2-8 °C)":
                        b = bin_map.get("E-01")
                    else:
                        b = bin_map.get("A-01") or bin_map.get("A-02")

                    if b:
                        lot.bin_id = b.id
                        lot.bin_code = b.code

        await session.commit()
        print("[HAZMAT MIGRATION SUCCESS] Hazmat & Warehouse Zones migrated and demo data seeded successfully.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_hazmat_migration())
