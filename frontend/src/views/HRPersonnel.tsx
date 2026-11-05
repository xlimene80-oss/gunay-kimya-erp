import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Phone,
  Mail,
  X,
  Edit2
} from 'lucide-react';

interface PersonnelItem {
  id: number;
  registration_no: string;
  full_name: string;
  department: string;
  title: string;
  hire_date: string;
  status: string;
  phone?: string | null;
  email?: string | null;
  salary_note?: string | null;
  user_id?: number | null;
  created_at: string;
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

export const HRPersonnel: React.FC = () => {
  const [personnelList, setPersonnelList] = useState<PersonnelItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<PersonnelItem | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    registration_no: '',
    full_name: '',
    department: 'Üretim',
    title: '',
    hire_date: new Date().toISOString().split('T')[0],
    status: 'Aktif',
    phone: '',
    email: '',
    salary_note: ''
  });

  const fetchPersonnel = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/hr/personnel';
      const params = new URLSearchParams();
      if (selectedDept !== 'ALL') params.append('department', selectedDept);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axios.get(url);
      setPersonnelList(res.data || []);
    } catch (err: any) {
      console.error('Personel listesi yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonnel();
  }, [selectedDept, selectedStatus]);

  const openAddModal = () => {
    setIsEditing(false);
    setActiveItem(null);
    setForm({
      registration_no: `GK-00${personnelList.length + 1}`,
      full_name: '',
      department: 'Üretim',
      title: '',
      hire_date: new Date().toISOString().split('T')[0],
      status: 'Aktif',
      phone: '',
      email: '',
      salary_note: ''
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: PersonnelItem) => {
    setIsEditing(true);
    setActiveItem(p);
    setForm({
      registration_no: p.registration_no,
      full_name: p.full_name,
      department: p.department,
      title: p.title,
      hire_date: p.hire_date,
      status: p.status,
      phone: p.phone || '',
      email: p.email || '',
      salary_note: p.salary_note || ''
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (isEditing && activeItem) {
        await axios.patch(`/api/v1/hr/personnel/${activeItem.id}`, {
          full_name: form.full_name.trim(),
          department: form.department,
          title: form.title.trim(),
          status: form.status,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          salary_note: form.salary_note.trim() || undefined
        });
      } else {
        await axios.post('/api/v1/hr/personnel', {
          registration_no: form.registration_no.trim(),
          full_name: form.full_name.trim(),
          department: form.department,
          title: form.title.trim(),
          hire_date: form.hire_date,
          status: form.status,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          salary_note: form.salary_note.trim() || undefined
        });
      }
      setIsModalOpen(false);
      fetchPersonnel();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Personel işlemi sırasında hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredList = personnelList.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.registration_no.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-800">Personel Yönetimi</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Şirket içi çalışan kadrosu, sicil kartları, departman atamaları ve durum takibi
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={fetchPersonnel}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openAddModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Yeni Personel Ekle
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Toplam Personel</div>
            <div className="text-xl font-bold text-slate-800">{personnelList.length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Aktif Çalışan</div>
            <div className="text-xl font-bold text-emerald-700">
              {personnelList.filter(p => p.status === 'Aktif').length}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Taslak / Mülakat</div>
            <div className="text-xl font-bold text-amber-700">
              {personnelList.filter(p => p.status.includes('Taslak')).length}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
            <Building2Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Departman Sayısı</div>
            <div className="text-xl font-bold text-slate-800">
              {new Set(personnelList.map(p => p.department)).size}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Ad Soyad, Sicil No veya Unvan ile ara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Tüm Departmanlar</option>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Tüm Durumlar</option>
            <option value="Aktif">Aktif</option>
            <option value="Ayrıldı">Ayrıldı</option>
            <option value="Taslak (Mülakat Onaylı)">Taslak (Mülakat Onaylı)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Sicil No</th>
                <th className="px-6 py-3.5">Ad Soyad</th>
                <th className="px-6 py-3.5">Departman</th>
                <th className="px-6 py-3.5">Unvan</th>
                <th className="px-6 py-3.5">İşe Giriş</th>
                <th className="px-6 py-3.5">İletişim</th>
                <th className="px-6 py-3.5">Durum</th>
                <th className="px-6 py-3.5 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Personel verileri yükleniyor...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    Kayıtlı personel bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredList.map(person => (
                  <tr key={person.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">
                      {person.registration_no}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {person.full_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {person.department}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {person.title}
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {person.hire_date}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 space-y-0.5">
                      {person.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{person.phone}</span>
                        </div>
                      )}
                      {person.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{person.email}</span>
                        </div>
                      )}
                      {!person.phone && !person.email && <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          person.status === 'Aktif'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : person.status.includes('Taslak')
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {person.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(person)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Düzenle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg">
                {isEditing ? 'Personel Kartını Düzenle' : 'Yeni Personel Kartı'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Sicil No *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={form.registration_no}
                    onChange={e => setForm({ ...form, registration_no: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Durum *
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Ayrıldı">Ayrıldı</option>
                    <option value="Taslak (Mülakat Onaylı)">Taslak (Mülakat Onaylı)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Ad Soyad *
                </label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Örn: Ayşe Yılmaz"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Departman *
                  </label>
                  <select
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Unvan *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Örn: Proses Kimyageri"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    İşe Giriş Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.hire_date}
                    onChange={e => setForm({ ...form, hire_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Telefon
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+90 5xx xxx xx xx"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  E-posta
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="ornek@gunaykimya.com"
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
                  {submitting ? 'Kaydediliyor...' : isEditing ? 'Güncelle' : 'Personel Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function Building2Icon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}
export default HRPersonnel;
