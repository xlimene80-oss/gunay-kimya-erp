import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FlaskConical,
  RefreshCw,
  Search,
  ShieldCheck,
  Ban,
  X,
  ChevronRight,
  Layers,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { QualityCoaModal, CoaDetailData } from '../components/QualityCoaModal';

interface PendingTestItem {
  id: number;
  test_name: string;
  unit: string;
  min_value: number | null;
  max_value: number | null;
  expected_text?: string | null;
  method?: string | null;
  order_index: number;
}

interface PendingLot {
  lot_id: number;
  batch_number: string;
  item_id: number;
  item_name: string;
  item_sku: string;
  item_category: string;
  warehouse: string;
  quantity: number;
  unit: string;
  status: string;
  source: string;
  received_at?: string | null;
  wait_time_display: string;
  expiration_date?: string | null;
  qc_notes?: string | null;
  has_template: boolean;
  template_id?: number | null;
  template_name?: string | null;
  tests: PendingTestItem[];
}

interface TestFormState {
  test_name: string;
  unit: string;
  min_value: number | null;
  max_value: number | null;
  expected_text?: string | null;
  method?: string | null;
  measured_value: string;
  measured_text: string;
  is_passed: boolean;
}

interface QualityPendingProps {
  onNavigate?: (view: string) => void;
}

