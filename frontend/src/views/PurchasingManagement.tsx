import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Briefcase,
  Plus,
  RefreshCw,
  Search,
  Mail,
  Phone,
  MessageCircle
} from 'lucide-react';

interface PurchaseRequestItem {
  id: number;
  requested_by_id?: number | null;
  item_name: string;
  quantity: number;
  unit: string;
  status: string;
  vendor_email?: string | null;
  vendor_phone?: string | null;
  notes?: string | null;
  whatsapp_url?: string | null;
  mailto_url?: string | null;
  created_at: string;
}

export const PurchasingManagement: React.FC = () => {
  const [requests, setRequests] = useState<PurchaseRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New Request Form State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [form, setForm] = useState({
    item_name: '',
    quantity: '',
    unit: 'kg',
    vendor_email: '',
    vendor_phone: '',
    notes: ''
  });

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/purchasing/requests?limit=100';
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }
      const res = await axios.get(url);
      setRequests(res.data || []);
    } catch (err: any) {
      console.error('Satınalma talepleri yüklenemedi:', err);
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
        vendor_email: form.vendor_email.trim() || undefined,
        vendor_phone: form.vendor_phone.trim() || undefined,
        notes: form.notes.trim() || undefined
      });

      setIsModalOpen(false);
      setForm({
        item_name: '',
        quantity: '',
        unit: 'kg',
        vendor_email: '',
        vendor_phone: '',
        notes: ''
      });
      await fetchRequests();
    } catch (err: any) {
      console.error('Talep oluşturulamadı:', err);
      alert('Satınalma talebi açılırken bir hata oluştu.');
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
      (r.vendor_email || '').toLowerCase().includes(q) ||
      (r.vendor_phone || '').includes(q) ||
      (r.notes || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Satınalma & İç Hammadde Talepleri
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Üretim ve depo taleplerini yönetin, tedarikçilere tek tıkla e-posta ve WhatsApp üzerinden teklif geçin
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-primary/25 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Yeni Satınalma Talebi Aç
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-bg border border-border rounded-xl">
            {[
              { id: 'ALL', label: 'Tümü' },
              { id: 'Onay Bekliyor', label: 'Onay Bekliyor' },
              { id: 'Onaylandı', label: 'Onaylandı' },
              { id: 'Satınalma Yapıldı', label: 'Satınalma Yapıldı' },
              { id: 'Reddedildi', label: 'Reddedildi' }
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
                placeholder="Hammadde / Tedarikçi Ara..."
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
                <th className="py-3 px-4">Talep No & Tarih</th>
                <th className="py-3 px-4">Talep Edilen Malzeme</th>
                <th className="py-3 px-4 text-right">Miktar & Birim</th>
                <th className="py-3 px-4">Tedarikçi İletişim</th>
                <th className="py-3 px-4 text-center">Talep Durumu</th>
                <th className="py-3 px-4 text-center">Doğrudan Teklif İletişimi</th>
                <th className="py-3 px-4 text-right">Durum Değiştir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                    Talepler yükleniyor...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted text-xs">
                    Kayıtlı satınalma talebi bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-primary-soft/15 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-text">
                      <div>#TALEP-{req.id}</div>
                      <div className="text-[11px] text-text-muted font-normal mt-0.5">
                        {new Date(req.created_at).toLocaleDateString('tr-TR')}
                      </div>
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

                    <td className="py-3.5 px-4 text-xs">
                      {req.vendor_phone && (
                        <div className="flex items-center gap-1 text-text font-mono">
                          <Phone className="w-3 h-3 text-text-muted" />
                          <span>{req.vendor_phone}</span>
                        </div>
                      )}
                      {req.vendor_email && (
                        <div className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
                          <Mail className="w-3 h-3 text-text-muted" />
                          <span>{req.vendor_email}</span>
                        </div>
                      )}
                      {!req.vendor_phone && !req.vendor_email && (
                        <span className="text-text-muted text-[11px]">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        req.status === 'Onaylandı' || req.status === 'Satınalma Yapıldı'
                          ? 'bg-success-soft text-success border border-success-border'
                          : req.status === 'Reddedildi'
                          ? 'bg-danger-soft text-danger border border-danger-border'
                          : 'bg-warning-soft text-warning border border-warning-border'
                      }`}>
                        {req.status}
                      </span>
                    </td>

                    {/* Quick WhatsApp & Email Action Buttons */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {req.whatsapp_url ? (
                          <a
                            href={req.whatsapp_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition hover:scale-105 active:scale-95"
                            title="Tedarikçiye Teklif Mesajı Gönder (WhatsApp Web)"
                          >
                            <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
                            <span>WhatsApp</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-text-muted italic">Tel Yok</span>
                        )}

                        {req.mailto_url && (
                          <a
                            href={req.mailto_url}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition hover:scale-105 active:scale-95"
                            title="Tedarikçiye Teklif E-Postası Gönder"
                          >
                            <Mail className="w-4 h-4" />
                            <span>E-Posta</span>
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Status Select */}
                    <td className="py-3.5 px-4 text-right">
                      <select
                        value={req.status}
                        onChange={(e) => handleStatusChange(req.id, e.target.value)}
                        className="p-1.5 rounded-lg bg-bg border border-border text-xs text-text font-semibold focus:outline-none focus:border-primary"
                      >
                        <option value="Onay Bekliyor">Onay Bekliyor</option>
                        <option value="Onaylandı">Onaylandı</option>
                        <option value="Satınalma Yapıldı">Satınalma Yapıldı</option>
                        <option value="Reddedildi">Reddedildi</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Yeni Satınalma / Hammadde Talep Formu
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-xl text-text-muted hover:text-text">
                <span className="text-lg font-bold">×</span>
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  Talep Edilen Hammadde / Malzeme Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Sıvı Kostik %48 (Sodyum Hidroksit)"
                  value={form.item_name}
                  onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text mb-1">Talep Miktarı *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    placeholder="1000.000"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text mb-1">Birim</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="lt">Litre (lt)</option>
                    <option value="ton">Ton</option>
                    <option value="varil">Varil</option>
                    <option value="adet">Adet</option>
                    <option value="koli">Koli</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    Tedarikçi Telefon (WhatsApp)
                  </label>
                  <input
                    type="text"
                    placeholder="0532 123 45 67"
                    value={form.vendor_phone}
                    onChange={(e) => setForm({ ...form, vendor_phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                  />
                  <span className="text-[10px] text-text-muted mt-0.5 block">WhatsApp teklif linki için</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    Tedarikçi E-Posta
                  </label>
                  <input
                    type="email"
                    placeholder="teklif@tedarikci.com"
                    value={form.vendor_email}
                    onChange={(e) => setForm({ ...form, vendor_email: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">İç Talep Notları & Termin</label>
                <textarea
                  rows={2}
                  placeholder="Üretim reçetesi ihtiyacı, aciliyet durumu veya analiz talebi..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text resize-none focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-bg border border-border text-xs font-bold text-text"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-2 shadow-sm"
                >
                  {submitting ? 'Kaydediliyor...' : 'Talebi Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
