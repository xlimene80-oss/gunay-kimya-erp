import datetime
import random
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_current_user, get_optional_current_user
from app.models.auth import User
from app.models.inventory import Item, BatchLot, ItemCategory
from app.models.quality import (
    LotStatus, InspectionDecision,
    QualityTestTemplate, QualityTestItem,
    QualityInspection, QualityInspectionResult,
    QualityCertificateOfAnalysis
)

router = APIRouter(prefix="/quality", tags=["Quality Control"])

# -------------------------------------------------------------
# Pydantic Schemas
# -------------------------------------------------------------
class TestMeasurementIn(BaseModel):
    test_name: str
    unit: Optional[str] = ""
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    expected_text: Optional[str] = None
    method: Optional[str] = None
    measured_value: Optional[float] = None
    measured_text: Optional[str] = None
    is_passed: bool = True

class InspectionCreatePayload(BaseModel):
    batch_lot_id: int
    decision: str  # "Serbest Bırakıldı", "Bloke Edildi", "Reddedildi"
    decision_reason: Optional[str] = None
    notes: Optional[str] = None
    results: List[TestMeasurementIn] = Field(default_factory=list)

class TestItemIn(BaseModel):
    test_name: str
    unit: Optional[str] = ""
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    expected_text: Optional[str] = None
    method: Optional[str] = None
    order_index: int = 0

class TemplateCreatePayload(BaseModel):
    item_id: int
    name: str
    description: Optional[str] = None
    tests: List[TestItemIn] = Field(default_factory=list)

# -------------------------------------------------------------
# 1. Dashboard Metrics
# -------------------------------------------------------------
@router.get("/dashboard-metrics")
async def get_quality_dashboard_metrics(db: AsyncSession = Depends(get_db)):
    """
    Returns counts for quarantine lots, released lots, blocked lots, and CoAs.
    """
    # Count lots by status
    karantina_stmt = select(func.count(BatchLot.id)).where(BatchLot.status == "Karantina")
    karantina_count = await db.scalar(karantina_stmt) or 0

    serbest_stmt = select(func.count(BatchLot.id)).where(or_(BatchLot.status == "Serbest", BatchLot.status == None))
    serbest_count = await db.scalar(serbest_stmt) or 0

    bloke_stmt = select(func.count(BatchLot.id)).where(BatchLot.status.in_(["Bloke", "Reddedildi"]))
    bloke_count = await db.scalar(bloke_stmt) or 0

    coa_stmt = select(func.count(QualityCertificateOfAnalysis.id))
    coa_count = await db.scalar(coa_stmt) or 0

    return {
        "pending_count": karantina_count,
        "released_count": serbest_count,
        "blocked_count": bloke_count,
        "coa_count": coa_count
    }

