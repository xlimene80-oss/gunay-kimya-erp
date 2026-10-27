import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  FileCheck2,
  Plus,
  Trash2,
  Building2,
  Boxes,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Warehouse
} from 'lucide-react';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface RawItem {
  id: number;
  sku: string;
  name: string;
  unit: string;
  category: string;
}

interface LineItemForm {
  item_id: number;
  item_name: string;
  unit: string;
  batch_number: string;
  quantity: number;
  expiration_date: string;
  unit_price: number;
}

export const GoodsReceiptModal: React.FC<GoodsReceiptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [itemsList, setItemsList] = useState<RawItem[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [supplierName, setSupplierName] = useState<string>('BASF Türk Kimya Sanayi ve Tic. Ltd. Şti.');
  const [supplierId, setSupplierId] = useState<number>(3);
  const [dispatchNumber, setDispatchNumber] = useState<string>(
    `IRS-2026-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    `FAT-2026-${Math.floor(10000 + Math.random() * 90000)}`
  );
  const [targetWarehouse, setTargetWarehouse] = useState<string>('Hammadde Deposu');
  const [notes, setNotes] = useState<string>('İthalatçı kimyasal hammadde sevk kabulü');

  // Line items
  const [lines, setLines] = useState<LineItemForm[]>([
    {
      item_id: 2,
      item_name: 'Sodyum Lauril Eter Sülfat %70 (SLES)',
      unit: 'kg',
      batch_number: `LOT-BASF-2026-${Math.floor(100 + Math.random() * 900)}`,
      quantity: 5000,
      expiration_date: '2028-12-31',
      unit_price: 68.5,
    },
    {
      item_id: 1,
      item_name: 'Lineer Alkil Benzen Sülfonik Asit %96 (LABSA)',
      unit: 'kg',
      batch_number: `LOT-PETK-2026-${Math.floor(100 + Math.random() * 900)}`,
      quantity: 2500,
      expiration_date: '2028-06-30',
      unit_price: 94.0,
    },
  ]);

  // Load items from API
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      axios
        .get('/api/v1/items/?limit=100')
        .then((res) => {
          setItemsList(res.data || []);
        })
        .catch(() => {
          // Fallback if network lag
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Preset Template Fillers
  const fillTemplateBasf = () => {
    setSupplierName('BASF Türk Kimya Sanayi ve Tic. Ltd. Şti.');
    setSupplierId(3);
    setDispatchNumber(`IRS-BASF-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setInvoiceNumber(`FAT-BASF-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setTargetWarehouse('Hammadde Deposu');
    setNotes('BASF Almanya İthalatı - SLES ve LABSA Ana Reaktör Hammaddeleri');
    setLines([
      {
        item_id: 2,
        item_name: 'Sodyum Lauril Eter Sülfat %70 (SLES)',
        unit: 'kg',
        batch_number: `LOT-BASF-2026-${Math.floor(100 + Math.random() * 900)}`,
        quantity: 5000,
        expiration_date: '2028-12-31',
        unit_price: 68.5,
      },
      {
        item_id: 1,
        item_name: 'Lineer Alkil Benzen Sülfonik Asit %96 (LABSA)',
        unit: 'kg',
        batch_number: `LOT-PETK-2026-${Math.floor(100 + Math.random() * 900)}`,
        quantity: 3000,
        expiration_date: '2028-06-30',
        unit_price: 94.0,
      },
    ]);
  };

  const fillTemplatePetkim = () => {
    setSupplierName('Petkim Petrokimya Holding A.Ş.');
    setSupplierId(3);
    setDispatchNumber(`IRS-PETK-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setInvoiceNumber(`FAT-PETK-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setTargetWarehouse('Hammadde Deposu');
    setNotes('Petkim Aliağa Tesisleri - Sıvı Kostik Soda ve Gliserin Sevk Kabulü');
    setLines([
      {
        item_id: 3,
        item_name: 'Sıvı Kostik Soda %48 (NaOH)',
        unit: 'kg',
        batch_number: `LOT-KOR-2026-${Math.floor(100 + Math.random() * 900)}`,
        quantity: 4000,
        expiration_date: '2028-12-31',
        unit_price: 32.0,
      },
      {
        item_id: 4,
        item_name: 'Gliserin Farma Kalite %99.5',
        unit: 'kg',
        batch_number: `LOT-EVY-2026-${Math.floor(100 + Math.random() * 900)}`,
        quantity: 1500,
        expiration_date: '2029-01-15',
        unit_price: 55.0,
      },
    ]);
  };

  const handleAddLine = () => {
    const defaultItem = itemsList.find((i) => i.category === 'Raw Material') || itemsList[0];
    setLines([
      ...lines,
      {
        item_id: defaultItem ? defaultItem.id : 2,
        item_name: defaultItem ? defaultItem.name : 'SLES %70',
        unit: defaultItem ? defaultItem.unit : 'kg',
        batch_number: `LOT-ITH-2026-${Math.floor(100 + Math.random() * 900)}`,
        quantity: 1000,
        expiration_date: '2028-12-31',
        unit_price: 50.0,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleItemSelect = (index: number, itemId: number) => {
    const selected = itemsList.find((i) => i.id === itemId);
    if (!selected) return;
    setLines((prev) =>
      prev.map((line, i) =>
        i === index
          ? {
              ...line,
              item_id: selected.id,
              item_name: selected.name,
              unit: selected.unit,
            }
          : line
      )
    );
  };

  const handleLineChange = (index: number, field: keyof LineItemForm, value: any) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  };

  const totalQuantity = lines.reduce((acc, l) => acc + Number(l.quantity || 0), 0);
  const totalAmount = lines.reduce(
    (acc, l) => acc + Number(l.quantity || 0) * Number(l.unit_price || 0),
    0
  );

  // Submit Goods Receipt to API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      setErrorMsg('En az bir hammadde kalemi girmelisiniz.');
      return;
    }
    if (!dispatchNumber.trim()) {
      setErrorMsg('İrsaliye numarası zorunludur.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      receipt_number: dispatchNumber.trim(),
      supplier_id: supplierId,
      supplier_name: supplierName.trim(),
      invoice_number: invoiceNumber.trim() || undefined,
      dispatch_note_number: dispatchNumber.trim(),
      purchase_order_number: `PO-ITH-${new Date().getFullYear()}`,
      target_warehouse: targetWarehouse,
      notes: notes.trim(),
      items: lines.map((l) => ({
        item_id: Number(l.item_id),
        batch_number: l.batch_number.trim(),
        quantity: Number(l.quantity),
        expiration_date: l.expiration_date ? l.expiration_date : undefined,
        unit_price: Number(l.unit_price || 0),
      })),
    };

    try {
      await axios.post('/api/v1/inventory/goods-receipt', payload);
      setSuccessMsg(
        `✓ İrsaliye #${payload.receipt_number} başarıyla kabul edildi! Toplam ${totalQuantity.toLocaleString(
          'tr-TR'
        )} kg hammadde ${targetWarehouse}'na eklendi ve FEFO kuyruğuna dahil edildi.`
      );
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 2200);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Mal kabul işlemi sırasında bir hata oluştu.';
      setErrorMsg(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl shadow-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* MODAL HEADER */}
        <div className="bg-surface p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center shrink-0">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                İthalatçı / Tedarikçi İrsaliyesi ile Mal Kabul
                <span className="text-[10px] font-mono bg-primary-soft text-primary border border-primary-border px-2 py-0.5 rounded-full font-bold">
                  FEFO Stok Otomasyonu
                </span>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Tedarikçinin kestiği irsaliye bilgilerini girin; sistem lotları, SKT'leri ve hammadde miktarlarını doğrudan stoğa işler.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface hover:bg-border/40 text-text-muted hover:text-text flex items-center justify-center transition border border-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FEEDBACK ALERTS */}
        {errorMsg && (
          <div className="m-5 p-3.5 bg-danger-soft border border-danger-border rounded-xl flex items-center gap-2 text-danger-text text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="m-5 p-3.5 bg-success-soft border border-success-border rounded-xl flex items-center gap-2 text-success-text text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TEMPLATE QUICK ACTION BUTTONS */}
        <div className="px-5 pt-4 pb-2 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase text-text-muted tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-text-muted" />
            Hızlı Şablonlar ile Otomatik Doldur:
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fillTemplateBasf}
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-border/30 border border-border text-text text-xs font-medium transition"
            >
              BASF (SLES + LABSA)
            </button>
            <button
              type="button"
              onClick={fillTemplatePetkim}
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-border/30 border border-border text-text text-xs font-medium transition"
            >
              Petkim (Kostik + Gliserin)
            </button>
          </div>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* TOP METADATA FIELDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase text-text-muted tracking-wider block mb-1.5 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-text-muted" />
                İthalatçı / Tedarikçi Firma
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
                placeholder="Örn: BASF Türk Kimya A.Ş."
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-primary font-medium"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-text-muted tracking-wider block mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-text-muted" />
                Bize Kesilen İrsaliye No
              </label>
              <input
                type="text"
                value={dispatchNumber}
                onChange={(e) => setDispatchNumber(e.target.value)}
                required
                placeholder="Örn: IRS-2026-004812"
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-primary font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-text-muted tracking-wider block mb-1.5 flex items-center gap-1">
                <Warehouse className="w-3.5 h-3.5 text-text-muted" />
                Hedef Depo
              </label>
              <select
                value={targetWarehouse}
                onChange={(e) => setTargetWarehouse(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-primary font-medium"
              >
                <option value="Hammadde Deposu">Hammadde Deposu</option>
                <option value="Ambalaj Deposu">Ambalaj Deposu</option>
                <option value="Mamul Ürün Deposu">Mamul Ürün Deposu</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase text-text-muted tracking-wider block mb-1">
                Fatura Numarası (Varsa)
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Örn: GNY2026000109"
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2 text-xs text-text focus:outline-none focus:border-primary font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-text-muted tracking-wider block mb-1">
                Açıklama / Kalite Notu
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Örn: Analiz sertifikası onaylandı, pH uygun."
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2 text-xs text-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* LINE ITEMS TABLE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-text tracking-wider flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-text-muted" />
                İrsaliyedeki Kimyasal Hammaddeler & Lot Bilgileri:
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="px-2.5 py-1 rounded-lg bg-surface hover:bg-border/30 border border-border text-text text-xs font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Kalem Ekle
              </button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden bg-bg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface border-b border-border text-text-muted">
                    <th className="py-2.5 px-3 font-semibold">Hammadde (Ürün)</th>
                    <th className="py-2.5 px-3 font-semibold w-28">Miktar</th>
                    <th className="py-2.5 px-3 font-semibold">Tedarikçi Lot No</th>
                    <th className="py-2.5 px-3 font-semibold">SKT (Son Tüketim)</th>
                    <th className="py-2.5 px-3 font-semibold w-24">Birim Fiyat</th>
                    <th className="py-2.5 px-2 text-center w-10">Sil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-surface/50">
                      <td className="p-2.5">
                        <select
                          value={line.item_id}
                          onChange={(e) => handleItemSelect(idx, Number(e.target.value))}
                          className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
                        >
                          {itemsList.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} ({it.sku})
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={line.quantity}
                            onChange={(e) => handleLineChange(idx, 'quantity', Number(e.target.value))}
                            required
                            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text font-mono font-bold focus:outline-none focus:border-primary text-right"
                          />
                          <span className="text-[10px] text-text-muted font-mono">{line.unit}</span>
                        </div>
                      </td>

                      <td className="p-2.5">
                        <input
                          type="text"
                          value={line.batch_number}
                          onChange={(e) => handleLineChange(idx, 'batch_number', e.target.value)}
                          required
                          placeholder="LOT-BASF-01"
                          className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-primary"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="date"
                          value={line.expiration_date}
                          onChange={(e) => handleLineChange(idx, 'expiration_date', e.target.value)}
                          className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text font-mono focus:outline-none focus:border-primary"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) => handleLineChange(idx, 'unit_price', Number(e.target.value))}
                          className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text font-mono text-right focus:outline-none focus:border-primary"
                        />
                      </td>

                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={lines.length <= 1}
                          className="text-text-muted hover:text-danger disabled:opacity-30 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SUMMARY BANNER */}
          <div className="bg-bg p-3.5 rounded-xl border border-border flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold">Toplam Kalem</span>
                <span className="font-mono font-bold text-text text-sm">{lines.length} Ürün</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold">Toplam Miktar</span>
                <span className="font-mono font-bold text-text text-sm">
                  {totalQuantity.toLocaleString('tr-TR')} KG
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-text-muted block text-[10px] uppercase font-bold">Yaklaşık İrsaliye Tutarı</span>
              <span className="font-mono font-bold text-text text-sm">
                {totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
              </span>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-surface hover:bg-border/30 border border-border text-text text-xs font-semibold transition"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-2 border border-transparent transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Stoğa İşleniyor...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>İrsaliyeyi Onayla ve Stoğa İşle</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
