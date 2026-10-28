import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Layers,
  Plus,
  Edit2,
  RefreshCw,
  Search,
  ShieldAlert,
  Boxes,
  History,
  X
} from 'lucide-react';

export interface WarehouseBinItem {
  id: number;
  zone_id: number;
  code: string;
  capacity_kg: number;
  capacity_pallet: number;
  is_active: boolean;
  description?: string | null;
  current_lots_count: number;
}

export interface WarehouseZoneItem {
  id: number;
  name: string;
  code: string;
  storage_class: string;
  description?: string | null;
  is_active: boolean;
  bins: WarehouseBinItem[];
  total_bins: number;
  active_bins: number;
}

export interface IncompatibilityRule {
  id: number;
  class_a: string;
  class_b: string;
  reason: string;
  is_active: boolean;
}

export interface PlacementAuditRecord {
  id: number;
  batch_lot_id?: number | null;
  lot_number: string;
  item_name: string;
  action_type: string;
  previous_bin_code?: string | null;
  new_bin_code?: string | null;
  is_mismatched: boolean;
  item_storage_class?: string | null;
  bin_storage_class?: string | null;
  override_reason?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  created_at: string;
}

export const STORAGE_CLASSES = [
  'Genel',
  'Yanıcı',
  'Aşındırıcı-Asit',
  'Aşındırıcı-Baz',
  'Yükseltgen',
  'Soğuk (2-8 °C)',
  'Zehirli',
  'Karantina'
];

export const getStorageClassStyle = (storageClass: string) => {
  switch (storageClass) {
    case 'Aşındırıcı-Asit':
      return {
        bg: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
        badge: 'bg-red-600 text-white',
        border: 'border-l-red-600',
        label: 'Aşındırıcı-Asit'
      };
    case 'Aşındırıcı-Baz':
      return {
        bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
        badge: 'bg-purple-600 text-white',
        border: 'border-l-purple-600',
        label: 'Aşındırıcı-Baz'
      };
    case 'Yanıcı':
      return {
        bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
        badge: 'bg-amber-600 text-white',
        border: 'border-l-amber-600',
        label: 'Yanıcı'
      };
    case 'Yükseltgen':
      return {
        bg: 'bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-500/30',
        badge: 'bg-yellow-600 text-white',
        border: 'border-l-yellow-600',
        label: 'Yükseltgen'
      };
    case 'Soğuk (2-8 °C)':
      return {
        bg: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
        badge: 'bg-cyan-600 text-white',
        border: 'border-l-cyan-600',
        label: 'Soğuk (2-8 °C)'
      };
    case 'Karantina':
      return {
        bg: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
        badge: 'bg-amber-500 text-slate-900',
        border: 'border-l-amber-500',
        label: 'Karantina'
      };
    case 'Zehirli':
      return {
        bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
        badge: 'bg-rose-700 text-white',
        border: 'border-l-rose-700',
        label: 'Zehirli'
      };
    default:
      return {
        bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
        badge: 'bg-slate-600 text-white',
        border: 'border-l-slate-500',
        label: 'Genel'
      };
  }
};

