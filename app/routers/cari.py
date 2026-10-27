import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_db
from app.models.cari import (
    CariAccount, CariGroup, CheckBond, CheckBondStatus, CheckBondType, RiskStatus, CariType
)
from app.schemas.cari import (
    CariAccountCreate, CariAccountUpdate, CariAccountResponse, CariGroupCreate, CariGroupResponse,
    RiskLimitResponse
)

router = APIRouter(prefix="/caris", tags=["Cari & Credit Risk Engine"])

# ---------------------------------------------------------
# Helper Functions: Credit Risk Enforcement
# ---------------------------------------------------------
def evaluate_and_enforce_credit_risk(
    cari: CariAccount, 
    additional_charge: Decimal = Decimal("0.00")
) -> RiskLimitResponse:
    """
    CRITICAL RISK LOGIC:
    Evaluates real-time exposure:
    Current Risk = current_balance + open_orders_balance + open_uncollected_checks + additional_charge.
    Computes available credit and blocks transaction if limit exceeded and allow_overlimit_sales is False.
    """
    current_risk = (
        cari.current_balance + 
        cari.open_orders_balance + 
        cari.open_uncollected_checks + 
        additional_charge
    )
    max_credit_limit = cari.credit_limit
    
    utilization_pct = (
        (current_risk / max_credit_limit * Decimal("100.00")) 
        if max_credit_limit > Decimal("0.00") 
        else Decimal("0.00")
    )

    is_blocked = False
    message = "Credit limit within safe operating parameters."

    if max_credit_limit > Decimal("0.00") and current_risk > max_credit_limit:
        if not cari.allow_overlimit_sales:
            is_blocked = True
            message = (
                f"Credit limit breach! Current exposure ({current_risk:.2f} TRY) "
                f"exceeds max credit limit ({max_credit_limit:.2f} TRY). Transaction blocked."
            )
            cari.risk_status = RiskStatus.BLOCKED
        else:
            message = (
                f"Warning: Exposure ({current_risk:.2f} TRY) exceeds limit ({max_credit_limit:.2f} TRY), "
                "but overlimit transactions are permitted."
            )
            cari.risk_status = RiskStatus.APPROACHING_LIMIT
    elif utilization_pct >= Decimal("80.00"):
        cari.risk_status = RiskStatus.APPROACHING_LIMIT
        message = f"Caution: Credit limit utilization is high at {utilization_pct:.1f}%."
    else:
        cari.risk_status = RiskStatus.HEALTHY

    return RiskLimitResponse(
        cari_id=cari.id,
        cari_code=cari.code,
        title=cari.title,
        max_credit_limit=max_credit_limit,
        current_risk=current_risk,
        utilization_pct=utilization_pct,
        risk_status=cari.risk_status,
        is_blocked=is_blocked,
        message=message
    )


