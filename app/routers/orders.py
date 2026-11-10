import datetime
import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_current_user, get_optional_current_user
from app.models.auth import User, UserRoleEnum
from app.models.cari import CariAccount
from app.models.inventory import Item, BatchLot, StockMovement
from app.models.orders import Order, Planning, OrderItem, B2BBayiFiyatlari
from app.models.manufacturing import Recipe, RecipeIngredient, ProductionOrder, ProductionStatus
from app.models.notifications import Notification
from app.models.production_alerts import UretimEmri
from app.schemas.orders import (
    OrderCreate, OrderB2BCreate, OrderUpdate, OrderResponse,
    PlanningCreate, PlanningUpdate, PlanningResponse,
    CheckStockRequest, CheckStockResponse, ProductOrderItemResponse
)

router = APIRouter(prefix="/orders", tags=["Orders & B2B Portal"])


async def get_item_price_for_user(
    item: Item,
    user: Optional[User],
    db: AsyncSession,
    cari_id: Optional[int] = None,
    is_b2b: bool = False
) -> tuple[Decimal, Optional[Decimal]]:
    """
    Returns (effective_price, b2b_special_price_if_exists).
    Rule:
    Giriş yapan kullanıcının rolü B2B Bayi ise veya sipariş bir B2B siparişi ise,
    bayinin özel fiyat tablosunu (B2BBayiFiyatlari) baz al, değilse standart liste fiyatını getir.
    İstemciden gelen fiyat kesinlikle kullanılmaz, backend hesaplar.
    """
    is_bayi = is_b2b
    special_price = None

    if user:
        user_role_str = str(getattr(user, "role", "")).lower()
        if "customer" in user_role_str or user.role == UserRoleEnum.CUSTOMER:
            is_bayi = True
        elif hasattr(user, "roles"):
            for r in user.roles:
                r_name = str(getattr(r, "role_name", "")).lower()
                if "bayi" in r_name or "b2b" in r_name:
                    is_bayi = True
                    break
        elif user.user_code and user.user_code.startswith("B2B"):
            is_bayi = True

    effective_cari_id = cari_id or (user.cari_id if user else None)
    if is_bayi and (effective_cari_id or (user and user.user_code)):
        conditions = []
        if user and user.user_code:
            conditions.append(B2BBayiFiyatlari.dealer_code == user.user_code)
        if effective_cari_id:
            conditions.append(B2BBayiFiyatlari.cari_id == effective_cari_id)

        if conditions:
            stmt = select(B2BBayiFiyatlari).where(
                and_(
                    B2BBayiFiyatlari.item_id == item.id,
                    or_(*conditions)
                )
            )
            res = await db.execute(stmt)
            match = res.scalar_one_or_none()
            if match and match.special_price is not None:
                special_price = match.special_price

    if is_bayi and special_price is not None:
        return Decimal(str(special_price)), Decimal(str(special_price))

    list_p = item.list_price if item.list_price is not None else Decimal("0.00")
    return Decimal(str(list_p)), special_price


