import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Award, Search, Printer, RefreshCw, CheckCircle2 } from 'lucide-react';
import { QualityCoaModal, CoaDetailData } from '../components/QualityCoaModal';

interface CoaSummary {
  id: number;
  certificate_number: string;
  inspection_id: number;
  batch_lot_id: number;
  product_name: string;
  product_sku: string;
  lot_number: string;
  production_date?: string | null;
  expiration_date?: string | null;
  approved_by: string;
  approval_date?: string | null;
  notes?: string | null;
  test_count: number;
}

export const QualityCoaList: React.FC = () => {
  const [coas, setCoas] = useState<CoaSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCoa, setSelectedCoa] = useState<CoaDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  const fetchCoas = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/v1/quality/coas');
      setCoas(res.data || []);
    } catch (err) {
      console.error('Error fetching CoAs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoas();
  }, []);

  const openCoaDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await axios.get(`/api/v1/quality/coas/${id}`);
      setSelectedCoa(res.data);
    } catch (err) {
      console.error('Error loading CoA detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredCoas = coas.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.certificate_number.toLowerCase().includes(q) ||
      c.product_name.toLowerCase().includes(q) ||
      c.lot_number.toLowerCase().includes(q) ||
      c.product_sku.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-surface rounded-2xl p-6 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#302480]/10 text-[#302480] border border-[#302480]/20 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-text">Analiz Sertifikaları (CoA)</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Kalite onayı verilen mamul partilerinin resmi analiz belgeleri ve yazdırılabilir A4 sertifikaları.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sertifika, ürün veya lot ara..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-bg border border-border focus:outline-none focus:ring-2 focus:ring-[#302480]"
            />
          </div>
          <button
            onClick={fetchCoas}
            disabled={loading}
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text-muted hover:text-text transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* CoA Table / Cards */}
      <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#302480] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">Analiz sertifikaları yükleniyor...</span>
          </div>
        ) : filteredCoas.length === 0 ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center gap-2">
            <Award className="w-10 h-10 opacity-30 text-text-muted" />
            <span className="text-sm font-bold text-text">Henüz sertifika bulunmuyor</span>
            <span className="text-xs max-w-sm">
              Kalite kontrol ekranından serbest bırakılan mamul lotları için otomatik Analiz Sertifikası (CoA) düzenlenir.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg/50 text-text-muted uppercase text-[11px] font-bold">
                  <th className="py-3 px-4">Sertifika No</th>
                  <th className="py-3 px-4">Ürün Bilgisi</th>
                  <th className="py-3 px-4">Parti / Lot</th>
                  <th className="py-3 px-4">Üretim / SKT</th>
                  <th className="py-3 px-4">Onaylayan</th>
                  <th className="py-3 px-4 text-center">Test Sayısı</th>
                  <th className="py-3 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCoas.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-hover/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-[#302480] flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-[#4CAC30]" />
                        <span>{c.certificate_number}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-text">{c.product_name}</div>
                      <div className="text-[10px] text-text-muted font-mono">{c.product_sku}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-[11px]">
                        {c.lot_number}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-muted">
                      <div>Üretim: <span className="font-semibold text-text">{c.production_date || '-'}</span></div>
                      <div>SKT: <span className="font-semibold text-text">{c.expiration_date || '-'}</span></div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text">{c.approved_by}</div>
                      <div className="text-[10px] text-text-muted">{c.approval_date?.split('T')[0] || '-'}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#4CAC30]/10 text-[#4CAC30] font-bold text-[11px]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{c.test_count} Parametre</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openCoaDetail(c.id)}
                        disabled={detailLoading}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#302480] hover:bg-[#1E1654] active:scale-95 text-white font-bold text-xs transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Görüntüle / Yazdır</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CoA Detail & Printable Modal */}
      {selectedCoa && (
        <QualityCoaModal
          coa={selectedCoa}
          onClose={() => setSelectedCoa(null)}
        />
      )}
    </div>
  );
};
