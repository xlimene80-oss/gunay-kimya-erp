import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Briefcase,
  Plus,
  RefreshCw,
  Search,
  Mail,
  MessageCircle,
} from 'lucide-react';

interface PurchaseRequestItem {
  id: number;
  requested_by_id?: number | null;
  item_name: string;
  quantity: number;
  unit: string;
  status: string;
  supplier_name?: string | null;
  unit_price?: number | null;
  delivery_date?: string | null;
  is_manual?: boolean | null;
  vendor_email?: string | null;
  vendor_phone?: string | null;
  notes?: string | null;
  whatsapp_url?: string | null;
  mailto_url?: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  'Taslak',
  'Onaylandı',
  'Sipariş Verildi',
  'Mal Kabul Bekliyor',
  'Tamamlandı',
  'Reddedildi'
];

export const PurchasingManagement: React.FC = () => {
  const [requests, setRequests] = useState<PurchaseRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New Request Form State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [form, setForm] = useState({
    supplier_name: 'Akdeniz Kimya Tedarik Ltd.',
    item_name: '',
    quantity: '1000',
    unit: 'kg',
    unit_price: '0.00',
    delivery_date: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
    vendor_email: 'siparis@akdenizkimya.com',
    vendor_phone: '+90 324 333 55 66',
    notes: ''
  });

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/purchasing/requests?limit=100';
      if (statusFilter !== 'ALL') {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      const res = await axios.get(url);
      setRequests(res.data || []);
    } catch (err: any) {
      console.error('Satınalma siparişleri yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post('/api/v1/purchasing/requests', {
        item_name: form.item_name.trim(),
        quantity: parseFloat(form.quantity) || 0,
        unit: form.unit,
        supplier_name: form.supplier_name.trim() || undefined,
        unit_price: parseFloat(form.unit_price) || 0,
        delivery_date: form.delivery_date ? `${form.delivery_date}T00:00:00` : undefined,
        is_manual: true,
        vendor_email: form.vendor_email.trim() || undefined,
        vendor_phone: form.vendor_phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
        status: 'Sipariş Verildi'
      });

      setIsModalOpen(false);
      setForm({
        supplier_name: 'Akdeniz Kimya Tedarik Ltd.',
        item_name: '',
        quantity: '1000',
        unit: 'kg',
        unit_price: '0.00',
        delivery_date: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
        vendor_email: 'siparis@akdenizkimya.com',
        vendor_phone: '+90 324 333 55 66',
        notes: ''
      });
      await fetchRequests();
    } catch (err: any) {
      console.error('Sipariş oluşturulamadı:', err);
      alert('Satın alma siparişi oluşturulurken hata meydana geldi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (requestId: number, newStatus: string) => {
    try {
      await axios.patch(`/api/v1/purchasing/requests/${requestId}`, {
        status: newStatus
      });
      await fetchRequests();
    } catch (err: any) {
      console.error('Durum değiştirilemedi:', err);
      alert('Durum güncellenemedi.');
    }
  };

  const filteredRequests = requests.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.item_name.toLowerCase().includes(q) ||
      (r.supplier_name || '').toLowerCase().includes(q) ||
      (r.vendor_email || '').toLowerCase().includes(q) ||
      (r.vendor_phone || '').includes(q) ||
      (r.notes || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border shadow-card">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Satın Alma Siparişleri & Mal Kabul Takibi
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Tedarikçilere manuel veya otomatik sipariş geçin, teslimat ve mal kabul durumlarını izleyin
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-primary/25 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          + Manuel Satın Alma Siparişi
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-bg border border-border rounded-xl">
            {[
              { id: 'ALL', label: 'Tümü' },
              { id: 'Taslak', label: 'Taslak' },
              { id: 'Onaylandı', label: 'Onaylandı' },
              { id: 'Sipariş Verildi', label: 'Sipariş Verildi' },
              { id: 'Mal Kabul Bekliyor', label: 'Mal Kabul Bekliyor' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === tab.id
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Malzeme / Tedarikçi Ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary transition w-44 sm:w-60"
              />
            </div>

            <button
              onClick={fetchRequests}
              className="p-2 rounded-xl bg-bg border border-border text-text hover:bg-border/40 transition"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-bg border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Sipariş No & Tarih</th>
                <th className="py-3 px-4">Tedarikçi</th>
                <th className="py-3 px-4">Malzeme / Hammadde</th>
                <th className="py-3 px-4 text-right">Miktar & Birim</th>
                <th className="py-3 px-4 text-right">Birim Fiyat</th>
                <th className="py-3 px-4">Teslim Tarihi</th>
                <th className="py-3 px-4 text-center">Durum</th>
                <th className="py-3 px-4 text-center">İletişim</th>
                <th className="py-3 px-4 text-right">Aşama Değiştir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                    Satın alma siparişleri yükleniyor...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted text-xs">
                    Kayıtlı satın alma siparişi bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-primary-soft/15 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-text">
                      <div className="flex items-center gap-1.5">
                        <span>#SAS-{req.id}</span>
                        {req.is_manual && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Manuel
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted font-normal mt-0.5">
                        {new Date(req.created_at).toLocaleDateString('tr-TR')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-xs text-text">
                      {req.supplier_name || 'Akdeniz Kimya Tedarik Ltd.'}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-text text-xs">{req.item_name}</div>
                      {req.notes && (
                        <div className="text-[11px] text-text-muted mt-0.5 italic">
                          {req.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-text text-sm">
                      {Number(req.quantity).toLocaleString('tr-TR')} <span className="text-xs font-semibold text-text-muted uppercase">{req.unit}</span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-xs text-text">
                      {req.unit_price ? `₺${Number(req.unit_price).toFixed(2)}` : '-'}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-text-muted whitespace-nowrap">
                      {req.delivery_date ? new Date(req.delivery_date).toLocaleDateString('tr-TR') : '-'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        req.status === 'Mal Kabul Bekliyor'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : req.status === 'Sipariş Verildi'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : req.status === 'Onaylandı' || req.status === 'Tamamlandı'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : req.status === 'Reddedildi'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {req.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {req.whatsapp_url ? (
                          <a
                            href={req.whatsapp_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                            title="WhatsApp Mesajı Gönder"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        ) : null}

                        {req.mailto_url ? (
                          <a
                            href={req.mailto_url}
                            className="p-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
                            title="E-Posta Gönder"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        ) : null}
                      </div>
                    </td>

                    {/* Status Select */}
                    <td className="py-3.5 px-4 text-right">
                      <select
                        value={req.status}
                        onChange={(e) => handleStatusChange(req.id, e.target.value)}
                        className="p-1.5 rounded-lg bg-bg border border-border text-xs text-text font-semibold focus:outline-none focus:border-primary"
                      >
                        {STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Manual Purchasing Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Manuel Satın Alma Siparişi
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-xl text-text-muted hover:text-text">
                <span className="text-lg font-bold">×</span>
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  Tedarikçi Firma *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Akdeniz Kimya Tedarik Ltd."
                  value={form.supplier_name}
                  onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  Malzeme / Hammadde Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Sodyum Hidroksit %48 Sıvı Kostik"
                  value={form.item_name}
                  onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    Sipariş Miktarı *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    Birim *
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="L">Litre (L)</option>
                    <option value="ton">Ton</option>
                    <option value="varil">Varil (200L)</option>
                    <option value="IBC">IBC Tank (1000L)</option>
                    <option value="adet">Adet</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    Birim Fiyat (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    Teslim Tarihi
                  </label>
                  <input
                    type="date"
                    value={form.delivery_date}
                    onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    Tedarikçi Telefon
                  </label>
                  <input
                    type="text"
                    value={form.vendor_phone}
                    onChange={(e) => setForm({ ...form, vendor_phone: e.target.value })}
                    placeholder="+90 5xx xxx xx xx"
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    Tedarikçi E-Posta
                  </label>
                  <input
                    type="email"
                    value={form.vendor_email}
                    onChange={(e) => setForm({ ...form, vendor_email: e.target.value })}
                    placeholder="siparis@tedarikci.com"
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  Sipariş / Mal Kabul Notu
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Kantar fişi, CoA ve analiz raporu talep edilir..."
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border text-text rounded-xl text-xs font-semibold hover:bg-bg transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Kaydediliyor...' : 'Siparişi Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasingManagement;
