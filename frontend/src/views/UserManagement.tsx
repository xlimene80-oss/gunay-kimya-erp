import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Power,
  CheckCircle2,
  AlertTriangle,
  X,
  Filter,
  Shield,
  Building2,
  Globe,
  Briefcase,
  KeyRound,
  Mail,
  UserCheck,
  UserX,
  Check,
  Sliders,
  ShieldCheck
} from 'lucide-react';

interface UserRecord {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'staff' | 'customer';
  is_active: boolean;
  cari_id?: number | null;
  cari_title?: string | null;
  cari_code?: string | null;
  roles: string[];
  created_at: string;
  permissions?: Record<string, boolean>;
  effective_permissions?: Record<string, boolean>;
}

interface CariOption {
  id: number;
  code: string;
  title: string;
  tax_number?: string;
  phone?: string;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [caris, setCaris] = useState<CariOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State - User Create
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'STAFF' | 'CUSTOMER'>('STAFF');
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Modal State - ACL Permissions
  const [isPermsModalOpen, setIsPermsModalOpen] = useState<boolean>(false);
  const [permsUser, setPermsUser] = useState<UserRecord | null>(null);
  const [userPerms, setUserPerms] = useState<Record<string, boolean>>({});
  const [permsSaving, setPermsSaving] = useState<boolean>(false);
  const [permsError, setPermsError] = useState<string | null>(null);
  const [permsSuccess, setPermsSuccess] = useState<string | null>(null);

  // Form Fields - Staff
  const [staffName, setStaffName] = useState<string>('');
  const [staffEmail, setStaffEmail] = useState<string>('');
  const [staffDepartment, setStaffDepartment] = useState<string>('URETIM');
  const [staffSystemRole, setStaffSystemRole] = useState<'admin' | 'staff'>('staff');
  const [staffPassword, setStaffPassword] = useState<string>('');

