import React, { useRef } from 'react';
import { X, Printer, Award, CheckCircle2, ShieldCheck, FileText } from 'lucide-react';

export interface CoaDetailData {
  id: number;
  certificate_number: string;
  company_name: string;
  company_subtitle: string;
  company_address: string;
  product_name: string;
  product_sku: string;
  lot_number: string;
  production_date?: string | null;
  expiration_date?: string | null;
  approved_by: string;
  approval_date?: string | null;
  general_result: string;
  notes?: string | null;
  results: {
    test_name: string;
    method: string;
    specification: string;
    measured_result: string;
    status: string;
    is_passed: boolean;
  }[];
}

interface QualityCoaModalProps {
  coa: CoaDetailData | null;
  onClose: () => void;
}

export const QualityCoaModal: React.FC<QualityCoaModalProps> = ({ coa, onClose }) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!coa) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-h-none print:rounded-none">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg/80 backdrop-blur-xs print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4CAC30]/15 text-[#4CAC30] border border-[#4CAC30]/30 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Analiz Sertifikası (CoA)</h2>
              <p className="text-xs text-text-muted font-mono">{coa.certificate_number} · Lot: {coa.lot_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#302480] hover:bg-[#1E1654] active:scale-95 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>PDF İndir / Yazdır</span>
            </button>
            <button
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] rounded-xl text-text-muted hover:text-text hover:bg-surface-hover flex items-center justify-center transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / A4 Printable Area */}
        <div className="overflow-y-auto p-4 sm:p-8 print:p-0 print:overflow-visible">
          <div
            ref={printAreaRef}
            className="bg-white text-slate-900 border border-slate-200 rounded-xl p-8 max-w-[210mm] mx-auto shadow-sm print:border-none print:shadow-none print:p-6 print:m-0 print:max-w-none print:w-full"
            style={{ minHeight: '270mm' }}
          >
            {/* Header with Logo */}
            <div className="flex items-start justify-between border-b-2 border-[#302480] pb-6 mb-6">
              <div className="flex items-center gap-4">
                <img
                  src="/logo-gunay.png"
                  alt="Günay Kimya"
                  className="h-14 w-auto object-contain"
                  onError={(e) => {
                    // Fallback to text if image not loaded
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div>
                  <h1 className="text-xl font-black tracking-tight text-[#1E1654]">
                    GÜNAY KİMYA SANAYİ VE TİCARET A.Ş.
                  </h1>
                  <p className="text-xs font-semibold text-slate-600">
                    Kalite Güvence ve Akredite Analiz Laboratuvarı
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    İzmir Atatürk Organize Sanayi Bölgesi (İAOSB), Çiğli / İzmir · Tel: +90 232 376 00 00
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block px-3 py-1.5 rounded-lg bg-[#302480]/10 border border-[#302480]/30 text-[#302480] font-black text-xs font-mono">
                  {coa.certificate_number}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Yayın Tarihi: {coa.approval_date || new Date().toLocaleDateString('tr-TR')}
                </div>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center mb-6">
              <h2 className="text-lg font-black tracking-wider uppercase text-slate-900 underline decoration-[#4CAC30] decoration-2 underline-offset-4">
                ANALİZ SERTİFİKASI / CERTIFICATE OF ANALYSIS (CoA)
              </h2>
              <p className="text-xs text-slate-500 mt-1">TS EN ISO 9001 / ISO 22716 GMP Standartlarına Uygundur</p>
            </div>

            {/* Product & Batch Meta Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div>
                <span className="text-slate-500 block font-medium">Ürün Ticari Adı:</span>
                <span className="font-black text-slate-900 text-sm">{coa.product_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Ürün Kodu (SKU):</span>
                <span className="font-mono font-bold text-slate-800">{coa.product_sku}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Parti / Lot Numarası:</span>
                <span className="font-mono font-black text-[#302480] text-sm">{coa.lot_number}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Analiz & Onay Tarihi:</span>
                <span className="font-bold text-slate-800">{coa.approval_date || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Üretim Tarihi:</span>
                <span className="font-bold text-slate-800">{coa.production_date || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Son Kullanma Tarihi (SKT):</span>
                <span className="font-bold text-slate-800">{coa.expiration_date || '-'}</span>
              </div>
            </div>

            {/* Specification & Test Results Table */}
            <div className="mb-6">
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#302480]" />
                <span>Laboratuvar Fizikokimyasal ve Duyusal Analiz Sonuçları</span>
              </h3>
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Test / Parametre</th>
                      <th className="py-2.5 px-3">Analiz Yöntemi</th>
                      <th className="py-2.5 px-3">Şartname Limiti</th>
                      <th className="py-2.5 px-3 text-right">Ölçülen Değer</th>
                      <th className="py-2.5 px-3 text-center">Uygunluk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {coa.results.map((res, index) => (
                      <tr key={index} className={index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{index + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{res.test_name}</td>
                        <td className="py-2 px-3 text-slate-600 font-medium text-[11px]">{res.method}</td>
                        <td className="py-2 px-3 text-slate-700 font-mono font-medium">{res.specification}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {res.measured_result}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              res.is_passed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-rose-50 text-rose-700 border border-rose-300'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{res.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quality Statement / Declaration */}
            <div className="bg-[#4CAC30]/10 border border-[#4CAC30]/30 rounded-xl p-4 mb-8">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#4CAC30] shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">KALİTE KONTROL KARARI VE ONAYI:</div>
                  <p className="text-slate-700 mt-0.5 leading-relaxed">
                    Yukarıda kimliği ve parti numarası belirtilen ürün numuneleri, Günay Kimya kalite kontrol laboratuvarında analiz edilmiş olup, tüm parametreler onaylı ürün spesifikasyonlarına ve yasal mevzuata tam uygun bulunmuştur. Ürün serbest bırakılmıştır.
                  </p>
                  {coa.notes && (
                    <p className="text-slate-600 mt-1 italic text-[11px]">
                      Not: {coa.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Signatures & Seal Box */}
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200">
              <div className="text-xs">
                <span className="text-slate-500 block font-medium">Analizi Gerçekleştiren:</span>
                <span className="font-bold text-slate-900 block mt-1">Kimya Müh. / Lab. Uzmanı</span>
                <div className="h-14 flex items-end">
                  <span className="text-[10px] text-slate-400 font-mono">Elektronik İmzalıdır</span>
                </div>
              </div>

              <div className="text-xs text-right">
                <span className="text-slate-500 block font-medium">Kalite Güvence Müdürü / Onaylayan:</span>
                <span className="font-black text-slate-900 block mt-1">{coa.approved_by}</span>
                <div className="h-14 flex flex-col items-end justify-end">
                  <div className="inline-block border border-dashed border-[#302480]/40 rounded-lg px-4 py-1 text-[10px] font-mono font-bold text-[#302480] uppercase tracking-wider">
                    GÜNAY KİMYA A.Ş. KALİTE MÜHÜRLÜ ONAY
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5">Tarih: {coa.approval_date || '-'}</span>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="mt-8 pt-3 border-t border-slate-100 text-[9px] text-slate-400 flex items-center justify-between">
              <span>Form Kodu: GNY-FRM-QC-042 (Rev. 03)</span>
              <span>Sayfa 1 / 1</span>
              <span>Doğrulama Kodu: {coa.certificate_number}-TSE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
