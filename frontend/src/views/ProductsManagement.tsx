import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Package,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Power,
  CheckCircle2,
  AlertTriangle,
  X,
  Filter,
  Layers,
  ShieldAlert
} from 'lucide-react';

interface ProductItem {
  id: number;
  sku: string;
  name: string;
  unit: string;
  category: string;
  cas_number?: string;
  density?: number;
  min_stock?: number;
  shelf_life_days?: number;
  hazard_class?: string;
  is_active: boolean;
  qc_incoming_required?: boolean;
  qc_outgoing_required?: boolean;
}

export const ProductsManagement: React.FC = () => {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Drawer / Form state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form values
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'RAW_MATERIAL',
    unit: 'kg',
    min_stock: '1000',
    shelf_life_days: '365',
    hazard_class: '',
    is_active: true,
    qc_incoming_required: false,
    qc_outgoing_required: false
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchItems = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/items/?limit=300';
      const params: string[] = [];
      if (categoryFilter !== 'ALL') params.push(`category=${encodeURIComponent(categoryFilter)}`);
      if (statusFilter === 'ACTIVE') params.push('is_active=true');
      if (statusFilter === 'INACTIVE') params.push('is_active=false');
      if (searchQuery.trim()) params.push(`q=${encodeURIComponent(searchQuery.trim())}`);

      if (params.length > 0) {
        url += '&' + params.join('&');
      }

      const res = await axios.get(url);
      setItems(res.data || []);
    } catch (err) {
      console.error('Ürün ve hammadde listesi alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [categoryFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const openCreateDrawer = () => {
    setEditingItem(null);
    setFormData({
      sku: '',
      name: '',
      category: 'RAW_MATERIAL',
      unit: 'kg',
      min_stock: '1000',
      shelf_life_days: '365',
      hazard_class: '',
      is_active: true,
      qc_incoming_required: false,
      qc_outgoing_required: false
    });
    setFormErrors({});
    setErrorMessage(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (item: ProductItem) => {
    setEditingItem(item);
    // Map database enum/category string to select values
    let catVal = 'RAW_MATERIAL';
    if (item.category === 'Raw Material' || item.category === 'RAW_MATERIAL' || item.category === 'Hammadde') {
      catVal = 'RAW_MATERIAL';
    } else if (item.category === 'Intermediate' || item.category === 'INTERMEDIATE' || item.category === 'Yarı Mamul') {
      catVal = 'INTERMEDIATE';
    } else if (item.category === 'Finished Good' || item.category === 'FINISHED_GOOD' || item.category === 'Mamul') {
      catVal = 'FINISHED_GOOD';
    } else if (item.category === 'Packaging' || item.category === 'PACKAGING' || item.category === 'Ambalaj') {
      catVal = 'PACKAGING';
    }

    setFormData({
      sku: item.sku,
      name: item.name,
      category: catVal,
      unit: item.unit || 'kg',
      min_stock: item.min_stock !== undefined ? String(item.min_stock) : '0',
      shelf_life_days: item.shelf_life_days !== undefined ? String(item.shelf_life_days) : '365',
      hazard_class: item.hazard_class || '',
      is_active: item.is_active,
      qc_incoming_required: item.qc_incoming_required || false,
      qc_outgoing_required: item.qc_outgoing_required || false
    });
    setFormErrors({});
    setErrorMessage(null);
    setIsDrawerOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.sku.trim()) errors.sku = 'Kod (SKU) alanı zorunludur.';
    if (!formData.name.trim()) errors.name = 'Ürün/Hammadde adı zorunludur.';
    if (!formData.unit.trim()) errors.unit = 'Birim seçilmelidir.';
    if (!formData.min_stock.trim() || isNaN(Number(formData.min_stock)) || Number(formData.min_stock) < 0) {
      errors.min_stock = 'Geçerli bir minimum stok giriniz (>= 0).';
    }
    if (!formData.shelf_life_days.trim() || isNaN(Number(formData.shelf_life_days)) || Number(formData.shelf_life_days) <= 0) {
      errors.shelf_life_days = 'Geçerli bir raf ömrü (gün) giriniz (> 0).';
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
      sku: formData.sku.trim().toUpperCase(),
      name: formData.name.trim(),
      category: formData.category,
      unit: formData.unit.trim(),
      min_stock: Number(formData.min_stock),
      shelf_life_days: Number(formData.shelf_life_days),
      hazard_class: formData.hazard_class.trim() || null,
      is_active: formData.is_active,
      qc_incoming_required: formData.qc_incoming_required,
      qc_outgoing_required: formData.qc_outgoing_required
    };

    try {
      if (editingItem) {
        await axios.put(`/api/v1/items/${editingItem.id}`, payload);
      } else {
        await axios.post('/api/v1/items/', payload);
      }
      setIsDrawerOpen(false);
      fetchItems();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Kayıt işlemi sırasında bir hata oluştu.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: ProductItem) => {
    try {
      await axios.patch(`/api/v1/items/${item.id}/toggle-active`);
      fetchItems();
    } catch (err: any) {
      console.error('Durum değiştirilemedi:', err);
      alert('İşlem başarısız: ' + (err.response?.data?.detail || 'Hata oluştu'));
    }
  };

  const getCategoryBadge = (cat: string) => {
    if (cat.includes('RAW') || cat === 'Hammadde' || cat === 'Raw Material') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-mod-stok-soft text-mod-stok border border-mod-stok-border">
          Hammadde
        </span>
      );
    }
    if (cat.includes('FINISHED') || cat === 'Mamul' || cat === 'Finished Good') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-mod-uretim-soft text-mod-uretim border border-mod-uretim-border">
          Mamul
        </span>
      );
    }
    if (cat.includes('INTERMEDIATE') || cat === 'Yarı Mamul' || cat === 'Intermediate') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-mod-satis-soft text-mod-satis border border-mod-satis-border">
          Yarı Mamul
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface text-text-muted border border-border">
        Ambalaj
      </span>
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
                Stok & Lojistik Modülü
              </span>
              <span className="text-xs text-text-muted">Master Kayıt Merkezi</span>
            </div>
            <h1 className="text-2xl font-bold text-text tracking-tight mt-1 flex items-center gap-2">
              <Layers className="w-6 h-6 text-mod-stok" />
              Ürünler & Hammaddeler
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Fabrika envanterindeki tüm kimyasal hammaddeler, yarı mamuller, mamuller ve ambalajların tanımları.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchItems}
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
              <span>Yeni Ürün / Hammadde Ekle</span>
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
                placeholder="Kod (SKU), ürün adı veya CAS no ara..."
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
              <span>Filtreler:</span>
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
            >
              <option value="ALL">Tüm Türler</option>
              <option value="Hammadde">Hammadde</option>
              <option value="Yarı Mamul">Yarı Mamul</option>
              <option value="Mamul">Mamul</option>
              <option value="Ambalaj">Ambalaj</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="ACTIVE">Yalnızca Aktif</option>
              <option value="INACTIVE">Yalnızca Pasif</option>
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
                <th className="py-3 px-4">Kod (SKU)</th>
                <th className="py-3 px-4">Ürün / Hammadde Adı</th>
                <th className="py-3 px-4">Tür</th>
                <th className="py-3 px-4">Birim</th>
                <th className="py-3 px-4 text-right">Min. Stok</th>
                <th className="py-3 px-4 text-right">Raf Ömrü</th>
                <th className="py-3 px-4">Tehlike Sınıfı</th>
                <th className="py-3 px-4 text-center">Durum</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <span>Kayıtlar yükleniyor...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted">
                    <Package className="w-8 h-8 mx-auto text-text-muted mb-2 opacity-50" />
                    <span>Kriterlere uygun ürün veya hammadde bulunamadı.</span>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-primary-soft/30 transition-colors ${!item.is_active ? 'opacity-60 bg-bg/50' : ''}`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-text">
                      {item.sku}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-text">{item.name}</div>
                      {item.cas_number && (
                        <div className="text-[11px] font-mono text-text-muted">
                          CAS: {item.cas_number}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {getCategoryBadge(item.category)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-text">
                      {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-text">
                      {item.min_stock !== undefined ? Number(item.min_stock).toLocaleString('tr-TR') : '-'} {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-text">
                      {item.shelf_life_days ? `${item.shelf_life_days} gün` : '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.hazard_class ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-warning-soft text-warning-text border border-warning-border">
                          <ShieldAlert className="w-3 h-3 text-warning" />
                          {item.hazard_class}
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.is_active ? (
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
                          onClick={() => openEditDrawer(item)}
                          className="border border-border hover:bg-primary-soft text-text hover:text-primary px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1"
                          title="Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Düzenle</span>
                        </button>
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`border border-border px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                            item.is_active
                              ? 'hover:bg-danger-soft text-text hover:text-danger-text hover:border-danger-border'
                              : 'hover:bg-success-soft text-text hover:text-success-text hover:border-success-border'
                          }`}
                          title={item.is_active ? 'Pasife Al' : 'Aktife Al'}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{item.is_active ? 'Pasife Al' : 'Aktife Al'}</span>
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
          <span>Toplam <strong>{items.length}</strong> kayıt listelendi</span>
          <span>Silme yerine güvenli pasife alma prensibi uygulanmaktadır.</span>
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
                  {editingItem ? 'Ürün / Hammadde Düzenle' : 'Yeni Ürün / Hammadde Ekle'}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Fabrika üretim ve stok kataloğu için kayıt oluşturun.
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
            <form id="product-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-danger-soft border border-danger-border text-danger-text text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-danger" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Kod (SKU) */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Kod (SKU) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Örn: SLES-70 veya GNY-SBN-01"
                  className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary font-mono uppercase ${
                    formErrors.sku ? 'border-danger' : 'border-border'
                  }`}
                />
                {formErrors.sku && (
                  <p className="text-[11px] text-danger-text mt-1">{formErrors.sku}</p>
                )}
              </div>

              {/* Ürün Adı */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Ürün / Hammadde Adı <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Örn: Sodyum Lauril Eter Sülfat %70 (SLES)"
                  className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary ${
                    formErrors.name ? 'border-danger' : 'border-border'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-danger-text mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Tür & Birim */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Malzeme Türü <span className="text-danger">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                  >
                    <option value="RAW_MATERIAL">Hammadde</option>
                    <option value="INTERMEDIATE">Yarı Mamul</option>
                    <option value="FINISHED_GOOD">Mamul</option>
                    <option value="PACKAGING">Ambalaj</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Birim <span className="text-danger">*</span>
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="L">L (Litre)</option>
                    <option value="adet">adet (Adet)</option>
                    <option value="ton">ton (Metrik Ton)</option>
                  </select>
                </div>
              </div>

              {/* Minimum Stok & Raf Ömrü */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Minimum Stok <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary font-mono ${
                      formErrors.min_stock ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {formErrors.min_stock && (
                    <p className="text-[11px] text-danger-text mt-1">{formErrors.min_stock}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Raf Ömrü (Gün) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.shelf_life_days}
                    onChange={(e) => setFormData({ ...formData, shelf_life_days: e.target.value })}
                    className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary font-mono ${
                      formErrors.shelf_life_days ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {formErrors.shelf_life_days && (
                    <p className="text-[11px] text-danger-text mt-1">{formErrors.shelf_life_days}</p>
                  )}
                </div>
              </div>

              {/* Tehlike Sınıfı */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Tehlike Sınıfı (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={formData.hazard_class}
                  onChange={(e) => setFormData({ ...formData, hazard_class: e.target.value })}
                  placeholder="Örn: 8 (Aşındırıcı) veya 3 (Alevlenir)"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-text-muted mt-1">ADR / Güvenlik bilgi formu tehlike kodu.</p>
              </div>

              {/* Kalite Kontrol Gereksinimleri */}
              <div className="pt-2 border-t border-border space-y-3">
                <span className="text-xs font-bold uppercase text-text-muted tracking-wider block">
                  Kalite Kontrol Zorunluluğu
                </span>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.qc_incoming_required}
                    onChange={(e) => setFormData({ ...formData, qc_incoming_required: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded border-border text-[#302480] focus:ring-[#302480]"
                  />
                  <div>
                    <span className="text-xs font-bold text-text">Giriş kontrolü gerekli</span>
                    <p className="text-[11px] text-text-muted">
                      Mal kabulde bu ürünün partileri otomatik olarak <strong>KARANTİNA</strong> durumuna alınır.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.qc_outgoing_required}
                    onChange={(e) => setFormData({ ...formData, qc_outgoing_required: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded border-border text-[#302480] focus:ring-[#302480]"
                  />
                  <div>
                    <span className="text-xs font-bold text-text">Çıkış kontrolü gerekli</span>
                    <p className="text-[11px] text-text-muted">
                      Üretim/dolum tamamlandığında mamul lotu otomatik olarak <strong>KARANTİNA</strong> durumuna alınır.
                    </p>
                  </div>
                </label>
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
                  <span className="text-sm font-semibold text-text">Kayıt Aktif</span>
                </label>
                <p className="text-xs text-text-muted mt-1 ml-6">
                  Pasife alınan ürünler yeni üretim veya sipariş formülasyonlarında listelenmez.
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
                form="product-form"
                disabled={saving}
                className="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2"
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{editingItem ? 'Güncelle' : 'Kaydet'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
