import os
import shutil
import datetime
import json
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, func, and_
from pydantic import BaseModel, ConfigDict

from app.core.config import async_session_factory
from app.core.security import get_optional_current_user, get_current_user
from app.models.auth import User
from app.models.inventory import Item, BatchLot
from app.models.hazmat import (
    WarehouseZone, WarehouseBin, StorageIncompatibilityRule,
    WarehousePlacementAudit, SystemConfig
)

router = APIRouter(prefix="/hazmat", tags=["Hazmat & Depo Bölgeleri"])

UPLOADS_SDS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "sds"))
os.makedirs(UPLOADS_SDS_DIR, exist_ok=True)

# -------------------------------------------------------------
# Pydantic Schemas
# -------------------------------------------------------------
class WarehouseBinCreate(BaseModel):
    zone_id: int
    code: str
    capacity_kg: Decimal = Decimal("5000.000")
    capacity_pallet: int = 4
    description: Optional[str] = None

class WarehouseBinUpdate(BaseModel):
    code: Optional[str] = None
    capacity_kg: Optional[Decimal] = None
    capacity_pallet: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class WarehouseZoneCreate(BaseModel):
    name: str
    code: str
    storage_class: str
    description: Optional[str] = None

class WarehouseZoneUpdate(BaseModel):
    name: Optional[str] = None
    storage_class: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class PlacementValidationRequest(BaseModel):
    item_id: Optional[int] = None
    item_storage_class: Optional[str] = None
    bin_id: int

class AssignBinRequest(BaseModel):
    batch_lot_id: int
    new_bin_id: int
    override_reason: Optional[str] = None

class IncompatibilityRuleCreate(BaseModel):
    class_a: str
    class_b: str
    reason: str

class SettingsUpdateRequest(BaseModel):
    sds_validity_months: Optional[int] = 36
    label_disclaimer: Optional[str] = None


# -------------------------------------------------------------
# Dependency: DB Session
# -------------------------------------------------------------
async def get_db():
    async with async_session_factory() as session:
        yield session


# -------------------------------------------------------------
# 1. ZONES & BINS
# -------------------------------------------------------------
@router.get("/zones")
async def list_warehouse_zones(db: AsyncSession = Depends(get_db)):
    """List all warehouse zones with their bins and current lots count."""
    stmt = select(WarehouseZone).order_by(WarehouseZone.id)
    res = await db.execute(stmt)
    zones = res.scalars().all()

    # Pre-fetch lot count per bin
    lot_stmt = select(BatchLot.bin_id, func.count(BatchLot.id)).group_by(BatchLot.bin_id)
    lot_res = await db.execute(lot_stmt)
    lot_counts = {row[0]: row[1] for row in lot_res.fetchall() if row[0] is not None}

    output = []
    for z in zones:
        bins_data = []
        for b in z.bins:
            bins_data.append({
                "id": b.id,
                "zone_id": b.zone_id,
                "code": b.code,
                "capacity_kg": float(b.capacity_kg),
                "capacity_pallet": b.capacity_pallet,
                "is_active": b.is_active,
                "description": b.description,
                "current_lots_count": lot_counts.get(b.id, 0)
            })

        output.append({
            "id": z.id,
            "name": z.name,
            "code": z.code,
            "storage_class": z.storage_class,
            "description": z.description,
            "is_active": z.is_active,
            "bins": bins_data,
            "total_bins": len(bins_data),
            "active_bins": sum(1 for b in bins_data if b["is_active"])
        })
    return output


@router.post("/zones")
async def create_warehouse_zone(payload: WarehouseZoneCreate, db: AsyncSession = Depends(get_db)):
    new_zone = WarehouseZone(
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        storage_class=payload.storage_class.strip(),
        description=payload.description.strip() if payload.description else None,
        is_active=True
    )
    db.add(new_zone)
    await db.commit()
    await db.refresh(new_zone)
    return {"success": True, "message": "Depo bölgesi başarıyla oluşturuldu.", "data": {"id": new_zone.id}}


