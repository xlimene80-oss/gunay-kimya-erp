import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy import select, and_, or_, desc, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_current_user
from app.models.auth import User, UserRoleEnum
from app.models.cari import CariAccount
from app.models.inventory import Item
from app.models.orders import Order, Planning
from app.models.notifications import Notification
from app.models.proforma import ProformaQuote, ProformaQuoteItem, ProformaSetting
from app.schemas.proforma import (
    ProformaQuoteCreate, ProformaQuoteUpdate, ProformaQuoteResponse,
    ProformaQuoteItemResponse, ProformaApprovalAction, ProformaCustomerResponse,
    ProformaSettingUpdate, ProformaSettingResponse
)
from app.schemas.orders import OrderItemCreate
from app.routers.orders import process_order_items_and_inventory

router = APIRouter(prefix="/proformas", tags=["Proforma & Teklifler"])


async def get_or_create_proforma_settings(db: AsyncSession) -> ProformaSetting:
    """Returns singleton ProformaSetting row, creating default if not exists."""
    stmt = select(ProformaSetting).where(ProformaSetting.id == 1)
    res = await db.execute(stmt)
    setting = res.scalar_one_or_none()
    if not setting:
        setting = ProformaSetting(id=1)
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    return setting


async def generate_proforma_number(db: AsyncSession) -> str:
    """Generates sequential quote number: PRF-YYYY-XXXX (e.g. PRF-2026-0001)."""
    current_year = datetime.datetime.now().year
    prefix = f"PRF-{current_year}-"
    stmt = (
        select(ProformaQuote.quote_number)
        .where(ProformaQuote.quote_number.like(f"{prefix}%"))
        .order_by(desc(ProformaQuote.id))
        .limit(1)
    )
    res = await db.execute(stmt)
    last_no = res.scalar_one_or_none()
    
    seq = 1
    if last_no and len(last_no) > len(prefix):
        try:
            seq_part = last_no[len(prefix):]
            seq = int(seq_part) + 1
        except (ValueError, TypeError):
            seq = 1
    return f"{prefix}{seq:04d}"


def is_user_sales_or_management(user: User) -> bool:
    """Check if user belongs to Sales, Management, or is Admin."""
    if user.role == UserRoleEnum.ADMIN:
        return True
    dept_code = (getattr(user, "department_code", "") or "").upper().strip()
    if dept_code in ["SATIS", "YONETIM", "ADMIN"]:
        return True
    if hasattr(user, "has_permission") and user.has_permission("quotes", "read"):
        return True
    return False


def is_user_finance_or_management(user: User) -> bool:
    """Check if user belongs to Finance (Muhasebe), Management, or is Admin."""
    if user.role == UserRoleEnum.ADMIN:
        return True
    dept_code = (getattr(user, "department_code", "") or "").upper().strip()
    if dept_code in ["MUHASEBE", "YONETIM", "ADMIN"]:
        return True
    if hasattr(user, "has_permission") and user.has_permission("quotes", "approve"):
        return True
    return False


def build_quote_response(q: ProformaQuote) -> ProformaQuoteResponse:
    """Helper to convert ProformaQuote ORM object with relationships to response schema."""
    cari = q.cari
    created_by = q.created_by
    approved_by = q.approved_by
    
    items_res = []
    for it in q.items:
        items_res.append(ProformaQuoteItemResponse(
            id=it.id,
            quote_id=it.quote_id,
            item_id=it.item_id,
            item_name=it.item.name if it.item else None,
            item_sku=it.item.sku if it.item else None,
            quantity=it.quantity,
            unit=it.unit or "adet",
            unit_price=it.unit_price,
            discount_rate=it.discount_rate,
            discount_amount=it.discount_amount,
            tax_rate=it.tax_rate,
            tax_amount=it.tax_amount,
            total_price=it.total_price
        ))

    return ProformaQuoteResponse(
        id=q.id,
        quote_number=q.quote_number,
        cari_id=q.cari_id,
        cari_name=getattr(cari, "title", getattr(cari, "name", None)) if cari else None,
        cari_code=cari.code if cari else None,
        cari_tax_office=cari.tax_office if cari else None,
        cari_tax_number=cari.tax_number if cari else None,
        cari_address=cari.address if cari else None,
        cari_phone=cari.phone if cari else None,
        cari_email=cari.email if cari else None,
        created_by_id=q.created_by_id,
        created_by_name=created_by.full_name if created_by else None,
        quote_date=q.quote_date,
        valid_until=q.valid_until,
        status=q.status,
        currency=q.currency,
        exchange_rate=q.exchange_rate,
        discount_rate=q.discount_rate,
        discount_amount=q.discount_amount,
        subtotal=q.subtotal,
        tax_rate=q.tax_rate,
        tax_amount=q.tax_amount,
        grand_total=q.grand_total,
        payment_terms=q.payment_terms,
        delivery_terms=q.delivery_terms,
        notes=q.notes,
        requires_approval=q.requires_approval,
        approval_status=q.approval_status,
        approval_notes=q.approval_notes,
        approved_by_id=q.approved_by_id,
        approved_by_name=approved_by.full_name if approved_by else None,
        approved_at=q.approved_at,
        converted_order_id=q.converted_order_id,
        items=items_res,
        created_at=q.created_at,
        updated_at=q.updated_at
    )


