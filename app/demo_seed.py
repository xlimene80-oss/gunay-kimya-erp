import os
import logging
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy import select
from app.core.config import async_session_factory
from app.core.security import get_password_hash
from app.models.auth import User, Role, UserRole, Department, get_default_department_permissions
from app.models.cari import CariAccount, CariType
from app.models.orders import Order
from app.models.manufacturing import ProductionOrder, Recipe, ProductionStatus
from app.models.purchasing import PurchaseRequest
from app.models.hr import HRInterview, HRPersonnel, HRLeave, HRAttendance, HRMovement, InterviewStatus

logger = logging.getLogger("demo_seed")

DEMO_PASSWORD = "Gunay2026!"

DEPARTMENTS_CONFIG = [
    {"code": "YONETIM", "name": "Yönetim", "desc": "Şirket Yönetimi ve Genel Müdürlük"},
    {"code": "SATIS", "name": "Satış", "desc": "Yurtiçi ve B2B Bayi Satış Operasyonları"},
    {"code": "SATINALMA", "name": "Satın Alma", "desc": "Hammadde ve Ambalaj Tedarik"},
    {"code": "URETIM", "name": "Üretim", "desc": "Fabrika ve Kimyasal Üretim Sahası"},
    {"code": "DEPO", "name": "Depo", "desc": "Hammadde, Mamul ve Lojistik Deposu"},
    {"code": "MUHASEBE", "name": "Muhasebe", "desc": "Mali İşler, Finans ve Fatura Yönetimi"},
    {"code": "IK", "name": "İK", "desc": "İnsan Kaynakları, Personel ve Puantaj"},
    {"code": "KALITE", "name": "Kalite", "desc": "Kalite Kontrol, Analiz ve Ar-Ge Laboratuvarı"}
]

USERS_CONFIG = [
    {
        "email": "admin@gunaykimya.com",
        "full_name": "Kemal Günay",
        "role_str": "staff",
        "role_name": "ADMIN",
        "dept_code": "YONETIM",
        "user_code": "ADM-0001",
        "cari_name": None
    },
    {
        "email": "satis@gunaykimya.com",
        "full_name": "Ayşe Satış",
        "role_str": "staff",
        "role_name": "SATIS",
        "dept_code": "SATIS",
        "user_code": "SAT-0001",
        "cari_name": None
    },
    {
        "email": "satinalma@gunaykimya.com",
        "full_name": "Mehmet Satın Alma",
        "role_str": "staff",
        "role_name": "SATINALMA",
        "dept_code": "SATINALMA",
        "user_code": "ALM-0001",
        "cari_name": None
    },
    {
        "email": "uretim@gunaykimya.com",
        "full_name": "Ali Üretim",
        "role_str": "staff",
        "role_name": "OPERATOR",
        "dept_code": "URETIM",
        "user_code": "URT-0001",
        "cari_name": None
    },
    {
        "email": "depo@gunaykimya.com",
        "full_name": "Ahmet Depo",
        "role_str": "staff",
        "role_name": "OPERATOR",
        "dept_code": "DEPO",
        "user_code": "DEP-0001",
        "cari_name": None
    },
    {
        "email": "muhasebe@gunaykimya.com",
        "full_name": "Selin Finans",
        "role_str": "staff",
        "role_name": "MUHASEBE",
        "dept_code": "MUHASEBE",
        "user_code": "MUH-0001",
        "cari_name": None
    },
    {
        "email": "ik@gunaykimya.com",
        "full_name": "Zeynep İK",
        "role_str": "staff",
        "role_name": "STAFF",
        "dept_code": "IK",
        "user_code": "IK-0001",
        "cari_name": None
    },
    {
        "email": "bayi@egekimya.com",
        "full_name": "Ege Kimya Bayi Temsilcisi",
        "role_str": "customer",
        "role_name": "CUSTOMER",
        "dept_code": None,
        "user_code": "B2B-0001",
        "cari_name": "Ege Kimya Dağıtım ve Pazarlama A.Ş."
    }
]

