import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calendar,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  X
} from 'lucide-react';

interface LeaveItem {
  id: number;
  personnel_id: number;
  personnel_name: string;
  department: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: string;
  notes?: string | null;
  approved_by?: string | null;
  created_at: string;
}

interface PersonnelShort {
  id: number;
  registration_no: string;
  full_name: string;
  department: string;
}

const LEAVE_TYPES = [
  'Yıllık İzin',
  'Mazeret İzni',
  'Ücretsiz İzin',
  'Sağlık Raporu',
  'Evlilik İzni',
  'Babalık / Doğum İzni'
];

export const HRLeave: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [personnelList, setPersonnelList] = useState<PersonnelShort[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    personnel_id: 0,
    leave_type: 'Yıllık İzin',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    days_count: 1,
    notes: ''
  });

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/hr/leaves';
      if (statusFilter !== 'ALL') {
        url += `?status=${encodeURIComponent(statusFilter)}`;
      }
      const res = await axios.get(url);
      setLeaves(res.data || []);
    } catch (err: any) {
      console.error('İzinler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonnel = async () => {
    try {
      const res = await axios.get('/api/v1/hr/personnel');
      setPersonnelList(res.data || []);
      if (res.data && res.data.length > 0) {
        setForm(prev => ({ ...prev, personnel_id: res.data[0].id }));
      }
    } catch (err) {
      console.error('Personel listesi alınamadı:', err);
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchPersonnel();
  }, [statusFilter]);

  const handleStatusUpdate = async (leaveId: number, newStatus: string) => {
    try {
      await axios.patch(`/api/v1/hr/leaves/${leaveId}/status?status_val=${encodeURIComponent(newStatus)}`);
      fetchLeaves();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Durum güncellenirken hata oluştu.');
    }
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personnel_id) {
      setErrorMsg('Lütfen personel seçiniz.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);

    const selectedPerson = personnelList.find(p => p.id === Number(form.personnel_id));

    try {
      await axios.post('/api/v1/hr/leaves', {
        personnel_id: Number(form.personnel_id),
        personnel_name: selectedPerson?.full_name || '',
        department: selectedPerson?.department || '',
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        days_count: Number(form.days_count),
        status: 'Talep Edildi',
        notes: form.notes.trim() || undefined
      });

      setIsModalOpen(false);
      setForm({
        personnel_id: personnelList[0]?.id || 0,
        leave_type: 'Yıllık İzin',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        days_count: 1,
        notes: ''
      });
      fetchLeaves();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'İzin talebi oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = leaves.filter(l => l.status === 'Talep Edildi').length;
  const approvedCount = leaves.filter(l => l.status === 'Onaylandı').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-800">İzin Yönetimi</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Yıllık, mazeret ve raporlu izin talepleri, onay süreçleri ve izin bakiye takibi
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={fetchLeaves}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setErrorMsg(null);
              setIsModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Yeni İzin Talebi
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Onay Bekleyen Talepler</div>
            <div className="text-xl font-bold text-amber-700">{pendingCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Onaylanan İzinler</div>
            <div className="text-xl font-bold text-emerald-700">{approvedCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Toplam Kayıt</div>
            <div className="text-xl font-bold text-slate-800">{leaves.length}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {['ALL', 'Talep Edildi', 'Onaylandı', 'Reddedildi'].map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st === 'ALL' ? 'Tümü' : st}
          </button>
        ))}
      </div>

      {/* Leaves Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Personel</th>
                <th className="px-6 py-3.5">Departman</th>
                <th className="px-6 py-3.5">İzin Tipi</th>
                <th className="px-6 py-3.5">Başlangıç / Bitiş</th>
                <th className="px-6 py-3.5">Gün</th>
                <th className="px-6 py-3.5">Açıklama</th>
                <th className="px-6 py-3.5">Durum</th>
                <th className="px-6 py-3.5 text-right">İşlem / Karar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    İzin kayıtları yükleniyor...
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    Filtreye uygun izin kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                leaves.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {item.personnel_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs">
                      {item.department}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                        {item.leave_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">
                      {item.start_date} <span className="text-slate-400">→</span> {item.end_date}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {item.days_count} gün
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                      {item.notes || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          item.status === 'Onaylandı'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.status === 'Reddedildi'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.status === 'Talep Edildi' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleStatusUpdate(item.id, 'Onaylandı')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition"
                          >
                            Onayla
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(item.id, 'Reddedildi')}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-medium transition"
                          >
                            Reddet
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {item.approved_by ? `${item.approved_by}` : 'Tamamlandı'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Leave Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg">Yeni İzin Talebi</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Personel Seçiniz *
                </label>
                <select
                  required
                  value={form.personnel_id}
                  onChange={e => setForm({ ...form, personnel_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {personnelList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.registration_no} - {p.full_name} ({p.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  İzin Tipi *
                </label>
                <select
                  value={form.leave_type}
                  onChange={e => setForm({ ...form, leave_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {LEAVE_TYPES.map(lt => (
                    <option key={lt} value={lt}>{lt}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Başlangıç Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Bitiş Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.end_date}
                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Gün Sayısı *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.days_count}
                  onChange={e => setForm({ ...form, days_count: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Gerekçe / Notlar
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="İzin gerekçesi..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
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

export default HRLeave;
