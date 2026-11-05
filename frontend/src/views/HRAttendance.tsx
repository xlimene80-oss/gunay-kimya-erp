import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Clock,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  X
} from 'lucide-react';

interface AttendanceItem {
  id: number;
  personnel_id: number;
  personnel_name: string;
  department: string;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  overtime_hours: number;
  status: string;
  notes?: string | null;
}

interface PersonnelShort {
  id: number;
  registration_no: string;
  full_name: string;
  department: string;
}

const DEPARTMENTS = [
  'Üretim',
  'Satış',
  'Satın Alma',
  'Depo',
  'Muhasebe',
  'İK',
  'Kalite',
  'Yönetim'
];

export const HRAttendance: React.FC = () => {
  const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-11"
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [attendances, setAttendances] = useState<AttendanceItem[]>([]);
  const [personnelList, setPersonnelList] = useState<PersonnelShort[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    personnel_id: 0,
    date: new Date().toISOString().split('T')[0],
    check_in: '08:00',
    check_out: '17:00',
    overtime_hours: 0,
    status: 'Geldi',
    notes: ''
  });

  const fetchAttendances = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/hr/attendances';
      const params = new URLSearchParams();
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedDept !== 'ALL') params.append('department', selectedDept);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axios.get(url);
      setAttendances(res.data || []);
    } catch (err: any) {
      console.error('Puantaj verileri yüklenemedi:', err);
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
    fetchAttendances();
    fetchPersonnel();
  }, [selectedMonth, selectedDept, selectedStatus]);

  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personnel_id) {
      setErrorMsg('Lütfen personel seçiniz.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);

    const person = personnelList.find(p => p.id === Number(form.personnel_id));

    try {
      await axios.post('/api/v1/hr/attendances', {
        personnel_id: Number(form.personnel_id),
        personnel_name: person?.full_name || '',
        department: person?.department || '',
        date: form.date,
        check_in: form.status === 'Geldi' ? form.check_in : undefined,
        check_out: form.status === 'Geldi' ? form.check_out : undefined,
        overtime_hours: Number(form.overtime_hours) || 0,
        status: form.status,
        notes: form.notes.trim() || undefined
      });

      setIsModalOpen(false);
      fetchAttendances();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Puantaj kaydı oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const geldiCount = attendances.filter(a => a.status === 'Geldi').length;
  const izinliCount = attendances.filter(a => a.status === 'İzinli' || a.status === 'Raporlu').length;
  const devamsizCount = attendances.filter(a => a.status === 'Devamsız').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-800">Puantaj & Mesai Takibi</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Personel günlük giriş-çıkış saatleri, mesai süreleri, devamsızlık ve izin takvimi
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={fetchAttendances}
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
            Puantaj Girişi Yap
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Puantaj Kaydı</div>
            <div className="text-xl font-bold text-slate-800">{attendances.length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Geldi / Çalıştı</div>
            <div className="text-xl font-bold text-emerald-700">{geldiCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">İzinli / Raporlu</div>
            <div className="text-xl font-bold text-amber-700">{izinliCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Devamsız</div>
            <div className="text-xl font-bold text-rose-700">{devamsizCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            Ay Seçimi:
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Tüm Departmanlar</option>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Tüm Durumlar</option>
            <option value="Geldi">Geldi</option>
            <option value="İzinli">İzinli</option>
            <option value="Raporlu">Raporlu</option>
            <option value="Devamsız">Devamsız</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Tarih</th>
                <th className="px-6 py-3.5">Personel</th>
                <th className="px-6 py-3.5">Departman</th>
                <th className="px-6 py-3.5">Giriş Saati</th>
                <th className="px-6 py-3.5">Çıkış Saati</th>
                <th className="px-6 py-3.5">Fazla Mesai</th>
                <th className="px-6 py-3.5">Durum</th>
                <th className="px-6 py-3.5">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Puantaj kayıtları yükleniyor...
                  </td>
                </tr>
              ) : attendances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    Seçili ay ve kriterlere uygun puantaj bulunamadı.
                  </td>
                </tr>
              ) : (
                attendances.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-mono text-slate-900 whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {row.personnel_name}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {row.department}
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-mono">
                      {row.check_in || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-mono">
                      {row.check_out || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {row.overtime_hours > 0 ? (
                        <span className="font-semibold text-indigo-600">
                          +{row.overtime_hours} saat
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          row.status === 'Geldi'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : row.status === 'İzinli' || row.status === 'Raporlu'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                      {row.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Attendance Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg">Günlük Puantaj Girişi</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAttendance} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircleIcon className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Personel *
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tarih *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Durum *
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Geldi">Geldi</option>
                    <option value="İzinli">İzinli</option>
                    <option value="Raporlu">Raporlu</option>
                    <option value="Devamsız">Devamsız</option>
                  </select>
                </div>
              </div>

              {form.status === 'Geldi' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Giriş
                    </label>
                    <input
                      type="time"
                      value={form.check_in}
                      onChange={e => setForm({ ...form, check_in: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Çıkış
                    </label>
                    <input
                      type="time"
                      value={form.check_out}
                      onChange={e => setForm({ ...form, check_out: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Mesai (Saat)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={form.overtime_hours}
                      onChange={e => setForm({ ...form, overtime_hours: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Açıklama / Not
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Opsiyonel vardiya veya mesai notu..."
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
                  {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function AlertCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export default HRAttendance;
