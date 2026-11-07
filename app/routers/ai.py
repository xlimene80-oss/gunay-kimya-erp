import unicodedata
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_db
from app.core.security import get_current_user
from app.models.auth import User, UserRoleEnum
from app.models.hr import HRLeave, HRPersonnel
from app.models.inventory import BatchLot, Item, ItemCategory
from app.models.manufacturing import Recipe
from app.models.orders import Order
from app.models.production_alerts import UretimEmri

router = APIRouter(prefix="/ai", tags=["AI Decision Support"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


def _normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.lower())
    value = "".join(char for char in value if not unicodedata.combining(char))
    return value.replace("ı", "i")


def _access(user: User, module: str, departments: set[str], role_words: set[str]) -> bool:
    if user.role == UserRoleEnum.ADMIN:
        return True
    department = getattr(user, "department", None)
    department_code = str(getattr(department, "code", "")).upper()
    role_names = " ".join(str(getattr(role, "role_name", "")) for role in (user.roles or []))
    role_names += " " + str(user.role.value if user.role else "")
    normalized_roles = _normalize(role_names.replace("_", " "))
    normalized_words = {_normalize(word.replace("_", " ")) for word in role_words}
    role_tokens = set(normalized_roles.split())
    if department_code in departments or any(
        word in normalized_roles if " " in word else word in role_tokens
        for word in normalized_words
    ):
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
    """Small deterministic ERP copilot; every answer is scoped to the caller's role."""
    question = _normalize(payload.message)
    is_customer = current_user.role == UserRoleEnum.CUSTOMER

    # Dealers can only ask about their own order status. No stock, recipe or HR data.
    if is_customer:
        if any(word in question for word in ("maliyet", "recete", "hammadde", "personel", "ik", "stok")):
            return {"answer": "Bu asistan bayi hesaplarında yalnızca kendi sipariş durumunuzu paylaşabilir."}
        if not current_user.cari_id:
            return {"answer": "Hesabınıza bağlı bir cari kart bulunamadı. Sipariş bilgisi gösterilemiyor."}
        rows = (await db.execute(
            select(Order).where(Order.cari_id == current_user.cari_id)
            .order_by(Order.order_date.desc()).limit(5)
        )).scalars().all()
        if not rows:
            return {"answer": "Hesabınıza bağlı henüz bir sipariş bulunmuyor."}
        summary = "; ".join(f"#{row.id}: {row.status}" for row in rows)
        return {"answer": f"Son sipariş durumlarınız: {summary}."}

    is_admin = current_user.role == UserRoleEnum.ADMIN
    can_production = _access(current_user, "manufacturing", {"URETIM", "YONETIM"}, {"uretim", "fabrika_muduru", "yonetici"})
    can_inventory = _access(current_user, "inventory", {"DEPO", "YONETIM"}, {"depo", "yonetici"})
    can_hr = _access(current_user, "hr", {"IK", "YONETIM"}, {"ik", "insan kaynaklari", "yonetici"})
    can_orders = is_admin or _access(current_user, "orders", {"SATIS", "MUHASEBE", "YONETIM"}, {"satis", "muhasebe", "yonetici"})

    if any(word in question for word in ("acil", "uretim emri", "is emri", "eksik stok", "planlama")):
        if not can_production:
            return {"answer": "Üretim emirleri için hesabınızda üretim görüntüleme yetkisi bulunmuyor."}
        rows = (await db.execute(
            select(UretimEmri, Item.name)
            .join(Item, Item.id == UretimEmri.item_id)
            .where(UretimEmri.status == "Beklemede - Sipariş Tetikli")
            .order_by(UretimEmri.created_at.desc()).limit(10)
        )).all()
        if not rows:
            return {"answer": "Bekleyen sipariş tetikli acil üretim emri yok."}
        return {"answer": "Bekleyen üretim emirleri: " + "; ".join(
            f"Sipariş #{work.order_id} — {name}: {work.shortage_quantity} eksik" for work, name in rows
        )}

    if any(word in question for word in ("hammadde", "stok", "bitmek", "kritik")):
        if not can_inventory:
            return {"answer": "Stok ve hammadde bilgileri için depo görüntüleme yetkiniz bulunmuyor."}
        items = (await db.execute(
            select(Item).options(selectinload(Item.batches)).where(
                Item.is_active.is_(True), Item.category == ItemCategory.RAW_MATERIAL
            ).limit(200)
        )).scalars().all()
        critical = []
        for item in items:
            physical = sum((lot.quantity or Decimal("0") for lot in item.batches
                            if lot.status not in ("Bloke", "Reddedildi")), Decimal("0"))
            available = max(Decimal("0"), physical - (item.rezerv_miktar or Decimal("0")))
            if item.min_stock > 0 and available <= item.min_stock:
                critical.append(f"{item.name}: {available} {item.unit} (min. {item.min_stock})")
        return {"answer": "Kritik hammadde: " + "; ".join(critical[:8]) if critical else "Minimum stok seviyesinin altındaki hammadde bulunmuyor."}

    if any(word in question for word in ("recete", "maliyet", "formul")):
        if not can_production:
            return {"answer": "Reçete ve maliyet bilgileri için üretim görüntüleme yetkiniz bulunmuyor."}
        recipes = (await db.execute(select(Recipe).options(selectinload(Recipe.output_item)).limit(100))).scalars().all()
        return {"answer": "Kayıtlı reçeteler: " + (", ".join(f"{recipe.name} ({recipe.output_item.name})" for recipe in recipes[:10]) if recipes else "Henüz reçete kaydı yok.")}

    if any(word in question for word in ("personel", "izin", "ik", "calisan")):
        if not can_hr:
            return {"answer": "Personel ve izin bilgileri için İK görüntüleme yetkiniz bulunmuyor."}
        active = await db.scalar(select(func.count(HRPersonnel.id)).where(HRPersonnel.status == "Aktif")) or 0
        pending = await db.scalar(select(func.count(HRLeave.id)).where(HRLeave.status == "Talep Edildi")) or 0
        return {"answer": f"Aktif personel sayısı {active}; onay bekleyen izin talebi {pending}."}

    if any(word in question for word in ("siparis", "siparisler")):
        if not can_orders:
            return {"answer": "Sipariş raporları için satış görüntüleme yetkiniz bulunmuyor."}
        count = await db.scalar(select(func.count(Order.id)).where(Order.status.not_in(["Tamamlandı", "İptal"]))) or 0
        return {"answer": f"Tamamlanmamış sipariş sayısı: {count}."}

    return {"answer": "Sipariş durumları, acil üretim emirleri, kritik hammaddeler, reçete listesi ve İK özetleri hakkında soru sorabilirsiniz. Yanıtlar rol yetkinize göre sınırlandırılır."}
