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

  // 2. CRM ve Sipariş
  customers: {
    group: 'CRM VE SİPARİŞ',
    item: 'Müşteriler',
    badge: 'Cari Kartlar & CRM'
  },
  quotes: {
    group: 'CRM VE SİPARİŞ',
    item: 'Teklifler & Proforma',
    badge: 'Proforma & Satış'
  },
  orders: {
    group: 'CRM VE SİPARİŞ',
    item: 'Satış Siparişleri',
    badge: 'Sipariş Giriş'
  },
  b2b: {
    group: 'CRM VE SİPARİŞ',
    item: 'B2B Bayi Siparişleri',
    badge: 'Bayi Portalı'
  },
  manual_orders_planning: {
    group: 'CRM VE SİPARİŞ',
    item: 'Fiyat Listeleri',
    badge: 'Fiyatlandırma'
  },

  // 3. Satın Alma
  suppliers: {
    group: 'SATIN ALMA',
    item: 'Tedarikçiler',
    badge: 'Kimya & Hammadde'
  },
  purchasing_requests: {
    group: 'SATIN ALMA',
    item: 'Satın Alma Talepleri / Siparişleri',
    badge: 'Talepler & Sipariş'
  },
  goods_receipt: {
    group: 'SATIN ALMA',
    item: 'Mal Kabul',
    badge: 'e-İrsaliye UBL-TR'
  },

  // 4. Envanter
  products_raw_materials: {
    group: 'ENVANTER',
    item: 'Ürünler (Mamul)',
    badge: 'Master SKU'
  },
  products_sds_warning: {
    group: 'ENVANTER',
    item: 'Hammaddeler (SDS/GHS)',
    badge: 'Tehlikeli Madde'
  },
  inventory_stock: {
    group: 'ENVANTER',
    item: 'Stok Durumu (Lot/FEFO)',
    badge: 'FEFO / Reaktif'
  },
  warehouse_layout: {
    group: 'ENVANTER',
    item: 'Depo Hareketleri',
    badge: 'Hücre / Koridor'
  },
  scanner: {
    group: 'ENVANTER',
    item: 'Sayım / El Terminali',
    badge: 'Barkod Okuyucu'
  },

  // 5. Planlama ve Üretim
  factory_dashboard: {
    group: 'PLANLAMA VE ÜRETİM',
    item: 'Üretim Emirleri',
    badge: 'Canlı Fazlar'
  },
  mrp: {
    group: 'PLANLAMA VE ÜRETİM',
    item: 'Malzeme Planlama (MRP)',
    badge: 'İhtiyaç Analizi'
  },
  bom_management: {
    group: 'PLANLAMA VE ÜRETİM',
    item: 'Reçeteler (BOM)',
    badge: 'BOM Formülasyon'
  },
  pallet_box_center: {
    group: 'PLANLAMA VE ÜRETİM',
    item: 'Koli / Palet Barkod',
    badge: 'SSCC-18'
  },
  packaging_station: {
    group: 'PLANLAMA VE ÜRETİM',
    item: 'İş İstasyonu / Parti',
    badge: 'Hat Sonu & Ambalaj'
  },

  // 6. Kalite (Üretimden AYRI grup)
  quality_pending: {
    group: 'KALİTE',
    item: 'Bekleyen Kalite',
    badge: 'Laboratuvar Onay'
  },
  quality_templates: {
    group: 'KALİTE',
    item: 'Kalite Şablonları',
    badge: 'TSE / ISO Standart'
  },
  quality_coas: {
    group: 'KALİTE',
    item: 'CoA Listesi',
    badge: 'COA Belgesi'
  },
  traceability: {
    group: 'KALİTE',
    item: 'İzlenebilirlik',
    badge: 'Lot Şeceresi'
  },

  // 7. Lojistik
  logistics: {
    group: 'LOJİSTİK',
    item: 'Sevkiyat / İrsaliye',
    badge: 'Çeki & Lojistik'
  },
  tracking: {
    group: 'LOJİSTİK',
    item: 'Sipariş & Sevkiyat Takip',
    badge: 'İzleme'
  },

  // 8. Finans
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
    item: 'Raporlar',
    badge: 'Mali Analitik'
  },
  fin_reports: {
    group: 'FİNANS',
    item: 'Raporlar',
    badge: 'Mali Analitik'
  },

  // 9. İnsan Kaynakları (Sadece Admin)
  hr_interviews: {
    group: 'İNSAN KAYNAKLARI',
    item: 'Personel',
    badge: 'Kadro Yönetimi'
  },
  hr_leave: {
    group: 'İNSAN KAYNAKLARI',
    item: 'İzin',
    badge: 'Yıllık / Rapor'
  },
  hr_attendance: {
    group: 'İNSAN KAYNAKLARI',
    item: 'Puantaj',
    badge: 'Mesai Kartı'
  },
  reports_employee: {
    group: 'GENEL',
    item: 'Faaliyet Raporlarım',
    badge: 'Günlük & Saha'
  },

  // 10. Ayarlar (Sadece Admin)
  settings_users: {
    group: 'AYARLAR',
    item: 'Kullanıcılar',
    badge: 'Erişim Hesapları'
  },
  settings_permissions: {
    group: 'AYARLAR',
    item: 'Yetkiler',
    badge: 'Yetki Matrisi'
  },
  settings_system: {
    group: 'AYARLAR',
    item: 'Sistem',
    badge: 'Güvenlik & Zero-Trust'
  },
  user_management: {
    group: 'AYARLAR',
    item: 'Kullanıcı & Yetki Yönetimi',
    badge: 'Sistem'
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
