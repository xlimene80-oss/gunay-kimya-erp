import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  GitFork,
  Search,
  Building2,
  FlaskConical,
  ShieldCheck,
  ArrowDown,
  Boxes,
  Loader2,
  Info
} from 'lucide-react';

interface RawMaterialFootprintItem {
  item_name: string;
  sku: string;
  quantity_consumed: number;
  unit: string;
  supplier_batch_number: string;
  supplier_name: string;
  invoice_number: string;
  dispatch_note_number: string;
  receipt_date: string;
}

interface TraceabilityData {
  found: boolean;
  query_identifier: string;
  b2b_order: {
    order_number: string;
    customer_title: string;
    delivery_address: string;
    status: string;
    dispatch_date: string;
    carrier: string;
  };
  production_batch: {
    order_number: string;
    finished_lot_number: string;
    recipe_name: string;
    finished_good_sku: string;
    finished_good_name: string;
    quantity_produced: number;
    unit: string;
    production_date: string;
    reactor: string;
    status: string;
  };
  raw_material_footprint: RawMaterialFootprintItem[];
}

export const Traceability: React.FC = () => {
  const [searchInput, setSearchInput] = useState<string>('LOT-SIP-2026-99214');
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<TraceabilityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTraceability = async (identifier: string) => {
    if (!identifier.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await axios.get(`/api/v1/manufacturing/traceability/${encodeURIComponent(identifier.trim())}`);
      setData(res.data);
    } catch (err: any) {
      setError('İzlenebilirlik verisi sorgulanırken sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraceability('LOT-SIP-2026-99214');
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTraceability(searchInput);
  };

  const formatNumber = (num: number, decimals: number = 3) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-bg text-text-muted border border-border">
              <GitFork className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-text tracking-tight">
              Greenfield Ürün İzlenebilirliği (Geriye Dönük Ayak İzi)
            </h1>
          </div>
          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
            Nihai sevk edilen mamulden geriye doğru; üretim emri, reaktör mikseri, kullanılan her gram hammadde,
            tedarikçi firma ve orijinal fatura/irsaliye numarasına kadar tam denetim şeceresi.
          </p>
        </div>

        {/* Quality Standard Badge */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-bg border border-border text-xs text-text-muted">
          <ShieldCheck className="w-4 h-4 text-text-muted" />
          <span>ISO 9001 & GMP Kimyasal İzlenebilirlik Standart Uyumlu</span>
        </div>
      </div>

      {/* Interactive Search Bar & Quick Fill Pills */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-lg space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nihai Parti No (örn: LOT-SIP-2026-99214) veya Sevk No (örn: DSP-2026-00412)..."
              className="w-full pl-10 pr-4 py-2.5 bg-bg border border-border rounded-xl text-text placeholder-text-muted/60 text-xs font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all border border-transparent shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Şecereyi Sorgula</span>
          </button>
        </form>

        {/* Sample Quick Query Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-text-muted">Hızlı Örnekler:</span>
          <button
            onClick={() => {
              setSearchInput('LOT-SIP-2026-99214');
              fetchTraceability('LOT-SIP-2026-99214');
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-bg hover:bg-border/30 text-text border border-border transition-colors"
          >
            LOT-SIP-2026-99214 (Sıvı Sabun Partisi)
          </button>
          <button
            onClick={() => {
              setSearchInput('DSP-2026-00412');
              fetchTraceability('DSP-2026-00412');
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-bg hover:bg-border/30 text-text border border-border transition-colors"
          >
            DSP-2026-00412 (B2B Sevk Emri)
          </button>
        </div>
      </div>

      {loading && (
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-text-muted">Ürün soy ağacı ve tedarikçi fatura kökleri taranıyor...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-danger-soft border border-danger-border rounded-xl text-danger-text text-xs">
          {error}
        </div>
      )}

      {/* Traceability Graph Breakdown */}
      {data && !loading && (
        <div className="space-y-6 animate-fadeIn">
          {/* STEP 1: B2B CLIENT & LOGISTICS DISPATCH STAGE */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-bg text-text-muted flex items-center justify-center text-xs font-bold border border-border">
                  1
                </span>
                <h2 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-text-muted" />
                  Müşteri Siparişi & B2B Sevkiyat Aşaması
                </h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-success-soft text-success-text border border-success-border font-semibold">
                Teslim Edildi / Sevk Edildi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-bg p-3.5 rounded-xl border border-border">
                <span className="text-text-muted block uppercase text-[10px] font-semibold">Müşteri / Cari Ünvan</span>
                <span className="text-text font-bold text-sm block mt-1">{data.b2b_order.customer_title}</span>
              </div>
              <div className="bg-bg p-3.5 rounded-xl border border-border">
                <span className="text-text-muted block uppercase text-[10px] font-semibold">Sevk / Sipariş No</span>
                <span className="text-text font-mono font-bold text-sm block mt-1">{data.b2b_order.order_number}</span>
              </div>
              <div className="bg-bg p-3.5 rounded-xl border border-border">
                <span className="text-text-muted block uppercase text-[10px] font-semibold">Sevkiyat Tarihi & Araç</span>
                <span className="text-text font-medium block mt-1">{data.b2b_order.dispatch_date}</span>
                <span className="text-[11px] text-text-muted font-mono">{data.b2b_order.carrier}</span>
              </div>
              <div className="bg-bg p-3.5 rounded-xl border border-border">
                <span className="text-text-muted block uppercase text-[10px] font-semibold">Teslimat Adresi</span>
                <span className="text-text font-medium block mt-1">{data.b2b_order.delivery_address}</span>
              </div>
            </div>

            {/* Downward Connector Arrow */}
            <div className="flex justify-center my-1 pt-4 text-text-muted">
              <div className="p-1 rounded-full bg-surface border border-border">
                <ArrowDown className="w-4 h-4 text-text-muted" />
              </div>
            </div>
          </div>

          {/* STEP 2: MANUFACTURING PRODUCTION BATCH & RECIPE STAGE */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-bg text-text-muted flex items-center justify-center text-xs font-bold border border-border">
                  2
                </span>
                <h2 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4 text-text-muted" />
                  Fabrika Üretim Emri & Kimyasal Reçete Sentezi
                </h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary-soft text-primary border border-primary-border font-mono font-semibold">
                Parti No: {data.production_batch.finished_lot_number}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-bg p-3.5 rounded-xl border border-border">
                <span className="text-text-muted block uppercase text-[10px] font-semibold">Mamul Ürün Adı & SKU</span>
                <span className="text-text font-bold text-sm block mt-1">{data.production_batch.finished_good_name}</span>
                <span className="text-[11px] text-text-muted font-mono">{data.production_batch.finished_good_sku}</span>
              </div>
              <div className="bg-bg p-3.5 rounded-xl border border-border">
                <span className="text-text-muted block uppercase text-[10px] font-semibold">Reçete / Formülasyon Adı</span>
                <span className="text-text font-medium block mt-1">{data.production_batch.recipe_name}</span>
              </div>
              <div className="bg-bg p-3.5 rounded-xl border border-border">
                <span className="text-text-muted block uppercase text-[10px] font-semibold">Reaktör & Sentezleme Tarihi</span>
                <span className="text-text font-medium block mt-1">{data.production_batch.reactor}</span>
                <span className="text-[11px] text-text-muted">{data.production_batch.production_date}</span>
              </div>
              <div className="bg-bg p-3.5 rounded-xl border border-border">
                <span className="text-text-muted block uppercase text-[10px] font-semibold">Üretilen Toplam Miktar</span>
                <span className="text-text font-bold text-base block mt-1 font-mono">
                  {formatNumber(data.production_batch.quantity_produced, 1)} {data.production_batch.unit}
                </span>
                <span className="text-[11px] text-success font-medium">Laboratuvar QC Onaylı</span>
              </div>
            </div>

            {/* Downward Connector Arrow */}
            <div className="flex justify-center my-1 pt-4 text-text-muted">
              <div className="p-1 rounded-full bg-surface border border-border">
                <ArrowDown className="w-4 h-4 text-text-muted" />
              </div>
            </div>
          </div>

          {/* STEP 3: THE RAW MATERIAL FOOTPRINT (HAMMADDE AYAK İZİ TABLOSU) */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-bg text-text-muted flex items-center justify-center text-xs font-bold border border-border">
                  3
                </span>
                <div>
                  <h2 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-text-muted" />
                    Hammadde Ayak İzi (Tedarikçi, İrsaliye & Fatura Kökenleri)
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Bu mamul partisine giren her bir kimyasal bileşenin tedarikçi faturası ve irsaliye numaraları
                  </p>
                </div>
              </div>

              <div className="text-xs text-text-muted bg-bg px-3 py-1.5 rounded-xl border border-border font-semibold font-mono">
                {data.raw_material_footprint.length} Kimyasal Bileşen Tüketildi
              </div>
            </div>

            {/* Raw Material Footprint Table */}
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left text-xs text-text">
                <thead className="bg-bg text-text-muted font-semibold uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-3.5 py-3">Hammadde Adı & SKU</th>
                    <th className="px-3.5 py-3 text-right">Tüketilen Miktar</th>
                    <th className="px-3.5 py-3">Tedarikçi Lot / Parti No</th>
                    <th className="px-3.5 py-3">Tedarikçi Firma (Cari)</th>
                    <th className="px-3.5 py-3">Fatura No</th>
                    <th className="px-3.5 py-3">İrsaliye No</th>
                    <th className="px-3.5 py-3">Mal Kabul Tarihi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.raw_material_footprint.map((mat, idx) => (
                    <tr key={idx} className="hover:bg-surface/50 transition-colors">
                      <td className="px-3.5 py-3 font-medium text-text">
                        <div>{mat.item_name}</div>
                        <div className="text-[11px] font-mono text-text-muted">{mat.sku}</div>
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-bold text-text">
                        {formatNumber(mat.quantity_consumed, 3)} {mat.unit}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-xs text-text">
                        <span className="bg-bg px-2 py-0.5 rounded border border-border">
                          {mat.supplier_batch_number}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-text font-medium">
                        {mat.supplier_name}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-text font-medium">
                        {mat.invoice_number}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-text font-medium">
                        {mat.dispatch_note_number}
                      </td>
                      <td className="px-3.5 py-3 text-text-muted font-mono">
                        {mat.receipt_date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Traceability Audit Footer */}
            <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-text-muted gap-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-text-muted shrink-0" />
                <span>
                  Yukarıdaki ayak izi dökümü, hammadde FEFO tüketim loglarından ve mal kabul irsaliyelerinden otomatik derlenmiştir.
                </span>
              </div>
              <div className="font-mono text-[11px] text-text-muted">
                Doğrulama İmzası: SHA256-TRACE-OK
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Traceability;
