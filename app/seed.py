import asyncio
import datetime
from decimal import Decimal
from sqlalchemy import select
from app.core.config import engine, async_session_factory
from app.core.security import get_password_hash
from app.models import Base
from app.models.auth import User, Role, UserRole, ModulePermission
from app.models.accounting import Company, FiscalPeriod, PeriodStatus, Account, AccountType
from app.models.cari import CariAccount, CariGroup, CariType, RiskStatus
from app.models.inventory import (
    Item, ItemCategory, BatchLot, GoodsReceipt, GoodsReceiptItem,
    DispatchOrder, DispatchItem, DispatchStatus, BarcodeUnit, BarcodeType, BarcodeStatus,
    BarcodeSequence, LabelPrintLog
)
from app.models.manufacturing import Recipe, RecipeIngredient, ProductionOrder, ProductionStatus

async def seed_master_data():
    print("[1/6] Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        # Check if database is already initialized with users (Idempotent seed check)
        check_user_stmt = select(User).limit(1)
        res_check = await session.execute(check_user_stmt)
        if res_check.scalar_one_or_none():
            print("[SEED INFO] Veritabanı tablolarında mevcut kullanıcı kayıtları bulundu. Demo seed atlandı.")
            return

        print("[2/6] Seeding roles and permissions...")
        roles_data = [
            ("ADMIN", "Tam Yetkili Sistem Yöneticisi"),
            ("FABRIKA_MUDURU", "Fabrika Üretim ve Reçete Müdürü"),
            ("DEPO_SORUMLUSU", "Hammadde ve Mamul Depo Yöneticisi"),
            ("MUHASEBE", "Muhasebe ve Finans Sorumlusu"),
            ("BAYI", "B2B Bayi Kullanıcısı"),
        ]

        role_objs = {}
        for role_name, desc in roles_data:
            stmt = select(Role).where(Role.role_name == role_name)
            res = await session.execute(stmt)
            role = res.scalar_one_or_none()
            if not role:
                role = Role(role_name=role_name, description=desc)
                session.add(role)
                await session.flush()
                # Default permissions
                modules = ["inventory", "manufacturing", "accounting", "cari", "b2b_orders"]
                for mod in modules:
                    perm = ModulePermission(
                        role_id=role.id,
                        module_name=mod,
                        can_read=True,
                        can_write=(role_name in ["ADMIN", "FABRIKA_MUDURU", "DEPO_SORUMLUSU", "MUHASEBE"]),
                        can_delete=(role_name == "ADMIN"),
                    )
                    session.add(perm)
            role_objs[role_name] = role

        print("[3/6] Seeding users with official corporate domain (@gunaykimya.net)...")
        import os
        admin_pwd = os.getenv("ADMIN_PASSWORD", "Admin123!")
        users_data = [
            ("admin@gunaykimya.net", admin_pwd, "Kemal Günay (Sistem Yöneticisi)", "ADMIN"),
            ("bayi@gunaykimya.net", "Bayi123!", "Ege Kimya B2B Bayi Yetkilisi", "BAYI"),
            ("depo@gunaykimya.net", "Depo123!", "Ahmet Depo Yetkilisi", "DEPO_SORUMLUSU"),
            ("muhasebe@gunaykimya.net", "Muhasebe123!", "Selin Finans", "MUHASEBE"),
            ("admin@gunaykimya.com", admin_pwd, "Kemal Günay", "ADMIN"),
            ("bayi@egekimya.com", "Bayi123!", "Ege Kimya Bayi", "BAYI"),
        ]

        for email, pwd, name, r_name in users_data:
            stmt = select(User).where(User.email == email)
            res = await session.execute(stmt)
            user = res.scalar_one_or_none()
            if not user:
                user = User(
                    email=email,
                    hashed_password=get_password_hash(pwd),
                    full_name=name,
                    is_active=True,
                )
                session.add(user)
                await session.flush()
                ur = UserRole(user_id=user.id, role_id=role_objs[r_name].id)
                session.add(ur)
            else:
                user.hashed_password = get_password_hash(pwd)
                user.is_active = True

        print("[4/6] Seeding company and accounting periods...")
        stmt = select(Company).where(Company.code == "GNY")
        res = await session.execute(stmt)
        company = res.scalar_one_or_none()
        if not company:
            company = Company(
                code="GNY",
                name="Günay Kimya Sanayi ve Ticaret A.Ş.",
                tax_number="3840291823",
                tax_office="Kemalpaşa Vergi Dairesi",
                base_currency="TRY",
                is_active=True,
            )
            session.add(company)
            await session.flush()

            # Fiscal Period
            period = FiscalPeriod(
                company_id=company.id,
                fiscal_year=2026,
                period_number=1,
                start_date=datetime.date(2026, 1, 1),
                end_date=datetime.date(2026, 12, 31),
                status=PeriodStatus.OPEN,
            )
            session.add(period)

            # Chart of accounts
            accounts_data = [
                ("100", "KASA HESABI", AccountType.ASSET),
                ("102", "BANKALAR HESABI", AccountType.ASSET),
                ("120", "ALICILAR HESABI (MÜŞTERİLER)", AccountType.ASSET),
                ("150", "İLK MADDE VE MALZEME (HAMMADDE)", AccountType.ASSET),
                ("152", "MAMULLER HESABI", AccountType.ASSET),
                ("320", "SATICILAR HESABI (TEDARİKÇİLER)", AccountType.LIABILITY),
                ("600", "YURTİÇİ SATIŞLAR", AccountType.REVENUE),
                ("710", "DİREKT İLKMADDE VE MALZEME GİDERLERİ", AccountType.EXPENSE),
            ]
            for code, name, acct_type in accounts_data:
                acct = Account(
                    company_id=company.id,
                    account_code=code,
                    name=name,
                    account_type=acct_type,
                    currency="TRY",
                    is_active=True,
                )
                session.add(acct)

        print("[5/6] Seeding Chemical SKUs, Traceability Lots & BOM Recipe...")
        raw_items_data = [
            ("LABSA-96", "Lineer Alkil Benzen Sülfonik Asit %96 (LABSA)", "kg", ItemCategory.RAW_MATERIAL, "27176-87-0", Decimal("1.0600"), Decimal("2000.00"), 365, "8 (Aşındırıcı)"),
            ("SLES-70", "Sodyum Lauril Eter Sülfat %70 (SLES)", "kg", ItemCategory.RAW_MATERIAL, "68891-38-3", Decimal("1.1000"), Decimal("3000.00"), 365, None),
            ("NAOH-48", "Sıvı Kostik Soda %48 (NaOH)", "kg", ItemCategory.RAW_MATERIAL, "1310-73-2", Decimal("1.5200"), Decimal("1500.00"), 730, "8 (Aşındırıcı)"),
            ("GLIS-99", "Gliserin Farma Kalite %99.5", "kg", ItemCategory.RAW_MATERIAL, "56-81-5", Decimal("1.2600"), Decimal("500.00"), 730, None),
            ("ESN-CAM", "Doğal Çam Esansı", "kg", ItemCategory.RAW_MATERIAL, None, Decimal("0.9200"), Decimal("100.00"), 365, "3 (Alevlenir)"),
            ("SU-ARIT", "Endüstriyel Deiyonize Saf Su", "kg", ItemCategory.RAW_MATERIAL, "7732-18-5", Decimal("1.0000"), Decimal("5000.00"), 180, None),
            ("KOKO-BETAIN", "Kokamidopropil Betain (CAPB) %30", "kg", ItemCategory.RAW_MATERIAL, "61789-40-0", Decimal("1.0400"), Decimal("800.00"), 365, None),
            ("TUZ-END", "Rafine Sanayi Tuzu (Sodyum Klorür)", "kg", ItemCategory.RAW_MATERIAL, "7647-14-5", Decimal("1.2000"), Decimal("1000.00"), 1095, None),
            ("SITR-ASIT", "Sitrik Asit Monohidrat", "kg", ItemCategory.RAW_MATERIAL, "5949-29-1", Decimal("1.5400"), Decimal("400.00"), 730, None),
            ("SODYUM-HIPO", "Sodyum Hipoklorit %15 (Klor)", "kg", ItemCategory.RAW_MATERIAL, "7681-52-9", Decimal("1.2100"), Decimal("2500.00"), 180, "8 (Aşındırıcı)"),
        ]

        item_objs = {}
        for sku, name, unit, cat, cas, den, min_stk, shelf_days, hazard in raw_items_data:
            stmt = select(Item).where(Item.sku == sku)
            res = await session.execute(stmt)
            item = res.scalar_one_or_none()
            if not item:
                item = Item(
                    sku=sku,
                    name=name,
                    unit=unit,
                    category=cat,
                    cas_number=cas,
                    density=den,
                    min_stock=min_stk,
                    shelf_life_days=shelf_days,
                    hazard_class=hazard,
                    is_active=True,
                )
                session.add(item)
                await session.flush()
            else:
                item.name = name
                item.unit = unit
                item.category = cat
                item.cas_number = cas
                item.density = den
                item.min_stock = min_stk
                item.shelf_life_days = shelf_days
                item.hazard_class = hazard
                item.is_active = True
            item_objs[sku] = item

        finished_items_data = [
            ("GNY-SBN-01", "Sıvı Sabun 5L", "adet", ItemCategory.FINISHED_GOOD, None, Decimal("1.0300"), Decimal("150.00"), 730, None),
            ("GNY-YZY-01", "Yüzey Temizleyici 5L", "adet", ItemCategory.FINISHED_GOOD, None, Decimal("1.0100"), Decimal("120.00"), 730, None),
            ("GNY-KLR-01", "Çamaşır Suyu 5L", "adet", ItemCategory.FINISHED_GOOD, None, Decimal("1.0800"), Decimal("200.00"), 365, "8 (Aşındırıcı)"),
            ("GNY-DTG-01", "Endüstriyel Bulaşık Deterjanı 20L", "adet", ItemCategory.FINISHED_GOOD, None, Decimal("1.0500"), Decimal("80.00"), 730, None),
        ]

        for sku, name, unit, cat, cas, den, min_stk, shelf_days, hazard in finished_items_data:
            stmt = select(Item).where(Item.sku == sku)
            res = await session.execute(stmt)
            item = res.scalar_one_or_none()
            if not item:
                item = Item(
                    sku=sku,
                    name=name,
                    unit=unit,
                    category=cat,
                    cas_number=cas,
                    density=den,
                    min_stock=min_stk,
                    shelf_life_days=shelf_days,
                    hazard_class=hazard,
                    is_active=True,
                )
                session.add(item)
                await session.flush()
            else:
                item.name = name
                item.unit = unit
                item.category = cat
                item.min_stock = min_stk
                item.shelf_life_days = shelf_days
                item.hazard_class = hazard
                item.is_active = True
            item_objs[sku] = item

        print("[6/6] Seeding Cari accounts (5 Customers & 4 Suppliers)...")
        stmt = select(CariGroup).where(CariGroup.code == "EGE_DIST")
        res = await session.execute(stmt)
        cari_group = res.scalar_one_or_none()
        if not cari_group:
            cari_group = CariGroup(
                code="EGE_DIST",
                name="Ege Bölgesi Distribütörleri",
                default_payment_term_days=45,
                default_discount_percentage=Decimal("7.50"),
            )
            session.add(cari_group)
            await session.flush()

        # 5 Realistic Turkish Customers
        customers_data = [
            {
                "code": "120.01.0001",
                "title": "Ege Kimya Dağıtım ve Pazarlama A.Ş.",
                "tax_number": "1234567890",
                "tax_office": "Konak V.D.",
                "contact_person": "Mustafa Çelik",
                "phone": "0232 444 12 34",
                "email": "siparis@egekimya.com.tr",
                "address": "Atatürk Org. San. Bölgesi 10006 Sok. No:12 Çiğli / İzmir",
                "payment_term_days": 45,
                "credit_limit": Decimal("500000.00"),
                "current_balance": Decimal("142500.00"),
                "open_uncollected_checks": Decimal("65000.00"),
            },
            {
                "code": "120.01.0002",
                "title": "Akdeniz Endüstriyel Hijyen San. ve Tic. Ltd. Şti.",
                "tax_number": "5544332211",
                "tax_office": "Antalya Kurumlar V.D.",
                "contact_person": "Zeynep Demir",
                "phone": "0242 321 45 67",
                "email": "info@akdenizhijyen.com",
                "address": "Organize Sanayi Bölgesi 2. Kısım 22. Cadde No:8 Döşemealtı / Antalya",
                "payment_term_days": 30,
                "credit_limit": Decimal("300000.00"),
                "current_balance": Decimal("50000.00"),
                "open_uncollected_checks": Decimal("0.00"),
            },
            {
                "code": "120.01.0003",
                "title": "Marmara Temizlik Ürünleri Dağıtım Ltd. Şti.",
                "tax_number": "6192837401",
                "tax_office": "İkitelli V.D.",
                "contact_person": "Burak Şengül",
                "phone": "0212 675 88 90",
                "email": "satin-alma@marmaratemiz.com",
                "address": "İkitelli OSB Triko Center Sanayi Sitesi M Blok No:41 Başakşehir / İstanbul",
                "payment_term_days": 60,
                "credit_limit": Decimal("400000.00"),
                "current_balance": Decimal("82400.00"),
                "open_uncollected_checks": Decimal("20000.00"),
            },
            {
                "code": "120.01.0004",
                "title": "İç Anadolu Toptan Tüketim Malları A.Ş.",
                "tax_number": "4829103948",
                "tax_office": "Ostim V.D.",
                "contact_person": "Serkan Doğan",
                "phone": "0312 385 11 22",
                "email": "tedarik@icanadolutoptan.com.tr",
                "address": "İvedik Organize Sanayi Bölgesi 1468. Cad. No:30 Yenimahalle / Ankara",
                "payment_term_days": 30,
                "credit_limit": Decimal("250000.00"),
                "current_balance": Decimal("35000.00"),
                "open_uncollected_checks": Decimal("0.00"),
            },
            {
                "code": "120.01.0005",
                "title": "Karadeniz Kurumsal Tedarik ve Hijyen Hizmetleri",
                "tax_number": "7728194022",
                "tax_office": "Samsun Gaziler V.D.",
                "contact_person": "Emine Aydın",
                "phone": "0362 266 50 40",
                "email": "siparis@karadeniztedarik.com",
                "address": "Organize Sanayi Bölgesi Yaşar Doğu Cad. No:15 Tekkeköy / Samsun",
                "payment_term_days": 45,
                "credit_limit": Decimal("200000.00"),
                "current_balance": Decimal("18750.00"),
                "open_uncollected_checks": Decimal("0.00"),
            },
        ]

        dealer_cari = None
        for cdata in customers_data:
            stmt = select(CariAccount).where(CariAccount.code == cdata["code"])
            res = await session.execute(stmt)
            c_obj = res.scalar_one_or_none()
            if not c_obj:
                c_obj = CariAccount(
                    code=cdata["code"],
                    title=cdata["title"],
                    cari_type=CariType.CUSTOMER,
                    group_id=cari_group.id if cdata["code"] == "120.01.0001" else None,
                    tax_number=cdata["tax_number"],
                    tax_office=cdata["tax_office"],
                    contact_person=cdata["contact_person"],
                    phone=cdata["phone"],
                    email=cdata["email"],
                    address=cdata["address"],
                    payment_term_days=cdata["payment_term_days"],
                    credit_limit=cdata["credit_limit"],
                    current_balance=cdata["current_balance"],
                    open_uncollected_checks=cdata["open_uncollected_checks"],
                    risk_status=RiskStatus.HEALTHY,
                    is_active=True,
                )
                session.add(c_obj)
                await session.flush()
            else:
                c_obj.title = cdata["title"]
                c_obj.tax_number = cdata["tax_number"]
                c_obj.tax_office = cdata["tax_office"]
                c_obj.contact_person = cdata["contact_person"]
                c_obj.phone = cdata["phone"]
                c_obj.email = cdata["email"]
                c_obj.address = cdata["address"]
                c_obj.payment_term_days = cdata["payment_term_days"]
                c_obj.credit_limit = cdata["credit_limit"]
                c_obj.is_active = True
            if cdata["code"] == "120.01.0001":
                dealer_cari = c_obj

        # 4 Realistic Turkish Chemical Suppliers
        import json
        suppliers_data = [
            {
                "code": "320.01.0001",
                "title": "BASF Türk Kimya Sanayi ve Tic. Ltd. Şti.",
                "tax_number": "9876543210",
                "tax_office": "Büyük Mükellefler V.D.",
                "contact_person": "Aylin Yılmaz",
                "phone": "0216 570 34 00",
                "email": "hammadde.satis@basf.com",
                "address": "Barbaros Mah. Begonya Sok. Nidakule Kuzey No:3E Ataşehir / İstanbul",
                "payment_term_days": 30,
                "products": ["LABSA-96", "SLES-70", "GLIS-99"],
            },
            {
                "code": "320.01.0002",
                "title": "Koruma Klor Alkali San. ve Tic. A.Ş.",
                "tax_number": "5770023419",
                "tax_office": "Derince V.D.",
                "contact_person": "Halil İbrahim Kaya",
                "phone": "0262 226 21 00",
                "email": "klor.satis@koruma.com.tr",
                "address": "Deniz Mah. Petrol Ofisi Cad. No:43 Derince / Kocaeli",
                "payment_term_days": 45,
                "products": ["NAOH-48", "SODYUM-HIPO", "TUZ-END"],
            },
            {
                "code": "320.01.0003",
                "title": "Aksa Akrilik Kimya Sanayii A.Ş.",
                "tax_number": "0330052341",
                "tax_office": "Yalova V.D.",
                "contact_person": "Mehmet Canpolat",
                "phone": "0226 353 25 45",
                "email": "info@aksa.com.tr",
                "address": "Merkez Mah. Yalova-Kocaeli Yolu Cad. No:34 Çiftlikköy / Yalova",
                "payment_term_days": 30,
                "products": ["KOKO-BETAIN", "SITR-ASIT"],
            },
            {
                "code": "320.01.0004",
                "title": "Seluz Kimya Kozmetik San. Tic. A.Ş.",
                "tax_number": "7600418392",
                "tax_office": "Silivri V.D.",
                "contact_person": "Deniz Aras",
                "phone": "0212 734 38 00",
                "email": "esans@seluz.com",
                "address": "Selimpaşa Mah. 2002. Sok. No:5 Silivri / İstanbul",
                "payment_term_days": 60,
                "products": ["ESN-CAM"],
            },
        ]

        supplier_cari = None
        for sdata in suppliers_data:
            # Map product SKUs to Item IDs
            prod_ids = [item_objs[p_sku].id for p_sku in sdata["products"] if p_sku in item_objs]
            stmt = select(CariAccount).where(CariAccount.code == sdata["code"])
            res = await session.execute(stmt)
            s_obj = res.scalar_one_or_none()
            if not s_obj:
                s_obj = CariAccount(
                    code=sdata["code"],
                    title=sdata["title"],
                    cari_type=CariType.SUPPLIER,
                    tax_number=sdata["tax_number"],
                    tax_office=sdata["tax_office"],
                    contact_person=sdata["contact_person"],
                    phone=sdata["phone"],
                    email=sdata["email"],
                    address=sdata["address"],
                    payment_term_days=sdata["payment_term_days"],
                    supplied_product_ids=json.dumps(prod_ids),
                    risk_status=RiskStatus.HEALTHY,
                    is_active=True,
                )
                session.add(s_obj)
                await session.flush()
            else:
                s_obj.title = sdata["title"]
                s_obj.tax_number = sdata["tax_number"]
                s_obj.tax_office = sdata["tax_office"]
                s_obj.contact_person = sdata["contact_person"]
                s_obj.phone = sdata["phone"]
                s_obj.email = sdata["email"]
                s_obj.address = sdata["address"]
                s_obj.payment_term_days = sdata["payment_term_days"]
                s_obj.supplied_product_ids = json.dumps(prod_ids)
                s_obj.is_active = True
            if sdata["code"] == "320.01.0001":
                supplier_cari = s_obj

        # Recipe for Ultra Sıvı Sabun
        stmt = select(Recipe).where(Recipe.name == "Ultra Sıvı Sabun 1000kg Formülasyonu")
        res = await session.execute(stmt)
        recipe = res.scalar_one_or_none()
        if not recipe:
            recipe = Recipe(
                name="Ultra Sıvı Sabun 1000kg Formülasyonu",
                description="Standart 1 ton sıvı el sabunu kimyasal üretim reçetesi",
                output_item_id=item_objs["GNY-SBN-01"].id,
                base_quantity=Decimal("1000.000"),
            )
            session.add(recipe)
            await session.flush()

            ingredients = [
                (item_objs["SLES-70"].id, Decimal("140.000")),
                (item_objs["LABSA-96"].id, Decimal("40.000")),
                (item_objs["NAOH-48"].id, Decimal("12.500")),
                (item_objs["GLIS-99"].id, Decimal("15.000")),
                (item_objs["ESN-CAM"].id, Decimal("3.500")),
                (item_objs["SU-ARIT"].id, Decimal("789.000")),
            ]
            for ing_id, qty in ingredients:
                ri = RecipeIngredient(
                    recipe_id=recipe.id,
                    raw_material_item_id=ing_id,
                    required_quantity=qty,
                )
                session.add(ri)

        # Seed Sample Production Orders for Live Phase Tracking
        stmt = select(ProductionOrder).where(ProductionOrder.order_number == "ORD-2026-001")
        res = await session.execute(stmt)
        prod_order1 = res.scalar_one_or_none()
        if not prod_order1 and recipe:
            prod_order1 = ProductionOrder(
                order_number="ORD-2026-001",
                recipe_id=recipe.id,
                target_quantity=Decimal("1200.000"),
                status=ProductionStatus.COMPLETED,
            )
            session.add(prod_order1)
            await session.flush()

        stmt = select(ProductionOrder).where(ProductionOrder.order_number == "ORD-2026-002")
        res = await session.execute(stmt)
        if not res.scalar_one_or_none() and recipe:
            prod_order2 = ProductionOrder(
                order_number="ORD-2026-002",
                recipe_id=recipe.id,
                target_quantity=Decimal("500.000"),
                status=ProductionStatus.IN_PROGRESS,
            )
            session.add(prod_order2)

        stmt = select(ProductionOrder).where(ProductionOrder.order_number == "ORD-2026-003")
        res = await session.execute(stmt)
        if not res.scalar_one_or_none() and recipe:
            prod_order3 = ProductionOrder(
                order_number="ORD-2026-003",
                recipe_id=recipe.id,
                target_quantity=Decimal("800.000"),
                status=ProductionStatus.PENDING,
            )
            session.add(prod_order3)

        # Initial Goods Receipt with full traceability metadata
        stmt = select(GoodsReceipt).where(GoodsReceipt.receipt_number == "GR-2026-00084")
        res = await session.execute(stmt)
        gr = res.scalar_one_or_none()
        if not gr:
            gr = GoodsReceipt(
                receipt_number="GR-2026-00084",
                supplier_id=supplier_cari.id if supplier_cari else None,
                supplier_name="BASF Türk Kimya Sanayi ve Tic. Ltd. Şti.",
                invoice_number="GNY202600004102",
                dispatch_note_number="IRS20260001290",
                target_warehouse="Hammadde Deposu",
                notes="Tanker boşaltımı tamamlandı, CoA analiz onaylı.",
            )
            session.add(gr)
            await session.flush()

            raw_stocks = [
                ("SLES-70", "LOT-BASF-2026-091", Decimal("5000.000"), Decimal("42.50")),
                ("LABSA-96", "LOT-PETK-2026-384", Decimal("3500.000"), Decimal("68.00")),
                ("NAOH-48", "LOT-KOR-2026-119", Decimal("2000.000"), Decimal("18.75")),
                ("GLIS-99", "LOT-EVY-2026-042", Decimal("1000.000"), Decimal("55.00")),
            ]
            for sku, b_num, qty, price in raw_stocks:
                it = item_objs[sku]
                gr_item = GoodsReceiptItem(
                    goods_receipt_id=gr.id,
                    item_id=it.id,
                    batch_number=b_num,
                    quantity=qty,
                    unit_price=price,
                    expiration_date=datetime.date(2027, 12, 31),
                )
                session.add(gr_item)
                await session.flush()

                batch = BatchLot(
                    batch_number=b_num,
                    item_id=it.id,
                    warehouse="Hammadde Deposu",
                    quantity=qty,
                    expiration_date=datetime.date(2027, 12, 31),
                    goods_receipt_item_id=gr_item.id,
                )
                session.add(batch)

        # Finished Goods Batches in Mamul Ürün Deposu
        finished_batches = [
            ("GNY-SBN-01", "LOT-MAM-2026-001", Decimal("500.000")),
            ("GNY-DTG-01", "LOT-MAM-2026-002", Decimal("300.000")),
            ("GNY-YZY-01", "LOT-MAM-2026-003", Decimal("400.000")),
        ]
        for sku, b_num, qty in finished_batches:
            stmt = select(BatchLot).where(BatchLot.batch_number == b_num)
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                it = item_objs[sku]
                f_batch = BatchLot(
                    batch_number=b_num,
                    item_id=it.id,
                    warehouse="Mamul Ürün Deposu",
                    quantity=qty,
                    expiration_date=datetime.date(2028, 6, 30),
                )
                session.add(f_batch)

        # Pending Dispatch Order for El Terminali verification testing
        stmt = select(DispatchOrder).where(DispatchOrder.dispatch_number == "DSP-2026-00901")
        res = await session.execute(stmt)
        dispatch_order = res.scalar_one_or_none()
        if not dispatch_order and dealer_cari:
            dispatch_order = DispatchOrder(
                dispatch_number="DSP-2026-00901",
                cari_id=dealer_cari.id,
                status=DispatchStatus.PENDING,
                warehouse="Mamul Ürün Deposu",
                delivery_address="Atatürk OSB Mah. 10023 Sok. No:14 Çiğli / İzmir",
                notes="El terminali barkod doğrulama bekleyen sevk emri.",
            )
            session.add(dispatch_order)
            await session.flush()

            # Item 1: 40 units (2 Pallets x 20) of GNY-SBN-01
            d_item1 = DispatchItem(
                dispatch_order_id=dispatch_order.id,
                item_id=item_objs["GNY-SBN-01"].id,
                quantity=Decimal("40.000"),
                scanned_quantity=Decimal("0.000"),
                unit_price=Decimal("125.00"),
            )
            session.add(d_item1)

            # Item 2: 10 units of GNY-DTG-01
            d_item2 = DispatchItem(
                dispatch_order_id=dispatch_order.id,
                item_id=item_objs["GNY-DTG-01"].id,
                quantity=Decimal("10.000"),
                scanned_quantity=Decimal("0.000"),
                unit_price=Decimal("380.00"),
            )
            session.add(d_item2)

        # Multi-Level Barcode Units (Pallet SSCC & Box Barcodes)
        # Pallet 1: 20 boxes of GNY-SBN-01 for Ege Kimya
        p1_code = "(00)186900000000001015"
        stmt = select(BarcodeUnit).where(BarcodeUnit.barcode_string == p1_code)
        res = await session.execute(stmt)
        if not res.scalar_one_or_none() and dealer_cari:
            pallet1 = BarcodeUnit(
                barcode_string=p1_code,
                type=BarcodeType.PALLET,
                item_id=item_objs["GNY-SBN-01"].id,
                quantity=Decimal("20.000"),
                status=BarcodeStatus.IN_STOCK,
                target_cari_id=dealer_cari.id,
            )
            session.add(pallet1)
            await session.flush()

            for i in range(1, 21):
                box = BarcodeUnit(
                    barcode_string=f"(01)8690000101015(21)KOLI-{i:03d}",
                    type=BarcodeType.BOX,
                    parent_pallet_id=pallet1.id,
                    item_id=item_objs["GNY-SBN-01"].id,
                    quantity=Decimal("1.000"),
                    status=BarcodeStatus.IN_STOCK,
                    target_cari_id=dealer_cari.id,
                )
                session.add(box)

        # Pallet 2: 20 boxes of GNY-SBN-01 for Ege Kimya
        p2_code = "(00)186900000000001022"
        stmt = select(BarcodeUnit).where(BarcodeUnit.barcode_string == p2_code)
        res = await session.execute(stmt)
        if not res.scalar_one_or_none() and dealer_cari:
            pallet2 = BarcodeUnit(
                barcode_string=p2_code,
                type=BarcodeType.PALLET,
                item_id=item_objs["GNY-SBN-01"].id,
                quantity=Decimal("20.000"),
                status=BarcodeStatus.IN_STOCK,
                target_cari_id=dealer_cari.id,
            )
            session.add(pallet2)
            await session.flush()

            for i in range(21, 41):
                box = BarcodeUnit(
                    barcode_string=f"(01)8690000101022(21)KOLI-{i:03d}",
                    type=BarcodeType.BOX,
                    parent_pallet_id=pallet2.id,
                    item_id=item_objs["GNY-SBN-01"].id,
                    quantity=Decimal("1.000"),
                    status=BarcodeStatus.IN_STOCK,
                    target_cari_id=dealer_cari.id,
                )
                session.add(box)

        # 10 Boxes of GNY-DTG-01 for Ege Kimya
        for i in range(1, 11):
            b_code = f"(01)8690000202015(21)BIDON-{i:03d}"
            stmt = select(BarcodeUnit).where(BarcodeUnit.barcode_string == b_code)
            res = await session.execute(stmt)
            if not res.scalar_one_or_none() and dealer_cari:
                bidon = BarcodeUnit(
                    barcode_string=b_code,
                    type=BarcodeType.BOX,
                    item_id=item_objs["GNY-DTG-01"].id,
                    quantity=Decimal("1.000"),
                    status=BarcodeStatus.IN_STOCK,
                    target_cari_id=dealer_cari.id,
                )
                session.add(bidon)

        # Pallet for DIFFERENT CLIENT (Akdeniz Kimya) -> tests mismatch error!
        p_wrong_client = "(00)186900000000009999"
        stmt = select(BarcodeUnit).where(BarcodeUnit.barcode_string == p_wrong_client)
        res = await session.execute(stmt)
        if not res.scalar_one_or_none() and other_dealer_cari:
            pallet_wrong = BarcodeUnit(
                barcode_string=p_wrong_client,
                type=BarcodeType.PALLET,
                item_id=item_objs["GNY-SBN-01"].id,
                quantity=Decimal("20.000"),
                status=BarcodeStatus.IN_STOCK,
                target_cari_id=other_dealer_cari.id,
            )
            session.add(pallet_wrong)

        # Pallet for WRONG PRODUCT (GNY-YZY-01 not in this order) -> tests product mismatch!
        p_wrong_prod = "(00)186900000000007777"
        stmt = select(BarcodeUnit).where(BarcodeUnit.barcode_string == p_wrong_prod)
        res = await session.execute(stmt)
        if not res.scalar_one_or_none() and dealer_cari:
            pallet_wrong_p = BarcodeUnit(
                barcode_string=p_wrong_prod,
                type=BarcodeType.PALLET,
                item_id=item_objs["GNY-YZY-01"].id,
                quantity=Decimal("20.000"),
                status=BarcodeStatus.IN_STOCK,
                target_cari_id=dealer_cari.id,
            )
            session.add(pallet_wrong_p)

        # 6. Initialize Barcode Sequence counters if missing
        seq_stmt = select(BarcodeSequence).where(BarcodeSequence.name == "SSCC_PALLET")
        res_seq = await session.execute(seq_stmt)
        if not res_seq.scalar_one_or_none():
            session.add(BarcodeSequence(name="SSCC_PALLET", current_value=1000))
            session.add(BarcodeSequence(name="BOX_GTIN", current_value=5000))

        await session.commit()
        print("Master data successfully seeded into Günay Kimya ERP database!")

if __name__ == "__main__":
    asyncio.run(seed_master_data())
