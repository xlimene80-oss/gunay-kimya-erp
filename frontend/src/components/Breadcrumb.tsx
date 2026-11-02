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
  // 1. Ana Panel
  ana_panel: {
    group: 'ANA PANEL',
    item: 'Yönetim & Operasyon Paneli',
    badge: 'Canlı 3 Kart'
  },
  main_dashboard: {
    group: 'ANA PANEL',
    item: 'Yönetim & Operasyon Paneli',
    badge: 'Canlı 3 Kart'
  },

  // 2. Satış & B2B
  orders: {
    group: 'SATIŞ & B2B',
    item: 'Siparişler',
    badge: 'Sipariş Giriş'
  },
  b2b: {
    group: 'SATIŞ & B2B',
    item: 'B2B Bayi Siparişleri',
    badge: 'Bayi Portalı'
  },
  customers: {
    group: 'SATIŞ & B2B',
    item: 'Müşteriler',
    badge: 'Cari Kartlar & CRM'
  },
  logistics: {
    group: 'SATIŞ & B2B',
    item: 'Sevkiyat / İrsaliye',
    badge: 'Çeki & Lojistik'
  },
  manual_orders_planning: {
    group: 'SATIŞ & B2B',
    item: 'Fiyat Listeleri & Planlama',
    badge: 'Fiyatlandırma'
  },
  tracking: {
    group: 'SATIŞ & B2B',
    item: 'Sipariş & Sevkiyat Takip',
    badge: 'İzleme'
  },

  // 3. Satın Alma
  suppliers: {
    group: 'SATIN ALMA',
    item: 'Tedarikçiler',
    badge: 'Kimya & Hammadde'
  },
  purchasing_requests: {
    group: 'SATIN ALMA',
    item: 'Satın Alma Siparişleri',
    badge: 'İç Talepler'
  },
  goods_receipt: {
    group: 'SATIN ALMA',
    item: 'Mal Kabul',
    badge: 'e-İrsaliye UBL-TR'
  },

  // 4. Stok & Depo
  products_raw_materials: {
    group: 'STOK & DEPO',
    item: 'Ürünler',
    badge: 'Master SKU'
  },
  products_sds_warning: {
    group: 'STOK & DEPO',
    item: 'Hammaddeler (SDS/ADR)',
    badge: 'Tehlikeli Madde'
  },
  inventory_stock: {
    group: 'STOK & DEPO',
    item: 'Stok Durumu',
    badge: 'FEFO / Reaktif'
  },
  warehouse_layout: {
    group: 'STOK & DEPO',
    item: 'Depo Hareketleri & Yerleşim',
    badge: 'Hücre / Koridor'
  },
  scanner: {
    group: 'STOK & DEPO',
    item: 'Sayım & El Terminali',
    badge: 'Barkod Okuyucu'
  },

  // 5. Üretim
  factory_dashboard: {
    group: 'ÜRETİM',
    item: 'Üretim Emirleri',
    badge: 'Canlı Fazlar'
  },
  bom_management: {
    group: 'ÜRETİM',
    item: 'Reçeteler',
    badge: 'BOM Formülasyon'
  },
  pallet_box_center: {
    group: 'ÜRETİM',
    item: 'Koli / Palet Barkod',
    badge: 'SSCC-18'
  },
  packaging_station: {
    group: 'ÜRETİM',
    item: 'Paketleme İstasyonu',
    badge: 'Hat Sonu'
  },
  traceability: {
    group: 'ÜRETİM',
    item: 'Kalite & İzlenebilirlik',
    badge: 'Lot Şeceresi'
  },
  quality_pending: {
    group: 'ÜRETİM',
    item: 'Kalite Kontrol Bekleyenler',
    badge: 'Laboratuvar Onay'
  },
  quality_templates: {
    group: 'ÜRETİM',
    item: 'Test Şablonları',
    badge: 'TSE / ISO Standart'
  },
  quality_coas: {
    group: 'ÜRETİM',
    item: 'Analiz Sertifikaları',
    badge: 'COA Belgesi'
  },

  // 6. Finans
  fin_invoices: {
    group: 'FİNANS',
    item: 'Faturalar',
    badge: 'e-Fatura / e-Arşiv'
  },
  fin_payments: {
    group: 'FİNANS',
    item: 'Tahsilat / Ödeme',
    badge: 'Nakit Akışı'
  },
  fin_accounts: {
    group: 'FİNANS',
    item: 'Cari Hesaplar',
    badge: 'Risk & Ekstre'
  },
  dashboard: {
    group: 'FİNANS',
    item: 'Finansal Raporlar',
    badge: 'Mali Analitik'
  },

  // 7. İnsan Kaynakları
  hr_interviews: {
    group: 'İNSAN KAYNAKLARI',
    item: 'Personel & Adaylar',
    badge: 'Kadro Yönetimi'
  },
  hr_leave: {
    group: 'İNSAN KAYNAKLARI',
    item: 'İzin Takibi',
    badge: 'Yıllık / Rapor'
  },
  hr_attendance: {
    group: 'İNSAN KAYNAKLARI',
    item: 'Puantaj & Devam',
    badge: 'Mesai Kartı'
  },
  reports_employee: {
    group: 'İNSAN KAYNAKLARI',
    item: 'Personel Raporları',
    badge: 'Saha & Faaliyet'
  },

  // 8. Ayarlar
  settings_users: {
    group: 'AYARLAR',
    item: 'Kullanıcılar',
    badge: 'Erişim Hesapları'
  },
  settings_permissions: {
    group: 'AYARLAR',
    item: 'Yetkiler (ACL)',
    badge: 'Yetki Matrisi'
  },
  settings_system: {
    group: 'AYARLAR',
    item: 'Sistem Yapılandırması',
    badge: 'Güvenlik & Zero-Trust'
  },
  user_management: {
    group: 'AYARLAR',
    item: 'Kullanıcı & Yetki Yönetimi',
    badge: 'Modül 8'
  }
};

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ currentView, onNavigate }) => {
  const meta = viewMetaMap[currentView] || {
    group: 'GENEL BAKIŞ',
    item: 'Panel'
  };

  return (
    <nav className="flex items-center gap-2 text-xs font-medium text-text-muted select-none" aria-label="Breadcrumb">
      <button
        onClick={() => onNavigate && onNavigate('ana_panel')}
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
export default Breadcrumb;
