import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Truck,
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
  Package,
  Check
} from 'lucide-react';

interface SupplierAccount {
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
  supplied_product_ids?: string;
  is_active: boolean;
}

interface ProductOption {
  id: number;
  sku: string;
  name: string;
  category: string;
}

export const SuppliersManagement: React.FC = () => {
  const [suppliers, setSuppliers] = useState<SupplierAccount[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierAccount | null>(null);
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
    payment_term_days: '45',
    supplied_product_ids: [] as number[],
    is_active: true
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchSuppliersAndProducts = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/caris/?cari_type=SUPPLIER&limit=200';
      const params: string[] = [];
      if (statusFilter === 'ACTIVE') params.push('is_active=true');
      if (statusFilter === 'INACTIVE') params.push('is_active=false');
      if (searchQuery.trim()) params.push(`q=${encodeURIComponent(searchQuery.trim())}`);

      if (params.length > 0) {
        url += '&' + params.join('&');
      }

      const [suppliersRes, itemsRes] = await Promise.all([
        axios.get(url),
        axios.get('/api/v1/items/?limit=200')
      ]);

      setSuppliers(suppliersRes.data || []);
      setProducts(itemsRes.data || []);
    } catch (err) {
      console.error('Tedarikçi verileri alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliersAndProducts();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSuppliersAndProducts();
  };

  const openCreateDrawer = () => {
    setEditingSupplier(null);
    const nextCodeNum = suppliers.length + 1;
    const padded = String(nextCodeNum).padStart(4, '0');
    setFormData({
      code: `320.01.${padded}`,
      title: '',
      tax_number: '',
      tax_office: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      payment_term_days: '45',
      supplied_product_ids: [],
      is_active: true
    });
    setFormErrors({});
    setErrorMessage(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (supp: SupplierAccount) => {
    setEditingSupplier(supp);
    let prodIds: number[] = [];
    if (supp.supplied_product_ids) {
      try {
        const parsed = JSON.parse(supp.supplied_product_ids);
        if (Array.isArray(parsed)) prodIds = parsed;
      } catch {
        prodIds = supp.supplied_product_ids
          .split(',')
          .map((id) => Number(id.trim()))
          .filter((id) => !isNaN(id));
      }
    }

    setFormData({
      code: supp.code,
      title: supp.title,
      tax_number: supp.tax_number || '',
      tax_office: supp.tax_office || '',
      contact_person: supp.contact_person || '',
      phone: supp.phone || '',
      email: supp.email || '',
      address: supp.address || '',
      payment_term_days: String(supp.payment_term_days || 45),
      supplied_product_ids: prodIds,
      is_active: supp.is_active
    });
    setFormErrors({});
    setErrorMessage(null);
    setIsDrawerOpen(true);
  };

  const toggleProductSelection = (productId: number) => {
    setFormData((prev) => {
      const exists = prev.supplied_product_ids.includes(productId);
      const updated = exists
        ? prev.supplied_product_ids.filter((id) => id !== productId)
        : [...prev.supplied_product_ids, productId];
      return { ...prev, supplied_product_ids: updated };
    });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Tedarikçi unvanı zorunludur.';
    if (!formData.tax_number.trim()) errors.tax_number = 'Vergi numarası (VKN) zorunludur.';
    if (!formData.contact_person.trim()) errors.contact_person = 'Yetkili kişi zorunludur.';
    if (!formData.phone.trim()) errors.phone = 'Telefon numarası zorunludur.';
    if (!formData.email.trim()) {
      errors.email = 'E-posta adresi zorunludur.';
    } else if (!formData.email.includes('@')) {
      errors.email = 'Geçerli bir e-posta adresi giriniz.';
    }
    if (!formData.address.trim()) errors.address = 'Açık adres zorunludur.';
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
      cari_type: 'SUPPLIER',
      tax_number: formData.tax_number.trim(),
      tax_office: formData.tax_office.trim() || 'Vergi Dairesi',
      contact_person: formData.contact_person.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      payment_term_days: Number(formData.payment_term_days) || 45,
      supplied_product_ids: JSON.stringify(formData.supplied_product_ids),
      is_active: formData.is_active
    };

    try {
      if (editingSupplier) {
        await axios.put(`/api/v1/caris/${editingSupplier.id}`, payload);
      } else {
        await axios.post('/api/v1/caris/', payload);
      }
      setIsDrawerOpen(false);
      fetchSuppliersAndProducts();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Tedarikçi kaydedilirken bir hata oluştu.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (supp: SupplierAccount) => {
    try {
      await axios.patch(`/api/v1/caris/${supp.id}/toggle-active`);
      fetchSuppliersAndProducts();
    } catch (err: any) {
      console.error('Durum değiştirilemedi:', err);
      alert('İşlem başarısız: ' + (err.response?.data?.detail || 'Hata oluştu'));
    }
  };

  const renderSuppliedBadges = (suppliedJson?: string) => {
    if (!suppliedJson) return <span className="text-text-muted text-xs">-</span>;
    let ids: number[] = [];
    try {
      const parsed = JSON.parse(suppliedJson);
      if (Array.isArray(parsed)) ids = parsed;
    } catch {
      ids = suppliedJson
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => !isNaN(x));
    }

    if (ids.length === 0) return <span className="text-text-muted text-xs">-</span>;

    const matchedProducts = products.filter((p) => ids.includes(p.id));

    return (
      <div className="flex flex-wrap gap-1 max-w-xs">
        {matchedProducts.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-mod-stok-soft text-mod-stok border border-mod-stok-border"
            title={p.name}
          >
            <Package className="w-3 h-3 text-mod-stok" />
            {p.sku}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-card relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-mod-stok-soft text-mod-stok border border-mod-stok-border">
                Satın Alma Modülü
              </span>
              <span className="text-xs text-text-muted">Tedarikçi ve Kaynak Yönetimi</span>
            </div>
            <h1 className="text-2xl font-bold text-text tracking-tight mt-1 flex items-center gap-2">
              <Truck className="w-6 h-6 text-mod-stok" />
              Tedarikçiler
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Hammadde, kimyasal bileşen ve ambalaj temin edilen yetkili üretici ve tedarikçi firmalar.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchSuppliersAndProducts}
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
              <span>Yeni Tedarikçi Ekle</span>
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
                placeholder="Tedarikçi unvanı, VKN, yetkili veya kod ara..."
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
              <option value="ACTIVE">Yalnızca Aktif Tedarikçiler</option>
              <option value="INACTIVE">Yalnızca Pasif Tedarikçiler</option>
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
                <th className="py-3 px-4">Tedarikçi Kod</th>
                <th className="py-3 px-4">Tedarikçi Unvanı</th>
                <th className="py-3 px-4">Vergi No (VKN)</th>
                <th className="py-3 px-4">Yetkili Kişi</th>
                <th className="py-3 px-4">İletişim</th>
                <th className="py-3 px-4">Tedarik Ettiği Ürünler</th>
                <th className="py-3 px-4 text-center">Durum</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <span>Tedarikçiler yükleniyor...</span>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    <Truck className="w-8 h-8 mx-auto text-text-muted mb-2 opacity-50" />
                    <span>Kayıtlı tedarikçi bulunamadı.</span>
                  </td>
                </tr>
              ) : (
                suppliers.map((supp) => (
                  <tr
                    key={supp.id}
                    className={`hover:bg-primary-soft/30 transition-colors ${!supp.is_active ? 'opacity-60 bg-bg/50' : ''}`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-text">
                      {supp.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-text">{supp.title}</div>
                      {supp.address && (
                        <div className="text-[11px] text-text-muted truncate max-w-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0 text-text-muted" />
                          <span title={supp.address}>{supp.address}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-text">
                      {supp.tax_number || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-text">
                      {supp.contact_person || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      {supp.phone && (
                        <div className="flex items-center gap-1 text-xs text-text">
                          <Phone className="w-3 h-3 text-text-muted" />
                          <span>{supp.phone}</span>
                        </div>
                      )}
                      {supp.email && (
                        <div className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
                          <Mail className="w-3 h-3 text-text-muted" />
                          <span>{supp.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderSuppliedBadges(supp.supplied_product_ids)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {supp.is_active ? (
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
                          onClick={() => openEditDrawer(supp)}
                          className="border border-border hover:bg-primary-soft text-text hover:text-primary px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1"
                          title="Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Düzenle</span>
                        </button>
                        <button
                          onClick={() => handleToggleActive(supp)}
                          className={`border border-border px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                            supp.is_active
                              ? 'hover:bg-danger-soft text-text hover:text-danger-text hover:border-danger-border'
                              : 'hover:bg-success-soft text-text hover:text-success-text hover:border-success-border'
                          }`}
                          title={supp.is_active ? 'Pasife Al' : 'Aktife Al'}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{supp.is_active ? 'Pasife Al' : 'Aktife Al'}</span>
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
          <span>Toplam <strong>{suppliers.length}</strong> tedarikçi listelendi</span>
          <span>Mal kabul ve satın alma süreçleri bu tedarikçilerle entegre yürütülür.</span>
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
                  {editingSupplier ? 'Tedarikçi Bilgilerini Düzenle' : 'Yeni Tedarikçi Kartı'}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Kimyasal ve hammadde tedarikçisi resmi verilerini giriniz.
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
            <form id="supplier-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-danger-soft border border-danger-border text-danger-text text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-danger" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Tedarikçi Kodu & Unvan */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Tedarikçi Kod <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="320.01.XXXX"
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text mb-1">
                    Tedarikçi Firma Unvanı <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Örn: BASF Türk Kimya Sanayi ve Tic. Ltd. Şti."
                    className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary ${
                      formErrors.title ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {formErrors.title && (
                    <p className="text-[11px] text-danger-text mt-1">{formErrors.title}</p>
                  )}
                </div>
              </div>

              {/* VKN & Vergi Dairesi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Vergi No (VKN) <span className="text-danger">*</span>
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
                    Vergi Dairesi
                  </label>
                  <input
                    type="text"
                    value={formData.tax_office}
                    onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                    placeholder="Örn: Büyük Mükellefler V.D."
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                  />
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
                    placeholder="Örn: 0216 570 34 00"
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
                  placeholder="hammadde.satis@tedarikci.com"
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
                  Tedarikçi Adresi <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Fabrika veya ofis açık adresi..."
                  className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary resize-none ${
                    formErrors.address ? 'border-danger' : 'border-border'
                  }`}
                />
                {formErrors.address && (
                  <p className="text-[11px] text-danger-text mt-1">{formErrors.address}</p>
                )}
              </div>

              {/* Tedarik Ettiği Ürünler (Çoklu Seçim) */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1 flex items-center justify-between">
                  <span>Tedarik Ettiği Ürünler & Hammaddeler (Çoklu Seçim)</span>
                  <span className="text-[11px] text-text-muted font-normal">
                    {formData.supplied_product_ids.length} ürün seçildi
                  </span>
                </label>
                <div className="border border-border rounded-lg bg-bg p-3 max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar">
                  {products.length === 0 ? (
                    <div className="text-xs text-text-muted py-2 text-center">Ürün listesi yükleniyor...</div>
                  ) : (
                    products.map((p) => {
                      const isSelected = formData.supplied_product_ids.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleProductSelection(p.id)}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors text-xs select-none ${
                            isSelected
                              ? 'bg-mod-stok-soft border border-mod-stok-border text-text'
                              : 'hover:bg-surface border border-transparent text-text-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-mod-stok border-mod-stok text-white'
                                  : 'border-border bg-surface'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <span className="font-mono font-bold text-text">{p.sku}</span>
                            <span className="truncate max-w-[220px] text-text-muted">{p.name}</span>
                          </div>
                          <span className="text-[10px] uppercase font-semibold text-text-muted">
                            {p.category}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Durum (Aktif / Pasif) */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold text-text">Tedarikçi Aktif</span>
                </label>
                <p className="text-xs text-text-muted mt-1 ml-6">
                  Pasife alınan tedarikçilerden yeni mal kabul veya satın alma talebi açılamaz.
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
                form="supplier-form"
                disabled={saving}
                className="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2"
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{editingSupplier ? 'Güncelle' : 'Kaydet'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