async def process_order_items_and_inventory(
    db: AsyncSession,
    order: Order,
    items_in: list,
    user: User,
    override_prices: Optional[dict[int, Decimal]] = None
) -> Decimal:
    """
    Tüm stok ve sipariş kalem işlemlerini tek transaction'da yönetir:
    1. Birim fiyatı backend kendisi hesaplar (bayi özel fiyatı veya liste fiyatı). İstemciden gelen fiyat kullanılmaz.
    2. Her kalem için serbest stoğa bakar (fiziksel - rezerv).
       - Yeterliyse FEFO'ya göre partilerden rezerv eder.
       - Eksik miktar varsa o ürün için 'Beklemede - Sipariş Tetikli' üretim emri oluşturur
         ve reçeteye (BOM) göre ham maddeleri rezerve eder.
    3. Her adım stok hareketleri tablosuna (StockMovement) yazılır (kim, ne zaman, hangi emir/sipariş).
    4. Satır kilidi (PostgreSQL'de with_for_update, SQLite'ta serializable) kullanır. Stok eksiye düşemez.
    """
    dialect = db.bind.dialect.name if db.bind else "sqlite"
    is_sqlite = "sqlite" in dialect.lower()

    total_calc = Decimal("0.00")
    items_desc_list = []

    for it_in in items_in:
        item_id = it_in.item_id
        line_qty = Decimal(str(it_in.quantity))
        if line_qty <= Decimal("0.000"):
            continue

        # 1. Fetch Item with pessimistic row lock
        stmt_item = select(Item).where(Item.id == item_id)
        if not is_sqlite:
            stmt_item = stmt_item.with_for_update()
        target_item = (await db.execute(stmt_item)).scalar_one_or_none()
        if not target_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ürün #{item_id} bulunamadı.")

        # Backend birim fiyat hesaplama (İstemciden gelen fiyat KULLANILMAZ; onaylı teklif dönüştürme durumunda override_prices geçerlidir) - Madde 1
        if override_prices and item_id in override_prices:
            unit_price_dec = Decimal(str(override_prices[item_id]))
        else:
            is_b2b = bool(getattr(order, "is_b2b_order", False) or getattr(order, "is_b2b", False))
            unit_price, _ = await get_item_price_for_user(target_item, user, db, cari_id=order.cari_id, is_b2b=is_b2b)
            unit_price_dec = Decimal(str(unit_price))
        line_total = line_qty * unit_price_dec
        total_calc += line_total

        order_item = OrderItem(
            order_id=order.id,
            item_id=target_item.id,
            quantity=line_qty,
            unit_price=unit_price_dec,
            total_price=line_total
        )
        db.add(order_item)
        items_desc_list.append(f"{line_qty} {target_item.unit} {target_item.name} ({unit_price_dec} TL)")

        # 2. Serbest stok kontrolü & FEFO parti rezervasyonu - Madde 2
        stmt_lots = (
            select(BatchLot)
            .where(
                and_(
                    BatchLot.item_id == target_item.id,
                    BatchLot.status.in_(["Serbest", "APPROVED"]),
                    BatchLot.quantity > Decimal("0.000")
                )
            )
            .order_by(
                BatchLot.expiration_date.asc().nulls_last(),
                BatchLot.received_at.asc(),
                BatchLot.id.asc()
            )
        )
        if not is_sqlite:
            stmt_lots = stmt_lots.with_for_update()
        lots = (await db.scalars(stmt_lots)).all()

        physical_stock = sum((lot.quantity for lot in lots), Decimal("0.000"))
        lot_reserved = sum(((lot.rezerv_miktar or Decimal("0.000")) for lot in lots), Decimal("0.000"))
        item_reserved = target_item.rezerv_miktar or Decimal("0.000")
        current_rezerv = max(lot_reserved, item_reserved)
        free_stock = max(Decimal("0.000"), physical_stock - current_rezerv)
        # logging for debugging
        print(f"[ORDER_STOCK_CHECK] Item: {target_item.sku}, Phys: {physical_stock}, LotRez: {lot_reserved}, ItemRez: {item_reserved}, Free: {free_stock}, Req: {line_qty}")

        covered_qty = min(line_qty, free_stock)
        shortage_qty = max(Decimal("0.000"), line_qty - free_stock)

        # Mevcut serbest stoğun FEFO partilerine rezerve edilmesi
        if covered_qty > Decimal("0.000"):
            target_item.rezerv_miktar = (target_item.rezerv_miktar or Decimal("0.000")) + covered_qty
            rem_to_reserve = covered_qty
            for lot in lots:
                if rem_to_reserve <= Decimal("0.000"):
                    break
                lot_free = max(Decimal("0.000"), lot.quantity - (lot.rezerv_miktar or Decimal("0.000")))
                if lot_free <= Decimal("0.000"):
                    continue
                alloc = min(lot_free, rem_to_reserve)
                lot.rezerv_miktar = (lot.rezerv_miktar or Decimal("0.000")) + alloc
                rem_to_reserve -= alloc

                # Stok hareketi kaydı (kim, ne zaman, hangi sipariş) - Madde 3
                db.add(StockMovement(
                    item_id=target_item.id,
                    batch_lot_id=lot.id,
                    movement_type="ORDER_RESERVATION",
                    quantity=alloc,
                    order_id=order.id,
                    user_id=user.id if user else None,
                    performed_by=user.full_name if user else "Sistem",
                    notes=f"Sipariş #{order.id} için FEFO parti rezervasyonu (Lot: {lot.batch_number})"
                ))

        # Eksik miktar varsa: 'Beklemede - Sipariş Tetikli' üretim emri ve BOM hammadde rezervasyonu
        if shortage_qty > Decimal("0.000"):
            # UretimEmri kaydı (siparişe bağlı)
            db.add(UretimEmri(
                order_id=order.id,
                item_id=target_item.id,
                requested_quantity=line_qty,
                shortage_quantity=shortage_qty,
                status="Beklemede - Sipariş Tetikli",
                notes=f"Sipariş #{order.id} için {target_item.name} stok açığı: {shortage_qty} {target_item.unit}."
            ))

            # Reçeteye (BOM) göre hammadde rezervasyonu
            stmt_recipe = (
                select(Recipe)
                .options(
                    selectinload(Recipe.ingredients).selectinload(RecipeIngredient.raw_material)
                )
                .where(Recipe.output_item_id == target_item.id)
            )
            recipe = (await db.scalars(stmt_recipe)).first()

            prod_order_id = None
            if recipe:
                prod_order_no = f"PRD-ORD-{order.id}-{target_item.id}-{uuid.uuid4().hex[:4].upper()}"
                prod_order = ProductionOrder(
                    order_number=prod_order_no,
                    recipe_id=recipe.id,
                    target_quantity=shortage_qty,
                    status=ProductionStatus.PENDING,
                    phase="BEKLEMEDE_SIPARIS_TETIKLI",
                    cari_id=order.cari_id,
                    order_id=order.id,
                    notes=f"Sipariş #{order.id} tetikli üretim emri."
                )
                db.add(prod_order)
                await db.flush()
                prod_order_id = prod_order.id

                base_qty = recipe.base_quantity if recipe.base_quantity and recipe.base_quantity > Decimal("0.000") else Decimal("1000.000")
                scale_factor = shortage_qty / base_qty

                for ing in recipe.ingredients:
                    raw_item_id = ing.raw_material_item_id
                    needed_raw = ing.required_quantity * scale_factor

                    stmt_raw = select(Item).where(Item.id == raw_item_id)
                    if not is_sqlite:
                        stmt_raw = stmt_raw.with_for_update()
                    raw_item = (await db.execute(stmt_raw)).scalar_one_or_none()
                    if raw_item:
                        raw_item.rezerv_miktar = (raw_item.rezerv_miktar or Decimal("0.000")) + needed_raw

                        stmt_raw_lots = (
                            select(BatchLot)
                            .where(
                                and_(
                                    BatchLot.item_id == raw_item_id,
                                    BatchLot.status.in_(["Serbest", "APPROVED"]),
                                    BatchLot.quantity > Decimal("0.000")
                                )
                            )
                            .order_by(
                                BatchLot.expiration_date.asc().nulls_last(),
                                BatchLot.received_at.asc(),
                                BatchLot.id.asc()
                            )
                        )
                        if not is_sqlite:
                            stmt_raw_lots = stmt_raw_lots.with_for_update()
                        raw_lots = (await db.scalars(stmt_raw_lots)).all()

                        rem_raw = needed_raw
                        for r_lot in raw_lots:
                            if rem_raw <= Decimal("0.000"):
                                break
                            r_free = max(Decimal("0.000"), r_lot.quantity - (r_lot.rezerv_miktar or Decimal("0.000")))
                            if r_free <= Decimal("0.000"):
                                continue
                            alloc_r = min(r_free, rem_raw)
                            r_lot.rezerv_miktar = (r_lot.rezerv_miktar or Decimal("0.000")) + alloc_r
                            rem_raw -= alloc_r

                            db.add(StockMovement(
                                item_id=raw_item_id,
                                batch_lot_id=r_lot.id,
                                movement_type="RAW_MATERIAL_RESERVATION",
                                quantity=alloc_r,
                                order_id=order.id,
                                production_order_id=prod_order_id,
                                user_id=user.id if user else None,
                                performed_by=user.full_name if user else "Sistem",
                                notes=f"Sipariş #{order.id} tetikli üretim emri #{prod_order_no} hammadde FEFO rezervasyonu (Lot: {r_lot.batch_number})"
                            ))

                        if rem_raw > Decimal("0.000"):
                            db.add(StockMovement(
                                item_id=raw_item_id,
                                batch_lot_id=None,
                                movement_type="RAW_MATERIAL_RESERVATION",
                                quantity=rem_raw,
                                order_id=order.id,
                                production_order_id=prod_order_id,
                                user_id=user.id if user else None,
                                performed_by=user.full_name if user else "Sistem",
                                notes=f"Sipariş #{order.id} tetikli üretim emri #{prod_order_no} hammadde genel rezervasyonu"
                            ))

            # Üretim bildirim kaydı
            db.add(Notification(
                recipient_role="URETIM",
                title="Eksik stok üretim planlaması",
                message=f"⚠️ Eksik Stok Bildirimi: {target_item.name} için acil üretim planlaması gerekiyor! Eksik miktar: {shortage_qty} {target_item.unit}.",
                event_type="ORDER_STOCK_SHORTAGE",
                reference_module="ORDER",
                reference_id=order.id,
            ))

    if not order.items_summary and items_desc_list:
        order.items_summary = ", ".join(items_desc_list)

    return total_calc


