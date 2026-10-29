import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_db
from app.models.auth import User
from app.models.inventory import BatchLot, Item
from app.models.manufacturing import (
    ProductionOrder,
    Recipe,
    RecipeIngredient,
    ProductionStatus,
    ProductionIngredientConsumption
)
from app.services.bom_engine import (
    BOMEngine,
    BOMValidationSummary,
    BOMExecutionResult
)
from app.core.security import get_optional_current_user
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/production", tags=["Production & BOM Engine"])


class StockValidationResponse(BaseModel):
    success: bool
    order_id: int
    order_number: str
    target_quantity: float
    is_sufficient: bool
    summary: BOMValidationSummary


class ProductionCostBreakdownItem(BaseModel):
    raw_material_id: int
    raw_material_name: str
    raw_material_sku: str
    batch_number: str
    quantity_consumed: float
    unit: str
    unit_cost_usd: float
    total_cost_usd: float


class ProductionCostBreakdownResponse(BaseModel):
    order_id: int
    order_number: str
    product_name: str
    target_quantity: float
    total_material_cost_usd: float
    unit_cost_usd: float
    finished_lot_number: str
    consumptions: List[ProductionCostBreakdownItem]


class ProductionCostAnalyticsResponse(BaseModel):
    total_production_spend_usd: float
    average_unit_cost_usd: float
    total_produced_volume_kg: float
    completed_orders_count: int
    currency: str = "USD"
    ingredient_spend_breakdown: List[Dict[str, Any]]
    recent_order_costs: List[Dict[str, Any]]


@router.post("/orders/{order_id}/validate-stock", response_model=StockValidationResponse)
async def validate_production_order_stock(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Validates that all raw materials in the BOM have sufficient APPROVED stock in warehouse.
    If even 1 gram is deficient, throws HTTP 400 Bad Request with the required message:
    'Hata: Üretim Engellendi! Yetersiz Onaylı Stok. Eksik Bileşen: [Hammadde_Adi] (Gereken: X kg, Kullanılabilir Onaylı Stok: Y kg)'
    """
    stmt = (
        select(ProductionOrder)
        .options(
            selectinload(ProductionOrder.recipe).selectinload(Recipe.ingredients).selectinload(RecipeIngredient.raw_material),
            selectinload(ProductionOrder.recipe).selectinload(Recipe.output_item)
        )
        .where(ProductionOrder.id == order_id)
    )
    order = await db.scalar(stmt)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID {order_id} olan üretim emri bulunamadı."
        )

    summary = await BOMEngine.validate_approved_stock(db, order, raise_on_error=True)

    return StockValidationResponse(
        success=True,
        order_id=order.id,
        order_number=order.order_number,
        target_quantity=float(order.target_quantity),
        is_sufficient=summary.is_valid,
        summary=summary
    )


@router.post("/orders/{order_id}/consume-fefo", response_model=BOMExecutionResult)
async def trigger_fefo_consumption_endpoint(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Executes dynamic FEFO stock deduction and records exact USD production costs.
    If approved stock is insufficient, transaction is rolled back and HTTP 400 is returned.
    """
    stmt = (
        select(ProductionOrder)
        .options(
            selectinload(ProductionOrder.recipe).selectinload(Recipe.ingredients).selectinload(RecipeIngredient.raw_material),
            selectinload(ProductionOrder.recipe).selectinload(Recipe.output_item)
        )
        .where(ProductionOrder.id == order_id)
    )
    order = await db.scalar(stmt)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID {order_id} olan üretim emri bulunamadı."
        )

    # Check if order already consumed raw materials to prevent double deduction
    existing_consumptions_count = await db.scalar(
        select(func.count(ProductionIngredientConsumption.id))
        .where(ProductionIngredientConsumption.production_order_id == order.id)
    )
    if existing_consumptions_count and existing_consumptions_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bu üretim emri ({order.order_number}) için hammadde stok düşümü daha önce yapılmıştır."
        )

    result = await BOMEngine.execute_fefo_consumption(db, order)

    order.phase = "REAKTORDE"
    order.status = ProductionStatus.IN_PROGRESS
    if not order.lot_number:
        order.lot_number = f"LOT-2026-GNY{order.id:04d}"

    await db.commit()
    await db.refresh(order)

    return result


