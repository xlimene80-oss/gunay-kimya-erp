import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import JsBarcode from 'jsbarcode';
import {
  PackageCheck,
  Boxes,
  Printer,
  History,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Tag,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { printLabels, renderBarcodeSvgString, PrintLabelData } from '../services/printService';

interface PackagingOrder {
  id: number;
  order_id?: number;
  order_number: string;
  product_name: string;
  product_sku: string;
  product_unit: string;
  customer_id?: number;
  customer_name: string;
  lot_number: string;
  target_quantity: number;
  phase: string;
  status: string;
  is_printed: boolean;
  printed_at?: string;
  printed_by?: string;
  pallet_count: number;
  box_count: number;
  created_at: string;
}

interface BoxItem {
  id?: number;
  barcode_string: string;
  type: string;
  box_index: number;
  quantity: number;
  status?: string;
  is_partial: boolean;
}

interface PalletItem {
  id?: number;
  barcode_string: string;
  type: string;
  pallet_index: number;
  quantity: number;
  box_count: number;
  status?: string;
  is_partial: boolean;
  boxes: BoxItem[];
}

interface PrintLog {
  id: number;
  label_type: string;
  label_count: number;
  barcode_string?: string;
  printed_by: string;
  printed_at: string;
  is_reprint: boolean;
}

// Inline component to render live SVG barcode using JsBarcode
const BarcodeRenderer: React.FC<{ value: string; height?: number; width?: number; className?: string }> = ({
  value,
  height = 42,
  width = 1.6,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width,
          height,
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: '#0F172A'
        });
      } catch (err) {
        console.error('JsBarcode rendering error:', err);
      }
    }
  }, [value, height, width]);

  return <svg ref={svgRef} className={className} />;
};

