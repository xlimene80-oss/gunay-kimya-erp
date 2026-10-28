import datetime
import random
import xml.etree.ElementTree as ET
from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from pydantic import BaseModel
from app.models.inventory import (
    Item, BatchLot, ItemCategory,
    GoodsReceipt, GoodsReceiptItem,
    StockTransfer, StockTransferItem,
    DispatchOrder, DispatchItem, DispatchStatus,
    BarcodeUnit, BarcodeType, BarcodeStatus
)
from app.models.cari import CariAccount
from app.models.manufacturing import ProductionOrder
from app.models.hazmat import WarehouseBin, WarehouseZone, WarehousePlacementAudit
from app.core.events import trigger_dispatch_shipped_event
from app.schemas.inventory import (
    ItemCreate, ItemUpdate, ItemResponse, BatchLotCreate, BatchLotResponse,
    GoodsReceiptCreate, GoodsReceiptResponse,
    StockTransferCreate, StockTransferResponse,
    DispatchOrderCreate, DispatchOrderResponse, DispatchShipResponse,
    VerifyScanRequest, VerifyScanResponse, FinalizeDispatchResponse, BarcodeUnitResponse,
    CarrierUpdateRequest, WaybillResponseSchema, WaybillItemSchema,
    XmlParseRequest, DespatchLinePreview, DespatchAdvicePreviewResponse,
    ConfirmReceiptRequest, GoodsReceiptHistorySummary, StockSummaryItem
)

router = APIRouter(tags=["Inventory, Warehouse & Logistics"])

# ---------------------------------------------------------
# B2B Portal Webhook / Notification Trigger Helper
# ---------------------------------------------------------
def trigger_b2b_portal_notification(dispatch: DispatchOrder) -> Dict[str, Any]:
    """
    Placeholder webhook notification triggered for B2B portal integration
    when an order is marked as SHIPPED.
    """
    payload = {
        "event": "DISPATCH_SHIPPED",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "dispatch_number": dispatch.dispatch_number,
        "cari_id": dispatch.cari_id,
        "dealer_title": dispatch.cari.title if dispatch.cari else "Valued Client",
        "warehouse": dispatch.warehouse,
        "delivery_address": dispatch.delivery_address,
        "carrier_tracking_code": dispatch.carrier_tracking_code,
        "total_items": len(dispatch.items),
        "items": [
            {
                "sku": item.item.sku if item.item else f"ITEM-{item.item_id}",
                "name": item.item.name if item.item else "Product",
                "quantity": float(item.quantity),
                "batch_lot": item.batch_lot.batch_number if item.batch_lot else "Allocated"
            }
            for item in dispatch.items
        ]
    }
    # In production, this can invoke an async httpx client or message queue
    return payload


# ---------------------------------------------------------
# SKU Master & Batch Lot Endpoints
# ---------------------------------------------------------
@router.get("/items/", response_model=List[ItemResponse])
async def list_items(
    category: Optional[str] = Query(None, description="Filter by category (e.g. Raw Material, Intermediate, Finished Good, Packaging)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    q: Optional[str] = Query(None, description="Search term for SKU, name, or CAS number"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """List all chemical/product SKUs with search and filtering."""
    query = select(Item)
    if category:
        # Support both Turkish labels and Enum names
        cat_map = {
            "Hammadde": ItemCategory.RAW_MATERIAL,
            "Raw Material": ItemCategory.RAW_MATERIAL,
            "Yarı Mamul": ItemCategory.INTERMEDIATE,
            "Intermediate": ItemCategory.INTERMEDIATE,
            "Mamul": ItemCategory.FINISHED_GOOD,
            "Finished Good": ItemCategory.FINISHED_GOOD,
            "Ambalaj": ItemCategory.PACKAGING,
            "Packaging": ItemCategory.PACKAGING,
        }
        target_cat = cat_map.get(category, category)
        query = query.where(Item.category == target_cat)

    if is_active is not None:
        query = query.where(Item.is_active == is_active)

    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.where(
            or_(
                Item.sku.ilike(search_pattern),
                Item.name.ilike(search_pattern),
                Item.cas_number.ilike(search_pattern)
            )
        )

    query = query.order_by(Item.id.desc()).offset(skip).limit(limit)
    result = await db.scalars(query)
    return list(result.all())

@router.get("/items/{id}", response_model=ItemResponse)
async def get_item(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve single item by ID."""
    item = await db.get(Item, id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {id} not found."
        )
    return item

@router.post("/items/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new SKU item (Raw Material, Intermediate, Finished Good, or Packaging)."""
    existing_item = await db.scalar(select(Item).where(Item.sku == payload.sku.strip()))
    if existing_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Item with SKU '{payload.sku}' already exists."
        )

    item = Item(
        sku=payload.sku.strip(),
        name=payload.name.strip(),
        unit=payload.unit,
        category=payload.category,
        cas_number=payload.cas_number.strip() if payload.cas_number else None,
        density=payload.density,
        min_stock=payload.min_stock,
        shelf_life_days=payload.shelf_life_days,
        hazard_class=payload.hazard_class.strip() if payload.hazard_class else None,
        is_active=payload.is_active
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.put("/items/{id}", response_model=ItemResponse)
async def update_item(
    id: int,
    payload: ItemUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update item fields."""
    item = await db.get(Item, id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {id} not found."
        )

    if payload.sku and payload.sku.strip() != item.sku:
        existing = await db.scalar(select(Item).where(Item.sku == payload.sku.strip()))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item with SKU '{payload.sku}' already exists."
            )
        item.sku = payload.sku.strip()

    if payload.name is not None:
        item.name = payload.name.strip()
    if payload.unit is not None:
        item.unit = payload.unit
    if payload.category is not None:
        item.category = payload.category
    if payload.cas_number is not None:
        item.cas_number = payload.cas_number.strip() if payload.cas_number else None
    if payload.density is not None:
        item.density = payload.density
    if payload.min_stock is not None:
        item.min_stock = payload.min_stock
    if payload.shelf_life_days is not None:
        item.shelf_life_days = payload.shelf_life_days
    if payload.hazard_class is not None:
        item.hazard_class = payload.hazard_class.strip() if payload.hazard_class else None
    if payload.is_active is not None:
        item.is_active = payload.is_active

    await db.commit()
    await db.refresh(item)
    return item

@router.patch("/items/{id}/toggle-active", response_model=ItemResponse)
async def toggle_item_active(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Toggle item active/passive status (soft deactivation)."""
    item = await db.get(Item, id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {id} not found."
        )
    item.is_active = not item.is_active
    await db.commit()
    await db.refresh(item)
    return item

@router.get("/items/{id}/batch-lots/", response_model=List[BatchLotResponse])
async def get_item_batch_lots(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Track dynamic batches and monitor expiration dates for a specific chemical/SKU item."""
    item = await db.get(Item, id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {id} not found."
        )

    query = (
        select(BatchLot)
        .where(BatchLot.item_id == id)
        .order_by(BatchLot.expiration_date.asc().nulls_last(), BatchLot.received_at.asc())
    )
    result = await db.scalars(query)
    return list(result.all())

@router.post("/items/batch-lots/", response_model=BatchLotResponse, status_code=status.HTTP_201_CREATED)
async def receive_batch_lot(
    payload: BatchLotCreate,
    db: AsyncSession = Depends(get_db)
):
    """Receive a raw material or packaging batch lot into warehouse stock."""
    item = await db.get(Item, payload.item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {payload.item_id} does not exist."
        )

    batch_lot = BatchLot(
        batch_number=payload.batch_number,
        item_id=payload.item_id,
        warehouse=payload.warehouse,
        quantity=payload.quantity,
        expiration_date=payload.expiration_date,
        received_at=payload.received_at
    )
    db.add(batch_lot)
    await db.commit()
    await db.refresh(batch_lot)
    return batch_lot


# ---------------------------------------------------------
# UBL-TR XML Parsing Helpers (Namespace-agnostic)
# ---------------------------------------------------------
def _clean_tag(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag

def _find_sub(elem, name: str):
    if elem is None:
        return None
    for child in elem:
        if _clean_tag(child.tag) == name:
            return child
    return None

def _find_all_sub(elem, name: str):
    if elem is None:
        return []
    return [child for child in elem if _clean_tag(child.tag) == name]

def _get_text(elem, default: str = "") -> str:
    if elem is not None and elem.text:
        return elem.text.strip()
    return default


# ---------------------------------------------------------
# 1. Mal Kabul / Goods Receipt (Satın Alma Giriş & UBL-TR e-İrsaliye)
# ---------------------------------------------------------
@router.post("/inventory/goods-receipt/parse-xml", response_model=DespatchAdvicePreviewResponse)
async def parse_ubl_despatch_advice(
    payload: XmlParseRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Parses UBL-TR / UBL 2.1 DespatchAdvice XML irsaliye payload.
    Extracts dispatch metadata, supplier VKN, and line items.
    Matches supplier against CariAccount and items against inventory Item master catalog.
    Validates against duplicate acceptance.
    """
    raw_xml = payload.xml_content.strip()
    if not raw_xml:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="XML içeriği boş olamaz. Lütfen geçerli bir e-İrsaliye XML dosyası yükleyiniz."
        )

    try:
        root = ET.fromstring(raw_xml)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"XML dosyası ayrıştırılamadı. Dosya bozuk veya geçersiz karakter içeriyor: {str(e)}"
        )

    root_tag = _clean_tag(root.tag)
    if root_tag != "DespatchAdvice":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Geçersiz dosya formatı: Beklenen kök eleman 'DespatchAdvice', ancak '{root_tag}' bulundu. Lütfen UBL-TR DespatchAdvice (e-İrsaliye) dosyası yükleyiniz."
        )

    # Dispatch ID
    dispatch_id = _get_text(_find_sub(root, "ID"))
    if not dispatch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="İrsaliye numarası (cbc:ID) bulunamadı. Lütfen geçerli bir e-İrsaliye dosyası yükleyiniz."
        )

    # Issue Date
    issue_date_str = _get_text(_find_sub(root, "IssueDate"))
    if not issue_date_str:
        issue_date_str = datetime.date.today().isoformat()

    try:
        issue_date_obj = datetime.date.fromisoformat(issue_date_str)
    except Exception:
        issue_date_obj = datetime.date.today()
        issue_date_str = issue_date_obj.isoformat()

    # Supplier Info (cac:DespatchSupplierParty)
    despatch_supplier = _find_sub(root, "DespatchSupplierParty")
    supplier_party = _find_sub(despatch_supplier, "Party") if despatch_supplier is not None else None

    supplier_vkn = None
    supplier_name = "Bilinmeyen Tedarikçi"

    if supplier_party is not None:
        party_ident = _find_sub(supplier_party, "PartyIdentification")
        if party_ident is not None:
            supplier_vkn = _get_text(_find_sub(party_ident, "ID"))

        party_name_elem = _find_sub(supplier_party, "PartyName")
        if party_name_elem is not None:
            s_name = _get_text(_find_sub(party_name_elem, "Name"))
            if s_name:
                supplier_name = s_name

    # Check Duplicate in GoodsReceipt
    existing_receipt = await db.scalar(
        select(GoodsReceipt).where(GoodsReceipt.dispatch_note_number == dispatch_id)
    )
    is_duplicate = existing_receipt is not None
    duplicate_message = "Bu irsaliye daha önce kabul edilmiş" if is_duplicate else None

    # Supplier matching against CariAccount
    matched_supplier = None
    if supplier_vkn:
        stmt = select(CariAccount).where(CariAccount.tax_number == supplier_vkn)
        matched_supplier = await db.scalar(stmt)

    if not matched_supplier and supplier_name:
        # Search by title prefix
        first_word = supplier_name.split()[0] if supplier_name.split() else supplier_name
        stmt = select(CariAccount).where(CariAccount.title.ilike(f"%{first_word}%"))
        matched_supplier = await db.scalar(stmt)

    # Parse Lines
    despatch_lines = _find_all_sub(root, "DespatchLine")
    if not despatch_lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="İrsaliye belgesinde hiç ürün satırı (cac:DespatchLine) bulunamadı."
        )

    # Fetch active items from master catalog
    active_items = (await db.scalars(select(Item).where(Item.is_active == True))).all()

    line_previews: List[DespatchLinePreview] = []
    today_year = datetime.date.today().year

    for idx, d_line in enumerate(despatch_lines):
        line_id = _get_text(_find_sub(d_line, "ID"), str(idx + 1))
        
        qty_elem = _find_sub(d_line, "DeliveredQuantity")
        qty_val = Decimal("1.000")
        unit_code = "kg"
        if qty_elem is not None:
            raw_qty = _get_text(qty_elem, "1.000")
            try:
                qty_val = Decimal(raw_qty)
            except Exception:
                qty_val = Decimal("1.000")
            unit_code = qty_elem.attrib.get("unitCode", "kg")

        # Map common UBL unit codes
        if unit_code.upper() in ["KGM", "KG"]:
            unit_code = "kg"
        elif unit_code.upper() in ["LTR", "L", "LT"]:
            unit_code = "L"
        elif unit_code.upper() in ["C62", "NIU", "H87", "ADET", "PCS"]:
            unit_code = "adet"

        item_elem = _find_sub(d_line, "Item")
        raw_item_name = _get_text(_find_sub(item_elem, "Name")) if item_elem is not None else f"Kalem #{line_id}"
        
        sellers_id = None
        if item_elem is not None:
            sellers_ident = _find_sub(item_elem, "SellersItemIdentification")
            if sellers_ident is not None:
                sellers_id = _get_text(_find_sub(sellers_ident, "ID"))

        lot_number = None
        expiry_date = None
        if item_elem is not None:
            item_instance = _find_sub(item_elem, "ItemInstance")
            if item_instance is not None:
                lot_ident = _find_sub(item_instance, "LotIdentification")
                if lot_ident is not None:
                    lot_number = _get_text(_find_sub(lot_ident, "LotNumberID"))
                    expiry_date = _get_text(_find_sub(lot_ident, "ExpiryDate"))

        # Match Item in DB catalog
        matched_item = None
        if sellers_id:
            for it in active_items:
                if it.sku.strip().upper() == sellers_id.strip().upper():
                    matched_item = it
                    break

        if not matched_item and raw_item_name:
            norm_raw = raw_item_name.lower()
            for it in active_items:
                norm_db = it.name.lower()
                if it.sku.lower() in norm_raw or norm_db in norm_raw or norm_raw in norm_db:
                    matched_item = it
                    break

        # Generate suggested lot number if missing
        suggested_lot = lot_number if lot_number else f"LOT-{today_year}-{100 + idx + 1:03d}"

        # Calculate suggested expiration date
        if expiry_date:
            suggested_expiry = expiry_date
        elif matched_item and matched_item.shelf_life_days:
            suggested_expiry = (issue_date_obj + datetime.timedelta(days=matched_item.shelf_life_days)).isoformat()
        else:
            suggested_expiry = (issue_date_obj + datetime.timedelta(days=365)).isoformat()

        line_previews.append(
            DespatchLinePreview(
                line_number=line_id,
                item_name=raw_item_name,
                seller_item_code=sellers_id,
                delivered_quantity=qty_val,
                unit_code=unit_code,
                lot_number=lot_number,
                expiry_date=expiry_date,
                matched_item_id=matched_item.id if matched_item else None,
                matched_item_sku=matched_item.sku if matched_item else None,
                matched_item_name=matched_item.name if matched_item else None,
                matched_item_unit=matched_item.unit if matched_item else None,
                suggested_lot_number=suggested_lot,
                suggested_expiry_date=suggested_expiry
            )
        )

    return DespatchAdvicePreviewResponse(
        dispatch_number=dispatch_id,
        issue_date=issue_date_str,
        supplier_vkn=supplier_vkn,
        supplier_name=supplier_name,
        matched_supplier_id=matched_supplier.id if matched_supplier else None,
        matched_supplier_title=matched_supplier.title if matched_supplier else None,
        is_supplier_matched=matched_supplier is not None,
        is_duplicate=is_duplicate,
        duplicate_message=duplicate_message,
        lines=line_previews
    )


