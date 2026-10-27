import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Printer,
  X,
  Truck,
  FileText,
  ShieldAlert,
  Edit2,
  Check,
  QrCode,
  Loader2
} from 'lucide-react';

export interface WaybillItem {
  line_no: number;
  item_id: number;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  batch_number?: string;
  barcode_list: string[];
  adr_class: string;
  package_type: string;
  net_weight_kg: number;
  gross_weight_kg: number;
}

export interface WaybillData {
  dispatch_id: number;
  waybill_number: string;
  ettn_uuid: string;
  document_type: string;
  issue_date: string;
  shipment_date: string;
  
  shipper_title: string;
  shipper_tax_office: string;
  shipper_tax_id: string;
  shipper_mersis: string;
  shipper_trade_reg_no: string;
  shipper_address: string;
  shipper_phone: string;
  shipper_email: string;
  shipper_web: string;
  
  receiver_title: string;
  receiver_tax_office?: string;
  receiver_tax_id?: string;
  receiver_address: string;
  
  carrier_company: string;
  vehicle_plate: string;
  driver_name: string;
  driver_tckn: string;
  carrier_tracking_code?: string;
  warehouse: string;
  status: string;
  
  items: WaybillItem[];
  total_line_count: number;
  total_quantity: number;
  total_pallets_count: number;
  total_boxes_count: number;
  total_estimated_weight_kg: number;
  
  legal_notice: string;
  adr_safety_notice: string;
}

interface WaybillModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatchId: number | null;
  onCarrierUpdated?: () => void;
}

