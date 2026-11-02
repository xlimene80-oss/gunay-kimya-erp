import re
import urllib.parse
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.core.security import get_current_user
from app.models.auth import User, UserRoleEnum
from app.models.purchasing import PurchaseRequest
from app.schemas.purchasing import (
    PurchaseRequestCreate, PurchaseRequestUpdate, PurchaseRequestResponse
)

router = APIRouter(prefix="/purchasing", tags=["Procurement & Internal Requests"])

def build_whatsapp_link(phone: Optional[str], item_name: str, quantity: Decimal, unit: str) -> Optional[str]:
    if not phone:
        return None
    # Sanitize phone numbers: remove +, spaces, hyphens, parentheses
    clean_phone = re.sub(r"[^\d]", "", phone)
    if clean_phone.startswith("0"):
        clean_phone = "90" + clean_phone[1:]
    elif not clean_phone.startswith("90") and len(clean_phone) == 10:
        clean_phone = "90" + clean_phone

    msg = (
        f"Merhaba, Günay Kimya firmasından iletişime geçiyoruz. "
        f"'{item_name}' kaleminden {quantity} {unit} tedarik talebimiz mevcuttur. "
        f"Güncel birim fiyat ve termin süresi teklifinizi paylaşmanızı rica ederiz."
    )
    encoded_msg = urllib.parse.quote(msg)
    return f"https://wa.me/{clean_phone}?text={encoded_msg}"

def build_mailto_link(email: Optional[str], item_name: str, quantity: Decimal, unit: str) -> Optional[str]:
    if not email:
        return None
    subject = urllib.parse.quote(f"Fiyat Teklifi Talebi: {item_name} - Günay Kimya")
    body = urllib.parse.quote(
        f"Sayın Yetkili,\n\n"
        f"Günay Kimya üretim/stok planlamamız doğrultusunda '{item_name}' hammaddesinden/malzemesinden "
        f"{quantity} {unit} tedarik etmeyi planlamaktayız.\n\n"
        f"Teklifinizi birim fiyat (KDV ve nakliye koşulları dahil) ve tahmini teslim tarihi ile tarafımıza iletmenizi rica ederiz.\n\n"
        f"İyi çalışmalar dileriz,\n"
        f"Günay Kimya Satınalma Departmanı"
    )
    return f"mailto:{email}?subject={subject}&body={body}"

def enrich_response(req: PurchaseRequest) -> PurchaseRequestResponse:
    wa_url = build_whatsapp_link(req.vendor_phone, req.item_name, req.quantity, req.unit)
    mail_url = build_mailto_link(req.vendor_email, req.item_name, req.quantity, req.unit)
    
    return PurchaseRequestResponse(
        id=req.id,
        requested_by_id=req.requested_by_id,
        item_name=req.item_name,
        quantity=req.quantity,
        unit=req.unit,
        status=req.status,
        vendor_email=req.vendor_email,
        vendor_phone=req.vendor_phone,
        notes=req.notes,
        whatsapp_url=wa_url,
        mailto_url=mail_url,
        created_at=req.created_at,
        updated_at=req.updated_at
    )


@router.post("/requests", response_model=PurchaseRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_request(
    req_in: PurchaseRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Staff internal purchase requisition creation.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="B2B Müşterileri satınalma talebi açamaz."
        )

    new_req = PurchaseRequest(
        requested_by_id=current_user.id,
        item_name=req_in.item_name,
        quantity=req_in.quantity,
        unit=req_in.unit,
        status="Onay Bekliyor",
        vendor_email=req_in.vendor_email,
        vendor_phone=req_in.vendor_phone,
        notes=req_in.notes
    )
    db.add(new_req)
    await db.commit()
    await db.refresh(new_req)

    return enrich_response(new_req)


@router.get("/requests", response_model=List[PurchaseRequestResponse])
async def list_purchase_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all internal procurement requisitions.
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim.")

    stmt = select(PurchaseRequest).order_by(desc(PurchaseRequest.created_at))
    if status_filter:
        stmt = stmt.where(PurchaseRequest.status == status_filter)

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [enrich_response(r) for r in items]


@router.get("/requests/{request_id}", response_model=PurchaseRequestResponse)
async def get_purchase_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(PurchaseRequest).where(PurchaseRequest.id == request_id)
    res = await db.execute(stmt)
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Satınalma talebi bulunamadı.")
    return enrich_response(req)


@router.patch("/requests/{request_id}", response_model=PurchaseRequestResponse)
async def update_purchase_request(
    request_id: int,
    req_in: PurchaseRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update request details or approval status ('Onay Bekliyor', 'Onaylandı', 'Satınalma Yapıldı', 'Reddedildi').
    """
    if current_user.role == UserRoleEnum.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim.")

    stmt = select(PurchaseRequest).where(PurchaseRequest.id == request_id)
    res = await db.execute(stmt)
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Satınalma talebi bulunamadı.")

    if req_in.item_name is not None:
        req.item_name = req_in.item_name
    if req_in.quantity is not None:
        req.quantity = req_in.quantity
    if req_in.unit is not None:
        req.unit = req_in.unit
    if req_in.status is not None:
        req.status = req_in.status
    if req_in.vendor_email is not None:
        req.vendor_email = req_in.vendor_email
    if req_in.vendor_phone is not None:
        req.vendor_phone = req_in.vendor_phone
    if req_in.notes is not None:
        req.notes = req_in.notes

    await db.commit()
    await db.refresh(req)
    return enrich_response(req)


@router.get("/requests/{request_id}/whatsapp-link")
async def get_request_whatsapp_link(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates sanitized direct WhatsApp URL & prefilled RFQ message for quick dispatch to chemical vendor.
    """
    stmt = select(PurchaseRequest).where(PurchaseRequest.id == request_id)
    res = await db.execute(stmt)
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Satınalma talebi bulunamadı.")

    if not req.vendor_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu satınalma talebinde tedarikçi telefon numarası tanımlı değil."
        )

    link = build_whatsapp_link(req.vendor_phone, req.item_name, req.quantity, req.unit)
    return {
        "request_id": req.id,
        "item_name": req.item_name,
        "vendor_phone": req.vendor_phone,
        "whatsapp_url": link
    }