async def seed_demo_simulation_data():
    """
    Idempotent demo seeder that sets up all demo users, departments, caris,
    isolated orders, manual production/purchasing orders, and full HR records.
    """
    logger.info("[DEMO SEED] Starting demo simulation data seeding...")
    print("[DEMO SEED] Starting demo simulation data seeding...")

    async with async_session_factory() as session:
        # 1. Seed / Verify Roles
        existing_roles = (await session.scalars(select(Role))).all()
        role_map = {r.role_name.upper(): r for r in existing_roles}
        for r_name in ["ADMIN", "STAFF", "CUSTOMER", "OPERATOR", "MUHASEBE", "SATIS", "SATINALMA"]:
            if r_name not in role_map:
                new_role = Role(role_name=r_name, description=f"{r_name} Sistem Rolü")
                session.add(new_role)
                await session.flush()
                role_map[r_name] = new_role

        # 2. Seed / Verify Departments
        existing_depts = (await session.scalars(select(Department))).all()
        dept_map = {d.code.upper(): d for d in existing_depts}
        for d_info in DEPARTMENTS_CONFIG:
            code_up = d_info["code"].upper()
            if code_up not in dept_map:
                new_dept = Department(
                    name=d_info["name"],
                    code=code_up,
                    description=d_info["desc"],
                    is_active=True,
                    permissions=get_default_department_permissions(code_up)
                )
                session.add(new_dept)
                await session.flush()
                dept_map[code_up] = new_dept

        # 3. Seed / Verify Cari Accounts
        existing_caris = (await session.scalars(select(CariAccount))).all()
        cari_map = {c.title: c for c in existing_caris}
        
        caris_data = [
            {
                "title": "Ege Kimya Dağıtım ve Pazarlama A.Ş.",
                "code": "CK-EGE-001",
                "cari_type": CariType.CUSTOMER,
                "tax_number": "3840291823",
                "tax_office": "Konak VD",
                "contact_person": "Ahmet Ege",
                "phone": "+90 232 444 01 02",
                "email": "bayi@egekimya.com",
                "address": "Atatürk Organize Sanayi Bölgesi 10002 Sk. No:14 Çiğli / İzmir",
                "current_balance": Decimal("145000.00"),
                "credit_limit": Decimal("500000.00")
            },
            {
                "title": "Marmara Boya Sanayi A.Ş.",
                "code": "CK-MRM-002",
                "cari_type": CariType.CUSTOMER,
                "tax_number": "5920381920",
                "tax_office": "Tuzla VD",
                "contact_person": "Burak Marmara",
                "phone": "+90 216 555 12 34",
                "email": "info@marmaraboya.com",
                "address": "Deri Organize Sanayi Yan Sanayi Alanı No:8 Tuzla / İstanbul",
                "current_balance": Decimal("320000.00"),
                "credit_limit": Decimal("750000.00")
            },
            {
                "title": "Akdeniz Kimya Tedarik Ltd.",
                "code": "TK-AKD-001",
                "cari_type": CariType.SUPPLIER,
                "tax_number": "1029384756",
                "tax_office": "Akdeniz VD",
                "contact_person": "Mustafa Akdeniz",
                "phone": "+90 324 333 55 66",
                "email": "siparis@akdenizkimya.com",
                "address": "Mersin Serbest Bölge Cad. No:22 Akdeniz / Mersin",
                "current_balance": Decimal("0.00"),
                "credit_limit": Decimal("1000000.00")
            }
        ]

        for c_data in caris_data:
            if c_data["title"] not in cari_map:
                new_c = CariAccount(**c_data)
                session.add(new_c)
                await session.flush()
                cari_map[new_c.title] = new_c

        # 4. Seed / Verify Demo Users
        existing_users = (await session.scalars(select(User))).all()
        user_by_email = {u.email.lower(): u for u in existing_users}

        pw_hash = get_password_hash(DEMO_PASSWORD)

        for u_cfg in USERS_CONFIG:
            u_email = u_cfg["email"].lower()
            u_cari = cari_map.get(u_cfg["cari_name"]) if u_cfg["cari_name"] else None
            u_dept = dept_map.get(u_cfg["dept_code"]) if u_cfg["dept_code"] else None
            
            if u_email not in user_by_email:
                new_user = User(
                    email=u_email,
                    hashed_password=pw_hash,
                    full_name=u_cfg["full_name"],
                    role=u_cfg["role_str"],
                    is_active=True,
                    user_code=u_cfg["user_code"],
                    department_id=u_dept.id if u_dept else None,
                    cari_id=u_cari.id if u_cari else None,
                    permissions=u_dept.permissions if u_dept else {}
                )
                session.add(new_user)
                await session.flush()
                user_by_email[u_email] = new_user

                # User Role assignment
                r_obj = role_map.get(u_cfg["role_name"], role_map["STAFF"])
                ur = UserRole(user_id=new_user.id, role_id=r_obj.id)
                session.add(ur)
            else:
                # Update user fields to guarantee credentials & linkages match demo specs
                usr = user_by_email[u_email]
                usr.hashed_password = pw_hash
                usr.full_name = u_cfg["full_name"]
                usr.role = u_cfg["role_str"]
                usr.user_code = u_cfg["user_code"]
                if u_dept:
                    usr.department_id = u_dept.id
                    usr.permissions = u_dept.permissions
                if u_cari:
                    usr.cari_id = u_cari.id

        await session.flush()

        # 5. Seed Orders (B2B Ege Kimya isolation + Marmara Boya)
        ege_cari = cari_map["Ege Kimya Dağıtım ve Pazarlama A.Ş."]
        marmara_cari = cari_map["Marmara Boya Sanayi A.Ş."]

        existing_orders = (await session.scalars(select(Order))).all()
        if len(existing_orders) < 5:
            now = datetime.now()
            # Ege Kimya orders (B2B customer will see these 3)
            ege_orders = [
                Order(
                    cari_id=ege_cari.id,
                    order_date=now - timedelta(days=5),
                    status="Teslim Edildi",
                    is_b2b_order=True,
                    total_amount=Decimal("48500.00"),
                    items_summary="2000L Endüstriyel Yağ Çözücü IBC, 500kg Sıvı Kostik",
                    notes="Ege Bölgesi Sevkiyatı - Başarıyla teslim edildi."
                ),
                Order(
                    cari_id=ege_cari.id,
                    order_date=now - timedelta(days=2),
                    status="Hazırlanıyor",
                    is_b2b_order=True,
                    total_amount=Decimal("36200.00"),
                    items_summary="1500L Asit Nötralizasyon Solüsyonu",
                    notes="Üretim tamamlandı, kalite onayı ve paketleme bekleniyor."
                ),
                Order(
                    cari_id=ege_cari.id,
                    order_date=now,
                    status="Onaylandı",
                    is_b2b_order=True,
                    total_amount=Decimal("60300.00"),
                    items_summary="3000L Köpüksüz Zemin Temizleyici Konsantre",
                    notes="Portal üzerinden B2B siparişi oluşturuldu."
                )
            ]
            # Marmara Boya orders (B2B customer MUST NEVER see these)
            marmara_orders = [
                Order(
                    cari_id=marmara_cari.id,
                    order_date=now - timedelta(days=4),
                    status="Hazırlanıyor",
                    is_b2b_order=False,
                    total_amount=Decimal("120000.00"),
                    items_summary="5000kg Epoksi Reçine Çözücü",
                    notes="Tuzla fabrika teslimi."
                ),
                Order(
                    cari_id=marmara_cari.id,
                    order_date=now - timedelta(days=1),
                    status="Onay Bekliyor",
                    is_b2b_order=False,
                    total_amount=Decimal("85000.00"),
                    items_summary="3500kg Poliüretan İnceltici",
                    notes="Özel üretim talebi."
                )
            ]
            for o in ege_orders + marmara_orders:
                session.add(o)
            await session.flush()

        # 6. Seed Recipe & 2 Manuel Production Orders
        recipes = (await session.scalars(select(Recipe))).all()
        target_recipe = recipes[0] if recipes else None
        if not target_recipe:
            target_recipe = Recipe(
                code="REC-IND-001",
                name="Endüstriyel Konsantre Yüzey Temizleyici",
                standard_batch_size=Decimal("1000.0"),
                batch_unit="L",
                notes="Standart reaktör karışım reçetesi"
            )
            session.add(target_recipe)
            await session.flush()

        prod_orders = (await session.scalars(select(ProductionOrder))).all()
        manual_prod = [p for p in prod_orders if getattr(p, "is_manual", False)]
        if len(manual_prod) < 2:
            now = datetime.now()
            p1 = ProductionOrder(
                order_number="PO-MAN-2026-001",
                recipe_id=target_recipe.id,
                target_quantity=Decimal("2500.0"),
                status=ProductionStatus.IN_PROGRESS,
                phase="Karıştırma",
                reactor_name="Reaktör A-1",
                is_manual=True,
                cari_id=ege_cari.id,
                delivery_date=now + timedelta(days=3),
                notes="Müşteri acil teslimat talepli manuel üretim emri."
            )
            p2 = ProductionOrder(
                order_number="PO-MAN-2026-002",
                recipe_id=target_recipe.id,
                target_quantity=Decimal("1000.0"),
                status=ProductionStatus.PENDING,
                phase="Hammadde Tartım",
                reactor_name="Reaktör B-2",
                is_manual=True,
                cari_id=marmara_cari.id,
                delivery_date=now + timedelta(days=6),
                notes="Hammadde tedariği sonrası üretime alınacak."
            )
            session.add(p1)
            session.add(p2)
            await session.flush()

        # 7. Seed 2 Manuel Purchase Requests / Orders
        purchases = (await session.scalars(select(PurchaseRequest))).all()
        manual_purchases = [pr for pr in purchases if getattr(pr, "is_manual", False)]
        if len(manual_purchases) < 2:
            admin_user = user_by_email["admin@gunaykimya.com"]
            now = datetime.now()
            pr1 = PurchaseRequest(
                requested_by_id=admin_user.id,
                item_name="Sodyum Hidroksit (Kostik) %48 Sıvı",
                quantity=Decimal("5000.0"),
                unit="KG",
                status="Sipariş Verildi",
                supplier_name="Akdeniz Kimya Tedarik Ltd.",
                unit_price=Decimal("18.50"),
                delivery_date=now + timedelta(days=4),
                is_manual=True,
                vendor_email="siparis@akdenizkimya.com",
                vendor_phone="+90 324 333 55 66",
                notes="Reaktör A serisi için hammadde tedarik siparişi."
            )
            pr2 = PurchaseRequest(
                requested_by_id=admin_user.id,
                item_name="Lineer Alkil Benzen Sülfonik Asit (LABSA)",
                quantity=Decimal("3000.0"),
                unit="KG",
                status="Mal Kabul Bekliyor",
                supplier_name="Akdeniz Kimya Tedarik Ltd.",
                unit_price=Decimal("42.00"),
                delivery_date=now + timedelta(days=1),
                is_manual=True,
                vendor_email="siparis@akdenizkimya.com",
                vendor_phone="+90 324 333 55 66",
                notes="İrsaliye yolda, kantar ve QC numune kabulü bekleniyor."
            )
            session.add(pr1)
            session.add(pr2)
            await session.flush()

        # 8. Seed HR Data (Interviews, Personnel, Leaves, Attendance, Movements)
        # 8a. HR Interviews
        interviews = (await session.scalars(select(HRInterview))).all()
        if len(interviews) < 5:
            iv_data = [
                {
                    "candidate_name": "Burak Demir",
                    "position": "Kimya Mühendisi",
                    "sub_status": "Teklif Aşaması",
                    "department": "URETIM",
                    "phone": "+90 532 111 2233",
                    "email": "burak.demir@example.com",
                    "notes": "Teknik mülakat başarılı. Üretim süreci tecrübesi yüksek.",
                    "status": InterviewStatus.GORUSME_HALINDE
                },
                {
                    "candidate_name": "Merve Yıldız",
                    "position": "B2B Satış Temsilcisi",
                    "sub_status": "1. Mülakat",
                    "department": "SATIS",
                    "phone": "+90 533 222 3344",
                    "email": "merve.yildiz@example.com",
                    "notes": "Kimyasal hammadde satışında 3 yıl deneyim.",
                    "status": InterviewStatus.GORUSME_HALINDE
                },
                {
                    "candidate_name": "Deniz Aydın",
                    "position": "Kalite Kontrol Kimyageri",
                    "sub_status": "İşe Alım Onayı",
                    "department": "KALITE",
                    "phone": "+90 535 333 4455",
                    "email": "deniz.aydin@example.com",
                    "notes": "HPLC ve GC analiz tecrübesi var. İşe alım onaylandı.",
                    "status": InterviewStatus.ONAYLANDI
                },
                {
                    "candidate_name": "Serkan Kaya",
                    "position": "Forklift ve Depo Operatörü",
                    "sub_status": "Ön Eleme",
                    "department": "DEPO",
                    "phone": "+90 536 444 5566",
                    "email": "serkan.kaya@example.com",
                    "notes": "G sınıfı ehliyet tecrübesi yetersiz bulundu.",
                    "status": InterviewStatus.REDDEDILDI
                },
                {
                    "candidate_name": "Cansu Koç",
                    "position": "Maliyet Muhasebesi Uzmanı",
                    "sub_status": "Teknik Mülakat",
                    "department": "MUHASEBE",
                    "phone": "+90 537 555 6677",
                    "email": "cansu.koc@example.com",
                    "notes": "İstenen ERP deneyimi uyuşmadı.",
                    "status": InterviewStatus.REDDEDILDI
                }
            ]
            for iv in iv_data:
                session.add(HRInterview(**iv))
            await session.flush()

        # 8b. HR Personnel (8 persons)
        personnel_list = (await session.scalars(select(HRPersonnel))).all()
        personnel_by_code = {p.registration_no: p for p in personnel_list}
        
        personnel_data = [
            ("GK-001", "Kemal Günay", "YONETIM", "Genel Müdür", date(2020, 1, 1), "admin@gunaykimya.com"),
            ("GK-002", "Ayşe Yılmaz", "SATIS", "Satış Müdürü", date(2021, 3, 15), "satis@gunaykimya.com"),
            ("GK-003", "Mehmet Öztürk", "SATINALMA", "Satın Alma Sorumlusu", date(2021, 6, 1), "satinalma@gunaykimya.com"),
            ("GK-004", "Ali Çelik", "URETIM", "Üretim Şefi", date(2022, 2, 10), "uretim@gunaykimya.com"),
            ("GK-005", "Ahmet Can", "DEPO", "Depo ve Lojistik Amiri", date(2022, 5, 20), "depo@gunaykimya.com"),
            ("GK-006", "Selin Aksoy", "MUHASEBE", "Finans ve Muhasebe Uzmanı", date(2023, 1, 15), "muhasebe@gunaykimya.com"),
            ("GK-007", "Zeynep Er", "IK", "İnsan Kaynakları Uzmanı", date(2023, 4, 1), "ik@gunaykimya.com"),
            ("GK-008", "Deniz Aydın", "KALITE", "Kalite Kontrol Kimyageri", date(2024, 2, 1), None)
        ]

        for reg_no, full_name, dept_code, title, hire_dt, u_email in personnel_data:
            if reg_no not in personnel_by_code:
                u_obj = user_by_email.get(u_email) if u_email else None
                pers = HRPersonnel(
                    registration_no=reg_no,
                    full_name=full_name,
                    department=dept_code,
                    title=title,
                    hire_date=hire_dt,
                    status="Aktif",
                    email=u_email if u_email else f"{reg_no.lower()}@gunaykimya.com",
                    phone="+90 232 444 01 00",
                    user_id=u_obj.id if u_obj else None
                )
                session.add(pers)
                await session.flush()
                personnel_by_code[reg_no] = pers

        # 8c. HR Leaves
        leaves = (await session.scalars(select(HRLeave))).all()
        if len(leaves) < 3:
            today = date.today()
            mehmet = personnel_by_code.get("GK-003")
            ali = personnel_by_code.get("GK-004")
            selin = personnel_by_code.get("GK-006")

            leave_records = [
                HRLeave(
                    personnel_id=mehmet.id,
                    personnel_name=mehmet.full_name,
                    department=mehmet.department,
                    leave_type="Yıllık İzin",
                    start_date=today - timedelta(days=2),
                    end_date=today + timedelta(days=1),
                    days_count=3,
                    notes="Yıllık planlı izin",
                    status="Onaylandı",
                    approved_by="Zeynep Er"
                ),
                HRLeave(
                    personnel_id=ali.id,
                    personnel_name=ali.full_name,
                    department=ali.department,
                    leave_type="Mazeret İzni",
                    start_date=today + timedelta(days=5),
                    end_date=today + timedelta(days=5),
                    days_count=1,
                    notes="Ailevi mazeret",
                    status="Onaylandı",
                    approved_by="Zeynep Er"
                ),
                HRLeave(
                    personnel_id=selin.id,
                    personnel_name=selin.full_name,
                    department=selin.department,
                    leave_type="Yıllık İzin",
                    start_date=today + timedelta(days=10),
                    end_date=today + timedelta(days=15),
                    days_count=5,
                    notes="Yaz tatili izni",
                    status="Talep Edildi"
                )
            ]
            for lv in leave_records:
                session.add(lv)
            await session.flush()

        # 8d. HR Attendance
        attendances = (await session.scalars(select(HRAttendance))).all()
        if len(attendances) < 10:
            today = date.today()
            for i, (reg, p) in enumerate(personnel_by_code.items()):
                att_status = "Geldi"
                if reg == "GK-003":  # Mehmet on leave
                    att_status = "İzinli"
                
                att1 = HRAttendance(
                    personnel_id=p.id,
                    personnel_name=p.full_name,
                    department=p.department,
                    date=today - timedelta(days=1),
                    check_in="08:00" if att_status == "Geldi" else None,
                    check_out="17:30" if att_status == "Geldi" else None,
                    overtime_hours=0.5 if i % 2 == 0 and att_status == "Geldi" else 0.0,
                    status=att_status,
                    notes="Günlük mesai kart okutma" if att_status == "Geldi" else "İzin kaydı mevcut"
                )
                att2 = HRAttendance(
                    personnel_id=p.id,
                    personnel_name=p.full_name,
                    department=p.department,
                    date=today,
                    check_in="07:55" if att_status == "Geldi" else None,
                    check_out="17:00" if att_status == "Geldi" else None,
                    overtime_hours=0.0,
                    status=att_status,
                    notes="Sistem otomatik giriş"
                )
                session.add(att1)
                session.add(att2)
            await session.flush()

        # 8e. HR Movements (3 movements)
        movements = (await session.scalars(select(HRMovement))).all()
        if len(movements) < 3:
            p_deniz = personnel_by_code.get("GK-008")
            p_ali = personnel_by_code.get("GK-004")
            p_ayse = personnel_by_code.get("GK-002")
            today = date.today()

            movs = [
                HRMovement(
                    personnel_id=p_deniz.id,
                    personnel_name=p_deniz.full_name,
                    department=p_deniz.department,
                    movement_type="İşe Giriş",
                    movement_date=today - timedelta(days=30),
                    old_value="Aday Havuzu",
                    new_value="Kalite Kontrol Kimyageri (KALITE)",
                    notes="Aday mülakat onayı sonrası Kalite Departmanı kadrosuna işe giriş tamamlandı.",
                    created_by="Zeynep Er"
                ),
                HRMovement(
                    personnel_id=p_ali.id,
                    personnel_name=p_ali.full_name,
                    department=p_ali.department,
                    movement_type="Terfi",
                    movement_date=today - timedelta(days=90),
                    old_value="Kıdemli Üretim Operatörü",
                    new_value="Üretim Şefi",
                    notes="Yüksek performans ve reaktör yönetimi başarısı sebebiyle terfi ettirildi.",
                    created_by="Kemal Günay"
                ),
                HRMovement(
                    personnel_id=p_ayse.id,
                    personnel_name=p_ayse.full_name,
                    department=p_ayse.department,
                    movement_type="Unvan Değişikliği",
                    movement_date=today - timedelta(days=180),
                    old_value="Bölge Satış Sorumlusu",
                    new_value="Satış Müdürü",
                    notes="Yurtiçi ve B2B bayi ağı genişletme hedefleri doğrultusunda terfi gerçekleşti.",
                    created_by="Kemal Günay"
                )
            ]
            for m in movs:
                session.add(m)
            await session.flush()

        await session.commit()
        logger.info("[DEMO SEED SUCCESS] All demo simulation data successfully verified/seeded.")
        print("[DEMO SEED SUCCESS] All demo simulation data successfully verified/seeded.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_demo_simulation_data())
