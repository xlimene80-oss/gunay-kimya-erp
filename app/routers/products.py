from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_optional_current_user
from app.models.auth import User
from app.models.inventory import Item, ItemCategory, BatchLot
from app.schemas.orders import ProductOrderItemResponse
from app.routers.orders import get_item_price_for_user

router = APIRouter(prefix="/products", tags=["Products Catalog"])

@router.get("", response_model=List[ProductOrderItemResponse])
async def list_products_for_orders(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
    category: Optional[str] = Query(default=None, description="Filter by category")
):
    """
    GET /api/products
    Sipariş ekranları için mamul ve ürünleri listeler.
    Kullanıcı rolüne göre (B2B Bayi ise B2BBayiFiyatlari tablosundan özel fiyatı) otomatik hesaplar.
    Depo stok ve rezerv miktarlarını döndürür.
    """
    stmt = select(Item).options(selectinload(Item.batches)).where(Item.is_active == True)
    
    # Safe check for string category filter
    if category is not None and isinstance(category, str) and category.strip():
        cat_map = {
            "Mamul": ItemCategory.FINISHED_GOOD,
            "Finished Good": ItemCategory.FINISHED_GOOD,
            "Hammadde": ItemCategory.RAW_MATERIAL,
            "Raw Material": ItemCategory.RAW_MATERIAL,
        }
        target_cat = cat_map.get(category.strip(), category.strip())
        stmt = stmt.where(Item.category == target_cat)
    else:
        # Default to Finished Goods & sellable raw materials
        stmt = stmt.where(
            or_(
                Item.category == ItemCategory.FINISHED_GOOD,
                Item.category == ItemCategory.RAW_MATERIAL
            )
        )

    stmt = stmt.order_by(Item.sku.asc())
    res = await db.execute(stmt)
    items = res.scalars().all()

    results: List[ProductOrderItemResponse] = []
    for item in items:
        effective_price, special_price = await get_item_price_for_user(item, current_user, db)

        active_batches = [
            b.quantity for b in item.batches
            if b.status not in ["Bloke", "Reddedildi"]
        ]
        physical_stock = sum(active_batches, Decimal("0.000"))
        rezerv = item.rezerv_miktar or Decimal("0.000")
        available_stock = max(Decimal("0.000"), physical_stock - rezerv)

        results.append(ProductOrderItemResponse(
            id=item.id,
            sku=item.sku,
            name=item.name,
            unit=item.unit or "adet",
            category=str(item.category.value if hasattr(item.category, "value") else item.category),
            list_price=item.list_price or Decimal("0.00"),
            unit_price=effective_price,
            b2b_price=special_price,
            stock=physical_stock,
            rezerv_miktar=rezerv,
            available_stock=available_stock,
            in_stock=(available_stock > Decimal("0.000"))
        ))

    return results
