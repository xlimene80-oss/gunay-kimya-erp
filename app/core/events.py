import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notifications import Notification
from app.models.cari import CariAccount
from app.models.inventory import DispatchOrder

async def trigger_production_completed_event(
    db: AsyncSession,
    order_number: str,
    target_lot_number: str,
    output_item_name: str,
    quantity: Decimal,
    warehouse: str = "Mamul Ürün Deposu"
) -> Notification:
    """
    TRIGGER A (Production -> Warehouse):
    Automatically called when ProductionOrder hits COMPLETED.
    Generates an urgent task notification row for Role == DEPO_SORUMLUSU
    detailing the exact batch lot number and storage instructions.
    """
    title = f"Yeni Üretim Girişi: {output_item_name} ({target_lot_number})"
    message = (
        f"Üretim Emri {order_number} tamamlandı. {quantity} birim mamul "
        f"'{target_lot_number}' parti numarası ile '{warehouse}' lokasyonuna aktarılmaya hazırdır. "
        "Depolama Talimatı: Palet yerleşim barkodunu okutarak rafa alınız ve laboratuvar numunesini kontrol ediniz."
    )

    notif = Notification(
        recipient_role="DEPO_SORUMLUSU",
        title=title,
        message=message,
        event_type="PRODUCTION_COMPLETED",
        reference_module="PRODUCTION_ORDER",
        is_read=False
    )
    db.add(notif)
    return notif

async def trigger_dispatch_shipped_event(
    db: AsyncSession,
    dispatch_order: DispatchOrder
) -> Notification:
    """
    TRIGGER B (Warehouse -> B2B & Accounting):
    Automatically called when DispatchOrder is marked as SHIPPED by warehouse operator.
    1. Logs the transaction into the customer's CariAccount history as an active debt item.
    2. Decrements open orders balance.
    3. Generates notifications for Accounting (MUHASEBE) and B2B Portal (BAYI).
    """
    # 1. Calculate invoice total from dispatch items
    order_total = sum(
        item.quantity * (item.unit_price if item.unit_price else Decimal("0.0000"))
        for item in dispatch_order.items
    )

    # 2. Update Customer's Cari Account debt balance
    cari = await db.get(CariAccount, dispatch_order.cari_id)
    if cari:
        # Increase active debit (receivable for Günay Kimya, debt for dealer)
        cari.current_balance += order_total
        # Reduce open orders balance
        cari.open_orders_balance = max(Decimal("0.00"), cari.open_orders_balance - order_total)

    # 3. Notification for Accounting Department
    accounting_notif = Notification(
        recipient_role="MUHASEBE",
        title=f"Sevkiyat Faturalandırıldı: {dispatch_order.dispatch_number}",
        message=(
            f"'{cari.title if cari else 'Cari #' + str(dispatch_order.cari_id)}' carisine ait "
            f"{dispatch_order.dispatch_number} numaralı sevkiyat tamamlandı. "
            f"Toplam {order_total:.2f} TRY tutarındaki sevkiyat müşteri cari borcuna tahakkuk ettirildi."
        ),
        event_type="DISPATCH_SHIPPED",
        reference_module="DISPATCH_ORDER",
        reference_id=dispatch_order.id,
        is_read=False
    )
    db.add(accounting_notif)

    # 4. Notification for B2B Dealer Portal
    dealer_notif = Notification(
        recipient_role="BAYI",
        title=f"Siparişiniz Sevk Edildi: {dispatch_order.dispatch_number}",
        message=(
            f"{dispatch_order.dispatch_number} nolu siparişiniz sevk aracına yüklendi ve yola çıktı. "
            f"Taşıyıcı Takip: {dispatch_order.carrier_tracking_code or 'Günay Kimya Filosu'}. "
            f"Fatura tutarı: {order_total:.2f} TRY."
        ),
        event_type="DISPATCH_SHIPPED",
        reference_module="DISPATCH_ORDER",
        reference_id=dispatch_order.id,
        is_read=False
    )
    db.add(dealer_notif)

    return dealer_notif
