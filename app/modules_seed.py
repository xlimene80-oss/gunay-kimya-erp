import os
import sys
import datetime
from decimal import Decimal
import logging
from sqlalchemy import select, text
from app.core.config import async_session_factory
from app.models.auth import Role, ModulePermission, User
from app.models.inventory import Item, BatchLot, ItemCategory
from app.models.quality import (
    LotStatus, InspectionDecision,
    QualityTestTemplate, QualityTestItem,
    QualityInspection, QualityInspectionResult,
    QualityCertificateOfAnalysis
)
from app.models.hazmat import (
    WarehouseZone, WarehouseBin, StorageIncompatibilityRule,
    SystemConfig
)

logger = logging.getLogger("seed")

async def seed_new_modules_data():
    """
    Idempotent seed function for new modules:
    - Quality Management (Templates, demo lots, CoA)
    - Hazmat & Warehouse Zones/Bins/Incompatibility Rules
    - Traceability scenario lot
    Guaranteed:
    - Varsa atla, yoksa ekle (Idempotent)
    - Never deletes, overwrites, or duplicates existing customer/order/stock records.
    """
    print("[MODULES SEED] Checking and seeding demo/master data for new modules...")

    # Ensure sample SDS directory and dummy PDF files exist
    uploads_sds_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "sds"))
    os.makedirs(uploads_sds_dir, exist_ok=True)
    sample_files = ["LABSA_96_Guvenlik_Bilgi_Formu.pdf", "Sodyum_Hidroksit_48_GBF.pdf", "Okyanus_Esansi_GBF.pdf", "SLES_70_GBF.pdf"]
    for sample_fn in sample_files:
        sample_path = os.path.join(uploads_sds_dir, sample_fn)
        if not os.path.exists(sample_path):
            try:
                with open(sample_path, "wb") as f:
                    f.write(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF\n")
            except Exception as e:
                logger.warning(f"Failed to create sample PDF: {e}")

    async with async_session_factory() as session:
        try:
            # -------------------------------------------------------------
            # 1. Quality Role & Permissions
            # -------------------------------------------------------------
            kalite_role = (await session.execute(
                select(Role).where(Role.role_name.in_(["KALITE", "Kalite"]))
            )).scalar_one_or_none()

            if not kalite_role:
                kalite_role = Role(role_name="KALITE", description="Kalite Kontrol ve Laboratuvar Sorumlusu")
                session.add(kalite_role)
                await session.flush()
                for mod in ["quality", "inventory", "manufacturing"]:
                    session.add(ModulePermission(
                        role_id=kalite_role.id,
                        module_name=mod,
                        can_read=True,
                        can_write=True,
                        can_delete=False
                    ))
                print("[MODULES SEED] Created KALITE role & permissions.")

            admin_role = (await session.execute(
                select(Role).where(Role.role_name == "ADMIN")
            )).scalar_one_or_none()

            if admin_role:
                perm_check = (await session.execute(
                    select(ModulePermission).where(
                        ModulePermission.role_id == admin_role.id,
                        ModulePermission.module_name == "quality"
                    )
                )).scalar_one_or_none()
                if not perm_check:
                    session.add(ModulePermission(
                        role_id=admin_role.id,
                        module_name="quality",
                        can_read=True,
                        can_write=True,
                        can_delete=True
                    ))

            # -------------------------------------------------------------
            # 2. Quality Test Templates
            # -------------------------------------------------------------
            items_res = await session.execute(select(Item))
            all_items = items_res.scalars().all()
            item_by_sku = {item.sku: item for item in all_items}

            sivi_sabun = item_by_sku.get("MAM-SAB-001") or next((it for it in all_items if "sabun" in it.name.lower()), None)
            sles = item_by_sku.get("HAM-SLES-070") or next((it for it in all_items if "sles" in it.name.lower()), None)
            kostik = item_by_sku.get("HAM-NAOH-048") or next((it for it in all_items if "kostik" in it.name.lower() or "naoh" in it.name.lower()), None)

            # A. Sıvı Sabun Template
            if sivi_sabun:
                tmpl_soap = (await session.execute(
                    select(QualityTestTemplate).where(QualityTestTemplate.name == "Sıvı El Sabunu Kalite Standardı")
                )).scalar_one_or_none()

                if not tmpl_soap:
                    t = QualityTestTemplate(
                        item_id=sivi_sabun.id,
                        name="Sıvı El Sabunu Kalite Standardı",
                        description="TS 518 standardına göre bitmiş ürün fiziksel ve kimyasal parametreleri",
                        is_active=True
                    )
                    session.add(t)
                    await session.flush()
                    session.add_all([
                        QualityTestItem(template_id=t.id, test_name="pH Değeri (20°C)", unit="pH", min_value=Decimal("5.5000"), max_value=Decimal("7.5000"), method="TS 518 / pH Metre", order_index=1),
                        QualityTestItem(template_id=t.id, test_name="Yoğunluk (g/cm³)", unit="g/cm³", min_value=Decimal("1.0100"), max_value=Decimal("1.0400"), method="Piknometre", order_index=2),
                        QualityTestItem(template_id=t.id, test_name="Viskozite (mPa.s / 20°C)", unit="mPa.s", min_value=Decimal("2800.0000"), max_value=Decimal("4200.0000"), method="Brookfield Spindle 4 / 20 RPM", order_index=3),
                        QualityTestItem(template_id=t.id, test_name="Görünüm ve Homojenlik", unit="", expected_text="Uygun", method="Gözlem / Şeffaf Viskoz Sıvı", order_index=4),
                    ])
                    sivi_sabun.qc_outgoing_required = True
                    print("[MODULES SEED] Created Sıvı El Sabunu test template.")

            # B. SLES Template
            if sles:
                tmpl_sles = (await session.execute(
                    select(QualityTestTemplate).where(QualityTestTemplate.name == "SLES %70 Hammadde Giriş Testi")
                )).scalar_one_or_none()

                if not tmpl_sles:
                    t = QualityTestTemplate(
                        item_id=sles.id,
                        name="SLES %70 Hammadde Giriş Testi",
                        description="Sodyum Lauril Eter Sülfat kabul spesifikasyonları",
                        is_active=True
                    )
                    session.add(t)
                    await session.flush()
                    session.add_all([
                        QualityTestItem(template_id=t.id, test_name="Aktif Madde Konsantrasyonu", unit="%", min_value=Decimal("68.0000"), max_value=Decimal("72.0000"), method="İki Fazlı Titrasyon", order_index=1),
                        QualityTestItem(template_id=t.id, test_name="pH (%10 Çözelti)", unit="pH", min_value=Decimal("7.0000"), max_value=Decimal("9.0000"), method="pH Metre", order_index=2),
                        QualityTestItem(template_id=t.id, test_name="Renk (Hazen/APHA)", unit="Hazen", min_value=Decimal("0.0000"), max_value=Decimal("20.0000"), method="Spektrofotometrik", order_index=3),
                    ])
                    sles.qc_incoming_required = True
                    print("[MODULES SEED] Created SLES test template.")

            # C. Kostik Template
            if kostik:
                tmpl_kostik = (await session.execute(
                    select(QualityTestTemplate).where(QualityTestTemplate.name == "Kostik Sıvı (NaOH %48) Kabul Testi")
                )).scalar_one_or_none()

                if not tmpl_kostik:
                    t = QualityTestTemplate(
                        item_id=kostik.id,
                        name="Kostik Sıvı (NaOH %48) Kabul Testi",
                        description="Sodyum Hidroksit sıvı hammadde girdi kalite kontrolleri",
                        is_active=True
                    )
                    session.add(t)
                    await session.flush()
                    session.add_all([
                        QualityTestItem(template_id=t.id, test_name="NaOH Konsantrasyonu (%)", unit="%", min_value=Decimal("47.0000"), max_value=Decimal("49.5000"), method="Asit-Baz Titrasyonu", order_index=1),
                        QualityTestItem(template_id=t.id, test_name="Görünüm", unit="", expected_text="Uygun", method="Berrak, Renksiz Sıvı", order_index=2),
                        QualityTestItem(template_id=t.id, test_name="Tortu / Çökelti", unit="", expected_text="Yok", method="Gözlem", order_index=3),
                    ])
                    kostik.qc_incoming_required = True
                    print("[MODULES SEED] Created Kostik test template.")

            # -------------------------------------------------------------
            # 3. Warehouse Zones and Bins
            # -------------------------------------------------------------
            zones_data = [
                ("Z-GENEL", "Genel Kimyasal Depolama", "Genel", "Tehlikesiz standart mamul ve hammaddeler"),
                ("Z-ASIT", "Asit Depolama Alanı", "Aşındırıcı-Asit", "Epoksi kaplamalı asit havuzu ve döküntü tepsileri"),
                ("Z-BAZ", "Baz Depolama Alanı", "Aşındırıcı-Baz", "Kostik ve alkali hammadde özel alanı"),
                ("Z-YANICI", "Yanıcı Hammadde Deposu", "Yanıcı", "Ex-proof havalandırma ve sprinkler korumalı solvent odası"),
                ("Z-SOGUK", "Soğuk Hava Deposu", "Soğuk (2-8 °C)", "Sıcaklığa duyarlı esans ve enzim deposu"),
                ("Z-KARANTINA", "Karantina ve Red Bölgesi", "Karantina", "Giriş kalite onayı bekleyen veya reddedilen partiler"),
            ]

            zone_obj_map = {}
            for code, name, storage_class, desc in zones_data:
                existing_zone = (await session.execute(
                    select(WarehouseZone).where(WarehouseZone.code == code)
                )).scalar_one_or_none()

                if not existing_zone:
                    z = WarehouseZone(
                        code=code,
                        name=name,
                        storage_class=storage_class,
                        description=desc,
                        is_active=True
                    )
                    session.add(z)
                    await session.flush()
                    zone_obj_map[code] = z
                    print(f"[MODULES SEED] Created zone {code} ({name}).")
                else:
                    zone_obj_map[code] = existing_zone

            # Bins definition
            bins_data = [
                ("A-01", "Z-GENEL", Decimal("6000.000"), 4, "A Blok Kat 1 Genel"),
                ("A-02", "Z-GENEL", Decimal("6000.000"), 4, "A Blok Kat 2 Genel"),
                ("A-03", "Z-GENEL", Decimal("6000.000"), 4, "A Blok Kat 3 Genel"),
                ("A-04", "Z-GENEL", Decimal("6000.000"), 4, "A Blok Kat 4 Genel"),
                ("B-01", "Z-ASIT", Decimal("4000.000"), 3, "Asit Havuzu Raf 1"),
                ("B-02", "Z-ASIT", Decimal("4000.000"), 3, "Asit Havuzu Raf 2"),
                ("C-01", "Z-BAZ", Decimal("5000.000"), 3, "Baz Bölgesi Raf 1"),
                ("C-02", "Z-BAZ", Decimal("5000.000"), 3, "Baz Bölgesi Raf 2"),
                ("D-01", "Z-YANICI", Decimal("3000.000"), 2, "Yanıcı Odası Ex-Proof Raf 1"),
                ("E-01", "Z-SOGUK", Decimal("2000.000"), 2, "Soğuk Oda (2-8 °C) Raf 1"),
                ("Q-01", "Z-KARANTINA", Decimal("5000.000"), 4, "Karantina Kabul Rafı"),
                ("Q-02", "Z-KARANTINA", Decimal("5000.000"), 4, "Reddedilen Ürünler İzolasyon Rafı"),
            ]

            bin_obj_map = {}
            for bin_code, zone_code, cap_kg, cap_pal, desc in bins_data:
                existing_bin = (await session.execute(
                    select(WarehouseBin).where(WarehouseBin.code == bin_code)
                )).scalar_one_or_none()

                target_zone = zone_obj_map.get(zone_code)
                if not existing_bin and target_zone:
                    b = WarehouseBin(
                        zone_id=target_zone.id,
                        code=bin_code,
                        capacity_kg=cap_kg,
                        capacity_pallet=cap_pal,
                        is_active=True,
                        description=desc
                    )
                    session.add(b)
                    await session.flush()
                    bin_obj_map[bin_code] = b
                    print(f"[MODULES SEED] Created bin {bin_code} in {zone_code}.")
                elif existing_bin:
                    bin_obj_map[bin_code] = existing_bin

            # -------------------------------------------------------------
            # 4. Storage Incompatibility Rules & System Configs
            # -------------------------------------------------------------
            incomp_rules = [
                ("Aşındırıcı-Asit", "Aşındırıcı-Baz", "Şiddetli nötralizasyon reaksiyonu ve yüksek ısı açığa çıkma riski."),
                ("Yükseltgen", "Yanıcı", "Kendiliğinden tutuşma ve şiddetli yangın patlama tehlikesi."),
            ]
            for ca, cb, reason in incomp_rules:
                exists_rule = (await session.execute(
                    select(StorageIncompatibilityRule).where(
                        StorageIncompatibilityRule.class_a == ca,
                        StorageIncompatibilityRule.class_b == cb
                    )
                )).scalar_one_or_none()

                if not exists_rule:
                    session.add(StorageIncompatibilityRule(
                        class_a=ca,
                        class_b=cb,
                        reason=reason,
                        is_active=True
                    ))
                    print(f"[MODULES SEED] Added incompatibility rule: {ca} <-> {cb}")

            configs_to_seed = [
                ("sds_validity_months", "36", "GBF / SDS geçerlilik süresi (ay)."),
                ("label_disclaimer", "Etiket tehlike bilgisi taslaktır, yasal etiket yerine geçmez.", "Yasal uyum uyarısı."),
            ]
            for key, val, desc in configs_to_seed:
                cfg_exists = (await session.execute(
                    select(SystemConfig).where(SystemConfig.config_key == key)
                )).scalar_one_or_none()
                if not cfg_exists:
                    session.add(SystemConfig(config_key=key, config_value=val, description=desc))

            # -------------------------------------------------------------
            # 5. Hazmat Information on Existing Items
            # -------------------------------------------------------------
            today = datetime.date.today()
            rev_date_valid = today - datetime.timedelta(days=180) # valid
            rev_date_expired = today - datetime.timedelta(days=365 * 4) # expired > 36 months

            for it in all_items:
                name_l = it.name.lower()
                sku = it.sku or ""

                if "labsa" in name_l or "HAM-LABSA" in sku:
                    it.cas_number = it.cas_number or "27176-87-0"
                    it.un_number = "UN 2586"
                    it.signal_word = "Dikkat"
                    it.ghs_pictograms = '["GHS05", "GHS07"]'
                    it.storage_class = "Aşındırıcı-Asit"
                    it.sds_file_name = "LABSA_96_Guvenlik_Bilgi_Formu.pdf"
                    it.sds_file_url = f"/api/v1/hazmat/sds-files/LABSA_96_Guvenlik_Bilgi_Formu.pdf"
                    it.sds_revision_date = rev_date_valid
                    it.hazard_notes = "Göz ve ciltte tahrişe neden olur. Asit depolama alanında muhafaza ediniz."
                elif "kostik" in name_l or "naoh" in name_l or "HAM-NAOH" in sku:
                    it.cas_number = it.cas_number or "1310-73-2"
                    it.un_number = "UN 1824"
                    it.signal_word = "Tehlike"
                    it.ghs_pictograms = '["GHS05"]'
                    it.storage_class = "Aşındırıcı-Baz"
                    it.sds_file_name = "Sodyum_Hidroksit_48_GBF.pdf"
                    it.sds_file_url = f"/api/v1/hazmat/sds-files/Sodyum_Hidroksit_48_GBF.pdf"
                    it.sds_revision_date = rev_date_expired # triggers SDS warning (> 36 months)
                    it.hazard_notes = "Ciddi cilt yanıklarına ve göz hasarına yol açar. Asitlerden uzakta depolayın."
                elif "esans" in name_l or "HAM-PRF" in sku:
                    it.cas_number = it.cas_number or "8000-48-4"
                    it.un_number = "UN 1169"
                    it.signal_word = "Tehlike"
                    it.ghs_pictograms = '["GHS02", "GHS07", "GHS09"]'
                    it.storage_class = "Yanıcı"
                    it.temp_min = Decimal("5.00")
                    it.temp_max = Decimal("25.00")
                    it.sds_file_name = "Okyanus_Esansi_GBF.pdf"
                    it.sds_file_url = f"/api/v1/hazmat/sds-files/Okyanus_Esansi_GBF.pdf"
                    it.sds_revision_date = rev_date_valid
                    it.hazard_notes = "Alevlenir sıvı ve buhar. Sudaki yaşam için uzun süreli zararlı etki."
                elif "sles" in name_l or "HAM-SLES" in sku:
                    it.cas_number = it.cas_number or "68891-38-3"
                    it.signal_word = "Dikkat"
                    it.ghs_pictograms = '["GHS07"]'
                    it.storage_class = "Genel"
                    it.sds_file_name = "SLES_70_GBF.pdf"
                    it.sds_file_url = f"/api/v1/hazmat/sds-files/SLES_70_GBF.pdf"
                    it.sds_revision_date = rev_date_valid
                    it.hazard_notes = "Cilt tahrişine ve ciddi göz tahrişine yol açar."
                elif "gliserin" in name_l or "HAM-GLS" in sku:
                    it.cas_number = it.cas_number or "56-81-5"
                    it.signal_word = "Yok"
                    it.ghs_pictograms = '[]'
                    it.storage_class = "Genel"

            # -------------------------------------------------------------
            # 6. Demo Lots & Quality Inspection / CoA / Bins
            # -------------------------------------------------------------
            # Ensure demo lot 1: Karantina lot
            if sles:
                lot_q = (await session.execute(
                    select(BatchLot).where(BatchLot.batch_number == "LOT-2026-QC-001")
                )).scalar_one_or_none()

                if not lot_q:
                    q_bin = bin_obj_map.get("Q-01")
                    session.add(BatchLot(
                        item_id=sles.id,
                        batch_number="LOT-2026-QC-001",
                        warehouse="Hammadde Deposu",
                        quantity=Decimal("3500.000"),
                        expiration_date=today + datetime.timedelta(days=365),
                        status=LotStatus.KARANTINA.value,
                        bin_id=q_bin.id if q_bin else None,
                        bin_code=q_bin.code if q_bin else "Q-01",
                        qc_notes="Mal kabul yapıldı, hammadde giriş kalite kontrol testi bekliyor."
                    ))
                    print("[MODULES SEED] Created demo quarantine lot LOT-2026-QC-001.")

            # Ensure demo lot 2: Bloke lot
            if kostik:
                lot_b = (await session.execute(
                    select(BatchLot).where(BatchLot.batch_number == "LOT-2026-QC-002")
                )).scalar_one_or_none()

                if not lot_b:
                    q_bin2 = bin_obj_map.get("Q-02")
                    lot_b = BatchLot(
                        item_id=kostik.id,
                        batch_number="LOT-2026-QC-002",
                        warehouse="Hammadde Deposu",
                        quantity=Decimal("1200.000"),
                        expiration_date=today + datetime.timedelta(days=180),
                        status=LotStatus.BLOKE.value,
                        bin_id=q_bin2.id if q_bin2 else None,
                        bin_code=q_bin2.code if q_bin2 else "Q-02",
                        qc_notes="Konsantrasyon alt limitin altında çıktı (%45.2). Laboratuvar tarafından bloke edildi."
                    )
                    session.add(lot_b)
                    await session.flush()
                    print("[MODULES SEED] Created demo blocked lot LOT-2026-QC-002.")

            # Ensure demo lot 3 & Inspection & CoA: Serbest lot
            if sivi_sabun:
                lot_s = (await session.execute(
                    select(BatchLot).where(BatchLot.batch_number == "LOT-2026-QC-003")
                )).scalar_one_or_none()

                if not lot_s:
                    a_bin = bin_obj_map.get("A-01")
                    lot_s = BatchLot(
                        item_id=sivi_sabun.id,
                        batch_number="LOT-2026-QC-003",
                        warehouse="Mamul Ürün Deposu",
                        quantity=Decimal("4850.000"),
                        expiration_date=today + datetime.timedelta(days=730),
                        status=LotStatus.SERBEST.value,
                        bin_id=a_bin.id if a_bin else None,
                        bin_code=a_bin.code if a_bin else "A-01",
                        qc_notes="Kalite kontrol tamamlandı. Tüm TS 518 parametreleri uygun."
                    )
                    session.add(lot_s)
                    await session.flush()
                    print("[MODULES SEED] Created demo released lot LOT-2026-QC-003.")

                # Ensure inspection & CoA for LOT-2026-QC-003
                existing_coa = (await session.execute(
                    select(QualityCertificateOfAnalysis).where(QualityCertificateOfAnalysis.certificate_number == "COA-2026-00084")
                )).scalar_one_or_none()

                if not existing_coa and lot_s:
                    insp = QualityInspection(
                        inspection_number="QC-2026-00084",
                        batch_lot_id=lot_s.id,
                        source_type="URETIM",
                        decision="Serbest Bırakıldı",
                        decision_reason="Tüm fizikokimyasal parametreler TS 518 standartlarına uygundur.",
                        inspector_name="Kemal Günay",
                        notes="Tam parti onayı verildi."
                    )
                    session.add(insp)
                    await session.flush()

                    coa = QualityCertificateOfAnalysis(
                        certificate_number="COA-2026-00084",
                        inspection_id=insp.id,
                        batch_lot_id=lot_s.id,
                        product_name=sivi_sabun.name,
                        product_sku=sivi_sabun.sku,
                        lot_number=lot_s.batch_number,
                        production_date=today - datetime.timedelta(days=1),
                        expiration_date=today + datetime.timedelta(days=730),
                        approved_by="Kemal Günay (Laboratuvar Sorumlusu)",
                        notes="Numunenin TS 518 standartlarına ve Günay Kimya kalite şartnamesine uygun olduğu onaylanmıştır."
                    )
                    session.add(coa)
                    print("[MODULES SEED] Created demo inspection and CoA COA-2026-00084.")

            # -------------------------------------------------------------
            # 7. Traceability Scenario Lot: LOT-SIP-2026-99214
            # -------------------------------------------------------------
            target_trace_lot = "LOT-SIP-2026-99214"
            trace_lot_record = (await session.execute(
                select(BatchLot).where(BatchLot.batch_number == target_trace_lot)
            )).scalar_one_or_none()

            if not trace_lot_record and sivi_sabun:
                a_bin = bin_obj_map.get("A-02")
                trace_lot_record = BatchLot(
                    item_id=sivi_sabun.id,
                    batch_number=target_trace_lot,
                    warehouse="Mamul Ürün Deposu",
                    quantity=Decimal("2500.000"),
                    expiration_date=today + datetime.timedelta(days=720),
                    status=LotStatus.SERBEST.value,
                    bin_id=a_bin.id if a_bin else None,
                    bin_code=a_bin.code if a_bin else "A-02",
                    qc_notes="Sipariş SIP-2026-99214 için üretilmiş parti şecere lotu."
                )
                session.add(trace_lot_record)
                print(f"[MODULES SEED] Created traceability scenario lot {target_trace_lot}.")

            await session.commit()
            print("[MODULES SEED SUCCESS] All demo and master data verified/seeded successfully.")
        except Exception as e:
            await session.rollback()
            print(f"[MODULES SEED ERROR] Error during module data seed: {e}")
            logger.error(f"[MODULES SEED ERROR] {e}", exc_info=True)
