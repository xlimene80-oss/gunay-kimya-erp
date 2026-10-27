import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  FileCheck2,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  Warehouse,
  History,
  FileCode,
  Check,
  X
} from 'lucide-react';

interface DespatchLine {
  line_number: string;
  item_name: string;
  seller_item_code?: string;
  delivered_quantity: number;
  unit_code: string;
  lot_number?: string;
  expiry_date?: string;
  matched_item_id?: number | null;
  matched_item_sku?: string | null;
  matched_item_name?: string | null;
  matched_item_unit?: string | null;
  suggested_lot_number: string;
  suggested_expiry_date?: string | null;
}

interface DespatchPreview {
  dispatch_number: string;
  issue_date: string;
  supplier_vkn?: string | null;
  supplier_name: string;
  matched_supplier_id?: number | null;
  matched_supplier_title?: string | null;
  is_supplier_matched: boolean;
  is_duplicate: boolean;
  duplicate_message?: string | null;
  lines: DespatchLine[];
}

interface ReceiptHistoryItem {
  id: number;
  receipt_number: string;
  dispatch_note_number?: string | null;
  supplier_id?: number | null;
  supplier_name: string;
  target_warehouse: string;
  receipt_date: string;
  item_count: number;
  total_quantity: number;
  status: string;
  created_at: string;
}

interface MasterItem {
  id: number;
  sku: string;
  name: string;
  unit: string;
  category: string;
  shelf_life_days?: number;
}