# ---------------------------------------------------------
# Cari Group Endpoints
# ---------------------------------------------------------
@router.post("/groups/", response_model=CariGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_cari_group(
    payload: CariGroupCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a client pricing/discount tier (e.g. Industrial Bulk, Distributor, Retailer)."""
    existing = await db.scalar(select(CariGroup).where(CariGroup.code == payload.code))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cari group with code '{payload.code}' already exists."
        )

    group = CariGroup(
        code=payload.code,
        name=payload.name,
        default_payment_term_days=payload.default_payment_term_days,
        default_discount_percentage=payload.default_discount_percentage
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group

@router.get("/groups/", response_model=List[CariGroupResponse])
async def list_cari_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """List all dealer/client classification groups."""
    stmt = select(CariGroup).offset(skip).limit(limit)
    result = await db.scalars(stmt)
    return list(result.all())


# ---------------------------------------------------------
# Cari Dealer / Client Endpoints
# ---------------------------------------------------------
@router.get("/", response_model=List[CariAccountResponse])
async def list_caris(
    cari_type: Optional[CariType] = Query(None, description="Filter by CUSTOMER, SUPPLIER, or BOTH"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    q: Optional[str] = Query(None, description="Search by code, title, tax number or contact person"),
    group_id: Optional[int] = Query(None, description="Filter dealers by CariGroup ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    List all accounts (customers/dealers/suppliers) with pagination and rich filtering.
    """
    query = select(CariAccount)
    if cari_type is not None:
        query = query.where(CariAccount.cari_type == cari_type)
    if is_active is not None:
        query = query.where(CariAccount.is_active == is_active)
    if group_id is not None:
        query = query.where(CariAccount.group_id == group_id)
    if q:
        pat = f"%{q.strip()}%"
        query = query.where(
            or_(
                CariAccount.code.ilike(pat),
                CariAccount.title.ilike(pat),
                CariAccount.tax_number.ilike(pat),
                CariAccount.contact_person.ilike(pat)
            )
        )
    
    query = query.order_by(CariAccount.id.desc()).offset(skip).limit(limit)
    result = await db.scalars(query)
    return list(result.all())

@router.get("/{id}", response_model=CariAccountResponse)
async def get_cari(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve single customer or supplier account by ID."""
    cari = await db.get(CariAccount, id)
    if not cari:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cari account with ID {id} not found."
        )
    return cari

@router.post("/", response_model=CariAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_cari(
    payload: CariAccountCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new customer (dealer) or supplier account.
    """
    existing = await db.scalar(select(CariAccount).where(CariAccount.code == payload.code.strip()))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cari account with code '{payload.code}' already exists."
        )

    if payload.group_id:
        group = await db.get(CariGroup, payload.group_id)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"CariGroup with ID {payload.group_id} not found."
            )

    cari = CariAccount(
        code=payload.code.strip(),
        title=payload.title.strip(),
        cari_type=payload.cari_type,
        group_id=payload.group_id,
        tax_number=payload.tax_number.strip() if payload.tax_number else None,
        tax_office=payload.tax_office.strip() if payload.tax_office else None,
        contact_person=payload.contact_person.strip() if payload.contact_person else None,
        phone=payload.phone.strip() if payload.phone else None,
        email=payload.email.strip() if payload.email else None,
        address=payload.address.strip() if payload.address else None,
        payment_term_days=payload.payment_term_days,
        supplied_product_ids=payload.supplied_product_ids,
        credit_limit=payload.credit_limit,
        check_risk_limit=payload.check_risk_limit,
        allow_overlimit_sales=payload.allow_overlimit_sales,
        is_active=payload.is_active
    )
    db.add(cari)
    await db.commit()
    await db.refresh(cari)
    return cari

@router.put("/{id}", response_model=CariAccountResponse)
async def update_cari(
    id: int,
    payload: CariAccountUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update customer or supplier account fields."""
    cari = await db.get(CariAccount, id)
    if not cari:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cari account with ID {id} not found."
        )

    if payload.title is not None:
        cari.title = payload.title.strip()
    if payload.cari_type is not None:
        cari.cari_type = payload.cari_type
    if payload.group_id is not None:
        cari.group_id = payload.group_id
    if payload.tax_number is not None:
        cari.tax_number = payload.tax_number.strip() if payload.tax_number else None
    if payload.tax_office is not None:
        cari.tax_office = payload.tax_office.strip() if payload.tax_office else None
    if payload.contact_person is not None:
        cari.contact_person = payload.contact_person.strip() if payload.contact_person else None
    if payload.phone is not None:
        cari.phone = payload.phone.strip() if payload.phone else None
    if payload.email is not None:
        cari.email = payload.email.strip() if payload.email else None
    if payload.address is not None:
        cari.address = payload.address.strip() if payload.address else None
    if payload.payment_term_days is not None:
        cari.payment_term_days = payload.payment_term_days
    if payload.supplied_product_ids is not None:
        cari.supplied_product_ids = payload.supplied_product_ids
    if payload.credit_limit is not None:
        cari.credit_limit = payload.credit_limit
    if payload.check_risk_limit is not None:
        cari.check_risk_limit = payload.check_risk_limit
    if payload.allow_overlimit_sales is not None:
        cari.allow_overlimit_sales = payload.allow_overlimit_sales
    if payload.is_active is not None:
        cari.is_active = payload.is_active

    await db.commit()
    await db.refresh(cari)
    return cari

@router.patch("/{id}/toggle-active", response_model=CariAccountResponse)
async def toggle_cari_active(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Toggle customer or supplier active/passive status (soft deactivation)."""
    cari = await db.get(CariAccount, id)
    if not cari:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cari account with ID {id} not found."
        )
    cari.is_active = not cari.is_active
    await db.commit()
    await db.refresh(cari)
    return cari

@router.get("/checks-bonds/maturities")
async def list_check_bond_maturities(
    days_ahead: int = Query(90, ge=1, le=365),
    cari_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns upcoming check and promissory note maturities for cash-flow forecasting.
    """
    today = datetime.date.today()
    max_date = today + datetime.timedelta(days=days_ahead)
    
    stmt = (
        select(CheckBond)
        .options(selectinload(CheckBond.cari))
        .where(
            CheckBond.status.in_([CheckBondStatus.IN_PORTFOLIO, CheckBondStatus.IN_BANK_COLLECTION]),
            CheckBond.maturity_date <= max_date
        )
        .order_by(CheckBond.maturity_date.asc())
    )
    if cari_id:
        stmt = stmt.where(CheckBond.cari_id == cari_id)
        
    bonds = (await db.scalars(stmt)).all()
    
    return [
        {
            "id": b.id,
            "portfolio_number": b.portfolio_number,
            "serial_number": b.serial_number,
            "instrument_type": b.instrument_type.value,
            "bank_name": b.bank_name,
            "branch_name": b.branch_name,
            "debtor_name": b.debtor_name,
            "issue_date": b.issue_date.isoformat(),
            "maturity_date": b.maturity_date.isoformat(),
            "amount": float(b.amount),
            "currency": b.currency,
            "status": b.status.value,
            "cari_name": b.cari.title if b.cari else "Bilinmiyor"
        }
        for b in bonds
    ]

@router.get("/{id}/risk-status", response_model=RiskLimitResponse)
async def get_cari_risk_status(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch dealer max_credit_limit, verify dynamic check/bond maturity exposure,
    and compute available credit balance.
    """
    # Load Cari and active check/bond portfolio
    stmt = (
        select(CariAccount)
        .options(selectinload(CariAccount.check_bonds))
        .where(CariAccount.id == id)
    )
    cari = await db.scalar(stmt)
    if not cari:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cari account with ID {id} not found."
        )

    # Calculate dynamic active portfolio uncollected checks
    active_uncollected_checks = sum(
        cb.amount for cb in cari.check_bonds
        if cb.status in (CheckBondStatus.IN_PORTFOLIO, CheckBondStatus.IN_BANK_COLLECTION)
        and cb.instrument_type in (CheckBondType.RECEIVABLE_CHECK, CheckBondType.RECEIVABLE_BOND)
    )
    cari.open_uncollected_checks = active_uncollected_checks

    assessment = evaluate_and_enforce_credit_risk(cari, additional_charge=Decimal("0.00"))
    await db.commit()
    return assessment

@router.post("/{id}/validate-charge", response_model=RiskLimitResponse)
async def validate_transaction_charge(
    id: int,
    charge_amount: Decimal = Query(..., gt=Decimal("0.00"), description="Prospective invoice or order charge amount"),
    db: AsyncSession = Depends(get_db)
):
    """
    CRITICAL RISK LOGIC ENDPOINT:
    Verifies if a prospective new invoice or order charge can be assigned to a Cari account.
    Raises HTTP 400 Bad Request if current_risk exceeds max_credit_limit and overlimit is disallowed.
    """
    cari = await db.get(CariAccount, id)
    if not cari:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cari account with ID {id} not found."
        )

    if not cari.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign charge to an inactive Cari account."
        )

    assessment = evaluate_and_enforce_credit_risk(cari, additional_charge=charge_amount)
    await db.commit()

    if assessment.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=assessment.message
        )

    return assessment
