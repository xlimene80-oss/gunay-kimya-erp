import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  GitFork,
  Search,
  Building2,
  FlaskConical,
  ArrowDown,
  Boxes,
  Loader2,
  Info,
  Camera,
  CameraOff,
  Printer,
  Download,
  AlertTriangle,
  Clock,
  History,
  Lock,
  CheckCircle2,
  Truck,
  MapPin,
  X,
  RefreshCw
} from 'lucide-react';

interface RawMaterialItem {
  item_name: string;
  sku: string;
  quantity_consumed: number;
  unit: string;
  supplier_batch_number: string;
  supplier_name: string;
  invoice_number: string;
  dispatch_note_number: string;
  receipt_date: string;
}

interface ProductionBatchItem {
  order_number: string;
  finished_lot_number: string;
  recipe_name: string;
  finished_good_sku: string;
  finished_good_name: string;
  quantity_produced: number;
  unit: string;
  production_date: string;
  reactor: string;
  status: string;
}

interface AffectedCustomerItem {
  customer_title: string;
  dispatch_number: string;
  dispatch_date: string;
  quantity: number;
  unit: string;
  delivery_address: string;
  carrier?: string;
}

interface InStockPalletItem {
  barcode_string: string;
  type: string;
  quantity: number;
  unit: string;
  warehouse: string;
  bin_code: string;
  zone_name: string;
  status: string;
}

interface TraceabilityData {
  found: boolean;
  query_identifier: string;
  detected_type?: string;
  execution_time_sec?: number;
  summary: {
    total_production_orders: number;
    total_finished_lots: number;
    total_customers: number;
    total_produced_qty: number;
    total_dispatched_qty: number;
    total_in_stock_qty: number;
    unit: string;
  };
  b2b_order?: {
    order_number: string;
    customer_title: string;
    delivery_address: string;
    status: string;
    dispatch_date: string;
    carrier?: string;
  };
  production_batch?: ProductionBatchItem;
  raw_material_footprint: RawMaterialItem[];
  production_batches?: ProductionBatchItem[];
  affected_customers?: AffectedCustomerItem[];
  in_stock_pallets?: InStockPalletItem[];
}

interface SimulationRecord {
  id: number;
  simulation_number: string;
  query_identifier: string;
  reason: string;
  affected_orders_count: number;
  affected_lots_count: number;
  affected_customers_count: number;
  total_produced_qty: number;
  total_dispatched_qty: number;
  total_in_stock_qty: number;
  execution_duration_ms: number;
  performed_by: string;
  is_blocked: boolean;
  created_at: string;
}