export const PackagingStation: React.FC = () => {
  const { user } = useAuth();

  // Role Gate: Üretim and Admin roles only
  const userRoles = (user?.roles || []).map((r) => r.toLowerCase());
  const canAccess =
    userRoles.some((r) => r.includes('admin') || r.includes('yönetici') || r.includes('yonetici')) ||
    userRoles.some((r) => r.includes('uretim') || r.includes('üretim') || r.includes('fabrika'));

  const [orders, setOrders] = useState<PackagingOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [loadingBarcodes, setLoadingBarcodes] = useState<boolean>(false);

  // Packaging Configuration Inputs
  const [unitsPerBox, setUnitsPerBox] = useState<number>(4);
  const [boxesPerPallet, setBoxesPerPallet] = useState<number>(20);

  // Loaded Pallets & Barcodes for the selected order
  const [pallets, setPallets] = useState<PalletItem[]>([]);
  const [expandedPallets, setExpandedPallets] = useState<Record<number, boolean>>({});

  // Audit Logs
  const [printLogs, setPrintLogs] = useState<PrintLog[]>([]);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Status message notification
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedOrder = orders.find((o) => (o.id || o.order_id) === selectedOrderId) || null;

  // Fetch eligible packaging orders
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await axios.get('/api/v1/manufacturing/packaging/orders');
      setOrders(res.data || []);
      if (res.data && res.data.length > 0 && !selectedOrderId) {
        setSelectedOrderId(res.data[0].id || res.data[0].order_id);
      }
    } catch (err) {
      console.error('Error fetching packaging orders:', err);
      setFeedback({ type: 'error', message: 'Üretim emirleri yüklenemedi.' });
    } finally {
      setLoadingOrders(false);
    }
  };

  // Fetch barcodes for selected order
  const fetchOrderBarcodes = async (orderId: number) => {
    setLoadingBarcodes(true);
    try {
      const res = await axios.get(`/api/v1/manufacturing/packaging/orders/${orderId}/barcodes`);
      setPallets(res.data.pallets || []);
      // Auto-expand first pallet
      if (res.data.pallets && res.data.pallets.length > 0) {
        setExpandedPallets({ 0: true });
      }
    } catch (err) {
      console.error('Error fetching barcodes:', err);
      setPallets([]);
    } finally {
      setLoadingBarcodes(false);
    }
  };

  // Fetch print audit logs
  const fetchPrintLogs = async (orderId: number) => {
    setLoadingLogs(true);
    try {
      const res = await axios.get(`/api/v1/manufacturing/packaging/orders/${orderId}/print-logs`);
      setPrintLogs(res.data || []);
    } catch (err) {
      console.error('Error fetching print logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (canAccess) {
      fetchOrders();
    }
  }, [canAccess]);

  useEffect(() => {
    if (selectedOrderId) {
      fetchOrderBarcodes(selectedOrderId);
      fetchPrintLogs(selectedOrderId);
    }
  }, [selectedOrderId]);

  // Calculations for dynamic preview
  const totalUnits = selectedOrder ? Number(selectedOrder.target_quantity) : 0;
  const calculatedBoxes = Math.ceil(totalUnits / Math.max(1, unitsPerBox));
  const calculatedPallets = Math.ceil(calculatedBoxes / Math.max(1, boxesPerPallet));
  const lastBoxUnits = totalUnits % unitsPerBox === 0 ? unitsPerBox : totalUnits % unitsPerBox;
  const hasPartialBox = totalUnits > 0 && totalUnits % unitsPerBox !== 0;
  const lastPalletBoxes = calculatedBoxes % boxesPerPallet === 0 ? boxesPerPallet : calculatedBoxes % boxesPerPallet;
  const hasPartialPallet = calculatedBoxes > 0 && calculatedBoxes % boxesPerPallet !== 0;

  // Toggle pallet accordion
  const togglePallet = (idx: number) => {
    setExpandedPallets((prev) => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Generate Barcodes
  const handleGenerateBarcodes = async () => {
    if (!selectedOrder) return;
    const currentOrderId = selectedOrder.id || selectedOrder.order_id;
    if (!currentOrderId) return;
    setGenerating(true);
    setFeedback(null);
    try {
      const res = await axios.post('/api/v1/manufacturing/packaging/generate-barcodes', {
        order_id: currentOrderId,
        units_per_box: unitsPerBox,
        boxes_per_pallet: boxesPerPallet
      });

      setFeedback({
        type: 'success',
        message: res.data.message || 'Barkodlar başarıyla üretildi.'
      });
      await fetchOrders();
      await fetchOrderBarcodes(currentOrderId);
    } catch (err: any) {
      console.error('Barcode generation error:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Barkod üretimi sırasında bir hata oluştu.'
      });
    } finally {
      setGenerating(false);
    }
  };

  // Print helper and logger
  const executePrint = async (
    labelList: PrintLabelData[],
    labelType: 'PALLET' | 'BOX' | 'ALL',
    specificBarcode?: string
  ) => {
    if (!selectedOrder) return;
    const currentOrderId = selectedOrder.id || selectedOrder.order_id;
    if (!currentOrderId) return;

    const isReprint = selectedOrder.is_printed;
    // Mark as reprint if this order already has prints recorded
    const formattedLabels: PrintLabelData[] = labelList.map((lbl) => ({
      ...lbl,
      isReprint: isReprint || lbl.isReprint
    }));

    const printSuccess = await printLabels(formattedLabels);
    if (printSuccess) {
      try {
        await axios.post('/api/v1/manufacturing/packaging/log-print', {
          order_id: currentOrderId,
          barcode_string: specificBarcode || `${labelType}_BATCH_${formattedLabels.length}`,
          label_type: labelType,
          label_count: formattedLabels.length,
          printed_by: user?.full_name || 'Operatör',
          is_reprint: isReprint
        });

        setFeedback({
          type: 'success',
          message: `${formattedLabels.length} adet ${isReprint ? '(Yeniden Basım) ' : ''}etiket yazdırma penceresine gönderildi.`
        });
        await fetchOrders();
        await fetchPrintLogs(currentOrderId);
      } catch (logErr) {
        console.error('Failed to log print operation:', logErr);
      }
    }
  };

  // Format single pallet label
  const createPalletLabelData = (p: PalletItem): PrintLabelData => {
    const today = new Date().toLocaleDateString('tr-TR');
    const expiry = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR');
    return {
      labelType: 'PALLET',
      barcodeString: p.barcode_string,
      barcodeSvgHtml: renderBarcodeSvgString(p.barcode_string, 62),
      productName: selectedOrder?.product_name || 'Kimyasal Ürün',
      productSku: selectedOrder?.product_sku || 'SKU-GEN',
      lotNumber: selectedOrder?.lot_number || `LOT-${selectedOrder?.order_number}`,
      quantityText: `${p.quantity} Adet (${p.box_count} Koli)`,
      productionDate: today,
      expiryDate: expiry,
      customerName: selectedOrder?.customer_name || 'Genel Dağıtım',
      orderNumber: selectedOrder?.order_number || '',
      isPartial: p.is_partial,
      isReprint: selectedOrder?.is_printed
    };
  };

  // Format single box label
  const createBoxLabelData = (b: BoxItem): PrintLabelData => {
    const today = new Date().toLocaleDateString('tr-TR');
    const expiry = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR');
    return {
      labelType: 'BOX',
      barcodeString: b.barcode_string,
      barcodeSvgHtml: renderBarcodeSvgString(b.barcode_string, 52),
      productName: selectedOrder?.product_name || 'Kimyasal Ürün',
      productSku: selectedOrder?.product_sku || 'SKU-GEN',
      lotNumber: selectedOrder?.lot_number || `LOT-${selectedOrder?.order_number}`,
      quantityText: `${b.quantity} Adet`,
      productionDate: today,
      expiryDate: expiry,
      customerName: selectedOrder?.customer_name || 'Genel Dağıtım',
      orderNumber: selectedOrder?.order_number || '',
      isPartial: b.is_partial,
      isReprint: selectedOrder?.is_printed
    };
  };

  // Print single pallet
  const handlePrintSinglePallet = (p: PalletItem) => {
    const label = createPalletLabelData(p);
    executePrint([label], 'PALLET', p.barcode_string);
  };

  // Print single box
  const handlePrintSingleBox = (b: BoxItem) => {
    const label = createBoxLabelData(b);
    executePrint([label], 'BOX', b.barcode_string);
  };

  // Print all boxes of a pallet
  const handlePrintPalletBoxes = (p: PalletItem) => {
    const labels = p.boxes.map((b) => createBoxLabelData(b));
    executePrint(labels, 'BOX', p.barcode_string);
  };

  // Print all labels (All Pallets + All Boxes)
  const handlePrintAll = () => {
    if (!selectedOrder || pallets.length === 0) return;
    const allLabels: PrintLabelData[] = [];

    // First add all pallets
    pallets.forEach((p) => {
      allLabels.push(createPalletLabelData(p));
      // Then add all its boxes
      p.boxes.forEach((b) => {
        allLabels.push(createBoxLabelData(b));
      });
    });

    executePrint(allLabels, 'ALL');
  };

  if (!canAccess) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-xl max-w-2xl mx-auto mt-12 shadow-sm">
        <div className="w-16 h-16 bg-danger-soft text-danger rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-text mb-2">Yetkisiz Erişim</h2>
        <p className="text-text-muted text-sm mb-4">
          Paketleme İstasyonu ekranı yalnızca <strong>Üretim</strong> ve <strong>Admin</strong> yetkisine sahip personeller tarafından görüntülenebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Station Header */}
      <div className="bg-surface border border-border rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-mod-uretim-soft text-mod-uretim flex items-center justify-center shadow-inner">
            <PackageCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-text">Paketleme İstasyonu</h1>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-mod-uretim-soft text-mod-uretim border border-primary-border">
                Hat Sonu & SSCC-18
              </span>
            </div>
            <p className="text-text-muted text-sm mt-0.5">
              Dolum sonrası koli ve palet standardı (GS1-128 / SSCC-18) oluşturma ve 100x150 mm termal etiketleme ekranı.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedOrderId) fetchPrintLogs(selectedOrderId);
              setShowLogsModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-bg text-text text-sm font-semibold transition"
          >
            <History className="w-4 h-4 text-text-muted" />
            <span>Yazdırma Geçmişi</span>
            {printLogs.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-mod-uretim-soft text-mod-uretim">
                {printLogs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              fetchOrders();
              if (selectedOrderId) fetchOrderBarcodes(selectedOrderId);
            }}
            className="p-2.5 rounded-xl border border-border bg-surface hover:bg-bg text-text-muted hover:text-text transition"
            title="Listeyi Yenile"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-success-soft border-success-border text-success'
              : 'bg-danger-soft border-danger-border text-danger'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs uppercase font-bold opacity-75 hover:opacity-100"
          >
            Kapat
          </button>
        </div>
      )}

      {/* 1. SECTION: Active Production Orders for Packaging */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Boxes className="w-4 h-4 text-mod-uretim" />
            Paketlemeye Hazır / Aktif Üretim Emirleri
          </h2>
          <span className="text-xs text-text-muted">Toplam {orders.length} Emir Listeleniyor</span>
        </div>

        {loadingOrders ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-surface animate-pulse rounded-2xl border border-border" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center bg-surface border border-border rounded-2xl">
            <p className="text-text-muted text-sm">Paketleme aşamasında bekleyen aktif üretim emri bulunamadı.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((o) => {
              const orderId = o.id || o.order_id || 0;
              const isSelected = orderId === selectedOrderId;
              return (
                <div
                  key={orderId}
                  onClick={() => setSelectedOrderId(orderId)}
                  className={`p-4 rounded-2xl border cursor-pointer transition relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary bg-primary-soft/30 shadow-md ring-2 ring-primary/20'
                      : 'border-border bg-surface hover:border-text-muted/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-xs font-mono font-bold text-mod-uretim">{o.order_number}</div>
                      <div className="text-base font-extrabold text-text line-clamp-1 mt-0.5">{o.product_name}</div>
                    </div>
                    {o.is_printed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-success-soft text-success border border-success-border shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Basıldı
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-warning-soft text-warning border border-warning-border shrink-0">
                        Bekliyor
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60">
                    <div>
                      <span className="text-text-muted block">Müşteri / Cari:</span>
                      <span className="font-semibold text-text truncate block">{o.customer_name}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block">Lot Numarası:</span>
                      <span className="font-mono font-semibold text-text truncate block">{o.lot_number}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-1">
                    <span className="text-sm font-extrabold text-text">
                      {Number(o.target_quantity).toLocaleString('tr-TR')} {o.product_unit || 'Adet'}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-surface border border-border text-text-muted">
                      {o.pallet_count > 0 ? `${o.pallet_count} Palet / ${o.box_count} Koli` : 'Barkod Üretilmedi'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. SECTION: Selected Order Detail & Packaging Parameters */}
      {selectedOrder && (
        <div className="bg-surface border border-border rounded-2xl p-5 md:p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-border gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-mod-uretim">{selectedOrder.order_number}</span>
                <span className="text-text-muted">•</span>
                <span className="text-xs font-mono bg-bg px-2 py-0.5 rounded border border-border text-text-muted">
                  Lot: {selectedOrder.lot_number}
                </span>
                {selectedOrder.is_printed && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-success-soft text-success border border-success-border">
                    ✓ Etiketler Basıldı
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black text-text mt-1">{selectedOrder.product_name}</h3>
              <p className="text-sm text-text-muted mt-0.5">
                Alıcı: <strong>{selectedOrder.customer_name}</strong> • Hedef Üretim:{' '}
                <strong>
                  {Number(selectedOrder.target_quantity).toLocaleString('tr-TR')} {selectedOrder.product_unit || 'Adet'}
                </strong>
              </p>
            </div>

            {/* Print All Button */}
            {pallets.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrintAll}
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-base shadow-lg shadow-primary/20 transition active:scale-[0.98]"
                >
                  <Printer className="w-5 h-5" />
                  <span>
                    {selectedOrder.is_printed ? 'Tümünü Yeniden Yazdır' : 'Tümünü Yazdır (Palet & Koli)'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Operator Parameters Controls (Touch/Tablet Friendly Large Inputs) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wide text-text-muted mb-2">
                Koli Başına Adet (Ürün/Koli)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={unitsPerBox}
                  onChange={(e) => setUnitsPerBox(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-lg font-bold px-4 py-3 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition"
                />
                <span className="absolute right-4 top-3.5 text-xs font-bold text-text-muted">ADET</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wide text-text-muted mb-2">
                Palet Başına Koli Adedi
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={boxesPerPallet}
                  onChange={(e) => setBoxesPerPallet(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-lg font-bold px-4 py-3 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition"
                />
                <span className="absolute right-4 top-3.5 text-xs font-bold text-text-muted">KOLİ</span>
              </div>
            </div>

            <div>
              <button
                onClick={handleGenerateBarcodes}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-extrabold text-base transition border border-border bg-surface hover:bg-bg text-text shadow-sm disabled:opacity-50"
              >
                {generating ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Tag className="w-5 h-5 text-mod-uretim" />
                )}
                <span>
                  {pallets.length > 0 ? 'Barkodları Yeniden Üret' : 'Barkod Üret (SSCC-18 & Koli)'}
                </span>
              </button>
            </div>
          </div>

          {/* Dynamic Calculation Stats Banner */}
          <div className="p-4 rounded-xl bg-bg border border-border grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-xs font-bold text-text-muted block">HESAPLANAN KOLİ</span>
              <div className="text-lg font-black text-text mt-0.5">
                {calculatedBoxes} <span className="text-xs font-semibold text-text-muted">Koli</span>
              </div>
              {hasPartialBox && (
                <span className="inline-block text-[11px] font-bold text-warning mt-0.5">
                  ⚠️ Son Koli: {lastBoxUnits} adet (Kısmi)
                </span>
              )}
            </div>

            <div>
              <span className="text-xs font-bold text-text-muted block">HESAPLANAN PALET</span>
              <div className="text-lg font-black text-text mt-0.5">
                {calculatedPallets} <span className="text-xs font-semibold text-text-muted">Palet (SSCC-18)</span>
              </div>
              {hasPartialPallet && (
                <span className="inline-block text-[11px] font-bold text-warning mt-0.5">
                  ⚠️ Son Palet: {lastPalletBoxes} koli (Kısmi)
                </span>
              )}
            </div>

            <div>
              <span className="text-xs font-bold text-text-muted block">BARKOD STANDARDI</span>
              <div className="text-sm font-extrabold text-text mt-1">GS1 Mod-10 SSCC-18</div>
              <span className="text-[11px] text-text-muted">Firma Kodu: 8690123</span>
            </div>

            <div>
              <span className="text-xs font-bold text-text-muted block">ETİKET BOYUTU</span>
              <div className="text-sm font-extrabold text-text mt-1">100 x 150 mm</div>
              <span className="text-[11px] text-text-muted">Termal Endüstriyel Format</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. SECTION: Generated Pallets and Box Barcodes Accordion / Grid */}
      {selectedOrder && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Tag className="w-4 h-4 text-mod-uretim" />
              Üretilen Palet & Koli Barkodları ({pallets.length} Palet)
            </h2>
            {selectedOrder.is_printed && (
              <span className="text-xs font-medium text-text-muted flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                Yazdırıldı: {selectedOrder.printed_by || 'Operatör'}
              </span>
            )}
          </div>

          {loadingBarcodes ? (
            <div className="p-8 text-center bg-surface border border-border rounded-2xl">
              <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-text-muted">Barkodlar yükleniyor...</p>
            </div>
          ) : pallets.length === 0 ? (
            <div className="p-10 text-center bg-surface border border-dashed border-border rounded-2xl">
              <Tag className="w-10 h-10 text-text-muted/40 mx-auto mb-2" />
              <h3 className="text-base font-bold text-text">Henüz Barkod Üretilmedi</h3>
              <p className="text-text-muted text-sm max-w-md mx-auto mt-1 mb-4">
                Yukarıdaki koli ve palet parametrelerini belirleyip "Barkod Üret" butonuna basarak SSCC-18 palet ve koli kodlarını oluşturunuz.
              </p>
              <button
                onClick={handleGenerateBarcodes}
                disabled={generating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-primary hover:bg-primary-hover text-white transition shadow-sm"
              >
                <Tag className="w-4 h-4" />
                <span>Barkodları Şimdi Oluştur</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {pallets.map((p, idx) => {
                const isExpanded = !!expandedPallets[idx];
                return (
                  <div
                    key={p.id || idx}
                    className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm transition"
                  >
                    {/* Pallet Card Header */}
                    <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 bg-surface">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-mod-stok-soft text-mod-stok font-extrabold flex flex-col items-center justify-center text-xs shrink-0">
                          <span>PALET</span>
                          <span className="text-base leading-none">{p.pallet_index}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                              SSCC-18 Palet Barkodu
                            </span>
                            {p.is_partial && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning border border-warning-border">
                                Kısmi Palet ({p.box_count} Koli)
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-lg font-black text-text tracking-wide mt-0.5">
                            {p.barcode_string}
                          </div>
                        </div>
                      </div>

                      {/* Barcode SVG Visual */}
                      <div className="hidden lg:flex items-center justify-center px-3 py-1 bg-white rounded-lg border border-border max-w-[220px]">
                        <BarcodeRenderer value={p.barcode_string} height={38} width={1.4} />
                      </div>

                      {/* Action Buttons for this Pallet */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handlePrintSinglePallet(p)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-primary hover:bg-primary-hover text-white shadow-sm transition active:scale-95"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Palet Yazdır</span>
                        </button>

                        <button
                          onClick={() => handlePrintPalletBoxes(p)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs border border-border bg-surface hover:bg-bg text-text transition"
                          title="Bu palete ait tüm koli etiketlerini yazdır"
                        >
                          <Boxes className="w-3.5 h-3.5 text-text-muted" />
                          <span>Kolileri Yazdır ({p.box_count})</span>
                        </button>

                        <button
                          onClick={() => togglePallet(idx)}
                          className="p-2.5 rounded-xl border border-border bg-surface hover:bg-bg text-text-muted hover:text-text transition"
                          title={isExpanded ? 'Kolileri Gizle' : 'Kolileri Göster'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Box List for this Pallet */}
                    {isExpanded && (
                      <div className="p-4 md:p-5 bg-bg/50">
                        <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center justify-between">
                          <span>Bu Palette Bulunan Koliler ({p.boxes.length} Adet)</span>
                          <span className="font-mono text-[11px]">Toplam {p.quantity} Adet Ürün</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {p.boxes.map((b) => (
                            <div
                              key={b.barcode_string}
                              className="p-3 bg-surface border border-border rounded-xl flex items-center justify-between gap-2 shadow-sm"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-mod-uretim">Koli #{b.box_index}</span>
                                  {b.is_partial && (
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-warning-soft text-warning border border-warning-border">
                                      Kısmi ({b.quantity} Adet)
                                    </span>
                                  )}
                                  {!b.is_partial && (
                                    <span className="text-[10px] font-semibold text-text-muted">
                                      {b.quantity} Adet
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono text-xs font-bold text-text truncate mt-1">
                                  {b.barcode_string}
                                </div>
                              </div>

                              <button
                                onClick={() => handlePrintSingleBox(b)}
                                className="p-2 rounded-lg border border-border bg-surface hover:bg-bg text-text-muted hover:text-text transition shrink-0"
                                title="Bu Koli Etiketini Yazdır"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. MODAL: Print Audit History */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-mod-uretim" />
                <h3 className="font-bold text-lg text-text">Yazdırma Denetim Günlüğü (Audit Log)</h3>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="text-text-muted hover:text-text font-bold text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {loadingLogs ? (
                <div className="py-8 text-center text-text-muted text-sm">Yükleniyor...</div>
              ) : printLogs.length === 0 ? (
                <div className="py-8 text-center text-text-muted text-sm">
                  Bu üretim emrine ait henüz kaydedilmiş yazdırma geçmişi bulunmuyor.
                </div>
              ) : (
                <div className="space-y-3">
                  {printLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-bg border border-border rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text">{log.printed_by}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-surface border border-border text-text-muted">
                            {log.label_type}
                          </span>
                          {log.is_reprint && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning border border-warning-border">
                              Yeniden Baskı
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-text-muted mt-1 truncate max-w-md">
                          Barkod / Referans: {log.barcode_string || 'Toplu Baskı'}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-text">{log.label_count} Etiket</div>
                        <div className="text-text-muted text-[11px] mt-0.5">
                          {log.printed_at ? new Date(log.printed_at).toLocaleString('tr-TR') : '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-bg/50 flex justify-end">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-2 rounded-xl bg-surface border border-border text-text font-bold text-sm hover:bg-surface/80"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};