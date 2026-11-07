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
from app.models.inventory import Item, BatchLot
from app.models.orders import Order, Planning, OrderItem, B2BBayiFiyatlari
from app.models.notifications import Notification
from app.models.production_alerts import UretimEmri
from app.schemas.orders import (
    OrderCreate, OrderB2BCreate, OrderUpdate, OrderResponse,
    PlanningCreate, PlanningUpdate, PlanningResponse,
    CheckStockRequest, CheckStockResponse, ProductOrderItemResponse
)

router = APIRouter(prefix="/orders", tags=["Orders & B2B Portal"])


async def queue_production_if_short(
    db: AsyncSession, order: Order, item: Item, quantity: Decimal
) -> None:
    """Create a production work order and inbox notification for only the uncovered quantity."""
    lots = (await db.scalars(select(BatchLot).where(BatchLot.item_id == item.id))).all()
    physical = sum(
        (lot.quantity or Decimal("0") for lot in lots if lot.status not in ("Bloke", "Reddedildi")),
        Decimal("0"),
    )
    available = max(Decimal("0"), physical - (item.rezerv_miktar or Decimal("0")))
    shortage = max(Decimal("0"), quantity - available)
    if shortage <= 0:
        return

    db.add(UretimEmri(
        order_id=order.id,
        item_id=item.id,
        requested_quantity=quantity,
        shortage_quantity=shortage,
        status="Beklemede - Sipariş Tetikli",
        notes=f"Sipariş #{order.id} için {item.name} ürününde eksik stok.",
    ))
    db.add(Notification(
        recipient_role="URETIM",
        title="Eksik stok üretim planlaması",
        message=f"⚠️ Eksik Stok Bildirimi: {item.name} için acil üretim planlaması gerekiyor! Eksik miktar: {shortage} {item.unit}.",
        event_type="ORDER_STOCK_SHORTAGE",
        reference_module="ORDER",
        reference_id=order.id,
    ))


async def get_item_price_for_user(item: Item, user: Optional[User], db: AsyncSession) -> tuple[Decimal, Optional[Decimal]]:
    """
    Returns (effective_price, b2b_special_price_if_exists).
    Rule:
    Giriş yapan kullanıcının rolü B2B Bayi ise, fiyat hesaplama fonksiyonunda
    bayinin özel fiyat tablosunu (B2BBayiFiyatlari) baz al, değilse standart liste fiyatını getir.
    """
    is_bayi = False
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

        conditions = []
        if user.user_code:
            conditions.append(B2BBayiFiyatlari.dealer_code == user.user_code)
        if user.cari_id:
            conditions.append(B2BBayiFiyatlari.cari_id == user.cari_id)

        if conditions:
            stmt = select(B2BBayiFiyatlari).where(
                and_(
                    B2BBayiFiyatlari.item_id == item.id,
                    or_(*conditions)
                )
            )
            res = await db.execute(stmt)
            match = res.scalar_one_or_none()
            if match:
                special_price = match.special_price

    if is_bayi and special_price is not None:
        return special_price, special_price

    list_p = item.list_price if item.list_price is not None else Decimal("0.00")
    return list_p, special_price


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
        total_amount=order_in.total_amount,
        items_summary=order_in.items_summary,
        notes=order_in.notes
    )
    db.add(new_order)
    await db.flush()

    total_calc = Decimal("0.00")
    items_desc_list = []

    if order_in.items:
        for it_in in order_in.items:
            stmt_it = select(Item).where(Item.id == it_in.item_id)
            res_it = await db.execute(stmt_it)
            target_item = res_it.scalar_one_or_none()
            if not target_item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ürün #{it_in.item_id} bulunamadı.")

            # B2B unit prices are always resolved server-side; never trust a price sent by the browser.
            unit_price, _ = await get_item_price_for_user(target_item, current_user, db)

            line_qty = Decimal(str(it_in.quantity))
            unit_price_dec = Decimal(str(unit_price))
            line_total = line_qty * unit_price_dec
            total_calc += line_total

            order_item = OrderItem(
                order_id=new_order.id,
                item_id=target_item.id,
                quantity=line_qty,
                unit_price=unit_price_dec,
                total_price=line_total
            )
            db.add(order_item)

            await queue_production_if_short(db, new_order, target_item, line_qty)

            # Do NOT decrease physical stock immediately; increase reserved quantity
            target_item.rezerv_miktar = (target_item.rezerv_miktar or Decimal("0.000")) + line_qty
            items_desc_list.append(f"{line_qty} {target_item.unit} {target_item.name} ({unit_price_dec} TL)")

    if not new_order.items_summary and items_desc_list:
        new_order.items_summary = ", ".join(items_desc_list)
    new_order.total_amount = total_calc

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
        total_amount=order_in.total_amount,
        items_summary=order_in.items_summary,
        notes=order_in.notes
    )
    db.add(new_order)
    await db.flush()

    total_calc = Decimal("0.00")
    items_desc_list = []

    if order_in.items:
        for it_in in order_in.items:
            stmt_it = select(Item).where(Item.id == it_in.item_id)
            res_it = await db.execute(stmt_it)
            target_item = res_it.scalar_one_or_none()
            if not target_item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ürün #{it_in.item_id} bulunamadı.")

            unit_price = it_in.unit_price
            if unit_price is None or unit_price <= Decimal("0"):
                eff_price, _ = await get_item_price_for_user(target_item, current_user, db)
                unit_price = eff_price

            line_qty = Decimal(str(it_in.quantity))
            unit_price_dec = Decimal(str(unit_price))
            line_total = line_qty * unit_price_dec
            total_calc += line_total

            order_item = OrderItem(
                order_id=new_order.id,
                item_id=target_item.id,
                quantity=line_qty,
                unit_price=unit_price_dec,
                total_price=line_total
            )
            db.add(order_item)

            await queue_production_if_short(db, new_order, target_item, line_qty)

            # Do NOT decrease physical stock immediately; increase reserved quantity
            target_item.rezerv_miktar = (target_item.rezerv_miktar or Decimal("0.000")) + line_qty
            items_desc_list.append(f"{line_qty} {target_item.unit} {target_item.name} ({unit_price_dec} TL)")

    if not new_order.items_summary and items_desc_list:
        new_order.items_summary = ", ".join(items_desc_list)
    if (new_order.total_amount == Decimal("0.00") or new_order.total_amount is None) and total_calc > Decimal("0"):
        new_order.total_amount = total_calc

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