@router.post("/inventory/goods-receipt/confirm", response_model=GoodsReceiptResponse, status_code=status.HTTP_201_CREATED)
async def confirm_goods_receipt(
    payload: ConfirmReceiptRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Confirms supplier goods receipt from DespatchAdvice XML:
    1. Validates against duplicate submission: If dispatch number exists for supplier, blocks with 400.
    2. Writes GoodsReceipt record and line items.
    3. Increments/creates BatchLot in target warehouse with FEFO expiry date.
    """
    dispatch_clean = payload.dispatch_number.strip()
    existing_receipt = await db.scalar(
        select(GoodsReceipt).where(GoodsReceipt.dispatch_note_number == dispatch_clean)
    )
    if existing_receipt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu irsaliye daha önce kabul edilmiş"
        )

    if not payload.lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="En az bir ürün satırı kabul edilmelidir."
        )

    receipt_date = payload.issue_date or datetime.date.today()
    receipt_datetime = datetime.datetime.combine(receipt_date, datetime.time.min)
    unique_receipt_no = f"GR-{datetime.date.today().strftime('%Y%m%d')}-{random.randint(1000, 9999)}"

    receipt = GoodsReceipt(
        receipt_number=unique_receipt_no,
        supplier_id=payload.supplier_id,
        supplier_name=payload.supplier_name.strip(),
        dispatch_note_number=dispatch_clean,
        target_warehouse=payload.target_warehouse,
        receipt_date=receipt_datetime,
        notes=payload.notes or "Tedarikçi e-İrsaliyesi (UBL-TR DespatchAdvice) ile depoya kabul edildi."
    )
    db.add(receipt)
    await db.flush()

    for line in payload.lines:
        item = await db.get(Item, line.item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Seçilen ürün ID={line.item_id} veritabanında bulunamadı."
            )

        batch_num = line.batch_number.strip()
        gr_item = GoodsReceiptItem(
            goods_receipt_id=receipt.id,
            item_id=line.item_id,
            batch_number=batch_num,
            quantity=line.quantity,
            expiration_date=line.expiration_date,
            unit_price=line.unit_price or Decimal("0.0000")
        )
        db.add(gr_item)
        await db.flush()

        # Determine lot status based on incoming QC requirement
        is_qc_req = getattr(item, "qc_incoming_required", False)
        lot_status = "Karantina" if is_qc_req else "Serbest"
        qc_note = "Mal kabul girişi: Giriş kalite kontrol onayı bekleniyor." if is_qc_req else "Mal kabul girişi: Serbest."

        # Determine shelf/bin: user selection or auto-suggest based on storage class / quarantine
        chosen_bin_id = getattr(line, "bin_id", None)
        chosen_bin_code = getattr(line, "bin_code", None)
        if chosen_bin_id and not chosen_bin_code:
            target_bin = await db.get(WarehouseBin, chosen_bin_id)
            if target_bin:
                chosen_bin_code = target_bin.code

        if not chosen_bin_id:
            if lot_status == "Karantina":
                q_bin = await db.scalar(
                    select(WarehouseBin).join(WarehouseZone).where(
                        WarehouseZone.storage_class == "Karantina",
                        WarehouseBin.is_active == True
                    ).limit(1)
                )
                if q_bin:
                    chosen_bin_id = q_bin.id
                    chosen_bin_code = q_bin.code
            else:
                st_class = getattr(item, "storage_class", "Genel") or "Genel"
                m_bin = await db.scalar(
                    select(WarehouseBin).join(WarehouseZone).where(
                        WarehouseZone.storage_class == st_class,
                        WarehouseBin.is_active == True
                    ).limit(1)
                )
                if m_bin:
                    chosen_bin_id = m_bin.id
                    chosen_bin_code = m_bin.code

        # Update or create BatchLot in warehouse
        batch_stmt = select(BatchLot).where(
            and_(
                BatchLot.item_id == line.item_id,
                BatchLot.batch_number == batch_num,
                BatchLot.warehouse == payload.target_warehouse
            )
        )
        existing_batch = await db.scalar(batch_stmt)
        if existing_batch:
            existing_batch.quantity += line.quantity
            if line.expiration_date:
                existing_batch.expiration_date = line.expiration_date
            if is_qc_req:
                existing_batch.status = "Karantina"
                existing_batch.qc_notes = qc_note
            if chosen_bin_id:
                existing_batch.bin_id = chosen_bin_id
                existing_batch.bin_code = chosen_bin_code
            lot_rec_id = existing_batch.id
        else:
            new_batch = BatchLot(
                batch_number=batch_num,
                item_id=line.item_id,
                warehouse=payload.target_warehouse,
                quantity=line.quantity,
                expiration_date=line.expiration_date,
                goods_receipt_item_id=gr_item.id,
                status=lot_status,
                qc_notes=qc_note,
                bin_id=chosen_bin_id,
                bin_code=chosen_bin_code
            )
            db.add(new_batch)
            await db.flush()
            lot_rec_id = new_batch.id

        # Log placement audit
        if chosen_bin_code:
            audit = WarehousePlacementAudit(
                batch_lot_id=lot_rec_id,
                lot_number=batch_num,
                item_id=item.id,
                item_name=item.name,
                action_type="MAL_KABUL_PLACEMENT",
                new_bin_id=chosen_bin_id,
                new_bin_code=chosen_bin_code,
                item_storage_class=getattr(item, "storage_class", "Genel"),
                override_reason=line.override_reason or "Mal kabul ile otomatik/seçilen rafa yerleştirildi.",
                user_name=current_user.full_name if current_user and hasattr(current_user, "full_name") else "Sistem / Mal Kabul Yetkilisi",
                user_email=current_user.email if current_user and hasattr(current_user, "email") else "malkabul@gunaykimya.com"
            )
            db.add(audit)

    await db.commit()

    stmt = (
        select(GoodsReceipt)
        .options(
            selectinload(GoodsReceipt.items).selectinload(GoodsReceiptItem.item)
        )
        .where(GoodsReceipt.id == receipt.id)
    )
    result = await db.scalar(stmt)
    return result


@router.get("/inventory/goods-receipt/history", response_model=List[GoodsReceiptHistorySummary])
async def list_goods_receipt_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns history of goods receipts with line count and total quantities.
    """
    stmt = (
        select(GoodsReceipt)
        .options(selectinload(GoodsReceipt.items))
        .order_by(GoodsReceipt.id.desc())
        .offset(skip)
        .limit(limit)
    )
    receipts = (await db.scalars(stmt)).all()
    history: List[GoodsReceiptHistorySummary] = []
    for r in receipts:
        total_qty = sum(it.quantity for it in r.items)
        history.append(
            GoodsReceiptHistorySummary(
                id=r.id,
                receipt_number=r.receipt_number,
                dispatch_note_number=r.dispatch_note_number,
                supplier_id=r.supplier_id,
                supplier_name=r.supplier_name,
                target_warehouse=r.target_warehouse,
                receipt_date=r.receipt_date or r.received_at,
                item_count=len(r.items),
                total_quantity=total_qty,
                status="Depoya Kabul Edildi",
                created_at=r.created_at
            )
        )
    return history


@router.get("/inventory/stock-summary", response_model=List[StockSummaryItem])
async def get_stock_summary(
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns actual live physical inventory stock grouped by Item,
    ordered by FEFO (earliest expiring active batches first).
    """
    stmt = select(Item).options(selectinload(Item.batches)).where(Item.is_active == True).order_by(Item.id.asc())
    items = (await db.scalars(stmt)).all()

    result: List[StockSummaryItem] = []
    for it in items:
        valid_batches = [b for b in it.batches if b.quantity > 0]
        # Sort FEFO: earliest expiry first
        valid_batches.sort(key=lambda b: (b.expiration_date or datetime.date(2099, 12, 31)))

        total_qty = sum(b.quantity for b in valid_batches)
        earliest_batch = valid_batches[0] if valid_batches else None

        daily_cons = Decimal("180")
        if it.sku == "SLES-70":
            daily_cons = Decimal("450")
        elif it.sku == "LABSA-96":
            daily_cons = Decimal("190")
        elif it.sku == "NAOH-48":
            daily_cons = Decimal("95")
        elif it.sku == "GLIS-99":
            daily_cons = Decimal("60")
        elif it.sku == "SU-ARIT":
            daily_cons = Decimal("850")
        elif it.category == ItemCategory.FINISHED_GOOD:
            daily_cons = Decimal("25")

        cat_str = it.category.value if hasattr(it.category, "value") else str(it.category)
        default_wh = "Hammadde Deposu" if it.category == ItemCategory.RAW_MATERIAL else "Mamul Ürün Deposu"

        bin_code_val = earliest_batch.bin_code if earliest_batch else None
        zone_name_val = None
        if earliest_batch and getattr(earliest_batch, "bin", None) and earliest_batch.bin.zone:
            zone_name_val = earliest_batch.bin.zone.name

        result.append(
            StockSummaryItem(
                id=it.id,
                sku=it.sku,
                name=it.name,
                unit=it.unit,
                category=cat_str,
                cas_number=it.cas_number,
                density=it.density,
                min_safety_stock=it.min_stock,
                warehouse=valid_batches[0].warehouse if valid_batches else default_wh,
                current_quantity=total_qty,
                daily_consumption=daily_cons,
                fefo_lot=earliest_batch.batch_number if earliest_batch else None,
                fefo_lot_id=earliest_batch.id if earliest_batch else None,
                fefo_lot_status=getattr(earliest_batch, "status", "Serbest") if earliest_batch else None,
                fefo_expiry=earliest_batch.expiration_date.strftime("%Y-%m-%d") if (earliest_batch and earliest_batch.expiration_date) else None,
                bin_id=earliest_batch.bin_id if earliest_batch else None,
                bin_code=bin_code_val,
                zone_name=zone_name_val,
                storage_class=getattr(it, "storage_class", "Genel") or "Genel",
                hazard_class=it.hazard_class,
                signal_word=it.signal_word,
                ghs_pictograms=it.ghs_pictograms,
                sds_file_url=it.sds_file_url,
                sds_revision_date=str(it.sds_revision_date) if it.sds_revision_date else None,
                batches=[BatchLotResponse.model_validate(b) for b in valid_batches]
            )
        )
    return result


@router.post("/inventory/goods-receipt", response_model=GoodsReceiptResponse, status_code=status.HTTP_201_CREATED)
async def process_goods_receipt(
    payload: GoodsReceiptCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Processes supplier goods receipt for raw chemical materials.
    Automatically assigns/generates BatchLot numbers and increments physical warehouse stock.
    Executed in an atomic transaction.
    """
    existing_receipt = await db.scalar(
        select(GoodsReceipt).where(GoodsReceipt.receipt_number == payload.receipt_number)
    )
    if existing_receipt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Goods receipt with number '{payload.receipt_number}' already exists."
        )

    receipt = GoodsReceipt(
        receipt_number=payload.receipt_number,
        supplier_id=payload.supplier_id,
        supplier_name=payload.supplier_name,
        invoice_number=payload.invoice_number,
        dispatch_note_number=payload.dispatch_note_number,
        purchase_order_number=payload.purchase_order_number,
        target_warehouse=payload.target_warehouse,
        notes=payload.notes
    )
    db.add(receipt)
    await db.flush()

    today_str = datetime.date.today().strftime("%Y%m%d")

    for idx, item_in in enumerate(payload.items):
        item = await db.get(Item, item_in.item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {item_in.item_id} not found."
            )

        # Generate batch number if omitted
        batch_num = item_in.batch_number or f"BATCH-{item.sku}-{today_str}-{idx+1}"

        receipt_item = GoodsReceiptItem(
            goods_receipt_id=receipt.id,
            item_id=item_in.item_id,
            batch_number=batch_num,
            quantity=item_in.quantity,
            expiration_date=item_in.expiration_date,
            unit_price=item_in.unit_price
        )
        db.add(receipt_item)
        await db.flush()

        # Increment or create BatchLot in target warehouse linked to incoming goods receipt item
        batch_lot_stmt = (
            select(BatchLot)
            .where(
                and_(
                    BatchLot.item_id == item_in.item_id,
                    BatchLot.batch_number == batch_num,
                    BatchLot.warehouse == payload.target_warehouse
                )
            )
        )
        existing_batch = await db.scalar(batch_lot_stmt)
        is_qc_req = getattr(item, "qc_incoming_required", False)
        lot_status = "Karantina" if is_qc_req else "Serbest"
        qc_note = "Mal kabul girişi: Giriş kalite kontrol onayı bekleniyor." if is_qc_req else "Mal kabul girişi: Serbest."

        if existing_batch:
            existing_batch.quantity += item_in.quantity
            if not existing_batch.goods_receipt_item_id:
                existing_batch.goods_receipt_item_id = receipt_item.id
            if is_qc_req:
                existing_batch.status = "Karantina"
                existing_batch.qc_notes = qc_note
        else:
            new_batch = BatchLot(
                batch_number=batch_num,
                item_id=item_in.item_id,
                warehouse=payload.target_warehouse,
                quantity=item_in.quantity,
                expiration_date=item_in.expiration_date,
                goods_receipt_item_id=receipt_item.id,
                status=lot_status,
                qc_notes=qc_note
            )
            db.add(new_batch)

    await db.commit()

    # Reload with relationships
    stmt = (
        select(GoodsReceipt)
        .options(
            selectinload(GoodsReceipt.items).selectinload(GoodsReceiptItem.item)
        )
        .where(GoodsReceipt.id == receipt.id)
    )
    result = await db.scalar(stmt)
    return result


# ---------------------------------------------------------
# 2. Depolar Arası Transfer / Inter-Warehouse Transfer
# ---------------------------------------------------------
@router.post("/inventory/transfer", response_model=StockTransferResponse, status_code=status.HTTP_201_CREATED)
async def process_stock_transfer(
    payload: StockTransferCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Executes an atomic inter-warehouse transfer (e.g. Raw Material -> Plant Floor -> Finished).
    Validates that the source warehouse has sufficient stock for the specified BatchLot
    before deducting from source and adding to the target warehouse.
    """
    if payload.source_warehouse == payload.target_warehouse:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and target warehouses cannot be identical."
        )

    existing_trf = await db.scalar(
        select(StockTransfer).where(StockTransfer.transfer_number == payload.transfer_number)
    )
    if existing_trf:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transfer with number '{payload.transfer_number}' already exists."
        )

    transfer = StockTransfer(
        transfer_number=payload.transfer_number,
        source_warehouse=payload.source_warehouse,
        target_warehouse=payload.target_warehouse,
        status="COMPLETED",
        notes=payload.notes
    )
    db.add(transfer)
    await db.flush()

    for item_in in payload.items:
        source_batch = await db.get(BatchLot, item_in.batch_lot_id)
        if not source_batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source batch lot with ID {item_in.batch_lot_id} not found."
            )

        if source_batch.warehouse != payload.source_warehouse:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Batch lot '{source_batch.batch_number}' is located in '{source_batch.warehouse}', "
                    f"not in declared source warehouse '{payload.source_warehouse}'."
                )
            )

        if source_batch.quantity < item_in.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for batch '{source_batch.batch_number}' in '{payload.source_warehouse}'. "
                    f"Available: {source_batch.quantity}, Requested: {item_in.quantity}."
                )
            )

        # 1. Deduct from source batch
        source_batch.quantity -= item_in.quantity

        # 2. Add to target warehouse batch
        target_batch_stmt = (
            select(BatchLot)
            .where(
                and_(
                    BatchLot.item_id == source_batch.item_id,
                    BatchLot.batch_number == source_batch.batch_number,
                    BatchLot.warehouse == payload.target_warehouse
                )
            )
        )
        target_batch = await db.scalar(target_batch_stmt)
        if target_batch:
            target_batch.quantity += item_in.quantity
        else:
            target_batch = BatchLot(
                batch_number=source_batch.batch_number,
                item_id=source_batch.item_id,
                warehouse=payload.target_warehouse,
                quantity=item_in.quantity,
                expiration_date=source_batch.expiration_date
            )
            db.add(target_batch)

        # Record transfer item
        trf_item = StockTransferItem(
            transfer_id=transfer.id,
            item_id=source_batch.item_id,
            batch_lot_id=source_batch.id,
            quantity=item_in.quantity
        )
        db.add(trf_item)

    await db.commit()

    # Reload with relationships
    stmt = (
        select(StockTransfer)
        .options(
            selectinload(StockTransfer.items).selectinload(StockTransferItem.item),
            selectinload(StockTransfer.items).selectinload(StockTransferItem.batch_lot)
        )
        .where(StockTransfer.id == transfer.id)
    )
    result = await db.scalar(stmt)
    return result


# ---------------------------------------------------------
# 3. Sevk Emri & Sevkiyat / Dispatch & Logistics Delivery
# ---------------------------------------------------------
@router.get("/inventory/dispatch")
async def list_dispatch_orders(
    status_filter: Optional[DispatchStatus] = None,
    cari_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all dispatch and shipment orders with Cari and Items loaded."""
    stmt = (
        select(DispatchOrder)
        .options(
            selectinload(DispatchOrder.items).selectinload(DispatchItem.item),
            selectinload(DispatchOrder.items).selectinload(DispatchItem.batch_lot),
            selectinload(DispatchOrder.cari)
        )
        .order_by(DispatchOrder.id.desc())
    )
    if status_filter:
        stmt = stmt.where(DispatchOrder.status == status_filter)
    if cari_id:
        stmt = stmt.where(DispatchOrder.cari_id == cari_id)

    orders = (await db.scalars(stmt)).all()
    
    result = []
    for o in orders:
        items_data = []
        for it in o.items:
            pkg_type = "Paletli Koli (4x5L)"
            if it.item and ("Bidon" in it.item.name or "Suyu" in it.item.name or "Yağ" in it.item.name):
                pkg_type = "20 Litre HDPE Sanayi Bidonu"
            elif it.item and "Deterjan" in it.item.name:
                pkg_type = "20 Litre Sanayi Tipi Bidon"

            items_data.append({
                "id": it.id,
                "sku": it.item.sku if it.item else f"SKU-{it.item_id}",
                "name": it.item.name if it.item else "Ürün",
                "quantity": float(it.quantity),
                "scanned_quantity": float(it.scanned_quantity),
                "unit": it.item.unit if it.item else "Birim",
                "package_type": pkg_type
            })
        
        result.append({
            "id": o.id,
            "dispatch_number": o.dispatch_number,
            "cari_id": o.cari_id,
            "cari_name": o.cari.title if o.cari else f"Cari #{o.cari_id}",
            "status": o.status.value,
            "warehouse": o.warehouse,
            "created_at": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else "",
            "dispatch_date": o.dispatch_date.strftime("%Y-%m-%d %H:%M") if o.dispatch_date else None,
            "estimated_delivery": (o.created_at + datetime.timedelta(days=2)).strftime("%Y-%m-%d 17:00") if o.created_at else "2026-10-28 17:00",
            "delivery_address": o.delivery_address or "Adres belirtilmedi",
            "carrier_company": o.carrier_company or "Günay Kimya Özel Lojistik Filosu",
            "vehicle_plate": o.vehicle_plate or "34 GNY 1984",
            "driver_name": o.driver_name or "Kemal Yılmaz",
            "driver_tckn": o.driver_tckn or "29810482910",
            "carrier_tracking_code": o.carrier_tracking_code or f"GNK-LOG-{884000 + o.id}",
            "notes": o.notes,
            "items": items_data
        })
    return result


@router.get("/inventory/dispatch/export/csv")
async def export_dispatches_csv(
    db: AsyncSession = Depends(get_db)
):
    """Export all dispatches and waybills as UTF-8 CSV with BOM for Excel."""
    from fastapi.responses import Response
    stmt = (
        select(DispatchOrder)
        .options(
            selectinload(DispatchOrder.items).selectinload(DispatchItem.item),
            selectinload(DispatchOrder.cari)
        )
        .order_by(DispatchOrder.id.desc())
    )
    orders = (await db.scalars(stmt)).all()
    
    lines = [
        "Sevk No;İrsaliye No;Cari Ünvanı;Durum;Depo;Taşıyıcı;Araç Plakası;Sürücü Adı;Sürücü TC;Takip Kodu;Kalem Sayısı;Toplam Miktar;Teslimat Adresi;Kayıt Tarihi"
    ]
    for o in orders:
        clean_num = o.dispatch_number.replace("DSP-", "").replace("-", "")
        waybill_no = f"GNY202600000{clean_num[-4:]}"
        cari_title = o.cari.title if o.cari else "Bilinmiyor"
        total_qty = sum(it.quantity for it in o.items)
        date_str = o.created_at.strftime("%d.%m.%Y %H:%M") if o.created_at else ""
        lines.append(
            f"{o.dispatch_number};{waybill_no};{cari_title};{o.status.value};{o.warehouse};"
            f"{o.carrier_company or ''};{o.vehicle_plate or ''};{o.driver_name or ''};{o.driver_tckn or ''};{o.carrier_tracking_code or ''};"
            f"{len(o.items)};{total_qty};\"{o.delivery_address or ''}\";{date_str}"
        )
    
    csv_content = "\ufeff" + "\r\n".join(lines)
    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=gunay_kimya_sevkiyat_raporu.csv"
        }
    )


