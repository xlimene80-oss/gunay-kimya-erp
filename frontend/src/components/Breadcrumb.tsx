import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbProps {
  currentView: string;
  onNavigate?: (view: string) => void;
}

interface NavMeta {
  group: string;
  item: string;
  badge?: string;
}

export const viewMetaMap: Record<string, NavMeta> = {
  factory_dashboard: {
    group: 'ÜRETİM YÖNETİMİ',
    item: 'Canlı Sipariş & Fazlar',
    badge: 'Canlı 5s',
  },
  bom_management: {
    group: 'ÜRETİM YÖNETİMİ',
    item: 'Reçete (BOM) Yönetimi',
    badge: 'Formülasyon',
  },
  packaging_station: {
    group: 'ÜRETİM YÖNETİMİ',
    item: 'Paketleme İstasyonu',
    badge: 'Hat Sonu & SSCC-18',
  },
  inventory_stock: {
    group: 'STOK & LOJİSTİK',
    item: 'Stok',
    badge: 'FEFO / Reaktif',
  },
  products_raw_materials: {
    group: 'STOK & LOJİSTİK',
    item: 'Ürünler & Hammaddeler',
    badge: 'Master SKU',
  },
  pallet_box_center: {
    group: 'STOK & LOJİSTİK',
    item: 'Hazır Palet & Koli',
    badge: 'SSCC-18',
  },
  scanner: {
    group: 'STOK & LOJİSTİK',
    item: 'Depo Doğrulama',
    badge: 'El Terminali',
  },
  goods_receipt: {
    group: 'SATIN ALMA',
    item: 'Mal Kabul',
    badge: 'e-İrsaliye UBL-TR',
  },
  suppliers: {
    group: 'SATIN ALMA',
    item: 'Tedarikçiler',
    badge: 'Hammadde & Kimya',
  },
  orders: {
    group: 'SATIŞ & SEVKİYAT',
    item: 'Sipariş Giriş & B2B',
    badge: 'Bayi Portalı',
  },
  customers: {
    group: 'SATIŞ & SEVKİYAT',
    item: 'Müşteriler',
    badge: 'Cari Hesaplar',
  },
  tracking: {
    group: 'SATIŞ & SEVKİYAT',
    item: 'Canlı Sipariş & Fazlar',
    badge: 'B2B Takip',
  },
  logistics: {
    group: 'SATIŞ & SEVKİYAT',
    item: 'Sevkiyat & İrsaliye Takip',
    badge: 'Çeki & İrsaliye',
  },
  dashboard: {
    group: 'FİNANSAL YÖNETİM',
    item: 'Finansal Genel Bakış',
    badge: 'Yönetici Özel',
  },
  traceability: {
    group: 'İZLENEBİLİRLİK',
    item: 'Ürün Şeceresi (Lot / Palet)',
    badge: 'Ayak İzi',
  },
};

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ currentView, onNavigate }) => {
  const meta = viewMetaMap[currentView] || {
    group: 'GENEL BAKIŞ',
    item: 'Panel',
  };

  return (
    <nav className="flex items-center gap-2 text-xs font-medium text-text-muted select-none" aria-label="Breadcrumb">
      <button
        onClick={() => onNavigate && onNavigate('factory_dashboard')}
        className="flex items-center gap-1.5 text-text-muted hover:text-text transition-colors"
        title="Ana Ekrana Dön"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">ERP</span>
      </button>

      <ChevronRight className="w-3.5 h-3.5 text-border shrink-0" />

      <span className="text-text-muted font-semibold uppercase tracking-wider text-[11px]">
        {meta.group}
      </span>

      <ChevronRight className="w-3.5 h-3.5 text-border shrink-0" />

      <div className="flex items-center gap-2">
        <span className="text-text font-bold tracking-tight">
          {meta.item}
        </span>
        {meta.badge && (
          <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary-soft text-primary border border-primary-border">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {meta.badge}
          </span>
        )}
      </div>
    </nav>
  );
};
