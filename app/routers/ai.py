import unicodedata
import datetime
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_db
from app.core.security import get_current_user
from app.models.auth import User, UserRoleEnum
from app.models.cari import CariAccount
from app.models.inventory import Item, BatchLot, ItemCategory, DispatchOrder, DispatchStatus
from app.models.manufacturing import Recipe, ProductionOrder, ProductionStatus
from app.models.orders import Order, OrderItem
from app.models.production_alerts import UretimEmri
from app.models.proforma import ProformaQuote
from app.models.hr import HRPersonnel, HRLeave

router = APIRouter(prefix="/ai", tags=["AI Sanal Asistan"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


def _normalize(value: str) -> str:
    """Normalize Turkish characters and lower-case text for intent matching."""
    value = unicodedata.normalize("NFKD", value.lower())
    value = "".join(char for char in value if not unicodedata.combining(char))
    return (
        value.replace("ı", "i")
        .replace("ğ", "g")
        .replace("ü", "u")
        .replace("ş", "s")
        .replace("ö", "o")
        .replace("ç", "c")
        .strip()
    )


def _check_permission(user: User, module: str, departments: set[str]) -> bool:
    """Evaluate whether user has access to a specific corporate module."""
    if user.role == UserRoleEnum.ADMIN:
        return True
    
    dept_code = (
        getattr(user, "department_code", "") 
        or getattr(getattr(user, "department", None), "code", "") 
        or ""
    ).upper().strip()
    
    if dept_code in departments:
        return True

    user_roles_str = " ".join(
        getattr(r, "role_name", "") for r in (getattr(user, "roles", []) or [])
    ).lower()
    user_roles_str += " " + str(user.role.value if hasattr(user.role, "value") else user.role or "").lower()

    if any(d.lower() in user_roles_str for d in departments):
        return True

    try:
        return user.has_permission(module, "read")
    except Exception:
        return False


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Enterprise Copilot & Virtual Assistant for Günay Kimya ERP and B2B Portal.
    - Token authentication is strictly required.
    - Rule-based, high-accuracy query engine with zero API key leaks.
    - Strict authorization: B2B dealers see only their own data; staff see only authorized modules.
    """
    msg = payload.message.strip()
    q = _normalize(msg)
    user_role_str = str(getattr(current_user, "role", "")).lower()
    is_customer = "customer" in user_role_str or current_user.role == UserRoleEnum.CUSTOMER

    # =========================================================================
    # 1. B2B BAYİ YETKİ KONTROLÜ VE VERİ İZOLASYONU
    # =========================================================================
    if is_customer:
        # Check for forbidden topics strictly
        forbidden_keywords = [
            "hammadde", "stok", "recete", "maliyet", "formul", "bom", "personel",
            "calisan", "maas", "izin", "ik", "insan kaynaklari", "muhasebe",
            "diger cari", "baska musteri", "diger musteri", "kar", "fabrika", "reaktor"
        ]
        if any(w in q for w in forbidden_keywords):
            return {
                "answer": (
                    "Bu bilgiye yetkiniz yok. B2B Bayi olarak yalnızca kendi siparişleriniz, "
                    "sevkiyatlarınız, cari ekstreniz ve firmanıza özel teklifleri sorgulayabilirsiniz."
                )
            }

        if not current_user.cari_id:
            return {
                "answer": (
                    "Hesabınız ile eşleşen bir Cari Kart (CariAccount) bulunamadı. "
                    "Lütfen Günay Kimya müşteri temsilciniz ile iletişime geçiniz."
                )
            }

        # B2B Bayi: Cari Bakiye / Borç / Ekstre
        if any(w in q for w in ["bakiye", "borc", "alacak", "ekstre", "hesap"]):
            cari = await db.get(CariAccount, current_user.cari_id)
            if not cari:
                return {"answer": "Cari hesap bilgileriniz bulunamadı."}
            
            balance = float(cari.current_balance or Decimal("0.00"))
            open_orders = float(cari.open_orders_balance or Decimal("0.00"))
            bal_status = "borcunuz bulunmaktadır" if balance > 0 else ("alacağınız bulunmaktadır" if balance < 0 else "hesabınız bakiyesizdir")
            return {
                "answer": (
                    f"Sayın Bayimiz ({cari.title}), Cari Hesap Özetiniz:\n"
                    f"• Güncel Bakiye: {abs(balance):,.2f} TL ({bal_status}).\n"
                    f"• Açık Sipariş Tutarı: {open_orders:,.2f} TL.\n"
                    f"• Vade Koşulunuz: {cari.payment_term_days} gün."
                )
            }

        # B2B Bayi: Sevkiyat / İrsaliye Durumu
        if any(w in q for w in ["sevkiyat", "irsaliye", "kargo", "teslimat", "nerede", "sevk"]):
            stmt_disp = (
                select(DispatchOrder)
                .where(DispatchOrder.cari_id == current_user.cari_id)
                .order_by(desc(DispatchOrder.created_at))
                .limit(5)
            )
            dispatches = (await db.execute(stmt_disp)).scalars().all()
            if not dispatches:
                return {"answer": "Şu anda adınıza aktif veya geçmiş bir sevkiyat kaydı bulunmuyor."}

            lines = []
            for d in dispatches:
                st = d.status.value if hasattr(d.status, "value") else str(d.status)
                plate = d.vehicle_plate or "Filo Aracı"
                driver = d.driver_name or "Sevkiyat Sorumlusu"
                lines.append(f"• İrsaliye #{d.dispatch_number}: {st} (Araç: {plate}, Şoför: {driver})")

            return {"answer": "Güncel sevkiyat hareketleriniz:\n" + "\n".join(lines)}

        # B2B Bayi: Teklifler / Proforma
        if any(w in q for w in ["teklif", "proforma"]):
            stmt_prf = (
                select(ProformaQuote)
                .where(
                    and_(
                        ProformaQuote.cari_id == current_user.cari_id,
                        ProformaQuote.status.in_(["Gönderildi", "Kabul Edildi", "Reddedildi", "Siparişe Dönüştü"])
                    )
                )
                .order_by(desc(ProformaQuote.quote_date))
                .limit(5)
            )
            quotes = (await db.execute(stmt_prf)).scalars().all()
            if not quotes:
                return {"answer": "Firmanıza tanımlanmış aktif bir proforma teklif bulunmuyor."}

            lines = []
            for q_row in quotes:
                v_date = q_row.valid_until.strftime("%d.%m.%Y")
                lines.append(f"• Teklif #{q_row.quote_number}: {q_row.status} — {float(q_row.grand_total):,.2f} {q_row.currency} (Geçerlilik: {v_date})")

            return {"answer": "Firmanıza özel proforma teklifler:\n" + "\n".join(lines)}

        # B2B Bayi: Siparişler (Default / Intent)
        if any(w in q for w in ["siparis", "siparislerim", "siparisim", "durum"]) or True:
            stmt_ord = (
                select(Order)
                .where(Order.cari_id == current_user.cari_id)
                .order_by(desc(Order.order_date))
                .limit(5)
            )
            orders = (await db.execute(stmt_ord)).scalars().all()
            if not orders:
                return {"answer": "Kayıtlı bir siparişiniz bulunmamaktadır. B2B Sipariş ekranından yeni sipariş verebilirsiniz."}

            lines = []
            for o in orders:
                o_date = o.order_date.strftime("%d.%m.%Y")
                summary = o.items_summary or f"{float(o.total_amount):,.2f} TL"
                lines.append(f"• Sipariş #{o.id} ({o_date}): Durum: {o.status} — Tutar: {float(o.total_amount):,.2f} TL ({summary})")

            return {"answer": "Sayın bayimiz, sistemde kayıtlı son siparişlerinizin durumları:\n" + "\n".join(lines)}

    # =========================================================================
    # 2. ŞİRKET İÇİ YETKİ MATRİSİ KONTROLLERİ (STAFF / ADMIN)
    # =========================================================================
    is_admin = current_user.role == UserRoleEnum.ADMIN
    can_orders = is_admin or _check_permission(current_user, "orders", {"SATIS", "MUHASEBE", "YONETIM"})
    can_inventory = is_admin or _check_permission(current_user, "inventory_stock", {"DEPO", "URETIM", "SATINALMA", "YONETIM"})
    can_production = is_admin or _check_permission(current_user, "factory_dashboard", {"URETIM", "KALITE", "YONETIM"})
    can_finance = is_admin or _check_permission(current_user, "fin_accounts", {"MUHASEBE", "YONETIM"})
    can_hr = is_admin or _check_permission(current_user, "hr_personnel", {"IK", "YONETIM"})
    can_quotes = is_admin or _check_permission(current_user, "quotes", {"SATIS", "MUHASEBE", "YONETIM"})

    # --- Soru Tipi 1: "Hangi hammadde azaldı?" / "Kritik stoklar" / "Bitmek üzere olanlar" ---
    if any(w in q for w in ["hangi hammadde", "hammadde azaldi", "kritik stok", "azalan hammadde", "eksik hammadde", "hammadde", "bitmek uzere", "biten hammadde"]):
        if not can_inventory:
            return {"answer": "Bu bilgiye yetkiniz yok."}

        stmt_items = (
            select(Item)
            .options(selectinload(Item.batches))
            .where(and_(Item.is_active == True, Item.category == ItemCategory.RAW_MATERIAL))
            .limit(200)
        )
        raw_items = (await db.execute(stmt_items)).scalars().all()
        critical_list = []
        for it in raw_items:
            active_lots = [lot for lot in it.batches if lot.status not in ("Bloke", "Reddedildi", "Karantina")]
            physical = sum((lot.quantity or Decimal("0.000") for lot in active_lots), Decimal("0.000"))
            free = max(Decimal("0.000"), physical - (it.rezerv_miktar or Decimal("0.000")))
            min_st = it.min_stock if it.min_stock is not None else Decimal("10.000")
            if min_st > 0 and free <= min_st:
                critical_list.append(f"• {it.name} ({it.sku}): Mevcut Serbest: {float(free):,.2f} {it.unit} (Kritik Eşik: {float(min_st):,.2f})")

        if critical_list:
            return {
                "answer": f"Kritik seviyeye inen hammaddeler ({len(critical_list)} adet):\n" + "\n".join(critical_list[:8])
            }
        else:
            return {"answer": "Tüm kimyasal hammadde stokları yeterli seviyededir. Minimum stok eşiğinin altında hammadde bulunmamaktadır."}

    # --- Soru Tipi 2: "SKT'si yaklaşan partiler" / "Miadı dolan ürünler" ---
    if any(w in q for w in ["skt", "son kullanma", "miat", "miadi", "son kullanma tarihi", "partiler"]):
        if not (can_inventory or can_production):
            return {"answer": "Bu bilgiye yetkiniz yok."}

        today = datetime.date.today()
        sixty_days = today + datetime.timedelta(days=60)
        stmt_lots = (
            select(BatchLot)
            .options(selectinload(BatchLot.item))
            .where(
                and_(
                    BatchLot.expiration_date != None,
                    BatchLot.expiration_date <= sixty_days,
                    BatchLot.quantity > Decimal("0.000"),
                    BatchLot.status == "Serbest"
                )
            )
            .order_by(BatchLot.expiration_date.asc())
            .limit(8)
        )
        expiring_lots = (await db.execute(stmt_lots)).scalars().all()
        if not expiring_lots:
            return {"answer": "Önümüzdeki 60 gün içerisinde miadı dolacak herhangi bir onaylı parti/lot bulunmamaktadır."}

        lines = []
        for lot in expiring_lots:
            days_left = (lot.expiration_date - today).days
            item_name = lot.item.name if lot.item else f"SKU #{lot.item_id}"
            lines.append(f"• Lot: {lot.batch_number} ({item_name}) — Miktar: {float(lot.quantity):,.2f} {getattr(lot.item, 'unit', 'kg')}, SKT: {lot.expiration_date.strftime('%d.%m.%Y')} ({days_left} gün kaldı)")

        return {"answer": "Son kullanma tarihi (SKT) yaklaşan partiler:\n" + "\n".join(lines)}

    # --- Soru Tipi 3: "Bekleyen siparişlerim" / "Sipariş durumum" / "Açık siparişler" ---
    if any(w in q for w in ["bekleyen siparis", "siparis durum", "acik siparis", "siparis"]):
        if not can_orders:
            return {"answer": "Bu bilgiye yetkiniz yok."}

        stmt_pending = (
            select(Order)
            .options(selectinload(Order.cari))
            .where(Order.status.not_in(["Tamamlandı", "İptal"]))
            .order_by(desc(Order.order_date))
            .limit(6)
        )
        orders = (await db.execute(stmt_pending)).scalars().all()
        total_open = await db.scalar(
            select(func.count(Order.id)).where(Order.status.not_in(["Tamamlandı", "İptal"]))
        ) or 0

        if not orders:
            return {"answer": "Şu anda bekleyen veya açık durumda bir satış siparişi bulunmamaktadır."}

        lines = []
        for o in orders:
            cari_name = o.cari.title if o.cari else f"Cari #{o.cari_id}"
            lines.append(f"• Sipariş #{o.id} — {cari_name}: {o.status} ({float(o.total_amount):,.2f} TL)")

        return {
            "answer": f"Toplam {total_open} adet açık sipariş bulunmaktadır. Son siparişler:\n" + "\n".join(lines)
        }

    # --- Soru Tipi 4: "Acil üretim emirleri" / "Reaktör / İş emirleri" ---
    if any(w in q for w in ["uretim emri", "is emri", "reaktor", "eksik stok", "uretim", "recete", "formul", "maliyet", "acil uretim", "acil"]):
        if not can_production:
            return {"answer": "Bu bilgiye yetkiniz yok."}

        if any(w in q for w in ["recete", "formul", "maliyet"]):
            recipes = (await db.execute(select(Recipe).options(selectinload(Recipe.output_item)).limit(10))).scalars().all()
            if not recipes:
                return {"answer": "Sistemde kayıtlı reçete formülü bulunmamaktadır."}
            r_list = [f"• {r.name} (Mamul: {r.output_item.name if r.output_item else '-'})" for r in recipes]
            return {"answer": "Kayıtlı reçete formülleri:\n" + "\n".join(r_list)}

        stmt_ue = (
            select(UretimEmri, Item.name)
            .join(Item, Item.id == UretimEmri.item_id)
            .where(UretimEmri.status.in_(["Beklemede - Sipariş Tetikli", "İşleme Alındı"]))
            .order_by(desc(UretimEmri.created_at))
            .limit(6)
        )
        work_orders = (await db.execute(stmt_ue)).all()
        if not work_orders:
            return {"answer": "Şu anda bekleyen sipariş tetikli acil üretim iş emri bulunmamaktadır."}

        lines = [f"• Sipariş #{ue.order_id} için {name}: {float(ue.shortage_quantity):,.2f} eksik ({ue.status})" for ue, name in work_orders]
        return {"answer": "Sipariş tetikli acil üretim iş emirleri:\n" + "\n".join(lines)}

    # --- Soru Tipi 5: "Teklifler" / "Proforma" ---
    if any(w in q for w in ["teklif", "proforma"]):
        if not can_quotes:
            return {"answer": "Bu bilgiye yetkiniz yok."}

        stmt_quotes = (
            select(ProformaQuote)
            .options(selectinload(ProformaQuote.cari))
            .where(ProformaQuote.status.in_(["Onay Bekliyor", "Gönderildi", "Taslak"]))
            .order_by(desc(ProformaQuote.id))
            .limit(5)
        )
        quotes = (await db.execute(stmt_quotes)).scalars().all()
        if not quotes:
            return {"answer": "Şu anda işlem bekleyen açık bir proforma teklif bulunmamaktadır."}

        lines = [f"• Teklif #{q.quote_number} ({q.cari.title if q.cari else '-'}): {q.status} — {float(q.grand_total):,.2f} {q.currency}" for q in quotes]
        return {"answer": "Açık ve onay bekleyen proforma teklifler:\n" + "\n".join(lines)}

    # --- Soru Tipi 6: "Personel" / "İK" / "İzinler" ---
    if any(w in q for w in ["personel", "calisan", "izin", "ik", "insan kaynaklari"]):
        if not can_hr:
            return {"answer": "Bu bilgiye yetkiniz yok."}

        active_count = await db.scalar(select(func.count(HRPersonnel.id)).where(HRPersonnel.status == "Aktif")) or 0
        pending_leaves = await db.scalar(select(func.count(HRLeave.id)).where(HRLeave.status == "Talep Edildi")) or 0
        return {
            "answer": f"Günay Kimya İK Özeti:\n• Aktif Çalışan Personel: {active_count}\n• Onay Bekleyen İzin Talebi: {pending_leaves}"
        }

    # --- Soru Tipi 7: "Cari Risk / Finans" ---
    if any(w in q for w in ["bakiye", "finans", "borc", "alacak", "muhasebe", "risk"]):
        if not can_finance:
            return {"answer": "Bu bilgiye yetkiniz yok."}

        total_receivable = await db.scalar(select(func.sum(CariAccount.current_balance)).where(CariAccount.current_balance > 0)) or Decimal("0.00")
        total_payable = await db.scalar(select(func.sum(CariAccount.current_balance)).where(CariAccount.current_balance < 0)) or Decimal("0.00")
        return {
            "answer": (
                f"Günay Kimya Finansal Bakiye Özeti:\n"
                f"• Toplam Müşteri Alacakları: {float(total_receivable):,.2f} TL\n"
                f"• Toplam Tedarikçi Borçları: {abs(float(total_payable)):,.2f} TL"
            )
        }

    # --- Soru Tipi 8: Selamlama / Yardım / Genel ---
    if any(w in q for w in ["merhaba", "selam", "yardim", "neler yapabilirsin", "kimsin", "gunaydin", "iyi gunler"]):
        allowed_topics = []
        if can_inventory:
            allowed_topics.append("Hangi hammadde azaldı?, SKT'si yaklaşan partiler")
        if can_orders:
            allowed_topics.append("Bekleyen siparişlerim, Sipariş durumları")
        if can_production:
            allowed_topics.append("Acil üretim emirleri, Reçeteler")
        if can_quotes:
            allowed_topics.append("Açık teklifler")
        if can_finance:
            allowed_topics.append("Cari finansal bakiye özeti")
        if can_hr:
            allowed_topics.append("Personel ve izin durumu")

        topics_str = "\n• " + "\n• ".join(allowed_topics) if allowed_topics else "\n• Yetkiniz dahilindeki modüller"
        return {
            "answer": (
                f"Merhaba! Ben Günay Kimya ERP Yapay Zeka Sanal Asistanı'yım. "
                f"Yetkilerinize göre şu konularda canlı verilerle yardımcı olabilirim:{topics_str}\n"
                f"Lütfen öğrenmek istediğiniz konuyu yazınız."
            )
        }

    # Default fallback
    return {
        "answer": (
            "Sorunuzu tam olarak anlayamadım. Örnek olarak 'Bekleyen siparişlerim', "
            "'Hangi hammadde azaldı?', 'SKT'si yaklaşan partiler' veya 'Sipariş durumum' gibi sorular sorabilirsiniz."
        )
    }
