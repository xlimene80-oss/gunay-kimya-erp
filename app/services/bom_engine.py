import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel
from fastapi import HTTPException, status
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import BatchLot, Item
from app.models.manufacturing import (
    ProductionOrder,
    Recipe,
    RecipeIngredient,
    ProductionIngredientConsumption,
    ProductionStatus
)

# Quality Status Mapping for Approved Lots
APPROVED_STATUS_KEYWORDS = {"APPROVED", "SERBEST"}
EXCLUDED_STATUS_KEYWORDS = {"QUARANTINE", "KARANTINA", "BLOCKED", "BLOKE", "REJECTED", "REDDEDILDI"}


def is_status_approved(status_val: Optional[str]) -> bool:
    """
    Returns True ONLY if the lot status is explicitly approved/serbest.
    Quarantined, blocked, or rejected lots strictly return False.
    """
    if not status_val:
        return False
    val_upper = status_val.strip().upper()
    if any(ex in val_upper for ex in EXCLUDED_STATUS_KEYWORDS):
        return False
    return any(appr in val_upper for appr in APPROVED_STATUS_KEYWORDS)


def format_qty_display(qty: Decimal) -> str:
    """
    Clean formatting for quantities in error messages and UI:
    e.g. 150 -> '150', 12.5 -> '12.5', 0 -> '0'
    """
    formatted = f"{qty:.3f}".rstrip("0").rstrip(".")
    return formatted if formatted else "0"


class IngredientStockCheckResult(BaseModel):
    raw_material_id: int
    raw_material_name: str
    raw_material_sku: str
    unit: str
    required_qty: float
    available_approved_qty: float
    is_sufficient: bool
    missing_qty: float
    approved_lot_count: int


class BOMValidationSummary(BaseModel):
    is_valid: bool
    order_id: int
    target_quantity: float
    ingredients: List[IngredientStockCheckResult]
    first_missing_component: Optional[str] = None
    error_message: Optional[str] = None


class ConsumptionLineResult(BaseModel):
    raw_material_name: str
    batch_number: str
    quantity_consumed: float
    unit_cost_usd: float
    total_cost_usd: float
    expiration_date: Optional[str] = None


class BOMExecutionResult(BaseModel):
    success: bool
    order_id: int
    order_number: str
    target_quantity: float
    total_material_cost_usd: float
    unit_cost_usd: float
    consumptions: List[ConsumptionLineResult]
    finished_lot_number: str