export const QualityPending: React.FC<QualityPendingProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [lots, setLots] = useState<PendingLot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'MAL_KABUL' | 'URETIM'>('ALL');

  // Inspection modal state
  const [activeLot, setActiveLot] = useState<PendingLot | null>(null);
  const [testFormValues, setTestFormValues] = useState<TestFormState[]>([]);
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [inspectorNotes, setInspectorNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Ready CoA modal preview upon successful release
  const [previewCoa, setPreviewCoa] = useState<CoaDetailData | null>(null);

  // Check roles: only Admin and Kalite can make decisions
  const userRolesStr = (user?.roles || []).map((r) => r.toLowerCase()).join(' ');
  const canDecide =
    userRolesStr.includes('admin') ||
    userRolesStr.includes('yönetici') ||
    userRolesStr.includes('yonetici') ||
    userRolesStr.includes('kalite');

  const fetchPendingLots = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/v1/quality/inspections/pending');
      setLots(res.data || []);
    } catch (err) {
      console.error('Error fetching pending lots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingLots();
  }, []);

  // When a lot is opened for inspection, initialize test values
  const handleOpenInspection = (lot: PendingLot) => {
    setActiveLot(lot);
    setDecisionReason('');
    setInspectorNotes('');

    if (lot.tests && lot.tests.length > 0) {
      const initial: TestFormState[] = lot.tests.map((t) => {
        // default value in valid range for smooth test UX
        let defVal = '';
        if (t.min_value !== null && t.max_value !== null) {
          defVal = ((t.min_value + t.max_value) / 2).toFixed(2);
        } else if (t.min_value !== null) {
          defVal = t.min_value.toString();
        } else if (t.max_value !== null) {
          defVal = t.max_value.toString();
        }
        return {
          test_name: t.test_name,
          unit: t.unit,
          min_value: t.min_value,
          max_value: t.max_value,
          expected_text: t.expected_text || 'Uygun',
          method: t.method || '',
          measured_value: defVal,
          measured_text: 'Uygun',
          is_passed: true
        };
      });
      setTestFormValues(initial);
    } else {
      // Fallback default test if no template defined
      setTestFormValues([
        {
          test_name: 'Giriş Kontrol / Görünüm & Saflık',
          unit: '',
          min_value: null,
          max_value: null,
          expected_text: 'Uygun',
          method: 'Görsel Muayene & Duyusal',
          measured_value: '',
          measured_text: 'Uygun',
          is_passed: true
        }
      ]);
    }
  };

  // Real-time evaluation of test pass/fail status
  const handleValueChange = (index: number, val: string) => {
    setTestFormValues((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], measured_value: val };
      const num = parseFloat(val);

      if (!isNaN(num)) {
        let passed = true;
        if (item.min_value !== null && num < item.min_value) passed = false;
        if (item.max_value !== null && num > item.max_value) passed = false;
        item.is_passed = passed;
      }
      copy[index] = item;
      return copy;
    });
  };

  const handleTextChange = (index: number, txt: string) => {
    setTestFormValues((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], measured_text: txt };
      if (item.expected_text) {
        item.is_passed = txt.toLowerCase().trim() === item.expected_text.toLowerCase().trim();
      }
      copy[index] = item;
      return copy;
    });
  };

  // Check overall pass status
  const allTestsPassed = testFormValues.length > 0 && testFormValues.every((t) => t.is_passed);

  // Submit decision
  const handleSubmitDecision = async (decision: 'Serbest Bırakıldı' | 'Bloke Edildi' | 'Reddedildi') => {
    if (!activeLot) return;

    if (!canDecide) {
      alert('Kalite kararı verme yetkiniz bulunmamaktadır. Sadece Kalite ve Admin rolleri karar verebilir.');
      return;
    }

    if ((decision === 'Bloke Edildi' || decision === 'Reddedildi') && !decisionReason.trim()) {
      alert('Bloke veya Red kararlarında gerekçe / ret nedeni zorunludur!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        batch_lot_id: activeLot.lot_id,
        decision,
        decision_reason: decisionReason.trim() || null,
        notes: inspectorNotes.trim() || null,
        results: testFormValues.map((t) => ({
          test_name: t.test_name,
          unit: t.unit || '',
          min_value: t.min_value,
          max_value: t.max_value,
          expected_text: t.expected_text || null,
          method: t.method || null,
          measured_value: t.measured_value !== '' && !isNaN(parseFloat(t.measured_value)) ? parseFloat(t.measured_value) : null,
          measured_text: t.measured_text || null,
          is_passed: t.is_passed
        }))
      };

      await axios.post('/api/v1/quality/inspections', payload);
      setActiveLot(null);
      fetchPendingLots();

      // If finished good was released, check and prompt for CoA view
      if (decision === 'Serbest Bırakıldı' && (activeLot.item_category === 'Finished Good' || activeLot.warehouse.includes('Mamul'))) {
        try {
          const coaRes = await axios.get('/api/v1/quality/coas');
          if (coaRes.data && coaRes.data.length > 0) {
            const latestCoa = coaRes.data[0];
            const detailRes = await axios.get(`/api/v1/quality/coas/${latestCoa.id}`);
            setPreviewCoa(detailRes.data);
          }
        } catch {
          // ignore CoA auto-preview error
        }
      }
    } catch (err: any) {
      console.error('Error submitting inspection:', err);
      alert(err.response?.data?.detail || 'Kalite kararı kaydedilirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLots = lots.filter((lot) => {
    const q = searchQuery.toLowerCase();
    const matchQuery =
      lot.item_name.toLowerCase().includes(q) ||
      lot.item_sku.toLowerCase().includes(q) ||
      lot.batch_number.toLowerCase().includes(q);

    if (!matchQuery) return false;

    if (sourceFilter === 'MAL_KABUL') return lot.source.includes('Mal Kabul');
    if (sourceFilter === 'URETIM') return lot.source.includes('Üretim');
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-surface rounded-2xl p-6 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-text">Kalite Kontrol Bekleyenler</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold text-xs">
                {lots.length} Lot Karantinada
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Mal kabulden veya dolumdan çıkan ve laboratuvar onayına kadar kullanımı bloke edilmiş lotlar.
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ürün veya lot ara..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-[#302480]"
            />
          </div>

          <div className="flex items-center bg-bg border border-border rounded-xl p-0.5 text-xs">
            <button
              onClick={() => setSourceFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                sourceFilter === 'ALL' ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text'
              }`}
            >
              Tümü ({lots.length})
            </button>
            <button
              onClick={() => setSourceFilter('MAL_KABUL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                sourceFilter === 'MAL_KABUL' ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text'
              }`}
            >
              Mal Kabul
            </button>
            <button
              onClick={() => setSourceFilter('URETIM')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                sourceFilter === 'URETIM' ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text'
              }`}
            >
              Üretim (Dolum)
            </button>
          </div>

          <button
            onClick={fetchPendingLots}
            disabled={loading}
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text-muted hover:text-text transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('quality_coas')}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text transition flex items-center gap-1.5 text-xs font-bold"
            >
              <FileCheck className="w-3.5 h-3.5 text-[#4CAC30]" />
              <span>Sertifikalar (CoA)</span>
            </button>
          )}
        </div>
      </div>

      {/* Info Callout Box */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Karantina Güvenlik Kuralı:</span> Karantinadaki ve blokeli lotlar reçete stok ayrımına ve FEFO çekimine giremez, üretime verilemez, Paketleme İstasyonu'nda etiket basılamaz ve sevkiyata eklenemez. Yalnızca <strong>Kalite</strong> veya <strong>Admin</strong> rolündeki yetkililer serbest bırakabilir.
        </div>
      </div>

      {/* Pending Lots Cards / Table */}
      <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#302480] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">Karantinadaki lotlar yükleniyor...</span>
          </div>
        ) : filteredLots.length === 0 ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-10 h-10 text-[#4CAC30]" />
            <span className="text-sm font-bold text-text">Karantinada bekleyen lot bulunmuyor</span>
            <span className="text-xs max-w-sm">
              Tüm hammadde ve mamul partileri kalite onayından geçmiş ve serbest durumdadır.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg/50 text-text-muted uppercase text-[11px] font-bold">
                  <th className="py-3 px-4">Parti / Lot No</th>
                  <th className="py-3 px-4">Ürün Bilgisi</th>
                  <th className="py-3 px-4">Kaynak</th>
                  <th className="py-3 px-4">Miktar / Depo</th>
                  <th className="py-3 px-4">Giriş & Bekleme Süresi</th>
                  <th className="py-3 px-4">Test Şablonu</th>
                  <th className="py-3 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLots.map((lot) => (
                  <tr key={lot.lot_id} className="hover:bg-surface-hover/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 font-mono font-bold text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>{lot.batch_number}</span>
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-700 font-semibold mt-1">
                        Durum: Karantina
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-text text-sm">{lot.item_name}</div>
                      <div className="text-[11px] text-text-muted font-mono">{lot.item_sku} · {lot.item_category}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-bg border border-border text-text font-bold text-[11px] inline-flex items-center gap-1">
                        <Layers className="w-3 h-3 text-[#302480]" />
                        <span>{lot.source}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-text text-sm">
                        {lot.quantity.toLocaleString('tr-TR')} {lot.unit}
                      </div>
                      <div className="text-[10px] text-text-muted">{lot.warehouse}</div>
                    </td>
                    <td className="py-3.5 px-4 text-text-muted">
                      <div className="flex items-center gap-1 font-bold text-amber-700">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{lot.wait_time_display} bekliyor</span>
                      </div>
                      <div className="text-[10px] text-text-muted">
                        Giriş: {lot.received_at ? lot.received_at.split('T')[0] : '-'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {lot.has_template ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{lot.tests.length} Test Tanımlı</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-text-muted italic">Genel Muayene</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenInspection(lot)}
                        className="min-h-[38px] px-4 py-2 rounded-xl bg-[#302480] hover:bg-[#1E1654] active:scale-95 text-white font-bold text-xs transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span>Test & Karar Girişi</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================================
          INSPECTION & MEASUREMENT ENTRY MODAL
          ===================================================================== */}
      {activeLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text flex items-center gap-2">
                    <span>Kalite Kontrol ve Numune Girişi</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                      {activeLot.batch_number}
                    </span>
                  </h2>
                  <p className="text-xs text-text-muted">
                    {activeLot.item_name} ({activeLot.item_sku}) · {activeLot.source} · {activeLot.quantity} {activeLot.unit}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveLot(null)}
                className="min-h-[40px] min-w-[40px] rounded-xl text-text-muted hover:text-text hover:bg-surface-hover flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Role Notice */}
              {!canDecide && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>
                    <strong>Yetki Kısıtlaması:</strong> Sadece <strong>Kalite</strong> ve <strong>Admin</strong> rollerindeki kullanıcılar serbest bırakma veya ret kararı verebilir. Şu anki rolünüzle sadece değerleri görüntüleyebilirsiniz.
                  </span>
                </div>
              )}

              {/* Specification Test Entry Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase text-text-muted tracking-wider flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4 text-[#302480]" />
                    <span>Şartname Parametreleri ve Ölçülen Değerler</span>
                  </h3>
                  <span className="text-[11px] text-text-muted">
                    Sistem alt ve üst limitlere göre otomatik <strong>Geçti / Kaldı</strong> kontrolü yapar.
                  </span>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-bg/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-bg border-b border-border text-text-muted font-bold text-[11px] uppercase">
                        <th className="py-2.5 px-3">Test Adı</th>
                        <th className="py-2.5 px-3">Şartname Limiti</th>
                        <th className="py-2.5 px-3">Yöntem</th>
                        <th className="py-2.5 px-3 w-44">Ölçülen Sonuç</th>
                        <th className="py-2.5 px-3 text-center w-28">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-surface">
                      {testFormValues.map((t, idx) => (
                        <tr key={idx} className="hover:bg-surface-hover/40">
                          <td className="py-3 px-3">
                            <span className="font-bold text-text">{t.test_name}</span>
                            {t.unit && <span className="text-[10px] text-text-muted ml-1">({t.unit})</span>}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {t.min_value !== null && t.max_value !== null ? (
                              <span className="font-bold text-[#302480]">
                                {t.min_value} - {t.max_value} {t.unit}
                              </span>
                            ) : t.min_value !== null ? (
                              <span className="font-bold text-[#302480]">≥ {t.min_value} {t.unit}</span>
                            ) : t.max_value !== null ? (
                              <span className="font-bold text-[#302480]">≤ {t.max_value} {t.unit}</span>
                            ) : (
                              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                                {t.expected_text}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-text-muted text-[11px]">{t.method || '-'}</td>
                          <td className="py-3 px-3">
                            {t.min_value !== null || t.max_value !== null ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  value={t.measured_value}
                                  onChange={(e) => handleValueChange(idx, e.target.value)}
                                  placeholder="Ölçülen Değer"
                                  disabled={!canDecide}
                                  className={`w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border focus:outline-none ${
                                    t.is_passed
                                      ? 'border-border bg-bg text-text focus:border-[#4CAC30]'
                                      : 'border-rose-400 bg-rose-50 text-rose-900 focus:border-rose-500'
                                  }`}
                                />
                                {t.unit && (
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-muted font-mono">
                                    {t.unit}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <select
                                value={t.measured_text}
                                onChange={(e) => handleTextChange(idx, e.target.value)}
                                disabled={!canDecide}
                                className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-bg text-text focus:outline-none"
                              >
                                <option value="Uygun">Uygun (Geçti)</option>
                                <option value="Uygun Değil">Uygun Değil (Kaldı)</option>
                              </select>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {t.is_passed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>GEÇTİ</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-100 text-rose-800 font-bold text-[11px] animate-pulse">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>KALDI</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rejection / Blocking Reason Form (Appears if any test failed, or user wants to reject) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    Bloke / Ret Gerekçesi {(!allTestsPassed) && <span className="text-danger font-bold">(* Zorunlu)</span>}
                  </label>
                  <textarea
                    rows={2}
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder={
                      allTestsPassed
                        ? 'Sadece bloke veya ret durumunda doldurulmalıdır.'
                        : 'Test limitleri dışına çıkıldı. Lütfen ret gerekçesini yazınız.'
                    }
                    className="w-full text-xs rounded-xl bg-bg border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-danger"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text mb-1">Laboratuvar Notu / Gözlemler (Opsiyonel)</label>
                  <textarea
                    rows={2}
                    value={inspectorNotes}
                    onChange={(e) => setInspectorNotes(e.target.value)}
                    placeholder="Numunenin parti homojenliği, ilave ölçüm detayları..."
                    className="w-full text-xs rounded-xl bg-bg border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-[#302480]"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div className="px-6 py-4 border-t border-border bg-bg/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                {allTestsPassed ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-[#4CAC30]" />
                    <span>Tüm testler şartnameye uygundur.</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-rose-700 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Şartname dışı test tespit edildi!</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setActiveLot(null)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-border text-text hover:bg-surface-hover font-semibold text-xs transition"
                >
                  İptal
                </button>

                {/* Reject Button */}
                <button
                  type="button"
                  disabled={submitting || !canDecide}
                  onClick={() => handleSubmitDecision('Reddedildi')}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-danger-soft hover:bg-danger/20 text-danger border border-danger-border font-bold text-xs transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Reddet</span>
                </button>

                {/* Block Button */}
                <button
                  type="button"
                  disabled={submitting || !canDecide}
                  onClick={() => handleSubmitDecision('Bloke Edildi')}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Bloke Et</span>
                </button>

                {/* Release Button */}
                <button
                  type="button"
                  disabled={submitting || !canDecide || !allTestsPassed}
                  onClick={() => handleSubmitDecision('Serbest Bırakıldı')}
                  className="min-h-[42px] px-6 py-2 rounded-xl bg-[#4CAC30] hover:bg-[#439c2a] active:scale-95 text-white font-black text-xs sm:text-sm transition flex items-center gap-2 shadow-md disabled:opacity-40 cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>Serbest Bırak</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CoA Preview Modal if released */}
      {previewCoa && (
        <QualityCoaModal
          coa={previewCoa}
          onClose={() => setPreviewCoa(null)}
        />
      )}
    </div>
  );
};
