import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calendar,
  Plus,
  RefreshCw,
  Search,
  X,
  Edit2
} from 'lucide-react';

interface CustomerSummary {
  id: number;
  code: string;
  title: string;
}

interface OrderPlanningItem {
  id: number;
  cari_id: number;
  order_date: string;
  status: string;
  is_b2b_order: boolean;
  total_amount: number;
  items_summary?: string;
  notes?: string;
  planning?: {
    id: number;
    work_order_no: string;
    target_warehouse: string;
    status: string;
    shipment_date?: string | null;
    notes?: string | null;
  } | null;
}

export const ManualOrdersPlanning: React.FC = () => {
  const [orders, setOrders] = useState<OrderPlanningItem[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create Order Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderForm, setOrderForm] = useState({
    cari_id: '',
    items_summary: '',
    total_amount: '',
    notes: '',
    status: 'Beklemede'
  });

  // Edit Planning Modal State
  const [activePlanningOrder, setActivePlanningOrder] = useState<OrderPlanningItem | null>(null);
  const [planningForm, setPlanningForm] = useState({
    target_warehouse: 'Ana Depo',
    shipment_date: '',
    status: 'Planlandı',
    notes: ''
  });
  const [savingPlan, setSavingPlan] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, carisRes] = await Promise.all([
        axios.get('/api/v1/orders?limit=150'),
        axios.get('/api/v1/caris/?cari_type=CUSTOMER&limit=200')
      ]);
      setOrders(ordersRes.data || []);
      setCustomers(carisRes.data || []);
    } catch (err: any) {
      console.error('Veriler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.cari_id) {
      alert('Lütfen bir müşteri (Cari Kart) seçiniz.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/api/v1/orders', {
        cari_id: parseInt(orderForm.cari_id, 10),
        items_summary: orderForm.items_summary.trim(),
        total_amount: parseFloat(orderForm.total_amount) || 0,
        notes: orderForm.notes.trim() || undefined,
        status: orderForm.status,
        is_b2b_order: false
      });

      setIsCreateModalOpen(false);
      setOrderForm({
        cari_id: '',
        items_summary: '',
        total_amount: '',
        notes: '',
        status: 'Beklemede'
      });
      await fetchData();
    } catch (err: any) {
      console.error('Sipariş oluşturulamadı:', err);
      alert('Sipariş kaydı sırasında hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePlanning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlanningOrder) return;

    setSavingPlan(true);
    try {
      await axios.patch(`/api/v1/orders/${activePlanningOrder.id}/planning`, {
        target_warehouse: planningForm.target_warehouse,
        shipment_date: planningForm.shipment_date ? new Date(planningForm.shipment_date).toISOString() : undefined,
        status: planningForm.status,
        notes: planningForm.notes.trim() || undefined
      });

      setActivePlanningOrder(null);
      await fetchData();
    } catch (err: any) {
      console.error('Planlama güncellenemedi:', err);
      alert('Planlama kaydı güncellenirken hata oluştu.');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleQuickStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await axios.patch(`/api/v1/orders/${orderId}`, { status: newStatus });
      await fetchData();
    } catch (err: any) {
      console.error('Durum değiştirilemedi:', err);
    }
  };

  const openPlanningModal = (order: OrderPlanningItem) => {
    setActivePlanningOrder(order);
    setPlanningForm({
      target_warehouse: order.planning?.target_warehouse || 'Ana Depo',
      shipment_date: order.planning?.shipment_date ? order.planning.shipment_date.split('T')[0] : '',
      status: order.planning?.status || 'Planlandı',
      notes: order.planning?.notes || ''
    });
  };

  const getCustomerTitle = (cariId: number) => {
    const cust = customers.find((c) => c.id === cariId);
    return cust ? `${cust.title} (${cust.code})` : `Cari #${cariId}`;
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const custTitle = getCustomerTitle(o.cari_id).toLowerCase();
    return (
      custTitle.includes(q) ||
      (o.items_summary || '').toLowerCase().includes(q) ||
      (o.planning?.work_order_no || '').toLowerCase().includes(q) ||
      String(o.id).includes(q)
    );
  });

  // Group orders into 4 Kanban stages
  const kanbanColumns = [
    {
      id: 'Beklemede',
      title: '1. Beklemede / Yeni Sipariş',
      color: 'border-warning/50 bg-warning/5 text-warning',
      orders: filteredOrders.filter((o) => o.status.toLowerCase() === 'beklemede')
    },
    {
      id: 'Onaylandı',
      title: '2. Onaylandı & Planlandı',
      color: 'border-blue-500/50 bg-blue-500/5 text-blue-500',
      orders: filteredOrders.filter((o) => o.status.toLowerCase() === 'onaylandı' || o.status.toLowerCase() === 'onaylandi')
    },
    {
      id: 'Üretimde',
      title: '3. Üretimde / Hazırlanıyor',
      color: 'border-primary/50 bg-primary/5 text-primary',
      orders: filteredOrders.filter((o) => o.status.toLowerCase() === 'üretimde' || o.status.toLowerCase() === 'uretimde')
    },
    {
      id: 'Sevkiyatta',
      title: '4. Sevkiyatta / Tamamlandı',
      color: 'border-success/50 bg-success/5 text-success',
      orders: filteredOrders.filter((o) => o.status.toLowerCase() === 'sevkiyatta' || o.status.toLowerCase() === 'tamamlandı' || o.status.toLowerCase() === 'tamamlandi')
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Manuel Sipariş Girişi & Üretim/Planlama Takvimi
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Admin ve şirket çalışanları için sipariş açma, hedef depo sevkiyat tahsisi ve Kanban akışı
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Sipariş / Cari Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary transition w-44 sm:w-56"
            />
          </div>

          <button
            onClick={fetchData}
            className="p-2 rounded-xl bg-bg border border-border text-text hover:bg-border/40 transition"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-primary/25 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            Yeni Sipariş Oluştur
          </button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kanbanColumns.map((col) => (
          <div key={col.id} className="flex flex-col rounded-2xl bg-surface border border-border shadow-card overflow-hidden">
            {/* Column Header */}
            <div className={`p-3.5 border-b border-border flex items-center justify-between ${col.color}`}>
              <h3 className="text-xs font-extrabold uppercase tracking-wider">{col.title}</h3>
              <span className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center font-bold text-xs text-text shadow-sm">
                {col.orders.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[420px] bg-bg/40">
              {col.orders.length === 0 ? (
                <div className="h-36 flex items-center justify-center text-[11px] text-text-muted italic border border-dashed border-border rounded-xl">
                  Bu aşamada sipariş yok
                </div>
              ) : (
                col.orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 rounded-xl bg-surface border border-border shadow-sm hover:border-primary/40 transition space-y-2.5"
                  >
                    {/* Card Top */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-primary">
                        #ORD-{ord.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ord.is_b2b_order ? 'bg-primary-soft text-primary' : 'bg-bg text-text-muted'
                      }`}>
                        {ord.is_b2b_order ? 'B2B Portal' : 'Manuel ERP'}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="text-xs font-bold text-text truncate">
                      {getCustomerTitle(ord.cari_id)}
                    </div>

                    {/* Items Summary */}
                    <div className="text-[11px] text-text-muted bg-bg p-2 rounded-lg line-clamp-2">
                      {ord.items_summary || 'Kalem detayı girilmemiş'}
                    </div>

                    {/* Amount & Date */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                      <span className="text-[10px] text-text-muted font-mono">
                        {new Date(ord.order_date).toLocaleDateString('tr-TR')}
                      </span>
                      <span className="font-mono font-bold text-text">
                        ₺{Number(ord.total_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Planning Block */}
                    {ord.planning && (
                      <div className="p-2 rounded-lg bg-primary-soft/20 border border-primary-border/30 text-[10px] space-y-1">
                        <div className="flex items-center justify-between font-mono font-bold text-primary">
                          <span>{ord.planning.work_order_no}</span>
                          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-surface border border-primary-border">
                            {ord.planning.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-text-muted">
                          <span>Depo: <strong className="text-text">{ord.planning.target_warehouse}</strong></span>
                          {ord.planning.shipment_date && (
                            <span>Sevk: {new Date(ord.planning.shipment_date).toLocaleDateString('tr-TR')}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <button
                        onClick={() => openPlanningModal(ord)}
                        className="p-1.5 rounded-lg bg-bg border border-border hover:border-primary text-text text-[11px] font-semibold flex items-center gap-1 transition"
                        title="İş Planlama ve Depo Detayları"
                      >
                        <Edit2 className="w-3 h-3 text-primary" />
                        <span>Planla</span>
                      </button>

                      {/* Quick Move Select */}
                      <select
                        value={ord.status}
                        onChange={(e) => handleQuickStatusChange(ord.id, e.target.value)}
                        className="p-1 rounded-lg bg-bg border border-border text-[10px] font-bold text-text focus:outline-none focus:border-primary"
                      >
                        <option value="Beklemede">Beklemede</option>
                        <option value="Onaylandı">Onaylandı</option>
                        <option value="Üretimde">Üretimde</option>
                        <option value="Sevkiyatta">Sevkiyatta</option>
                        <option value="Tamamlandı">Tamamlandı</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Manual Order Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Manuel Sipariş Girişi (ERP Yetkili)
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text mb-1">Müşteri / Cari Kart Seçimi *</label>
                <select
                  required
                  value={orderForm.cari_id}
                  onChange={(e) => setOrderForm({ ...orderForm, cari_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-bold focus:outline-none focus:border-primary"
                >
                  <option value="">-- Müşteri Seçiniz --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  Sipariş Kalemleri ve Miktarları *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Örn: 5000 kg Sıvı Kostik %48, 1000 kg SLES, 500 adet 5L Bidon..."
                  value={orderForm.items_summary}
                  onChange={(e) => setOrderForm({ ...orderForm, items_summary: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text resize-none focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text mb-1">Toplam Tutar (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={orderForm.total_amount}
                    onChange={(e) => setOrderForm({ ...orderForm, total_amount: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text mb-1">Başlangıç Statüsü</label>
                  <select
                    value={orderForm.status}
                    onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="Beklemede">Beklemede</option>
                    <option value="Onaylandı">Onaylandı</option>
                    <option value="Üretimde">Üretimde</option>
                    <option value="Sevkiyatta">Sevkiyatta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Sipariş Notları</label>
                <textarea
                  rows={2}
                  placeholder="Özel sevkiyat talimatı, araç plakası veya analiz istekleri..."
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text resize-none focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-bg border border-border text-xs font-bold text-text"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm"
                >
                  {submitting ? 'Kaydediliyor...' : 'Siparişi Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Planning Ticket Modal */}
      {activePlanningOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" />
                Üretim & Sevkiyat Planlaması Düzenle
              </h3>
              <button onClick={() => setActivePlanningOrder(null)} className="p-1 text-text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlanning} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-bg border border-border text-xs space-y-1">
                <span className="font-mono font-bold text-primary block">
                  İş Planlama Kodu: {activePlanningOrder.planning?.work_order_no || 'Atanacak'}
                </span>
                <span className="text-text block font-bold">
                  {getCustomerTitle(activePlanningOrder.cari_id)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Hedef Depo Tahsisi</label>
                <select
                  value={planningForm.target_warehouse}
                  onChange={(e) => setPlanningForm({ ...planningForm, target_warehouse: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-bold focus:outline-none focus:border-primary"
                >
                  <option value="Ana Depo">Ana Depo (Genel Stok)</option>
                  <option value="Likit Hammadde Deposu">Likit Hammadde Deposu</option>
                  <option value="Mamul Ürün Deposu">Mamul Ürün Deposu</option>
                  <option value="Tehlikeli Madde (Hazmat) Deposu">Tehlikeli Madde (Hazmat) Deposu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Tahmini Sevkiyat / Hazırlık Tarihi</label>
                <input
                  type="date"
                  value={planningForm.shipment_date}
                  onChange={(e) => setPlanningForm({ ...planningForm, shipment_date: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Planlama Durumu</label>
                <select
                  value={planningForm.status}
                  onChange={(e) => setPlanningForm({ ...planningForm, status: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-bold focus:outline-none focus:border-primary"
                >
                  <option value="Planlandı">Planlandı</option>
                  <option value="İşleme Alındı">İşleme Alındı</option>
                  <option value="Üretimde">Üretimde</option>
                  <option value="Tamamlandı">Tamamlandı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Planlama Notu</label>
                <textarea
                  rows={2}
                  placeholder="Lojistik veya üretim hattı notu..."
                  value={planningForm.notes}
                  onChange={(e) => setPlanningForm({ ...planningForm, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text resize-none focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActivePlanningOrder(null)}
                  className="px-4 py-2 rounded-xl bg-bg border border-border text-xs font-bold text-text"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm"
                >
                  {savingPlan ? 'Güncelleniyor...' : 'Planı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
