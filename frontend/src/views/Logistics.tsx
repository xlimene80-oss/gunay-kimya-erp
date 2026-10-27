import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Truck,
  Package,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  MapPin,
  Loader2,
  Boxes,
  BellRing,
  X,
  FileText,
  Download
} from 'lucide-react';
import { WaybillModal } from '../components/WaybillModal';

export type ShipmentStatus = 'PENDING' | 'READY' | 'SHIPPED';

export interface ShipmentItem {
  id: number;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  package_type: string;
}

export interface ShipmentOrder {
  id: number;
  dispatch_number: string;
  cari_name: string;
  status: ShipmentStatus;
  warehouse: string;
  created_at: string;
  dispatch_date?: string;
  estimated_delivery: string;
  delivery_address: string;
  carrier_company: string;
  vehicle_plate?: string;
  driver_name?: string;
  driver_tckn?: string;
  carrier_tracking_code?: string;
  items: ShipmentItem[];
}

export interface ProductionNotification {
  id: number;
  title: string;
  message: string;
  event_type: string;
  created_at: string;
}

export const Logistics: React.FC = () => {
  const [shipments, setShipments] = useState<ShipmentOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ShipmentStatus>('ALL');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Official Waybill modal state
  const [selectedWaybillId, setSelectedWaybillId] = useState<number | null>(null);
  const [isWaybillModalOpen, setIsWaybillModalOpen] = useState<boolean>(false);

  const handleOpenWaybill = (id: number) => {
    setSelectedWaybillId(id);
    setIsWaybillModalOpen(true);
  };

  const handleExportCsv = async () => {
    try {
      const response = await axios.get('/api/v1/inventory/dispatch/export/csv', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `gunay_kimya_sevkiyat_raporu_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      const headers = ['Sevk No', 'Cari Ünvanı', 'Durum', 'Depo', 'Taşıyıcı', 'Takip Kodu', 'Kalem Sayısı', 'Teslimat Adresi'];
      const rows = shipments.map((s) => [
        s.dispatch_number,
        `"${s.cari_name || ''}"`,
        s.status,
        s.warehouse,
        `"${s.carrier_company || ''}"`,
        s.carrier_tracking_code || '',
        s.items.length,
        `"${s.delivery_address || ''}"`,
      ]);
      const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'gunay_kimya_sevkiyat_raporu.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  // Live warehouse notifications state (Trigger A)
  const [warehouseAlerts, setWarehouseAlerts] = useState<ProductionNotification[]>([
    {
      id: 101,
      title: 'Yeni Üretim Girişi: Günay Ultra Sıvı El Sabunu (LOT-ORD-2026-981)',
      message: 'Üretim Emri #981 reaktörde tamamlandı. 1000 KG mamul Mamul Ürün Deposu #1 alanına giriş bekliyor. Laboratuvar pH ve viskozite onayı verilmiştir.',
      event_type: 'PRODUCTION_COMPLETED',
      created_at: '2026-10-25 16:30',
    },
  ]);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<number[]>([]);

  // Default sample chemical shipments for Günay Kimya B2B dealers
  const sampleShipments: ShipmentOrder[] = [
    {
      id: 1,
      dispatch_number: 'DSP-2026-00412',
      cari_name: 'Ege Kimya Sanayi A.Ş.',
      status: 'SHIPPED',
      warehouse: 'Mamul Ürün Deposu #1',
      created_at: '2026-10-24 09:30',
      dispatch_date: '2026-10-25 14:15',
      estimated_delivery: '2026-10-26 17:00',
      delivery_address: 'Ege Kimya Tesisleri, Gebze OSB 4. Cadde No:18, Kocaeli',
      carrier_company: 'Günay Kimya Özel Lojistik Filosu',
      carrier_tracking_code: 'GNK-LOG-884192',
      items: [
        {
          id: 1,
          sku: 'GNY-SBN-005',
          name: 'Günay Ultra Sıvı El Sabunu (Okyanus Esintisi)',
          quantity: 120,
          unit: 'Koli',
          package_type: 'Paletli Koli (4x5L)',
        },
        {
          id: 2,
          sku: 'GNY-CAM-001',
          name: 'Günay Kristal Cam ve Yüzey Temizleyici',
          quantity: 80,
          unit: 'Koli',
          package_type: 'Paletli Koli (12x1L)',
        },
      ],
    },
    {
      id: 2,
      dispatch_number: 'DSP-2026-00408',
      cari_name: 'Ege Kimya Sanayi A.Ş.',
      status: 'READY',
      warehouse: 'Mamul Ürün Deposu #2',
      created_at: '2026-10-25 11:20',
      estimated_delivery: '2026-10-27 12:00',
      delivery_address: 'İzmir Bölge Dağıtım Antreposu, Kemalpaşa OSB, İzmir',
      carrier_company: 'Horoz Lojistik Endüstriyel',
      carrier_tracking_code: 'HRZ-77310492',
      items: [
        {
          id: 3,
          sku: 'GNY-YAG-020',
          name: 'Günay Endüstriyel Ağır Kir & Yağ Sökücü',
          quantity: 40,
          unit: 'Bidon',
          package_type: '20 Litre HDPE Sanayi Bidonu',
        },
        {
          id: 4,
          sku: 'GNY-CLS-030',
          name: 'Günay Çamaşır Suyu (Sodyum Hipoklorit %15)',
          quantity: 50,
          unit: 'Bidon',
          package_type: '30 KG Sanayi Tipi Bidon',
        },
      ],
    },
    {
      id: 3,
      dispatch_number: 'DSP-2026-00399',
      cari_name: 'Ege Kimya Sanayi A.Ş.',
      status: 'PENDING',
      warehouse: 'Fabrika Ana Dolum Sahası',
      created_at: '2026-10-25 15:45',
      estimated_delivery: '2026-10-28 16:30',
      delivery_address: 'Ege Kimya Tesisleri, Gebze OSB 4. Cadde No:18, Kocaeli',
      carrier_company: 'Günay Kimya Özel Lojistik Filosu',
      items: [
        {
          id: 5,
          sku: 'GNY-BUL-020',
          name: 'Günay Konsantre Bulaşık Deterjanı (Limonlu)',
          quantity: 60,
          unit: 'Bidon',
          package_type: '20 Litre Bidon',
        },
        {
          id: 6,
          sku: 'GNY-KRE-005',
          name: 'Günay Nemlendirici Krem Sıvı Sabun (Sedefli)',
          quantity: 75,
          unit: 'Koli',
          package_type: '4 x 5 Litre Koli',
        },
      ],
    },
  ];

  const fetchShipmentsAndAlerts = async () => {
    try {
      // 1. Fetch shipments
      const res = await axios.get('/api/v1/inventory/dispatch');
      if (res.data && res.data.length > 0) {
        setShipments(res.data);
      } else {
        setShipments(sampleShipments);
      }

      // 2. Fetch warehouse notifications (Trigger A: Production -> Warehouse)
      const notifRes = await axios.get('/api/v1/notifications?role=DEPO_SORUMLUSU&unread_only=true');
      if (notifRes.data && notifRes.data.length > 0) {
        setWarehouseAlerts(notifRes.data);
      }
    } catch (err: any) {
      setShipments(sampleShipments);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShipmentsAndAlerts();

    // Live polling hook every 15 seconds for incoming production lots
    const interval = setInterval(() => {
      fetchShipmentsAndAlerts();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchShipmentsAndAlerts();
  };

  const handleAcknowledgeAlert = async (id: number) => {
    try {
      await axios.patch(`/api/v1/notifications/${id}/read`);
    } catch {
      // Optimistic UI update
    }
    setAcknowledgedAlerts((prev) => [...prev, id]);
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Status Styling Badge
  const getStatusBadge = (status: ShipmentStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-text-muted border border-border">
            <Clock className="w-3.5 h-3.5 text-text-muted" />
            Hazırlanıyor (Depo/Dolum)
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning-soft text-warning-text border border-warning-border">
            <Package className="w-3.5 h-3.5 text-warning" />
            Yola Çıkmaya Hazır (Paletlendi)
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-soft text-success-text border border-success-border">
            <Truck className="w-3.5 h-3.5 text-success" />
            Sevk Edildi (Teslimat Yolunda)
          </span>
        );
    }
  };

  // Visual Step Progress Bar
  const renderStepTracker = (status: ShipmentStatus) => {
    const steps = [
      { key: 'RECEIVED', label: 'Sipariş Onaylandı' },
      { key: 'PENDING', label: 'Depoda Hazırlanıyor' },
      { key: 'READY', label: 'Paletlendi & Hazır' },
      { key: 'SHIPPED', label: 'Sevk Edildi' },
    ];

    const getStepStatus = (stepIndex: number) => {
      if (status === 'SHIPPED') return 'completed';
      if (status === 'READY') {
        if (stepIndex < 2) return 'completed';
        if (stepIndex === 2) return 'current';
        return 'pending';
      }
      if (status === 'PENDING') {
        if (stepIndex < 1) return 'completed';
        if (stepIndex === 1) return 'current';
        return 'pending';
      }
      return 'pending';
    };

    return (
      <div className="py-4">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-border w-full z-0" />
          <div
            className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 z-0 transition-all duration-500 bg-success ${
              status === 'SHIPPED'
                ? 'w-full'
                : status === 'READY'
                ? 'w-2/3'
                : 'w-1/3'
            }`}
          />

          {steps.map((step, idx) => {
            const stepState = getStepStatus(idx);
            const isCompleted = stepState === 'completed';
            const isCurrent = stepState === 'current' || (status === 'SHIPPED' && idx === 3);

            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center group">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-success text-white ring-4 ring-surface'
                      : isCurrent
                      ? 'bg-primary text-white ring-4 ring-surface scale-110'
                      : 'bg-surface text-text-muted border border-border ring-4 ring-surface'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4 text-white" /> : idx + 1}
                </div>
                <span
                  className={`text-[11px] font-medium mt-2 text-center whitespace-nowrap ${
                    isCurrent ? 'text-text font-bold' : isCompleted ? 'text-text' : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const activeAlerts = warehouseAlerts.filter((a) => !acknowledgedAlerts.includes(a.id));

  const filteredShipments = shipments.filter((s) => {
    const matchesFilter = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesQuery =
      s.dispatch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.carrier_tracking_code && s.carrier_tracking_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.delivery_address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* TRIGGER A: Live Flash Alert Toast Component for Warehouse Reception */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3 animate-fadeIn">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-bg text-text-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary-soft px-2 py-0.5 rounded border border-primary-border">
                        Üretimden Yeni Mamul Girişi
                      </span>
                      <span className="text-[11px] text-text-muted font-mono">{alert.created_at}</span>
                    </div>
                    <h3 className="text-sm font-bold text-text mt-1">
                      {alert.title}
                    </h3>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-3xl">
                      {alert.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all border border-transparent"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Depoya Kabul Et</span>
                  </button>
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="p-2 text-text-muted hover:text-text rounded-xl bg-surface border border-border transition-colors hover:bg-border/30"
                    title="Kapat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Truck className="w-5 h-5 text-text-muted" />
            Lojistik & Sevkiyat Takip Portalı
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Günay Kimya tesislerinden çıkan kimyasal ürün kargo ve özel filo sevk emirleri
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface hover:bg-border/30 border border-border text-xs font-bold text-text transition-all"
            title="Tüm sevkiyat ve irsaliye verilerini Excel uyumlu CSV formatında indir"
          >
            <Download className="w-4 h-4 text-text-muted" />
            <span>Excel / CSV Raporu İndir</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface hover:bg-border/30 border border-border text-xs text-text transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${refreshing ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Sevk No veya Takip Kodu ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-xl text-text placeholder-text-muted/60 text-xs focus:outline-none focus:border-primary"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-bg p-1.5 rounded-xl border border-border w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'ALL' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            Tüm Sevkiyatlar ({shipments.length})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'PENDING' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            Hazırlanıyor
          </button>
          <button
            onClick={() => setStatusFilter('READY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'READY' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            Hazır
          </button>
          <button
            onClick={() => setStatusFilter('SHIPPED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'SHIPPED' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            Yolda / Sevk Edildi
          </button>
        </div>
      </div>

      {/* Shipments List */}
      {loading ? (
        <div className="min-h-[350px] flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-text-muted">Sevkiyat hareketleri taranıyor...</p>
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center text-text-muted">
          <Truck className="w-10 h-10 text-text-muted mx-auto mb-2" />
          <p className="text-sm font-semibold text-text">Seçilen kriterlere uygun aktif sevk emri bulunamadı.</p>
          <p className="text-xs text-text-muted mt-1">Yeni bir sipariş oluşturduğunuzda sevkiyat kaydı otomatik olarak burada listelenecektir.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShipments.map((shipment) => {
            const isExpanded = expandedId === shipment.id;
            return (
              <div
                key={shipment.id}
                className="bg-surface border border-border rounded-2xl p-5 shadow-lg space-y-4 hover:border-border/80 transition-all"
              >
                {/* Shipment Card Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg border border-border text-text-muted flex items-center justify-center shrink-0">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-text">
                          {shipment.dispatch_number}
                        </span>
                        {getStatusBadge(shipment.status)}
                      </div>
                      <div className="text-xs text-text-muted flex items-center gap-2 mt-1">
                        <span>Çıkış Deposu:</span>
                        <span className="text-text font-medium">{shipment.warehouse}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tracking & Estimated Delivery */}
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    {shipment.carrier_tracking_code && (
                      <div className="bg-bg px-3 py-1.5 rounded-xl border border-border">
                        <span className="text-text-muted block text-[10px] uppercase font-semibold">Takip Kodu</span>
                        <span className="font-mono text-text font-bold">{shipment.carrier_tracking_code}</span>
                      </div>
                    )}

                    <div className="bg-bg px-3 py-1.5 rounded-xl border border-border">
                      <span className="text-text-muted block text-[10px] uppercase font-semibold">Tahmini Varış</span>
                      <span className="text-text font-bold font-mono">{shipment.estimated_delivery}</span>
                    </div>

                    <button
                      onClick={() => handleOpenWaybill(shipment.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface hover:bg-border/30 border border-border text-text font-semibold text-xs transition-all"
                      title="Resmi e-İrsaliye Belgesi ve Yazdırma Önizlemesi"
                    >
                      <FileText className="w-4 h-4 text-text-muted" />
                      <span>İrsaliye (PDF)</span>
                    </button>

                    <button
                      onClick={() => toggleExpand(shipment.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface hover:bg-border/30 border border-border text-text text-xs transition-colors"
                    >
                      <span>{isExpanded ? 'Detayları Gizle' : 'Koli & Paket Detayı'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                    </button>
                  </div>
                </div>

                {/* Visual Step-Progress Tracker */}
                <div className="px-2">{renderStepTracker(shipment.status)}</div>

                {/* Collapsible Package Breakdown Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-bg p-4 rounded-xl border border-border">
                      <div>
                        <span className="text-text-muted font-semibold block uppercase mb-1">Teslimat Adresi</span>
                        <div className="flex items-start gap-2 text-text">
                          <MapPin className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                          <span>{shipment.delivery_address}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-text-muted font-semibold block uppercase mb-1">Taşıyıcı & Araç</span>
                        <div className="flex flex-col gap-1 text-text">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-text-muted shrink-0" />
                            <span>{shipment.carrier_company}</span>
                          </div>
                          {shipment.vehicle_plate && (
                            <div className="text-[11px] text-text-muted flex items-center gap-2 mt-0.5">
                              <span>Plaka:</span>
                              <span className="font-mono font-bold text-text bg-surface px-2 py-0.5 rounded border border-border">
                                {shipment.vehicle_plate}
                              </span>
                              {shipment.driver_name && (
                                <span>• Sürücü: <strong className="text-text">{shipment.driver_name}</strong></span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div>
                      <h4 className="text-xs font-bold text-text mb-2 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-text-muted" />
                        Sevkiyata Dahil Edilen Kimyasal Ürünler & Paketler ({shipment.items.length})
                      </h4>
                      <div className="overflow-x-auto border border-border rounded-xl">
                        <table className="w-full text-left text-xs text-text">
                          <thead className="bg-bg text-text-muted font-semibold border-b border-border">
                            <tr>
                              <th className="px-3.5 py-2.5">SKU Kodu</th>
                              <th className="px-3.5 py-2.5">Ürün Adı</th>
                              <th className="px-3.5 py-2.5">Paketleme Tipi</th>
                              <th className="px-3.5 py-2.5 text-right">Miktar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {shipment.items.map((item) => (
                              <tr key={item.id} className="hover:bg-surface/50">
                                <td className="px-3.5 py-2.5 font-mono text-text font-medium">{item.sku}</td>
                                <td className="px-3.5 py-2.5 font-medium text-text">{item.name}</td>
                                <td className="px-3.5 py-2.5 text-text-muted">{item.package_type}</td>
                                <td className="px-3.5 py-2.5 text-right font-bold text-text font-mono">
                                  {item.quantity} {item.unit}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Official Waybill (e-İrsaliye) Modal */}
      <WaybillModal
        isOpen={isWaybillModalOpen}
        onClose={() => setIsWaybillModalOpen(false)}
        dispatchId={selectedWaybillId}
        onCarrierUpdated={fetchShipmentsAndAlerts}
      />
    </div>
  );
};

export default Logistics;