@router.get("/inventory/dispatch/{id}/waybill", response_model=WaybillResponseSchema)
async def get_dispatch_waybill(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns official Waybill (e-İrsaliye) detailed dataset for printing and PDF generation.
    """
    stmt = (
        select(DispatchOrder)
        .options(
            selectinload(DispatchOrder.items).selectinload(DispatchItem.item),
            selectinload(DispatchOrder.items).selectinload(DispatchItem.batch_lot),
            selectinload(DispatchOrder.cari)
        )
        .where(DispatchOrder.id == id)
    )
    dispatch = await db.scalar(stmt)
    if not dispatch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dispatch order with ID {id} not found."
        )

    # Scanned barcodes for this dispatch
    b_stmt = select(BarcodeUnit).where(BarcodeUnit.dispatch_order_id == id)
    scanned_units = (await db.scalars(b_stmt)).all()
    
    total_pallets = sum(1 for b in scanned_units if b.type == BarcodeType.PALLET)
    total_boxes = sum(1 for b in scanned_units if b.type == BarcodeType.BOX)

    clean_num = dispatch.dispatch_number.replace("DSP-", "").replace("-", "")
    waybill_no = f"GNY202600000{clean_num[-4:]}"
    ettn_uuid = f"e849b21a-{dispatch.id:04d}-49a2-b91c-{100000000000 + dispatch.id}"
    
    issue_date_str = (dispatch.created_at or datetime.datetime.now(datetime.timezone.utc)).strftime("%d.%m.%Y %H:%M")
    shipment_date_str = (dispatch.dispatch_date or datetime.datetime.now(datetime.timezone.utc)).strftime("%d.%m.%Y %H:%M")

    items_list = []
    total_weight = 0.0
    for idx, item in enumerate(dispatch.items, start=1):
        item_barcodes = [
            b.barcode_string for b in scanned_units 
            if b.item_id == item.item_id
        ]
        
        sku = item.item.sku if item.item else f"SKU-{item.item_id}"
        name = item.item.name if item.item else "Ürün"
        
        adr_class = "ADR Kapsamı Dışı (Tehlikesiz Endüstriyel Ürün)"
        package_type = "Paletli Koli (4x5L)"
        unit_weight = 5.0
        
        if "Çamaşır" in name or "Hipoklorit" in name:
            adr_class = "ADR Sınıf 8 / UN 1791 Hipoklorit Çözeltisi, PG III"
            package_type = "30 KG HDPE Sanayi Bidonu"
            unit_weight = 30.0
        elif "Yağ" in name or "Sökücü" in name:
            adr_class = "ADR Sınıf 8 / UN 1814 Potasyum Hidroksit Çözeltisi"
            package_type = "20 Litre HDPE Sanayi Bidonu"
            unit_weight = 20.0
        elif "Deterjan" in name or "Bulaşık" in name:
            package_type = "20 Litre Sanayi Tipi Bidon"
            unit_weight = 20.0

        qty_flt = float(item.quantity)
        line_weight = qty_flt * unit_weight
        total_weight += line_weight

        items_list.append(WaybillItemSchema(
            line_no=idx,
            item_id=item.item_id,
            sku=sku,
            name=name,
            unit=item.item.unit if item.item else "Birim",
            quantity=item.quantity,
            batch_number=item.batch_lot.batch_number if item.batch_lot else f"LOT-2026-{dispatch.id:03d}",
            barcode_list=item_barcodes,
            adr_class=adr_class,
            package_type=package_type,
            net_weight_kg=round(line_weight * 0.95, 2),
            gross_weight_kg=round(line_weight, 2)
        ))

    cari = dispatch.cari
    return WaybillResponseSchema(
        dispatch_id=dispatch.id,
        waybill_number=waybill_no,
        ettn_uuid=ettn_uuid,
        issue_date=issue_date_str,
        shipment_date=shipment_date_str,
        receiver_title=cari.title if cari else "Ege Kimya Sanayi A.Ş.",
        receiver_tax_office=cari.tax_office if cari and cari.tax_office else "Gebze Vergi Dairesi",
        receiver_tax_id=cari.tax_number if cari and cari.tax_number else "3250819402",
        receiver_address=dispatch.delivery_address or "Gebze OSB 4. Cadde No:18, Kocaeli",
        carrier_company=dispatch.carrier_company or "Günay Kimya Özel Lojistik Filosu",
        vehicle_plate=dispatch.vehicle_plate or "34 GNY 1984",
        driver_name=dispatch.driver_name or "Kemal Yılmaz",
        driver_tckn=dispatch.driver_tckn or "29810482910",
        carrier_tracking_code=dispatch.carrier_tracking_code or f"GNK-LOG-{884000 + dispatch.id}",
        warehouse=dispatch.warehouse,
        status=dispatch.status.value,
        items=items_list,
        total_line_count=len(items_list),
        total_quantity=sum(it.quantity for it in dispatch.items),
        total_pallets_count=total_pallets,
        total_boxes_count=total_boxes,
        total_estimated_weight_kg=round(total_weight, 2)
    )


@router.put("/inventory/dispatch/{id}/carrier")
async def update_dispatch_carrier(
    id: int,
    payload: CarrierUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update carrier, driver, and vehicle information for a dispatch order."""
    dispatch = await db.get(DispatchOrder, id)
    if not dispatch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dispatch order with ID {id} not found."
        )
    if payload.carrier_company is not None:
        dispatch.carrier_company = payload.carrier_company
    if payload.vehicle_plate is not None:
        dispatch.vehicle_plate = payload.vehicle_plate
    if payload.driver_name is not None:
        dispatch.driver_name = payload.driver_name
    if payload.driver_tckn is not None:
        dispatch.driver_tckn = payload.driver_tckn
    if payload.carrier_tracking_code is not None:
        dispatch.carrier_tracking_code = payload.carrier_tracking_code
    if payload.delivery_address is not None:
        dispatch.delivery_address = payload.delivery_address
    if payload.notes is not None:
        dispatch.notes = payload.notes
    
    await db.commit()
    await db.refresh(dispatch)
    return {"message": "Taşıyıcı ve sürücü bilgileri güncellendi", "dispatch_id": id}


