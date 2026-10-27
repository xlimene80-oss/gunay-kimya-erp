import React, { useState, useEffect } from 'react';
import { Truck, Layers, Activity, RefreshCw, FileText, Check } from 'lucide-react';
import { WaybillModal } from '../components/WaybillModal';

export interface OrderDetail {
  order_no: number;
  order_number?: string;
  phase?: string;
  current_status: number;
  status_label?: string;
  total_price: number;
  created_at: string;
  product_name: string;
  product_code: string;
  order_quantity: number;
  order_unit: string;
  reactor_name: string;
  carbon_footprint_kg?: number;
  lot_number?: string;
  box_barcode: string;
  pallet_barcode: string;
  dispatch_no: string;
  shipping_status: string;
}

export const SiparisVeSevkiyatTakip: React.FC = () => {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [selectedDispatchId, setSelectedDispatchId] = useState<number | null>(null);
  const [isWaybillOpen, setIsWaybillOpen] = useState<boolean>(false);

  const handleOpenWaybill = (dispatchNo: string) => {
    // If dispatch number has DSP-2026-00412, map to dispatch ID or fallback to 1
    let id = 1;
    if (dispatchNo.includes('412')) id = 2;
    if (dispatchNo.includes('408')) id = 3;
    if (dispatchNo.includes('901')) id = 1;
    setSelectedDispatchId(id);
    setIsWaybillOpen(true);
  };

  // Verileri API'den Canlı Çekme (Polling - 5 saniyede bir yeniler)
  useEffect(() => {
    const fetchOrderData = () => {
      fetch('/api/orders/details')
        .then((res) => res.json())
        .then((res) => {
          if (res.success) {
            setOrders(res.data);
            setLastRefreshed(new Date());
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error('Veri çekme hatası:', err);
          setLoading(false);
        });
    };

    fetchOrderData();
    const interval = setInterval(fetchOrderData, 5000); // 5 saniyede bir anlık takip simülasyonu
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 md:p-6 bg-surface text-text space-y-6 rounded-2xl border border-border">
      {/* BAŞLIK & CANLI POLLING BİLGİSİ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Activity className="w-6 h-6 text-text-muted" />
            <span>Sipariş & Sevkiyat Canlı Takip Paneli</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Reaktör üretim fazları ve lojistik koli/palet barkodlarının 5 saniyede bir anlık takibi
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted bg-bg px-3.5 py-2 rounded-xl border border-border">
          <RefreshCw className="w-3.5 h-3.5 text-text-muted animate-spin" />
          <span>Canlı Veri (Son Güncelleme: {lastRefreshed.toLocaleTimeString()})</span>
        </div>
      </div>

      {loading && orders.length === 0 ? (
        <div className="py-12 text-center text-text-muted text-sm">
          Sipariş ve reaktör üretim verileri yükleniyor...
        </div>
      ) : null}

      {/* 1. SİPARİŞLERİM & ÜRETİM FAZLARI SEKMEDEKİ TAKİP LİSTESİ */}
      <section className="bg-surface p-4 md:p-6 rounded-xl border border-border">
        <h2 className="text-lg font-bold mb-4 text-text flex items-center gap-2">
          <span>Aktif Siparişler & Canlı Üretim Fazları</span>
          <span className="text-xs font-mono font-normal text-text-muted bg-bg px-2.5 py-0.5 rounded-full border border-border">
            {orders.length} Sipariş
          </span>
        </h2>

        {orders.length === 0 && !loading ? (
          <div className="p-4 text-center text-text-muted text-xs">
            Kayıtlı aktif üretim siparişi bulunamadı.
          </div>
        ) : null}

        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.order_no}
              className="p-4 bg-bg rounded-lg border border-border space-y-3"
            >
              <div className="flex justify-between items-center border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-text font-bold text-sm">
                    Sipariş #{order.order_no} ({order.order_number || `ORD-00${order.order_no}`})
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface text-text-muted border border-border">
                    {order.product_code}
                  </span>
                </div>
                <span className="text-xs text-text-muted font-mono">{order.created_at}</span>
              </div>

              {/* NE ÜRETİYOR? NE KADAR ÜRETİYOR? DETAYLARI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface p-3.5 rounded-lg border border-border">
                <div>
                  <p className="text-xs text-text-muted">Üretilen Ürün (Ne Üretiyor?):</p>
                  <p className="text-sm font-bold text-text mt-0.5">{order.product_name || 'Ürün Atanmadı'}</p>
                  <p className="text-xs text-text-muted font-mono mt-0.5">Kod: {order.product_code}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Sipariş / Üretim Miktarı (Ne Kadar Üretiyor?):</p>
                  <p className="text-sm font-bold text-text font-mono mt-0.5">
                    {order.order_quantity} {order.order_unit || 'Koli'}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-text-muted" />
                    <span>İşlem Hattı: {order.reactor_name}</span>
                  </p>
                </div>
              </div>

              {/* CANLI ÜRETİM FAZLARI ADIMLARI (5 Kademeli Canlı Stepper + Sevk) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
                    Canlı Üretim Fazı İlerlemesi:
                  </span>
                  {order.carbon_footprint_kg ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface text-text-muted border border-border flex items-center gap-1">
                      {order.carbon_footprint_kg} kg CO₂e
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-between relative px-2 py-1">
                  {/* Arka plan çizgisi (kalan: border, tamamlanan: success) */}
                  <div className="absolute top-4 left-6 right-6 h-0.5 bg-border z-0" />
                  <div
                    className="absolute top-4 left-6 h-0.5 bg-success transition-all duration-500 z-0"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((Math.max(1, order.current_status - 1)) / 5) * 100))}%`,
                    }}
                  />

                  {[
                    { step: 1, title: 'Sipariş' },
                    { step: 2, title: 'Reçete' },
                    { step: 3, title: 'Reaktörde' },
                    { step: 4, title: 'Dolum' },
                    { step: 5, title: 'Hazır' },
                    { step: 6, title: 'Sevk' },
                  ].map((s) => {
                    const isDone = order.current_status > s.step;
                    const isCurrent = order.current_status === s.step;
                    return (
                      <div
                        key={s.step}
                        className={`flex flex-col items-center z-10 ${
                          isCurrent
                            ? 'text-primary font-bold'
                            : isDone
                            ? 'text-text font-semibold'
                            : 'text-text-muted'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-xs transition-all ${
                            isDone
                              ? 'bg-success border-success text-white'
                              : isCurrent
                              ? 'bg-primary border-primary text-white shadow-card'
                              : 'bg-surface border-border text-text-muted'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.step}
                        </div>
                        <span className="text-[10px] mt-1 font-semibold">{s.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. SEVKİYAT VE TAKİP - BARKODLARIN GÖSTERİLDİĞİ PORTAL */}
      <section className="bg-surface p-4 md:p-6 rounded-xl border border-border space-y-4">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          <Truck className="w-5 h-5 text-text-muted" />
          <span>Lojistik & Sevkiyat Barkod Takip Portalı</span>
        </h2>

        <div className="space-y-4">
          {orders
            .filter((o) => o.dispatch_no)
            .map((shipment) => (
              <div
                key={shipment.dispatch_no}
                className="p-4 bg-bg rounded-lg border border-border space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                        shipment.shipping_status === 'SEVK EDİLDİ' || shipment.shipping_status === 'TESLİM EDİLDİ'
                          ? 'bg-success-soft text-success-text border-success-border'
                          : shipment.shipping_status === 'HAZIRLANIYOR' || shipment.shipping_status === 'YOLDA'
                          ? 'bg-warning-soft text-warning-text border-warning-border'
                          : 'bg-primary-soft text-primary-text border-primary-border'
                      }`}
                    >
                      {shipment.shipping_status}
                    </span>
                    <p className="text-sm font-mono mt-1.5 text-text font-bold">
                      Sevk No: <span className="text-text">{shipment.dispatch_no}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 self-start sm:self-center">
                    <button
                      onClick={() => handleOpenWaybill(shipment.dispatch_no)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-border/30 border border-border text-text text-xs font-semibold transition-all"
                      title="Resmi Sevk İrsaliyesi / e-İrsaliye Belgesini Görüntüle ve Yazdır"
                    >
                      <FileText className="w-3.5 h-3.5 text-text-muted" />
                      <span>İrsaliye Görüntüle</span>
                    </button>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-text-muted">Hazırlanan İçerik:</p>
                      <p className="text-sm font-bold text-text">
                        {shipment.order_quantity} {shipment.order_unit || 'Koli'} - {shipment.product_name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AKILLI BARKOD VE PALET KODLARI BÖLÜMÜ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface p-3.5 rounded-lg border border-border">
                  <div className="p-3 bg-bg rounded-lg border border-border">
                    <p className="text-xs text-text-muted">Koli Barkod Kodu:</p>
                    <p className="text-xs md:text-sm font-mono text-text font-bold tracking-wider mt-1 break-all">
                      {shipment.box_barcode ? (
                        shipment.box_barcode
                      ) : (
                        <span className="text-text-muted font-normal">Üretim Bekleniyor / Basılmadı</span>
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-bg rounded-lg border border-border">
                    <p className="text-xs text-text-muted">Palet Barkod Kodu:</p>
                    <p className="text-xs md:text-sm font-mono text-text font-bold tracking-wider mt-1 break-all">
                      {shipment.pallet_barcode ? (
                        shipment.pallet_barcode
                      ) : (
                        <span className="text-text-muted font-normal">Paletlenmedi / Kod Yok</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Official Waybill (e-İrsaliye) Modal */}
      <WaybillModal
        isOpen={isWaybillOpen}
        onClose={() => setIsWaybillOpen(false)}
        dispatchId={selectedDispatchId}
      />
    </div>
  );
};

export default SiparisVeSevkiyatTakip;
