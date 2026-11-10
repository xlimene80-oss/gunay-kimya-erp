import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    Integer, String, Text, Boolean, Numeric, ForeignKey, 
    DateTime, Date, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class ProformaQuote(Base, TimestampMixin):
    """
    Corporate Proforma Invoice / Customer Offer model.
    Lifecycle Statuses:
    - Taslak (Draft)
    - Onay Bekliyor (Pending Finance/Manager Approval due to high discount)
    - Gönderildi (Sent to Customer / B2B Dealer)
    - Kabul Edildi (Accepted by Customer)
    - Reddedildi (Rejected by Customer)
    - Siparişe Dönüştü (Converted to Sales Order)
    - Süresi Doldu (Expired)
    """
    __tablename__ = "proforma_quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quote_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False) # e.g. PRF-2026-0001
    cari_id: Mapped[int] = mapped_column(
        ForeignKey("cari_accounts.id", ondelete="RESTRICT"),
        index=True,
        nullable=False
    )
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        index=True,
        nullable=True
    )
    quote_date: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False
    )
    valid_until: Mapped[datetime.date] = mapped_column(Date, nullable=False) # Geçerlilik tarihi
    
    status: Mapped[str] = mapped_column(
        String(50),
        default="Taslak",
        index=True,
        nullable=False
    )
    
    currency: Mapped[str] = mapped_column(String(10), default="TRY", nullable=False) # TRY, USD, EUR, GBP
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("1.0000"), nullable=False)
    
    discount_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"), nullable=False) # Overall %
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("20.00"), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    
    payment_terms: Mapped[str] = mapped_column(String(255), default="30 Gün Vade / Banka Havalesi", nullable=False)
    delivery_terms: Mapped[str] = mapped_column(String(255), default="Fabrika Teslim (EXW) - Kemalpaşa Depo", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approval_status: Mapped[str] = mapped_column(String(50), default="NONE", nullable=False) # NONE, PENDING, APPROVED, REJECTED
    approval_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        nullable=True
    )
    approved_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    converted_order_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    cari: Mapped["CariAccount"] = relationship("CariAccount", lazy="selectin")
    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    approved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by_id], lazy="selectin")
    converted_order: Mapped[Optional["Order"]] = relationship("Order", foreign_keys=[converted_order_id], lazy="selectin")
    items: Mapped[List["ProformaQuoteItem"]] = relationship(
        "ProformaQuoteItem",
        back_populates="quote",
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class ProformaQuoteItem(Base, TimestampMixin):
    """
    Line item inside a ProformaQuote.
    """
    __tablename__ = "proforma_quote_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quote_id: Mapped[int] = mapped_column(
        ForeignKey("proforma_quotes.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="RESTRICT"),
        index=True,
        nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="adet", nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    discount_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("20.00"), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)

    quote: Mapped["ProformaQuote"] = relationship("ProformaQuote", back_populates="items")
    item: Mapped["Item"] = relationship("Item", lazy="selectin")

    @property
    def item_name(self) -> Optional[str]:
        return self.item.name if self.item else None

    @property
    def item_sku(self) -> Optional[str]:
        return self.item.sku if self.item else None


class ProformaSetting(Base, TimestampMixin):
    """
    Global settings for proforma invoicing, discount approval thresholds, and company banking details.
    """
    __tablename__ = "proforma_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    max_discount_without_approval: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("15.00"), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), default="GÜNAY KİMYA SAN. VE TİC. LTD. ŞTİ.", nullable=False)
    company_title: Mapped[str] = mapped_column(String(255), default="Endüstriyel Temizlik ve Kimyasal Üretim Çözümleri", nullable=False)
    company_address: Mapped[str] = mapped_column(String(255), default="Kemalpaşa OSB Mah. İzmir Cad. No: 42 Kemalpaşa / İZMİR", nullable=False)
    company_phone: Mapped[str] = mapped_column(String(50), default="+90 (232) 877 00 00", nullable=False)
    company_email: Mapped[str] = mapped_column(String(100), default="satis@gunaykimya.com", nullable=False)
    company_web: Mapped[str] = mapped_column(String(100), default="www.gunaykimya.com", nullable=False)
    tax_office: Mapped[str] = mapped_column(String(100), default="Kemalpaşa V.D.", nullable=False)
    tax_number: Mapped[str] = mapped_column(String(50), default="4210048123", nullable=False)
    mersis_no: Mapped[str] = mapped_column(String(50), default="0421004812300001", nullable=False)
    
    bank_name: Mapped[str] = mapped_column(String(100), default="Türkiye İş Bankası", nullable=False)
    bank_branch: Mapped[str] = mapped_column(String(100), default="Kemalpaşa Şubesi (Kod: 3412)", nullable=False)
    iban_try: Mapped[str] = mapped_column(String(50), default="TR12 0006 4000 0013 4200 1234 56", nullable=False)
    iban_usd: Mapped[str] = mapped_column(String(50), default="TR34 0006 4000 0013 4200 1234 57", nullable=False)
    iban_eur: Mapped[str] = mapped_column(String(50), default="TR56 0006 4000 0013 4200 1234 58", nullable=False)
    swift_code: Mapped[str] = mapped_column(String(20), default="ISBTRISXXX", nullable=False)

    default_validity_days: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    default_payment_terms: Mapped[str] = mapped_column(String(255), default="30 Gün Vadeli / Banka Havalesi", nullable=False)
    default_delivery_terms: Mapped[str] = mapped_column(String(255), default="Fabrika Teslim (EXW) - Kemalpaşa Depo", nullable=False)
    footer_note: Mapped[str] = mapped_column(Text, default="Teklifimiz belirtilen geçerlilik tarihine kadar geçerlidir. Fiyatlarımıza KDV dahil değildir. Dövizli tekliflerde fatura tarihindeki TCMB Döviz Satış Kuru esas alınır.", nullable=False)