@router.post("/inventory/dispatch", response_model=DispatchOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_dispatch_order(
    payload: DispatchOrderCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new dispatch order linked to a client / dealer (CariAccount).
    Initial status is set to PENDING.
    """
    cari = await db.get(CariAccount, payload.cari_id)
    if not cari:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cari account with ID {payload.cari_id} not found."
        )

    existing_order = await db.scalar(
        select(DispatchOrder).where(DispatchOrder.dispatch_number == payload.dispatch_number)
    )
    if existing_order:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dispatch order with number '{payload.dispatch_number}' already exists."
        )

    dispatch = DispatchOrder(
        dispatch_number=payload.dispatch_number,
        cari_id=payload.cari_id,
        status=DispatchStatus.PENDING,
        warehouse=payload.warehouse,
        delivery_address=payload.delivery_address,
        carrier_tracking_code=payload.carrier_tracking_code,
        carrier_company=payload.carrier_company or "Günay Kimya Özel Lojistik Filosu",
        vehicle_plate=payload.vehicle_plate or "34 GNY 1984",
        driver_name=payload.driver_name or "Kemal Yılmaz",
        driver_tckn=payload.driver_tckn or "29810482910",
        notes=payload.notes
    )
    db.add(dispatch)
    await db.flush()

    for item_in in payload.items:
        item = await db.get(Item, item_in.item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {item_in.item_id} not found."
            )

        dsp_item = DispatchItem(
            dispatch_order_id=dispatch.id,
            item_id=item_in.item_id,
            batch_lot_id=item_in.batch_lot_id,
            quantity=item_in.quantity,
            unit_price=item_in.unit_price
        )
        db.add(dsp_item)

    await db.commit()

    stmt = (
        select(DispatchOrder)
        .options(
            selectinload(DispatchOrder.items).selectinload(DispatchItem.item),
            selectinload(DispatchOrder.items).selectinload(DispatchItem.batch_lot)
        )
        .where(DispatchOrder.id == dispatch.id)
    )
    result = await db.scalar(stmt)
    return result

@router.patch("/inventory/dispatch/{id}/ship", response_model=DispatchShipResponse)
async def ship_dispatch_order(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    CRITICAL DISPATCH COMPLETION:
    When status transitions to SHIPPED:
    1. Executes final stock deduction from the Finished Goods warehouse batches.
    2. Updates dispatch timestamp and sets status to SHIPPED.
    3. Triggers B2B portal notification payload for dealer tracking.
    4. Commits atomically.
    """
    stmt = (
        select(DispatchOrder)
        .options(
            selectinload(DispatchOrder.items).selectinload(DispatchItem.item),
            selectinload(DispatchOrder.items).selectinload(DispatchItem.batch_lot),
            selectinload(DispatchOrder.cari)
        )
        .where(DispatchOrder.id == id)
    )
    dispatch = await db.scalar(stmt)
    if not dispatch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dispatch order with ID {id} not found."
        )

    if dispatch.status == DispatchStatus.SHIPPED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dispatch order has already been shipped."
        )

    # 1. Stock Deduction from Finished Goods warehouse
    for item in dispatch.items:
        qty_needed = item.quantity

        if item.batch_lot_id:
            batch = await db.get(BatchLot, item.batch_lot_id)
            if not batch or batch.warehouse != dispatch.warehouse:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Assigned batch lot {item.batch_lot_id} is not located in '{dispatch.warehouse}'."
                )
            if batch.quantity < qty_needed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient stock in batch '{batch.batch_number}' for finished good '{item.item.name}'. "
                        f"Required: {qty_needed}, Available: {batch.quantity}."
                    )
                )
            batch.quantity -= qty_needed
        else:
            # Auto-allocate from earliest expiring batches in the specified warehouse
            batches_stmt = (
                select(BatchLot)
                .where(
                    and_(
                        BatchLot.item_id == item.item_id,
                        BatchLot.warehouse == dispatch.warehouse,
                        BatchLot.quantity > Decimal("0.000")
                    )
                )
                .order_by(BatchLot.expiration_date.asc().nulls_last(), BatchLot.received_at.asc())
            )
            available_batches = (await db.scalars(batches_stmt)).all()
            total_avail = sum(b.quantity for b in available_batches)

            if total_avail < qty_needed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient finished goods stock for '{item.item.name}' (SKU: {item.item.sku}) "
                        f"in warehouse '{dispatch.warehouse}'. Required: {qty_needed}, Available: {total_avail}."
                    )
                )

            rem = qty_needed
            for b in available_batches:
                if rem <= Decimal("0.000"):
                    break
                deduct = min(b.quantity, rem)
                b.quantity -= deduct
                rem -= deduct
                if not item.batch_lot_id:
                    item.batch_lot_id = b.id  # Assign first consumed batch

    # 2. Mark shipped
    dispatch.status = DispatchStatus.SHIPPED
    dispatch.dispatch_date = datetime.datetime.now(datetime.timezone.utc)

    # 3. Trigger Inter-Departmental Event B (Accounting debt posting & Dealer notification)
    await trigger_dispatch_shipped_event(db, dispatch)

    # 4. Trigger B2B portal notification payload
    notification_payload = trigger_b2b_portal_notification(dispatch)

    # 5. Atomic Commit
    await db.commit()
    await db.refresh(dispatch)

    return DispatchShipResponse(
        dispatch_order=dispatch,
        webhook_notified=True,
        b2b_notification_payload=notification_payload
    )