export const GoodsReceiptManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'NEW_RECEIPT' | 'HISTORY'>('NEW_RECEIPT');
  const [parsingLoading, setParsingLoading] = useState<boolean>(false);
  const [confirmingLoading, setConfirmingLoading] = useState<boolean>(false);
  
  // Master Items for manual row matching
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);

  // Preview state
  const [preview, setPreview] = useState<DespatchPreview | null>(null);
  const [targetWarehouse, setTargetWarehouse] = useState<string>('Hammadde Deposu');
  const [receiptNotes, setReceiptNotes] = useState<string>('');
  
  // Feedback notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // History list
  const [historyList, setHistoryList] = useState<ReceiptHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // File drag & drop ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Fetch master items on mount
  useEffect(() => {
    const fetchMasterItems = async () => {
      try {
        const res = await axios.get('/api/v1/items/?limit=300');
        setMasterItems(res.data || []);
      } catch (err) {
        console.error('Master ürün listesi alınamadı:', err);
      }
    };
    fetchMasterItems();
  }, []);

  // Fetch history when history tab is opened
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get('/api/v1/inventory/goods-receipt/history');
      setHistoryList(res.data || []);
    } catch (err) {
      console.error('Mal kabul geçmişi alınamadı:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleXmlParse = async (xmlString: string) => {
    setParsingLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await axios.post('/api/v1/inventory/goods-receipt/parse-xml', {
        xml_content: xmlString
      });
      setPreview(res.data);
      setReceiptNotes(`UBL-TR e-İrsaliye (${res.data.dispatch_number}) ile depoya kabul kaydı.`);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'XML dosyası ayrıştırılamadı. Lütfen geçerli bir UBL-TR e-İrsaliye dosyası yükleyiniz.';
      setErrorMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
      setPreview(null);
    } finally {
      setParsingLoading(false);
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      setErrorMessage('Lütfen yalnızca .xml uzantılı UBL-TR e-İrsaliye dosyası seçiniz.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        handleXmlParse(content);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Dosya okunurken bir hata oluştu.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const loadSampleFile = async (fileName: string) => {
    setParsingLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/demo-data/${fileName}`);
      if (!res.ok) {
        throw new Error(`Örnek dosya bulunamadı (${res.status})`);
      }
      const xmlText = await res.text();
      await handleXmlParse(xmlText);
    } catch (err: any) {
      setErrorMessage(`Örnek dosya yüklenemedi: ${err.message}`);
      setParsingLoading(false);
    }
  };

  // Row update handlers
  const handleLineItemChange = (lineIndex: number, itemId: number) => {
    if (!preview) return;
    const selectedItem = masterItems.find((it) => it.id === itemId);
    const updatedLines = [...preview.lines];
    const line = updatedLines[lineIndex];

    line.matched_item_id = selectedItem ? selectedItem.id : null;
    line.matched_item_sku = selectedItem ? selectedItem.sku : null;
    line.matched_item_name = selectedItem ? selectedItem.name : null;
    line.matched_item_unit = selectedItem ? selectedItem.unit : null;

    // Recalculate expiry if not manually set
    if (selectedItem && selectedItem.shelf_life_days && preview.issue_date) {
      try {
        const issueDate = new Date(preview.issue_date);
        issueDate.setDate(issueDate.getDate() + selectedItem.shelf_life_days);
        line.suggested_expiry_date = issueDate.toISOString().split('T')[0];
      } catch {}
    }

    setPreview({ ...preview, lines: updatedLines });
  };

  const handleLineLotChange = (lineIndex: number, val: string) => {
    if (!preview) return;
    const updatedLines = [...preview.lines];
    updatedLines[lineIndex].suggested_lot_number = val;
    setPreview({ ...preview, lines: updatedLines });
  };

  const handleLineExpiryChange = (lineIndex: number, val: string) => {
    if (!preview) return;
    const updatedLines = [...preview.lines];
    updatedLines[lineIndex].suggested_expiry_date = val;
    setPreview({ ...preview, lines: updatedLines });
  };

  // Confirm Receipt
  const handleConfirmReceipt = async () => {
    if (!preview) return;
    if (preview.is_duplicate) {
      setErrorMessage('Bu irsaliye daha önce kabul edilmiş. Mükerrer giriş engellenmiştir.');
      return;
    }

    // Check if all lines are matched
    const unmatchedCount = preview.lines.filter((l) => !l.matched_item_id).length;
    if (unmatchedCount > 0) {
      setErrorMessage(`Eşleşmemiş ${unmatchedCount} adet satır bulunmaktadır. Lütfen tüm satırları sistemdeki ürünlerle eşleştiriniz.`);
      return;
    }

    setConfirmingLoading(true);
    setErrorMessage(null);

    const payload = {
      dispatch_number: preview.dispatch_number,
      issue_date: preview.issue_date,
      supplier_id: preview.matched_supplier_id,
      supplier_name: preview.supplier_name,
      target_warehouse: targetWarehouse,
      notes: receiptNotes,
      lines: preview.lines.map((l) => ({
        item_id: l.matched_item_id!,
        batch_number: l.suggested_lot_number.trim(),
        quantity: l.delivered_quantity,
        expiration_date: l.suggested_expiry_date || null,
        unit_price: 0
      }))
    };

    try {
      const res = await axios.post('/api/v1/inventory/goods-receipt/confirm', payload);
      setSuccessMessage(
        `İrsaliye (${preview.dispatch_number}) başarıyla depoya kabul edildi! Kabul No: ${res.data.receipt_number}. İlgili hammaddelerin stokları ve FEFO parti takibi güncellendi.`
      );
      setPreview(null);
      // Switch to history or refresh
      fetchHistory();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Mal kabul onaylanırken bir hata oluştu.';
      setErrorMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setConfirmingLoading(false);
    }
  };

  const hasUnmatchedLines = preview ? preview.lines.some((l) => !l.matched_item_id) : false;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-card relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-mod-stok-soft text-mod-stok border border-mod-stok-border">
                Satın Alma & Depo Modülü
              </span>
              <span className="text-xs text-text-muted">UBL-TR e-İrsaliye Standardı</span>
            </div>
            <h1 className="text-2xl font-bold text-text tracking-tight mt-1 flex items-center gap-2">
              <FileCheck2 className="w-6 h-6 text-mod-stok" />
              Tedarikçi İrsaliyesi ile Mal Kabul
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Gelen UBL-TR e-İrsaliye XML dosyasını ayrıştırarak tedarikçi, hammadde partisi ve FEFO son kullanma tarihleriyle depoya kabul edin.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 bg-bg p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab('NEW_RECEIPT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'NEW_RECEIPT'
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>İrsaliye Girişi</span>
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'HISTORY'
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Mal Kabul Geçmişi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error / Success Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-danger-soft border border-danger-border text-danger-text text-sm flex items-start gap-3 shadow-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-danger mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">İşlem Başarısız</div>
            <div className="text-xs mt-0.5">{errorMessage}</div>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-danger hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-success-soft border border-success-border text-success-text text-sm flex items-start gap-3 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-success mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">Kayıt Başarıyla Tamamlandı</div>
            <div className="text-xs mt-0.5">{successMessage}</div>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-success hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: NEW RECEIPT WIZARD */}
      {activeTab === 'NEW_RECEIPT' && (
        <div className="space-y-6">
          {!preview ? (
            /* Upload Zone */
            <div className="bg-surface border border-border rounded-xl p-8 shadow-card space-y-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragOver
                    ? 'border-primary bg-primary-soft/50'
                    : 'border-border hover:border-primary/60 bg-bg/50 hover:bg-bg'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-14 h-14 rounded-2xl bg-mod-stok-soft border border-mod-stok-border text-mod-stok flex items-center justify-center">
                  {parsingLoading ? (
                    <RefreshCw className="w-7 h-7 animate-spin text-primary" />
                  ) : (
                    <Upload className="w-7 h-7 text-mod-stok" />
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-text">
                    e-İrsaliye XML Dosyasını Yükleyin
                  </h3>
                  <p className="text-xs text-text-muted mt-1 max-w-md">
                    UBL-TR / UBL 2.1 DespatchAdvice standardındaki e-İrsaliye dosyasını sürükleyip bırakın veya seçmek için tıklayın.
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface border border-border text-text shadow-sm">
                  <FileCode className="w-4 h-4 text-primary" />
                  <span>Dosya Seç (.xml)</span>
                </div>
              </div>

              {/* Sample Files for Testing */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-mod-stok" />
                    Hızlı Test için Demo e-İrsaliyeler
                  </span>
                  <span className="text-[11px] text-text-muted">/demo-data/ klasöründen hazır yükleyin</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => loadSampleFile('irsaliye_eslesen_hammaddeler.xml')}
                    disabled={parsingLoading}
                    className="p-3.5 rounded-xl border border-border bg-bg hover:bg-primary-soft/30 transition-all text-left flex items-start gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-success-soft text-success border border-success-border flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-text group-hover:text-primary transition-colors">
                        Örnek 1: Tüm Ürünleri Eşleşen İrsaliye
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        BASF Türk Kimya (SLES-70, LABSA-96, NaOH-48 tam uyumlu).
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => loadSampleFile('irsaliye_eslesmeyen_satirli.xml')}
                    disabled={parsingLoading}
                    className="p-3.5 rounded-xl border border-border bg-bg hover:bg-primary-soft/30 transition-all text-left flex items-start gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-warning-soft text-warning-text border border-warning-border flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-text group-hover:text-primary transition-colors">
                        Örnek 2: Eşleşmeyen Satırlı İrsaliye
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        Koruma Klor Alkali (1 satır eşleşmez, kullanıcı açılır listeden seçer).
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* PREVIEW SCREEN */
            <div className="space-y-6 animate-in fade-in">
              {/* Duplicate Warning Banner */}
              {preview.is_duplicate && (
                <div className="p-4 rounded-xl bg-danger-soft border border-danger-border text-danger-text text-sm flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
                    <div>
                      <span className="font-bold">Mükerrer İrsaliye Engeli: </span>
                      <span>{preview.duplicate_message || 'Bu irsaliye daha önce kabul edilmiş.'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setPreview(null)}
                    className="px-3 py-1 bg-surface border border-danger-border rounded-lg text-xs font-semibold text-danger hover:bg-bg transition"
                  >
                    Başka Dosya Seç
                  </button>
                </div>
              )}

              {/* Waybill & Supplier Summary Card */}
              <div className="bg-surface border border-border rounded-xl p-6 shadow-card space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary border border-primary-border flex items-center justify-center shrink-0">
                      <FileCheck2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs text-text-muted font-bold uppercase tracking-wider">
                        e-İrsaliye Önizleme & Eşleştirme
                      </div>
                      <div className="text-xl font-mono font-bold text-text">
                        {preview.dispatch_number}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPreview(null)}
                      className="border border-border hover:bg-surface-hover text-text px-3 py-2 rounded-lg text-xs font-medium transition bg-surface flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      <span>Farklı Dosya Seç</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                  {/* Supplier Card */}
                  <div className="p-4 bg-bg rounded-xl border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">
                        Tedarikçi Firma
                      </span>
                      <Building2 className="w-4 h-4 text-text-muted" />
                    </div>
                    <div className="font-bold text-text text-sm truncate" title={preview.supplier_name}>
                      {preview.supplier_name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs text-text-muted">
                        VKN: {preview.supplier_vkn || '-'}
                      </span>
                      {preview.is_supplier_matched ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-success-soft text-success-text border border-success-border">
                          <Check className="w-3 h-3 text-success" />
                          Doğrulandı
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning-text border border-warning-border">
                          Kayıtsız VKN
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Date Card */}
                  <div className="p-4 bg-bg rounded-xl border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">
                        İrsaliye Tarihi
                      </span>
                      <Calendar className="w-4 h-4 text-text-muted" />
                    </div>
                    <div className="font-bold text-text text-sm font-mono">
                      {preview.issue_date}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Resmi sevk düzenlenme tarihi
                    </div>
                  </div>

                  {/* Target Warehouse Selector */}
                  <div className="p-4 bg-bg rounded-xl border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">
                        Hedef Depo
                      </span>
                      <Warehouse className="w-4 h-4 text-text-muted" />
                    </div>
                    <select
                      value={targetWarehouse}
                      onChange={(e) => setTargetWarehouse(e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-text font-medium focus:outline-none focus:border-primary mt-1"
                    >
                      <option value="Hammadde Deposu">Hammadde Deposu</option>
                      <option value="Mamul Ürün Deposu">Mamul Ürün Deposu</option>
                      <option value="Ambalaj Deposu">Ambalaj Deposu</option>
                    </select>
                  </div>

                  {/* Line Count Summary */}
                  <div className="p-4 bg-bg rounded-xl border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">
                        İrsaliye Satırları
                      </span>
                      <Layers className="w-4 h-4 text-text-muted" />
                    </div>
                    <div className="font-bold text-text text-sm">
                      {preview.lines.length} Kalem Malzeme
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {hasUnmatchedLines ? (
                        <span className="text-danger font-semibold">Eşleştirme bekleyen satır var</span>
                      ) : (
                        <span className="text-success font-semibold">Tüm satırlar eşleşti</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lines Table */}
              <div className="bg-surface border border-border rounded-xl shadow-card overflow-hidden">
                <div className="p-4 border-b border-border bg-bg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text uppercase tracking-wider">
                      İrsaliye Satır Eşleştirmesi & Parti (FEFO) Bilgileri
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">
                    Eşleşmeyen satırları açılır listeden seçerek bağlayabilirsiniz.
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-bg/80 border-b border-border text-text-muted uppercase font-bold text-[10px] tracking-wider">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">İrsaliyedeki Ürün & Kodu</th>
                        <th className="py-3 px-4">Sistem Stok Eşleşmesi</th>
                        <th className="py-3 px-4 text-right">Miktar</th>
                        <th className="py-3 px-4">Lot / Parti Numarası</th>
                        <th className="py-3 px-4">Son Kullanma Tarihi (SKT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.lines.map((line, idx) => {
                        const isMatched = !!line.matched_item_id;

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-primary-soft/20 transition-colors ${
                              !isMatched ? 'bg-danger-soft/20' : ''
                            }`}
                          >
                            {/* Line Number */}
                            <td className="py-3 px-4 text-center font-mono font-bold text-text">
                              {line.line_number}
                            </td>

                            {/* Raw Item Name and Seller Code */}
                            <td className="py-3 px-4">
                              <div className="font-semibold text-text">{line.item_name}</div>
                              {line.seller_item_code && (
                                <div className="text-[11px] font-mono text-text-muted mt-0.5">
                                  Tedarikçi Kodu: <span className="text-text font-bold">{line.seller_item_code}</span>
                                </div>
                              )}
                            </td>

                            {/* System Match Selector */}
                            <td className="py-3 px-4">
                              {isMatched ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-success-soft text-success-text border border-success-border">
                                      <Check className="w-3 h-3 text-success" />
                                      {line.matched_item_sku}
                                    </span>
                                    <span className="text-text font-medium truncate max-w-xs" title={line.matched_item_name || ''}>
                                      {line.matched_item_name}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleLineItemChange(idx, 0)}
                                    className="text-[10px] text-primary hover:underline block"
                                  >
                                    Farklı ürünle eşleştir
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-danger-text text-[11px] font-semibold mb-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-danger" />
                                    <span>Eşleşmedi — Sistemden bir ürün seçiniz:</span>
                                  </div>
                                  <select
                                    value={line.matched_item_id || ''}
                                    onChange={(e) => handleLineItemChange(idx, Number(e.target.value))}
                                    className="w-full bg-surface border border-danger-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary font-medium"
                                  >
                                    <option value="">-- Ürün / Hammadde Seçiniz --</option>
                                    {masterItems.map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.sku} - {m.name} ({m.unit})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </td>

                            {/* Delivered Quantity */}
                            <td className="py-3 px-4 text-right font-mono font-bold text-sm text-text">
                              {Number(line.delivered_quantity).toLocaleString('tr-TR')} {line.unit_code}
                            </td>

                            {/* Editable Lot Number */}
                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={line.suggested_lot_number}
                                onChange={(e) => handleLineLotChange(idx, e.target.value)}
                                placeholder="LOT-XXXX-XXX"
                                className="w-40 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs font-mono font-bold text-text focus:outline-none focus:border-primary"
                              />
                            </td>

                            {/* Editable Expiry Date (FEFO) */}
                            <td className="py-3 px-4">
                              <input
                                type="date"
                                value={line.suggested_expiry_date || ''}
                                onChange={(e) => handleLineExpiryChange(idx, e.target.value)}
                                className="w-36 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs font-mono text-text focus:outline-none focus:border-primary"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Action Footer */}
                <div className="p-6 border-t border-border bg-bg flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="text-xs text-text-muted">
                    {hasUnmatchedLines ? (
                      <span className="text-danger font-semibold">
                        ⚠️ Dikkat: Onaylayabilmek için tüm satırların bir sistem ürünüyle eşleşmesi zorunludur.
                      </span>
                    ) : (
                      <span>
                        ✅ Tüm satırlar başarıyla doğrulandı. Onaylandığında parti kayıtları ve depodaki fiziksel stoklar FEFO prensibiyle işlenecektir.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPreview(null)}
                      className="border border-border hover:bg-surface text-text px-4 py-2 rounded-lg text-xs font-medium transition bg-surface"
                    >
                      İptal Et
                    </button>

                    <button
                      onClick={handleConfirmReceipt}
                      disabled={confirmingLoading || preview.is_duplicate || hasUnmatchedLines}
                      className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                    >
                      {confirmingLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>Depoya Kabul Et</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECEIPT HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="bg-surface border border-border rounded-xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-border bg-bg flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-text uppercase tracking-wider">
                Depoya Kabul Edilen İrsaliyeler
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Geçmişte işlenen ve envantere alınan tüm tedarikçi irsaliye kayıtları.
              </p>
            </div>
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="border border-border hover:bg-surface-hover text-text px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 bg-surface"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin text-primary' : ''}`} />
              <span>Yenile</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bg/80 border-b border-border text-text-muted uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-4">Kabul No</th>
                  <th className="py-3 px-4">İrsaliye No</th>
                  <th className="py-3 px-4">Tarih</th>
                  <th className="py-3 px-4">Tedarikçi Firma</th>
                  <th className="py-3 px-4">Hedef Depo</th>
                  <th className="py-3 px-4 text-center">Kalem Sayısı</th>
                  <th className="py-3 px-4 text-right">Toplam Miktar</th>
                  <th className="py-3 px-4 text-center">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-text-muted">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                      <span>Kayıtlar yükleniyor...</span>
                    </td>
                  </tr>
                ) : historyList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-text-muted">
                      <History className="w-8 h-8 mx-auto text-text-muted mb-2 opacity-50" />
                      <span>Henüz depoya kabul edilmiş bir irsaliye bulunmuyor.</span>
                    </td>
                  </tr>
                ) : (
                  historyList.map((item) => (
                    <tr key={item.id} className="hover:bg-primary-soft/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-text">
                        {item.receipt_number}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-text">
                        {item.dispatch_note_number || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-text-muted">
                        {new Date(item.receipt_date).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-text">
                        {item.supplier_name}
                      </td>
                      <td className="py-3.5 px-4 text-text-muted">
                        {item.target_warehouse}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-text">
                        {item.item_count} Kalem
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-text">
                        {Number(item.total_quantity).toLocaleString('tr-TR')} kg
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-soft text-success-text border border-success-border">
                          <CheckCircle2 className="w-3 h-3 text-success" />
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="py-3 px-4 border-t border-border bg-bg flex items-center justify-between text-xs text-text-muted">
            <span>Toplam <strong>{historyList.length}</strong> mal kabul kaydı listelendi</span>
            <span>Kabul edilen tüm partiler FEFO sıralamasıyla stoklarda izlenmektedir.</span>
          </div>
        </div>
      )}
    </div>
  );
};
