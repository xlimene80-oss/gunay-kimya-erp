import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShoppingBag,
  CreditCard,
  Calendar,
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
  Lock
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
  const canTrack = hasPermission('b2b_tracking');
  const canViewStatement = hasPermission('b2b_statement');

  const [statement, setStatement] = useState<CariStatement | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderForm, setOrderForm] = useState({
    items_summary: '',
    total_amount: '',
    notes: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statementRes, ordersRes] = await Promise.all([
        axios.get('/api/v1/orders/b2b/my-cari-statement'),
        axios.get('/api/v1/orders')
      ]);
      setStatement(statementRes.data);
      setOrders(ordersRes.data || []);
    } catch (err: any) {
      console.error('B2B verileri yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateB2BOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      await axios.post('/api/v1/orders/b2b-create', {
        items_summary: orderForm.items_summary.trim(),
        total_amount: parseFloat(orderForm.total_amount) || 0,
        notes: orderForm.notes.trim() || undefined
      });

      setFormSuccess(true);
      setOrderForm({ items_summary: '', total_amount: '', notes: '' });
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
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-card hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Güncel Cari Bakiye</span>
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-black font-mono text-text">
              ₺{Number(statement?.current_balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-[11px] text-text-muted flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${statement && statement.current_balance > 0 ? 'bg-danger' : 'bg-success'}`} />
              <span>{statement && statement.current_balance > 0 ? 'Ödenmesi gereken borç bakiyesi' : 'Hesabınız dengeli/alacaklı'}</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-border shadow-card hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Açık Sipariş Tutarı</span>
              <ShoppingBag className="w-4 h-4 text-warning" />
            </div>
            <div className="text-2xl font-black font-mono text-text">
              ₺{Number(statement?.open_orders_balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-[11px] text-text-muted">
              Fabrikada onay ve üretim sürecindeki işler
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-border shadow-card hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Kredi Risk Limiti</span>
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <div className="text-2xl font-black font-mono text-text">
              ₺{Number(statement?.credit_limit || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-[11px]">
              <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-success-soft text-success border border-success-border">
                {statement?.risk_status || 'HEALTHY'}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-border shadow-card hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Ödeme Vadesi & Koşul</span>
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-black font-mono text-text">
              {statement?.payment_term_days || 30} Gün
            </div>
            <div className="mt-2 text-[11px] text-text-muted">
              Cari Kod: <span className="font-mono font-bold text-text">{statement?.code || '-'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-surface border border-border/60 text-xs text-text-muted flex items-center gap-2">
          <Lock className="w-4 h-4 text-text-muted" />
          <span>Cari Ekstre & Bakiye görüntüleme yetkiniz yönetici tarafından sınırlandırılmıştır.</span>
        </div>
      )}

      {/* Orders & Planning Section */}
      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-text flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Siparişlerim & Üretim/Sevkiyat Durumu
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Tesislerimize ilettiğiniz tüm siparişlerin güncel işleme ve depo planlama adımları
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Sipariş / Plan Kodu Ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary transition w-48 sm:w-64"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-1.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary transition"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="Beklemede">Beklemede</option>
              <option value="Onaylandı">Onaylandı</option>
              <option value="Üretimde">Üretimde</option>
              <option value="Sevkiyatta">Sevkiyatta</option>
            </select>

            <button
              onClick={fetchDashboardData}
              className="p-2 rounded-xl bg-bg border border-border text-text hover:bg-border/40 transition"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dynamic Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-bg border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Sipariş No & Tarih</th>
                <th className="py-3 px-4">Sipariş Kalemleri / Detay</th>
                <th className="py-3 px-4 text-right">Tutar (₺)</th>
                <th className="py-3 px-4 text-center">Sipariş Statüsü</th>
                <th className="py-3 px-4">İş Planlama Kodu</th>
                <th className="py-3 px-4">Hedef Depo</th>
                <th className="py-3 px-4 text-center">Plan Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                    Siparişleriniz yükleniyor...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted text-xs">
                    Kayıtlı sipariş bulunamadı. "Yeni Sipariş Ver" butonuyla ilk siparişinizi iletebilirsiniz.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-primary-soft/20 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-text">
                      <div>#ORD-{ord.id}</div>
                      <div className="text-[11px] text-text-muted font-normal mt-0.5">
                        {new Date(ord.order_date).toLocaleDateString('tr-TR')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-xs text-text font-medium whitespace-pre-wrap">
                        {ord.items_summary || 'Genel Sipariş Kalemi'}
                      </div>
                      {ord.notes && (
                        <div className="text-[11px] text-text-muted mt-1 italic">
                          Not: {ord.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-text">
                      ₺{Number(ord.total_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(ord.status)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-primary font-bold">
                      {canTrack ? ord.planning?.work_order_no || '-' : '•••'}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-text">
                      {canTrack ? ord.planning?.target_warehouse || 'Ana Depo' : '•••'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {canTrack ? (
                        ord.planning ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-bg border border-border text-text font-mono">
                            {ord.planning.status}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )
                      ) : (
                        <span className="text-text-muted text-xs italic">Takip Kapalı</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New B2B Order Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border bg-gradient-to-r from-surface via-primary-soft/10 to-surface flex items-center justify-between">
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

            <form onSubmit={handleCreateB2BOrder} className="p-5 space-y-4">
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

              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  Sipariş Verilecek Ürünler ve Miktarları *
                </label>
                <textarea
                  required
                  rows={4}
                  value={orderForm.items_summary}
                  onChange={(e) => setOrderForm({ ...orderForm, items_summary: e.target.value })}
                  placeholder="Örn:&#10;- 2000 kg Sıvı Sabun Bazı (SLES-70)&#10;- 500 kg LABSA %96&#10;- 100 Adet 5L Endüstriyel Sıvı Deterjan"
                  className="w-full p-3 rounded-xl bg-bg border border-border text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  Tahmini / Anlaşmalı Sipariş Tutarı (₺)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={orderForm.total_amount}
                  onChange={(e) => setOrderForm({ ...orderForm, total_amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-mono focus:outline-none focus:border-primary transition"
                />
                <span className="text-[10px] text-text-muted mt-1 block">
                  Birim fiyat anlaşması mevcut ise yaklaşık tutarı girebilirsiniz (isteğe bağlı).
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