# ---------------------------------------------------------
# 4. Çok Kademeli Barkod & El Terminali Doğrulama (Handheld Scanner)
# ---------------------------------------------------------
@router.get("/inventory/barcodes", response_model=List[BarcodeUnitResponse])
async def list_barcode_units(
    item_id: Optional[int] = None,
    status_filter: Optional[BarcodeStatus] = None,
    type_filter: Optional[BarcodeType] = None,
    db: AsyncSession = Depends(get_db)
):
    """List registered pallet and box barcode units."""
    query = select(BarcodeUnit).options(
        selectinload(BarcodeUnit.item),
        selectinload(BarcodeUnit.children_boxes)
    )
    if item_id:
        query = query.where(BarcodeUnit.item_id == item_id)
    if status_filter:
        query = query.where(BarcodeUnit.status == status_filter)
    if type_filter:
        query = query.where(BarcodeUnit.type == type_filter)
    
    units = (await db.scalars(query)).all()
    return units


@router.get("/inventory/dispatch/{id}/scanned-units", response_model=List[BarcodeUnitResponse])
async def list_scanned_barcode_units_for_dispatch(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all barcodes scanned and provisionally attached to a dispatch order."""
    query = (
        select(BarcodeUnit)
        .options(
            selectinload(BarcodeUnit.item),
            selectinload(BarcodeUnit.children_boxes)
        )
        .where(BarcodeUnit.dispatch_order_id == id)
    )
    units = (await db.scalars(query)).all()
    return units


@router.post("/inventory/verify-scan", response_model=VerifyScanResponse)
async def verify_handheld_scan(
    payload: VerifyScanRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    HANDHELD MOBILE SCANNER (EL TERMİNALİ) VERIFICATION ENDPOINT
    Performs 4-layer validation before provisionally matching a scanned barcode:
    1. Status must be IN_STOCK.
    2. Dispatch order line item check: Must match an unfulfilled line item in the dispatch order.
    3. Target Cari cross-check: Barcode target must match active order Cari (prevents shipping to wrong client).
    4. Quantity cap check: Scanned quantity must not exceed remaining required line item volume.
    """
    clean_barcode = payload.scanned_barcode_string.strip()

    # 1. Look up BarcodeUnit
    b_stmt = (
        select(BarcodeUnit)
        .options(
            selectinload(BarcodeUnit.item),
            selectinload(BarcodeUnit.target_cari),
            selectinload(BarcodeUnit.children_boxes)
        )
        .where(BarcodeUnit.barcode_string == clean_barcode)
    )
    barcode_unit = await db.scalar(b_stmt)
    if not barcode_unit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Hatalı Barkod! Sistemde kayıtlı olmayan birim okutuldu: '{clean_barcode}'"
        )

    # 1.1 Verify IN_STOCK status
    if barcode_unit.status == BarcodeStatus.SHIPPED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mükerrer Sevk Hatası! Bu barkod ({barcode_unit.barcode_string}) daha önce sevk edilmiştir!"
        )

    # 1.2 Check if already scanned
    if barcode_unit.dispatch_order_id:
        if barcode_unit.dispatch_order_id == payload.dispatch_order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mükerrer Tarama! Bu barkod ({barcode_unit.barcode_string}) bu sevk emri için zaten okutuldu!"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rezervasyon Hatası! Bu barkod başka bir sevk emrine (#{barcode_unit.dispatch_order_id}) atanmıştır!"
            )

    # 2. Look up DispatchOrder
    d_stmt = (
        select(DispatchOrder)
        .options(
            selectinload(DispatchOrder.items).selectinload(DispatchItem.item),
            selectinload(DispatchOrder.cari)
        )
        .where(DispatchOrder.id == payload.dispatch_order_id)
    )
    dispatch = await db.scalar(d_stmt)
    if not dispatch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sevk Emri #{payload.dispatch_order_id} bulunamadı."
        )

    if dispatch.status == DispatchStatus.SHIPPED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sevk emri ({dispatch.dispatch_number}) sevk edilmiş ve kilitlenmiştir. Yeni tarama yapılamaz."
        )

    # 3. Cross-verify Target Cari Owner
    if barcode_unit.target_cari_id and barcode_unit.target_cari_id != dispatch.cari_id:
        target_name = barcode_unit.target_cari.title if barcode_unit.target_cari else f"Cari #{barcode_unit.target_cari_id}"
        current_name = dispatch.cari.title if dispatch.cari else f"Cari #{dispatch.cari_id}"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Hatalı Ürün! Bu Palet Başka Siparişe Ait! (Atanmış Müşteri: '{target_name}', Sevk Edilen Müşteri: '{current_name}')"
        )

    # 4. Check if item exists in DispatchOrder
    matching_item: Optional[DispatchItem] = None
    for d_item in dispatch.items:
        if d_item.item_id == barcode_unit.item_id:
            matching_item = d_item
            break

    if not matching_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ürün Uyuşmazlığı! İrsaliyede '{barcode_unit.item.name}' ({barcode_unit.item.sku}) ürünü yer almamaktadır!"
        )

    # 4.1 Check quantity overflow
    remaining_needed = matching_item.quantity - matching_item.scanned_quantity
    if barcode_unit.quantity > remaining_needed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Miktar Aşımı! Bu ürün için kalan gereken miktar {remaining_needed} {matching_item.item.unit}, "
                f"okutulan {barcode_unit.type.value} birimi {barcode_unit.quantity} {matching_item.item.unit} içeriyor."
            )
        )

    # 5. Successfully match and update state
    matching_item.scanned_quantity += barcode_unit.quantity
    barcode_unit.dispatch_order_id = dispatch.id

    # If this is a pallet, also associate all its children boxes
    for child in barcode_unit.children_boxes:
        child.dispatch_order_id = dispatch.id

    if dispatch.status == DispatchStatus.PENDING:
        dispatch.status = DispatchStatus.READY

    await db.commit()
    await db.refresh(matching_item)
    await db.refresh(dispatch)

    # Calculate overall order progress
    total_required = sum(it.quantity for it in dispatch.items)
    total_scanned = sum(it.scanned_quantity for it in dispatch.items)
    progress_percentage = round(float(total_scanned / total_required * 100), 2) if total_required > 0 else 100.0
    is_order_complete = all(it.scanned_quantity >= it.quantity for it in dispatch.items)

    type_label = "Palet" if barcode_unit.type == BarcodeType.PALLET else "Koli"
    message = (
        f"✓ Başarılı: {type_label} doğrulandı! ({barcode_unit.item.name} - "
        f"{barcode_unit.quantity} {barcode_unit.item.unit} eklendi. Toplam: {matching_item.scanned_quantity}/{matching_item.quantity})"
    )

    return VerifyScanResponse(
        verified=True,
        scanned_barcode=barcode_unit.barcode_string,
        barcode_type=barcode_unit.type,
        item_id=barcode_unit.item_id,
        item_name=barcode_unit.item.name,
        item_sku=barcode_unit.item.sku,
        scanned_unit_quantity=barcode_unit.quantity,
        total_scanned_for_item=matching_item.scanned_quantity,
        required_item_quantity=matching_item.quantity,
        progress_percentage=progress_percentage,
        is_order_complete=is_order_complete,
        message=message
    )


