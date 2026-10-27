import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Power,
  CheckCircle2,
  AlertTriangle,
  X,
  Filter,
  Phone,
  Mail,
  MapPin,
  Calendar
} from 'lucide-react';

interface CustomerAccount {
  id: number;
  code: string;
  title: string;
  cari_type: string;
  tax_number?: string;
  tax_office?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  payment_term_days: number;
  current_balance: number;
  credit_limit: number;
  risk_status: string;
  is_active: boolean;
}

export const CustomersManagement: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerAccount | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form values
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    tax_number: '',
    tax_office: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    payment_term_days: '30',
    credit_limit: '250000',
    is_active: true
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/caris/?cari_type=CUSTOMER&limit=200';
      const params: string[] = [];
      if (statusFilter === 'ACTIVE') params.push('is_active=true');
      if (statusFilter === 'INACTIVE') params.push('is_active=false');
      if (searchQuery.trim()) params.push(`q=${encodeURIComponent(searchQuery.trim())}`);

      if (params.length > 0) {
        url += '&' + params.join('&');
      }

      const res = await axios.get(url);
      setCustomers(res.data || []);
    } catch (err) {
      console.error('Müşteri listesi alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const openCreateDrawer = () => {
    setEditingCustomer(null);
    // Suggest a new customer code
    const nextCodeNum = customers.length + 1;
    const padded = String(nextCodeNum).padStart(4, '0');
    setFormData({
      code: `120.01.${padded}`,
      title: '',
      tax_number: '',
      tax_office: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      payment_term_days: '30',
      credit_limit: '300000',
      is_active: true
    });
    setFormErrors({});
    setErrorMessage(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (cust: CustomerAccount) => {
    setEditingCustomer(cust);
    setFormData({
      code: cust.code,
      title: cust.title,
      tax_number: cust.tax_number || '',
      tax_office: cust.tax_office || '',
      contact_person: cust.contact_person || '',
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || '',
      payment_term_days: String(cust.payment_term_days || 30),
      credit_limit: String(cust.credit_limit || 0),
      is_active: cust.is_active
    });
    setFormErrors({});
    setErrorMessage(null);
    setIsDrawerOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Firma unvanı zorunludur.';
    if (!formData.tax_number.trim()) errors.tax_number = 'Vergi numarası (VKN / TCKN) zorunludur.';
    if (!formData.tax_office.trim()) errors.tax_office = 'Vergi dairesi zorunludur.';
    if (!formData.contact_person.trim()) errors.contact_person = 'Yetkili kişi zorunludur.';
    if (!formData.phone.trim()) errors.phone = 'Telefon numarası zorunludur.';
    if (!formData.email.trim()) {
      errors.email = 'E-posta adresi zorunludur.';
    } else if (!formData.email.includes('@')) {
      errors.email = 'Geçerli bir e-posta adresi giriniz.';
    }
    if (!formData.address.trim()) errors.address = 'Açık adres zorunludur.';
    if (!formData.payment_term_days.trim() || isNaN(Number(formData.payment_term_days)) || Number(formData.payment_term_days) < 0) {
      errors.payment_term_days = 'Geçerli bir ödeme vadesi (gün) giriniz.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setErrorMessage(null);

    const payload = {
      code: formData.code.trim(),
      title: formData.title.trim(),
      cari_type: 'CUSTOMER',
      tax_number: formData.tax_number.trim(),
      tax_office: formData.tax_office.trim(),
      contact_person: formData.contact_person.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      payment_term_days: Number(formData.payment_term_days),
      credit_limit: Number(formData.credit_limit) || 0,
      is_active: formData.is_active
    };

    try {
      if (editingCustomer) {
        await axios.put(`/api/v1/caris/${editingCustomer.id}`, payload);
      } else {
        await axios.post('/api/v1/caris/', payload);
      }
      setIsDrawerOpen(false);
      fetchCustomers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Müşteri kaydedilirken bir hata oluştu.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cust: CustomerAccount) => {
    try {
      await axios.patch(`/api/v1/caris/${cust.id}/toggle-active`);
      fetchCustomers();
    } catch (err: any) {
      console.error('Durum değiştirilemedi:', err);
      alert('İşlem başarısız: ' + (err.response?.data?.detail || 'Hata oluştu'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-card relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-mod-satis-soft text-mod-satis border border-mod-satis-border">
                Satış & Sevkiyat Modülü
              </span>
              <span className="text-xs text-text-muted">Müşteri Cari Yönetimi</span>
            </div>
            <h1 className="text-2xl font-bold text-text tracking-tight mt-1 flex items-center gap-2">
              <Users className="w-6 h-6 text-mod-satis" />
              Müşteriler
            </h1>
            <p className="text-sm text-text-muted mt-1">
              B2B bayileri, distribütörler ve endüstriyel toptan alıcı firmaların resmi cari ve iletişim kayıtları.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCustomers}
              disabled={loading}
              className="border border-border hover:bg-surface-hover text-text px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm bg-surface"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">Yenile</span>
            </button>

            <button
              onClick={openCreateDrawer}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Müşteri Ekle</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-6 pt-4 border-t border-border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Firma unvanı, VKN, yetkili veya kod ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              className="border border-border hover:bg-surface-hover text-text px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-surface"
            >
              Ara
            </button>
          </form>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Filter className="w-3.5 h-3.5" />
              <span>Filtre:</span>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="ACTIVE">Yalnızca Aktif Müşteriler</option>
              <option value="INACTIVE">Yalnızca Pasif Müşteriler</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface border border-border rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-bg border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Cari Kod</th>
                <th className="py-3 px-4">Firma Unvanı</th>
                <th className="py-3 px-4">Vergi No / Dairesi</th>
                <th className="py-3 px-4">Yetkili Kişi</th>
                <th className="py-3 px-4">İletişim</th>
                <th className="py-3 px-4 text-center">Ödeme Vadesi</th>
                <th className="py-3 px-4 text-right">Bakiye</th>
                <th className="py-3 px-4 text-center">Durum</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <span>Müşteriler yükleniyor...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted">
                    <Users className="w-8 h-8 mx-auto text-text-muted mb-2 opacity-50" />
                    <span>Kayıtlı müşteri bulunamadı.</span>
                  </td>
                </tr>
              ) : (
                customers.map((cust) => (
                  <tr
                    key={cust.id}
                    className={`hover:bg-primary-soft/30 transition-colors ${!cust.is_active ? 'opacity-60 bg-bg/50' : ''}`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-text">
                      {cust.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-text">{cust.title}</div>
                      {cust.address && (
                        <div className="text-[11px] text-text-muted truncate max-w-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0 text-text-muted" />
                          <span title={cust.address}>{cust.address}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs font-semibold text-text">
                        {cust.tax_number || '-'}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {cust.tax_office || '-'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-text">
                      {cust.contact_person || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      {cust.phone && (
                        <div className="flex items-center gap-1 text-xs text-text">
                          <Phone className="w-3 h-3 text-text-muted" />
                          <span>{cust.phone}</span>
                        </div>
                      )}
                      {cust.email && (
                        <div className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
                          <Mail className="w-3 h-3 text-text-muted" />
                          <span>{cust.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-bg border border-border text-text font-mono">
                        <Calendar className="w-3 h-3 text-text-muted" />
                        {cust.payment_term_days} gün
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-text">
                      ₺{Number(cust.current_balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {cust.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-soft text-success-text border border-success-border">
                          <CheckCircle2 className="w-3 h-3 text-success" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-danger-soft text-danger-text border border-danger-border">
                          <Power className="w-3 h-3 text-danger" />
                          Pasif
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditDrawer(cust)}
                          className="border border-border hover:bg-primary-soft text-text hover:text-primary px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1"
                          title="Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Düzenle</span>
                        </button>
                        <button
                          onClick={() => handleToggleActive(cust)}
                          className={`border border-border px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                            cust.is_active
                              ? 'hover:bg-danger-soft text-text hover:text-danger-text hover:border-danger-border'
                              : 'hover:bg-success-soft text-text hover:text-success-text hover:border-success-border'
                          }`}
                          title={cust.is_active ? 'Pasife Al' : 'Aktife Al'}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{cust.is_active ? 'Pasife Al' : 'Aktife Al'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="py-3 px-4 border-t border-border bg-bg flex items-center justify-between text-xs text-text-muted">
          <span>Toplam <strong>{customers.length}</strong> müşteri listelendi</span>
          <span>B2B yetkileri ve cari risk kontrolleri entegre çalışmaktadır.</span>
        </div>
      </div>

      {/* Side Panel / Drawer Modal */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 transition-opacity animate-in fade-in"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-full max-w-lg bg-surface border-l border-border h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-border flex items-center justify-between bg-surface">
              <div>
                <h2 className="text-lg font-bold text-text">
                  {editingCustomer ? 'Müşteri Cari Bilgilerini Düzenle' : 'Yeni Müşteri Cari Kartı'}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Ticari ve kurumsal müşteri bilgilerini eksiksiz giriniz.
                </p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-bg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body (Form) */}
            <form id="customer-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-danger-soft border border-danger-border text-danger-text text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-danger" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Cari Kodu & Firma Unvanı */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Cari Kodu <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="120.01.XXXX"
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text mb-1">
                    Firma Resmi Unvanı <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Örn: Ege Kimya Dağıtım ve Pazarlama A.Ş."
                    className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary ${
                      formErrors.title ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {formErrors.title && (
                    <p className="text-[11px] text-danger-text mt-1">{formErrors.title}</p>
                  )}
                </div>
              </div>

              {/* Vergi No & Vergi Dairesi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Vergi No (VKN/TCKN) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.tax_number}
                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                    placeholder="10 Haneli VKN"
                    className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary font-mono ${
                      formErrors.tax_number ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {formErrors.tax_number && (
                    <p className="text-[11px] text-danger-text mt-1">{formErrors.tax_number}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Vergi Dairesi <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.tax_office}
                    onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                    placeholder="Örn: Konak V.D."
                    className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary ${
                      formErrors.tax_office ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {formErrors.tax_office && (
                    <p className="text-[11px] text-danger-text mt-1">{formErrors.tax_office}</p>
                  )}
                </div>
              </div>

              {/* Yetkili Kişi & Telefon */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Yetkili Kişi <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Adı Soyadı"
                    className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary ${
                      formErrors.contact_person ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {formErrors.contact_person && (
                    <p className="text-[11px] text-danger-text mt-1">{formErrors.contact_person}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Telefon <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Örn: 0232 444 12 34"
                    className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary ${
                      formErrors.phone ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {formErrors.phone && (
                    <p className="text-[11px] text-danger-text mt-1">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* E-posta */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  E-Posta Adresi <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="siparis@firma.com.tr"
                  className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary ${
                    formErrors.email ? 'border-danger' : 'border-border'
                  }`}
                />
                {formErrors.email && (
                  <p className="text-[11px] text-danger-text mt-1">{formErrors.email}</p>
                )}
              </div>

              {/* Adres */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Firma / Sevkiyat Adresi <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Tam cadde, sokak, no, ilçe ve il bilgisi..."
                  className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary resize-none ${
                    formErrors.address ? 'border-danger' : 'border-border'
                  }`}
                />
                {formErrors.address && (
                  <p className="text-[11px] text-danger-text mt-1">{formErrors.address}</p>
                )}
              </div>

              {/* Ödeme Vadesi & Kredi Limiti */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Ödeme Vadesi (Gün) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.payment_term_days}
                    onChange={(e) => setFormData({ ...formData, payment_term_days: e.target.value })}
                    className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary font-mono ${
                      formErrors.payment_term_days ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {formErrors.payment_term_days && (
                    <p className="text-[11px] text-danger-text mt-1">{formErrors.payment_term_days}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Kredi Risk Limiti (₺)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              {/* Aktif/Pasif */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold text-text">Müşteri Cari Aktif</span>
                </label>
                <p className="text-xs text-text-muted mt-1 ml-6">
                  Pasife alınan müşterilere yeni sipariş girişi ve sevkiyat irsaliyesi kesilemez.
                </p>
              </div>
            </form>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-border bg-bg flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="border border-border hover:bg-surface-hover text-text px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-surface"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                form="customer-form"
                disabled={saving}
                className="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2"
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{editingCustomer ? 'Güncelle' : 'Kaydet'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