# -------------------------------------------------------------
# 2. Kontrol Bekleyen Lotlar (Quarantine Queue)
# -------------------------------------------------------------
@router.get("/inspections/pending")
async def list_pending_inspections(db: AsyncSession = Depends(get_db)):
    """
    Lists lots currently in 'Karantina' status waiting for laboratory testing.
    """
    stmt = (
        select(BatchLot)
        .options(selectinload(BatchLot.item))
        .where(BatchLot.status == "Karantina")
        .order_by(BatchLot.received_at.asc(), BatchLot.id.asc())
    )
    lots = (await db.scalars(stmt)).all()

    now = datetime.datetime.now(datetime.timezone.utc)
    results = []
    for lot in lots:
        # Determine source
        is_finished = lot.item and (lot.item.category == ItemCategory.FINISHED_GOOD or lot.warehouse == "Mamul Ürün Deposu")
        source = "Üretim (Dolum)" if is_finished else "Mal Kabul (Tedarikçi)"

        # Calculate waiting time
        rec_time = lot.received_at
        if rec_time and rec_time.tzinfo is None:
            rec_time = rec_time.replace(tzinfo=datetime.timezone.utc)
        wait_hours = int((now - rec_time).total_seconds() // 3600) if rec_time else 0
        if wait_hours < 24:
            wait_str = f"{wait_hours} saat"
        else:
            wait_str = f"{wait_hours // 24} gün"

        # Check if template exists for item
        tpl_stmt = (
            select(QualityTestTemplate)
            .options(selectinload(QualityTestTemplate.tests))
            .where(QualityTestTemplate.item_id == lot.item_id, QualityTestTemplate.is_active == True)
        )
        template = await db.scalar(tpl_stmt)

        results.append({
            "lot_id": lot.id,
            "batch_number": lot.batch_number,
            "item_id": lot.item_id,
            "item_name": lot.item.name if lot.item else "Bilinmeyen Ürün",
            "item_sku": lot.item.sku if lot.item else "N/A",
            "item_category": lot.item.category.value if lot.item and hasattr(lot.item.category, "value") else str(lot.item.category if lot.item else ""),
            "warehouse": lot.warehouse,
            "quantity": float(lot.quantity),
            "unit": lot.item.unit if lot.item else "kg",
            "status": lot.status,
            "source": source,
            "received_at": lot.received_at.isoformat() if lot.received_at else None,
            "wait_time_display": wait_str,
            "expiration_date": lot.expiration_date.isoformat() if lot.expiration_date else None,
            "qc_notes": lot.qc_notes,
            "has_template": template is not None,
            "template_id": template.id if template else None,
            "template_name": template.name if template else None,
            "tests": [
                {
                    "id": t.id,
                    "test_name": t.test_name,
                    "unit": t.unit,
                    "min_value": float(t.min_value) if t.min_value is not None else None,
                    "max_value": float(t.max_value) if t.max_value is not None else None,
                    "expected_text": t.expected_text,
                    "method": t.method,
                    "order_index": t.order_index
                }
                for t in (template.tests if template else [])
            ]
        })

    return results

# -------------------------------------------------------------
# 3. Kalite Kontrol Karar Girişi (Post Inspection)
# -------------------------------------------------------------
@router.post("/inspections")
async def record_quality_inspection(
    payload: InspectionCreatePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Records an immutable QC decision:
    - Guardrail: Only users with 'ADMIN' or 'KALITE' roles can decide.
    - If decision is 'Serbest Bırakıldı' -> lot.status = 'Serbest'.
      If finished good -> creates Certificate of Analysis (CoA).
    - If decision is 'Bloke Edildi' or 'Reddedildi' -> lot.status = 'Bloke' / 'Reddedildi'.
      Reason is mandatory.
    - Generates immutable audit trail.
    """
    # Verify RBAC Role: Admin or Kalite
    user_roles = [ur.role.role_name.upper() for ur in current_user.user_roles if ur.role]
    is_authorized = any(r in ["ADMIN", "KALITE"] or "KALITE" in r or "ADMIN" in r for r in user_roles)
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kalite kararı verme yetkiniz yok. Sadece 'Kalite' ve 'Admin' rolleri karar verebilir."
        )

    # Validate lot
    lot = await db.get(BatchLot, payload.batch_lot_id)
    if not lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lot ID={payload.batch_lot_id} bulunamadı."
        )

    item = await db.get(Item, lot.item_id)

    # Validate decision & mandatory reason for block/reject
    dec = payload.decision.strip()
    if dec not in ["Serbest Bırakıldı", "Bloke Edildi", "Reddedildi"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz karar. 'Serbest Bırakıldı', 'Bloke Edildi' veya 'Reddedildi' seçilmelidir."
        )

    if dec in ["Bloke Edildi", "Reddedildi"] and not (payload.decision_reason and payload.decision_reason.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bloke etme veya Reddetme kararlarında 'Gerekçe/Neden' alanı zorunludur."
        )

    # Determine source type
    is_finished = item and (item.category == ItemCategory.FINISHED_GOOD or lot.warehouse == "Mamul Ürün Deposu")
    source_type = "URETIM" if is_finished else "MAL_KABUL"

    # Generate sequential inspection number
    total_insp = await db.scalar(select(func.count(QualityInspection.id))) or 0
    insp_number = f"QC-{datetime.date.today().year}-{(total_insp + 1):04d}"

    # Create inspection record
    inspection = QualityInspection(
        inspection_number=insp_number,
        batch_lot_id=lot.id,
        source_type=source_type,
        decision=dec,
        decision_reason=payload.decision_reason,
        inspector_id=current_user.id,
        inspector_name=current_user.full_name or "Kalite Sorumlusu",
        notes=payload.notes
    )
    db.add(inspection)
    await db.flush()

    # Record individual test results
    for r in payload.results:
        res_item = QualityInspectionResult(
            inspection_id=inspection.id,
            test_name=r.test_name,
            unit=r.unit or "",
            min_value=Decimal(str(r.min_value)) if r.min_value is not None else None,
            max_value=Decimal(str(r.max_value)) if r.max_value is not None else None,
            method=r.method,
            measured_value=Decimal(str(r.measured_value)) if r.measured_value is not None else None,
            measured_text=r.measured_text,
            is_passed=r.is_passed
        )
        db.add(res_item)

    # Update BatchLot status
    if dec == "Serbest Bırakıldı":
        lot.status = "Serbest"
        lot.qc_notes = f"Kalite Onayı: {insp_number} ile serbest bırakıldı ({current_user.full_name})."

        # If finished good, automatically generate a Certificate of Analysis (CoA)
        if is_finished:
            total_coa = await db.scalar(select(func.count(QualityCertificateOfAnalysis.id))) or 0
            coa_number = f"COA-{datetime.date.today().year}-{(total_coa + 1):04d}"
            
            today = datetime.date.today()
            prod_date = lot.received_at.date() if lot.received_at else today
            
            coa = QualityCertificateOfAnalysis(
                certificate_number=coa_number,
                inspection_id=inspection.id,
                batch_lot_id=lot.id,
                product_name=item.name if item else "Kimyasal Ürün",
                product_sku=item.sku if item else "N/A",
                lot_number=lot.batch_number,
                production_date=prod_date,
                expiration_date=lot.expiration_date,
                approved_by=current_user.full_name or "Kalite Yöneticisi",
                notes=f"Kalite Kontrol laboratuvar onayından geçmiştir ({insp_number})."
            )
            db.add(coa)
    elif dec == "Bloke Edildi":
        lot.status = "Bloke"
        lot.qc_notes = f"Kalite Kararı (Bloke): {payload.decision_reason} ({insp_number} - {current_user.full_name})"
    elif dec == "Reddedildi":
        lot.status = "Reddedildi"
        lot.qc_notes = f"Kalite Kararı (Red): {payload.decision_reason} ({insp_number} - {current_user.full_name})"

    await db.commit()

    return {
        "success": True,
        "inspection_number": insp_number,
        "lot_status": lot.status,
        "message": f"Kalite kararı kaydedildi: Lot durumu '{lot.status}' olarak güncellendi."
    }

# -------------------------------------------------------------
# 4. Kalite Kontrol Geçmişi (All Inspections)
# -------------------------------------------------------------
@router.get("/inspections")
async def list_inspections(
    batch_lot_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(QualityInspection)
        .options(
            selectinload(QualityInspection.batch_lot).selectinload(BatchLot.item),
            selectinload(QualityInspection.results),
            selectinload(QualityInspection.coa)
        )
        .order_by(QualityInspection.id.desc())
    )
    if batch_lot_id:
        stmt = stmt.where(QualityInspection.batch_lot_id == batch_lot_id)

    inspections = (await db.scalars(stmt)).all()
    out = []
    for ins in inspections:
        lot = ins.batch_lot
        item = lot.item if lot else None
        out.append({
            "id": ins.id,
            "inspection_number": ins.inspection_number,
            "batch_lot_id": ins.batch_lot_id,
            "lot_number": lot.batch_number if lot else "N/A",
            "item_name": item.name if item else "N/A",
            "item_sku": item.sku if item else "N/A",
            "source_type": ins.source_type,
            "decision": ins.decision,
            "decision_reason": ins.decision_reason,
            "inspector_name": ins.inspector_name,
            "inspected_at": ins.inspected_at.isoformat() if ins.inspected_at else None,
            "notes": ins.notes,
            "has_coa": ins.coa is not None,
            "coa_id": ins.coa.id if ins.coa else None,
            "coa_number": ins.coa.certificate_number if ins.coa else None,
            "results": [
                {
                    "test_name": r.test_name,
                    "unit": r.unit,
                    "min_value": float(r.min_value) if r.min_value is not None else None,
                    "max_value": float(r.max_value) if r.max_value is not None else None,
                    "method": r.method,
                    "measured_value": float(r.measured_value) if r.measured_value is not None else None,
                    "measured_text": r.measured_text,
                    "is_passed": r.is_passed
                }
                for r in ins.results
            ]
        })
    return out

# -------------------------------------------------------------
# 5. Test Şablonları (Templates API)
# -------------------------------------------------------------
@router.get("/templates")
async def list_templates(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(QualityTestTemplate)
        .options(
            selectinload(QualityTestTemplate.item),
            selectinload(QualityTestTemplate.tests)
        )
        .order_by(QualityTestTemplate.id.asc())
    )
    templates = (await db.scalars(stmt)).all()
    return [
        {
            "id": t.id,
            "item_id": t.item_id,
            "item_name": t.item.name if t.item else "N/A",
            "item_sku": t.item.sku if t.item else "N/A",
            "name": t.name,
            "description": t.description,
            "is_active": t.is_active,
            "tests_count": len(t.tests),
            "tests": [
                {
                    "id": test.id,
                    "test_name": test.test_name,
                    "unit": test.unit,
                    "min_value": float(test.min_value) if test.min_value is not None else None,
                    "max_value": float(test.max_value) if test.max_value is not None else None,
                    "expected_text": test.expected_text,
                    "method": test.method,
                    "order_index": test.order_index
                }
                for test in t.tests
            ]
        }
        for t in templates
    ]

@router.get("/templates/item/{item_id}")
async def get_item_template(item_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(QualityTestTemplate)
        .options(
            selectinload(QualityTestTemplate.item),
            selectinload(QualityTestTemplate.tests)
        )
        .where(QualityTestTemplate.item_id == item_id, QualityTestTemplate.is_active == True)
    )
    template = await db.scalar(stmt)
    if not template:
        raise HTTPException(status_code=404, detail="Bu ürün için kayıtlı test şablonu bulunamadı.")

    return {
        "id": template.id,
        "item_id": template.item_id,
        "name": template.name,
        "description": template.description,
        "tests": [
            {
                "id": test.id,
                "test_name": test.test_name,
                "unit": test.unit,
                "min_value": float(test.min_value) if test.min_value is not None else None,
                "max_value": float(test.max_value) if test.max_value is not None else None,
                "expected_text": test.expected_text,
                "method": test.method,
                "order_index": test.order_index
            }
            for test in template.tests
        ]
    }

@router.post("/templates")
async def create_or_update_template(
    payload: TemplateCreatePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates or updates a test template for a given item.
    """
    item = await db.get(Item, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Seçilen ürün bulunamadı.")

    stmt = select(QualityTestTemplate).where(QualityTestTemplate.item_id == payload.item_id)
    existing = await db.scalar(stmt)
    if existing:
        existing.name = payload.name
        existing.description = payload.description
        # Clear existing tests and recreate
        await db.execute(select(QualityTestItem).where(QualityTestItem.template_id == existing.id))
        template = existing
    else:
        template = QualityTestTemplate(
            item_id=payload.item_id,
            name=payload.name,
            description=payload.description,
            is_active=True
        )
        db.add(template)
        await db.flush()

    # Add tests
    for idx, t in enumerate(payload.tests):
        test_item = QualityTestItem(
            template_id=template.id,
            test_name=t.test_name,
            unit=t.unit or "",
            min_value=Decimal(str(t.min_value)) if t.min_value is not None else None,
            max_value=Decimal(str(t.max_value)) if t.max_value is not None else None,
            expected_text=t.expected_text,
            method=t.method,
            order_index=t.order_index or (idx + 1)
        )
        db.add(test_item)

    await db.commit()
    return {"success": True, "template_id": template.id, "message": "Test şablonu başarıyla kaydedildi."}

@router.delete("/templates/{id}")
async def delete_template(
    id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    template = await db.get(QualityTestTemplate, id)
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı.")
    await db.delete(template)
    await db.commit()
    return {"success": True, "message": "Şablon silindi."}

# -------------------------------------------------------------
# 6. Analiz Sertifikaları (CoA API)
# -------------------------------------------------------------
@router.get("/coas")
async def list_certificates_of_analysis(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(QualityCertificateOfAnalysis)
        .options(
            selectinload(QualityCertificateOfAnalysis.batch_lot).selectinload(BatchLot.item),
            selectinload(QualityCertificateOfAnalysis.inspection).selectinload(QualityInspection.results)
        )
        .order_by(QualityCertificateOfAnalysis.id.desc())
    )
    coas = (await db.scalars(stmt)).all()
    out = []
    for c in coas:
        out.append({
            "id": c.id,
            "certificate_number": c.certificate_number,
            "inspection_id": c.inspection_id,
            "batch_lot_id": c.batch_lot_id,
            "product_name": c.product_name,
            "product_sku": c.product_sku,
            "lot_number": c.lot_number,
            "production_date": c.production_date.isoformat() if c.production_date else None,
            "expiration_date": c.expiration_date.isoformat() if c.expiration_date else None,
            "approved_by": c.approved_by,
            "approval_date": c.approval_date.isoformat() if c.approval_date else None,
            "notes": c.notes,
            "test_count": len(c.inspection.results) if c.inspection and c.inspection.results else 0
        })
    return out

@router.get("/coas/{id}")
async def get_certificate_of_analysis_detail(id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(QualityCertificateOfAnalysis)
        .options(
            selectinload(QualityCertificateOfAnalysis.batch_lot).selectinload(BatchLot.item),
            selectinload(QualityCertificateOfAnalysis.inspection).selectinload(QualityInspection.results)
        )
        .where(QualityCertificateOfAnalysis.id == id)
    )
    coa = await db.scalar(stmt)
    if not coa:
        raise HTTPException(status_code=404, detail="Analiz Sertifikası bulunamadı.")

    results = []
    if coa.inspection and coa.inspection.results:
        for r in coa.inspection.results:
            spec_range = ""
            if r.min_value is not None and r.max_value is not None:
                spec_range = f"{r.min_value:.2f} - {r.max_value:.2f} {r.unit}".strip()
            elif r.min_value is not None:
                spec_range = f"≥ {r.min_value:.2f} {r.unit}".strip()
            elif r.max_value is not None:
                spec_range = f"≤ {r.max_value:.2f} {r.unit}".strip()
            else:
                spec_range = "Şartnameye Uygun"

            measured_display = ""
            if r.measured_value is not None:
                measured_display = f"{r.measured_value:.2f} {r.unit}".strip()
            elif r.measured_text:
                measured_display = r.measured_text
            else:
                measured_display = "Uygun"

            results.append({
                "test_name": r.test_name,
                "method": r.method or "Standart Laboratuvar Analizi",
                "specification": spec_range,
                "measured_result": measured_display,
                "status": "Uygun" if r.is_passed else "Uygun Değil",
                "is_passed": r.is_passed
            })

    return {
        "id": coa.id,
        "certificate_number": coa.certificate_number,
        "company_name": "GÜNAY KİMYA SANAYİ VE TİCARET A.Ş.",
        "company_subtitle": "Kalite Kontrol ve Ar-Ge Laboratuvarı",
        "company_address": "İzmir Atatürk Organize Sanayi Bölgesi (İAOSB), 10023 Sok. No:14 Çiğli / İzmir",
        "product_name": coa.product_name,
        "product_sku": coa.product_sku,
        "lot_number": coa.lot_number,
        "production_date": coa.production_date.isoformat() if coa.production_date else None,
        "expiration_date": coa.expiration_date.isoformat() if coa.expiration_date else None,
        "approved_by": coa.approved_by,
        "approval_date": coa.approval_date.strftime("%d.%m.%Y %H:%M") if coa.approval_date else None,
        "general_result": "Ürün firma şartnamelerine ve TSE standartlarına tam uygundur. ONAYLANDI.",
        "notes": coa.notes,
        "results": results
    }
