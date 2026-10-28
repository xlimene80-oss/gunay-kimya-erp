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
  ShieldAlert,
  FileText,
  ExternalLink,
  Eye,
  Trash2
} from 'lucide-react';
import { GhsPictogram, GHS_DEFINITIONS } from '../components/GhsPictogram';
import { STORAGE_CLASSES } from './WarehouseLayout';

export interface ProductItem {
  id: number;
  sku: string;
  name: string;
  unit: string;
  category: string;
  cas_number?: string | null;
  un_number?: string | null;
  density?: number | null;
  min_stock?: number;
  shelf_life_days?: number;
  hazard_class?: string | null;
  signal_word?: string | null;
  ghs_pictograms?: string | null;
  storage_class?: string | null;
  temp_min?: number | null;
  temp_max?: number | null;
  sds_file_url?: string | null;
  sds_file_name?: string | null;
  sds_revision_date?: string | null;
  hazard_notes?: string | null;
  is_active: boolean;
  qc_incoming_required?: boolean;
  qc_outgoing_required?: boolean;
}

interface ProductsManagementProps {
  initialFilter?: 'ALL' | 'HAZARDOUS' | 'SDS_WARNING';
}

export const ProductsManagement: React.FC<ProductsManagementProps> = ({ initialFilter = 'ALL' }) => {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [hazardQuickFilter, setHazardQuickFilter] = useState<'ALL' | 'HAZARDOUS' | 'SDS_WARNING'>(initialFilter);

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
    is_active: true,
    qc_incoming_required: false,
    qc_outgoing_required: false,
    // Hazmat & Storage fields
    cas_number: '',
    un_number: '',
    hazard_class: '',
    signal_word: 'Yok',
    ghs_pictograms: [] as string[],
    storage_class: 'Genel',
    temp_min: '',
    temp_max: '',
    sds_file_url: '' as string | null,
    sds_file_name: '' as string | null,
    sds_revision_date: '',
    hazard_notes: ''
  });

  const [selectedSdsFile, setSelectedSdsFile] = useState<File | null>(null);
  const [uploadingSds, setUploadingSds] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const isSdsExpired = (revDateStr?: string | null, validityMonths = 36) => {
    if (!revDateStr) return false;
    try {
      const rev = new Date(revDateStr);
      const now = new Date();
      const diffMonths = (now.getFullYear() - rev.getFullYear()) * 12 + (now.getMonth() - rev.getMonth());
      return diffMonths >= validityMonths;
    } catch {
      return false;
    }
  };

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
    setSelectedSdsFile(null);
    setFormData({
      sku: '',
      name: '',
      category: 'RAW_MATERIAL',
      unit: 'kg',
      min_stock: '1000',
      shelf_life_days: '365',
      is_active: true,
      qc_incoming_required: false,
      qc_outgoing_required: false,
      cas_number: '',
      un_number: '',
      hazard_class: '',
      signal_word: 'Yok',
      ghs_pictograms: [],
      storage_class: 'Genel',
      temp_min: '',
      temp_max: '',
      sds_file_url: null,
      sds_file_name: null,
      sds_revision_date: '',
      hazard_notes: ''
    });
    setFormErrors({});
    setErrorMessage(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (item: ProductItem) => {
    setEditingItem(item);
    setSelectedSdsFile(null);

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

    let parsedGhs: string[] = [];
    if (item.ghs_pictograms) {
      try {
        parsedGhs = JSON.parse(item.ghs_pictograms);
      } catch {
        parsedGhs = [];
      }
    }

    setFormData({
      sku: item.sku,
      name: item.name,
      category: catVal,
      unit: item.unit || 'kg',
      min_stock: item.min_stock !== undefined ? String(item.min_stock) : '0',
      shelf_life_days: item.shelf_life_days !== undefined ? String(item.shelf_life_days) : '365',
      is_active: item.is_active,
      qc_incoming_required: item.qc_incoming_required || false,
      qc_outgoing_required: item.qc_outgoing_required || false,
      cas_number: item.cas_number || '',
      un_number: item.un_number || '',
      hazard_class: item.hazard_class || '',
      signal_word: item.signal_word || 'Yok',
      ghs_pictograms: parsedGhs,
      storage_class: item.storage_class || 'Genel',
      temp_min: item.temp_min !== undefined && item.temp_min !== null ? String(item.temp_min) : '',
      temp_max: item.temp_max !== undefined && item.temp_max !== null ? String(item.temp_max) : '',
      sds_file_url: item.sds_file_url || null,
      sds_file_name: item.sds_file_name || null,
      sds_revision_date: item.sds_revision_date || '',
      hazard_notes: item.hazard_notes || ''
    });
    setFormErrors({});
    setErrorMessage(null);
    setIsDrawerOpen(true);
  };

  const toggleGhsPictogram = (code: string) => {
    setFormData((prev) => {
      const exists = prev.ghs_pictograms.includes(code);
      if (exists) {
        return { ...prev, ghs_pictograms: prev.ghs_pictograms.filter((c) => c !== code) };
      } else {
        return { ...prev, ghs_pictograms: [...prev.ghs_pictograms, code] };
      }
    });
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
      is_active: formData.is_active,
      qc_incoming_required: formData.qc_incoming_required,
      qc_outgoing_required: formData.qc_outgoing_required,
      cas_number: formData.cas_number.trim() || null,
      un_number: formData.un_number.trim() || null,
      hazard_class: formData.hazard_class.trim() || null,
      signal_word: formData.signal_word || 'Yok',
      ghs_pictograms: JSON.stringify(formData.ghs_pictograms),
      storage_class: formData.storage_class || 'Genel',
      temp_min: formData.temp_min ? Number(formData.temp_min) : null,
      temp_max: formData.temp_max ? Number(formData.temp_max) : null,
      sds_revision_date: formData.sds_revision_date || null,
      hazard_notes: formData.hazard_notes.trim() || null
    };

    try {
      let savedItemId = editingItem?.id;
      if (editingItem) {
        await axios.put(`/api/v1/items/${editingItem.id}`, payload);
      } else {
        const res = await axios.post('/api/v1/items/', payload);
        savedItemId = res.data?.id;
      }

      // If SDS file was selected, upload it
      if (selectedSdsFile && savedItemId) {
        setUploadingSds(true);
        const sdsFormData = new FormData();
        sdsFormData.append('file', selectedSdsFile);
        if (formData.sds_revision_date) {
          sdsFormData.append('sds_revision_date', formData.sds_revision_date);
        }
        await axios.post(`/api/v1/hazmat/items/${savedItemId}/sds-upload`, sdsFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setIsDrawerOpen(false);
      fetchItems();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Kayıt işlemi sırasında bir hata oluştu.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
      setUploadingSds(false);
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

  const handleDeleteSds = async (itemId: number) => {
    if (!confirm('GBF (SDS) dosyasını kaldırmak istediğinize emin misiniz?')) return;
    try {
      await axios.delete(`/api/v1/hazmat/items/${itemId}/sds`);
      setFormData((prev) => ({ ...prev, sds_file_url: null, sds_file_name: null }));
      fetchItems();
    } catch (err: any) {
      alert('GBF silinemedi: ' + (err.response?.data?.detail || 'Hata'));
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

  // Filter items based on Quick Hazard filter
  const displayedItems = items.filter((item) => {
    const isHazardous =
      Boolean(item.hazard_class) ||
      (item.ghs_pictograms && item.ghs_pictograms !== '[]') ||
      (item.signal_word && item.signal_word !== 'Yok');

    if (hazardQuickFilter === 'HAZARDOUS') {
      return isHazardous;
    }
    if (hazardQuickFilter === 'SDS_WARNING') {
      if (!isHazardous) return false;
      const isMissing = !item.sds_file_url;
      const isExpired = isSdsExpired(item.sds_revision_date, 36);
      return isMissing || isExpired;
    }
    return true;
  });

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
              <span className="text-xs text-text-muted">Master Kayıt & Tehlikeli Madde Yönetimi</span>
            </div>
            <h1 className="text-2xl font-bold text-text tracking-tight mt-1 flex items-center gap-2">
              <Layers className="w-6 h-6 text-mod-stok" />
              Ürünler & Hammaddeler
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Kimyasal hammaddeler, GHS tehlike piktogramları, depolama sınıfları ve Güvenlik Bilgi Formları (GBF/SDS).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchItems}
              disabled={loading}
              className="border border-border hover:bg-surface-hover text-text px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm bg-surface"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>
            <button
              onClick={openCreateDrawer}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm flex items-center gap-2 text-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Ürün / Hammadde</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Pills (Hazardous / SDS Status) */}
        <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-text-muted mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtrele:
          </span>
          <button
            onClick={() => setHazardQuickFilter('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
              hazardQuickFilter === 'ALL'
                ? 'bg-[#302480] text-white shadow-xs'
                : 'bg-bg text-text-muted hover:text-text border border-border'
            }`}
          >
            Tüm Kayıtlar ({items.length})
          </button>
          <button
            onClick={() => setHazardQuickFilter('HAZARDOUS')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition border ${
              hazardQuickFilter === 'HAZARDOUS'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-bg text-text-muted hover:text-text border-border'
            }`}
          >
            Tehlikeli Maddeler
          </button>
          <button
            onClick={() => setHazardQuickFilter('SDS_WARNING')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
              hazardQuickFilter === 'SDS_WARNING'
                ? 'bg-danger text-white border-danger shadow-xs'
                : 'bg-bg text-danger hover:bg-danger-soft border-border'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>GBF Eksik / Eski</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-card flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ürün adı, SKU, CAS No veya UN No ile ara..."
            className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"
          />
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
          >
            <option value="ALL">Tüm Malzeme Türleri</option>
            <option value="RAW_MATERIAL">Hammadde</option>
            <option value="INTERMEDIATE">Yarı Mamul</option>
            <option value="FINISHED_GOOD">Mamul</option>
            <option value="PACKAGING">Ambalaj</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
          >
            <option value="ALL">Tüm Durumlar</option>
            <option value="ACTIVE">Yalnızca Aktif</option>
            <option value="INACTIVE">Pasife Alınmış</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface border border-border rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-bg border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Kod & Kimlik</th>
                <th className="py-3 px-4">Ürün / Hammadde Adı</th>
                <th className="py-3 px-4">Tür & Sınıf</th>
                <th className="py-3 px-4">Tehlike & GHS</th>
                <th className="py-3 px-4">GBF / SDS Durumu</th>
                <th className="py-3 px-4 text-right">Min. Stok</th>
                <th className="py-3 px-4 text-center">Durum</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <span>Kayıtlar yükleniyor...</span>
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    <Package className="w-8 h-8 mx-auto text-text-muted mb-2 opacity-50" />
                    <span>Kriterlere uygun ürün veya hammadde bulunamadı.</span>
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => {
                  let pictograms: string[] = [];
                  if (item.ghs_pictograms) {
                    try {
                      pictograms = JSON.parse(item.ghs_pictograms);
                    } catch {
                      pictograms = [];
                    }
                  }

                  const isExpired = isSdsExpired(item.sds_revision_date, 36);
                  const isHazardous =
                    Boolean(item.hazard_class) ||
                    pictograms.length > 0 ||
                    (item.signal_word && item.signal_word !== 'Yok');

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-primary-soft/30 transition-colors ${!item.is_active ? 'opacity-60 bg-bg/50' : ''}`}
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-text block">{item.sku}</span>
                        {item.cas_number && (
                          <span className="text-[10px] font-mono text-text-muted block">
                            CAS: {item.cas_number}
                          </span>
                        )}
                        {item.un_number && (
                          <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 block font-bold">
                            UN {item.un_number}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-text">{item.name}</div>
                        {item.hazard_notes && (
                          <div className="text-[10px] text-text-muted line-clamp-1 italic">
                            {item.hazard_notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {getCategoryBadge(item.category)}
                          {item.storage_class && (
                            <span className="block text-[10px] font-bold text-text-muted">
                              Depo: {item.storage_class}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Hazard & GHS Pictograms */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {pictograms.map((pic) => (
                            <GhsPictogram key={pic} code={pic} size="xs" />
                          ))}
                          {item.signal_word && item.signal_word !== 'Yok' && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                item.signal_word === 'Tehlike'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-amber-500 text-slate-900'
                              }`}
                            >
                              {item.signal_word}
                            </span>
                          )}
                          {!isHazardous && (
                            <span className="text-xs text-text-muted">-</span>
                          )}
                        </div>
                      </td>

                      {/* SDS / GBF Status Column */}
                      <td className="py-3.5 px-4">
                        {item.sds_file_url ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                  isExpired
                                    ? 'bg-warning-soft text-warning border border-warning-border'
                                    : 'bg-success-soft text-success border border-success-border'
                                }`}
                              >
                                <FileText className="w-3 h-3" />
                                {isExpired ? 'Eski GBF' : 'GBF Var'}
                              </span>
                              <a
                                href={item.sds_file_url}
                                target="_blank"
                                rel="noreferrer"
                                title="GBF'yi yeni sekmede aç"
                                className="p-1 rounded text-primary hover:bg-primary-soft transition"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <span className="text-[10px] text-text-muted block">
                              Rev: {item.sds_revision_date || 'Belirtilmedi'}
                            </span>
                            {isExpired && (
                              <span className="text-[10px] font-bold text-warning block">
                                ⚠️ Güncel olmayabilir ({'>'}36 ay)
                              </span>
                            )}
                          </div>
                        ) : isHazardous ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-danger-soft text-danger border border-danger-border">
                            <AlertTriangle className="w-3 h-3" />
                            GBF Eksik
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">Gerekli Değil</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-text">
                        {item.min_stock !== undefined ? Number(item.min_stock).toLocaleString('tr-TR') : '-'}{' '}
                        {item.unit}
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
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditDrawer(item)}
                            className="p-1.5 rounded-lg border border-border hover:bg-surface-hover text-text transition-colors"
                            title="Düzenle"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-text-muted" />
                          </button>

                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              item.is_active
                                ? 'border-border hover:bg-danger-soft text-text-muted hover:text-danger'
                                : 'border-success-border bg-success-soft text-success hover:bg-success hover:text-white'
                            }`}
                            title={item.is_active ? 'Pasife Al' : 'Aktifleştir'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= DRAWER (CREATE / EDIT PRODUCT) ================= */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-surface border-l border-border h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-text">
                  {editingItem ? 'Ürün / Hammadde Düzenle' : 'Yeni Ürün / Hammadde Kaydı'}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Temel kimlik, formülasyon parametreleri, GHS tehlike ve Güvenlik Bilgi Formu.
                </p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg border border-border hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Form Body */}
            <form
              id="product-form"
              onSubmit={handleSave}
              className="p-6 space-y-4 overflow-y-auto flex-1 text-xs"
            >
              {errorMessage && (
                <div className="p-3 bg-danger-soft border border-danger-border rounded-lg text-danger-text text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Temel Bilgiler */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Kod (SKU) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="Örn: SLES-70"
                    disabled={editingItem !== null}
                    className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text font-mono uppercase focus:outline-none focus:border-primary disabled:opacity-50 ${
                      formErrors.sku ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {formErrors.sku && (
                    <p className="text-[11px] text-danger-text mt-1">{formErrors.sku}</p>
                  )}
                </div>

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
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Ürün / Hammadde Adı <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Örn: Sodyum Lauril Eter Sülfat (%70 SLES)"
                  className={`w-full px-3 py-2 bg-bg border rounded-lg text-sm text-text focus:outline-none focus:border-primary ${
                    formErrors.name ? 'border-danger' : 'border-border'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-danger-text mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Birim, Min Stok & Raf Ömrü */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">Birim *</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="L">L (Litre)</option>
                    <option value="adet">adet</option>
                    <option value="ton">ton</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">Min. Stok *</label>
                  <input
                    type="number"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">Raf Ömrü (Gün) *</label>
                  <input
                    type="number"
                    value={formData.shelf_life_days}
                    onChange={(e) => setFormData({ ...formData, shelf_life_days: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text font-mono"
                  />
                </div>
              </div>

              {/* ================= TEHLİKE VE DEPOLAMA BİLGİLERİ ================= */}
              <div className="pt-3 border-t-2 border-[#302480]/20 space-y-3.5 bg-bg/50 p-3.5 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-[#302480] tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-warning" />
                    Tehlike ve Depolama Bilgileri
                  </span>
                  <span className="text-[10px] text-text-muted italic">Bilgi Yönetimi</span>
                </div>

                {/* CAS No & UN No */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-text block mb-1">CAS Numarası</label>
                    <input
                      type="text"
                      value={formData.cas_number}
                      onChange={(e) => setFormData({ ...formData, cas_number: e.target.value })}
                      placeholder="Örn: 27176-87-0"
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-text block mb-1">UN Numarası</label>
                    <input
                      type="text"
                      value={formData.un_number}
                      onChange={(e) => setFormData({ ...formData, un_number: e.target.value })}
                      placeholder="Örn: 2586 veya 1824"
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg font-mono"
                    />
                  </div>
                </div>

                {/* Tehlike Sınıfı & Sinyal Kelimesi */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-text block mb-1">Tehlike Sınıfı (Serbest Metin)</label>
                    <input
                      type="text"
                      value={formData.hazard_class}
                      onChange={(e) => setFormData({ ...formData, hazard_class: e.target.value })}
                      placeholder="Örn: Sınıf 8 (Aşındırıcı)"
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-text block mb-1">Sinyal Kelimesi</label>
                    <select
                      value={formData.signal_word}
                      onChange={(e) => setFormData({ ...formData, signal_word: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg font-bold"
                    >
                      <option value="Yok">Yok / Belirtilmemiş</option>
                      <option value="Dikkat">Dikkat (Warning)</option>
                      <option value="Tehlike">Tehlike (Danger)</option>
                    </select>
                  </div>
                </div>

                {/* GHS Piktogramları Çoklu Seçim */}
                <div>
                  <label className="font-bold text-text block mb-1.5">
                    GHS Piktogramları (Seçmek için dokunun)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {GHS_DEFINITIONS.map((def) => {
                      const isSelected = formData.ghs_pictograms.includes(def.code);
                      return (
                        <button
                          type="button"
                          key={def.code}
                          onClick={() => toggleGhsPictogram(def.code)}
                          className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                            isSelected
                              ? 'bg-red-500/10 border-red-500 ring-2 ring-red-500/30'
                              : 'bg-surface border-border hover:bg-surface-hover opacity-70'
                          }`}
                        >
                          <GhsPictogram code={def.code} size="xs" />
                          <span className={`text-[10px] font-bold leading-tight ${isSelected ? 'text-red-700 dark:text-red-400' : 'text-text-muted'}`}>
                            {def.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Depolama Sınıfı & Sıcaklık Aralığı */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-text block mb-1">Depolama Sınıfı *</label>
                    <select
                      value={formData.storage_class}
                      onChange={(e) => setFormData({ ...formData, storage_class: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg font-bold"
                    >
                      {STORAGE_CLASSES.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-text block mb-1">Min. Sıcaklık (°C)</label>
                    <input
                      type="number"
                      value={formData.temp_min}
                      onChange={(e) => setFormData({ ...formData, temp_min: e.target.value })}
                      placeholder="Örn: 2"
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-text block mb-1">Max. Sıcaklık (°C)</label>
                    <input
                      type="number"
                      value={formData.temp_max}
                      onChange={(e) => setFormData({ ...formData, temp_max: e.target.value })}
                      placeholder="Örn: 8"
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg font-mono"
                    />
                  </div>
                </div>

                {/* Güvenlik Bilgi Formu (GBF / SDS) Yükleme */}
                <div className="p-3 bg-surface border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-primary" />
                      Güvenlik Bilgi Formu (GBF / SDS)
                    </span>
                    {formData.sds_file_url && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={formData.sds_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-bold flex items-center gap-1 hover:bg-primary-hover shadow-xs"
                        >
                          <Eye className="w-3 h-3" />
                          <span>GBF'yi Görüntüle</span>
                        </a>
                        {editingItem && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSds(editingItem.id)}
                            className="p-1 rounded-lg text-danger hover:bg-danger-soft transition"
                            title="GBF Dosyasını Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {formData.sds_file_url && isSdsExpired(formData.sds_revision_date, 36) && (
                    <div className="p-2 bg-warning-soft border border-warning-border rounded-lg text-warning text-[11px] font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>GBF güncel olmayabilir (revizyon tarihi 36 aydan eski).</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-text block mb-1">Revizyon Tarihi</label>
                      <input
                        type="date"
                        value={formData.sds_revision_date}
                        onChange={(e) => setFormData({ ...formData, sds_revision_date: e.target.value })}
                        className="w-full px-3 py-1.5 bg-bg border border-border rounded-lg font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-text block mb-1">Yeni PDF Yükle (Maks 10MB)</label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setSelectedSdsFile(e.target.files[0]);
                          }
                        }}
                        className="w-full text-xs text-text-muted file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary-soft file:text-primary hover:file:bg-primary/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Yasal Uyarı Notu */}
                <p className="text-[10px] text-text-muted italic border-t border-border pt-1">
                  * Örnek veri, bilgilendirme amaçlıdır. Yasal uyum veya lisans garantisi yerine geçmez.
                </p>
              </div>

              {/* Kalite Kontrol Zorunluluğu */}
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
                disabled={saving || uploadingSds}
                className="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2"
              >
                {(saving || uploadingSds) && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{editingItem ? 'Güncelle' : 'Kaydet'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