@router.post("/inventory/dispatch/{id}/finalize", response_model=FinalizeDispatchResponse)
async def finalize_dispatch_verification(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    FINALIZES EL TERMINALI VERIFICATION & SHIPS ORDER:
    Strict Guardrail: Can ONLY be executed if all line items in the DispatchOrder
    are 100% matched with verified barcode scans.
    Upon success:
    1. Updates all matched BarcodeUnits to status = SHIPPED.
    2. Executes physical stock deduction from warehouse batch lots.
    3. Updates dispatch order status to SHIPPED.
    4. Triggers Trigger B accounting debt posting and B2B portal notification.
    """
    stmt = (
        select(DispatchOrder)
        .options(
            selectinload(DispatchOrder.items).selectinload(DispatchItem.item),
            selectinload(DispatchOrder.items).selectinload(DispatchItem.batch_lot),
            selectinload(DispatchOrder.cari)
        )
        .where(DispatchOrder.id == id)
    )
    dispatch = await db.scalar(stmt)
    if not dispatch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sevk Emri #{id} bulunamadı."
        )

    if dispatch.status == DispatchStatus.SHIPPED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu sevk emri zaten kapatılmış ve sevk edilmiştir."
        )

    # 1. Verify 100% 1:1 scan matching across all line items
    unfulfilled_lines = [
        it for it in dispatch.items
        if it.scanned_quantity < it.quantity
    ]
    if unfulfilled_lines:
        missing_desc = ", ".join(
            f"{it.item.name} ({it.scanned_quantity}/{it.quantity} {it.item.unit})"
            for it in unfulfilled_lines
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sevkiyat Onaylanamaz! Eksik taranmış ürünler bulunmaktadır: {missing_desc}"
        )

    # 2. Fetch all scanned barcode units for this dispatch
    barcodes_stmt = (
        select(BarcodeUnit)
        .options(selectinload(BarcodeUnit.children_boxes))
        .where(BarcodeUnit.dispatch_order_id == dispatch.id)
    )
    barcodes = (await db.scalars(barcodes_stmt)).all()

    # Turn status to SHIPPED
    scanned_count = len(barcodes)
    for b in barcodes:
        b.status = BarcodeStatus.SHIPPED
        for child in b.children_boxes:
            child.status = BarcodeStatus.SHIPPED

    # 3. Deduct physical stock from Finished Goods warehouse
    for item in dispatch.items:
        qty_needed = item.quantity
        if item.batch_lot_id:
            batch = await db.get(BatchLot, item.batch_lot_id)
            if batch and batch.quantity >= qty_needed:
                batch.quantity -= qty_needed
        else:
            # Auto-allocate from earliest expiring batches in the specified warehouse
            batches_stmt = (
                select(BatchLot)
                .where(
                    and_(
                        BatchLot.item_id == item.item_id,
                        BatchLot.warehouse == dispatch.warehouse,
                        BatchLot.quantity > Decimal("0.000")
                    )
                )
                .order_by(BatchLot.expiration_date.asc().nulls_last(), BatchLot.received_at.asc())
            )
            available_batches = (await db.scalars(batches_stmt)).all()
            rem = qty_needed
            for b in available_batches:
                if rem <= Decimal("0.000"):
                    break
                deduct = min(b.quantity, rem)
                b.quantity -= deduct
                rem -= deduct
                if not item.batch_lot_id:
                    item.batch_lot_id = b.id

    # 4. Mark dispatch as SHIPPED
    dispatch.status = DispatchStatus.SHIPPED
    dispatch.dispatch_date = datetime.datetime.now(datetime.timezone.utc)

    # 4.1 Update any linked production order phase to SEVK_EDILDI
    linked_orders_stmt = select(ProductionOrder).where(
        (ProductionOrder.dispatch_order_id == dispatch.id) | (ProductionOrder.cari_id == dispatch.cari_id)
    )
    linked_orders = (await db.scalars(linked_orders_stmt)).all()
    for l_order in linked_orders:
        if l_order.phase in ["PAKETLEME_HAZIR", "DOLUM_KALITE"]:
            l_order.phase = "SEVK_EDILDI"

    # 5. Trigger Inter-Departmental Event B (Accounting debt posting & Dealer notification)
    await trigger_dispatch_shipped_event(db, dispatch)

    await db.commit()

    return FinalizeDispatchResponse(
        success=True,
        dispatch_order_id=dispatch.id,
        dispatch_number=dispatch.dispatch_number,
        status=dispatch.status,
        scanned_barcodes_count=scanned_count,
        message=f"✓ Sevk Emri {dispatch.dispatch_number} el terminali doğrulamasıyla başarıyla sevk edildi!"
    )


# ---------------------------------------------------------
# 5. El Terminali Depo Mal Kabul (Üretimden Çıkan Palet Kabulü)
# ---------------------------------------------------------
class ReceivePalletRequest(BaseModel):
    pallet_barcode_string: str
    target_warehouse: Optional[str] = "Mamul Ürün Deposu"

@router.post("/inventory/inbound/receive-pallet")
async def receive_pallet_to_warehouse(
    payload: ReceivePalletRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Üretimden çıkan palet el terminaliyle depoya kabul edilir:
    1. Palet barkodu kontrol edilir.
    2. Depo stok tablosunda (inventory_batch_lots) 'Mamul Ürün Deposu' stoğu artırılır.
    3. BarcodeUnit durumu IN_STOCK olarak onaylanır.
    """
    clean_barcode = payload.pallet_barcode_string.strip()

    b_stmt = (
        select(BarcodeUnit)
        .options(
            selectinload(BarcodeUnit.item),
            selectinload(BarcodeUnit.children_boxes)
        )
        .where(BarcodeUnit.barcode_string == clean_barcode)
    )
    pallet_unit = await db.scalar(b_stmt)
    if not pallet_unit:
        raise HTTPException(
            status_code=404,
            detail=f"Hatalı veya Kayıtsız Palet Barkodu: '{clean_barcode}'"
        )

    # Mamul Ürün Deposu stoğuna ekle veya güncelle
    target_wh = payload.target_warehouse or "Mamul Ürün Deposu"
    batch_num = f"LOT-{clean_barcode}"

    lot_stmt = (
        select(BatchLot)
        .where(
            BatchLot.item_id == pallet_unit.item_id,
            BatchLot.warehouse == target_wh,
            BatchLot.batch_number == batch_num
        )
    )
    existing_lot = await db.scalar(lot_stmt)
    if existing_lot:
        existing_lot.quantity += pallet_unit.quantity
    else:
        new_lot = BatchLot(
            batch_number=batch_num,
            item_id=pallet_unit.item_id,
            warehouse=target_wh,
            quantity=pallet_unit.quantity,
            expiration_date=datetime.date.today() + datetime.timedelta(days=730),
            received_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(new_lot)

    pallet_unit.status = BarcodeStatus.IN_STOCK
    for box in pallet_unit.children_boxes:
        box.status = BarcodeStatus.IN_STOCK

    await db.commit()

    return {
        "success": True,
        "message": f"✓ Palet #{clean_barcode} başarıyla '{target_wh}'na kabul edildi.",
        "item_name": pallet_unit.item.name if pallet_unit.item else "Mamul Ürün",
        "quantity": float(pallet_unit.quantity),
        "warehouse": target_wh
    }


# ---------------------------------------------------------
# 6. Mobil El Terminali Barkod Tanıma & Hızlı Aksiyon Uç Noktaları
# ---------------------------------------------------------
class TerminalLookupRequest(BaseModel):
    barcode_string: str

class TerminalActionRequest(BaseModel):
    barcode_string: str
    action: str  # "RECEIVE" or "DISPATCH"
    target_warehouse: Optional[str] = "Mamul Ürün Deposu"
    dispatch_order_id: Optional[int] = None

@router.post("/inventory/terminal/lookup")
async def terminal_barcode_lookup(
    payload: TerminalLookupRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Mobil El Terminali için kamera veya el tipi lazer okuyucu ile okutulan
    herhangi bir barkodu (Palet, Koli veya Lot) analiz edip kimlik kartını döner.
    """
    clean_barcode = payload.barcode_string.strip()
    clean_no_ai = clean_barcode.replace("(00)", "").replace("(01)", "").replace("(21)", "").strip()

    # 1. Search BarcodeUnit (Pallet or Box)
    b_stmt = (
        select(BarcodeUnit)
        .options(
            selectinload(BarcodeUnit.item),
            selectinload(BarcodeUnit.target_cari),
            selectinload(BarcodeUnit.children_boxes)
        )
        .where(
            or_(
                BarcodeUnit.barcode_string == clean_barcode,
                BarcodeUnit.barcode_string.like(f"%{clean_no_ai}%")
            )
        )
    )
    barcode_unit = await db.scalar(b_stmt)

    if barcode_unit:
        b_type = barcode_unit.type.value if hasattr(barcode_unit.type, "value") else str(barcode_unit.type)
        type_label = "Palet (SSCC-18)" if b_type == "PALLET" else "Koli (GTIN-14)"
        
        # Link production order lot
        lot_no = "N/A"
        prod_order_num = "N/A"
        lot_warning = None
        lot_qc_status = "Serbest"
        if barcode_unit.production_order_id:
            p_order = await db.get(ProductionOrder, barcode_unit.production_order_id)
            if p_order:
                lot_no = p_order.lot_number or f"LOT-{p_order.order_number}"
                prod_order_num = p_order.order_number
                # Check lot status in BatchLot
                p_lot_stmt = select(BatchLot).where(BatchLot.batch_number == lot_no)
                p_lot = await db.scalar(p_lot_stmt)
                if p_lot:
                    lot_qc_status = getattr(p_lot, "status", "Serbest") or "Serbest"
                    if lot_qc_status == "Karantina":
                        lot_warning = "Bu lot karantinada, kullanılamaz"
                    elif lot_qc_status in ["Bloke", "Reddedildi"]:
                        lot_warning = f"Bu lot {lot_qc_status.lower()} durumundadır, kullanılamaz"

        cust_name = barcode_unit.target_cari.title if barcode_unit.target_cari else "Genel Müşteri / Stok"
        status_val = barcode_unit.status.value if hasattr(barcode_unit.status, "value") else str(barcode_unit.status)
        
        status_label_map = {
            "IN_STOCK": "Depoda (Kullanıma Hazır)",
            "RESERVED": "Sevkiyata Ayrılmış",
            "SHIPPED": "Sevk Edildi",
            "PRODUCED": "Üretimden Yeni Çıktı"
        }
        status_label = status_label_map.get(status_val, status_val)
        if lot_warning:
            status_label = f"⚠️ {lot_qc_status.upper()} - {status_label}"

        can_dispatch_val = (status_val != "SHIPPED") and (lot_qc_status == "Serbest")

        # Hazmat & Shelf info for barcode_unit
        b_item = barcode_unit.item
        b_bin_code = None
        b_zone_name = None
        if p_lot:
            b_bin_code = getattr(p_lot, "bin_code", None)
            if getattr(p_lot, "bin", None) and p_lot.bin.zone:
                b_zone_name = p_lot.bin.zone.name

        return {
            "found": True,
            "barcode_string": barcode_unit.barcode_string,
            "barcode_type": b_type,
            "type_label": type_label,
            "item_id": barcode_unit.item_id,
            "product_name": b_item.name if b_item else "Kimyasal Ürün",
            "product_sku": b_item.sku if b_item else "SKU-GEN",
            "lot_number": lot_no,
            "lot_status": lot_qc_status,
            "warning": lot_warning,
            "bin_code": b_bin_code,
            "zone_name": b_zone_name,
            "hazard_class": getattr(b_item, "hazard_class", None),
            "signal_word": getattr(b_item, "signal_word", "Yok"),
            "ghs_pictograms": getattr(b_item, "ghs_pictograms", "[]"),
            "storage_class": getattr(b_item, "storage_class", "Genel"),
            "cas_number": getattr(b_item, "cas_number", None),
            "un_number": getattr(b_item, "un_number", None),
            "sds_file_url": getattr(b_item, "sds_file_url", None),
            "sds_revision_date": str(b_item.sds_revision_date) if getattr(b_item, "sds_revision_date", None) else None,
            "production_order_number": prod_order_num,
            "customer_name": cust_name,
            "customer_id": barcode_unit.target_cari_id,
            "quantity": float(barcode_unit.quantity),
            "unit": b_item.unit if b_item else "adet",
            "warehouse": "Mamul Ürün Deposu",
            "status": status_val,
            "status_label": status_label,
            "can_receive": status_val != "SHIPPED",
            "can_dispatch": can_dispatch_val,
            "child_box_count": len(barcode_unit.children_boxes) if b_type == "PALLET" else 0
        }

    # 2. Search BatchLot (Raw Material or Inventory Lot)
    lot_stmt = (
        select(BatchLot)
        .options(selectinload(BatchLot.item))
        .where(
            or_(
                BatchLot.batch_number == clean_barcode,
                BatchLot.batch_number.like(f"%{clean_barcode}%")
            )
        )
    )
    batch_lot = await db.scalar(lot_stmt)
    if batch_lot:
        item = batch_lot.item
        lot_st = getattr(batch_lot, "status", "Serbest") or "Serbest"
        lot_warn = None
        if lot_st == "Karantina":
            lot_warn = "Bu lot karantinada, kullanılamaz"
            st_label = "⚠️ KARANTİNA (Kullanılamaz)"
        elif lot_st in ["Bloke", "Reddedildi"]:
            lot_warn = f"Bu lot {lot_st.lower()} durumundadır, kullanılamaz"
            st_label = f"⛔ {lot_st.upper()} (Kullanılamaz)"
        else:
            st_label = "✅ Serbest (Kullanılabilir)"

        lot_bin_code = getattr(batch_lot, "bin_code", None)
        lot_zone_name = None
        if getattr(batch_lot, "bin", None) and batch_lot.bin.zone:
            lot_zone_name = batch_lot.bin.zone.name

        return {
            "found": True,
            "barcode_string": batch_lot.batch_number,
            "barcode_type": "LOT",
            "type_label": "Hammadde / Depo Lotu",
            "item_id": batch_lot.item_id,
            "product_name": item.name if item else "Kimyasal Hammadde",
            "product_sku": item.sku if item else "HM-01",
            "lot_number": batch_lot.batch_number,
            "lot_status": lot_st,
            "warning": lot_warn,
            "bin_code": lot_bin_code,
            "zone_name": lot_zone_name,
            "hazard_class": getattr(item, "hazard_class", None),
            "signal_word": getattr(item, "signal_word", "Yok"),
            "ghs_pictograms": getattr(item, "ghs_pictograms", "[]"),
            "storage_class": getattr(item, "storage_class", "Genel"),
            "cas_number": getattr(item, "cas_number", None),
            "un_number": getattr(item, "un_number", None),
            "sds_file_url": getattr(item, "sds_file_url", None),
            "sds_revision_date": str(item.sds_revision_date) if getattr(item, "sds_revision_date", None) else None,
            "production_order_number": "N/A",
            "customer_name": "Fabrika Dahili Stok",
            "customer_id": None,
            "quantity": float(batch_lot.quantity),
            "unit": item.unit if item else "KG",
            "warehouse": batch_lot.warehouse,
            "status": lot_st,
            "status_label": st_label,
            "can_receive": lot_st == "Serbest",
            "can_dispatch": False,
            "child_box_count": 0
        }

    # 3. Guess based on format if not in DB yet
    is_pallet = "SSCC" in clean_barcode or clean_barcode.startswith("(00)") or (clean_barcode.isdigit() and len(clean_barcode) == 18)
    is_box = "KOLI" in clean_barcode or clean_barcode.startswith("(01)")
    guessed_type = "PALLET" if is_pallet else ("BOX" if is_box else "LOT")
    guessed_label = "Palet (SSCC-18)" if is_pallet else ("Koli (GTIN)" if is_box else "Hammadde / Parti")

    return {
        "found": False,
        "barcode_string": clean_barcode,
        "barcode_type": guessed_type,
        "type_label": guessed_label,
        "item_id": None,
        "product_name": "Bilinmeyen / Kayıtsız Ürün",
        "product_sku": "SKU-YOK",
        "lot_number": clean_barcode if "LOT" in clean_barcode else "LOT-TANIMSIZ",
        "production_order_number": "N/A",
        "customer_name": "Kayıtsız",
        "customer_id": None,
        "quantity": 0.0,
        "unit": "adet",
        "warehouse": "Bilinmiyor",
        "status": "UNREGISTERED",
        "status_label": "Sistemde Kayıtlı Değil",
        "can_receive": True,
        "can_dispatch": False,
        "child_box_count": 0
    }


@router.post("/inventory/terminal/action")
async def terminal_barcode_action(
    payload: TerminalActionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Mobil El Terminali tek dokunuşla "Depoya Kabul" veya "Sevkiyat Doğrula" aksiyonu.
    """
    clean_barcode = payload.barcode_string.strip()
    action = payload.action.upper()

    # Look up barcode unit
    b_stmt = (
        select(BarcodeUnit)
        .options(
            selectinload(BarcodeUnit.item),
            selectinload(BarcodeUnit.children_boxes),
            selectinload(BarcodeUnit.target_cari)
        )
        .where(BarcodeUnit.barcode_string == clean_barcode)
    )
    barcode_unit = await db.scalar(b_stmt)

    if action == "RECEIVE":
        # Depoya Kabul
        target_wh = payload.target_warehouse or "Mamul Ürün Deposu"
        if barcode_unit:
            barcode_unit.status = BarcodeStatus.IN_STOCK
            for child in barcode_unit.children_boxes:
                child.status = BarcodeStatus.IN_STOCK

            # Increment batch lot
            batch_num = f"LOT-{clean_barcode}"
            lot_stmt = (
                select(BatchLot)
                .where(
                    BatchLot.item_id == barcode_unit.item_id,
                    BatchLot.warehouse == target_wh,
                    BatchLot.batch_number == batch_num
                )
            )
            existing_lot = await db.scalar(lot_stmt)
            if existing_lot:
                existing_lot.quantity += barcode_unit.quantity
            else:
                new_lot = BatchLot(
                    batch_number=batch_num,
                    item_id=barcode_unit.item_id,
                    warehouse=target_wh,
                    quantity=barcode_unit.quantity,
                    expiration_date=datetime.date.today() + datetime.timedelta(days=730),
                    received_at=datetime.datetime.now(datetime.timezone.utc)
                )
                db.add(new_lot)

            await db.commit()
            return {
                "success": True,
                "message": f"✓ {barcode_unit.item.name} ({barcode_unit.quantity} {barcode_unit.item.unit}) '{target_wh}'na başarıyla kabul edildi.",
                "status": "IN_STOCK"
            }
        else:
            # Create a general inventory lot for unknown/raw barcode
            new_lot = BatchLot(
                batch_number=clean_barcode,
                item_id=1,
                warehouse=target_wh,
                quantity=Decimal("1.0"),
                expiration_date=datetime.date.today() + datetime.timedelta(days=365),
                received_at=datetime.datetime.now(datetime.timezone.utc)
            )
            db.add(new_lot)
            await db.commit()
            return {
                "success": True,
                "message": f"✓ Barkod {clean_barcode} stok kaydı olarak depoya kabul edildi.",
                "status": "IN_STOCK"
            }

    elif action == "DISPATCH":
        # Sevkiyat Doğrula
        if not barcode_unit:
            raise HTTPException(
                status_code=400,
                detail=f"Kayıtsız barkod sevk edilemez: '{clean_barcode}'"
            )

        if barcode_unit.status == BarcodeStatus.SHIPPED:
            raise HTTPException(
                status_code=400,
                detail=f"Bu barkod ({clean_barcode}) daha önce sevk edilmiştir!"
            )

        # Find active pending dispatch order
        target_dispatch_id = payload.dispatch_order_id
        if not target_dispatch_id:
            # Find open dispatch order for the item or customer
            d_query = (
                select(DispatchOrder)
                .where(DispatchOrder.status != DispatchStatus.SHIPPED)
                .order_by(DispatchOrder.id.asc())
            )
            open_dispatches = (await db.scalars(d_query)).all()
            if open_dispatches:
                target_dispatch = open_dispatches[0]
                target_dispatch_id = target_dispatch.id

        if not target_dispatch_id:
            raise HTTPException(
                status_code=400,
                detail="Açık veya bekleyen sevk emri bulunamadı."
            )

        # Call verify_scan logic
        verify_req = VerifyScanRequest(
            dispatch_order_id=target_dispatch_id,
            scanned_barcode_string=clean_barcode
        )
        return await verify_handheld_scan(verify_req, db)

    else:
        raise HTTPException(status_code=400, detail=f"Bilinmeyen aksiyon türü: {action}")