@router.post("/check-stock", response_model=CheckStockResponse)
async def check_order_item_stock(
    payload: CheckStockRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Ürün seçildiğinde çalışan stok kontrol ucu.
    Gelen miktar depodaki serbest stoktan (fiziksel stok - rezerv_miktar) fazlaysa:
    {"status": "insufficient", "available": 100, "message": "Yetersiz stok! Eksik kalan kısım için Üretim İş Emri planlanacaktır."}
    """
    stmt = select(Item).options(selectinload(Item.batches)).where(Item.id == payload.item_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Belirtilen ürün sistemde bulunamadı.")

    # Sum available batch stocks (excluding Bloke, Reddedildi)
    active_batches = [
        b.quantity for b in item.batches
        if b.status not in ["Bloke", "Reddedildi"]
    ]
    physical_stock = sum(active_batches, Decimal("0.000"))
    rezerv = item.rezerv_miktar or Decimal("0.000")
    available_stock = max(Decimal("0.000"), physical_stock - rezerv)

    if payload.quantity > available_stock:
        return CheckStockResponse(
            status="insufficient",
            available=available_stock,
            message="Yetersiz stok! Eksik kalan kısım için Üretim İş Emri planlanacaktır."
        )
    else:
        return CheckStockResponse(
            status="sufficient",
            available=available_stock,
            message="Stok yeterli."
        )


@router.post("/b2b-create", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_b2b_order(
    order_in: OrderB2BCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    STRICT B2B DATA ISOLATION:
    Creates an order strictly bound to the authenticated customer's own cari_id.
    - Rejects request if user has no assigned cari_id.
    - Forces is_b2b_order = True.
    - Saves line items to SiparisKalemleri (OrderItems) and updates item.rezerv_miktar.
    - Automatically initializes a draft production/dispatch planning ticket.
    """
    if not current_user.cari_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="B2B sipariş oluşturabilmek için kullanıcının bir Cari Kart (CariAccount) ile eşleştirilmiş olması zorunludur."
        )

    # Verify CariAccount exists and is active
    stmt = select(CariAccount).where(CariAccount.id == current_user.cari_id)
    res = await db.execute(stmt)
    cari = res.scalar_one_or_none()
    if not cari:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcıya atanmış Cari Kart sistemde bulunamadı."
        )
    if not cari.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cari hesap pasif durumda olduğu için yeni sipariş kabul edilememektedir."
        )

    # Create Order strictly bound to customer's cari_id
    new_order = Order(
        cari_id=current_user.cari_id,
        order_date=datetime.datetime.now(datetime.timezone.utc),
        status="Beklemede",
        is_b2b_order=True,
        total_amount=Decimal("0.00"),
        items_summary=order_in.items_summary,
        notes=order_in.notes
    )
    db.add(new_order)
    await db.flush()

    # Process items, backend pricing, FEFO reservations & deficit production orders (Requirements 1, 2, 3, 4)
    if order_in.items:
        calc_total = await process_order_items_and_inventory(db, new_order, order_in.items, current_user)
        new_order.total_amount = calc_total

    # Automatically generate default Planning ticket
    planning_code = f"PLN-B2B-{new_order.id}-{uuid.uuid4().hex[:6].upper()}"
    new_planning = Planning(
        order_id=new_order.id,
        work_order_no=planning_code,
        target_warehouse="Ana Depo",
        status="Planlandı",
        notes="B2B portal üzerinden otomatik planlama kaydı oluşturuldu."
    )
    db.add(new_planning)
    await db.commit()

    # Refresh with full relationships
    stmt_full = (
        select(Order)
        .options(
            selectinload(Order.planning),
            selectinload(Order.items).selectinload(OrderItem.item)
        )
        .where(Order.id == new_order.id)
    )
    res_full = await db.execute(stmt_full)
    return res_full.scalar_one()


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_standard_order(
    order_in: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    ERP Staff & Admin order entry endpoint with explicit cari_id assignment.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="B2B Müşteri kullanıcıları standart sipariş endpoint'ini kullanamaz. Lütfen '/orders/b2b-create' kullanınız."
        )

    # Verify Cari exists
    stmt = select(CariAccount).where(CariAccount.id == order_in.cari_id)
    res = await db.execute(stmt)
    cari = res.scalar_one_or_none()
    if not cari:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Belirtilen Cari Kart bulunamadı.")

    new_order = Order(
        cari_id=order_in.cari_id,
        order_date=datetime.datetime.now(datetime.timezone.utc),
        status=order_in.status,
        is_b2b_order=order_in.is_b2b_order,
        total_amount=Decimal("0.00"),
        items_summary=order_in.items_summary,
        notes=order_in.notes
    )
    db.add(new_order)
    await db.flush()

    # Process items, backend pricing, FEFO reservations & deficit production orders (Requirements 1, 2, 3, 4)
    if order_in.items:
        calc_total = await process_order_items_and_inventory(db, new_order, order_in.items, current_user)
        new_order.total_amount = calc_total

    planning_code = f"PLN-ORD-{new_order.id}-{uuid.uuid4().hex[:6].upper()}"
    new_planning = Planning(
        order_id=new_order.id,
        work_order_no=planning_code,
        target_warehouse="Ana Depo",
        status="Planlandı"
    )
    db.add(new_planning)
    await db.commit()

    # Refresh with full relationships
    stmt_full = (
        select(Order)
        .options(
            selectinload(Order.planning),
            selectinload(Order.items).selectinload(OrderItem.item)
        )
        .where(Order.id == new_order.id)
    )
    res_full = await db.execute(stmt_full)
    return res_full.scalar_one()


