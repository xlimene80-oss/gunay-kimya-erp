import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.inventory import ItemCategory, DispatchStatus, BarcodeType, BarcodeStatus

# ---------------------------------------------------------
# Item Schemas
# ---------------------------------------------------------
class ItemBase(BaseModel):
    sku: str = Field(..., max_length=50, description="Unique SKU code")
    name: str = Field(..., max_length=200, description="Item or chemical name")
    unit: str = Field(default="kg", max_length=20, description="Unit of measurement: kg, liter, pcs, adet")
    category: ItemCategory = Field(..., description="Classification: Raw Material, Intermediate, Finished Good, Packaging")
    cas_number: Optional[str] = Field(default=None, max_length=50, description="Chemical Abstracts Service registry number")
    density: Optional[Decimal] = Field(default=None, ge=Decimal("0.0001"), description="Density in g/cm³")
    min_stock: Decimal = Field(default=Decimal("0.000"), ge=Decimal("0.000"), description="Minimum critical stock threshold")
    shelf_life_days: Optional[int] = Field(default=365, ge=0, description="Shelf life in days")
    hazard_class: Optional[str] = Field(default=None, max_length=50, description="Hazard / ADR class (optional)")
    is_active: bool = Field(default=True, description="Active status")
    qc_incoming_required: bool = Field(default=False, description="Giriş kontrolü gerekli")
    qc_outgoing_required: bool = Field(default=False, description="Çıkış kontrolü gerekli")
    
    # Hazmat & Depolama Bilgileri
    un_number: Optional[str] = Field(default=None, max_length=20, description="UN Numarası (örn. UN 1824)")
    signal_word: Optional[str] = Field(default="Yok", max_length=30, description="Sinyal Kelimesi: Tehlike, Dikkat, Yok")
    ghs_pictograms: Optional[str] = Field(default="[]", description="JSON list of GHS pictogram codes")
    storage_class: str = Field(default="Genel", max_length=50, description="Depolama Sınıfı")
    temp_min: Optional[Decimal] = Field(default=None, description="Minimum depolama sıcaklığı (°C)")
    temp_max: Optional[Decimal] = Field(default=None, description="Maksimum depolama sıcaklığı (°C)")
    sds_file_url: Optional[str] = Field(default=None, max_length=255, description="GBF dosya indirme bağlantısı")
    sds_file_name: Optional[str] = Field(default=None, max_length=255, description="GBF dosya adı")
    sds_revision_date: Optional[datetime.date] = Field(default=None, description="GBF revizyon tarihi")
    hazard_notes: Optional[str] = Field(default=None, description="Tehlike ve güvenlik notları")

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    sku: Optional[str] = Field(default=None, max_length=50)
    name: Optional[str] = Field(default=None, max_length=200)
    unit: Optional[str] = Field(default=None, max_length=20)
    category: Optional[ItemCategory] = None
    cas_number: Optional[str] = Field(default=None, max_length=50)
    density: Optional[Decimal] = Field(default=None, ge=Decimal("0.0001"))
    min_stock: Optional[Decimal] = Field(default=None, ge=Decimal("0.000"))
    shelf_life_days: Optional[int] = Field(default=None, ge=0)
    hazard_class: Optional[str] = Field(default=None, max_length=50)
    is_active: Optional[bool] = None
    qc_incoming_required: Optional[bool] = None
    qc_outgoing_required: Optional[bool] = None
    un_number: Optional[str] = Field(default=None, max_length=20)
    signal_word: Optional[str] = Field(default=None, max_length=30)
    ghs_pictograms: Optional[str] = None
    storage_class: Optional[str] = Field(default=None, max_length=50)
    temp_min: Optional[Decimal] = None
    temp_max: Optional[Decimal] = None
    sds_file_url: Optional[str] = Field(default=None, max_length=255)
    sds_file_name: Optional[str] = Field(default=None, max_length=255)
    sds_revision_date: Optional[datetime.date] = None
    hazard_notes: Optional[str] = None

