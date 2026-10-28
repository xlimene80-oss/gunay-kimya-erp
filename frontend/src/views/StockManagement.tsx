import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Package,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Warehouse,
  Boxes,
  MapPin,
  X,
  ShieldAlert
} from 'lucide-react';

interface StockItem {
  id: number;
  sku: string;
  name: string;
  unit: string;
  category: string;
  cas_number?: string;
  density?: number;
  current_quantity?: number;
  min_safety_stock?: number;
  warehouse?: string;
  fefo_lot?: string;
  fefo_lot_id?: number;
  fefo_lot_status?: string;
  fefo_expiry?: string;
  bin_id?: number;
  bin_code?: string;
  zone_name?: string;
  storage_class?: string;
  hazard_class?: string;
  signal_word?: string;
  ghs_pictograms?: string;
  daily_consumption?: number; // erime hızı
}

interface WarehouseBinOption {
  id: number;
  code: string;
  zone_id: number;
  zone_name: string;
  zone_storage_class: string;
  capacity_kg: number;
  is_active: boolean;
}

export const StockManagement: React.FC = () => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [bins, setBins] = useState<WarehouseBinOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');

  // Change Bin Modal state
  const [changeModalItem, setChangeModalItem] = useState<StockItem | null>(null);
  const [targetBinId, setTargetBinId] = useState<number | ''>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [validationResult, setValidationResult] = useState<{
    is_valid: boolean;
    is_mismatched?: boolean;
    requires_override?: boolean;
    warning_message?: string;
    zone_storage_class?: string;
  } | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const [res, binsRes] = await Promise.all([
        axios.get('/api/v1/inventory/stock-summary'),
        axios.get('/api/v1/hazmat/bins')
      ]);
      setBins(binsRes.data || []);

      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setItems(
          res.data.map((item: any) => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            unit: item.unit || 'kg',
            category: item.category,
            cas_number: item.cas_number,
            density: item.density,
            current_quantity: Number(item.current_quantity) || 0,
            min_safety_stock: Number(item.min_safety_stock) || 0,
            warehouse: item.warehouse || 'Hammadde Deposu',
            fefo_lot: item.fefo_lot || 'Parti Yok',
            fefo_lot_id: item.fefo_lot_id,
            fefo_lot_status: item.fefo_lot_status || 'Serbest',
            fefo_expiry: item.fefo_expiry || '-',
            bin_id: item.bin_id,
            bin_code: item.bin_code,
            zone_name: item.zone_name,
            storage_class: item.storage_class || 'Genel',
            hazard_class: item.hazard_class,
            signal_word: item.signal_word,
            ghs_pictograms: item.ghs_pictograms,
            daily_consumption: Number(item.daily_consumption) || 100
          }))
        );
      } else {
        const fallbackRes = await axios.get('/api/v1/items/?limit=100');
        const apiItems = fallbackRes.data || [];
        setItems(
          apiItems.map((item: any) => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            unit: item.unit || 'kg',
            category: item.category,
            cas_number: item.cas_number,
            density: item.density,
            current_quantity: Number(item.min_stock) * 2 || 2000,
            min_safety_stock: Number(item.min_stock) || 500,
            warehouse: 'Hammadde Deposu',
            fefo_lot: 'LOT-2026-001',
            fefo_expiry: '2027-12-31',
            bin_code: 'A-01',
            zone_name: 'Genel Depo',
            storage_class: item.storage_class || 'Genel',
            daily_consumption: 150
          }))
        );
      }
    } catch (err) {
      console.error('Stok bilgisi veya raflar alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const openChangeBinModal = (item: StockItem) => {
    setChangeModalItem(item);
    setTargetBinId(item.bin_id || '');
    setOverrideReason('');
    setValidationResult(null);
    setModalError(null);
  };

  const handleTargetBinChange = async (newBinId: number) => {
    setTargetBinId(newBinId);
    setModalError(null);
    if (!newBinId || !changeModalItem) {
      setValidationResult(null);
      return;
    }

    try {
      const res = await axios.post('/api/v1/hazmat/validate-placement', {
        item_id: changeModalItem.id,
        bin_id: newBinId
      });
      setValidationResult(res.data);
    } catch (err: any) {
      console.error('Yerleşim kontrolü başarısız:', err);
    }
  };

  const handleSaveBinAssignment = async () => {
    if (!changeModalItem || !targetBinId) return;

    if (!changeModalItem.fefo_lot_id) {
      setModalError('Bu ürün için aktif bir parti / lot kaydı bulunamadığından raf atanamaz.');
      return;
    }

    if (validationResult?.requires_override && (!overrideReason || !overrideReason.trim())) {
      setModalError('Depolama sınıfı uyuşmazlığı bulunmaktadır. Devam edebilmek için gerekçe yazılması zorunludur.');
      return;
    }

    setModalLoading(true);
    setModalError(null);
    try {
      const res = await axios.post('/api/v1/hazmat/assign-bin', {
        batch_lot_id: changeModalItem.fefo_lot_id,
        new_bin_id: Number(targetBinId),
        override_reason: overrideReason.trim() || undefined
      });

      setActionSuccess(res.data.message || 'Raf ataması başarıyla güncellendi.');
      setTimeout(() => setActionSuccess(null), 4000);
      setChangeModalItem(null);
      fetchStock();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Raf atanırken bir hata oluştu.';
      setModalError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setModalLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.cas_number && item.cas_number.includes(searchQuery)) ||
      (item.bin_code && item.bin_code.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat =
      selectedCategory === 'ALL' ||
      (selectedCategory === 'RAW' && item.category === 'Raw Material') ||
      (selectedCategory === 'FINISHED' && item.category === 'Finished Good');

    const matchesZone =
      selectedZone === 'ALL' ||
      (item.zone_name && item.zone_name.toLowerCase().includes(selectedZone.toLowerCase()));

    return matchesSearch && matchesCat && matchesZone;
  });

  const totalRawStock = items
    .filter((i) => i.category === 'Raw Material')
    .reduce((sum, i) => sum + (i.current_quantity || 0), 0);

  const criticalCount = items.filter(
    (i) => (i.current_quantity || 0) <= (i.min_safety_stock || 0)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border border-border text-text-muted">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
                Stok Yönetimi & Erime Hızları
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-success-soft text-success-text border border-success-border rounded-full">
                  FEFO Takibi Aktif
                </span>
              </h1>
              <p className="text-xs text-text-muted mt-1">
                Hammadde ve mamul stoklarının anlık miktarları, depo bölge ve raf yerleşimleri ile günlük tüketim hızları.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStock}
            className="px-3.5 py-2 bg-surface hover:bg-surface/80 text-text rounded-xl border border-border transition flex items-center gap-2 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${loading ? 'animate-spin' : ''}`} />
            Stokları Güncelle
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-4 bg-success-soft border border-success-border rounded-xl text-success-text text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Toplam Hammadde Stoğu
            </span>
            <Warehouse className="w-5 h-5 text-text-muted" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text font-mono">
              {totalRawStock.toLocaleString('tr-TR')}
            </span>
            <span className="text-xs text-text-muted font-medium font-mono">KG</span>
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Hammadde siloları ve varil depoları</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Kritik / Emniyet Sınırı Yaklaşan
            </span>
            <AlertTriangle className="w-5 h-5 text-text-muted" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text font-mono">{criticalCount}</span>
            <span className="text-xs text-text-muted font-medium">Kalem Malzeme</span>
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Sipariş tetikleme seviyesinde</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Kayıtlı Stok Kartı
            </span>
            <Boxes className="w-5 h-5 text-text-muted" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text font-mono">{items.length}</span>
            <span className="text-xs text-text-muted font-medium">Aktif SKU</span>
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Kimyasal hammadde ve ambalajlar</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
          <input
            type="text"
            placeholder="Malzeme adı, SKU, CAS veya Raf ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-text placeholder-text-muted focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Zone Filter */}
          <div className="flex items-center gap-1.5 bg-bg px-2.5 py-1 rounded-xl border border-border">
            <MapPin className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[11px] font-bold text-text-muted uppercase">Bölge:</span>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-transparent text-xs font-semibold text-text focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tüm Bölgeler</option>
              <option value="Genel Depo">Genel Depo</option>
              <option value="Asit Bölgesi">Asit Bölgesi</option>
              <option value="Baz Bölgesi">Baz Bölgesi</option>
              <option value="Yanıcı Bölgesi">Yanıcı Bölgesi</option>
              <option value="Soğuk Oda">Soğuk Oda (2-8 °C)</option>
              <option value="Karantina">Karantina Bölgesi</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                selectedCategory === 'ALL'
                  ? 'bg-primary border-primary text-white'
                  : 'bg-surface border-border text-text-muted hover:text-text'
              }`}
            >
              Tüm Malzemeler
            </button>
            <button
              onClick={() => setSelectedCategory('RAW')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                selectedCategory === 'RAW'
                  ? 'bg-primary border-primary text-white'
                  : 'bg-surface border-border text-text-muted hover:text-text'
              }`}
            >
              Hammaddeler
            </button>
            <button
              onClick={() => setSelectedCategory('FINISHED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                selectedCategory === 'FINISHED'
                  ? 'bg-primary border-primary text-white'
                  : 'bg-surface border-border text-text-muted hover:text-text'
              }`}
            >
              Mamuller
            </button>
          </div>
        </div>
      </div>

      {/* Stock Cards Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg text-text-muted uppercase font-bold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="p-4">SKU / Malzeme Adı</th>
                <th className="p-4">Depo & Bölge / Raf</th>
                <th className="p-4 text-right">Mevcut Stok</th>
                <th className="p-4 text-right">Emniyet Sınırı</th>
                <th className="p-4 text-center">Günlük Erime Hızı</th>
                <th className="p-4">Aktif FEFO Parti</th>
                <th className="p-4 text-center">Durum</th>
                <th className="p-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {filteredItems.map((item) => {
                const isCritical = (item.current_quantity || 0) <= (item.min_safety_stock || 0);
                const daysRemaining =
                  item.daily_consumption && item.daily_consumption > 0
                    ? Math.floor((item.current_quantity || 0) / item.daily_consumption)
                    : 99;

                return (
                  <tr key={item.id} className="hover:bg-bg/40 transition-colors">
                    {/* SKU & Name */}
                    <td className="p-4">
                      <div className="font-bold text-text text-sm">{item.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-text-muted">{item.sku}</span>
                        {item.cas_number && (
                          <span className="text-[10px] bg-bg text-text-muted px-1 rounded border border-border">
                            CAS: {item.cas_number}
                          </span>
                        )}
                        <span className="text-[10px] bg-primary-soft text-primary px-1.5 py-0.5 rounded border border-primary-border font-medium">
                          {item.storage_class || 'Genel'}
                        </span>
                      </div>
                    </td>

                    {/* Warehouse & Bin */}
                    <td className="p-4 text-text">
                      <div className="font-medium text-text">{item.warehouse}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-bg border border-border text-text">
                          <MapPin className="w-3 h-3 text-primary" />
                          {item.zone_name || 'Bölge Belirtilmemiş'} / {item.bin_code || 'Raf Yok'}
                        </span>
                      </div>
                    </td>

                    {/* Stock Quantity */}
                    <td className="p-4 text-right font-mono font-bold text-sm text-text">
                      {item.current_quantity?.toLocaleString('tr-TR')} {item.unit}
                    </td>

                    {/* Safety Stock */}
                    <td className="p-4 text-right font-mono text-text-muted">
                      {item.min_safety_stock?.toLocaleString('tr-TR')} {item.unit}
                    </td>

                    {/* Consumption Rate */}
                    <td className="p-4 text-center font-mono">
                      <div className="text-text font-bold flex items-center justify-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5 text-text-muted" />
                        ~{item.daily_consumption} {item.unit}/gün
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {daysRemaining} günlük rezerv
                      </div>
                    </td>

                    {/* FEFO Lot */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-text text-xs font-semibold">{item.fefo_lot}</span>
                        {item.fefo_lot_status && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.fefo_lot_status === 'Serbest'
                                ? 'bg-success-soft text-success-text border border-success-border'
                                : item.fefo_lot_status === 'Karantina'
                                ? 'bg-warning-soft text-warning-text border border-warning-border'
                                : 'bg-danger-soft text-danger-text border border-danger-border'
                            }`}
                          >
                            {item.fefo_lot_status}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-text-muted">SKT: {item.fefo_expiry}</div>
                      {item.fefo_lot_status === 'Karantina' && (
                        <div className="text-[10px] text-warning-text font-bold mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-warning" />
                          <span>Bu lot karantinada, kullanılamaz</span>
                        </div>
                      )}
                      {(item.fefo_lot_status === 'Bloke' || item.fefo_lot_status === 'Reddedildi') && (
                        <div className="text-[10px] text-danger-text font-bold mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-danger" />
                          <span>Bu lot {item.fefo_lot_status.toLowerCase()}, kullanılamaz</span>
                        </div>
                      )}
                    </td>

                    {/* Stock Status */}
                    <td className="p-4 text-center">
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-danger-soft text-danger-text border border-danger-border">
                          <AlertTriangle className="w-3 h-3 text-danger" /> Kritik Seviye
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-success-soft text-success-text border border-success-border">
                          <CheckCircle2 className="w-3 h-3 text-success" /> Güvenli
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="p-4 text-right">
                      {item.fefo_lot_id ? (
                        <button
                          onClick={() => openChangeBinModal(item)}
                          className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-bg text-[11px] font-bold text-primary transition shadow-xs"
                        >
                          Raf Değiştir
                        </button>
                      ) : (
                        <span className="text-[11px] text-text-muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CHANGE BIN MODAL */}
      {changeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-border bg-bg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-text">Depo Rafı Değiştir</h3>
              </div>
              <button
                onClick={() => setChangeModalItem(null)}
                className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Product Info */}
              <div className="p-3.5 bg-bg rounded-xl border border-border space-y-1">
                <div className="text-xs text-text-muted font-semibold uppercase tracking-wider">Malzeme & Parti</div>
                <div className="text-sm font-bold text-text">{changeModalItem.name}</div>
                <div className="flex items-center gap-2 text-xs font-mono text-text-muted pt-0.5">
                  <span>Parti: <strong className="text-text">{changeModalItem.fefo_lot}</strong></span>
                  <span>•</span>
                  <span>Sınıf: <strong className="text-primary">{changeModalItem.storage_class || 'Genel'}</strong></span>
                  <span>•</span>
                  <span>Mevcut: <strong className="text-text">{changeModalItem.zone_name || 'Bölge Yok'} / {changeModalItem.bin_code || 'Raf Yok'}</strong></span>
                </div>
              </div>

              {/* Shelf Selector */}
              <div>
                <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1.5">
                  Yeni Hedef Raf Seçiniz
                </label>
                <select
                  value={targetBinId}
                  onChange={(e) => handleTargetBinChange(Number(e.target.value))}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs text-text font-medium focus:outline-none focus:border-primary"
                >
                  <option value="">-- Hedef Raf Seçin --</option>
                  {bins.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} ({b.zone_name} • {b.zone_storage_class} • Kapasite: {b.capacity_kg} kg)
                    </option>
                  ))}
                </select>
              </div>

              {/* Validation Warning Alert */}
              {validationResult?.requires_override && (
                <div className="p-4 bg-danger-soft border border-danger-border rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-danger">Uyumsuzluk veya Bölge Uyarısı</div>
                      <div className="text-xs text-danger-text mt-0.5 font-medium leading-relaxed">
                        {validationResult.warning_message || 'Bu ürünün depolama sınıfı ile hedef raf bölgesi uyuşmamaktadır.'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-danger uppercase tracking-wider mt-2 mb-1">
                      Uyumsuzluk Gerekçesi (Zorunlu):
                    </label>
                    <textarea
                      rows={2}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Örn: Asit rafı dolu, geçici onaylı yerleşim veya ambalaj çift katmanlı."
                      className="w-full bg-surface border border-danger-border rounded-lg p-2 text-xs text-text placeholder-text-muted focus:outline-none focus:border-danger font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Validation Success */}
              {validationResult && !validationResult.requires_override && (
                <div className="p-3 bg-success-soft border border-success-border rounded-xl text-success-text text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Depolama sınıfı ve bölge tam uyumlu ({validationResult.zone_storage_class}).</span>
                </div>
              )}

              {/* Error Message */}
              {modalError && (
                <div className="p-3 bg-danger-soft border border-danger-border rounded-xl text-danger text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-bg flex items-center justify-between">
              <span className="text-[11px] text-text-muted italic">
                * Yapılan değişiklikler denetim izine (audit log) kaydedilir.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setChangeModalItem(null)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-text hover:bg-surface transition"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveBinAssignment}
                  disabled={modalLoading || !targetBinId}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  {modalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Kaydet ve Rafı Güncelle</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};