  // Form Fields - Customer (B2B)
  const [selectedCariId, setSelectedCariId] = useState<number | ''>('');
  const [customerContactName, setCustomerContactName] = useState<string>('');
  const [customerUsername, setCustomerUsername] = useState<string>('');
  const [customerPassword, setCustomerPassword] = useState<string>('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/v1/auth/users');
      setUsers(res.data);
    } catch (err: any) {
      console.error('Kullanıcılar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCaris = async () => {
    try {
      const res = await axios.get('/api/v1/caris/?cari_type=CUSTOMER&limit=300');
      setCaris(res.data.items || res.data || []);
    } catch (err) {
      console.error('Cari listesi yüklenemedi:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCaris();
  }, []);

  const handleCariChange = (cariId: number) => {
    setSelectedCariId(cariId);
    const chosen = caris.find((c) => c.id === cariId);
    if (chosen) {
      setCustomerContactName(`${chosen.title} (Portal Sorumlusu)`);
      const sanitizedCode = chosen.code.toLowerCase().replace(/[^a-z0-9]/g, '');
      setCustomerUsername(`b2b.${sanitizedCode}@b2b.gunaykimya.com`);
    }
  };

  const resetForm = () => {
    setStaffName('');
    setStaffEmail('');
    setStaffDepartment('URETIM');
    setStaffSystemRole('staff');
    setStaffPassword('');
    setSelectedCariId('');
    setCustomerContactName('');
    setCustomerUsername('');
    setCustomerPassword('');
    setFormError(null);
    setFormSuccess(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (modalMode === 'STAFF') {
      if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) {
        setFormError('Lütfen ad soyad, kurumsal e-posta ve şifre alanlarını eksiksiz doldurunuz.');
        return;
      }
      if (!staffEmail.includes('@')) {
        setFormError('Geçerli bir kurumsal e-posta adresi giriniz.');
        return;
      }
      if (staffPassword.length < 6) {
        setFormError('Şifre en az 6 karakter olmalıdır.');
        return;
      }

      setSaving(true);
      try {
        await axios.post('/api/v1/auth/register', {
          full_name: staffName.trim(),
          email: staffEmail.trim().toLowerCase(),
          password: staffPassword,
          role: staffSystemRole,
          role_names: [staffDepartment.toUpperCase()],
          is_active: true
        });
        setFormSuccess('Personel kullanıcısı başarıyla oluşturuldu.');
        resetForm();
        setTimeout(() => {
          setIsModalOpen(false);
          fetchUsers();
        }, 800);
      } catch (err: any) {
        setFormError(err.response?.data?.detail || 'Kullanıcı oluşturulurken bir hata meydana geldi.');
      } finally {
        setSaving(false);
      }
    } else {
      // B2B Müşteri
      if (!selectedCariId) {
        setFormError('Lütfen ilişkilendirilecek bir Cari Hesap (Firma) seçiniz.');
        return;
      }
      if (!customerUsername.trim() || !customerPassword.trim()) {
        setFormError('Lütfen portal kullanıcı adı/e-posta ve şifre alanlarını doldurunuz.');
        return;
      }
      if (customerPassword.length < 6) {
        setFormError('Şifre en az 6 karakter olmalıdır.');
        return;
      }

      setSaving(true);
      try {
        await axios.post('/api/v1/auth/register', {
          full_name: customerContactName.trim() || 'B2B Müşteri Temsilcisi',
          email: customerUsername.trim().toLowerCase(),
          password: customerPassword,
          role: 'customer',
          role_names: ['B2B_CUSTOMER'],
          cari_id: Number(selectedCariId),
          is_active: true
        });
        setFormSuccess('B2B Müşteri portal hesabı başarıyla tanımlandı.');
        resetForm();
        setTimeout(() => {
          setIsModalOpen(false);
          fetchUsers();
        }, 800);
      } catch (err: any) {
        setFormError(err.response?.data?.detail || 'B2B kullanıcısı oluşturulamadı.');
      } finally {
        setSaving(false);
      }
    }
  };

  const openPermissionsModal = (user: UserRecord) => {
    setPermsUser(user);
    setPermsError(null);
    setPermsSuccess(null);
    const initialPerms = { ...(user.effective_permissions || user.permissions || {}) };
    setUserPerms(initialPerms);
    setIsPermsModalOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!permsUser) return;
    setPermsSaving(true);
    setPermsError(null);
    setPermsSuccess(null);
    try {
      const res = await axios.patch(`/api/v1/auth/users/${permsUser.id}/permissions`, {
        permissions: userPerms
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === permsUser.id
            ? {
                ...u,
                permissions: res.data.permissions,
                effective_permissions: res.data.effective_permissions
              }
            : u
        )
      );
      setPermsSuccess('Yetkiler başarıyla güncellendi.');
      setTimeout(() => {
        setIsPermsModalOpen(false);
        setPermsSuccess(null);
      }, 700);
    } catch (err: any) {
      setPermsError(err.response?.data?.detail || 'Yetkiler güncellenirken hata oluştu.');
    } finally {
      setPermsSaving(false);
    }
  };

  const handleToggleStatus = async (user: UserRecord) => {
    try {
      const res = await axios.patch(`/api/v1/auth/users/${user.id}/status?is_active=${!user.is_active}`);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: res.data.is_active } : u))
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Kullanıcı durumu güncellenirken hata oluştu.');
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.cari_title && u.cari_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.cari_code && u.cari_code.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      roleFilter === 'ALL' ||
      (roleFilter === 'ADMIN' && u.role === 'admin') ||
      (roleFilter === 'STAFF' && u.role === 'staff') ||
      (roleFilter === 'CUSTOMER' && u.role === 'customer');

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.is_active) ||
      (statusFilter === 'PASSIVE' && !u.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalUsers = users.length;
  const staffUsers = users.filter((u) => u.role === 'staff' || u.role === 'admin').length;
  const b2bUsers = users.filter((u) => u.role === 'customer').length;
  const activeUsers = users.filter((u) => u.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-5 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#302480]/10 text-[#302480] dark:bg-[#302480]/20 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">Kullanıcı & Yetki Yönetimi (Modül 8)</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Fabrika personeli, departman sorumluları ve B2B müşteri portalı hesaplarının merkezi yönetimi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border text-text-muted hover:text-text hover:bg-surface-hover transition shadow-sm"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#302480] hover:bg-[#241a63] transition shadow-sm active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Kullanıcı Tanımla</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-text-muted uppercase">Toplam Kullanıcı</div>
            <div className="text-2xl font-bold text-text mt-1">{totalUsers}</div>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 dark:bg-blue-950/40 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-text-muted uppercase">Şirket Personeli</div>
            <div className="text-2xl font-bold text-[#302480] mt-1">{staffUsers}</div>
          </div>
          <div className="p-2.5 bg-indigo-50 text-[#302480] dark:bg-indigo-950/40 rounded-lg">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-text-muted uppercase">B2B Müşteri / Bayi</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{b2bUsers}</div>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 rounded-lg">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-text-muted uppercase">Aktif Hesaplar</div>
            <div className="text-2xl font-bold text-teal-600 mt-1">
              {activeUsers} <span className="text-xs font-normal text-text-muted">/ {totalUsers}</span>
            </div>
          </div>
          <div className="p-2.5 bg-teal-50 text-teal-600 dark:bg-teal-950/40 rounded-lg">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="İsim, e-posta, firma unvanı veya cari kodu ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#302480]/30"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Rol:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="py-1.5 px-3 text-xs bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-[#302480]/30"
          >
            <option value="ALL">Tüm Roller</option>
            <option value="ADMIN">Yöneticiler (Admin)</option>
            <option value="STAFF">Şirket Personeli (Staff)</option>
            <option value="CUSTOMER">B2B Müşterileri (Customer)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-3 text-xs bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-[#302480]/30"
          >
            <option value="ALL">Tüm Durumlar</option>
            <option value="ACTIVE">Yalnızca Aktif</option>
            <option value="PASSIVE">Yalnızca Pasif</option>
          </select>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-text-muted text-xs uppercase font-semibold border-b border-border">
              <tr>
                <th className="px-5 py-3.5">Kullanıcı & Ad Soyad</th>
                <th className="px-5 py-3.5">Giriş Kimliği / E-Posta</th>
                <th className="px-5 py-3.5">Rol Tipi</th>
                <th className="px-5 py-3.5">İlişkili Cari / Firma</th>
                <th className="px-5 py-3.5">Departman / İzinler</th>
                <th className="px-5 py-3.5">Durum</th>
                <th className="px-5 py-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#302480]" />
                    <span>Kullanıcılar yükleniyor...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-text-muted">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <span>Kriterlere uygun kullanıcı bulunamadı.</span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-hover/70 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase text-white ${
                            user.role === 'admin'
                              ? 'bg-[#302480]'
                              : user.role === 'customer'
                              ? 'bg-emerald-600'
                              : 'bg-blue-600'
                          }`}
                        >
                          {user.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-text">{user.full_name}</div>
                          <div className="text-[11px] text-text-muted">
                            Kayıt: {new Date(user.created_at).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-mono text-xs text-text font-medium">{user.email}</div>
                    </td>

                    <td className="px-5 py-4">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300/40">
                          <Shield className="w-3 h-3" />
                          YÖNETİCİ
                        </span>
                      ) : user.role === 'customer' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-400/30">
                          <Globe className="w-3 h-3" />
                          B2B MÜŞTERİ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300/30">
                          <Briefcase className="w-3 h-3" />
                          PERSONEL
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {user.cari_title ? (
                        <div>
                          <div className="font-medium text-xs text-text">{user.cari_title}</div>
                          <div className="text-[10px] text-text-muted font-mono">{user.cari_code}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted italic">Günay Kimya A.Ş.</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((r, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-bg text-text-muted border border-border"
                            >
                              {r}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          user.is_active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-500/20'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-300/30'
                        }`}
                      >
                        {user.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Aktif
                          </>
                        ) : (
                          <>
                            <UserX className="w-3 h-3 text-gray-500" />
                            Pasif
                          </>
                        )}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openPermissionsModal(user)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-[#302480]/30 text-[#302480] dark:text-[#a094eb] hover:bg-[#302480]/10 transition shadow-sm"
                          title="Yetki Matrisini Düzenle"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Yetkiler</span>
                        </button>

                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                            user.is_active
                              ? 'border-danger/30 text-danger hover:bg-danger/10'
                              : 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={user.is_active ? 'Hesabı Dondur' : 'Hesabı Aktifleştir'}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{user.is_active ? 'Dondur' : 'Aktif Et'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL (MODULE 8) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-bg">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#302480]/10 text-[#302480] rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text">Yeni Kullanıcı Tanımla</h3>
                  <p className="text-xs text-text-muted">Kullanıcı türünü seçerek hesap detaylarını giriniz</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Type Selector Tabs */}
            <div className="p-4 bg-bg/50 border-b border-border">
              <div className="grid grid-cols-2 gap-2 p-1 bg-surface rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => {
                    setModalMode('STAFF');
                    setFormError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition ${
                    modalMode === 'STAFF'
                      ? 'bg-[#302480] text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Şirket İçi Personel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalMode('CUSTOMER');
                    setFormError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition ${
                    modalMode === 'CUSTOMER'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>B2B Müşteri / Bayi</span>
                </button>
              </div>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateUser} className="p-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-500/30 text-emerald-700 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {modalMode === 'STAFF' ? (
                /* ŞİRKET İÇİ PERSONEL ALANLARI */
                <>
                  <div>
                    <label className="block text-xs font-bold text-text mb-1">
                      Personel Adı Soyadı *
                    </label>
                    <input
                      type="text"
                      required
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="Örn: Ahmet Yılmaz"
                      className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#302480]/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text mb-1">
                      Kurumsal E-Posta Adresi *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="email"
                        required
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        placeholder="ahmet.yilmaz@gunaykimya.com"
                        className="w-full pl-9 pr-3 py-2 text-sm bg-bg border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#302480]/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-text mb-1">
                        Departman *
                      </label>
                      <select
                        value={staffDepartment}
                        onChange={(e) => setStaffDepartment(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-[#302480]/30"
                      >
                        <option value="URETIM">Üretim & Fabrika</option>
                        <option value="DEPO_SORUMLUSU">Depo & Lojistik</option>
                        <option value="MUHASEBE">Muhasebe & Finans</option>
                        <option value="SATIS">Satış & CRM</option>
                        <option value="IK">İnsan Kaynakları</option>
                        <option value="KALITE">Kalite Kontrol / Ar-Ge</option>
                        <option value="ADMIN">Üst Yönetim</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text mb-1">
                        Sistem Yetki Rolü
                      </label>
                      <select
                        value={staffSystemRole}
                        onChange={(e) => setStaffSystemRole(e.target.value as 'admin' | 'staff')}
                        className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-[#302480]/30"
                      >
                        <option value="staff">Standart Personel (Staff)</option>
                        <option value="admin">Sistem Yöneticisi (Admin)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text mb-1">
                      Giriş Şifresi *
                    </label>
                    <input
                      type="password"
                      required
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="En az 6 karakter"
                      className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#302480]/30"
                    />
                  </div>
                </>
              ) : (
                /* B2B MÜŞTERİ / BAYİ ALANLARI */
                <>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                    <p className="font-semibold">B2B Portal İzolasyonu:</p>
                    <p className="mt-0.5">
                      Seçilen Cari Hesap (Müşteri) dışındaki hiçbir sipariş veya cari verisi bu kullanıcıya gösterilmez.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text mb-1">
                      Cari Kart (Firma Seçimi) *
                    </label>
                    <select
                      required
                      value={selectedCariId}
                      onChange={(e) => handleCariChange(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="">-- Müşteri Cari Kartı Seçiniz --</option>
                      {caris.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.code}] {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text mb-1">
                      Firma Yetkili Adı *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerContactName}
                      onChange={(e) => setCustomerContactName(e.target.value)}
                      placeholder="Örn: ABC Kimya - Satınalma Sorumlusu"
                      className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text mb-1">
                      Portal Kullanıcı Adı / Kimlik *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerUsername}
                      onChange={(e) => setCustomerUsername(e.target.value)}
                      placeholder="b2b.musterikodu@b2b.gunaykimya.com veya Firma Adı"
                      className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text placeholder-text-muted font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <p className="text-[11px] text-text-muted mt-1">
                      Müşteri giriş ekranında bu e-postayı veya doğrudan firma unvanını yazarak giriş yapabilir.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text mb-1">
                      B2B Portal Şifresi *
                    </label>
                    <input
                      type="password"
                      required
                      value={customerPassword}
                      onChange={(e) => setCustomerPassword(e.target.value)}
                      placeholder="En az 6 karakter"
                      className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text rounded-xl border border-border hover:bg-surface-hover transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition active:scale-[0.98] ${
                    modalMode === 'STAFF'
                      ? 'bg-[#302480] hover:bg-[#241a63]'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Kullanıcıyı Kaydet</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DYNAMIC PERMISSIONS MATRIX MODAL (ACL) */}
      {isPermsModalOpen && permsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-bg">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#302480]/10 text-[#302480] rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text">Yetki Düzenleme Matrisi (ACL)</h3>
                  <p className="text-xs text-text-muted">
                    {permsUser.full_name} ({permsUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPermsModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {permsError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{permsError}</span>
                </div>
              )}
              {permsSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-500/30 text-emerald-700 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{permsSuccess}</span>
                </div>
              )}

              {/* User Summary Pill */}
              <div className="p-3 bg-bg rounded-xl border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-text-muted">Hesap Tipi:</span>
                  <span className="ml-1.5 text-xs font-bold text-text">
                    {permsUser.role === 'admin'
                      ? 'Yönetici (Admin)'
                      : permsUser.role === 'customer'
                      ? `B2B Müşteri (${permsUser.cari_title || 'Cari Bağlı'})`
                      : 'Şirket Personeli'}
                  </span>
                </div>
                {permsUser.role === 'admin' && (
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 rounded-md">
                    Tam Yönetici Yetkisi
                  </span>
                )}
              </div>

              {/* Switches based on Role */}
              <div className="space-y-2.5">
                {permsUser.role === 'customer' ? (
                  /* B2B MÜŞTERİ YETKİLERİ */
                  <>
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
                      B2B Portal Yetkileri
                    </div>

                    {[
                      {
                        key: 'b2b_orders',
                        label: 'Sipariş Verme (Yeni Sipariş)',
                        desc: 'Müşterinin B2B portalından doğrudan yeni sipariş oluşturup fabrikaya iletmesi.'
                      },
                      {
                        key: 'b2b_tracking',
                        label: 'Sipariş Takip & Fazlar',
                        desc: 'Geçmiş ve mevcut siparişlerin onay, üretim ve sevkiyat durumlarını izlemesi.'
                      },
                      {
                        key: 'b2b_statement',
                        label: 'Cari Ekstre & Bakiye Görme',
                        desc: 'Anlık borç/alacak bakiyesi, risk limiti ve cari hesap ekstresini görüntülemesi.'
                      }
                    ].map((item) => {
                      const isEnabled = userPerms[item.key] ?? true;
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between p-3 rounded-xl border border-border bg-bg/60 hover:bg-bg transition"
                        >
                          <div className="pr-4">
                            <div className="text-xs font-bold text-text">{item.label}</div>
                            <div className="text-[11px] text-text-muted mt-0.5">{item.desc}</div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isEnabled}
                            onClick={() =>
                              setUserPerms((prev) => ({
                                ...prev,
                                [item.key]: !isEnabled
                              }))
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                              isEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                                isEnabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  /* ŞİRKET İÇİ PERSONEL YETKİLERİ */
                  <>
                    <div className="text-xs font-bold text-[#302480] dark:text-[#a094eb] uppercase tracking-wider mb-1">
                      Şirket İçi Modül Erişim Yetkileri
                    </div>

                    {[
                      {
                        key: 'orders',
                        label: 'Sipariş Giriş & Katalog',
                        desc: 'Yeni sipariş girişi, ürün kataloğu ve sipariş listeleme.'
                      },
                      {
                        key: 'planning',
                        label: 'Planlama / Sevkiyat',
                        desc: 'Üretim planlama takvimi, Kanban panosu ve irsaliye/lojistik takibi.'
                      },
                      {
                        key: 'purchasing',
                        label: 'Satınalma & İç Talep',
                        desc: 'Hammadde satınalma talepleri, WhatsApp/Mail RFQ yönlendirmeleri.'
                      },
                      {
                        key: 'manufacturing',
                        label: 'Üretim & Reçete (BOM)',
                        desc: 'Canlı faz takibi, reçete tasarımı ve iş emirleri.'
                      },
                      {
                        key: 'inventory',
                        label: 'Stok / Depo & El Terminali',
                        desc: 'Malzeme stokları, depo yerleşimi, palet/koli ve barkod terminali.'
                      },
                      {
                        key: 'crm',
                        label: 'Satış & CRM (Müşteriler)',
                        desc: 'Müşteri profilleri, cari bakiyeler ve ziyaret/CRM notları.'
                      },
                      {
                        key: 'hr',
                        label: 'İnsan Kaynakları & Mülakat',
                        desc: 'Aday listesi, işe alım mülakat aşamaları ve değerlendirme kararları.'
                      },
                      {
                        key: 'users',
                        label: 'Kullanıcı Yönetimi (Admin)',
                        desc: 'Yeni personel veya müşteri tanımlama ve yetki matrisini düzenleme.'
                      },
                      {
                        key: 'accounting',
                        label: 'Finansal Genel Bakış',
                        desc: 'Üst düzey finansal göstergeler ve muhasebe raporları.'
                      },
                      {
                        key: 'quality',
                        label: 'Kalite Kontrol & Laboratuvar (CoA)',
                        desc: 'Girdi/çıktı kalite testleri, CoA sertifikaları ve izlenebilirlik.'
                      }
                    ].map((item) => {
                      const isEnabled = userPerms[item.key] ?? false;
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between p-3 rounded-xl border border-border bg-bg/60 hover:bg-bg transition"
                        >
                          <div className="pr-4">
                            <div className="text-xs font-bold text-text">{item.label}</div>
                            <div className="text-[11px] text-text-muted mt-0.5">{item.desc}</div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isEnabled}
                            onClick={() =>
                              setUserPerms((prev) => ({
                                ...prev,
                                [item.key]: !isEnabled
                              }))
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#302480]/30 ${
                              isEnabled ? 'bg-[#302480]' : 'bg-gray-300 dark:bg-gray-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                                isEnabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-bg">
              <button
                type="button"
                onClick={() => setIsPermsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text rounded-xl border border-border hover:bg-surface-hover transition"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={permsSaving}
                onClick={handleSavePermissions}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl bg-[#302480] hover:bg-[#241a63] transition shadow-sm active:scale-[0.98]"
              >
                {permsSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Güncelleniyor...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Yetkileri Kaydet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