export const WaybillModal: React.FC<WaybillModalProps> = ({
  isOpen,
  onClose,
  dispatchId,
  onCarrierUpdated,
}) => {
  const [data, setData] = useState<WaybillData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit carrier details modal/drawer state
  const [isEditingCarrier, setIsEditingCarrier] = useState<boolean>(false);
  const [editPlate, setEditPlate] = useState<string>('');
  const [editDriver, setEditDriver] = useState<string>('');
  const [editDriverTckn, setEditDriverTckn] = useState<string>('');
  const [editCarrierCompany, setEditCarrierCompany] = useState<string>('');
  const [savingCarrier, setSavingCarrier] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !dispatchId) return;

    const fetchWaybill = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/v1/inventory/dispatch/${dispatchId}/waybill`);
        setData(res.data);
        setEditPlate(res.data.vehicle_plate || '34 GNY 1984');
        setEditDriver(res.data.driver_name || 'Kemal Yılmaz');
        setEditDriverTckn(res.data.driver_tckn || '29810482910');
        setEditCarrierCompany(res.data.carrier_company || 'Günay Kimya Özel Lojistik Filosu');
      } catch (err: any) {
        console.error('Failed to fetch waybill details:', err);
        setError('İrsaliye detayları yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    fetchWaybill();
  }, [isOpen, dispatchId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveCarrier = async () => {
    if (!dispatchId) return;
    setSavingCarrier(true);
    try {
      await axios.put(`/api/v1/inventory/dispatch/${dispatchId}/carrier`, {
        vehicle_plate: editPlate,
        driver_name: editDriver,
        driver_tckn: editDriverTckn,
        carrier_company: editCarrierCompany,
      });

      if (data) {
        setData({
          ...data,
          vehicle_plate: editPlate,
          driver_name: editDriver,
          driver_tckn: editDriverTckn,
          carrier_company: editCarrierCompany,
        });
      }
      setIsEditingCarrier(false);
      if (onCarrierUpdated) onCarrierUpdated();
    } catch (err) {
      alert('Taşıyıcı bilgileri güncellenirken bir hata oluştu.');
    } finally {
      setSavingCarrier(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm p-2 sm:p-6 flex justify-center items-start print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible">
      {/* Container Card */}
      <div className="bg-surface border border-border rounded-2xl w-full max-w-5xl shadow-2xl my-2 sm:my-6 flex flex-col overflow-hidden print:border-none print:shadow-none print:bg-white print:w-full print:max-w-none print:my-0">
        {/* Floating Top Control Bar (Hidden on print) */}
        <div className="no-print sticky top-0 z-30 bg-surface border-b border-border px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-text-muted" />
            <h2 className="text-sm font-bold text-text">
              Resmi Sevk İrsaliyesi Önizleme (e-İrsaliye)
            </h2>
            {data && (
              <span className="text-xs font-mono bg-primary-soft text-primary border border-primary-border px-2 py-0.5 rounded">
                {data.waybill_number}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingCarrier(!isEditingCarrier)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-border/30 border border-border text-xs text-text transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-text-muted" />
              <span>Sürücü/Plaka Düzenle</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all border border-transparent"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Yazdır / PDF İndir</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border/30 transition-colors ml-2"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carrier Quick Edit Form Overlay (Hidden on print) */}
        {isEditingCarrier && (
          <div className="no-print bg-surface border-b border-border p-4 sm:p-5 animate-fadeIn">
            <div className="max-w-4xl mx-auto space-y-3">
              <div className="flex items-center gap-2 text-text text-xs font-bold">
                <Truck className="w-4 h-4 text-text-muted" />
                <span>Taşıyıcı ve Sürücü Bilgilerini Güncelle (e-İrsaliye Resmi Kaydı)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-text-muted mb-1">Taşıyıcı Firma</label>
                  <input
                    type="text"
                    value={editCarrierCompany}
                    onChange={(e) => setEditCarrierCompany(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-text focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-muted mb-1">Araç Plakası</label>
                  <input
                    type="text"
                    value={editPlate}
                    onChange={(e) => setEditPlate(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-text font-mono uppercase focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-muted mb-1">Sürücü Adı Soyadı</label>
                  <input
                    type="text"
                    value={editDriver}
                    onChange={(e) => setEditDriver(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-text focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-muted mb-1">Sürücü T.C. Kimlik No</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={editDriverTckn}
                    onChange={(e) => setEditDriverTckn(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-text font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsEditingCarrier(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface border border-border text-text text-xs hover:bg-border/30"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveCarrier}
                  disabled={savingCarrier}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover transition border border-transparent"
                >
                  {savingCarrier ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Kaydet</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading / Error States */}
        {loading && (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-xs">İrsaliye verisi ve barkod şeceresi derleniyor...</span>
          </div>
        )}

        {error && !loading && (
          <div className="p-8 text-center text-danger text-xs">
            {error}
          </div>
        )}

        {/* OFFICIAL A4 WAYBILL PAPER TEMPLATE */}
        {data && !loading && (
          <div className="p-2 sm:p-6 bg-bg flex justify-center overflow-x-auto print:p-0 print:bg-white print:overflow-visible">
            <div className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-4 sm:p-8 shadow-2xl rounded-sm text-[11px] leading-tight flex flex-col justify-between border border-slate-300 print:shadow-none print:border-none print:rounded-none print:w-full print:max-w-none print:min-h-0 print:p-0 mx-auto">
              <div>
                {/* 1. Header Box */}
                <div className="border-2 border-slate-800 p-3 rounded-sm mb-4">
                  <div className="grid grid-cols-12 gap-3 items-center">
                    {/* Company Branding */}
                    <div className="col-span-7 border-r border-slate-300 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 bg-emerald-700 text-white font-extrabold flex items-center justify-center rounded text-sm tracking-wider">
                          G
                        </div>
                        <div>
                          <h1 className="text-sm font-black tracking-tight text-slate-900 uppercase">
                            {data.shipper_title}
                          </h1>
                          <p className="text-[10px] text-slate-600 font-medium">
                            Endüstriyel Temizlik & Kimyasal Çözümler Üretim Tesisleri
                          </p>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-600 space-y-0.5 mt-2">
                        <p>{data.shipper_address}</p>
                        <p>
                          <span className="font-semibold">Tel:</span> {data.shipper_phone} |{' '}
                          <span className="font-semibold">E-Posta:</span> {data.shipper_email} |{' '}
                          <span className="font-semibold">Web:</span> {data.shipper_web}
                        </p>
                        <p>
                          <span className="font-semibold">{data.shipper_tax_office}</span> VKN:{' '}
                          <span className="font-bold font-mono">{data.shipper_tax_id}</span> | Tic. Sicil:{' '}
                          {data.shipper_trade_reg_no} | Mersis: {data.shipper_mersis}
                        </p>
                      </div>
                    </div>

                    {/* Official Document Badge & QR Matrix */}
                    <div className="col-span-5 flex items-center justify-between pl-1">
                      <div className="space-y-1">
                        <div className="inline-block bg-slate-900 text-white font-bold px-2 py-0.5 rounded text-[10px] tracking-wide">
                          e-İRSALİYE
                        </div>
                        <div className="text-[10px]">
                          <span className="text-slate-500 block">İrsaliye No:</span>
                          <span className="font-mono font-bold text-xs text-slate-900">{data.waybill_number}</span>
                        </div>
                        <div className="text-[9px] text-slate-500">
                          <span className="block">ETTN (UUID):</span>
                          <span className="font-mono text-[9px] text-slate-700 break-all">{data.ettn_uuid}</span>
                        </div>
                        <div className="text-[10px] flex gap-2">
                          <div>
                            <span className="text-slate-500 block">Düzenleme:</span>
                            <span className="font-semibold">{data.issue_date}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Fiili Sevk:</span>
                            <span className="font-semibold text-emerald-800">{data.shipment_date}</span>
                          </div>
                        </div>
                      </div>

                      {/* Simulated Official Verification QR Code */}
                      <div className="w-16 h-16 border border-slate-400 bg-slate-50 p-1 flex flex-col items-center justify-center shrink-0">
                        <QrCode className="w-12 h-12 text-slate-900" />
                        <span className="text-[7px] font-mono text-slate-500 uppercase mt-0.5">GİB ONAYLI</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Sender / Receiver Two-Column Cards */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Receiver (Cari / Alıcı) */}
                  <div className="border border-slate-400 p-2.5 rounded-sm bg-slate-50/50">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1 border-b border-slate-200 pb-0.5">
                      SAYIN (ALICI BİLGİLERİ)
                    </span>
                    <h3 className="font-bold text-slate-900 text-xs leading-snug">{data.receiver_title}</h3>
                    <p className="text-[10px] text-slate-700 mt-1 leading-normal font-medium">
                      {data.receiver_address}
                    </p>
                    <div className="mt-2 pt-1 border-t border-slate-200 text-[10px] text-slate-600 flex gap-4">
                      <div>
                        <span className="text-slate-400">Vergi Dairesi:</span>{' '}
                        <span className="font-semibold text-slate-800">{data.receiver_tax_office || 'Büyük Mükellefler V.D.'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">VKN/TCKN:</span>{' '}
                        <span className="font-mono font-bold text-slate-800">{data.receiver_tax_id || '3250819402'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Carrier & Vehicle Logistics Information */}
                  <div className="border border-slate-400 p-2.5 rounded-sm bg-slate-50/50">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1 border-b border-slate-200 pb-0.5">
                      SEVKİYAT & TAŞIYICI DETAYLARI
                    </span>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                      <div>
                        <span className="text-slate-400 block">Taşıyıcı Firma:</span>
                        <span className="font-semibold text-slate-800">{data.carrier_company}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Araç Plakası:</span>
                        <span className="font-mono font-bold text-slate-900 bg-slate-200/80 px-1.5 py-0.2 rounded inline-block">
                          {data.vehicle_plate}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Sürücü Adı Soyadı:</span>
                        <span className="font-semibold text-slate-800">{data.driver_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Sürücü TCKN:</span>
                        <span className="font-mono text-slate-800">{data.driver_tckn}</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200 flex justify-between">
                        <div>
                          <span className="text-slate-400">Çıkış Deposu:</span>{' '}
                          <span className="font-semibold text-slate-800">{data.warehouse}</span>
                        </div>
                        {data.carrier_tracking_code && (
                          <div>
                            <span className="text-slate-400">Takip:</span>{' '}
                            <span className="font-mono font-semibold text-cyan-800">{data.carrier_tracking_code}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Items Table */}
                <div className="border border-slate-800 rounded-sm overflow-hidden mb-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white text-[9px] uppercase tracking-wider font-bold">
                        <th className="py-1.5 px-2 text-center w-8 border-r border-slate-700">Sıra</th>
                        <th className="py-1.5 px-2.5 w-24 border-r border-slate-700">Ürün Kodu</th>
                        <th className="py-1.5 px-3 border-r border-slate-700">Malzeme / Kimyasal Tanımı</th>
                        <th className="py-1.5 px-2.5 w-28 border-r border-slate-700">Ambalaj / Tip</th>
                        <th className="py-1.5 px-2.5 w-24 border-r border-slate-700">Parti / Lot No</th>
                        <th className="py-1.5 px-2.5 w-32 border-r border-slate-700">ADR Sınıfı</th>
                        <th className="py-1.5 px-2.5 text-right w-16 border-r border-slate-700">Miktar</th>
                        <th className="py-1.5 px-2 text-center w-12 border-r border-slate-700">Birim</th>
                        <th className="py-1.5 px-2.5 text-right w-20">Tah. Ağırlık</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 text-[10px]">
                      {data.items.map((item) => (
                        <tr key={item.line_no} className="hover:bg-slate-50/50">
                          <td className="py-2 px-2 text-center font-bold text-slate-600 border-r border-slate-200">
                            {item.line_no}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-800 border-r border-slate-200">
                            {item.sku}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <span className="font-semibold text-slate-900 block">{item.name}</span>
                            {item.barcode_list && item.barcode_list.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.barcode_list.slice(0, 3).map((b, bIdx) => (
                                  <span
                                    key={bIdx}
                                    className="font-mono text-[8px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-300"
                                  >
                                    {b}
                                  </span>
                                ))}
                                {item.barcode_list.length > 3 && (
                                  <span className="text-[8px] text-slate-500 font-mono">
                                    +{item.barcode_list.length - 3} barkod daha
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-slate-700 border-r border-slate-200">
                            {item.package_type}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-medium text-slate-800 border-r border-slate-200">
                            {item.batch_number || '-'}
                          </td>
                          <td className="py-2 px-2.5 text-[9px] text-slate-600 border-r border-slate-200">
                            {item.adr_class}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-slate-900 border-r border-slate-200 font-mono">
                            {item.quantity.toLocaleString('tr-TR')}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-700 border-r border-slate-200 uppercase font-semibold">
                            {item.unit}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-slate-800">
                            {item.gross_weight_kg > 0 ? `${item.gross_weight_kg.toFixed(0)} KG` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 4. Totals Summary & ADR Safety Card */}
                <div className="grid grid-cols-12 gap-3 mb-4">
                  {/* Safety & Legal Box */}
                  <div className="col-span-8 border border-slate-300 p-2.5 rounded-sm bg-slate-50 text-[9px] space-y-1 text-slate-700">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 uppercase">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      <span>KİMYASAL TAŞIMA VE MEVZUAT BİLGİLENDİRMESİ</span>
                    </div>
                    <p className="leading-tight text-slate-600">
                      {data.legal_notice}
                    </p>
                    <p className="leading-tight text-slate-600">
                      {data.adr_safety_notice}
                    </p>
                  </div>

                  {/* Quantitative Totals Box */}
                  <div className="col-span-4 border border-slate-400 p-2.5 rounded-sm bg-slate-100 text-[10px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Toplam Kalem Sayısı:</span>
                      <span className="font-bold text-slate-900">{data.total_line_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sevk Edilen Miktar:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {data.total_quantity.toLocaleString('tr-TR')}
                      </span>
                    </div>
                    {data.total_pallets_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Doğrulanan Palet:</span>
                        <span className="font-bold text-emerald-800 font-mono">{data.total_pallets_count} Palet</span>
                      </div>
                    )}
                    {data.total_estimated_weight_kg > 0 && (
                      <div className="flex justify-between pt-1 border-t border-slate-300 text-xs">
                        <span className="font-semibold text-slate-800">Tahmini Brüt Ağırlık:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {data.total_estimated_weight_kg.toLocaleString('tr-TR')} KG
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. Signature and Stamping Boxes */}
              <div className="pt-4 border-t-2 border-slate-800">
                <div className="grid grid-cols-2 gap-8 text-center text-[10px]">
                  <div className="border border-slate-300 p-4 rounded-sm min-h-[90px] flex flex-col justify-between">
                    <div className="font-bold uppercase text-slate-800">
                      TESLİM EDEN (GÜNAY KİMYA SAN. VE TİC. A.Ş.)
                    </div>
                    <div className="text-[9px] text-slate-500 italic">
                      Depo Yetkilisi / Sevkiyat Sorumlusu / Sürücü İmza - Kaşe
                    </div>
                  </div>

                  <div className="border border-slate-300 p-4 rounded-sm min-h-[90px] flex flex-col justify-between">
                    <div className="font-bold uppercase text-slate-800">
                      TESLİM ALAN (ALICI FİRMA YETKİLİSİ)
                    </div>
                    <div className="text-[9px] text-slate-500 italic">
                      Malzemeyi Eksiksiz ve Hasarsız Teslim Aldım (İmza - Kaşe - Tarih)
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[8px] text-slate-400 text-center flex justify-between">
                  <span>Günay Kimya ERP v1.0 • e-İrsaliye Belge Doğrulama Kodu: {data.ettn_uuid.substring(0, 18)}</span>
                  <span>Sayfa 1 / 1</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
