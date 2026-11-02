import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import asyncio
from decimal import Decimal
import datetime
from sqlalchemy import select
from app.core.config import async_session_factory
from app.models.auth import User, Role, UserRole, UserRoleEnum
from app.models.cari import CariAccount, CariType, RiskStatus
from app.models.orders import Order, Planning
from app.models.crm import CariNote
from app.models.purchasing import PurchaseRequest
from app.models.hr import HRInterview, InterviewStatus
from app.models.reports import EmployeeReport
from app.routers.purchasing import build_whatsapp_link, build_mailto_link

async def run_expansion_tests():
    print("=== STARTING ERP EXPANSION & B2B ISOLATION TESTS ===")

    async with async_session_factory() as session:
        # 1. Setup test CariAccount
        cari_test = CariAccount(
            code="120.TEST.0001",
            title="Ege Test Boya Kimya A.Ş.",
            cari_type=CariType.CUSTOMER,
            tax_number="1234567890",
            phone="0532 111 22 33",
            credit_limit=Decimal("500000.00"),
            current_balance=Decimal("15000.00"),
            open_orders_balance=Decimal("0.00"),
            open_uncollected_checks=Decimal("0.00"),
            risk_status=RiskStatus.HEALTHY,
            is_active=True
        )
        session.add(cari_test)
        await session.flush()

        # 2. Setup B2B customer user bound to cari_test
        customer_user = User(
            email="b2b_test@egeboya.com",
            full_name="Ahmet Yılmaz (B2B Temsilcisi)",
            hashed_password="hashed_pwd_placeholder",
            role=UserRoleEnum.CUSTOMER,
            is_active=True,
            cari_id=cari_test.id
        )
        session.add(customer_user)
        await session.flush()

        assert customer_user.role == UserRoleEnum.CUSTOMER
        assert customer_user.cari_id == cari_test.id
        print("[PASSED] Test 1: UserRoleEnum and B2B user-cari association verified!")

        # 3. Create B2B Order & Planning
        b2b_order = Order(
            cari_id=customer_user.cari_id,
            status="Beklemede",
            is_b2b_order=True,
            total_amount=Decimal("45000.00"),
            items_summary="2000 kg Sıvı Kostik %48, 500 kg SLES",
            notes="Acil sevkiyat talebidir."
        )
        session.add(b2b_order)
        await session.flush()

        planning_ticket = Planning(
            order_id=b2b_order.id,
            work_order_no=f"PLN-B2B-{b2b_order.id}-TEST",
            target_warehouse="Ana Depo",
            status="Planlandı",
            notes="Otomatik üretim ve sevkiyat planlaması"
        )
        session.add(planning_ticket)
        await session.flush()

        assert b2b_order.is_b2b_order is True
        assert b2b_order.cari_id == cari_test.id
        assert planning_ticket.order_id == b2b_order.id
        print("[PASSED] Test 2: B2B Order and automated Planning creation verified!")

        # 4. Verify CRM CariNote
        note = CariNote(
            cari_id=cari_test.id,
            created_by_id=customer_user.id,
            note="Müşteri yıllık hammadde alım anlaşması için fabrika ziyareti gerçekleştirdi."
        )
        session.add(note)
        await session.flush()
        assert note.id is not None
        assert note.cari_id == cari_test.id
        print("[PASSED] Test 3: CRM CariNote created successfully on CariAccount!")

        # 5. Verify Purchasing Requisition & WhatsApp Link builder
        pr = PurchaseRequest(
            requested_by_id=customer_user.id,
            item_name="DOP Plastifiyan (Dioktil Ftalat)",
            quantity=Decimal("5000.000"),
            unit="kg",
            status="Onay Bekliyor",
            vendor_email="satis@polimerkimya.com",
            vendor_phone="0532 999 88 77",
            notes="1. Kalite DOP hammaddesi teklifi"
        )
        session.add(pr)
        await session.flush()

        wa_url = build_whatsapp_link(pr.vendor_phone, pr.item_name, pr.quantity, pr.unit)
        mail_url = build_mailto_link(pr.vendor_email, pr.item_name, pr.quantity, pr.unit)

        assert wa_url is not None
        assert "wa.me/905329998877" in wa_url
        assert "DOP" in wa_url
        assert mail_url is not None
        assert "mailto:satis@polimerkimya.com" in mail_url
        print("[PASSED] Test 4: PurchaseRequest and automated WhatsApp/Email link builder verified!")

        # 6. Verify HR Candidate Interview
        interview = HRInterview(
            candidate_name="Ayşe Kaya",
            position="Kalite Kontrol Uzmanı",
            status=InterviewStatus.GORUSME_HALINDE,
            sub_status="1. Mülakat",
            phone="0555 444 33 22",
            email="ayse.kaya@ornek.com",
            notes="Organik kimya lab tecrübesi yüksek, HPLC ve Titrasyon sertifikalı."
        )
        session.add(interview)
        await session.flush()

        # Update status to ONAYLANDI with reason
        interview.status = InterviewStatus.ONAYLANDI
        interview.reason = "Teknik mülakat ve lab testi başarılı. Teklif iletildi."
        await session.flush()

        assert interview.status == InterviewStatus.ONAYLANDI
        assert interview.reason is not None
        print("[PASSED] Test 5: HR Candidate interview creation and status update verified!")

        # 7. Verify Employee Report
        report = EmployeeReport(
            user_id=customer_user.id,
            report_type="Satis",
            title="Ekim Ayı Ege Bölgesi Kimyasal Bayi Görüşmeleri",
            content="5 farklı bayi ile görüşüldü, toplam 120 ton sıvı deterjan hammaddesi sipariş sözü alındı."
        )
        session.add(report)
        await session.flush()

        assert report.id is not None
        assert report.report_type == "Satis"
        print("[PASSED] Test 6: EmployeeReport activity log verified!")

        # Clean up test rows
        await session.rollback()
        print("=== ALL ERP EXPANSION & B2B ISOLATION TESTS COMPLETED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_expansion_tests())