@router.get("", response_model=List[OrderResponse])
async def list_orders(
    cari_id: Optional[int] = Query(None, description="Cari ID filtresi (sadece admin/staff kullanabilir)"),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List orders with mandatory tenant isolation for B2B customers.
    """
    stmt = (
        select(Order)
        .options(
            selectinload(Order.planning),
            selectinload(Order.items).selectinload(OrderItem.item)
        )
        .order_by(desc(Order.created_at))
    )

    # STRICT ISOLATION: Customer can only see their own orders
    if current_user.role == UserRoleEnum.CUSTOMER:
        if not current_user.cari_id:
            return []
        stmt = stmt.where(Order.cari_id == current_user.cari_id)
    else:
        if cari_id is not None:
            stmt = stmt.where(Order.cari_id == cari_id)

    if status_filter:
        stmt = stmt.where(Order.status == status_filter)

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/b2b/my-cari-statement")
async def get_my_b2b_cari_statement(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Allows a B2B customer to securely review their own financial exposure and profile.
    """
    if not current_user.cari_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu kullanıcının atanmış bir Cari Kartı bulunmamaktadır."
        )

    stmt = select(CariAccount).where(CariAccount.id == current_user.cari_id)
    res = await db.execute(stmt)
    cari = res.scalar_one_or_none()
    if not cari:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cari hesap bulunamadı.")

    return {
        "cari_id": cari.id,
        "company_name": cari.title,
        "code": cari.code,
        "current_balance": float(cari.current_balance),
        "open_orders_balance": float(cari.open_orders_balance),
        "credit_limit": float(cari.credit_limit),
        "payment_term_days": cari.payment_term_days,
        "risk_status": cari.risk_status,
        "tax_number": cari.tax_number,
        "phone": cari.phone,
        "email": cari.email,
        "address": cari.address
    }


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order_by_id(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(Order)
        .options(
            selectinload(Order.planning),
            selectinload(Order.items).selectinload(OrderItem.item)
        )
        .where(Order.id == order_id)
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sipariş bulunamadı.")

    if current_user.role == UserRoleEnum.CUSTOMER and order.cari_id != current_user.cari_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yetkisiz erişim: Bu sipariş başka bir cari hesaba aittir."
        )

    return order