class BOMEngine:
    """
    Production BOM & FEFO Material Consumption Engine with USD Costing.
    - Strict Quality Gate: Considers ONLY approved ('Serbest' / 'APPROVED') lots.
    - Hard Block: Blocks production with HTTP 400 if stock is deficient by even 1 gram.
    - Dynamic FEFO: Consumes from lots in order of expiration date with split-lot handling.
    - USD Cost Engine: Computes total material and unit cost in USD ($).
    """

    @staticmethod
    async def get_raw_material_unit_cost(db: AsyncSession, lot: BatchLot, raw_item: Optional[Item] = None) -> Decimal:
        """
        Determines the USD ($) unit cost of a raw material lot:
        1. lot.unit_cost_usd (if set > 0)
        2. goods_receipt_item.unit_price (if linked)
        3. raw_item.default_unit_cost_usd (if set > 0)
        4. Standard fallback cost based on raw chemical market benchmark
        """
        if lot.unit_cost_usd and lot.unit_cost_usd > Decimal("0.0000"):
            return lot.unit_cost_usd

        if lot.goods_receipt_item and lot.goods_receipt_item.unit_price and lot.goods_receipt_item.unit_price > Decimal("0.0000"):
            return lot.goods_receipt_item.unit_price

        if raw_item and raw_item.default_unit_cost_usd and raw_item.default_unit_cost_usd > Decimal("0.0000"):
            return raw_item.default_unit_cost_usd

        # Default benchmarks for chemical raw materials in USD/kg
        item_name = (raw_item.name if raw_item else "").upper()
        if "LABSA" in item_name:
            return Decimal("2.1000")
        elif "SLES" in item_name:
            return Decimal("1.8500")
        elif "KOSTIK" in item_name or "NAOH" in item_name:
            return Decimal("0.9500")
        elif "GLISERIN" in item_name:
            return Decimal("1.4000")
        elif "ESANS" in item_name:
            return Decimal("14.5000")
        elif "KOKO" in item_name or "BETAIN" in item_name or "CAPB" in item_name:
            return Decimal("1.7500")
        elif "TUZ" in item_name:
            return Decimal("0.1500")
        elif "SITRIK" in item_name:
            return Decimal("1.3000")
        elif "HIPO" in item_name or "KLOR" in item_name:
            return Decimal("0.4500")
        elif "SU" in item_name:
            return Decimal("0.0100")

        return Decimal("1.5000")

    @classmethod
    async def validate_approved_stock(
        cls,
        db: AsyncSession,
        order: ProductionOrder,
        raise_on_error: bool = True
    ) -> BOMValidationSummary:
        """
        Pre-validates that all raw materials in the BOM have sufficient APPROVED stock.
        If raise_on_error is True, raises HTTP 400 with the exact mandated error message:
        "Hata: Üretim Engellendi! Yetersiz Onaylı Stok. Eksik Bileşen: [Hammadde_Adi] (Gereken: X kg, Kullanılabilir Onaylı Stok: Y kg)"
        """
        if not order.recipe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Üretim emrine ait geçerli bir Reçete (BOM) bulunamadı."
            )

        recipe = order.recipe
        base_qty = recipe.base_quantity if recipe.base_quantity and recipe.base_quantity > Decimal("0.000") else Decimal("1000.000")
        scale_factor = order.target_quantity / base_qty

        ingredients_summary: List[IngredientStockCheckResult] = []
        first_missing_component: Optional[str] = None
        exact_error_message: Optional[str] = None

        for ing in recipe.ingredients:
            raw_item = ing.raw_material
            req_qty = ing.required_quantity * scale_factor
            raw_name = raw_item.name if raw_item else f"Hammadde #{ing.raw_material_item_id}"
            raw_sku = raw_item.sku if raw_item else "HMD"
            unit = raw_item.unit if raw_item else "kg"

            # Fetch all lots for this raw material
            query = (
                select(BatchLot)
                .where(
                    and_(
                        BatchLot.item_id == ing.raw_material_item_id,
                        BatchLot.quantity > Decimal("0.000")
                    )
                )
            )
            all_lots = (await db.scalars(query)).all()

            # Filter ONLY approved lots
            approved_lots = [lot for lot in all_lots if is_status_approved(lot.status)]
            total_approved = sum((lot.quantity for lot in approved_lots), Decimal("0.000"))

            is_suff = total_approved >= req_qty
            missing = Decimal("0.000") if is_suff else (req_qty - total_approved)

            check_item = IngredientStockCheckResult(
                raw_material_id=ing.raw_material_item_id,
                raw_material_name=raw_name,
                raw_material_sku=raw_sku,
                unit=unit,
                required_qty=float(req_qty),
                available_approved_qty=float(total_approved),
                is_sufficient=is_suff,
                missing_qty=float(missing),
                approved_lot_count=len(approved_lots)
            )
            ingredients_summary.append(check_item)

            if not is_suff and not first_missing_component:
                first_missing_component = raw_name
                # MANDATED EXACT ERROR FORMAT:
                # "Hata: Üretim Engellendi! Yetersiz Onaylı Stok. Eksik Bileşen: [Hammadde_Adi] (Gereken: X kg, Kullanılabilir Onaylı Stok: Y kg)"
                exact_error_message = (
                    f"Hata: Üretim Engellendi! Yetersiz Onaylı Stok. Eksik Bileşen: {raw_name} "
                    f"(Gereken: {format_qty_display(req_qty)} kg, Kullanılabilir Onaylı Stok: {format_qty_display(total_approved)} kg)"
                )

        all_valid = all(item.is_sufficient for item in ingredients_summary)

        if not all_valid and raise_on_error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=exact_error_message
            )

        return BOMValidationSummary(
            is_valid=all_valid,
            order_id=order.id,
            target_quantity=float(order.target_quantity),
            ingredients=ingredients_summary,
            first_missing_component=first_missing_component,
            error_message=exact_error_message
        )

    @classmethod
    async def execute_fefo_consumption(
        cls,
        db: AsyncSession,
        order: ProductionOrder
    ) -> BOMExecutionResult:
        """
        Executes dynamic FEFO consumption across approved lots:
        1. Pre-checks approved stock. If missing, aborts immediately (rollback, HTTP 400).
        2. Consumes from lots ordered by expiration_date ASC NULLS LAST, received_at ASC.
        3. Supports split-lot consumption until the required quantity is fully met.
        4. Calculates USD material cost for each consumed lot and totals.
        5. Persists records to ProductionIngredientConsumption.
        6. Updates ProductionOrder and finished good BatchLot with total_material_cost_usd and unit_cost_usd.
        """
        # Step 1: Strict Quality Hard Block Check
        await cls.validate_approved_stock(db, order, raise_on_error=True)

        recipe = order.recipe
        base_qty = recipe.base_quantity if recipe.base_quantity and recipe.base_quantity > Decimal("0.000") else Decimal("1000.000")
        scale_factor = order.target_quantity / base_qty

        total_production_material_cost_usd = Decimal("0.0000")
        consumption_records: List[ConsumptionLineResult] = []

        # Step 2: Dynamic FEFO Deduction per Ingredient
        for ing in recipe.ingredients:
            raw_item = ing.raw_material
            req_qty = ing.required_quantity * scale_factor
            raw_name = raw_item.name if raw_item else f"Hammadde #{ing.raw_material_item_id}"

            # Query approved lots ordered by FEFO
            query = (
                select(BatchLot)
                .where(
                    and_(
                        BatchLot.item_id == ing.raw_material_item_id,
                        BatchLot.quantity > Decimal("0.000")
                    )
                )
                .order_by(
                    BatchLot.expiration_date.asc().nulls_last(),
                    BatchLot.received_at.asc(),
                    BatchLot.id.asc()
                )
            )
            raw_lots = (await db.scalars(query)).all()
            approved_lots = [lot for lot in raw_lots if is_status_approved(lot.status)]

            remaining_to_deduct = req_qty

            for lot in approved_lots:
                if remaining_to_deduct <= Decimal("0.000"):
                    break

                deduct_amount = min(lot.quantity, remaining_to_deduct)
                lot.quantity -= deduct_amount
                remaining_to_deduct -= deduct_amount

                # Determine USD unit cost for this specific lot
                lot_unit_cost_usd = await cls.get_raw_material_unit_cost(db, lot, raw_item)
                line_total_cost_usd = deduct_amount * lot_unit_cost_usd
                total_production_material_cost_usd += line_total_cost_usd

                # Record Greenfield Traceability & Cost Junction
                consumption = ProductionIngredientConsumption(
                    production_order_id=order.id,
                    raw_material_batch_lot_id=lot.id,
                    quantity_consumed=deduct_amount,
                    unit_cost_usd=lot_unit_cost_usd,
                    total_cost_usd=line_total_cost_usd
                )
                db.add(consumption)

                consumption_records.append(ConsumptionLineResult(
                    raw_material_name=raw_name,
                    batch_number=lot.batch_number,
                    quantity_consumed=float(deduct_amount),
                    unit_cost_usd=float(lot_unit_cost_usd),
                    total_cost_usd=float(line_total_cost_usd),
                    expiration_date=lot.expiration_date.strftime("%d.%m.%Y") if lot.expiration_date else None
                ))

            # Extra safety check (should never happen due to pre-validation)
            if remaining_to_deduct > Decimal("0.000"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Hata: Üretim Engellendi! Yetersiz Onaylı Stok. Eksik Bileşen: {raw_name} "
                        f"(Gereken: {format_qty_display(req_qty)} kg, Kullanılabilir Onaylı Stok: {format_qty_display(req_qty - remaining_to_deduct)} kg)"
                    )
                )

        # Step 3: Compute Finished Good USD Unit Cost
        target_qty = order.target_quantity
        unit_cost_usd = (
            total_production_material_cost_usd / target_qty
            if target_qty > Decimal("0.000")
            else Decimal("0.0000")
        )

        order.total_material_cost_usd = total_production_material_cost_usd
        order.unit_cost_usd = unit_cost_usd

        # Step 4: Ensure Finished Good Batch Lot is Created/Updated with USD Cost
        finished_lot_num = order.lot_number or f"LOT-{order.order_number}"
        today = datetime.date.today()
        expiration_date = today + datetime.timedelta(days=730)

        is_outgoing_qc = getattr(recipe.output_item, "qc_outgoing_required", False) if recipe.output_item else False
        out_status = "Karantina" if is_outgoing_qc else "Serbest"
        out_qc_notes = (
            "Dolum tamamlandı: Çıkış kalite kontrol onayı bekleniyor."
            if is_outgoing_qc
            else "Üretim tamamlandı: Serbest."
        )

        output_lot = await db.scalar(
            select(BatchLot).where(
                and_(
                    BatchLot.item_id == recipe.output_item_id,
                    BatchLot.batch_number == finished_lot_num
                )
            )
        )

        if output_lot:
            output_lot.quantity += order.target_quantity
            output_lot.unit_cost_usd = unit_cost_usd
            output_lot.total_material_cost_usd = (output_lot.total_material_cost_usd or Decimal("0.0000")) + total_production_material_cost_usd
            if is_outgoing_qc:
                output_lot.status = "Karantina"
                output_lot.qc_notes = out_qc_notes
        else:
            output_lot = BatchLot(
                batch_number=finished_lot_num,
                item_id=recipe.output_item_id,
                warehouse="Mamul Ürün Deposu",
                quantity=order.target_quantity,
                expiration_date=expiration_date,
                status=out_status,
                qc_notes=out_qc_notes,
                unit_cost_usd=unit_cost_usd,
                total_material_cost_usd=total_production_material_cost_usd
            )
            db.add(output_lot)

        await db.flush()

        return BOMExecutionResult(
            success=True,
            order_id=order.id,
            order_number=order.order_number,
            target_quantity=float(order.target_quantity),
            total_material_cost_usd=float(total_production_material_cost_usd),
            unit_cost_usd=float(unit_cost_usd),
            consumptions=consumption_records,
            finished_lot_number=finished_lot_num
        )
