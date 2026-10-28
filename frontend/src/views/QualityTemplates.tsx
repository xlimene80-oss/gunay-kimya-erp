import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FlaskConical,
  X,
  AlertCircle
} from 'lucide-react';

interface TestItem {
  id?: number;
  test_name: string;
  unit: string;
  min_value: number | null;
  max_value: number | null;
  expected_text?: string | null;
  method?: string | null;
  order_index: number;
}

interface TestTemplate {
  id: number;
  item_id: number;
  item_name: string;
  item_sku: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  tests_count: number;
  tests: TestItem[];
}

interface ProductOption {
  id: number;
  name: string;
  sku: string;
  category: string;
}

export const QualityTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedTplId, setExpandedTplId] = useState<number | null>(null);

  // New Template Modal state
  const [showModal, setShowModal] = useState<boolean>(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [templateDesc, setTemplateDesc] = useState<string>('');
  const [formTests, setFormTests] = useState<TestItem[]>([
    { test_name: '', unit: '', min_value: null, max_value: null, expected_text: '', method: '', order_index: 1 }
  ]);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/v1/quality/templates');
      setTemplates(res.data || []);
      if (res.data && res.data.length > 0 && expandedTplId === null) {
        setExpandedTplId(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get('/api/v1/inventory/items/');
      setProducts(res.data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchProducts();
  }, []);

  const handleAddRow = () => {
    setFormTests((prev) => [
      ...prev,
      { test_name: '', unit: '', min_value: null, max_value: null, expected_text: '', method: '', order_index: prev.length + 1 }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setFormTests((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleTestFieldChange = (index: number, field: keyof TestItem, value: any) => {
    setFormTests((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !templateName.trim()) {
      setErrorMsg('Lütfen ürün ve şablon adını eksiksiz girin.');
      return;
    }

    const validTests = formTests.filter((t) => t.test_name.trim());
    if (validTests.length === 0) {
      setErrorMsg('En az bir adet test parametresi tanımlamalısınız.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await axios.post('/api/v1/quality/templates', {
        item_id: Number(selectedItemId),
        name: templateName.trim(),
        description: templateDesc.trim() || null,
        tests: validTests.map((t, idx) => ({
          test_name: t.test_name.trim(),
          unit: t.unit.trim() || '',
          min_value: t.min_value !== null ? Number(t.min_value) : null,
          max_value: t.max_value !== null ? Number(t.max_value) : null,
          expected_text: t.expected_text?.trim() || null,
          method: t.method?.trim() || null,
          order_index: idx + 1
        }))
      });
      setShowModal(false);
      // Reset form
      setSelectedItemId('');
      setTemplateName('');
      setTemplateDesc('');
      setFormTests([
        { test_name: '', unit: '', min_value: null, max_value: null, expected_text: '', method: '', order_index: 1 }
      ]);
      fetchTemplates();
    } catch (err: any) {
      console.error('Error saving template:', err);
      setErrorMsg(err.response?.data?.detail || 'Şablon kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm('Bu test şablonunu silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`/api/v1/quality/templates/${id}`);
      fetchTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-surface rounded-2xl p-6 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#302480]/10 text-[#302480] border border-[#302480]/20 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-text">Kalite Test Şablonları</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Ürün ve hammadde bazlı laboratuvar test şartnameleri, alt/üst limitler ve analiz yöntemleri.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#302480] hover:bg-[#1E1654] active:scale-95 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Şablon Tanımla</span>
          </button>
          <button
            onClick={fetchTemplates}
            disabled={loading}
            className="min-h-[42px] px-3 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text-muted hover:text-text transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#302480] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">Şablonlar yükleniyor...</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center text-text-muted flex flex-col items-center justify-center gap-2">
            <FileSpreadsheet className="w-10 h-10 opacity-30 text-text-muted" />
            <span className="text-sm font-bold text-text">Kayıtlı test şablonu bulunamadı</span>
            <span className="text-xs max-w-sm">
              Yukarıdaki "Yeni Şablon Tanımla" butonuna basarak ilk ürün test şablonunuzu oluşturabilirsiniz.
            </span>
          </div>
        ) : (
          templates.map((tpl) => {
            const isExpanded = expandedTplId === tpl.id;
            return (
              <div
                key={tpl.id}
                className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden transition-all duration-200"
              >
                {/* Header row */}
                <div
                  onClick={() => setExpandedTplId(isExpanded ? null : tpl.id)}
                  className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-hover/60 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#4CAC30]/15 text-[#4CAC30] border border-[#4CAC30]/30 flex items-center justify-center shrink-0">
                      <FlaskConical className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-text truncate">{tpl.name}</h3>
                        <span className="px-2 py-0.5 rounded-md bg-[#302480]/10 text-[#302480] font-mono text-[10px] font-bold">
                          {tpl.item_sku}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {tpl.item_name}
                        </span>
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-text-muted truncate mt-0.5">{tpl.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg border border-border text-text font-bold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4CAC30]" />
                      <span>{tpl.tests_count} Test Parametresi</span>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(tpl.id);
                      }}
                      className="min-h-[36px] min-w-[36px] rounded-xl text-danger hover:bg-danger/10 flex items-center justify-center transition"
                      title="Şablonu Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="text-text-muted">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Test Items Table */}
                {isExpanded && (
                  <div className="border-t border-border bg-bg/40 p-5 animate-in fade-in duration-200">
                    <div className="border border-border rounded-xl overflow-hidden bg-surface">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-bg border-b border-border text-text-muted font-bold text-[11px] uppercase">
                            <th className="py-2.5 px-4 w-12">Sıra</th>
                            <th className="py-2.5 px-4">Test Parametresi</th>
                            <th className="py-2.5 px-4">Birim</th>
                            <th className="py-2.5 px-4">Şartname Limitleri</th>
                            <th className="py-2.5 px-4">Analiz Yöntemi / Standart</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {tpl.tests.map((test, idx) => (
                            <tr key={test.id || idx} className="hover:bg-surface-hover/50">
                              <td className="py-2.5 px-4 font-mono text-text-muted">{idx + 1}</td>
                              <td className="py-2.5 px-4 font-bold text-text">{test.test_name}</td>
                              <td className="py-2.5 px-4 font-mono text-text-muted">{test.unit || '-'}</td>
                              <td className="py-2.5 px-4">
                                {test.min_value !== null && test.max_value !== null ? (
                                  <span className="font-mono font-bold text-[#302480]">
                                    {test.min_value} - {test.max_value} {test.unit}
                                  </span>
                                ) : test.min_value !== null ? (
                                  <span className="font-mono font-bold text-[#302480]">
                                    ≥ {test.min_value} {test.unit}
                                  </span>
                                ) : test.max_value !== null ? (
                                  <span className="font-mono font-bold text-[#302480]">
                                    ≤ {test.max_value} {test.unit}
                                  </span>
                                ) : (
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                                    {test.expected_text || 'Şartnameye Uygun'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-text-muted">
                                {test.method || 'Standart Laboratuvar Analizi'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Template Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#302480]/15 text-[#302480] flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text">Yeni Kalite Test Şablonu</h2>
                  <p className="text-xs text-text-muted">Ürün için laboratuvar test parametreleri ve şartnameleri tanımlayın.</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl text-text-muted hover:text-text hover:bg-surface-hover flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTemplate} className="p-6 overflow-y-auto space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-danger-soft border border-danger-border text-danger-text text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text mb-1">Hedef Ürün / Hammadde *</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setSelectedItemId(id);
                      const prod = products.find((p) => p.id === id);
                      if (prod && !templateName) {
                        setTemplateName(`${prod.name} Kalite Şablonu`);
                      }
                    }}
                    required
                    className="w-full text-xs rounded-xl bg-bg border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-[#302480]"
                  >
                    <option value="">Ürün Seçiniz...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.sku}] {p.name} ({p.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text mb-1">Şablon Adı *</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="örn: Sıvı El Sabunu 5L Şartnamesi"
                    required
                    className="w-full text-xs rounded-xl bg-bg border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-[#302480]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Açıklama (Opsiyonel)</label>
                <input
                  type="text"
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  placeholder="Şablon ile ilgili laboratuvar notları veya referans standartlar"
                  className="w-full text-xs rounded-xl bg-bg border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-[#302480]"
                />
              </div>

              {/* Test Parameters Dynamic Table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-[#302480]" />
                    <span>Test Parametreleri ({formTests.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="min-h-[32px] px-3 py-1 rounded-lg bg-[#302480]/10 text-[#302480] hover:bg-[#302480]/20 font-bold text-xs transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Parametre Ekle</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {formTests.map((t, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-bg border border-border grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          value={t.test_name}
                          onChange={(e) => handleTestFieldChange(idx, 'test_name', e.target.value)}
                          placeholder="Test Adı (örn: pH)"
                          required
                          className="w-full text-xs rounded-lg bg-surface border border-border p-2"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={t.unit}
                          onChange={(e) => handleTestFieldChange(idx, 'unit', e.target.value)}
                          placeholder="Birim (örn: %)"
                          className="w-full text-xs rounded-lg bg-surface border border-border p-2"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          step="any"
                          value={t.min_value ?? ''}
                          onChange={(e) => handleTestFieldChange(idx, 'min_value', e.target.value)}
                          placeholder="Alt Limit"
                          className="w-full text-xs rounded-lg bg-surface border border-border p-2 font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          step="any"
                          value={t.max_value ?? ''}
                          onChange={(e) => handleTestFieldChange(idx, 'max_value', e.target.value)}
                          placeholder="Üst Limit"
                          className="w-full text-xs rounded-lg bg-surface border border-border p-2 font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={t.method || ''}
                          onChange={(e) => handleTestFieldChange(idx, 'method', e.target.value)}
                          placeholder="Yöntem (opsiyonel)"
                          className="w-full text-xs rounded-lg bg-surface border border-border p-2"
                        />
                      </div>
                      <div className="sm:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          disabled={formTests.length <= 1}
                          className="min-h-[32px] min-w-[32px] rounded-lg text-danger hover:bg-danger/10 flex items-center justify-center transition disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-border text-text hover:bg-surface-hover font-semibold text-xs transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-6 py-2 rounded-xl bg-[#302480] hover:bg-[#1E1654] active:scale-95 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Şablonu Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