@router.patch("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: int,
    order_in: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Staff / Admin update endpoint for order status and details.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Müşteriler onaylanmış sipariş statüsünü doğrudan değiştiremez."
        )

    stmt = (
        select(Order)
        .options(
            selectinload(Order.planning),
            selectinload(Order.items).selectinload(OrderItem.item)
        )
        .where(Order.id == order_id)
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sipariş bulunamadı.")

    if order_in.status is not None:
        order.status = order_in.status
    if order_in.total_amount is not None:
        order.total_amount = order_in.total_amount
    if order_in.items_summary is not None:
        order.items_summary = order_in.items_summary
    if order_in.notes is not None:
        order.notes = order_in.notes

    await db.commit()
    await db.refresh(order)
    return order


@router.patch("/{order_id}/planning", response_model=PlanningResponse)
async def update_order_planning(
    order_id: int,
    plan_in: PlanningUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update target warehouse, shipment date, or planning status.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Müşteriler sevkiyat ve üretim planlama parametrelerini güncelleyemez."
        )

    stmt = select(Planning).where(Planning.order_id == order_id)
    res = await db.execute(stmt)
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Siparişe ait planlama kaydı bulunamadı.")

    if plan_in.target_warehouse is not None:
        plan.target_warehouse = plan_in.target_warehouse
    if plan_in.shipment_date is not None:
        plan.shipment_date = plan_in.shipment_date
    if plan_in.status is not None:
        plan.status = plan_in.status
    if plan_in.notes is not None:
        plan.notes = plan_in.notes

    await db.commit()
    await db.refresh(plan)
    return plan
