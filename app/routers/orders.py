import datetime
import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_current_user
from app.models.auth import User, UserRoleEnum
from app.models.cari import CariAccount
from app.models.orders import Order, Planning
from app.schemas.orders import (
    OrderCreate, OrderB2BCreate, OrderUpdate, OrderResponse,
    PlanningCreate, PlanningUpdate, PlanningResponse
)

router = APIRouter(prefix="/orders", tags=["Orders & B2B Portal"])

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
    await db.refresh(new_order)

    return new_order


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

    planning_code = f"PLN-ORD-{new_order.id}-{uuid.uuid4().hex[:6].upper()}"
    new_planning = Planning(
        order_id=new_order.id,
        work_order_no=planning_code,
        target_warehouse="Ana Depo",
        status="Planlandı"
    )
    db.add(new_planning)
    await db.commit()
    await db.refresh(new_order)

    return new_order


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
    stmt = select(Order).options(selectinload(Order.planning)).order_by(desc(Order.created_at))

    # STRICT ISOLATION: Customer can only see their own orders
    if current_user.role == UserRoleEnum.CUSTOMER:
        if not current_user.cari_id:
            return []
        stmt = stmt.where(Order.cari_id == current_user.cari_id)
    else:
        # Staff/Admin can optionally filter by cari_id
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
    stmt = select(Order).options(selectinload(Order.planning)).where(Order.id == order_id)
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sipariş bulunamadı.")

    # STRICT ISOLATION: Prevent B2B cross-tenant data leakage
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

    stmt = select(Order).options(selectinload(Order.planning)).where(Order.id == order_id)
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