export const Traceability: React.FC = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'lineage' | 'simulation' | 'history'>('lineage');
  const [viewMode, setViewMode] = useState<'diagram' | 'table'>('diagram');

  // Search input & state
  const [searchInput, setSearchInput] = useState<string>('LOT-SIP-2026-99214');
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<TraceabilityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Camera scanner state
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Simulation form & results
  const [simulationReason, setSimulationReason] = useState<string>('');
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Block modal state
  const [isBlockModalOpen, setIsBlockModalOpen] = useState<boolean>(false);
  const [blockReason, setBlockReason] = useState<string>('');
  const [blocking, setBlocking] = useState<boolean>(false);
  const [blockSuccessMsg, setBlockSuccessMsg] = useState<string | null>(null);

  // Simulation history state
  const [historyList, setHistoryList] = useState<SimulationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Query traceability lineage
  const fetchTraceability = async (identifier: string) => {
    if (!identifier.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await axios.get(`/api/v1/manufacturing/traceability/${encodeURIComponent(identifier.trim())}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'İzlenebilirlik verisi sorgulanırken sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch past simulations
  const fetchSimulationsHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get('/api/v1/manufacturing/traceability/recall-simulations');
      setHistoryList(res.data || []);
    } catch (err) {
      console.error('Simülasyon geçmişi yüklenemedi:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Auto-load on mount (checks sessionStorage if navigated from terminal)
  useEffect(() => {
    const targetQuery = sessionStorage.getItem('traceability_target_query');
    if (targetQuery) {
      sessionStorage.removeItem('traceability_target_query');
      setSearchInput(targetQuery);
      fetchTraceability(targetQuery);
    } else {
      fetchTraceability('LOT-SIP-2026-99214');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchSimulationsHistory();
    }
  }, [activeTab]);

  // Camera QR/Barcode Scanner
  const startCamera = async () => {
    setIsCameraOpen(true);
    setCameraError(null);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const html5QrCode = new Html5Qrcode('traceability-camera-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false
      });
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 180 } },
        (decodedText) => {
          stopCamera();
          setSearchInput(decodedText);
          fetchTraceability(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      setCameraError('Kamera başlatılamadı. Lütfen kamera erişim izinlerini kontrol edin.');
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Camera stop err:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraOpen(false);
  };

  // Handle manual search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTraceability(searchInput);
  };

  // Handle Recall Simulation
  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulationReason.trim()) {
      setSimulationError('Geri çağırma simülasyonu başlatmak için zorunlu neden alanını doldurunuz.');
      return;
    }

    setSimulating(true);
    setSimulationError(null);
    try {
      const res = await axios.post('/api/v1/manufacturing/traceability/simulate-recall', {
        identifier: searchInput.trim(),
        reason: simulationReason.trim(),
        performed_by: 'Kemal Günay (Kalite Müdürü)'
      });
      setSimulationResult(res.data);
    } catch (err: any) {
      setSimulationError(err?.response?.data?.detail || 'Simülasyon çalıştırılırken sunucu hatası oluştu.');
    } finally {
      setSimulating(false);
    }
  };

  // Handle Block Affected Lots
  const handleBlockLots = async () => {
    if (!blockReason.trim()) {
      alert('Lütfen blokaj için zorunlu onay gerekçesini giriniz.');
      return;
    }

    const lotsToBlock = simulationResult?.affected_lots || [data?.production_batch?.finished_lot_number || searchInput];
    setBlocking(true);

    try {
      const res = await axios.post('/api/v1/manufacturing/traceability/block-affected-lots', {
        lot_numbers: lotsToBlock,
        reason: blockReason.trim(),
        simulation_id: simulationResult?.simulation_id,
        blocked_by: 'Kemal Günay (Kalite Müdürü)'
      });
      setBlockSuccessMsg(res.data?.message || 'Parti lotları başarıyla bloke edildi.');
      setIsBlockModalOpen(false);
      setBlockReason('');
      // Refresh current traceability data to show updated status
      fetchTraceability(searchInput);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Lotlar bloke edilirken hata oluştu.');
    } finally {
      setBlocking(false);
    }
  };

  // CSV Export for Lineage Data
  const exportLineageCSV = () => {
    if (!data) return;

    const rows: string[][] = [
      ['GÜNAY KİMYA - İZLENEBİLİRLİK VE ŞECERE RAPORU'],
      ['Sorgu Parametresi', data.query_identifier],
      ['Tespit Edilen Tip', data.detected_type || 'Parti Lotu'],
      ['Tarih', new Date().toLocaleString('tr-TR')],
      [],
      ['--- ÜRETİM PARTİLERİ VE EMİRLERİ ---'],
      ['Emir No', 'Mamul Lot No', 'Ürün Adı', 'SKU', 'Reçete', 'Miktar', 'Birim', 'Tarih', 'Reaktör', 'Durum']
    ];

    (data.production_batches || [data.production_batch]).forEach((po: any) => {
      if (!po) return;
      rows.push([
        po.order_number,
        po.finished_lot_number,
        po.finished_good_name,
        po.finished_good_sku,
        po.recipe_name,
        String(po.quantity_produced),
        po.unit,
        po.production_date,
        po.reactor,
        po.status
      ]);
    });

    rows.push([]);
    rows.push(['--- KULLANILAN HAMMADDE AYAK İZİ ---']);
    rows.push(['Hammadde Adı', 'SKU', 'Tüketilen Miktar', 'Birim', 'Tedarikçi Lot No', 'Tedarikçi Firma', 'Fatura No', 'İrsaliye No', 'Giriş Tarihi']);

    (data.raw_material_footprint || []).forEach((r) => {
      rows.push([
        r.item_name,
        r.sku,
        String(r.quantity_consumed),
        r.unit,
        r.supplier_batch_number,
        r.supplier_name,
        r.invoice_number,
        r.dispatch_note_number,
        r.receipt_date
      ]);
    });

    rows.push([]);
    rows.push(['--- ETKİLENEN SEVKİYAT VE MÜŞTERİLER ---']);
    rows.push(['Müşteri Ünvanı', 'İrsaliye No', 'Sevk Tarihi', 'Sevk Miktarı', 'Birim', 'Teslimat Adresi', 'Taşıyıcı']);

    (data.affected_customers || [data.b2b_order]).forEach((c: any) => {
      if (!c) return;
      rows.push([
        c.customer_title,
        c.dispatch_number || c.order_number || '',
        c.dispatch_date || '',
        String(c.quantity || ''),
        c.unit || 'KG',
        c.delivery_address || '',
        c.carrier || ''
      ]);
    });

    const csvContent = '\uFEFF' + rows.map((e) => e.map((val) => `"${(val || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `izlenebilirlik_${data.query_identifier}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary-soft text-primary border border-primary-border">
              <GitFork className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-text tracking-tight">
              Çift Yönlü Parti İzlenebilirliği (Soy Ağacı & Geri Çağırma)
            </h1>
          </div>
          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
            Hammadde tedarikçisinden nihai müşteri sevkiyatına kadar çift yönlü tam şecere akışı, depo raf konumları ve yasal geri çağırma simülasyonu.
          </p>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-bg border border-border hover:bg-border/30 text-xs font-bold text-text transition shadow-xs"
          >
            <Printer className="w-4 h-4 text-text-muted" />
            <span>Rapor Yazdır / PDF</span>
          </button>
          <button
            onClick={exportLineageCSV}
            disabled={!data}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-bg border border-border hover:bg-border/30 text-xs font-bold text-text transition shadow-xs disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-text-muted" />
            <span>CSV İndir</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center border-b border-border space-x-1 no-print">
        <button
          onClick={() => setActiveTab('lineage')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-extrabold border-b-2 transition -mb-px ${
            activeTab === 'lineage'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <GitFork className="w-4 h-4" />
          <span>Çift Yönlü İzlenebilirlik</span>
        </button>

        <button
          onClick={() => setActiveTab('simulation')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-extrabold border-b-2 transition -mb-px ${
            activeTab === 'simulation'
              ? 'border-danger text-danger'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Geri Çağırma Simülasyonu</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-extrabold border-b-2 transition -mb-px ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Geçmiş Simülasyonlar & Denetim</span>
        </button>
      </div>

      {/* Main Search & Barcode Bar (Visible across lineage and simulation) */}
      {activeTab !== 'history' && (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-lg space-y-3 no-print">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Parti/Lot No (örn: LOT-SIP-2026-99214), Palet (SSCC-18), Emir No veya İrsaliye No..."
                className="w-full pl-10 pr-4 py-2.5 bg-bg border border-border rounded-xl text-text placeholder-text-muted/60 text-xs font-mono font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="button"
              onClick={isCameraOpen ? stopCamera : startCamera}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bg border border-border hover:bg-border/30 text-text text-xs font-bold transition shrink-0"
            >
              {isCameraOpen ? <CameraOff className="w-4 h-4 text-danger" /> : <Camera className="w-4 h-4 text-primary" />}
              <span>{isCameraOpen ? 'Kamerayı Kapat' : 'Kamera ile Tara'}</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-extrabold transition shadow-xs border border-transparent shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Şecereyi Sorgula</span>
            </button>
          </form>

          {/* Quick Preset Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            <span className="text-text-muted font-bold">Hızlı Sorgu Örnekleri:</span>
            <button
              onClick={() => {
                setSearchInput('LOT-SIP-2026-99214');
                fetchTraceability('LOT-SIP-2026-99214');
              }}
              className="px-2.5 py-1 rounded-lg font-mono bg-bg hover:bg-border/30 text-text border border-border transition"
            >
              LOT-SIP-2026-99214 (Hammadde SLES)
            </button>
            <button
              onClick={() => {
                setSearchInput('SIP-2026-99214');
                fetchTraceability('SIP-2026-99214');
              }}
              className="px-2.5 py-1 rounded-lg font-mono bg-bg hover:bg-border/30 text-text border border-border transition"
            >
              SIP-2026-99214 (Üretim Emri 1)
            </button>
            <button
              onClick={() => {
                setSearchInput('SSCC-TR-2026-000101');
                fetchTraceability('SSCC-TR-2026-000101');
              }}
              className="px-2.5 py-1 rounded-lg font-mono bg-bg hover:bg-border/30 text-text border border-border transition"
            >
              SSCC-TR-2026-000101 (Depodaki Palet)
            </button>
            <button
              onClick={() => {
                setSearchInput('DSP-2026-00412');
                fetchTraceability('DSP-2026-00412');
              }}
              className="px-2.5 py-1 rounded-lg font-mono bg-bg hover:bg-border/30 text-text border border-border transition"
            >
              DSP-2026-00412 (Sevk İrsaliyesi)
            </button>
          </div>

          {/* Camera Scanner Container */}
          {isCameraOpen && (
            <div className="p-4 bg-bg border border-border rounded-xl space-y-2 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary animate-pulse" />
                  Barkodu kameraya gösterin...
                </span>
                <button onClick={stopCamera} className="p-1 rounded-lg hover:bg-border text-text-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div id="traceability-camera-reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-lg border border-border bg-black" />
              {cameraError && <p className="text-xs text-danger font-medium">{cameraError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Block Success Toast */}
      {blockSuccessMsg && (
        <div className="p-4 rounded-xl bg-success-soft border border-success-border text-success flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{blockSuccessMsg}</span>
          </div>
          <button onClick={() => setBlockSuccessMsg(null)} className="underline uppercase text-[10px]">
            Kapat
          </button>
        </div>
      )}

      {/* Loading & Errors */}
      {loading && (
        <div className="min-h-[260px] flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-text-muted font-bold">Çift yönlü ürün şeceresi ve tedarik kökleri taranıyor...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-danger-soft border border-danger-border rounded-xl text-danger-text text-xs font-bold">
          {error}
        </div>
      )}

      {/* =====================================================================
          TAB 1: BIDIRECTIONAL TRACEABILITY (GERİ İZLEME & İLERİ İZLEME)
          ===================================================================== */}
      {activeTab === 'lineage' && data && !loading && (
        <div className="space-y-6">
          {/* Executive Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
              <span className="text-[10px] font-bold text-text-muted uppercase block">Üretim Emirleri</span>
              <span className="text-xl font-black text-text font-mono mt-1 block">
                {data.summary.total_production_orders}
              </span>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
              <span className="text-[10px] font-bold text-text-muted uppercase block">Mamul Lotları</span>
              <span className="text-xl font-black text-primary font-mono mt-1 block">
                {data.summary.total_finished_lots}
              </span>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
              <span className="text-[10px] font-bold text-text-muted uppercase block">Müşteriler</span>
              <span className="text-xl font-black text-text font-mono mt-1 block">
                {data.summary.total_customers}
              </span>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
              <span className="text-[10px] font-bold text-text-muted uppercase block">Üretilen Miktar</span>
              <span className="text-xl font-black text-text font-mono mt-1 block">
                {formatNumber(data.summary.total_produced_qty, 0)} {data.summary.unit}
              </span>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
              <span className="text-[10px] font-bold text-text-muted uppercase block">Sevk Edilen</span>
              <span className="text-xl font-black text-success font-mono mt-1 block">
                {formatNumber(data.summary.total_dispatched_qty, 0)} {data.summary.unit}
              </span>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-border shadow-xs">
              <span className="text-[10px] font-bold text-text-muted uppercase block">Depoda Kalan</span>
              <span className="text-xl font-black text-warning font-mono mt-1 block">
                {formatNumber(data.summary.total_in_stock_qty, 0)} {data.summary.unit}
              </span>
            </div>
          </div>

          {/* Mode Switcher: Flow Diagram vs Data Table */}
          <div className="flex items-center justify-between no-print">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-muted">Görünüm Modu:</span>
              <button
                onClick={() => setViewMode('diagram')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  viewMode === 'diagram' ? 'bg-primary text-white shadow-xs' : 'bg-surface border border-border text-text'
                }`}
              >
                Çift Yönlü Akış Şeması
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  viewMode === 'table' ? 'bg-primary text-white shadow-xs' : 'bg-surface border border-border text-text'
                }`}
              >
                Detaylı Tablo Görünümü
              </button>
            </div>

            {data.execution_time_sec !== undefined && (
              <span className="text-[11px] font-mono text-text-muted flex items-center gap-1 bg-surface px-2.5 py-1 rounded-md border border-border">
                <Clock className="w-3.5 h-3.5" />
                Sorgu Süresi: {data.execution_time_sec}s
              </span>
            )}
          </div>

          {/* -----------------------------------------------------------------
              VIEW 1: BIDIRECTIONAL FLOW DIAGRAM
              Left: Geri İzleme (Tedarikçi -> Mal Kabul -> Hammadde)
              Right: İleri İzleme (Mamul Lot -> Palet/Koli -> Müşteriler)
              ----------------------------------------------------------------- */}
          {viewMode === 'diagram' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT COLUMN: GERİ İZLEME (BACKWARD TRACEABILITY) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-primary-soft text-primary border border-primary-border">
                      GERİ İZLEME (Giriş Kökü)
                    </span>
                    <h3 className="text-sm font-bold text-text">Tedarikçi & Hammadde Kökeni</h3>
                  </div>

                  {/* Backward Step 1: Supplier & Goods Receipt */}
                  <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-text flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-text-muted" />
                        Tedarikçi ve Mal Kabul İrsaliyesi
                      </span>
                      <span className="text-[10px] font-mono bg-bg px-2 py-0.5 rounded border border-border">
                        {data.raw_material_footprint[0]?.dispatch_note_number || 'IRS-2026-BASF-0881'}
                      </span>
                    </div>

                    <div className="bg-bg p-3 rounded-lg border border-border text-xs space-y-1">
                      <div className="font-bold text-text">{data.raw_material_footprint[0]?.supplier_name || 'BASF Türk Kimya San. Ltd. Şti.'}</div>
                      <div className="text-[11px] text-text-muted flex items-center justify-between">
                        <span>Fatura No: <strong className="font-mono text-text">{data.raw_material_footprint[0]?.invoice_number || 'BSF202600008412'}</strong></span>
                        <span>Tarih: <strong className="font-mono text-text">{data.raw_material_footprint[0]?.receipt_date || '2026-10-10'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Flow Arrow */}
                  <div className="flex justify-center text-text-muted">
                    <ArrowDown className="w-4 h-4" />
                  </div>

                  {/* Backward Step 2: Consumed Raw Material Lots */}
                  <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-text flex items-center gap-1.5">
                        <Boxes className="w-4 h-4 text-text-muted" />
                        Tüketilen Hammadde Lotları ({data.raw_material_footprint.length} Kalem)
                      </span>
                    </div>

                    <div className="space-y-2">
                      {data.raw_material_footprint.map((mat, idx) => (
                        <div key={idx} className="p-2.5 bg-bg rounded-lg border border-border text-xs flex items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-text">{mat.item_name}</div>
                            <div className="text-[10px] font-mono text-text-muted">
                              Lot: <span className="text-primary font-bold">{mat.supplier_batch_number}</span> | SKU: {mat.sku}
                            </div>
                          </div>
                          <div className="text-right font-mono font-bold text-text">
                            {formatNumber(mat.quantity_consumed, 1)} {mat.unit}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: İLERİ İZLEME (FORWARD TRACEABILITY) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-success-soft text-success border border-success-border">
                      İLERİ İZLEME (Çıkış Hedefi)
                    </span>
                    <h3 className="text-sm font-bold text-text">Mamul Lotları & Müşteri Sevkiyatları</h3>
                  </div>

                  {/* Forward Step 1: Finished Good Lots & Work Orders */}
                  <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-text flex items-center gap-1.5">
                        <FlaskConical className="w-4 h-4 text-text-muted" />
                        Üretimden Çıkan Mamul Lotları ({data.production_batches?.length || 1} Parti)
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(data.production_batches || [data.production_batch]).map((po: any, idx: number) => {
                        if (!po) return null;
                        return (
                          <div key={idx} className="p-2.5 bg-bg rounded-lg border border-border text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-black text-primary text-xs">{po.finished_lot_number}</span>
                              <span className="text-[10px] font-mono bg-surface px-1.5 py-0.5 rounded border border-border text-text-muted">
                                Emir: {po.order_number}
                              </span>
                            </div>
                            <div className="font-bold text-text">{po.finished_good_name}</div>
                            <div className="flex items-center justify-between text-[11px] text-text-muted">
                              <span>Reçete: {po.recipe_name}</span>
                              <span className="font-mono font-bold text-text">{formatNumber(po.quantity_produced, 0)} {po.unit}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Flow Arrow */}
                  <div className="flex justify-center text-text-muted">
                    <ArrowDown className="w-4 h-4" />
                  </div>

                  {/* Forward Step 2: Dispatches & Customers */}
                  <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-text flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-text-muted" />
                        Sevk Edilen Müşteriler ({data.affected_customers?.length || 1})
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(data.affected_customers || [data.b2b_order]).map((cust: any, idx: number) => {
                        if (!cust) return null;
                        return (
                          <div key={idx} className="p-2.5 bg-bg rounded-lg border border-border text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-text">{cust.customer_title}</span>
                              <span className="font-mono font-bold text-success text-[11px]">
                                {cust.quantity ? `${formatNumber(cust.quantity, 0)} ${cust.unit || 'KG'}` : 'Sevk Edildi'}
                              </span>
                            </div>
                            <div className="text-[11px] text-text-muted flex items-center justify-between">
                              <span>İrsaliye: <strong className="font-mono text-text">{cust.dispatch_number || cust.order_number}</strong></span>
                              <span>{cust.dispatch_date}</span>
                            </div>
                            <div className="text-[10px] text-text-muted truncate">{cust.delivery_address}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warehouse Remaining Pallets & Shelf Bins Card */}
              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-warning" />
                    <h3 className="text-xs font-black uppercase text-text tracking-wider">
                      Depoda Kalan Paletler ve Raf Konumları
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-warning font-mono">
                    {data.in_stock_pallets?.length || 0} Palet Depoda
                  </span>
                </div>

                {data.in_stock_pallets && data.in_stock_pallets.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.in_stock_pallets.map((plt, idx) => (
                      <div key={idx} className="p-3 bg-bg rounded-xl border border-border text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-text text-xs">{plt.barcode_string}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning border border-warning-border">
                            {plt.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-text-muted">Miktar:</span>
                          <span className="font-mono font-bold text-text">{formatNumber(plt.quantity, 0)} {plt.unit}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-text-muted">Bölge & Raf:</span>
                          <span className="font-mono font-bold text-primary flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {plt.zone_name} / Raf: {plt.bin_code}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">Bu partiden depoda kalan açık palet bulunmamaktadır (tümü sevk edildi).</p>
                )}
              </div>
            </div>
          ) : (
            /* -----------------------------------------------------------------
                VIEW 2: DETAILED DATA TABLES (TABLO GÖRÜNÜMÜ)
                ----------------------------------------------------------------- */
            <div className="space-y-6">
              {/* Table 1: Raw Material Consumptions */}
              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-text flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-text-muted" />
                  Kullanılan Hammadde Şeceresi
                </h3>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left text-xs text-text">
                    <thead className="bg-bg text-text-muted font-bold uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="px-3.5 py-2.5">Hammadde & SKU</th>
                        <th className="px-3.5 py-2.5 text-right">Tüketilen Miktar</th>
                        <th className="px-3.5 py-2.5">Tedarikçi Lot No</th>
                        <th className="px-3.5 py-2.5">Tedarikçi Firma</th>
                        <th className="px-3.5 py-2.5">Fatura No</th>
                        <th className="px-3.5 py-2.5">İrsaliye No</th>
                        <th className="px-3.5 py-2.5">Giriş Tarihi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-medium">
                      {data.raw_material_footprint.map((mat, idx) => (
                        <tr key={idx} className="hover:bg-surface/50">
                          <td className="px-3.5 py-2.5 font-bold">{mat.item_name}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold">{formatNumber(mat.quantity_consumed, 2)} {mat.unit}</td>
                          <td className="px-3.5 py-2.5 font-mono">{mat.supplier_batch_number}</td>
                          <td className="px-3.5 py-2.5">{mat.supplier_name}</td>
                          <td className="px-3.5 py-2.5 font-mono">{mat.invoice_number}</td>
                          <td className="px-3.5 py-2.5 font-mono">{mat.dispatch_note_number}</td>
                          <td className="px-3.5 py-2.5 font-mono text-text-muted">{mat.receipt_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: Production Batches */}
              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-text flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-text-muted" />
                  Üretim Emirleri & Mamul Partileri
                </h3>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left text-xs text-text">
                    <thead className="bg-bg text-text-muted font-bold uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="px-3.5 py-2.5">Emir No</th>
                        <th className="px-3.5 py-2.5">Mamul Lot No</th>
                        <th className="px-3.5 py-2.5">Ürün Adı</th>
                        <th className="px-3.5 py-2.5">Reçete Formülasyonu</th>
                        <th className="px-3.5 py-2.5 text-right">Üretilen Miktar</th>
                        <th className="px-3.5 py-2.5">Reaktör</th>
                        <th className="px-3.5 py-2.5">Tarih</th>
                        <th className="px-3.5 py-2.5">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-medium">
                      {(data.production_batches || [data.production_batch]).map((po: any, idx: number) => {
                        if (!po) return null;
                        return (
                          <tr key={idx} className="hover:bg-surface/50">
                            <td className="px-3.5 py-2.5 font-mono font-bold">{po.order_number}</td>
                            <td className="px-3.5 py-2.5 font-mono font-black text-primary">{po.finished_lot_number}</td>
                            <td className="px-3.5 py-2.5 font-bold">{po.finished_good_name}</td>
                            <td className="px-3.5 py-2.5">{po.recipe_name}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-bold">{formatNumber(po.quantity_produced, 0)} {po.unit}</td>
                            <td className="px-3.5 py-2.5 text-text-muted">{po.reactor}</td>
                            <td className="px-3.5 py-2.5 font-mono text-text-muted">{po.production_date}</td>
                            <td className="px-3.5 py-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success-soft text-success border border-success-border">
                                {po.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 3: Affected Dispatches & Customers */}
              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-text flex items-center gap-2">
                  <Truck className="w-4 h-4 text-text-muted" />
                  Müşteri Sevkiyat Listesi
                </h3>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left text-xs text-text">
                    <thead className="bg-bg text-text-muted font-bold uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="px-3.5 py-2.5">Müşteri / Cari Ünvan</th>
                        <th className="px-3.5 py-2.5">İrsaliye No</th>
                        <th className="px-3.5 py-2.5">Sevk Tarihi</th>
                        <th className="px-3.5 py-2.5 text-right">Sevk Edilen Miktar</th>
                        <th className="px-3.5 py-2.5">Teslimat Adresi</th>
                        <th className="px-3.5 py-2.5">Lojistik Taşıyıcı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-medium">
                      {(data.affected_customers || [data.b2b_order]).map((c: any, idx: number) => {
                        if (!c) return null;
                        return (
                          <tr key={idx} className="hover:bg-surface/50">
                            <td className="px-3.5 py-2.5 font-bold text-text">{c.customer_title}</td>
                            <td className="px-3.5 py-2.5 font-mono font-bold">{c.dispatch_number || c.order_number}</td>
                            <td className="px-3.5 py-2.5 font-mono text-text-muted">{c.dispatch_date}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-bold text-success">
                              {c.quantity ? `${formatNumber(c.quantity, 0)} ${c.unit || 'KG'}` : 'Sevk Edildi'}
                            </td>
                            <td className="px-3.5 py-2.5 text-text-muted">{c.delivery_address}</td>
                            <td className="px-3.5 py-2.5 font-mono text-xs">{c.carrier || 'Özel Filo'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: RECALL SIMULATION (GERİ ÇAĞIRMA SİMÜLASYONU)
          ===================================================================== */}
      {activeTab === 'simulation' && (
        <div className="space-y-6">
          {/* Simulation Launcher Form */}
          <div className="bg-surface border-2 border-danger-border rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-danger-soft text-danger border border-danger-border">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-text">Yeni Geri Çağırma Simülasyonu</h2>
                  <p className="text-xs text-text-muted">
                    Potansiyel bir kalite sapmasında hangi üretim emirlerinin, müşterilerin ve depoların etkileneceğini hesaplar.
                  </p>
                </div>
              </div>

              {/* Simulation Safety Badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-primary-soft text-primary border border-primary-border">
                <Info className="w-3.5 h-3.5" />
                Simülasyon: Veriler değişmez
              </span>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text uppercase mb-1">
                  Hedef Parti / Lot / Emir / Barkod <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="örn: LOT-SIP-2026-99214"
                  className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-xs font-mono font-bold text-text focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text uppercase mb-1">
                  Zorunlu Simülasyon Gerekçesi / Neden Alanı <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={3}
                  value={simulationReason}
                  onChange={(e) => setSimulationReason(e.target.value)}
                  placeholder="Geri çağırma başlatılma nedeni (örn: Tedarikçi BASF'tan gelen hammadde safsızlık bildirimi, mikrobiyolojik limit aşımı şüphesi vb.)..."
                  className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-xs text-text focus:outline-none focus:border-danger"
                  required
                />
              </div>

              {simulationError && (
                <div className="p-3 bg-danger-soft border border-danger-border rounded-xl text-danger-text text-xs font-bold">
                  {simulationError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={simulating}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-danger hover:bg-danger/90 text-white text-xs font-black uppercase tracking-wider transition shadow-sm disabled:opacity-50"
                >
                  {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>Simülasyonu Çalıştır</span>
                </button>
              </div>
            </form>
          </div>

          {/* Simulation Output Results */}
          {simulationResult && (
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-6 animate-in fade-in">
              {/* Header Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-black text-danger bg-danger-soft px-2.5 py-1 rounded border border-danger-border">
                      {simulationResult.simulation_number}
                    </span>
                    <h3 className="text-base font-black text-text">Simülasyon Analiz Raporu</h3>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    Gerekçe: <strong className="text-text">{simulationResult.reason}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-bg px-3 py-1.5 rounded-xl border border-border text-text-muted font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Sorgu Süresi: {simulationResult.execution_time_sec}s
                  </span>
                  <button
                    onClick={() => setIsBlockModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-danger hover:bg-danger/90 text-white text-xs font-black transition shadow-xs"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Etkilenen Lotları Bloke Et</span>
                  </button>
                </div>
              </div>

              {/* 6 Key Operational Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-bg p-3.5 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Etkilenen Emirler</span>
                  <span className="text-xl font-black text-text font-mono mt-0.5 block">
                    {simulationResult.summary?.total_production_orders || simulationResult.affected_production_orders?.length || 0}
                  </span>
                </div>
                <div className="bg-bg p-3.5 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Etkilenen Lotlar</span>
                  <span className="text-xl font-black text-danger font-mono mt-0.5 block">
                    {simulationResult.summary?.total_finished_lots || simulationResult.affected_lots?.length || 0}
                  </span>
                </div>
                <div className="bg-bg p-3.5 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Etkilenen Müşteriler</span>
                  <span className="text-xl font-black text-text font-mono mt-0.5 block">
                    {simulationResult.summary?.total_customers || simulationResult.affected_customers?.length || 0}
                  </span>
                </div>
                <div className="bg-bg p-3.5 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Üretilen Miktar</span>
                  <span className="text-xl font-black text-text font-mono mt-0.5 block">
                    {formatNumber(simulationResult.summary?.total_produced_qty || 0, 0)} {simulationResult.summary?.unit || 'KG'}
                  </span>
                </div>
                <div className="bg-bg p-3.5 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Sevk Edilen Miktar</span>
                  <span className="text-xl font-black text-success font-mono mt-0.5 block">
                    {formatNumber(simulationResult.summary?.total_dispatched_qty || 0, 0)} {simulationResult.summary?.unit || 'KG'}
                  </span>
                </div>
                <div className="bg-bg p-3.5 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-text-muted uppercase block">Depoda Kalan Miktar</span>
                  <span className="text-xl font-black text-warning font-mono mt-0.5 block">
                    {formatNumber(simulationResult.summary?.total_in_stock_qty || 0, 0)} {simulationResult.summary?.unit || 'KG'}
                  </span>
                </div>
              </div>

              {/* Affected Customers Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-text flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-danger" />
                  Geri Çağırmadan Etkilenen Müşteri Listesi
                </h4>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left text-xs text-text">
                    <thead className="bg-bg text-text-muted font-bold uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="px-3.5 py-2.5">Müşteri / Bayi Ünvanı</th>
                        <th className="px-3.5 py-2.5">İrsaliye No</th>
                        <th className="px-3.5 py-2.5">Sevk Tarihi</th>
                        <th className="px-3.5 py-2.5 text-right">Sevk Miktarı</th>
                        <th className="px-3.5 py-2.5">Teslimat Adresi</th>
                        <th className="px-3.5 py-2.5">Taşıyıcı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-medium">
                      {(simulationResult.affected_customers || []).map((c: any, idx: number) => (
                        <tr key={idx} className="hover:bg-surface/50">
                          <td className="px-3.5 py-2.5 font-bold text-text">{c.customer_title}</td>
                          <td className="px-3.5 py-2.5 font-mono font-bold">{c.dispatch_number}</td>
                          <td className="px-3.5 py-2.5 font-mono text-text-muted">{c.dispatch_date}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-danger">
                            {formatNumber(c.quantity, 0)} {c.unit || 'KG'}
                          </td>
                          <td className="px-3.5 py-2.5 text-text-muted">{c.delivery_address}</td>
                          <td className="px-3.5 py-2.5 font-mono text-xs">{c.carrier || 'Özel Lojistik'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warehouse In-Stock Pallets with Shelf/Bin Location */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-text flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-warning" />
                  Depoda Bloke Edilmeye Hazır Kalan Paletler ve Raf Konumları
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(simulationResult.in_stock_pallets || []).map((plt: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-bg rounded-xl border-2 border-warning-border/60 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-text text-xs">{plt.barcode_string}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning text-white">
                          İzole Edilecek
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-text-muted">Miktar:</span>
                        <span className="font-mono font-bold text-text">{formatNumber(plt.quantity, 0)} {plt.unit}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-text-muted">Raf Konumu:</span>
                        <span className="font-mono font-bold text-primary flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" />
                          {plt.zone_name} / Raf: {plt.bin_code}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Block Confirmation Modal */}
          {isBlockModalOpen && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
              <div className="bg-surface border-2 border-danger-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-danger text-white">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-text">Etkilenen Lotları Bloke Et</h3>
                    <p className="text-xs text-text-muted">
                      Bu işlem seçilen tüm mamul ve hammadde lotlarını dondurur.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-danger-soft border border-danger-border rounded-xl text-xs text-danger-text space-y-1">
                  <p className="font-bold">DİKKAT: Kalite Karantinası Devreye Girer</p>
                  <p>
                    Bloke edilen lotlar üretim reçetelerine giremez, paketleme istasyonunda etiketlenemez ve sevkiyata eklenemez.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text uppercase mb-1">
                    Onay Gerekçesi <span className="text-danger">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Blokaj onay gerekçesini yazınız (örn: Kalite Güvence kararı ile parti karantinaya alınmıştır)..."
                    className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-xs text-text focus:outline-none focus:border-danger"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBlockModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-bg border border-border hover:bg-border/30 text-xs font-bold text-text transition"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={blocking || !blockReason.trim()}
                    onClick={handleBlockLots}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-danger hover:bg-danger/90 text-white text-xs font-black transition disabled:opacity-50"
                  >
                    {blocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>Onayla ve Bloke Et</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: PAST SIMULATIONS & AUDIT LOGS (GEÇMİŞ SİMÜLASYONLAR)
          ===================================================================== */}
      {activeTab === 'history' && (
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <h2 className="text-base font-black text-text">Geçmiş Geri Çağırma Simülasyonları Denetim Kaydı</h2>
            </div>
            <button
              onClick={fetchSimulationsHistory}
              disabled={historyLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg border border-border hover:bg-border/30 text-xs font-bold text-text transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>
          </div>

          {historyLoading ? (
            <div className="min-h-[200px] flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs text-text-muted">Denetim kayıtları yükleniyor...</p>
            </div>
          ) : historyList.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-xs">
              Henüz kaydedilmiş bir geri çağırma simülasyonu bulunmamaktadır.
            </div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left text-xs text-text">
                <thead className="bg-bg text-text-muted font-bold uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-3.5 py-2.5">Simülasyon No</th>
                    <th className="px-3.5 py-2.5">Tarih</th>
                    <th className="px-3.5 py-2.5">Sorgulanan Tanımlayıcı</th>
                    <th className="px-3.5 py-2.5">Gerekçe / Neden</th>
                    <th className="px-3.5 py-2.5 text-center">Etkilenen Emir</th>
                    <th className="px-3.5 py-2.5 text-center">Etkilenen Müşteri</th>
                    <th className="px-3.5 py-2.5 text-right">Toplam Miktar</th>
                    <th className="px-3.5 py-2.5">İşlemi Yapan</th>
                    <th className="px-3.5 py-2.5">Blokaj Durumu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {historyList.map((sim) => (
                    <tr key={sim.id} className="hover:bg-surface/50">
                      <td className="px-3.5 py-2.5 font-mono font-black text-primary">{sim.simulation_number}</td>
                      <td className="px-3.5 py-2.5 font-mono text-text-muted">{sim.created_at}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-text">{sim.query_identifier}</td>
                      <td className="px-3.5 py-2.5 text-text-muted max-w-xs truncate">{sim.reason}</td>
                      <td className="px-3.5 py-2.5 text-center font-mono font-bold">{sim.affected_orders_count}</td>
                      <td className="px-3.5 py-2.5 text-center font-mono font-bold">{sim.affected_customers_count}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold">
                        {formatNumber(sim.total_produced_qty, 0)} KG
                      </td>
                      <td className="px-3.5 py-2.5 text-text-muted">{sim.performed_by}</td>
                      <td className="px-3.5 py-2.5">
                        {sim.is_blocked ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-danger-soft text-danger border border-danger-border flex items-center gap-1 w-fit">
                            <Lock className="w-3 h-3" />
                            BLOKE EDİLDİ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-bg text-text-muted border border-border">
                            Simülasyon (Serbest)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Traceability;