export const WarehouseLayout: React.FC = () => {
  const [zones, setZones] = useState<WarehouseZoneItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showZoneModal, setShowZoneModal] = useState<boolean>(false);
  const [editingZone, setEditingZone] = useState<WarehouseZoneItem | null>(null);
  const [zoneName, setZoneName] = useState<string>('');
  const [zoneCode, setZoneCode] = useState<string>('');
  const [zoneStorageClass, setZoneStorageClass] = useState<string>('Genel');
  const [zoneDesc, setZoneDesc] = useState<string>('');

  const [showBinModal, setShowBinModal] = useState<boolean>(false);
  const [targetZoneId, setTargetZoneId] = useState<number | null>(null);
  const [binCode, setBinCode] = useState<string>('');
  const [binCapacityKg, setBinCapacityKg] = useState<string>('5000');
  const [binCapacityPallet, setBinCapacityPallet] = useState<string>('4');
  const [binDesc, setBinDesc] = useState<string>('');

  // Incompatibility Rules Modal
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [rules, setRules] = useState<IncompatibilityRule[]>([]);
  const [newRuleClassA, setNewRuleClassA] = useState<string>('Aşındırıcı-Asit');
  const [newRuleClassB, setNewRuleClassB] = useState<string>('Aşındırıcı-Baz');
  const [newRuleReason, setNewRuleReason] = useState<string>('');

  // Audit Log Modal
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [audits, setAudits] = useState<PlacementAuditRecord[]>([]);
  const [loadingAudits, setLoadingAudits] = useState<boolean>(false);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/v1/hazmat/zones');
      setZones(res.data);
    } catch (err) {
      console.error('Bölgeler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await axios.get('/api/v1/hazmat/incompatibility-rules');
      setRules(res.data);
    } catch (err) {
      console.error('Uyumsuzluk kuralları yüklenemedi:', err);
    }
  };

  const fetchAudits = async () => {
    setLoadingAudits(true);
    try {
      const res = await axios.get('/api/v1/hazmat/audits?limit=100');
      setAudits(res.data);
    } catch (err) {
      console.error('Denetim kayıtları yüklenemedi:', err);
    } finally {
      setLoadingAudits(false);
    }
  };

  useEffect(() => {
    fetchZones();
    fetchRules();
  }, []);

  // Save Zone
  const handleSaveZone = async () => {
    if (!zoneName.trim() || !zoneCode.trim()) {
      alert('Bölge adı ve kodu zorunludur.');
      return;
    }
    try {
      if (editingZone) {
        await axios.put(`/api/v1/hazmat/zones/${editingZone.id}`, {
          name: zoneName.trim(),
          storage_class: zoneStorageClass,
          description: zoneDesc.trim() || null
        });
      } else {
        await axios.post('/api/v1/hazmat/zones', {
          name: zoneName.trim(),
          code: zoneCode.trim(),
          storage_class: zoneStorageClass,
          description: zoneDesc.trim() || null
        });
      }
      setShowZoneModal(false);
      setEditingZone(null);
      fetchZones();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Bölge kaydedilirken hata oluştu.');
    }
  };

  // Save Bin
  const handleSaveBin = async () => {
    if (!targetZoneId || !binCode.trim()) {
      alert('Hedef bölge ve raf kodu zorunludur.');
      return;
    }
    try {
      await axios.post('/api/v1/hazmat/bins', {
        zone_id: targetZoneId,
        code: binCode.trim(),
        capacity_kg: parseFloat(binCapacityKg) || 5000,
        capacity_pallet: parseInt(binCapacityPallet, 10) || 4,
        description: binDesc.trim() || null
      });
      setShowBinModal(false);
      setBinCode('');
      setBinDesc('');
      fetchZones();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Raf kaydedilirken hata oluştu.');
    }
  };

  // Toggle Bin
  const handleToggleBin = async (binId: number) => {
    try {
      await axios.delete(`/api/v1/hazmat/bins/${binId}`);
      fetchZones();
    } catch (err) {
      console.error(err);
    }
  };

  // Add Incompatibility Rule
  const handleAddRule = async () => {
    if (!newRuleReason.trim()) {
      alert('Uyumsuzluk gerekçesi yazılması zorunludur.');
      return;
    }
    try {
      await axios.post('/api/v1/hazmat/incompatibility-rules', {
        class_a: newRuleClassA,
        class_b: newRuleClassB,
        reason: newRuleReason.trim()
      });
      setNewRuleReason('');
      fetchRules();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Kural eklenirken hata oluştu.');
    }
  };

  const handleToggleRule = async (ruleId: number) => {
    try {
      await axios.delete(`/api/v1/hazmat/incompatibility-rules/${ruleId}`);
      fetchRules();
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered zones
  const filteredZones = zones.filter((z) => {
    if (selectedClassFilter !== 'ALL' && z.storage_class !== selectedClassFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchZone = z.name.toLowerCase().includes(q) || z.code.toLowerCase().includes(q);
      const matchBin = z.bins.some((b) => b.code.toLowerCase().includes(q));
      return matchZone || matchBin;
    }
    return true;
  });

  const totalShelvesCount = zones.reduce((acc, z) => acc + z.bins.length, 0);
  const activeShelvesCount = zones.reduce((acc, z) => acc + z.active_bins, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-[#302480]/10 text-[#302480] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-text tracking-tight flex items-center gap-2">
                Depo Yerleşimi & Raf Yönetimi
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Kimyasal depolama sınıflarına göre bölgelendirme (zones), raf/göz tanımları ve çapraz uyumsuzluk kontrolleri.
              </p>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[11px] font-bold border border-border">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Bilgi Yönetimi: Yerleşim ve uyumsuzluk verileri operasyonel takip amaçlıdır, yasal bildirim yerine geçmez.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              fetchAudits();
              setShowAuditModal(true);
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text transition flex items-center gap-2 text-xs font-bold"
          >
            <History className="w-4 h-4 text-[#302480]" />
            <span>Denetim İzi</span>
          </button>

          <button
            onClick={() => setShowRulesModal(true)}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text transition flex items-center gap-2 text-xs font-bold"
          >
            <ShieldAlert className="w-4 h-4 text-warning" />
            <span>Uyumsuzluk Kuralları ({rules.length})</span>
          </button>

          <button
            onClick={() => {
              setEditingZone(null);
              setZoneName('');
              setZoneCode('');
              setZoneStorageClass('Genel');
              setZoneDesc('');
              setShowZoneModal(true);
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#302480] hover:bg-[#1E1654] text-white transition flex items-center gap-2 text-xs font-black shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Bölge Ekle</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-card">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Toplam Bölge</span>
          <span className="text-2xl font-black text-text font-mono mt-1 block">{zones.length}</span>
          <span className="text-[11px] text-text-muted mt-0.5 block">Depolama sınıfı tanımlı</span>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 shadow-card">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Aktif Raflar / Gözler</span>
          <span className="text-2xl font-black text-text font-mono mt-1 block">
            {activeShelvesCount} <span className="text-xs text-text-muted font-normal">/ {totalShelvesCount}</span>
          </span>
          <span className="text-[11px] text-text-muted mt-0.5 block">Kullanıma açık raf sayısı</span>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 shadow-card">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Uyumsuzluk Kuralları</span>
          <span className="text-2xl font-black text-warning font-mono mt-1 block">{rules.length}</span>
          <span className="text-[11px] text-text-muted mt-0.5 block">Çapraz blokaj kuralı</span>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 shadow-card">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Karantina Gözleri</span>
          <span className="text-2xl font-black text-amber-600 font-mono mt-1 block">
            {zones.find((z) => z.storage_class === 'Karantina')?.bins.length || 0}
          </span>
          <span className="text-[11px] text-text-muted mt-0.5 block">Q-01..Q-02 güvenlik gözleri</span>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Class Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedClassFilter('ALL')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              selectedClassFilter === 'ALL'
                ? 'bg-[#302480] text-white shadow-xs'
                : 'bg-surface border border-border text-text-muted hover:text-text'
            }`}
          >
            Tüm Bölgeler ({zones.length})
          </button>
          {STORAGE_CLASSES.map((cls) => {
            const count = zones.filter((z) => z.storage_class === cls).length;
            const style = getStorageClassStyle(cls);
            return (
              <button
                key={cls}
                onClick={() => setSelectedClassFilter(cls)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 border ${
                  selectedClassFilter === cls
                    ? `${style.badge} shadow-xs border-transparent`
                    : 'bg-surface border-border text-text-muted hover:text-text'
                }`}
              >
                {cls} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative sm:w-64 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Bölge veya raf kodu ara..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-[#302480]"
          />
        </div>
      </div>

      {/* Zones Grid */}
      {loading ? (
        <div className="min-h-[250px] flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredZones.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border rounded-2xl">
          <Boxes className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-text text-base">Eşleşen Depo Bölgesi Bulunamadı</h3>
          <p className="text-xs text-text-muted mt-1">Arama kriterlerinizi değiştirebilir veya yeni bir bölge ekleyebilirsiniz.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredZones.map((zone) => {
            const style = getStorageClassStyle(zone.storage_class);
            return (
              <div
                key={zone.id}
                className={`bg-surface border border-border border-l-4 ${style.border} rounded-2xl shadow-card p-5 flex flex-col justify-between transition hover:shadow-md`}
              >
                <div>
                  {/* Zone Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-text text-base tracking-tight">{zone.name}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-bg border border-border text-text-muted">
                          {zone.code}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-1 line-clamp-2">
                        {zone.description || 'Açıklama belirtilmemiş.'}
                      </p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 ${style.bg} border`}>
                      {zone.storage_class}
                    </span>
                  </div>

                  {/* Zone Meta */}
                  <div className="flex items-center justify-between text-xs py-2 border-y border-border my-3 text-text-muted">
                    <span>Toplam Raf: <strong>{zone.bins.length}</strong></span>
                    <span>Aktif: <strong className="text-success">{zone.active_bins}</strong></span>
                    <span>
                      Durum:{' '}
                      <strong className={zone.is_active ? 'text-success' : 'text-danger'}>
                        {zone.is_active ? 'Aktif' : 'Pasif'}
                      </strong>
                    </span>
                  </div>

                  {/* Shelves List */}
                  <div className="space-y-2 mt-3">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                      Raflar / Gözler
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {zone.bins.map((bin) => (
                        <div
                          key={bin.id}
                          className={`p-2.5 rounded-xl border text-xs transition flex flex-col justify-between ${
                            bin.is_active
                              ? 'bg-bg border-border hover:border-primary/40'
                              : 'bg-bg/40 border-border opacity-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-text text-sm">{bin.code}</span>
                            <button
                              onClick={() => handleToggleBin(bin.id)}
                              title={bin.is_active ? 'Pasife al' : 'Aktifleştir'}
                              className="text-[10px] font-bold text-text-muted hover:text-text underline"
                            >
                              {bin.is_active ? 'Pasif Yap' : 'Aktif Et'}
                            </button>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-muted">
                            <span>{bin.capacity_pallet} Palet</span>
                            <span className="font-bold text-primary">
                              {bin.current_lots_count > 0 ? `${bin.current_lots_count} Lot` : 'Boş'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {zone.bins.length === 0 && (
                        <div className="col-span-2 py-4 text-center text-xs text-text-muted italic">
                          Bu bölgede henüz raf tanımlanmamış.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Zone Bottom Action */}
                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => {
                      setTargetZoneId(zone.id);
                      setBinCode('');
                      setBinCapacityKg('5000');
                      setBinCapacityPallet('4');
                      setBinDesc('');
                      setShowBinModal(true);
                    }}
                    className="text-xs font-bold text-[#302480] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Raf Ekle</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingZone(zone);
                      setZoneName(zone.name);
                      setZoneCode(zone.code);
                      setZoneStorageClass(zone.storage_class);
                      setZoneDesc(zone.description || '');
                      setShowZoneModal(true);
                    }}
                    className="text-xs font-bold text-text-muted hover:text-text flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Düzenle</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT ZONE ================= */}
      {showZoneModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-text text-base">
                {editingZone ? 'Bölgeyi Düzenle' : 'Yeni Depo Bölgesi Ekle'}
              </h3>
              <button onClick={() => setShowZoneModal(false)} className="text-text-muted hover:text-text p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-text block mb-1">Bölge Adı *</label>
                <input
                  type="text"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="Örn: Asit Bölgesi"
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-[#302480]"
                />
              </div>

              <div>
                <label className="font-bold text-text block mb-1">Bölge Kodu *</label>
                <input
                  type="text"
                  value={zoneCode}
                  disabled={editingZone !== null}
                  onChange={(e) => setZoneCode(e.target.value.toUpperCase())}
                  placeholder="Örn: ZONE-ASIT"
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#302480] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="font-bold text-text block mb-1">Depolama Sınıfı *</label>
                <select
                  value={zoneStorageClass}
                  onChange={(e) => setZoneStorageClass(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-[#302480]"
                >
                  {STORAGE_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-text block mb-1">Açıklama</label>
                <textarea
                  rows={2}
                  value={zoneDesc}
                  onChange={(e) => setZoneDesc(e.target.value)}
                  placeholder="Havalandırma, güvenlik önlemleri vb."
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-[#302480]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowZoneModal(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text-muted hover:text-text"
              >
                İptal
              </button>
              <button
                onClick={handleSaveZone}
                className="px-5 py-2 rounded-xl bg-[#302480] hover:bg-[#1E1654] text-white text-xs font-black"
              >
                {editingZone ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD BIN ================= */}
      {showBinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-text text-base">Yeni Raf / Göz Tanımla</h3>
              <button onClick={() => setShowBinModal(false)} className="text-text-muted hover:text-text p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-text block mb-1">Hedef Bölge</label>
                <select
                  value={targetZoneId || ''}
                  onChange={(e) => setTargetZoneId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-[#302480]"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.storage_class})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-text block mb-1">Raf Kodu *</label>
                <input
                  type="text"
                  value={binCode}
                  onChange={(e) => setBinCode(e.target.value.toUpperCase())}
                  placeholder="Örn: B-03, Q-03"
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#302480]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text block mb-1">Kapasite (KG)</label>
                  <input
                    type="number"
                    value={binCapacityKg}
                    onChange={(e) => setBinCapacityKg(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-[#302480]"
                  />
                </div>
                <div>
                  <label className="font-bold text-text block mb-1">Kapasite (Palet)</label>
                  <input
                    type="number"
                    value={binCapacityPallet}
                    onChange={(e) => setBinCapacityPallet(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-[#302480]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text block mb-1">Açıklama</label>
                <input
                  type="text"
                  value={binDesc}
                  onChange={(e) => setBinDesc(e.target.value)}
                  placeholder="Konum notu veya zemin özellikleri"
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-[#302480]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowBinModal(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text-muted hover:text-text"
              >
                İptal
              </button>
              <button
                onClick={handleSaveBin}
                className="px-5 py-2 rounded-xl bg-[#302480] hover:bg-[#1E1654] text-white text-xs font-black"
              >
                Rafı Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: INCOMPATIBILITY RULES ================= */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-warning" />
                <h3 className="font-black text-text text-base">Çapraz Depolama Uyumsuzluk Kuralları</h3>
              </div>
              <button onClick={() => setShowRulesModal(false)} className="text-text-muted hover:text-text p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Kimyasal maddelerin tehlikeli reaksiyon oluşturmasını önlemek için aynı bölgede bir arada tutulması yasaklanan depolama sınıfları.
            </p>

            {/* Existing Rules Table */}
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-bg text-text-muted font-bold">
                  <tr>
                    <th className="p-3">Sınıf A</th>
                    <th className="p-3">Sınıf B</th>
                    <th className="p-3">Risk & Gerekçe</th>
                    <th className="p-3 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-bg/50">
                      <td className="p-3 font-black text-text">{rule.class_a}</td>
                      <td className="p-3 font-black text-text">{rule.class_b}</td>
                      <td className="p-3 text-text-muted">{rule.reason}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            rule.is_active
                              ? 'bg-success-soft text-success border border-success-border'
                              : 'bg-bg text-text-muted border border-border'
                          }`}
                        >
                          {rule.is_active ? 'Aktif' : 'Pasif'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rules.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-text-muted">
                        Kayıtlı uyumsuzluk kuralı bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add New Rule */}
            <div className="p-4 rounded-xl bg-bg border border-border space-y-3">
              <h4 className="font-black text-xs text-text uppercase tracking-wider">Yeni Uyumsuzluk Kuralı Tanımla</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-text block mb-1">1. Depolama Sınıfı</label>
                  <select
                    value={newRuleClassA}
                    onChange={(e) => setNewRuleClassA(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border"
                  >
                    {STORAGE_CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-text block mb-1">2. Depolama Sınıfı</label>
                  <select
                    value={newRuleClassB}
                    onChange={(e) => setNewRuleClassB(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-border"
                  >
                    {STORAGE_CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-text block mb-1 text-xs">Uyuşmazlık Sebebi & Reaksiyon Riski *</label>
                <input
                  type="text"
                  value={newRuleReason}
                  onChange={(e) => setNewRuleReason(e.target.value)}
                  placeholder="Örn: Asit-baz şiddetli ısı çıkışı veya zehirli gaz salınımı"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-surface border border-border"
                />
              </div>

              <div className="text-right pt-1">
                <button
                  onClick={handleAddRule}
                  className="px-4 py-2 rounded-xl bg-[#302480] hover:bg-[#1E1654] text-white text-xs font-bold"
                >
                  Kuralı Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: AUDIT TRAIL ================= */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#302480]" />
                <h3 className="font-black text-text text-base">Depo & GBF Denetim İzi (Audit Log)</h3>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="text-text-muted hover:text-text p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Raf atamaları, uyumsuzluk onayları ve GBF değişiklikleri yasal denetim gereği değiştirilemez şekilde kayıt altına alınır.
            </p>

            {loadingAudits ? (
              <div className="py-12 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
              </div>
            ) : audits.length === 0 ? (
              <div className="py-8 text-center text-text-muted text-xs">
                Kayıtlı denetim hareketi bulunamadı.
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-bg text-text-muted font-bold">
                    <tr>
                      <th className="p-3">Tarih / Saat</th>
                      <th className="p-3">İşlem</th>
                      <th className="p-3">Ürün / Lot</th>
                      <th className="p-3">Raf Hareketi</th>
                      <th className="p-3">Gerekçe / Not</th>
                      <th className="p-3 text-right">Kullanıcı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {audits.map((a) => (
                      <tr key={a.id} className="hover:bg-bg/50">
                        <td className="p-3 font-mono text-[11px] text-text-muted whitespace-nowrap">
                          {a.created_at}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              a.is_mismatched
                                ? 'bg-danger-soft text-danger border border-danger-border'
                                : 'bg-primary-soft text-primary'
                            }`}
                          >
                            {a.action_type}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-text">
                          {a.item_name}
                          <span className="block text-[11px] font-mono text-text-muted">{a.lot_number}</span>
                        </td>
                        <td className="p-3 font-mono">
                          {a.previous_bin_code ? `${a.previous_bin_code} → ` : ''}
                          <strong className="text-primary">{a.new_bin_code || 'N/A'}</strong>
                        </td>
                        <td className="p-3 text-text-muted max-w-xs truncate" title={a.override_reason || ''}>
                          {a.override_reason || '-'}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <span className="font-bold text-text block">{a.user_name || 'Sistem'}</span>
                          <span className="text-[10px] text-text-muted font-mono">{a.user_email}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
