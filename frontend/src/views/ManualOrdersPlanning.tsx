import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calendar,
  Plus,
  RefreshCw,
  Search,
  X,
  Edit2,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface CustomerSummary {
  id: number;
  code: string;
  title: string;
}

interface ProductOption {
  id: number;
  sku: string;
  name: string;
  unit: string;
  category: string;
  list_price: number;
  unit_price: number;
  b2b_price?: number | null;
  stock: number;
  rezerv_miktar: number;
  available_stock: number;
  in_stock: boolean;
}

interface OrderRowItem {
  id: string;
  item_id: number | '';
  quantity: number;
  unit_price: number;
  total_price: number;
  stock_status: 'ok' | 'insufficient' | null;
  stock_message: string;
  available_stock?: number;
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
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create Order Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderForm, setOrderForm] = useState({
    cari_id: '',
    notes: '',
    status: 'Beklemede'
  });

  // Dynamic Order Line Items
  const [orderRows, setOrderRows] = useState<OrderRowItem[]>([
    {
      id: 'row-1',
      item_id: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      stock_status: null,
      stock_message: ''
    }
  ]);

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
      const [ordersRes, carisRes, prodsRes] = await Promise.all([
        axios.get('/api/v1/orders?limit=150'),
        axios.get('/api/v1/caris/?cari_type=CUSTOMER&limit=200'),
        axios.get('/api/products').catch(() => axios.get('/api/v1/products'))
      ]);
      setOrders(ordersRes.data || []);
      setCustomers(carisRes.data || []);
      setProducts(prodsRes.data || []);
    } catch (err: any) {
      console.error('Veriler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate dynamic grand total
  const totalOrderAmount = orderRows.reduce((acc, row) => acc + (row.total_price || 0), 0);

  // Check stock on backend
  const checkStockBackend = async (itemId: number, qty: number): Promise<{ status: 'ok' | 'insufficient'; message: string; available: number }> => {
    try {
      const res = await axios.post('/api/orders/check-stock', {
        item_id: itemId,
        quantity: qty
      });
      if (res.data?.status === 'insufficient') {
        return {
          status: 'insufficient',
          message: res.data.message || 'Yetersiz stok! Eksik kalan kısım için Üretim İş Emri planlanacaktır.',
          available: Number(res.data.available ?? 0)
        };
      }
      return {
        status: 'ok',
        message: '',
        available: Number(res.data.available ?? 0)
      };
    } catch (e) {
      // Fallback local check
      const p = products.find((pr) => pr.id === itemId);
      const avail = p ? p.available_stock : 0;
      if (qty > avail) {
        return {
          status: 'insufficient',
          message: 'Yetersiz stok! Eksik kalan kısım için Üretim İş Emri planlanacaktır.',
          available: avail
        };
      }
      return { status: 'ok', message: '', available: avail };
    }
  };

  const handleProductChange = async (index: number, selectedItemId: number) => {
    const selectedProd = products.find((p) => p.id === selectedItemId);
    const price = selectedProd ? selectedProd.unit_price || selectedProd.list_price || 0 : 0;
    const qty = orderRows[index].quantity || 1;
    const total = qty * price;

    let stockInfo: { status: 'ok' | 'insufficient'; message: string; available: number } = {
      status: 'ok',
      message: '',
      available: selectedProd ? selectedProd.available_stock : 0
    };

    if (selectedItemId) {
      stockInfo = await checkStockBackend(selectedItemId, qty);
    }

    setOrderRows((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        item_id: selectedItemId || '',
        unit_price: price,
        total_price: total,
        stock_status: stockInfo.status,
        stock_message: stockInfo.message,
        available_stock: stockInfo.available
      };
      return updated;
    });
  };

  const handleQuantityChange = async (index: number, newQty: number) => {
    const safeQty = Math.max(0, newQty);
    const row = orderRows[index];
    const total = safeQty * (row.unit_price || 0);

    let stockInfo: { status: 'ok' | 'insufficient'; message: string; available: number } = {
      status: row.stock_status || 'ok',
      message: row.stock_message,
      available: row.available_stock ?? 0
    };

    if (row.item_id) {
      stockInfo = await checkStockBackend(Number(row.item_id), safeQty);
    }

    setOrderRows((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: safeQty,
        total_price: total,
        stock_status: stockInfo.status,
        stock_message: stockInfo.message,
        available_stock: stockInfo.available
      };
      return updated;
    });
  };

  const handleAddRow = () => {
    setOrderRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        item_id: '',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
        stock_status: null,
        stock_message: ''
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (orderRows.length === 1) return;
    setOrderRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.cari_id) {
      alert('Lütfen bir müşteri (Cari Kart) seçiniz.');
      return;
    }

    const validItems = orderRows
      .filter((r) => r.item_id && r.quantity > 0)
      .map((r) => ({
        item_id: Number(r.item_id),
        quantity: r.quantity,
        unit_price: r.unit_price
      }));

    if (validItems.length === 0) {
      alert('Lütfen en az bir geçerli ürün kalemi ve miktarı ekleyiniz.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/api/v1/orders', {
        cari_id: parseInt(orderForm.cari_id, 10),
        items: validItems,
        total_amount: totalOrderAmount,
        notes: orderForm.notes.trim() || undefined,
        status: orderForm.status,
        is_b2b_order: false
      });

      setIsCreateModalOpen(false);
      setOrderForm({
        cari_id: '',
        notes: '',
        status: 'Beklemede'
      });
      setOrderRows([
        {
          id: `row-${Date.now()}`,
          item_id: '',
          quantity: 1,
          unit_price: 0,
          total_price: 0,
          stock_status: null,
          stock_message: ''
        }
      ]);
      await fetchData();
    } catch (err: any) {
      console.error('Sipariş oluşturulamadı:', err);
      alert('Sipariş kaydı sırasında hata oluştu: ' + (err?.response?.data?.detail || err.message));
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
          <div
            key={col.id}
            className={`rounded-2xl border ${col.color.split(' ')[0]} bg-surface/50 p-4 flex flex-col min-h-[550px] shadow-sm`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
              <span className="text-xs font-bold text-text flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${col.id === 'Beklemede' ? 'bg-warning' : col.id === 'Onaylandı' ? 'bg-blue-500' : col.id === 'Üretimde' ? 'bg-primary' : 'bg-success'}`} />
                {col.title}
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-bg border border-border text-text-muted">
                {col.orders.length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {col.orders.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-text-muted text-xs italic">
                  Bu aşamada sipariş yok
                </div>
              ) : (
                col.orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-xl bg-surface border border-border shadow-sm hover:border-primary/40 transition group space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-primary block">
                          SIP-{ord.id}
                          {ord.is_b2b_order && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[9px] font-bold border border-purple-500/20">
                              B2B
                            </span>
                          )}
                        </span>
                        <h4 className="text-xs font-bold text-text line-clamp-1">
                          {getCustomerTitle(ord.cari_id)}
                        </h4>
                      </div>
                      <span className="text-xs font-bold font-mono text-text text-right shrink-0">
                        ₺{Number(ord.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {ord.items_summary && (
                      <p className="text-[11px] text-text-muted line-clamp-2 bg-bg/50 p-2 rounded-lg border border-border/40 font-mono">
                        {ord.items_summary}
                      </p>
                    )}

                    {/* Planning Ticket Snippet */}
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <span className="font-semibold text-text">Depo:</span>
                        <span>{ord.planning?.target_warehouse || 'Ana Depo'}</span>
                      </div>
                      <button
                        onClick={() => openPlanningModal(ord)}
                        className="px-2 py-1 rounded-lg bg-bg hover:bg-border/60 text-text font-bold border border-border flex items-center gap-1 transition text-[10px]"
                        title="Hedef Depo & Tarih Düzenle"
                      >
                        <Edit2 className="w-3 h-3 text-primary" />
                        Planla
                      </button>
                    </div>

                    {/* Quick Move Selector */}
                    <div className="pt-1 flex items-center justify-between gap-1">
                      <span className="text-[10px] text-text-muted">Aşama:</span>
                      <select
                        value={ord.status}
                        onChange={(e) => handleQuickStatusChange(ord.id, e.target.value)}
                        className="text-[10px] font-bold p-1 rounded-lg bg-bg border border-border text-text focus:outline-none focus:border-primary"
                      >
                        <option value="Beklemede">Beklemede</option>
                        <option value="Onaylandı">Onaylandı</option>
                        <option value="Üretimde">Üretimde</option>
                        <option value="Sevkiyatta">Sevkiyatta</option>
                        <option value="Tamamlandı">Tamamlandı</option>
                        <option value="İptal">İptal</option>
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
          <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Manuel Sipariş Girişi (ERP Yetkili)
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {/* Dynamic Order Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-text">
                    Sipariş Kalemleri ve Miktarları *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Yeni Kalem Ekle
                  </button>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-bg/40">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-bg border-b border-border text-[11px] font-bold text-text-muted">
                        <th className="py-2.5 px-3">Ürün Seçimi</th>
                        <th className="py-2.5 px-3 w-32">Miktar</th>
                        <th className="py-2.5 px-3 w-28 text-right">Birim Fiyat</th>
                        <th className="py-2.5 px-3 w-32 text-right">Satır Toplamı</th>
                        <th className="py-2.5 px-2 w-10 text-center">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orderRows.map((row, index) => {
                        const currentProd = products.find((p) => p.id === row.item_id);
                        return (
                          <React.Fragment key={row.id}>
                            <tr className="hover:bg-surface/50 transition">
                              <td className="p-2.5">
                                <select
                                  required
                                  value={row.item_id}
                                  onChange={(e) => handleProductChange(index, Number(e.target.value))}
                                  className="w-full p-2 rounded-lg bg-bg border border-border text-xs text-text font-semibold focus:outline-none focus:border-primary"
                                >
                                  <option value="">-- Ürün Seçiniz --</option>
                                  {products.map((prod) => (
                                    <option key={prod.id} value={prod.id}>
                                      {prod.sku} - {prod.name} ({prod.unit}) [Stok: {prod.available_stock}]
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2.5">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    step="any"
                                    required
                                    value={row.quantity || ''}
                                    onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                                    placeholder="1"
                                    className="w-full p-2 rounded-lg bg-bg border border-border text-xs text-text font-bold text-right focus:outline-none focus:border-primary font-mono"
                                  />
                                  <span className="text-[10px] text-text-muted shrink-0 w-8 truncate">
                                    {currentProd?.unit || 'Adet'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-text">
                                {row.unit_price ? row.unit_price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} TL
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-primary">
                                {row.total_price ? row.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} TL
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  disabled={orderRows.length === 1}
                                  onClick={() => handleRemoveRow(index)}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition disabled:opacity-30 disabled:pointer-events-none"
                                  title="Kalemi Sil"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                            {row.stock_status === 'insufficient' && (
                              <tr className="bg-amber-500/5">
                                <td colSpan={5} className="px-3 py-2 border-b border-amber-500/20">
                                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                                    <span>{row.stock_message || 'Yetersiz stok! Eksik kalan kısım için Üretim İş Emri planlanacaktır.'}</span>
                                    {row.available_stock !== undefined && (
                                      <span className="font-mono opacity-80">(Mevcut Serbest Stok: {row.available_stock})</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dynamic Read-only Total Amount */}
              <div>
                <label className="block text-xs font-bold text-text mb-1">Toplam Sipariş Tutarı</label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={totalOrderAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'}
                    className="w-full p-2.5 rounded-xl bg-bg/80 border border-border text-sm text-primary font-mono font-bold cursor-not-allowed select-none shadow-inner"
                  />
                </div>
                <span className="text-[10px] text-text-muted mt-1 block">
                  Tüm kalemlerin birim fiyat ve miktarlarına göre anlık hesaplanır (Salt okunur).
                </span>
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
                  className="px-4 py-2 rounded-xl bg-bg border border-border text-xs font-bold text-text hover:bg-border/40 transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
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