@router.put("/zones/{zone_id}")
async def update_warehouse_zone(zone_id: int, payload: WarehouseZoneUpdate, db: AsyncSession = Depends(get_db)):
    zone = await db.get(WarehouseZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Bölge bulunamadı.")

    if payload.name is not None:
        zone.name = payload.name.strip()
    if payload.storage_class is not None:
        zone.storage_class = payload.storage_class.strip()
    if payload.description is not None:
        zone.description = payload.description.strip()
    if payload.is_active is not None:
        zone.is_active = payload.is_active

    await db.commit()
    return {"success": True, "message": "Bölge güncellendi."}


@router.delete("/zones/{zone_id}")
async def toggle_warehouse_zone(zone_id: int, db: AsyncSession = Depends(get_db)):
    zone = await db.get(WarehouseZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Bölge bulunamadı.")
    zone.is_active = not zone.is_active
    await db.commit()
    status_str = "aktif" if zone.is_active else "pasif"
    return {"success": True, "message": f"Bölge durumu {status_str} yapıldı."}


@router.get("/bins")
async def list_warehouse_bins(
    storage_class: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db)
):
    """List all bins with zone details, optionally filtered by storage class."""
    stmt = select(WarehouseBin).join(WarehouseZone)
    if active_only:
        stmt = stmt.where(WarehouseBin.is_active == True, WarehouseZone.is_active == True)
    if storage_class:
        stmt = stmt.where(WarehouseZone.storage_class == storage_class)

    stmt = stmt.order_by(WarehouseBin.code)
    res = await db.execute(stmt)
    bins = res.scalars().all()

    return [
        {
            "id": b.id,
            "code": b.code,
            "zone_id": b.zone_id,
            "zone_name": b.zone.name,
            "zone_code": b.zone.code,
            "zone_storage_class": b.zone.storage_class,
            "capacity_kg": float(b.capacity_kg),
            "capacity_pallet": b.capacity_pallet,
            "is_active": b.is_active,
            "description": b.description
        }
        for b in bins
    ]


@router.post("/bins")
async def create_warehouse_bin(payload: WarehouseBinCreate, db: AsyncSession = Depends(get_db)):
    zone = await db.get(WarehouseZone, payload.zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Hedef bölge bulunamadı.")

    new_bin = WarehouseBin(
        zone_id=zone.id,
        code=payload.code.strip().upper(),
        capacity_kg=payload.capacity_kg,
        capacity_pallet=payload.capacity_pallet,
        is_active=True,
        description=payload.description.strip() if payload.description else None
    )
    db.add(new_bin)
    await db.commit()
    await db.refresh(new_bin)
    return {"success": True, "message": "Raf başarıyla oluşturuldu.", "data": {"id": new_bin.id, "code": new_bin.code}}


@router.put("/bins/{bin_id}")
async def update_warehouse_bin(bin_id: int, payload: WarehouseBinUpdate, db: AsyncSession = Depends(get_db)):
    b = await db.get(WarehouseBin, bin_id)
    if not b:
        raise HTTPException(status_code=404, detail="Raf bulunamadı.")

    if payload.code is not None:
        b.code = payload.code.strip().upper()
    if payload.capacity_kg is not None:
        b.capacity_kg = payload.capacity_kg
    if payload.capacity_pallet is not None:
        b.capacity_pallet = payload.capacity_pallet
    if payload.description is not None:
        b.description = payload.description.strip()
    if payload.is_active is not None:
        b.is_active = payload.is_active

    await db.commit()
    return {"success": True, "message": "Raf güncellendi."}


@router.delete("/bins/{bin_id}")
async def toggle_warehouse_bin(bin_id: int, db: AsyncSession = Depends(get_db)):
    b = await db.get(WarehouseBin, bin_id)
    if not b:
        raise HTTPException(status_code=404, detail="Raf bulunamadı.")
    b.is_active = not b.is_active
    await db.commit()
    status_str = "aktif" if b.is_active else "pasif"
    return {"success": True, "message": f"Raf durumu {status_str} yapıldı."}


# -------------------------------------------------------------
# 2. PLACEMENT VALIDATION & SHELF ALLOCATION
# -------------------------------------------------------------
@router.post("/validate-placement")
async def validate_placement(payload: PlacementValidationRequest, db: AsyncSession = Depends(get_db)):
    """
    Validates whether a product's storage class is compatible with the selected shelf/bin zone.
    Returns clear warning if classes mismatch or if zone violates incompatibility rules.
    """
    target_bin = await db.get(WarehouseBin, payload.bin_id)
    if not target_bin:
        raise HTTPException(status_code=404, detail="Seçilen raf bulunamadı.")

    zone = target_bin.zone
    zone_storage_class = zone.storage_class

    item_storage_class = payload.item_storage_class
    item_name = "Ürün"
    if payload.item_id:
        item = await db.get(Item, payload.item_id)
        if item:
            item_storage_class = item.storage_class or "Genel"
            item_name = item.name

    if not item_storage_class:
        item_storage_class = "Genel"

    is_mismatched = (item_storage_class != zone_storage_class)
    warning_message = None
    requires_override = False

    if is_mismatched:
        requires_override = True
        warning_message = (
            f"⚠️ Depolama Sınıfı Uyuşmazlığı: Bu ürün '{item_storage_class}' sınıfında, "
            f"seçilen raf ise '{zone.name}' ({zone_storage_class}) bölgesindedir."
        )

    # Incompatibility matrix check
    rules_res = await db.execute(select(StorageIncompatibilityRule).where(StorageIncompatibilityRule.is_active == True))
    rules = rules_res.scalars().all()

    incompat_alert = None
    for r in rules:
        pair = {r.class_a, r.class_b}
        if {item_storage_class, zone_storage_class} == pair:
            incompat_alert = f"🚫 KRİTİK UYUMSUZLUK: {r.class_a} ile {r.class_b} aynı bölgede tutulamaz! ({r.reason})"
            requires_override = True
            warning_message = f"{incompat_alert} | {warning_message or ''}"
            break

    return {
        "is_valid": not requires_override,
        "is_mismatched": is_mismatched,
        "requires_override": requires_override,
        "warning_message": warning_message,
        "item_storage_class": item_storage_class,
        "bin_id": target_bin.id,
        "bin_code": target_bin.code,
        "zone_name": zone.name,
        "zone_storage_class": zone_storage_class
    }


@router.post("/assign-bin")
async def assign_lot_bin(
    payload: AssignBinRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Assigns a batch lot to a shelf/bin.
    Enforces override reason if storage classes mismatch.
    Records an immutable audit trail entry.
    """
    lot = await db.get(BatchLot, payload.batch_lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Parti / Lot kaydı bulunamadı.")

    target_bin = await db.get(WarehouseBin, payload.new_bin_id)
    if not target_bin:
        raise HTTPException(status_code=404, detail="Hedef raf bulunamadı.")

    item = lot.item
    item_storage_class = item.storage_class if item else "Genel"
    zone = target_bin.zone
    zone_storage_class = zone.storage_class

    is_mismatched = (item_storage_class != zone_storage_class)

    # If mismatched, override reason is strictly mandatory
    if is_mismatched and (not payload.override_reason or not payload.override_reason.strip()):
        raise HTTPException(
            status_code=400,
            detail=f"Bu ürün '{item_storage_class}' sınıfında, seçilen raf '{zone_storage_class}'. "
                   f"Uyumsuz yerleşim için geçerli bir gerekçe yazılması zorunludur."
        )

    prev_bin_id = lot.bin_id
    prev_bin_code = lot.bin_code

    # Update lot
    lot.bin_id = target_bin.id
    lot.bin_code = target_bin.code

    # Create immutable audit record
    audit_entry = WarehousePlacementAudit(
        batch_lot_id=lot.id,
        lot_number=lot.batch_number,
        item_id=item.id if item else None,
        item_name=item.name if item else "Bilinmeyen Ürün",
        action_type="OVERRIDE_PLACEMENT" if is_mismatched else "BIN_TRANSFER",
        previous_bin_id=prev_bin_id,
        previous_bin_code=prev_bin_code,
        new_bin_id=target_bin.id,
        new_bin_code=target_bin.code,
        is_mismatched=is_mismatched,
        item_storage_class=item_storage_class,
        bin_storage_class=zone_storage_class,
        override_reason=payload.override_reason.strip() if payload.override_reason else None,
        user_id=current_user.id if current_user else 1,
        user_name=current_user.full_name if current_user else "Sistem / Yetkili Kullanıcı",
        user_email=current_user.email if current_user else "admin@gunaykimya.com"
    )
    db.add(audit_entry)

    await db.commit()

    return {
        "success": True,
        "message": f"Lot {lot.batch_number} başarıyla {target_bin.code} ({zone.name}) rafına atandı.",
        "data": {
            "lot_number": lot.batch_number,
            "bin_code": target_bin.code,
            "zone_name": zone.name,
            "is_mismatched": is_mismatched
        }
    }


# -------------------------------------------------------------
# 3. AUDIT TRAIL
# -------------------------------------------------------------
@router.get("/audits")
async def list_placement_audits(
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve immutable warehouse placement and SDS change audit records."""
    stmt = select(WarehousePlacementAudit).order_by(desc(WarehousePlacementAudit.created_at)).limit(limit)
    res = await db.execute(stmt)
    records = res.scalars().all()

    return [
        {
            "id": r.id,
            "batch_lot_id": r.batch_lot_id,
            "lot_number": r.lot_number,
            "item_name": r.item_name,
            "action_type": r.action_type,
            "previous_bin_code": r.previous_bin_code,
            "new_bin_code": r.new_bin_code,
            "is_mismatched": r.is_mismatched,
            "item_storage_class": r.item_storage_class,
            "bin_storage_class": r.bin_storage_class,
            "override_reason": r.override_reason,
            "user_name": r.user_name,
            "user_email": r.user_email,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else None
        }
        for r in records
    ]


# -------------------------------------------------------------
# 4. INCOMPATIBILITY RULES
# -------------------------------------------------------------
@router.get("/incompatibility-rules")
async def list_incompatibility_rules(db: AsyncSession = Depends(get_db)):
    stmt = select(StorageIncompatibilityRule).order_by(StorageIncompatibilityRule.id)
    res = await db.execute(stmt)
    rules = res.scalars().all()
    return [
        {
            "id": r.id,
            "class_a": r.class_a,
            "class_b": r.class_b,
            "reason": r.reason,
            "is_active": r.is_active
        }
        for r in rules
    ]


@router.post("/incompatibility-rules")
async def create_incompatibility_rule(payload: IncompatibilityRuleCreate, db: AsyncSession = Depends(get_db)):
    rule = StorageIncompatibilityRule(
        class_a=payload.class_a.strip(),
        class_b=payload.class_b.strip(),
        reason=payload.reason.strip(),
        is_active=True
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {"success": True, "message": "Uyumsuzluk kuralı eklendi.", "data": {"id": rule.id}}


@router.delete("/incompatibility-rules/{rule_id}")
async def toggle_incompatibility_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    r = await db.get(StorageIncompatibilityRule, rule_id)
    if not r:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")
    r.is_active = not r.is_active
    await db.commit()
    status_str = "aktif" if r.is_active else "pasif"
    return {"success": True, "message": f"Kural durumu {status_str} yapıldı."}


# -------------------------------------------------------------
# 5. SYSTEM SETTINGS
# -------------------------------------------------------------
@router.get("/settings")
async def get_hazmat_settings(db: AsyncSession = Depends(get_db)):
    stmt = select(SystemConfig)
    res = await db.execute(stmt)
    configs = {c.config_key: c.config_value for c in res.scalars().all()}

    return {
        "sds_validity_months": int(configs.get("sds_validity_months", "36")),
        "label_disclaimer": configs.get("label_disclaimer", "Etiket tehlike bilgisi taslaktır, yasal etiket yerine geçmez.")
    }


@router.post("/settings")
async def update_hazmat_settings(payload: SettingsUpdateRequest, db: AsyncSession = Depends(get_db)):
    if payload.sds_validity_months is not None:
        cfg = await db.scalar(select(SystemConfig).where(SystemConfig.config_key == "sds_validity_months"))
        if cfg:
            cfg.config_value = str(payload.sds_validity_months)
        else:
            db.add(SystemConfig(config_key="sds_validity_months", config_value=str(payload.sds_validity_months)))

    if payload.label_disclaimer is not None:
        cfg = await db.scalar(select(SystemConfig).where(SystemConfig.config_key == "label_disclaimer"))
        if cfg:
            cfg.config_value = payload.label_disclaimer
        else:
            db.add(SystemConfig(config_key="label_disclaimer", config_value=payload.label_disclaimer))

    await db.commit()
    return {"success": True, "message": "Ayarlar başarıyla güncellendi."}


# -------------------------------------------------------------
# 6. SDS (GBF) FILE UPLOAD & VIEWING
# -------------------------------------------------------------
@router.post("/items/{item_id}/sds-upload")
async def upload_sds_file(
    item_id: int,
    file: UploadFile = File(...),
    sds_revision_date: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads SDS (GBF) PDF file for an item (max 10MB).
    """
    item = await db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Yalnızca PDF formatındaki GBF dosyaları yüklenebilir.")

    # Check file size (max 10 MB = 10 * 1024 * 1024 bytes)
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Dosya boyutu 10 MB sınırını aşamaz.")

    # Save to disk
    clean_sku = "".join(c for c in item.sku if c.isalnum() or c in ("-", "_"))
    safe_filename = f"SDS_{clean_sku}_{int(datetime.datetime.utcnow().timestamp())}.pdf"
    file_path = os.path.join(UPLOADS_SDS_DIR, safe_filename)

    with open(file_path, "wb") as out_f:
        out_f.write(file_bytes)

    # Parse revision date
    rev_date = None
    if sds_revision_date:
        try:
            rev_date = datetime.datetime.strptime(sds_revision_date.strip(), "%Y-%m-%d").date()
        except ValueError:
            pass

    item.sds_file_name = safe_filename
    item.sds_file_url = f"/api/v1/hazmat/sds-files/{safe_filename}"
    if rev_date:
        item.sds_revision_date = rev_date

    # Audit log
    audit = WarehousePlacementAudit(
        batch_lot_id=None,
        lot_number=f"GBF-{item.sku}",
        item_id=item.id,
        item_name=item.name,
        action_type="SDS_UPLOAD",
        override_reason=f"GBF yüklendi: {safe_filename} (Revizyon: {rev_date or 'Belirtilmedi'})",
        user_id=current_user.id if current_user else 1,
        user_name=current_user.full_name if current_user else "Sistem / Yetkili Kullanıcı",
        user_email=current_user.email if current_user else "admin@gunaykimya.com"
    )
    db.add(audit)

    await db.commit()

    return {
        "success": True,
        "message": "GBF (SDS) dosyası başarıyla yüklendi.",
        "data": {
            "sds_file_name": safe_filename,
            "sds_file_url": item.sds_file_url,
            "sds_revision_date": str(item.sds_revision_date) if item.sds_revision_date else None
        }
    }


@router.delete("/items/{item_id}/sds")
async def delete_sds_file(
    item_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    item = await db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")

    old_fn = item.sds_file_name
    item.sds_file_name = None
    item.sds_file_url = None
    item.sds_revision_date = None

    # Audit log
    audit = WarehousePlacementAudit(
        batch_lot_id=None,
        lot_number=f"GBF-{item.sku}",
        item_id=item.id,
        item_name=item.name,
        action_type="SDS_DELETE",
        override_reason=f"GBF kaldırıldı: {old_fn}",
        user_id=current_user.id if current_user else 1,
        user_name=current_user.full_name if current_user else "Sistem / Yetkili Kullanıcı",
        user_email=current_user.email if current_user else "admin@gunaykimya.com"
    )
    db.add(audit)

    await db.commit()
    return {"success": True, "message": "GBF dosyası kaldırıldı."}


@router.get("/sds-files/{filename}")
async def serve_sds_file(filename: str):
    """Streams SDS PDF directly for viewing in new browser tab."""
    safe_fn = os.path.basename(filename)
    file_path = os.path.join(UPLOADS_SDS_DIR, safe_fn)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="GBF dosyası sunucuda bulunamadı.")

    return FileResponse(file_path, media_type="application/pdf", filename=safe_fn)


# -------------------------------------------------------------
# 7. DASHBOARD METRICS
# -------------------------------------------------------------
@router.get("/dashboard-metrics")
async def get_hazmat_dashboard_metrics(db: AsyncSession = Depends(get_db)):
    """
    Returns metrics for hazardous materials and SDS missing/expired warnings.
    """
    cfg = await db.scalar(select(SystemConfig).where(SystemConfig.config_key == "sds_validity_months"))
    validity_months = int(cfg.config_value) if cfg and cfg.config_value.isdigit() else 36

    now_date = datetime.date.today()
    cutoff_date = now_date - datetime.timedelta(days=validity_months * 30.5)

    items_res = await db.execute(select(Item).where(Item.is_active == True))
    all_items = items_res.scalars().all()

    missing_sds_count = 0
    expired_sds_count = 0
    total_hazardous_items = 0

    for it in all_items:
        is_hazardous = bool(it.hazard_class or (it.ghs_pictograms and it.ghs_pictograms != "[]") or (it.signal_word and it.signal_word != "Yok"))
        if is_hazardous:
            total_hazardous_items += 1

            # Check SDS presence
            if not it.sds_file_url:
                missing_sds_count += 1
            elif it.sds_revision_date and it.sds_revision_date < cutoff_date:
                expired_sds_count += 1

    return {
        "sds_warning_count": missing_sds_count + expired_sds_count,
        "missing_sds_count": missing_sds_count,
        "expired_sds_count": expired_sds_count,
        "total_hazardous_items": total_hazardous_items,
        "validity_months": validity_months
    }
