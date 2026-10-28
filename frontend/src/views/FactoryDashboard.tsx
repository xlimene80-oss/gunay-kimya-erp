import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Factory,
  Layers,
  FlaskConical,
  Scale,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Leaf,
  Boxes,
  AlertCircle,
  Check,
  ShieldAlert,
  ChevronRight,
  FileWarning
} from 'lucide-react';

interface BomIngredient {
  raw_material_id: number;
  name: string;
  sku: string;
  unit: string;
  required_quantity: number;
  available_stock: number;
  stock_status: string;
  fefo_lot: string;
  fefo_expiration: string;
}

interface FactoryOrder {
  order_no: number;
  order_number: string;
  phase: string;
  current_status: number;
  status_label: string;
  total_price: number;
  created_at: string;
  product_name: string;
  product_code: string;
  order_quantity: number;
  order_unit: string;
  reactor_name: string;
  carbon_footprint_kg: number;
  lot_number: string;
  box_barcode: string;
  pallet_barcode: string;
  dispatch_no: string;
  shipping_status: string;
  cari_id?: number;
  cari_title?: string;
  bom_ingredients?: BomIngredient[];
}

interface FactoryDashboardProps {
  onNavigate?: (view: string) => void;
}

export const FactoryDashboard: React.FC<FactoryDashboardProps> = ({ onNavigate }) => {
  const [orders, setOrders] = useState<FactoryOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [pendingQcCount, setPendingQcCount] = useState<number>(0);
  const [sdsWarningCount, setSdsWarningCount] = useState<number>(0);

  const fetchQualityMetrics = async () => {
    try {
      const [qRes, hazRes] = await Promise.all([
        axios.get('/api/quality/dashboard-metrics').catch(() => null),
        axios.get('/api/v1/hazmat/dashboard-metrics').catch(() => null)
      ]);
      if (qRes && qRes.data && qRes.data.success && qRes.data.data) {
        setPendingQcCount(qRes.data.data.pending_count || 0);
      }
      if (hazRes && hazRes.data && typeof hazRes.data.sds_warning_count === 'number') {
        setSdsWarningCount(hazRes.data.sds_warning_count);
      }
    } catch (e) {
      // Non-fatal if metrics call fails
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get('/api/orders/details');
      if (res.data && res.data.success) {
        setOrders(res.data.data);
        if (res.data.data.length > 0 && activeOrderId === null) {
          setActiveOrderId(res.data.data[0].order_no);
        }
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Fabrika verisi çekilemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchQualityMetrics();
    const interval = setInterval(() => {
      fetchOrders();
      fetchQualityMetrics();
    }, 5000); // 5 saniyede bir polling
    return () => clearInterval(interval);
  }, [activeOrderId]);

  // Plan BOM
  const handlePlanBOM = async (orderId: number) => {
    setActionLoading(`bom-${orderId}`);
    try {
      const res = await axios.post(`/api/manufacturing/orders/${orderId}/plan-bom`);
      setNotification({ type: 'success', message: res.data.message || 'Reçete (BOM) başarıyla hesaplandı!' });
      await fetchOrders();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'BOM planlama hatası' });
    } finally {
      setActionLoading(null);
    }
  };

  // Start Production (FEFO Stock Deduction)
  const handleStartProduction = async (orderId: number) => {
    setActionLoading(`start-${orderId}`);
    try {
      const res = await axios.post(`/api/manufacturing/orders/${orderId}/start-production`);
      setNotification({
        type: 'success',
        message: `✓ FEFO stok çekimi yapıldı! Karbon Ayak İzi: ${res.data.carbon_footprint_kg} kg CO2e. Reaktörde kimyasal sentez başladı.`
      });
      await fetchOrders();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'FEFO hammadde çekim hatası' });
    } finally {
      setActionLoading(null);
    }
  };

  // Advance Phase & Barcode Generation
  const handleAdvancePhase = async (orderId: number) => {
    setActionLoading(`advance-${orderId}`);
    try {
      const res = await axios.post(`/api/manufacturing/orders/${orderId}/advance-phase`);
      setNotification({ type: 'success', message: res.data.message || 'Üretim fazı ilerletildi!' });
      await fetchOrders();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Faz ilerletme hatası' });
    } finally {
      setActionLoading(null);
    }
  };

  const selectedOrder = orders.find((o) => o.order_no === activeOrderId) || orders[0];

  // Aggregated KPI metrics
  const totalVolume = orders.reduce((sum, o) => sum + o.order_quantity, 0);
  const totalCarbon = orders.reduce((sum, o) => sum + (o.carbon_footprint_kg || 0), 0);
  const readyCount = orders.filter((o) => o.phase === 'PAKETLEME_HAZIR' || o.phase === 'SEVK_EDILDI').length;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION (Rule 3: bg-primary-soft, border-l-4 border-l-primary, Canlı Operasyon: success-soft + dot) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-primary-soft p-6 rounded-2xl border border-border border-l-4 border-l-primary shadow-card">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-surface border border-border text-primary shadow-sm">
              <Factory className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
                Üretim Kontrol Merkezi
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold bg-success-soft text-success-text border border-success-border rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-pulse" />
                  Canlı Operasyon
                </span>
              </h1>
              <p className="text-xs text-text-muted mt-1">
                Siparişten reçeteye (BOM) otomatik hesaplama, FEFO/FIFO hammadde stok düşümü ve akıllı koli/palet barkod üretimi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-text-muted block font-mono">Son Polling: {lastRefreshed.toLocaleTimeString()}</span>
            <span className="text-xs text-text-muted font-medium flex items-center justify-end gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success inline-block" />
              Sistem Aktif (5s)
            </span>
          </div>
          <button
            onClick={fetchOrders}
            className="px-3.5 py-2 bg-surface hover:bg-bg text-text rounded-xl border border-border shadow-card transition flex items-center gap-2 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs transition-all ${
            notification.type === 'success'
              ? 'bg-success-soft border-success-border text-success-text'
              : 'bg-danger-soft border-danger-border text-danger-text'
          }`}
        >
          <div className="flex items-center gap-3 font-medium">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs underline ml-4 hover:opacity-80"
          >
            Kapat
          </button>
        </div>
      )}

      {/* KPI METRIC CARDS (Rule 2: 3px top border, icon in soft box with module color, dark text) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Aktif Üretim Emirleri (mod-uretim) */}
        <div className="bg-surface border border-border border-t-[3px] border-t-mod-uretim rounded-2xl p-5 shadow-card relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Aktif Üretim Emirleri</span>
            <div className="w-9 h-9 rounded-xl bg-mod-uretim-soft text-mod-uretim flex items-center justify-center shrink-0 border border-mod-uretim-border">
              <Layers className="w-5 h-5 text-mod-uretim" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text font-mono">{orders.length}</span>
            <span className="text-xs text-text-muted font-medium">Sipariş İşleniyor</span>
          </div>
          <div className="mt-2 text-[11px] text-text-muted">B2B ve fabrika doğrudan talepleri</div>
        </div>

        {/* Card 2: Reaktör Hacmi (mod-satis) */}
        <div className="bg-surface border border-border border-t-[3px] border-t-mod-satis rounded-2xl p-5 shadow-card relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Reaktör Hacmi</span>
            <div className="w-9 h-9 rounded-xl bg-mod-satis-soft text-mod-satis flex items-center justify-center shrink-0 border border-mod-satis-border">
              <FlaskConical className="w-5 h-5 text-mod-satis" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text font-mono">
              {totalVolume.toLocaleString('tr-TR')}
            </span>
            <span className="text-xs text-text-muted font-medium">KG / Litre</span>
          </div>
          <div className="mt-2 text-[11px] text-text-muted">Paslanmaz Reaktör-01 ve Mikserler</div>
        </div>

        {/* Card 3: Kalite Bekleyen Lot (Uyarı rengi - Kontrol Bekleyenler Ekranına Yönlendirme) */}
        <div
          onClick={() => onNavigate && onNavigate('quality_pending')}
          className={`bg-surface border border-border border-t-[3px] border-t-warning rounded-2xl p-5 shadow-card relative overflow-hidden transition-all ${
            onNavigate ? 'cursor-pointer hover:shadow-md hover:border-warning/60 active:scale-[0.99] group' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Kalite Bekleyen Lot</span>
            <div className="w-9 h-9 rounded-xl bg-warning-soft text-warning flex items-center justify-center shrink-0 border border-warning-border">
              <ShieldAlert className="w-5 h-5 text-warning" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-warning font-mono">{pendingQcCount}</span>
            <span className="text-xs text-text-muted font-medium">Lot Karantinada</span>
          </div>
          <div className="mt-2 text-[11px] text-text-muted flex items-center justify-between">
            <span>Kontrol bekleyen hammadde / mamul</span>
            {onNavigate && (
              <span className="text-warning font-bold inline-flex items-center gap-0.5 text-[10px] group-hover:underline">
                İncele <ChevronRight className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>

        {/* Card 4: GBF Eksik / Eski (Uyarı rengi - Ürün Listesine Yönlendirme) */}
        <div
          onClick={() => onNavigate && onNavigate('products_sds_warning')}
          className={`bg-surface border border-border border-t-[3px] border-t-amber-500 rounded-2xl p-5 shadow-card relative overflow-hidden transition-all ${
            onNavigate ? 'cursor-pointer hover:shadow-md hover:border-amber-500/60 active:scale-[0.99] group' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">GBF Eksik / Eski</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
              <FileWarning className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 font-mono">{sdsWarningCount}</span>
            <span className="text-xs text-text-muted font-medium">Ürün Kartı</span>
          </div>
          <div className="mt-2 text-[11px] text-text-muted flex items-center justify-between">
            <span>Güncelleme gereken formlar</span>
            {onNavigate && (
              <span className="text-amber-600 font-bold inline-flex items-center gap-0.5 text-[10px] group-hover:underline">
                İncele <ChevronRight className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>

        {/* Card 5: Karbon Ayak İzi (mod-stok) */}
        <div className="bg-surface border border-border border-t-[3px] border-t-mod-stok rounded-2xl p-5 shadow-card relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Karbon Ayak İzi</span>
            <div className="w-9 h-9 rounded-xl bg-mod-stok-soft text-mod-stok flex items-center justify-center shrink-0 border border-mod-stok-border">
              <Leaf className="w-5 h-5 text-mod-stok" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text font-mono">
              {totalCarbon.toFixed(1)}
            </span>
            <span className="text-xs text-text-muted font-medium">kg CO₂e</span>
          </div>
          <div className="mt-2 text-[11px] text-text-muted">Yeşil Mutabakat & ISO 14067 Uyumlu</div>
        </div>

        {/* Card 6: Hazır Palet & Koli (mod-finans) */}
        <div className="bg-surface border border-border border-t-[3px] border-t-mod-finans rounded-2xl p-5 shadow-card relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Hazır Palet & Koli</span>
            <div className="w-9 h-9 rounded-xl bg-mod-finans-soft text-mod-finans flex items-center justify-center shrink-0 border border-mod-finans-border">
              <Boxes className="w-5 h-5 text-mod-finans" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text font-mono">{readyCount}</span>
            <span className="text-xs text-text-muted font-medium">Palet Barkodlu</span>
          </div>
          <div className="mt-2 text-[11px] text-text-muted">Depo ve sevkiyata hazır birimler</div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKFLOW SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: ACTIVE ORDERS LIST (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-text flex items-center gap-2">
              <Layers className="w-4 h-4 text-text-muted" />
              <span>Üretim Emirleri & Kuyruk</span>
            </h2>
            <span className="text-xs font-mono text-text-muted">
              {orders.length} Kayıt
            </span>
          </div>

          <div className="space-y-3">
            {orders.map((o) => {
              const isSelected = o.order_no === activeOrderId;
              return (
                <div
                  key={o.order_no}
                  onClick={() => setActiveOrderId(o.order_no)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative shadow-card ${
                    isSelected
                      ? 'bg-primary-soft border-primary ring-1 ring-primary'
                      : 'bg-surface border-border hover:border-border hover:bg-bg'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-text">
                      {o.order_number || `ORD-00${o.order_no}`}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        o.phase === 'SEVK_EDILDI' || o.phase === 'PAKETLEME_HAZIR'
                          ? 'bg-success-soft text-success-text border-success-border'
                          : o.phase === 'REAKTORDE'
                          ? 'bg-warning-soft text-warning-text border-warning-border'
                          : o.phase === 'RECETE_HAZIR' || o.phase === 'SIPARIS_ALINDI' || o.phase === 'DOLUM_KALITE'
                          ? 'bg-primary-soft text-primary-text border-primary-border'
                          : 'bg-bg text-text-muted border-border'
                      }`}
                    >
                      {o.status_label || (
                        o.phase === 'SEVK_EDILDI'
                          ? 'Sevk Edildi'
                          : o.phase === 'PAKETLEME_HAZIR'
                          ? 'Paketleme & Hazır'
                          : o.phase === 'REAKTORDE'
                          ? 'Reaktörde'
                          : o.phase === 'RECETE_HAZIR'
                          ? 'Reçete Hazır'
                          : o.phase === 'SIPARIS_ALINDI'
                          ? 'Sipariş Alındı'
                          : 'Bekliyor'
                      )}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-text truncate">
                    {o.product_name}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5 font-mono">
                    Müşteri: {o.cari_title || 'Ege Kimya Dağıtım'}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border text-xs">
                    <span className="text-text font-mono font-bold">
                      {o.order_quantity} {o.order_unit}
                    </span>
                    <span className="text-text-muted font-mono text-[11px]">
                      {o.reactor_name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL WORKFLOW TREE & OPERATIONAL CONTROLS (7 Cols) */}
        {selectedOrder ? (
          <div className="lg:col-span-7 space-y-6">
            {/* 1. ORDER LIFECYCLE STEPPER (Rule 4: success for completed, primary for active, white+border for waiting) */}
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <span className="text-xs text-text-muted font-mono uppercase font-bold tracking-wider">
                    Aktif Süreç: {selectedOrder.order_number}
                  </span>
                  <h3 className="text-lg font-bold text-text">
                    {selectedOrder.product_name}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-text-muted block font-mono">Üretim Miktarı</span>
                  <span className="text-base font-bold text-text font-mono">
                    {selectedOrder.order_quantity} {selectedOrder.order_unit}
                  </span>
                </div>
              </div>

              {/* 5-STEP VISUAL PROGRESS STEPPER */}
              <div className="relative my-6">
                <div className="h-1 bg-border absolute top-4 left-6 right-6 -z-0" />
                <div
                  className="h-1 bg-success absolute top-4 left-6 transition-all duration-500 -z-0"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((Math.max(1, selectedOrder.current_status - 1)) / 5) * 100))}%`,
                  }}
                />

                <div className="grid grid-cols-6 gap-1 relative z-10 text-center">
                  {[
                    { step: 1, title: 'Sipariş', phase: 'SIPARIS_ALINDI' },
                    { step: 2, title: 'Reçete', phase: 'RECETE_HAZIR' },
                    { step: 3, title: 'Reaktör', phase: 'REAKTORDE' },
                    { step: 4, title: 'Dolum', phase: 'DOLUM_KALITE' },
                    { step: 5, title: 'Paketleme', phase: 'PAKETLEME_HAZIR' },
                    { step: 6, title: 'Sevk', phase: 'SEVK_EDILDI' },
                  ].map((s) => {
                    const isDone = selectedOrder.current_status > s.step;
                    const isCurrent = selectedOrder.current_status === s.step;
                    return (
                      <div key={s.step} className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                            isDone
                              ? 'bg-success text-white'
                              : isCurrent
                              ? 'bg-primary text-white shadow-card'
                              : 'bg-surface text-text-muted border border-border'
                          }`}
                        >
                          {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : s.step}
                        </div>
                        <span
                          className={`text-[11px] font-medium mt-2 leading-tight ${
                            isCurrent
                              ? 'text-primary font-bold'
                              : isDone
                              ? 'text-text font-semibold'
                              : 'text-text-muted'
                          }`}
                        >
                          {s.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACTION BUTTONS TOOLBAR */}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
                {selectedOrder.phase === 'SIPARIS_ALINDI' && (
                  <button
                    onClick={() => handlePlanBOM(selectedOrder.order_no)}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 bg-surface hover:bg-bg text-text rounded-xl font-medium text-xs flex items-center gap-2 border border-border shadow-card transition"
                  >
                    <Scale className="w-4 h-4 text-text-muted" />
                    Reçete Hesapla & Stok Ayır
                  </button>
                )}

                {(selectedOrder.phase === 'RECETE_HAZIR' || selectedOrder.phase === 'SIPARIS_ALINDI') && (
                  <button
                    onClick={() => handleStartProduction(selectedOrder.order_no)}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 bg-surface hover:bg-bg text-text rounded-xl font-medium text-xs flex items-center gap-2 border border-border shadow-card transition"
                  >
                    <FlaskConical className="w-4 h-4 text-text-muted" />
                    Reaktöre Al (FEFO Stok Çek)
                  </button>
                )}

                {selectedOrder.phase !== 'SEVK_EDILDI' && (
                  <button
                    onClick={() => handleAdvancePhase(selectedOrder.order_no)}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs flex items-center gap-2 border border-transparent shadow-card transition ml-auto"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Sonraki Faz İlerlet
                  </button>
                )}
              </div>
            </div>

            {/* 2. SİPARİŞTEN REÇETEYE (BOM) & FEFO STOK AĞACI */}
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-text-muted" />
                  <h3 className="text-base font-bold text-text">
                    Reçete (BOM) & FEFO Stok Çekim Ağacı
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-mono">
                    Depo: Hammadde Deposu
                  </span>
                </div>
              </div>

              {selectedOrder.bom_ingredients && selectedOrder.bom_ingredients.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-text-muted">
                        <th className="py-2 px-3 font-semibold">Hammadde (Kimyasal)</th>
                        <th className="py-2 px-3 font-semibold text-right">Gereken Miktar</th>
                        <th className="py-2 px-3 font-semibold text-right">Depo Stok</th>
                        <th className="py-2 px-3 font-semibold">FEFO Lot No (SKT)</th>
                        <th className="py-2 px-3 font-semibold text-center">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {selectedOrder.bom_ingredients.map((ing) => (
                        <tr key={ing.raw_material_id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-sans text-text font-medium">
                            {ing.name}
                          </td>
                          <td className="py-2.5 px-3 text-right text-text font-bold">
                            {ing.required_quantity.toFixed(2)} {ing.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right text-text-muted">
                            {ing.available_stock.toFixed(2)} {ing.unit}
                          </td>
                          <td className="py-2.5 px-3 text-text text-[11px]">
                            <span className="text-text font-semibold">{ing.fefo_lot}</span>
                            <span className="text-text-muted block text-[10px]">SKT: {ing.fefo_expiration}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                                ing.stock_status === 'Yeterli'
                                  ? 'bg-success-soft text-success-text border-success-border'
                                  : 'bg-danger-soft text-danger-text border-danger-border'
                              }`}
                            >
                              {ing.stock_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-6 text-center text-text-muted text-xs">
                  Reçete henüz yüklenmedi veya hammadde atanmadı.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-7 p-12 text-center text-text-muted">
            Lütfen sol listeden bir üretim siparişi seçiniz.
          </div>
        )}
      </div>
    </div>
  );
};
