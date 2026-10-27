import React, { useState, useEffect } from 'react';
import {
  Factory,
  Boxes,
  ShoppingCart,
  Wallet,
  Activity,
  FlaskConical,
  Package,
  Barcode,
  ScanBarcode,
  ShoppingBag,
  Truck,
  LayoutDashboard,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Layers,
  Users,
  Building2,
  Briefcase,
  FileCheck2,
  PackageCheck,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SubMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
}

interface MenuGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  roles: string[];
  items: SubMenuItem[];
}

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const { user, logout } = useAuth();

  const userRolesStr = (user?.roles || []).map((r) => r.toLowerCase()).join(' ');
  const isAdmin = userRolesStr.includes('admin') || userRolesStr.includes('yönetici') || userRolesStr.includes('yonetici');
  const isDepo = userRolesStr.includes('depo');
  const isBayi = userRolesStr.includes('bayi') || userRolesStr.includes('b2b');
  const isMuhasebe = userRolesStr.includes('muhasebe');

  let panelSubtitle = 'B2B Bayi Portalı';
  if (isAdmin) panelSubtitle = 'Endüstriyel ERP Kontrol';
  else if (isDepo) panelSubtitle = 'Depo & Lojistik Portalı';
  else if (isMuhasebe) panelSubtitle = 'Muhasebe & Finans Portalı';

  // 4 Process Accordion Groups (Max 2 Levels: Group -> SubItems)
  const menuGroups: MenuGroup[] = [
    {
      id: 'mfg',
      title: 'ÜRETİM YÖNETİMİ',
      icon: Factory,
      roles: ['admin', 'bayi', 'uretim', 'fabrika_muduru'],
      items: [
        {
          id: 'factory_dashboard',
          label: 'Canlı Sipariş & Fazlar',
          icon: Activity,
          roles: ['admin', 'bayi']
        },
        {
          id: 'bom_management',
          label: 'Reçete (BOM) Yönetimi',
          icon: FlaskConical,
          roles: ['admin']
        },
        {
          id: 'packaging_station',
          label: 'Paketleme İstasyonu',
          icon: PackageCheck,
          roles: ['admin', 'uretim', 'fabrika_muduru']
        }
      ]
    },
    {
      id: 'inventory_logistics',
      title: 'STOK & LOJİSTİK',
      icon: Boxes,
      roles: ['admin', 'depo'],
      items: [
        {
          id: 'inventory_stock',
          label: 'Stok',
          icon: Package,
          roles: ['admin', 'depo']
        },
        {
          id: 'products_raw_materials',
          label: 'Ürünler & Hammaddeler',
          icon: Layers,
          roles: ['admin', 'depo']
        },
        {
          id: 'pallet_box_center',
          label: 'Hazır Palet & Koli',
          icon: Barcode,
          roles: ['admin', 'depo']
        },
        {
          id: 'scanner',
          label: 'Depo Doğrulama',
          icon: ScanBarcode,
          roles: ['admin', 'depo']
        }
      ]
    },
    {
      id: 'procurement',
      title: 'SATIN ALMA',
      icon: Briefcase,
      roles: ['admin', 'depo', 'muhasebe'],
      items: [
        {
          id: 'goods_receipt',
          label: 'Mal Kabul',
          icon: FileCheck2,
          roles: ['admin', 'depo', 'muhasebe']
        },
        {
          id: 'suppliers',
          label: 'Tedarikçiler',
          icon: Building2,
          roles: ['admin', 'depo', 'muhasebe']
        }
      ]
    },
    {
      id: 'sales_dispatch',
      title: 'SATIŞ & SEVKİYAT',
      icon: ShoppingCart,
      roles: ['admin', 'bayi', 'depo', 'muhasebe'],
      items: [
        {
          id: 'orders',
          label: 'Sipariş Giriş & B2B',
          icon: ShoppingBag,
          roles: ['admin', 'bayi', 'muhasebe']
        },
        {
          id: 'customers',
          label: 'Müşteriler',
          icon: Users,
          roles: ['admin', 'bayi', 'muhasebe']
        },
        {
          id: 'logistics',
          label: 'Sevkiyat & İrsaliye Takip',
          icon: Truck,
          roles: ['admin', 'bayi', 'depo', 'muhasebe']
        }
      ]
    },
    {
      id: 'finance',
      title: 'FİNANSAL YÖNETİM',
      icon: Wallet,
      roles: ['admin', 'muhasebe'], // Strict rule: Hidden from B2B users!
      items: [
        {
          id: 'dashboard',
          label: 'Finansal Genel Bakış',
          icon: LayoutDashboard,
          roles: ['admin', 'muhasebe']
        }
      ]
    }
  ];

  // Determine which group contains the currentView to ensure only that group is open by default
  const getInitialOpenGroups = (activeView: string): Record<string, boolean> => {
    const state: Record<string, boolean> = {
      mfg: false,
      inventory_logistics: false,
      procurement: false,
      sales_dispatch: false,
      finance: false
    };
    for (const group of menuGroups) {
      if (group.items.some((it) => it.id === activeView)) {
        state[group.id] = true;
        break;
      }
    }
    return state;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => getInitialOpenGroups(currentView));

  useEffect(() => {
    for (const group of menuGroups) {
      if (group.items.some((it) => it.id === currentView)) {
        setOpenGroups((prev) => ({
          ...prev,
          [group.id]: true
        }));
        break;
      }
    }
  }, [currentView]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Filter groups and items based on role
  const visibleGroups = menuGroups
    .filter((group) => {
      // Finansal Yönetim: strictly hidden from B2B / Bayi!
      if (isBayi && group.id === 'finance') return false;
      if (isAdmin) return true;
      return group.roles.some((r) => {
        if (r === 'bayi' && isBayi) return true;
        if (r === 'depo' && isDepo) return true;
        if (r === 'muhasebe' && isMuhasebe) return true;
        return false;
      });
    })
    .map((group) => {
      const visibleItems = group.items.filter((item) => {
        if (isBayi && group.id === 'finance') return false;
        if (isAdmin) return true;
        if (!item.roles) return true;
        return item.roles.some((r) => {
          if (r === 'bayi' && isBayi) return true;
          if (r === 'depo' && isDepo) return true;
          if (r === 'muhasebe' && isMuhasebe) return true;
          return false;
        });
      });
      return { ...group, items: visibleItems };
    })
    .filter((group) => group.items.length > 0);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-10 w-72 md:w-64 bg-surface border-r border-border flex flex-col justify-between shrink-0 h-screen select-none transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Brand Header */}
          <div className="h-16 flex items-center justify-between px-5 md:px-6 border-b border-border bg-surface sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-soft border border-primary-border text-primary flex items-center justify-center shrink-0">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-text text-base tracking-tight leading-none block">
                  GÜNAY KİMYA
                </span>
                <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase leading-none block mt-1">
                  {panelSubtitle}
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="md:hidden p-2 rounded-xl text-text-muted hover:text-text hover:bg-bg transition"
              aria-label="Menüyü Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        {/* Process-Oriented Accordion Menu */}
        <nav className="p-3 space-y-2">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = !!openGroups[group.id];

            const groupStyleMap: Record<string, { softBg: string; textColor: string; border: string }> = {
              mfg: {
                softBg: 'bg-mod-uretim-soft',
                textColor: 'text-mod-uretim',
                border: 'border-mod-uretim-border',
              },
              inventory_logistics: {
                softBg: 'bg-mod-stok-soft',
                textColor: 'text-mod-stok',
                border: 'border-mod-stok-border',
              },
              procurement: {
                softBg: 'bg-mod-stok-soft',
                textColor: 'text-mod-stok',
                border: 'border-mod-stok-border',
              },
              sales_dispatch: {
                softBg: 'bg-mod-satis-soft',
                textColor: 'text-mod-satis',
                border: 'border-mod-satis-border',
              },
              finance: {
                softBg: 'bg-mod-finans-soft',
                textColor: 'text-mod-finans',
                border: 'border-mod-finans-border',
              },
            };

            const style = groupStyleMap[group.id] || {
              softBg: 'bg-primary-soft',
              textColor: 'text-primary',
              border: 'border-primary-border',
            };

            return (
              <div key={group.id} className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
                {/* Accordion Group Header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-all ${
                    isOpen
                      ? `${style.softBg} text-text`
                      : 'bg-surface text-text hover:bg-bg'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* 32px rounded-corner box with module -soft bg and module icon color */}
                    <div className={`w-8 h-8 rounded-lg ${style.softBg} ${style.textColor} flex items-center justify-center shrink-0 border ${style.border}`}>
                      <GroupIcon className="w-4 h-4" />
                    </div>
                    <span className="tracking-wide uppercase text-[11px] text-text font-bold">{group.title}</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isOpen ? `transform rotate-180 ${style.textColor}` : 'text-text-muted'
                    }`}
                  />
                </button>

                {/* Sub-Items (Level 2) */}
                {isOpen && (
                  <div className="p-1.5 space-y-1 bg-surface border-t border-border">
                    {group.items.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isActive = currentView === subItem.id;

                      return (
                        <button
                          key={subItem.id}
                          onClick={() => {
                            onNavigate(subItem.id);
                            onCloseMobile?.();
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-primary-soft text-primary font-bold border-l-[3px] border-l-primary rounded-r-lg'
                              : 'text-text hover:bg-bg hover:text-text border-l-[3px] border-l-transparent rounded-r-lg'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <SubIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-text-muted'}`} />
                            <span className="truncate">{subItem.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* User Card & Logout Footer */}
      <div className="p-3 border-t border-border bg-surface">
        <div className="bg-bg rounded-xl p-2.5 mb-2.5 border border-border">
          <div className="flex items-center gap-2 text-xs font-semibold text-text truncate">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{user?.full_name}</span>
          </div>
          <div className="text-[10px] text-text-muted truncate mt-0.5 font-mono">
            {user?.email}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {user?.roles?.map((r) => (
              <span
                key={r}
                className="text-[9px] bg-surface text-text px-1.5 py-0.5 rounded font-semibold border border-border font-mono"
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-danger hover:bg-danger-soft border border-danger-border transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Güvenli Çıkış</span>
        </button>
      </div>
    </aside>
    </>
  );
};