class ItemResponse(ItemBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# BatchLot Schemas
# ---------------------------------------------------------
class BatchLotBase(BaseModel):
    batch_number: str = Field(..., max_length=80, description="Lot/Batch tracking number")
    item_id: int = Field(..., description="Foreign key to item")
    warehouse: str = Field(default="Hammadde Deposu", max_length=100, description="Warehouse name/location")
    quantity: Decimal = Field(..., ge=Decimal("0.000"), description="Quantity in stock for this batch")
    expiration_date: Optional[datetime.date] = Field(default=None, description="Chemical shelf-life expiration date")
    status: str = Field(default="Serbest", description="Lot Durumu: Karantina, Serbest, Bloke, Reddedildi")
    qc_notes: Optional[str] = Field(default=None, description="Kalite notları")
    bin_id: Optional[int] = Field(default=None, description="Depo Raf / Göz ID")
    bin_code: Optional[str] = Field(default=None, description="Depo Raf Kodu (örn. A-01, B-01)")

class BatchLotCreate(BatchLotBase):
    received_at: Optional[datetime.datetime] = Field(default=None, description="Inbound receipt timestamp")

class BatchLotUpdate(BaseModel):
    quantity: Optional[Decimal] = Field(default=None, ge=Decimal("0.000"))
    warehouse: Optional[str] = Field(default=None, max_length=100)
    expiration_date: Optional[datetime.date] = None
    status: Optional[str] = None
    qc_notes: Optional[str] = None
    bin_id: Optional[int] = None
    bin_code: Optional[str] = None

class BatchLotResponse(BatchLotBase):
    id: int
    received_at: datetime.datetime
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class ItemWithBatchesResponse(ItemResponse):
    batches: List[BatchLotResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# 1. Mal Kabul / Goods Receipt Schemas
# ---------------------------------------------------------
class GoodsReceiptItemCreate(BaseModel):
    item_id: int = Field(..., description="Foreign key to raw chemical item")
    batch_number: Optional[str] = Field(default=None, max_length=80, description="Supplier or auto-generated batch number")
    quantity: Decimal = Field(..., gt=Decimal("0.000"), description="Quantity received")
    expiration_date: Optional[datetime.date] = Field(default=None, description="Expiration date on certificate of analysis")
    unit_price: Optional[Decimal] = Field(default=Decimal("0.0000"), ge=Decimal("0.0000"), description="Unit cost")

class GoodsReceiptItemResponse(GoodsReceiptItemCreate):
    id: int
    goods_receipt_id: int
    batch_number: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    item: Optional[ItemResponse] = None

    model_config = ConfigDict(from_attributes=True)

class GoodsReceiptCreate(BaseModel):
    receipt_number: str = Field(..., max_length=60, description="Goods receipt document code e.g. GR-2026-0001")
    supplier_id: Optional[int] = Field(default=None, description="Foreign key to CariAccount (supplier)")
    supplier_name: str = Field(..., max_length=200, description="Supplier company name")
    invoice_number: Optional[str] = Field(default=None, max_length=60, description="Supplier invoice number (Fatura No)")
    dispatch_note_number: Optional[str] = Field(default=None, max_length=60, description="Supplier dispatch note number (İrsaliye No)")
    purchase_order_number: Optional[str] = Field(default=None, max_length=60)
    target_warehouse: str = Field(default="Hammadde Deposu", max_length=100)
    notes: Optional[str] = None
    items: List[GoodsReceiptItemCreate] = Field(..., min_length=1, description="List of incoming chemicals")

class GoodsReceiptResponse(BaseModel):
    id: int
    receipt_number: str
    supplier_id: Optional[int]
    supplier_name: str
    invoice_number: Optional[str] = None
    dispatch_note_number: Optional[str] = None
    purchase_order_number: Optional[str]
    target_warehouse: str
    receipt_date: datetime.datetime
    notes: Optional[str]
    items: List[GoodsReceiptItemResponse] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# UBL-TR e-İrsaliye / DespatchAdvice Schemas
# ---------------------------------------------------------
class XmlParseRequest(BaseModel):
    xml_content: str = Field(..., description="UBL-TR DespatchAdvice XML string")

class DespatchLinePreview(BaseModel):
    line_number: str
    item_name: str
    seller_item_code: Optional[str] = None
    delivered_quantity: Decimal
    unit_code: str
    lot_number: Optional[str] = None
    expiry_date: Optional[str] = None
    matched_item_id: Optional[int] = None
    matched_item_sku: Optional[str] = None
    matched_item_name: Optional[str] = None
    matched_item_unit: Optional[str] = None
    suggested_lot_number: str
    suggested_expiry_date: Optional[str] = None

class DespatchAdvicePreviewResponse(BaseModel):
    dispatch_number: str
    issue_date: str
    supplier_vkn: Optional[str] = None
    supplier_name: str
    matched_supplier_id: Optional[int] = None
    matched_supplier_title: Optional[str] = None
    is_supplier_matched: bool = False
    is_duplicate: bool = False
    duplicate_message: Optional[str] = None
    lines: List[DespatchLinePreview] = []

class ConfirmReceiptLine(BaseModel):
    item_id: int
    batch_number: str
    quantity: Decimal
    expiration_date: Optional[datetime.date] = None
    unit_price: Optional[Decimal] = Decimal("0.0000")
    bin_id: Optional[int] = None
    bin_code: Optional[str] = None
    override_reason: Optional[str] = None

class ConfirmReceiptRequest(BaseModel):
    dispatch_number: str
    issue_date: Optional[datetime.date] = None
    supplier_id: Optional[int] = None
    supplier_name: str
    target_warehouse: str = "Hammadde Deposu"
    notes: Optional[str] = None
    lines: List[ConfirmReceiptLine]

class GoodsReceiptHistorySummary(BaseModel):
    id: int
    receipt_number: str
    dispatch_note_number: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: str
    target_warehouse: str
    receipt_date: datetime.datetime
    item_count: int
    total_quantity: Decimal
    status: str = "Depoya Kabul Edildi"
    created_at: datetime.datetime

class StockSummaryItem(BaseModel):
    id: int
    sku: string if False else str
    name: str
    unit: str
    category: str
    cas_number: Optional[str] = None
    density: Optional[Decimal] = None
    min_safety_stock: Decimal
    warehouse: str
    current_quantity: Decimal
    daily_consumption: Decimal
    fefo_lot: Optional[str] = None
    fefo_lot_id: Optional[int] = None
    fefo_lot_status: Optional[str] = None
    fefo_expiry: Optional[str] = None
    bin_id: Optional[int] = None
    bin_code: Optional[str] = None
    zone_name: Optional[str] = None
    storage_class: Optional[str] = None
    hazard_class: Optional[str] = None
    signal_word: Optional[str] = None
    ghs_pictograms: Optional[str] = None
    sds_file_url: Optional[str] = None
    sds_revision_date: Optional[str] = None
    batches: List[BatchLotResponse] = []


# ---------------------------------------------------------
# 2. Depolar Arası Transfer Schemas
# ---------------------------------------------------------
class StockTransferItemCreate(BaseModel):
    item_id: int = Field(..., description="Foreign key to chemical item")
    batch_lot_id: int = Field(..., description="Specific BatchLot source to transfer")
    quantity: Decimal = Field(..., gt=Decimal("0.000"), description="Quantity to move")

class StockTransferItemResponse(StockTransferItemCreate):
    id: int
    transfer_id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    item: Optional[ItemResponse] = None
    batch_lot: Optional[BatchLotResponse] = None

    model_config = ConfigDict(from_attributes=True)

class StockTransferCreate(BaseModel):
    transfer_number: str = Field(..., max_length=60, description="Transfer document number e.g. TRF-2026-001")
    source_warehouse: str = Field(..., max_length=100, description="Source warehouse e.g. Hammadde Deposu")
    target_warehouse: str = Field(..., max_length=100, description="Target warehouse e.g. Üretim Sahası Deposu")
    notes: Optional[str] = None
    items: List[StockTransferItemCreate] = Field(..., min_length=1, description="List of batches to move")

class StockTransferResponse(BaseModel):
    id: int
    transfer_number: str
    source_warehouse: str
    target_warehouse: str
    transfer_date: datetime.datetime
    status: str
    notes: Optional[str]
    items: List[StockTransferItemResponse] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# 3. Sevk Emri & Sevkiyat Schemas
# ---------------------------------------------------------
class DispatchItemCreate(BaseModel):
    item_id: int = Field(..., description="Finished good SKU ID")
    batch_lot_id: Optional[int] = Field(default=None, description="Specific batch lot to dispatch (optional, auto-allocated if null)")
    quantity: Decimal = Field(..., gt=Decimal("0.000"), description="Quantity to dispatch")
    unit_price: Optional[Decimal] = Field(default=Decimal("0.0000"), ge=Decimal("0.0000"))

class DispatchItemResponse(DispatchItemCreate):
    id: int
    dispatch_order_id: int
    scanned_quantity: Decimal = Decimal("0.000")
    created_at: datetime.datetime
    updated_at: datetime.datetime
    item: Optional[ItemResponse] = None
    batch_lot: Optional[BatchLotResponse] = None

    model_config = ConfigDict(from_attributes=True)

class DispatchOrderCreate(BaseModel):
    dispatch_number: str = Field(..., max_length=60, description="Dispatch order code e.g. DSP-2026-0001")
    cari_id: int = Field(..., description="Foreign key to CariAccount (client/dealer)")
    warehouse: str = Field(default="Mamul Ürün Deposu", max_length=100)
    delivery_address: Optional[str] = None
    carrier_tracking_code: Optional[str] = None
    carrier_company: Optional[str] = "Günay Kimya Özel Lojistik Filosu"
    vehicle_plate: Optional[str] = "34 GNY 1984"
    driver_name: Optional[str] = "Kemal Yılmaz"
    driver_tckn: Optional[str] = "29810482910"
    notes: Optional[str] = None
    items: List[DispatchItemCreate] = Field(..., min_length=1, description="Finished goods to ship")

class DispatchOrderResponse(BaseModel):
    id: int
    dispatch_number: str
    cari_id: int
    cari_name: Optional[str] = None
    status: DispatchStatus
    warehouse: str
    dispatch_date: Optional[datetime.datetime]
    delivery_address: Optional[str]
    carrier_tracking_code: Optional[str]
    carrier_company: Optional[str] = None
    vehicle_plate: Optional[str] = None
    driver_name: Optional[str] = None
    driver_tckn: Optional[str] = None
    notes: Optional[str]
    items: List[DispatchItemResponse] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class CarrierUpdateRequest(BaseModel):
    carrier_company: Optional[str] = None
    vehicle_plate: Optional[str] = None
    driver_name: Optional[str] = None
    driver_tckn: Optional[str] = None
    carrier_tracking_code: Optional[str] = None
    delivery_address: Optional[str] = None
    notes: Optional[str] = None

class WaybillItemSchema(BaseModel):
    line_no: int
    item_id: int
    sku: str
    name: str
    unit: str
    quantity: Decimal
    batch_number: Optional[str] = None
    barcode_list: List[str] = []
    adr_class: str = "ADR Kapsamı Dışı (Tehlikesiz Kimyasal Mamul)"
    package_type: str = "Paletli Koli"
    net_weight_kg: float = 0.0
    gross_weight_kg: float = 0.0

class WaybillResponseSchema(BaseModel):
    dispatch_id: int
    waybill_number: str
    ettn_uuid: str
    document_type: str = "SEVK İRSALİYESİ (e-İRSALİYE)"
    issue_date: str
    shipment_date: str
    
    # Shipper (Gönderici)
    shipper_title: str = "GÜNAY KİMYA SANAYİ VE TİCARET A.Ş."
    shipper_tax_office: str = "Tuzla Vergi Dairesi"
    shipper_tax_id: str = "3820491823"
    shipper_mersis: str = "0382049182300014"
    shipper_trade_reg_no: str = "849201"
    shipper_address: str = "Kimyacılar Organize Sanayi Bölgesi 3. Cadde No:14 Tuzla / İstanbul"
    shipper_phone: str = "+90 (216) 593 19 84"
    shipper_email: str = "sevkiyat@gunaykimya.net"
    shipper_web: str = "www.gunaykimya.net"
    
    # Receiver (Alıcı / Cari)
    receiver_title: str
    receiver_tax_office: Optional[str] = "Gebze Vergi Dairesi"
    receiver_tax_id: Optional[str] = "3250819402"
    receiver_address: str
    
    # Logistics
    carrier_company: str
    vehicle_plate: str
    driver_name: str
    driver_tckn: str
    carrier_tracking_code: Optional[str] = None
    warehouse: str
    status: str
    
    # Items & Totals
    items: List[WaybillItemSchema] = []
    total_line_count: int
    total_quantity: Decimal
    total_pallets_count: int
    total_boxes_count: int
    total_estimated_weight_kg: float
    
    # Legal & Safety
    legal_notice: str = "İşbu sevk irsaliyesi 213 sayılı V.U.K. genel tebliğlerine uygun olarak elektronik ortamda tanzim edilmiştir. Sevk esnasında araçta bulundurulması zorunludur."
    adr_safety_notice: str = "Taşınan kimyasal maddelerin Güvenlik Bilgi Formları (GBF / SDS) araç kiti içerisinde mevcuttur. Dökülme anında Acil Müdahale Hattı: 0850 333 46 92."

class DispatchShipResponse(BaseModel):
    dispatch_order: DispatchOrderResponse
    webhook_notified: bool
    b2b_notification_payload: dict


# ---------------------------------------------------------
# 4. Çok Kademeli Barkod & El Terminali Doğrulama Schemas
# ---------------------------------------------------------
class BarcodeUnitResponse(BaseModel):
    id: int
    barcode_string: str
    type: BarcodeType
    parent_pallet_id: Optional[int] = None
    production_order_id: Optional[int] = None
    item_id: int
    quantity: Decimal
    status: BarcodeStatus
    target_cari_id: Optional[int] = None
    dispatch_order_id: Optional[int] = None
    item: Optional[ItemResponse] = None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class VerifyScanRequest(BaseModel):
    dispatch_order_id: int = Field(..., description="ID of the DispatchOrder being verified")
    scanned_barcode_string: str = Field(..., min_length=1, description="Scanned Box or Pallet barcode string")

class VerifyScanResponse(BaseModel):
    verified: bool
    scanned_barcode: str
    barcode_type: BarcodeType
    item_id: int
    item_name: str
    item_sku: str
    scanned_unit_quantity: Decimal
    total_scanned_for_item: Decimal
    required_item_quantity: Decimal
    progress_percentage: float
    is_order_complete: bool
    message: str

class FinalizeDispatchResponse(BaseModel):
    success: bool
    dispatch_order_id: int
    dispatch_number: str
    status: DispatchStatus
    scanned_barcodes_count: int
    message: str