# ---------------------------------------------------------------------------
# SETTINGS ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/settings", response_model=ProformaSettingResponse)
async def get_proforma_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve global proforma configuration, discount approval limits and banking info."""
    setting = await get_or_create_proforma_settings(db)
    return setting


@router.put("/settings", response_model=ProformaSettingResponse)
async def update_proforma_settings(
    payload: ProformaSettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update proforma configuration and discount limits (Admin/Finance only)."""
    if not (current_user.role == UserRoleEnum.ADMIN or is_user_finance_or_management(current_user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teklif ve iskonto onay parametrelerini sadece Yönetici veya Finans yetkilileri güncelleyebilir."
        )

    setting = await get_or_create_proforma_settings(db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(setting, field, val)

    await db.commit()
    await db.refresh(setting)
    return setting


# ---------------------------------------------------------------------------
# QUOTES LIST & DETAIL
# ---------------------------------------------------------------------------
@router.get("", response_model=List[ProformaQuoteResponse])
async def list_proformas(
    status_filter: Optional[str] = Query(None, alias="status"),
    cari_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List proforma quotes with strict role-based access:
    - B2B Customer: Can ONLY see their own quotes (cari_id matching) and only in status:
      'Gönderildi', 'Kabul Edildi', 'Reddedildi', 'Siparişe Dönüştü'.
    - Sales / Management / Admin: Can see all quotes across all statuses.
    """
    stmt = (
        select(ProformaQuote)
        .options(
            selectinload(ProformaQuote.cari),
            selectinload(ProformaQuote.created_by),
            selectinload(ProformaQuote.approved_by),
            selectinload(ProformaQuote.items).selectinload(ProformaQuoteItem.item)
        )
        .order_by(desc(ProformaQuote.id))
    )

    is_customer = current_user.role == UserRoleEnum.CUSTOMER
    if is_customer:
        if not current_user.cari_id:
            return []
        stmt = stmt.where(
            and_(
                ProformaQuote.cari_id == current_user.cari_id,
                ProformaQuote.status.in_(["Gönderildi", "Kabul Edildi", "Reddedildi", "Siparişe Dönüştü"])
            )
        )
    else:
        # Internal users: verify permission
        if not (is_user_sales_or_management(current_user) or is_user_finance_or_management(current_user)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teklifler modülüne erişim yetkiniz bulunmamaktadır."
            )

        if cari_id:
            stmt = stmt.where(ProformaQuote.cari_id == cari_id)

    if status_filter and status_filter.strip() != "ALL":
        stmt = stmt.where(ProformaQuote.status == status_filter.strip())

    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.join(ProformaQuote.cari).where(
            or_(
                ProformaQuote.quote_number.ilike(term),
                CariAccount.title.ilike(term),
                CariAccount.code.ilike(term)
            )
        )

    res = await db.execute(stmt)
    quotes = res.scalars().all()
    return [build_quote_response(quote) for quote in quotes]


@router.get("/{id}", response_model=ProformaQuoteResponse)
async def get_proforma_detail(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full details of a proforma quote."""
    stmt = (
        select(ProformaQuote)
        .options(
            selectinload(ProformaQuote.cari),
            selectinload(ProformaQuote.created_by),
            selectinload(ProformaQuote.approved_by),
            selectinload(ProformaQuote.items).selectinload(ProformaQuoteItem.item)
        )
        .where(ProformaQuote.id == id)
    )
    res = await db.execute(stmt)
    quote = res.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proforma teklif bulunamadı.")

    # Access control
    if current_user.role == UserRoleEnum.CUSTOMER:
        if quote.cari_id != current_user.cari_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu teklifi görüntüleme yetkiniz yok.")
        if quote.status in ["Taslak", "Onay Bekliyor"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu teklif henüz onay/hazırlık aşamasındadır.")
    elif not (is_user_sales_or_management(current_user) or is_user_finance_or_management(current_user)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu teklife erişim yetkiniz bulunmamaktadır.")

    return build_quote_response(quote)


# ---------------------------------------------------------------------------
# CREATE & UPDATE QUOTE
# ---------------------------------------------------------------------------
@router.post("", response_model=ProformaQuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_proforma(
    payload: ProformaQuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new Proforma Quote.
    - Authorized only for Sales Department and Management.
    - If discount % exceeds settings threshold, automatically enters 'Onay Bekliyor' status.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="B2B Bayiler yeni teklif oluşturamaz; yalnızca kendilerine sunulan teklifleri inceleyebilir."
        )

    if not is_user_sales_or_management(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teklif hazırlama yetkisi sadece Satış Departmanı ve Yöneticilere aittir."
        )

    # Verify CariAccount
    stmt_cari = select(CariAccount).where(CariAccount.id == payload.cari_id)
    cari = (await db.execute(stmt_cari)).scalar_one_or_none()
    if not cari:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seçilen Cari Kart sistemde bulunamadı.")

    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Teklifte en az bir ürün kalemi bulunmalıdır.")

    settings_row = await get_or_create_proforma_settings(db)
    quote_no = await generate_proforma_number(db)

    # Financial calculations
    subtotal = Decimal("0.00")
    total_line_discounts = Decimal("0.00")
    max_line_discount = Decimal("0.00")

    quote_items: List[ProformaQuoteItem] = []
    for it_in in payload.items:
        # Verify item
        stmt_item = select(Item).where(Item.id == it_in.item_id)
        item_obj = (await db.execute(stmt_item)).scalar_one_or_none()
        if not item_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ürün #{it_in.item_id} bulunamadı.")

        qty = Decimal(str(it_in.quantity))
        u_price = Decimal(str(it_in.unit_price))
        disc_rate = Decimal(str(it_in.discount_rate or "0.00"))
        t_rate = Decimal(str(it_in.tax_rate or "20.00"))

        if disc_rate > max_line_discount:
            max_line_discount = disc_rate

        line_gross = qty * u_price
        line_discount = (line_gross * disc_rate) / Decimal("100.00")
        line_net = line_gross - line_discount
        line_tax = (line_net * t_rate) / Decimal("100.00")
        line_total = line_net + line_tax

        subtotal += line_net
        total_line_discounts += line_discount

        q_item = ProformaQuoteItem(
            item_id=item_obj.id,
            quantity=qty,
            unit=it_in.unit or item_obj.unit or "adet",
            unit_price=u_price,
            discount_rate=disc_rate,
            discount_amount=line_discount,
            tax_rate=t_rate,
            tax_amount=line_tax,
            total_price=line_total
        )
        quote_items.append(q_item)

    # Overall discount
    overall_disc_rate = Decimal(str(payload.discount_rate or "0.00"))
    overall_disc_amount = (subtotal * overall_disc_rate) / Decimal("100.00")
    subtotal_after_overall = subtotal - overall_disc_amount

    # Tax calculation
    quote_tax_rate = Decimal(str(payload.tax_rate or "20.00"))
    quote_tax_amount = (subtotal_after_overall * quote_tax_rate) / Decimal("100.00")
    grand_total = subtotal_after_overall + quote_tax_amount

    # Check approval requirement against settings limit
    max_effective_discount = max(overall_disc_rate, max_line_discount)
    limit = settings_row.max_discount_without_approval
    requires_approval = max_effective_discount > limit

    init_status = "Onay Bekliyor" if requires_approval else "Taslak"
    init_approval_status = "PENDING" if requires_approval else "NONE"
    approval_notes = (
        f"İskonto oranı (%{max_effective_discount}), tanımlı limiti (%{limit}) aştığı için Finans/Yönetici onayı gerekmektedir."
        if requires_approval else None
    )

    new_quote = ProformaQuote(
        quote_number=quote_no,
        cari_id=cari.id,
        created_by_id=current_user.id,
        quote_date=datetime.datetime.now(datetime.timezone.utc),
        valid_until=payload.valid_until,
        status=init_status,
        currency=payload.currency.upper(),
        exchange_rate=Decimal(str(payload.exchange_rate or "1.0000")),
        discount_rate=overall_disc_rate,
        discount_amount=overall_disc_amount + total_line_discounts,
        subtotal=subtotal,
        tax_rate=quote_tax_rate,
        tax_amount=quote_tax_amount,
        grand_total=grand_total,
        payment_terms=payload.payment_terms,
        delivery_terms=payload.delivery_terms,
        notes=payload.notes,
        requires_approval=requires_approval,
        approval_status=init_approval_status,
        approval_notes=approval_notes,
        items=quote_items
    )
    db.add(new_quote)
    await db.commit()

    # If approval is required, send internal alert notification to Finance/Management
    if requires_approval:
        notif = Notification(
            recipient_role="MUHASEBE",
            title=f"Yüksek İskontolu Teklif Onayı: {quote_no} (%{max_effective_discount})",
            message=f"{getattr(cari, 'title', getattr(cari, 'name', ''))} için hazırlanan {quote_no} numaralı teklif, %{max_effective_discount} iskonto nedeniyle onayınızı bekliyor.",
            event_type="DISCOUNT_APPROVAL_REQUIRED",
            reference_module="QUOTES",
            is_read=False
        )
        db.add(notif)
        await db.commit()

    # Re-query with full eager loaded relationships
    return await get_proforma_detail(new_quote.id, db=db, current_user=current_user)


@router.put("/{id}", response_model=ProformaQuoteResponse)
async def update_proforma(
    id: int,
    payload: ProformaQuoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update proforma details and line items (Sales/Management only)."""
    if not is_user_sales_or_management(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teklifi güncelleme yetkiniz bulunmamaktadır."
        )

    stmt = (
        select(ProformaQuote)
        .options(
            selectinload(ProformaQuote.cari),
            selectinload(ProformaQuote.items)
        )
        .where(ProformaQuote.id == id)
    )
    res = await db.execute(stmt)
    quote = res.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proforma teklif bulunamadı.")

    if quote.status == "Siparişe Dönüştü":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Siparişe dönüşmüş bir teklif üzerinde değişiklik yapılamaz."
        )

    settings_row = await get_or_create_proforma_settings(db)

    if payload.cari_id is not None:
        quote.cari_id = payload.cari_id
    if payload.valid_until is not None:
        quote.valid_until = payload.valid_until
    if payload.currency is not None:
        quote.currency = payload.currency.upper()
    if payload.exchange_rate is not None:
        quote.exchange_rate = Decimal(str(payload.exchange_rate))
    if payload.payment_terms is not None:
        quote.payment_terms = payload.payment_terms
    if payload.delivery_terms is not None:
        quote.delivery_terms = payload.delivery_terms
    if payload.notes is not None:
        quote.notes = payload.notes
    if payload.tax_rate is not None:
        quote.tax_rate = Decimal(str(payload.tax_rate))

    # Recalculate items if provided
    if payload.items is not None:
        # Clear existing items
        for old_it in list(quote.items):
            await db.delete(old_it)
        quote.items.clear()

        subtotal = Decimal("0.00")
        total_line_discounts = Decimal("0.00")
        max_line_discount = Decimal("0.00")

        for it_in in payload.items:
            stmt_item = select(Item).where(Item.id == it_in.item_id)
            item_obj = (await db.execute(stmt_item)).scalar_one_or_none()
            if not item_obj:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ürün #{it_in.item_id} bulunamadı.")

            qty = Decimal(str(it_in.quantity))
            u_price = Decimal(str(it_in.unit_price))
            disc_rate = Decimal(str(it_in.discount_rate or "0.00"))
            t_rate = Decimal(str(it_in.tax_rate or quote.tax_rate or "20.00"))

            if disc_rate > max_line_discount:
                max_line_discount = disc_rate

            line_gross = qty * u_price
            line_discount = (line_gross * disc_rate) / Decimal("100.00")
            line_net = line_gross - line_discount
            line_tax = (line_net * t_rate) / Decimal("100.00")
            line_total = line_net + line_tax

            subtotal += line_net
            total_line_discounts += line_discount

            quote.items.append(ProformaQuoteItem(
                quote_id=quote.id,
                item_id=item_obj.id,
                quantity=qty,
                unit=it_in.unit or item_obj.unit or "adet",
                unit_price=u_price,
                discount_rate=disc_rate,
                discount_amount=line_discount,
                tax_rate=t_rate,
                tax_amount=line_tax,
                total_price=line_total
            ))

        quote.subtotal = subtotal

        # Re-evaluate discount
        overall_disc_rate = Decimal(str(payload.discount_rate if payload.discount_rate is not None else quote.discount_rate))
        quote.discount_rate = overall_disc_rate
        overall_disc_amount = (subtotal * overall_disc_rate) / Decimal("100.00")
        quote.discount_amount = overall_disc_amount + total_line_discounts

        subtotal_after_overall = subtotal - overall_disc_amount
        quote_tax_amount = (subtotal_after_overall * quote.tax_rate) / Decimal("100.00")
        quote.tax_amount = quote_tax_amount
        quote.grand_total = subtotal_after_overall + quote_tax_amount

        # Check approval
        max_disc = max(overall_disc_rate, max_line_discount)
        limit = settings_row.max_discount_without_approval
        if max_disc > limit:
            quote.requires_approval = True
            if quote.approval_status != "APPROVED":
                quote.status = "Onay Bekliyor"
                quote.approval_status = "PENDING"
                quote.approval_notes = f"Güncellenen iskonto (%{max_disc}) limiti (%{limit}) aştığı için Finans onayı gerektirir."
        else:
            quote.requires_approval = False
            quote.approval_status = "NONE"

    if payload.status and payload.status in ["Taslak", "Onay Bekliyor", "Gönderildi", "Kabul Edildi", "Reddedildi", "Süresi Doldu"]:
        # If user attempts to set Gönderildi directly, ensure approval is satisfied!
        if payload.status == "Gönderildi" and quote.requires_approval and quote.approval_status != "APPROVED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="İskonto onaylanmadan teklif 'Gönderildi' durumuna alınamaz."
            )
        quote.status = payload.status

    await db.commit()
    return await get_proforma_detail(quote.id, db=db, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_proforma(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete draft or rejected proforma quote."""
    if not is_user_sales_or_management(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Silme yetkiniz bulunmamaktadır.")

    stmt = select(ProformaQuote).where(ProformaQuote.id == id)
    res = await db.execute(stmt)
    quote = res.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teklif bulunamadı.")

    if quote.status in ["Gönderildi", "Kabul Edildi", "Siparişe Dönüştü"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Müşteriye gönderilmiş, kabul edilmiş veya siparişe dönüşmüş teklifler silinemez. Durumunu Reddedildi veya İptal yapabilirsiniz."
        )

    await db.delete(quote)
    await db.commit()
    return None


# ---------------------------------------------------------------------------
# WORKFLOW ACTIONS: SEND, APPROVE/REJECT DISCOUNT, ACCEPT/REJECT, CONVERT
# ---------------------------------------------------------------------------
@router.post("/{id}/send", response_model=ProformaQuoteResponse)
async def send_proforma_to_customer(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sends proforma to customer (B2B Bayi portal / Email).
    RULE: If discount exceeds threshold and is not approved by Finance/Admin,
    cannot transition to 'Gönderildi'.
    """
    if not is_user_sales_or_management(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teklif gönderme yetkiniz yok.")

    stmt = (
        select(ProformaQuote)
        .options(selectinload(ProformaQuote.cari))
        .where(ProformaQuote.id == id)
    )
    quote = (await db.execute(stmt)).scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teklif bulunamadı.")

    if quote.requires_approval and quote.approval_status != "APPROVED":
        settings_row = await get_or_create_proforma_settings(db)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Teklif onaylanmadan gönderilemez! Uygulanan iskonto oranı "
                f"Finans onay limitini (%{settings_row.max_discount_without_approval}) aştığı için "
                f"Finans / Yönetici onayı beklemektedir."
            )
        )

    quote.status = "Gönderildi"
    await db.commit()

    # Inform dealer via notification if Cari has linked B2B user
    notif = Notification(
        recipient_role="BAYI",
        title=f"Yeni Proforma Teklifi: {quote.quote_number}",
        message=f"Tarafınıza {quote.grand_total} {quote.currency} tutarında yeni bir proforma teklifi iletildi. İnceleyip onaylayabilirsiniz.",
        event_type="PROFORMA_SENT",
        reference_module="QUOTES",
        is_read=False
    )
    db.add(notif)
    await db.commit()

    return await get_proforma_detail(quote.id, db=db, current_user=current_user)


@router.post("/{id}/approval", response_model=ProformaQuoteResponse)
async def process_discount_approval(
    id: int,
    payload: ProformaApprovalAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finans / Yönetici yüksek iskonto onay mekanizması.
    - action: 'approve' -> Teklif onaylanır, Satış tarafından gönderilebilir hale gelir.
    - action: 'reject' -> Teklif reddedilir ve not kaydedilir.
    """
    if not is_user_finance_or_management(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="İskonto onaylama ve reddetme yetkisi sadece Finans (Muhasebe) veya Yönetici rolüne aittir."
        )

    stmt = select(ProformaQuote).where(ProformaQuote.id == id)
    quote = (await db.execute(stmt)).scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teklif bulunamadı.")

    action = payload.action.lower().strip()
    if action == "approve":
        quote.approval_status = "APPROVED"
        quote.approved_by_id = current_user.id
        quote.approved_at = datetime.datetime.now(datetime.timezone.utc)
        quote.approval_notes = payload.notes or "Finans / Yönetici tarafından onaylandı."
        # If was pending, move to Taslak ready to be sent
        if quote.status == "Onay Bekliyor":
            quote.status = "Taslak"

        notif = Notification(
            recipient_role="SATIS",
            title=f"İskonto Onaylandı: {quote.quote_number}",
            message=f"{quote.quote_number} numaralı teklifin iskontosu onaylandı. Müşteriye gönderebilirsiniz.",
            event_type="DISCOUNT_APPROVED",
            reference_module="QUOTES",
            is_read=False
        )
        db.add(notif)

    elif action == "reject":
        quote.approval_status = "REJECTED"
        quote.approved_by_id = current_user.id
        quote.approved_at = datetime.datetime.now(datetime.timezone.utc)
        quote.approval_notes = payload.notes or "Finans / Yönetici tarafından iskonto reddedildi."
        if quote.status == "Onay Bekliyor":
            quote.status = "Taslak"

        notif = Notification(
            recipient_role="SATIS",
            title=f"İskonto Reddedildi: {quote.quote_number}",
            message=f"{quote.quote_number} numaralı teklifin iskontosu reddedildi. Not: {quote.approval_notes}",
            event_type="DISCOUNT_REJECTED",
            reference_module="QUOTES",
            is_read=False
        )
        db.add(notif)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz işlem ('approve' veya 'reject' olmalıdır).")

    await db.commit()
    return await get_proforma_detail(quote.id, db=db, current_user=current_user)


@router.post("/{id}/respond", response_model=ProformaQuoteResponse)
async def customer_respond_proforma(
    id: int,
    payload: ProformaCustomerResponse,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    B2B Bayi (veya adına Satış) teklifi Kabul Eder veya Reddeder.
    - Bayi sadece kendisine gönderilmiş teklife yanıt verebilir.
    """
    stmt = (
        select(ProformaQuote)
        .options(selectinload(ProformaQuote.cari))
        .where(ProformaQuote.id == id)
    )
    quote = (await db.execute(stmt)).scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teklif bulunamadı.")

    # Access check: If customer, must match cari_id
    if current_user.role == UserRoleEnum.CUSTOMER:
        if quote.cari_id != current_user.cari_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu teklif sizin cari hesabınıza ait değil.")
        if quote.status != "Gönderildi":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sadece 'Gönderildi' durumundaki aktif tekliflere yanıt verilebilir."
            )
    else:
        if not is_user_sales_or_management(current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkiniz bulunmamaktadır.")

    action = payload.action.lower().strip()
    if action == "accept":
        quote.status = "Kabul Edildi"
        if payload.notes:
            quote.notes = (quote.notes or "") + f"\n[Müşteri Kabul Notu]: {payload.notes}"

        notif = Notification(
            recipient_role="SATIS",
            title=f"Teklif Kabul Edildi: {quote.quote_number}",
            message=f"{getattr(quote.cari, 'title', getattr(quote.cari, 'name', '')) if quote.cari else ''} firması {quote.quote_number} teklifini kabul etti. Siparişe dönüştürebilirsiniz.",
            event_type="PROFORMA_ACCEPTED",
            reference_module="QUOTES",
            is_read=False
        )
        db.add(notif)

    elif action == "reject":
        quote.status = "Reddedildi"
        if payload.notes:
            quote.notes = (quote.notes or "") + f"\n[Müşteri Red Gerekçesi]: {payload.notes}"

        notif = Notification(
            recipient_role="SATIS",
            title=f"Teklif Reddedildi: {quote.quote_number}",
            message=f"{getattr(quote.cari, 'title', getattr(quote.cari, 'name', '')) if quote.cari else ''} firması {quote.quote_number} teklifini reddetti. Gerekçe: {payload.notes or 'Belirtilmedi'}",
            event_type="PROFORMA_REJECTED",
            reference_module="QUOTES",
            is_read=False
        )
        db.add(notif)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz işlem ('accept' veya 'reject').")

    await db.commit()
    return await get_proforma_detail(quote.id, db=db, current_user=current_user)


@router.post("/{id}/convert-to-order", response_model=ProformaQuoteResponse)
async def convert_proforma_to_order(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Kabul edilen teklifi tek tıkla Satış Siparişi'ne dönüştürür:
    1. Proforma kalemleri ve anlaşılan fiyatları Satış Siparişi'ne aktarılır.
    2. process_order_items_and_inventory çalışarak serbest stoğa bakar:
       - Yeterliyse FEFO ile partilerden rezerve eder.
       - Eksik varsa siparişe bağlı 'Beklemede - Sipariş Tetikli' üretim emri açar ve reçeteye göre hammaddeleri rezerve eder.
       - Tüm stok hareketlerini StockMovement tablosuna kaydeder.
    3. Teklif durumu 'Siparişe Dönüştü' olarak güncellenir ve order_id bağlanır.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teklifi siparişe dönüştürme işlemi sadece Satış yetkilileri tarafından onaylanabilir."
        )

    if not is_user_sales_or_management(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkiniz bulunmamaktadır.")

    stmt = (
        select(ProformaQuote)
        .options(
            selectinload(ProformaQuote.cari),
            selectinload(ProformaQuote.items).selectinload(ProformaQuoteItem.item)
        )
        .where(ProformaQuote.id == id)
    )
    quote = (await db.execute(stmt)).scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teklif bulunamadı.")

    if quote.status == "Siparişe Dönüştü" and quote.converted_order_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bu teklif daha önce Sipariş #{quote.converted_order_id} olarak dönüştürülmüştür."
        )

    if quote.status not in ["Kabul Edildi", "Gönderildi", "Taslak"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{quote.status}' durumundaki bir teklif siparişe dönüştürülemez."
        )

    if not quote.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Teklif kalemleri boş.")

    # 1. Create Order
    new_order = Order(
        cari_id=quote.cari_id,
        order_date=datetime.datetime.now(datetime.timezone.utc),
        status="Beklemede",
        is_b2b_order=bool(getattr(quote.cari, "is_b2b", False)),
        total_amount=Decimal("0.00"),
        notes=f"Proforma Teklifi #{quote.quote_number} üzerinden otomatik dönüştürüldü. Koşullar: {quote.payment_terms} | {quote.delivery_terms}"
    )
    db.add(new_order)
    await db.flush()

    # 2. Build items and price overrides based on agreed proforma net unit prices
    order_items_in = []
    override_prices: dict[int, Decimal] = {}
    for it in quote.items:
        # Net unit price after line discount, converted to TRY if foreign currency
        line_unit_net = it.unit_price * (Decimal("1.00") - (it.discount_rate / Decimal("100.00")))
        if quote.currency != "TRY" and quote.exchange_rate > Decimal("0.0000"):
            line_unit_net = line_unit_net * quote.exchange_rate

        line_unit_net = line_unit_net.quantize(Decimal("0.01"))
        order_items_in.append(OrderItemCreate(
            item_id=it.item_id,
            quantity=it.quantity,
            unit_price=line_unit_net
        ))
        override_prices[it.item_id] = line_unit_net

    # 3. Process stock reservation & production trigger flow
    total_calc = await process_order_items_and_inventory(
        db=db,
        order=new_order,
        items_in=order_items_in,
        user=current_user,
        override_prices=override_prices
    )
    new_order.total_amount = total_calc

    # 4. Generate planning ticket
    planning_code = f"PLN-PRF-{new_order.id}-{quote.quote_number.replace('-', '')}"
    new_planning = Planning(
        order_id=new_order.id,
        work_order_no=planning_code,
        target_warehouse="Ana Depo",
        status="Planlandı",
        notes=f"Teklif #{quote.quote_number} onayına istinaden otomatik planlama açıldı."
    )
    db.add(new_planning)

    # 5. Link quote to converted order and update status
    quote.status = "Siparişe Dönüştü"
    quote.converted_order_id = new_order.id
    await db.commit()

    return await get_proforma_detail(quote.id, db=db, current_user=current_user)


# ---------------------------------------------------------------------------
# PRINTABLE CORPORATE PROFORMA HTML / PDF ENDPOINT
# ---------------------------------------------------------------------------
@router.get("/{id}/print", response_class=Response)
async def print_proforma_html(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Renders a pixel-perfect, self-contained printable corporate Proforma Invoice
    with company logo, banking information, line items and stamp/signature area.
    """
    detail = await get_proforma_detail(id, db=db, current_user=current_user)
    settings_row = await get_or_create_proforma_settings(db)

    # Generate line rows
    rows_html = ""
    for idx, it in enumerate(detail.items, 1):
        rows_html += f"""
        <tr>
            <td style="text-align: center; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">{idx}</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 600; color: #1e293b;">{it.item_sku or '-'}</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a;">{it.item_name}</td>
            <td style="text-align: right; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 600;">{float(it.quantity):,.2f} {it.unit}</td>
            <td style="text-align: right; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">{float(it.unit_price):,.2f} {detail.currency}</td>
            <td style="text-align: right; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #d97706;">%{float(it.discount_rate):.1f}</td>
            <td style="text-align: right; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">%{float(it.tax_rate):.0f}</td>
            <td style="text-align: right; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #0284c7;">{float(it.total_price):,.2f} {detail.currency}</td>
        </tr>
        """

    # Format dates
    q_date = detail.quote_date.strftime("%d.%m.%Y")
    v_date = detail.valid_until.strftime("%d.%m.%Y")

    html_content = f"""<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Proforma Fatura - {detail.quote_number}</title>
    <style>
        @page {{ size: A4 portrait; margin: 12mm 15mm; }}
        body {{
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            margin: 0;
            padding: 20px;
            font-size: 12px;
            line-height: 1.4;
        }}
        .print-btn {{
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0284c7;
            color: #fff;
            border: none;
            padding: 10px 18px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .print-btn:hover {{ background: #0369a1; }}
        @media print {{
            .print-btn {{ display: none; }}
            body {{ padding: 0; }}
        }}
        .proforma-container {{
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #cbd5e1;
            padding: 30px;
            border-radius: 4px;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }}
        .brand-logo {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .logo-box {{
            width: 44px;
            height: 44px;
            background: #0284c7;
            color: white;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            font-weight: 900;
            letter-spacing: -1px;
        }}
        .brand-text h1 {{
            margin: 0;
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.5px;
        }}
        .brand-text p {{
            margin: 2px 0 0 0;
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
        }}
        .proforma-badge {{
            text-align: right;
        }}
        .badge-title {{
            font-size: 20px;
            font-weight: 900;
            color: #0284c7;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 0;
        }}
        .badge-subtitle {{
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
        }}
        .info-grid {{
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 20px;
            margin-bottom: 20px;
        }}
        .card {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 14px;
        }}
        .card-title {{
            font-size: 10px;
            font-weight: 800;
            color: #0284c7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
            margin-bottom: 8px;
        }}
        .field-row {{
            display: flex;
            margin-bottom: 4px;
            font-size: 11px;
        }}
        .field-label {{
            width: 110px;
            color: #64748b;
            font-weight: 600;
        }}
        .field-val {{
            flex: 1;
            color: #0f172a;
            font-weight: 500;
        }}
        table.items-table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }}
        table.items-table th {{
            background: #f1f5f9;
            color: #334155;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 8px 10px;
            border-top: 1px solid #cbd5e1;
            border-bottom: 2px solid #cbd5e1;
        }}
        .totals-section {{
            display: flex;
            justify-content: flex-end;
            margin-bottom: 24px;
        }}
        .totals-table {{
            width: 320px;
            border-collapse: collapse;
        }}
        .totals-table td {{
            padding: 5px 8px;
            font-size: 11px;
        }}
        .totals-table .t-label {{
            color: #64748b;
            font-weight: 600;
        }}
        .totals-table .t-val {{
            text-align: right;
            font-weight: 700;
            color: #0f172a;
        }}
        .grand-total-row {{
            border-top: 2px solid #0284c7;
            border-bottom: 2px solid #0284c7;
            background: #f0f9ff;
        }}
        .grand-total-row td {{
            font-size: 13px !important;
            font-weight: 800 !important;
            color: #0284c7 !important;
            padding: 8px !important;
        }}
        .terms-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 24px;
            font-size: 10.5px;
        }}
        .signatures {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 30px;
            text-align: center;
        }}
        .sign-box {{
            border-top: 1px dashed #94a3b8;
            padding-top: 10px;
        }}
        .sign-title {{
            font-size: 11px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 4px;
        }}
        .sign-sub {{
            font-size: 9.5px;
            color: #64748b;
        }}
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v8H6z"></path></svg>
        Yazdır / PDF Kaydet
    </button>

    <div class="proforma-container">
        <!-- HEADER -->
        <div class="header">
            <div class="brand-logo">
                <div class="logo-box">GK</div>
                <div class="brand-text">
                    <h1>{settings_row.company_name}</h1>
                    <p>{settings_row.company_title}</p>
                </div>
            </div>
            <div class="proforma-badge">
                <h2 class="badge-title">PROFORMA FATURA</h2>
                <div class="badge-subtitle">PROFORMA INVOICE</div>
                <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-top: 4px;">#{detail.quote_number}</div>
            </div>
        </div>

        <!-- INFO GRID -->
        <div class="info-grid">
            <!-- Müşteri Bilgileri -->
            <div class="card">
                <div class="card-title">Sayın / Müşteri Bilgileri</div>
                <div class="field-row">
                    <span class="field-label">Firma / Cari:</span>
                    <span class="field-val" style="font-weight: 700;">{detail.cari_name or '-'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Cari Kodu:</span>
                    <span class="field-val">{detail.cari_code or '-'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Vergi Dairesi / No:</span>
                    <span class="field-val">{detail.cari_tax_office or '-'} / {detail.cari_tax_number or '-'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Adres:</span>
                    <span class="field-val">{detail.cari_address or '-'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">İletişim:</span>
                    <span class="field-val">{detail.cari_phone or '-'} | {detail.cari_email or '-'}</span>
                </div>
            </div>

            <!-- Teklif Bilgileri -->
            <div class="card">
                <div class="card-title">Teklif & Sevkiyat Parametreleri</div>
                <div class="field-row">
                    <span class="field-label">Teklif Tarihi:</span>
                    <span class="field-val">{q_date}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Geçerlilik Tarihi:</span>
                    <span class="field-val" style="color: #b91c1c; font-weight: 700;">{v_date}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Döviz & Kur:</span>
                    <span class="field-val">{detail.currency} (Kur: {float(detail.exchange_rate):.4f} TL)</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Ödeme Koşulu:</span>
                    <span class="field-val">{detail.payment_terms}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Teslim Şekli:</span>
                    <span class="field-val">{detail.delivery_terms}</span>
                </div>
            </div>
        </div>

        <!-- ITEMS TABLE -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 30px; text-align: center;">#</th>
                    <th style="width: 90px; text-align: left;">Ürün Kodu</th>
                    <th style="text-align: left;">Ürün / Kimyasal Adı</th>
                    <th style="width: 90px; text-align: right;">Miktar</th>
                    <th style="width: 95px; text-align: right;">Birim Fiyat</th>
                    <th style="width: 60px; text-align: right;">İskonto</th>
                    <th style="width: 50px; text-align: right;">KDV</th>
                    <th style="width: 110px; text-align: right;">Net Tutar</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>

        <!-- TOTALS -->
        <div class="totals-section">
            <table class="totals-table">
                <tr>
                    <td class="t-label">Ara Toplam:</td>
                    <td class="t-val">{float(detail.subtotal):,.2f} {detail.currency}</td>
                </tr>
                <tr>
                    <td class="t-label">Toplam İskonto:</td>
                    <td class="t-val" style="color: #d97706;">-{float(detail.discount_amount):,.2f} {detail.currency}</td>
                </tr>
                <tr>
                    <td class="t-label">KDV Tutarı:</td>
                    <td class="t-val">+{float(detail.tax_amount):,.2f} {detail.currency}</td>
                </tr>
                <tr class="grand-total-row">
                    <td class="t-label" style="color: #0284c7 !important;">GENEL TOPLAM:</td>
                    <td class="t-val">{float(detail.grand_total):,.2f} {detail.currency}</td>
                </tr>
                {f"<tr><td class='t-label' style='font-size: 10px;'>TL Karşılığı:</td><td class='t-val' style='font-size: 10px; color: #64748b;'>{float(detail.grand_total * detail.exchange_rate):,.2f} TRY</td></tr>" if detail.currency != "TRY" else ""}
            </table>
        </div>

        <!-- BANK & TERMS -->
        <div class="terms-grid">
            <div>
                <div style="font-weight: 700; color: #0284c7; margin-bottom: 6px; text-transform: uppercase;">Banka & Havale Bilgileri</div>
                <div><strong>Banka:</strong> {settings_row.bank_name} - {settings_row.bank_branch}</div>
                <div><strong>TRY IBAN:</strong> <span style="font-family: monospace;">{settings_row.iban_try}</span></div>
                <div><strong>USD IBAN:</strong> <span style="font-family: monospace;">{settings_row.iban_usd}</span></div>
                <div><strong>EUR IBAN:</strong> <span style="font-family: monospace;">{settings_row.iban_eur}</span></div>
                <div><strong>SWIFT / BIC:</strong> {settings_row.swift_code}</div>
            </div>
            <div>
                <div style="font-weight: 700; color: #0284c7; margin-bottom: 6px; text-transform: uppercase;">Açıklama & Koşullar</div>
                <div>{detail.notes or settings_row.footer_note}</div>
                <div style="margin-top: 6px; color: #64748b; font-size: 9.5px;">* Teklifimiz belirtilen geçerlilik tarihine kadar geçerlidir. Onay için imzalı kaşeli nüshayı satis@gunaykimya.com adresine iletiniz veya B2B portalından onaylayınız.</div>
            </div>
        </div>

        <!-- SIGNATURES -->
        <div class="signatures">
            <div class="sign-box">
                <div class="sign-title">{settings_row.company_name}</div>
                <div class="sign-sub">Hazırlayan / Kaşe & İmza</div>
                <div style="height: 40px;"></div>
                <div style="font-size: 10px; color: #64748b;">Yetkili Satış Yöneticisi</div>
            </div>
            <div class="sign-box">
                <div class="sign-title">{detail.cari_name or 'Müşteri Onayı'}</div>
                <div class="sign-sub">Kabul Eden / Kaşe & İmza</div>
                <div style="height: 40px;"></div>
                <div style="font-size: 10px; color: #64748b;">Müşteri Yetkilisi</div>
            </div>
        </div>
    </div>
</body>
</html>
    """
    return Response(content=html_content, media_type="text/html")
