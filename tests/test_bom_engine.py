import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import asyncio
from decimal import Decimal
import datetime
from fastapi import HTTPException
from app.core.config import async_session_factory
from app.models.inventory import Item, BatchLot, ItemCategory
from app.models.manufacturing import Recipe, RecipeIngredient, ProductionOrder, ProductionStatus
from app.services.bom_engine import BOMEngine
from sqlalchemy import select

async def run_tests():
    print("=== STARTING BOM ENGINE & USD COST VERIFICATION TESTS ===")
    async with async_session_factory() as session:
        # Create a test raw material item
        raw_test = Item(
            sku="TEST-RAW-001",
            name="Test Reaktif Kimyasal A",
            unit="kg",
            category=ItemCategory.RAW_MATERIAL,
            min_stock=Decimal("10.000"),
            default_unit_cost_usd=Decimal("2.5000")
        )
        # Create a test finished product item
        out_test = Item(
            sku="TEST-OUT-001",
            name="Test Sivi Sabun 5L Ozel",
            unit="adet",
            category=ItemCategory.FINISHED_GOOD,
            min_stock=Decimal("5.000")
        )
        session.add_all([raw_test, out_test])
        await session.flush()

        # Create recipe: 100 kg test raw for 1000 kg base
        recipe = Recipe(
            name="Test Recetesi 1000L",
            output_item_id=out_test.id,
            base_quantity=Decimal("1000.000")
        )
        session.add(recipe)
        await session.flush()

        ing = RecipeIngredient(
            recipe_id=recipe.id,
            raw_material_item_id=raw_test.id,
            required_quantity=Decimal("100.000")
        )
        session.add(ing)
        await session.flush()

        # Create Production Order: target_quantity = 500 (needs 50 kg of raw_test)
        order = ProductionOrder(
            order_number="TEST-ORD-001",
            recipe_id=recipe.id,
            target_quantity=Decimal("500.000"),
            status=ProductionStatus.PENDING,
            phase="SIPARIS_ALINDI"
        )
        session.add(order)
        await session.flush()
        await session.refresh(order, ["recipe"])
        await session.refresh(order.recipe, ["ingredients", "output_item"])

        # TEST 1: Zero Stock -> Must Hard Block with exact error
        try:
            await BOMEngine.validate_approved_stock(session, order, raise_on_error=True)
            assert False, "Should have raised HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 400
            expected_msg = "Hata: Üretim Engellendi! Yetersiz Onaylı Stok. Eksik Bileşen: Test Reaktif Kimyasal A (Gereken: 50 kg, Kullanılabilir Onaylı Stok: 0 kg)"
            assert exc.detail == expected_msg, f"Mismatch! Got: {exc.detail}"
            print("[PASSED] Test 1: Exact error message matches!")

        # TEST 2: Stock exists but is in QUARANTINE / BLOCKED -> Must NOT be counted, must Hard Block
        q_lot = BatchLot(
            batch_number="LOT-TEST-Q01",
            item_id=raw_test.id,
            warehouse="Hammadde Deposu",
            quantity=Decimal("100.000"),
            status="Karantina",
            unit_cost_usd=Decimal("2.5000")
        )
        b_lot = BatchLot(
            batch_number="LOT-TEST-B01",
            item_id=raw_test.id,
            warehouse="Hammadde Deposu",
            quantity=Decimal("100.000"),
            status="Bloke",
            unit_cost_usd=Decimal("2.5000")
        )
        session.add_all([q_lot, b_lot])
        await session.flush()

        try:
            await BOMEngine.validate_approved_stock(session, order, raise_on_error=True)
            assert False, "Should have raised HTTPException because only quarantine/blocked lots exist"
        except HTTPException as exc:
            assert exc.status_code == 400
            expected_msg = "Hata: Üretim Engellendi! Yetersiz Onaylı Stok. Eksik Bileşen: Test Reaktif Kimyasal A (Gereken: 50 kg, Kullanılabilir Onaylı Stok: 0 kg)"
            assert exc.detail == expected_msg, f"Mismatch! Got: {exc.detail}"
            print("[PASSED] Test 2: Quarantine/Blocked lots excluded from available stock!")

        # TEST 3: Approved stock exists but is deficient by 1 gram (needs 50 kg, available 49.999 kg)
        appr_lot_low = BatchLot(
            batch_number="LOT-TEST-APP-LOW",
            item_id=raw_test.id,
            warehouse="Hammadde Deposu",
            quantity=Decimal("49.999"),
            status="Serbest",
            unit_cost_usd=Decimal("2.5000"),
            expiration_date=datetime.date.today() + datetime.timedelta(days=100)
        )
        session.add(appr_lot_low)
        await session.flush()

        try:
            await BOMEngine.validate_approved_stock(session, order, raise_on_error=True)
            assert False, "Should have raised HTTPException for 1 gram deficiency"
        except HTTPException as exc:
            assert exc.status_code == 400
            expected_msg = "Hata: Üretim Engellendi! Yetersiz Onaylı Stok. Eksik Bileşen: Test Reaktif Kimyasal A (Gereken: 50 kg, Kullanılabilir Onaylı Stok: 49.999 kg)"
            assert exc.detail == expected_msg, f"Mismatch! Got: {exc.detail}"
            print("[PASSED] Test 3: 1 gram shortage strictly blocked!")

        # TEST 4: Sufficient Stock with Dynamic FEFO Split-Lot Consumption
        appr_lot_earliest = BatchLot(
            batch_number="LOT-TEST-EARLY",
            item_id=raw_test.id,
            warehouse="Hammadde Deposu",
            quantity=Decimal("20.000"),
            status="Serbest",
            unit_cost_usd=Decimal("2.0000"),
            expiration_date=datetime.date.today() + datetime.timedelta(days=30)
        )
        session.add(appr_lot_earliest)
        await session.flush()

        # Validate stock should now succeed
        summary = await BOMEngine.validate_approved_stock(session, order, raise_on_error=True)
        assert summary.is_valid is True
        print("[PASSED] Test 4a: Approved stock validated successfully!")

        # Execute FEFO consumption
        exec_res = await BOMEngine.execute_fefo_consumption(session, order)
        assert exec_res.success is True
        assert appr_lot_earliest.quantity == Decimal("0.000")
        assert appr_lot_low.quantity == Decimal("19.999")
        assert round(exec_res.total_material_cost_usd, 2) == 115.00
        assert round(exec_res.unit_cost_usd, 4) == 0.2300
        assert round(float(order.total_material_cost_usd), 2) == 115.00
        assert round(float(order.unit_cost_usd), 4) == 0.2300
        print("[PASSED] Test 4b: Dynamic FEFO split-lot consumption and USD costing verified!")

        # Clean up test rows
        await session.rollback()
        print("=== ALL BOM ENGINE TESTS COMPLETED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