@router.post("/orders/{order_id}/complete")
async def complete_production_order_endpoint(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Completes production order with full BOM validation and USD costing.
    If FEFO consumption hasn't occurred yet, executes it with quality validation.
    """
    stmt = (
        select(ProductionOrder)
        .options(
            selectinload(ProductionOrder.recipe).selectinload(Recipe.ingredients).selectinload(RecipeIngredient.raw_material),
            selectinload(ProductionOrder.recipe).selectinload(Recipe.output_item),
            selectinload(ProductionOrder.ingredient_consumptions)
        )
        .where(ProductionOrder.id == order_id)
    )
    order = await db.scalar(stmt)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID {order_id} olan üretim emri bulunamadı."
        )

    if order.status == ProductionStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Üretim emri zaten tamamlanmıştır."
        )

    # If consumptions not yet recorded, execute BOM validation and FEFO consumption
    if not order.ingredient_consumptions:
        await BOMEngine.execute_fefo_consumption(db, order)

    order.status = ProductionStatus.COMPLETED
    order.phase = "PAKETLEME_HAZIR"

    await db.commit()
    await db.refresh(order)

    return {
        "success": True,
        "message": f"Üretim emri ({order.order_number}) başarıyla tamamlandı.",
        "order_id": order.id,
        "order_number": order.order_number,
        "total_material_cost_usd": float(order.total_material_cost_usd or Decimal("0.0000")),
        "unit_cost_usd": float(order.unit_cost_usd or Decimal("0.0000")),
        "lot_number": order.lot_number
    }


@router.get("/orders/{order_id}/cost-breakdown", response_model=ProductionCostBreakdownResponse)
async def get_order_cost_breakdown(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns itemized USD ($) cost breakdown of raw materials consumed for a production order.
    """
    stmt = (
        select(ProductionOrder)
        .options(
            selectinload(ProductionOrder.recipe).selectinload(Recipe.output_item),
            selectinload(ProductionOrder.ingredient_consumptions).selectinload(ProductionIngredientConsumption.raw_material_batch_lot).selectinload(BatchLot.item)
        )
        .where(ProductionOrder.id == order_id)
    )
    order = await db.scalar(stmt)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID {order_id} olan üretim emri bulunamadı."
        )

    consumptions_data = []
    total_cost = Decimal("0.0000")

    for c in order.ingredient_consumptions:
        lot = c.raw_material_batch_lot
        item = lot.item if lot else None
        line_total = c.total_cost_usd or (c.quantity_consumed * (c.unit_cost_usd or Decimal("0.0000")))
        total_cost += line_total

        consumptions_data.append(ProductionCostBreakdownItem(
            raw_material_id=item.id if item else 0,
            raw_material_name=item.name if item else "Hammadde",
            raw_material_sku=item.sku if item else "HMD",
            batch_number=lot.batch_number if lot else "-",
            quantity_consumed=float(c.quantity_consumed),
            unit=item.unit if item else "kg",
            unit_cost_usd=float(c.unit_cost_usd or Decimal("0.0000")),
            total_cost_usd=float(line_total)
        ))

    unit_cost = (
        total_cost / order.target_quantity
        if order.target_quantity > Decimal("0.000")
        else Decimal("0.0000")
    )

    product_name = order.recipe.output_item.name if (order.recipe and order.recipe.output_item) else "Kimyasal Mamul"

    return ProductionCostBreakdownResponse(
        order_id=order.id,
        order_number=order.order_number,
        product_name=product_name,
        target_quantity=float(order.target_quantity),
        total_material_cost_usd=float(order.total_material_cost_usd or total_cost),
        unit_cost_usd=float(order.unit_cost_usd or unit_cost),
        finished_lot_number=order.lot_number or f"LOT-{order.order_number}",
        consumptions=consumptions_data
    )


@router.get("/costs/analytics", response_model=ProductionCostAnalyticsResponse)
async def get_production_cost_analytics(
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Finance dashboard metrics for production material costing in USD ($).
    Provides aggregated spend, average unit cost, raw chemical breakdown, and recent orders.
    """
    # 1. Total spend and volume from completed orders
    orders_stmt = (
        select(ProductionOrder)
        .options(
            selectinload(ProductionOrder.recipe).selectinload(Recipe.output_item)
        )
        .where(ProductionOrder.status == ProductionStatus.COMPLETED)
        .order_by(ProductionOrder.created_at.desc())
    )
    completed_orders = (await db.scalars(orders_stmt)).all()

    total_spend = sum((o.total_material_cost_usd or Decimal("0.0000") for o in completed_orders), Decimal("0.0000"))
    total_volume = sum((o.target_quantity for o in completed_orders), Decimal("0.0000"))
    avg_unit_cost = total_spend / total_volume if total_volume > Decimal("0.000") else Decimal("0.0000")

    # 2. Ingredient spend breakdown
    cons_stmt = (
        select(
            Item.name,
            Item.sku,
            func.sum(ProductionIngredientConsumption.quantity_consumed).label("total_qty"),
            func.sum(ProductionIngredientConsumption.total_cost_usd).label("total_cost")
        )
        .join(BatchLot, ProductionIngredientConsumption.raw_material_batch_lot_id == BatchLot.id)
        .join(Item, BatchLot.item_id == Item.id)
        .group_by(Item.id, Item.name, Item.sku)
        .order_by(desc("total_cost"))
        .limit(10)
    )
    ing_rows = (await db.execute(cons_stmt)).all()
    ingredient_spend_breakdown = [
        {
            "name": r.name,
            "sku": r.sku,
            "total_quantity_kg": float(r.total_qty or 0),
            "total_cost_usd": float(r.total_cost or 0)
        }
        for r in ing_rows
    ]

    # 3. Recent order costs
    recent_order_costs = []
    for o in completed_orders[:limit]:
        p_name = o.recipe.output_item.name if (o.recipe and o.recipe.output_item) else "Kimyasal Ürün"
        recent_order_costs.append({
            "order_id": o.id,
            "order_number": o.order_number,
            "product_name": p_name,
            "target_quantity": float(o.target_quantity),
            "total_material_cost_usd": float(o.total_material_cost_usd or Decimal("0.0000")),
            "unit_cost_usd": float(o.unit_cost_usd or Decimal("0.0000")),
            "completed_at": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else None
        })

    return ProductionCostAnalyticsResponse(
        total_production_spend_usd=float(total_spend),
        average_unit_cost_usd=float(avg_unit_cost),
        total_produced_volume_kg=float(total_volume),
        completed_orders_count=len(completed_orders),
        currency="USD",
        ingredient_spend_breakdown=ingredient_spend_breakdown,
        recent_order_costs=recent_order_costs
    )
