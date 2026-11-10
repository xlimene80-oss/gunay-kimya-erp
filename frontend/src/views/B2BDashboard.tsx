import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShoppingBag,
  CreditCard,
  Clock,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Package,
  Truck,
  Search,
  X,
  TrendingUp,
  ShieldCheck,
  Send,
  Lock,
  Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CariStatement {
  cari_id: number;
  company_name: string;
  code: string;
  current_balance: number;
  open_orders_balance: number;
  credit_limit: number;
  payment_term_days: number;
  risk_status: string;
  tax_number?: string;
  phone?: string;
  email?: string;
  address?: string;
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

interface OrderItem {
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
    shipment_date?: string;
  } | null;
  created_at: string;
}

export const B2BDashboard: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreateOrder = hasPermission('b2b_orders');
  const canViewStatement = hasPermission('b2b_statement');

  const [statement, setStatement] = useState<CariStatement | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderForm, setOrderForm] = useState({
    notes: ''
  });

  // Dynamic Order Line Items
  const [orderRows, setOrderRows] = useState<OrderRowItem[]>([
    {
      id: 'b2b-row-1',
      item_id: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      stock_status: null,
      stock_message: ''
    }
  ]);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statementRes, ordersRes, prodsRes] = await Promise.all([
        axios.get('/api/v1/orders/b2b/my-cari-statement'),
        axios.get('/api/v1/orders'),
        axios.get('/api/products').catch(() => axios.get('/api/v1/products'))
      ]);
      setStatement(statementRes.data);
      setOrders(ordersRes.data || []);
      setProducts(prodsRes.data || []);
    } catch (err: any) {
      console.error('B2B verileri yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
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
        id: `b2b-row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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

  const handleCreateB2BOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = orderRows
      .filter((r) => r.item_id && r.quantity > 0)
      .map((r) => ({
        item_id: Number(r.item_id),
        quantity: r.quantity,
        unit_price: r.unit_price
      }));

    if (validItems.length === 0) {
      setFormError('Lütfen en az bir geçerli ürün kalemi ve miktarı ekleyiniz.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await axios.post('/api/v1/orders/b2b-create', {
        items: validItems,
        total_amount: totalOrderAmount,
        notes: orderForm.notes.trim() || undefined
      });

      setFormSuccess(true);
      setOrderForm({ notes: '' });
      setOrderRows([
        {
          id: `b2b-row-${Date.now()}`,
          item_id: '',
          quantity: 1,
          unit_price: 0,
          total_price: 0,
          stock_status: null,
          stock_message: ''
        }
      ]);

      setTimeout(() => {
        setFormSuccess(false);
        setIsOrderModalOpen(false);
      }, 1500);

      await fetchDashboardData();
    } catch (err: any) {
      console.error('Sipariş oluşturulamadı:', err);
      setFormError(err?.response?.data?.detail || 'Sipariş iletilirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      (o.items_summary || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.planning?.work_order_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(o.id).includes(searchQuery);

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && o.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('onay') || s.includes('tamam')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-soft text-success border border-success-border">
          <CheckCircle2 className="w-3 h-3" />
          {status}
        </span>
      );
    }
    if (s.includes('üretim') || s.includes('islem')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-soft text-primary border border-primary-border">
          <RefreshCw className="w-3 h-3 animate-spin" />
          {status}
        </span>
      );
    }
    if (s.includes('sevk')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/30">
          <Truck className="w-3 h-3" />
          {status}
        </span>
      );
    }
    if (s.includes('iptal') || s.includes('red')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-danger-soft text-danger border border-danger-border">
          <AlertTriangle className="w-3 h-3" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning-soft text-warning border border-warning-border">
        <Clock className="w-3 h-3" />
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner / Corporate Hero */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-navy via-brand-navy-dark to-surface border border-border shadow-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-white border border-primary-border">
              B2B Müşteri & Bayi Portalı
            </span>
            <span className="text-xs text-text-muted flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-success" /> Güvenli İzole Oturum
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {statement?.company_name || 'B2B Müşteri Paneli'}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Günay Kimya tesislerinden siparişlerinizi verebilir, canlı üretim ve sevkiyat planlamalarınızı anlık olarak takip edebilirsiniz.
          </p>
        </div>

        {canCreateOrder ? (
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm flex items-center gap-2 shadow-lg hover:shadow-primary/25 transition shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Yeni Sipariş Ver
          </button>
        ) : (
          <div className="px-4 py-2.5 rounded-xl bg-surface/50 border border-border/40 text-text-muted text-xs font-semibold flex items-center gap-1.5 shrink-0">
            <Lock className="w-3.5 h-3.5" />
            <span>Sipariş Verme Yetkiniz Kapalı</span>
          </div>
        )}
      </div>

      {/* Financial Health & Risk Overview Cards */}
      {canViewStatement ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-text-muted font-semibold block mb-1">Cari Bakiye Durumu</span>
              <span className={`text-xl font-bold font-mono ${(statement?.current_balance || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                ₺{Number(statement?.current_balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">
                {(statement?.current_balance || 0) > 0 ? 'Ödenmesi Gereken Borç' : 'Alacaklı / Açık Hesap'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary-soft flex items-center justify-center text-primary">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-text-muted font-semibold block mb-1">Açık Siparişler Tutarı</span>
              <span className="text-xl font-bold font-mono text-warning">
                ₺{Number(statement?.open_orders_balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Fabrika onay / üretim aşamasında</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-warning-soft flex items-center justify-center text-warning">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-text-muted font-semibold block mb-1">Tahsis Edilen Kredi Limiti</span>
              <span className="text-xl font-bold font-mono text-text">
                ₺{Number(statement?.credit_limit || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">
                Vade: {statement?.payment_term_days || 30} Gün
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-text-muted">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-text-muted font-semibold block mb-1">Ticari Risk Statüsü</span>
              <span className="text-base font-bold text-success flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {statement?.risk_status || 'HEALTHY'}
              </span>
              <span className="text-[10px] text-text-muted block mt-0.5">Sipariş kabulüne uygun</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-success-soft flex items-center justify-center text-success">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-surface border border-border text-xs text-text-muted flex items-center gap-2">
          <Lock className="w-4 h-4 text-warning" />
          <span>Finansal ekstre ve bakiye özetini görüntüleme yetkiniz kısıtlanmıştır.</span>
        </div>
      )}

      {/* Orders Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-border shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'Beklemede', 'Onaylandı', 'Üretimde', 'Sevkiyatta'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-bg text-text-muted hover:text-text border border-border'
              }`}
            >
              {st === 'ALL' ? 'Tüm Siparişler' : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Sipariş no, ürün veya not ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-bg border border-border text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition"
            />
          </div>

          <button
            onClick={fetchDashboardData}
            className="p-2 rounded-xl bg-bg border border-border text-text hover:bg-border/50 transition"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Order List Table */}
      <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-text">Sipariş & Sevkiyat Geçmişi</h3>
          </div>
          <span className="text-xs text-text-muted font-mono">{filteredOrders.length} Kayıt</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-bg/50 text-[11px] font-bold text-text-muted">
                <th className="py-3 px-4">Sipariş No</th>
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4">Sipariş Kalemleri / Detay</th>
                <th className="py-3 px-4">İş Planlama Kodu</th>
                <th className="py-3 px-4 text-right">Toplam Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    Kriterlere uygun sipariş bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-bg/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      SIP-{ord.id}
                    </td>
                    <td className="py-3.5 px-4 text-text-muted">
                      {ord.created_at ? new Date(ord.created_at).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(ord.status)}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-text font-medium" title={ord.items_summary || ''}>
                      {ord.items_summary || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      {ord.planning?.work_order_no ? (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-bg border border-border text-primary font-bold">
                          {ord.planning.work_order_no}
                        </span>
                      ) : (
                        <span className="text-text-muted italic">Planlanıyor</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-text">
                      ₺{Number(ord.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New B2B Order Modal with Dynamic Line Items Table */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-border bg-gradient-to-r from-surface via-primary-soft/10 to-surface flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">Yeni B2B Sipariş Talebi</h3>
                  <span className="text-xs text-text-muted">{statement?.company_name}</span>
                </div>
              </div>
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-bg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateB2BOrder} className="p-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-danger-soft border border-danger-border text-danger text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-success-soft border border-success-border text-success text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Siparişiniz fabrikamıza başarıyla iletildi!</span>
                </div>
              )}

              {/* Dynamic Order Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-text">
                    Sipariş Edilecek Ürünler ve Miktarları *
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

                {/* Masaüstü Tablo Görünümü (>= md) */}
                <div className="hidden md:block border border-border rounded-xl overflow-hidden bg-bg/40">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-bg border-b border-border text-[11px] font-bold text-text-muted">
                        <th className="py-2.5 px-3">Ürün Seçimi</th>
                        <th className="py-2.5 px-3 w-32">Miktar</th>
                        <th className="py-2.5 px-3 w-28 text-right">Bayi Fiyatı</th>
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
                                      {prod.sku} - {prod.name} ({prod.unit}) - {prod.unit_price} TL [Stok: {prod.available_stock}]
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

                {/* Mobil Kart Görünümü (< md) */}
                <div className="md:hidden space-y-3">
                  {orderRows.map((row, index) => {
                    const currentProd = products.find((p) => p.id === row.item_id);
                    return (
                      <div
                        key={row.id}
                        className="flex flex-col space-y-3 p-3.5 bg-gray-50 dark:bg-surface border border-gray-200 dark:border-border rounded-xl relative shadow-sm"
                      >
                        {/* Üst Başlık ve Silme Butonu */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-text-muted">
                            Kalem #{index + 1}
                          </span>
                          <button
                            type="button"
                            disabled={orderRows.length === 1}
                            onClick={() => handleRemoveRow(index)}
                            className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition disabled:opacity-30 disabled:pointer-events-none"
                            title="Kalemi Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Ürün Seçimi - Tam Genişlik */}
                        <div>
                          <label className="block text-[11px] font-bold text-text-muted mb-1">
                            Ürün Seçimi
                          </label>
                          <select
                            required
                            value={row.item_id}
                            onChange={(e) => handleProductChange(index, Number(e.target.value))}
                            className="w-full p-2.5 rounded-lg bg-white dark:bg-bg border border-gray-200 dark:border-border text-xs text-text font-semibold focus:outline-none focus:border-primary shadow-sm"
                          >
                            <option value="">-- Ürün Seçiniz --</option>
                            {products.map((prod) => (
                              <option key={prod.id} value={prod.id}>
                                {prod.sku} - {prod.name} ({prod.unit}) - {prod.unit_price} TL [Stok: {prod.available_stock}]
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Miktar ve Birim */}
                        <div>
                          <label className="block text-[11px] font-bold text-text-muted mb-1">
                            Miktar ({currentProd?.unit || 'Adet'})
                          </label>
                          <div className="flex items-center space-x-2 w-full">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              required
                              value={row.quantity || ''}
                              onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                              placeholder="1"
                              className="flex-1 p-2.5 rounded-lg bg-white dark:bg-bg border border-gray-200 dark:border-border text-xs text-text font-bold text-right focus:outline-none focus:border-primary font-mono shadow-sm"
                            />
                            <span className="px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-bg/80 border border-gray-200 dark:border-border text-xs font-semibold text-text-muted shrink-0 min-w-16 text-center">
                              {currentProd?.unit || 'Adet'}
                            </span>
                          </div>
                        </div>

                        {/* Fiyat ve Satır Toplamı Rozetleri */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-border text-xs">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-text-muted font-medium">Bayi Fiyatı</span>
                            <span className="inline-flex items-center px-2 py-0.5 mt-0.5 rounded-md font-mono font-bold text-text bg-gray-100 dark:bg-bg/80 border border-gray-200 dark:border-border">
                              {row.unit_price ? row.unit_price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} TL
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-text-muted font-medium">Satır Toplamı</span>
                            <span className="inline-flex items-center px-2.5 py-0.5 mt-0.5 rounded-md font-mono font-bold text-primary bg-primary/10 border border-primary/20">
                              {row.total_price ? row.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} TL
                            </span>
                          </div>
                        </div>

                        {/* Yetersiz Stok Uyarısı */}
                        {row.stock_status === 'insufficient' && (
                          <div className="p-2.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                            <div className="flex flex-col gap-0.5">
                              <span>{row.stock_message || 'Yetersiz stok! Eksik kalan kısım için Üretim İş Emri planlanacaktır.'}</span>
                              {row.available_stock !== undefined && (
                                <span className="font-mono text-[11px] opacity-85">(Mevcut Serbest Stok: {row.available_stock})</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Read-only Total Amount */}
              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  Toplam Sipariş Tutarı
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={totalOrderAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'}
                    className="w-full p-2.5 rounded-xl bg-bg/80 border border-border text-sm text-primary font-mono font-bold cursor-not-allowed select-none shadow-inner"
                  />
                </div>
                <span className="text-[10px] text-text-muted mt-1 block">
                  Bayinize tanımlı özel birim fiyatlar ve girilen miktarlara göre otomatik hesaplanır (Salt okunur).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  Sevkiyat & Teslimat Notları (İsteğe Bağlı)
                </label>
                <textarea
                  rows={2}
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  placeholder="Örn: Fabrika deposuna Cuma günü teslimat rica ediyoruz..."
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-primary-soft/30 border border-primary-border/40 text-[11px] text-text-muted">
                <span className="font-bold text-text block mb-0.5">Otomatik Güvenlik & Planlama:</span>
                Siparişiniz otomatik olarak cari hesabınıza bağlanacak ve Günay Kimya fabrika üretim planlama havuzuna anında iş emri olarak aktarılacaktır.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-bg border border-border text-xs font-bold text-text hover:bg-border/50 transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting || formSuccess}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-2 transition disabled:opacity-50 shadow-md"
                >
                  {submitting ? 'İletiliyor...' : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Siparişi Onayla ve Gönder
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
