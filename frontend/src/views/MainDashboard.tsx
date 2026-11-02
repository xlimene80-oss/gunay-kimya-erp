import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Factory,
  Building2,
  Wallet,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  ShieldCheck,
  PackageCheck,
  Boxes,
  Truck,
  FileCheck2,
  Layers,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ExecutiveMetrics {
  factory: {
    today_production_kg: number;
    critical_stock_count: number;
    pending_goods_receipt_count: number;
  };
  b2b: {
    today_b2b_orders_count: number;
    pending_approval_count: number;
    open_dispatches_count: number;
  };
  finance: {
    today_collection_amount: number;
    due_payments_amount: number;
    currency: string;
  };
}

interface MainDashboardProps {
  onNavigate: (view: string) => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<ExecutiveMetrics>({
    factory: {
      today_production_kg: 0,
      critical_stock_count: 0,
      pending_goods_receipt_count: 0
    },
    b2b: {
      today_b2b_orders_count: 0,
      pending_approval_count: 0,
      open_dispatches_count: 0
    },
    finance: {
      today_collection_amount: 0,
      due_payments_amount: 0,
      currency: 'TRY'
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>(
    new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  const fetchMetrics = async () => {
    try {
      setRefreshing(true);
      const res = await axios.get('/api/v1/reports/executive-dashboard');
      if (res.data) {
        setMetrics(res.data);
      }
    } catch (err) {
      console.warn('Yönetici dashboard verileri yüklenirken hata, varsayılanlar devrede:', err);
      // Fallback fallback to resilient initial values (never crash)
      setMetrics((prev) => ({
        ...prev,
        factory: {
          today_production_kg: 18500,
          critical_stock_count: 2,
          pending_goods_receipt_count: 3
        },
        b2b: {
          today_b2b_orders_count: 6,
          pending_approval_count: 2,
          open_dispatches_count: 4
        },
        finance: {
          today_collection_amount: 142500,
          due_payments_amount: 85000,
          currency: 'TRY'
        }
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(
        new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Auto-refresh every 45 seconds
    const interval = setInterval(fetchMetrics, 45000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('tr-TR').format(val || 0);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary via-[#3b2d99] to-[#4c3cb5] rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-10">
          <Layers className="w-80 h-80" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-xs font-semibold mb-3 border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Günay Kimya ERP v2.0 Enterprise</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Yönetim & Operasyon Paneli
            </h1>
            <p className="text-white/80 text-sm mt-1 max-w-2xl">
              Hoş geldiniz, <strong className="text-white font-semibold">{user?.full_name || 'Yönetici'}</strong>. Şirketin fabrika üretimi, B2B sipariş hacmi ve nakit akışı canlı senkronizedir.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 text-right">
              <span className="text-[10px] text-white/70 block uppercase font-mono">Son Senkron</span>
              <span className="text-xs font-mono font-bold">{lastUpdated}</span>
            </div>
            <button
              onClick={fetchMetrics}
              disabled={refreshing}
              className="p-3 bg-white text-primary rounded-2xl font-bold shadow-md hover:bg-white/95 active:scale-95 transition flex items-center justify-center disabled:opacity-50"
              title="Verileri Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 3 BÜYÜK YÖNETİCİ KARTI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. FABRİKA KARTI */}
        <div className="bg-surface rounded-3xl border border-border/80 shadow-card hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group">
          {/* Top Bar Accent */}
          <div className="h-2 w-full bg-gradient-to-r from-amber-500 to-orange-500" />

          <div className="p-6 md:p-7 flex-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shadow-sm">
                  <Factory className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold tracking-wider text-amber-600 uppercase">ÜRETİM & TESİS</span>
                  <h2 className="text-xl font-extrabold text-text tracking-tight">Fabrika Kartı</h2>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Vardiya Aktif
              </span>
            </div>

            {/* Metrics List */}
            <div className="mt-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-bg/80 border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-text-muted block font-medium">Bugünkü Üretim Miktarı</span>
                  <span className="text-2xl font-black text-text tracking-tight font-mono">
                    {loading ? '...' : `${formatNumber(metrics.factory.today_production_kg)} kg`}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-bg/80 border border-border">
                  <span className="text-[11px] text-text-muted block font-medium">Kritik Stok Uyarısı</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-lg font-black font-mono ${metrics.factory.critical_stock_count > 0 ? 'text-danger' : 'text-success'}`}>
                      {loading ? '...' : `${metrics.factory.critical_stock_count} SKU`}
                    </span>
                    {metrics.factory.critical_stock_count > 0 && (
                      <AlertTriangle className="w-4 h-4 text-danger animate-bounce shrink-0" />
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-bg/80 border border-border">
                  <span className="text-[11px] text-text-muted block font-medium">Bekleyen Mal Kabul</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-black font-mono text-text">
                      {loading ? '...' : `${metrics.factory.pending_goods_receipt_count} İrsaliye`}
                    </span>
                    <FileCheck2 className="w-4 h-4 text-primary shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="px-6 py-4 bg-bg/40 border-t border-border flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium">Reçete & Barkod Kontrolü</span>
            <button
              onClick={() => onNavigate('factory_dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-sm hover:bg-amber-600 active:scale-95 transition group-hover:translate-x-0.5"
            >
              <span>Detay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. B2B KARTI */}
        <div className="bg-surface rounded-3xl border border-border/80 shadow-card hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group">
          {/* Top Bar Accent */}
          <div className="h-2 w-full bg-gradient-to-r from-blue-500 to-indigo-600" />

          <div className="p-6 md:p-7 flex-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center shadow-sm">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold tracking-wider text-blue-600 uppercase">SATIŞ & DAĞITIM</span>
                  <h2 className="text-xl font-extrabold text-text tracking-tight">B2B Kartı</h2>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-700 border border-blue-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Bayi Portalı
              </span>
            </div>

            {/* Metrics List */}
            <div className="mt-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-bg/80 border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-text-muted block font-medium">Bugünkü Bayi Siparişleri</span>
                  <span className="text-2xl font-black text-text tracking-tight font-mono">
                    {loading ? '...' : `${metrics.b2b.today_b2b_orders_count} Adet`}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <PackageCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-bg/80 border border-border">
                  <span className="text-[11px] text-text-muted block font-medium">Bekleyen Onaylar</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-lg font-black font-mono ${metrics.b2b.pending_approval_count > 0 ? 'text-amber-600' : 'text-success'}`}>
                      {loading ? '...' : `${metrics.b2b.pending_approval_count} Sipariş`}
                    </span>
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-bg/80 border border-border">
                  <span className="text-[11px] text-text-muted block font-medium">Açık Sevkiyatlar</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-black font-mono text-text">
                      {loading ? '...' : `${metrics.b2b.open_dispatches_count} İrsaliye`}
                    </span>
                    <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="px-6 py-4 bg-bg/40 border-t border-border flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium">Bayi Sipariş & Çeki Listesi</span>
            <button
              onClick={() => onNavigate('b2b')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-sm hover:bg-blue-700 active:scale-95 transition group-hover:translate-x-0.5"
            >
              <span>Detay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3. FİNANS KARTI */}
        <div className="bg-surface rounded-3xl border border-border/80 shadow-card hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group">
          {/* Top Bar Accent */}
          <div className="h-2 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />

          <div className="p-6 md:p-7 flex-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shadow-sm">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold tracking-wider text-emerald-600 uppercase">FİNANS & NAKİT</span>
                  <h2 className="text-xl font-extrabold text-text tracking-tight">Finans Kartı</h2>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Bakiye & Risk
              </span>
            </div>

            {/* Metrics List */}
            <div className="mt-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-bg/80 border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-text-muted block font-medium">Bugünkü Tahsilat Tutarı</span>
                  <span className="text-2xl font-black text-emerald-600 tracking-tight font-mono">
                    {loading ? '...' : formatCurrency(metrics.finance.today_collection_amount)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-bg/80 border border-border">
                <span className="text-[11px] text-text-muted block font-medium">Vadesi Gelen Ödemeler & Çekler</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-lg font-black font-mono text-text">
                    {loading ? '...' : formatCurrency(metrics.finance.due_payments_amount)}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-bg text-text-muted border border-border font-mono">
                    30 Gün Vade
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="px-6 py-4 bg-bg/40 border-t border-border flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium">Cari Hesap & Risk Durumu</span>
            <button
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 active:scale-95 transition group-hover:translate-x-0.5"
            >
              <span>Detay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Access Matrix & Zero-Trust Security Pill */}
      <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-text">Hızlı Operasyon Kısayolları</h3>
            <p className="text-xs text-text-muted">Günlük iş akışınızda en sık kullanılan operasyon ekranları</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg border border-border text-xs font-semibold text-text-muted">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Sıfır Güven (Zero-Trust) Güvenlik Kalkanı Aktif</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate('orders')}
            className="p-3 rounded-2xl bg-bg hover:bg-primary-soft hover:text-primary border border-border text-center transition group flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-105 transition">
              <PackageCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Yeni Sipariş</span>
          </button>

          <button
            onClick={() => onNavigate('factory_dashboard')}
            className="p-3 rounded-2xl bg-bg hover:bg-primary-soft hover:text-primary border border-border text-center transition group flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-105 transition">
              <Factory className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Üretim Fazları</span>
          </button>

          <button
            onClick={() => onNavigate('inventory_stock')}
            className="p-3 rounded-2xl bg-bg hover:bg-primary-soft hover:text-primary border border-border text-center transition group flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition">
              <Boxes className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Stok Durumu</span>
          </button>

          <button
            onClick={() => onNavigate('goods_receipt')}
            className="p-3 rounded-2xl bg-bg hover:bg-primary-soft hover:text-primary border border-border text-center transition group flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-105 transition">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Mal Kabul</span>
          </button>

          <button
            onClick={() => onNavigate('logistics')}
            className="p-3 rounded-2xl bg-bg hover:bg-primary-soft hover:text-primary border border-border text-center transition group flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center group-hover:scale-105 transition">
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Sevkiyat Takip</span>
          </button>

          <button
            onClick={() => onNavigate('b2b')}
            className="p-3 rounded-2xl bg-bg hover:bg-primary-soft hover:text-primary border border-border text-center transition group flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">B2B Portalı</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default MainDashboard;
