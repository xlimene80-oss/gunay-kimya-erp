import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Briefcase,
  Boxes,
  Factory,
  Wallet,
  Users,
  Settings,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Package,
  Layers,
  Warehouse,
  ScanBarcode,
  Barcode,
  FileCheck2,
  Building2,
  Calendar,
  ShoppingBag,
  Truck,
  ShieldAlert,
  FlaskConical,
  Activity,
  FileText,
  UserCheck,
  Sliders,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface SubMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
}

export interface MenuGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  isDirectLink?: boolean;
  directViewId?: string;
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
  const { user, logout, hasPermission } = useAuth();

  const userRoles = (user?.roles || []).map((r) => r.toLowerCase());
  const userRolesStr = userRoles.join(' ');
  const isAdmin =
    user?.role === 'admin' ||
    userRolesStr.includes('admin') ||
    userRolesStr.includes('yönetici') ||
    userRolesStr.includes('yonetici') ||
    userRolesStr.includes('firma_sahibi') ||
    userRolesStr.includes('sahip');

  const isOperator =
    (userRolesStr.includes('uretim') ||
      userRolesStr.includes('operatör') ||
      userRolesStr.includes('operator')) &&
    !isAdmin;

  const isMuhasebe = userRolesStr.includes('muhasebe') && !isAdmin;
  const isBayi =
    user?.role === 'customer' ||
    userRolesStr.includes('bayi') ||
    userRolesStr.includes('b2b') ||
    userRolesStr.includes('customer');

  let panelSubtitle = 'B2B Bayi Portalı';
  if (isAdmin) panelSubtitle = 'Endüstriyel ERP Kontrol';
  else if (isOperator) panelSubtitle = 'Üretim Terminali';
  else if (isMuhasebe) panelSubtitle = 'Muhasebe & Finans';

  // EXACT 8 HEADINGS IN EXACT SPECIFIED ORDER
  const menuGroups: MenuGroup[] = [
    // 1. Ana Panel (Doğrudan ana sayfayı açar, alt menüsü yok)
    {
      id: 'ana_panel_group',
      title: 'Ana Panel',
      icon: LayoutDashboard,
      isDirectLink: true,
      directViewId: 'ana_panel',
      roles: ['admin', 'staff', 'muhasebe', 'depo', 'uretim', 'bayi'],
      items: []
    },
    // 2. Satış & B2B
    {
      id: 'sales_b2b',
      title: 'Satış & B2B',
      icon: ShoppingCart,
      roles: ['admin', 'muhasebe', 'staff', 'bayi', 'customer'],
      items: [
        { id: 'orders', label: 'Siparişler', icon: ShoppingBag, roles: ['admin', 'staff', 'muhasebe', 'bayi'] },
        { id: 'b2b', label: 'B2B Bayi Siparişleri', icon: Building2, roles: ['admin', 'bayi', 'customer', 'staff', 'muhasebe'] },
        { id: 'customers', label: 'Müşteriler', icon: Users, roles: ['admin', 'staff', 'muhasebe'] },
        { id: 'logistics', label: 'Sevkiyat / İrsaliye', icon: Truck, roles: ['admin', 'staff', 'muhasebe', 'depo'] },
        { id: 'manual_orders_planning', label: 'Fiyat Listeleri', icon: Calendar, roles: ['admin', 'staff', 'muhasebe'] }
      ]
    },
    // 3. Satın Alma
    {
      id: 'procurement',
      title: 'Satın Alma',
      icon: Briefcase,
      roles: ['admin', 'staff', 'depo', 'muhasebe'],
      items: [
        { id: 'suppliers', label: 'Tedarikçiler', icon: Building2, roles: ['admin', 'staff', 'depo', 'muhasebe'] },
        { id: 'purchasing_requests', label: 'Satın Alma Siparişleri', icon: Briefcase, roles: ['admin', 'staff', 'depo', 'muhasebe'] },
        { id: 'goods_receipt', label: 'Mal Kabul', icon: FileCheck2, roles: ['admin', 'depo', 'staff', 'muhasebe'] }
      ]
    },
    // 4. Stok & Depo
    {
      id: 'inventory_warehouse',
      title: 'Stok & Depo',
      icon: Boxes,
      roles: ['admin', 'depo', 'staff'],
      items: [
        { id: 'products_raw_materials', label: 'Ürünler', icon: Layers, roles: ['admin', 'depo', 'staff'] },
        { id: 'products_sds_warning', label: 'Hammaddeler', icon: FlaskConical, roles: ['admin', 'depo', 'staff'] },
        { id: 'inventory_stock', label: 'Stok Durumu', icon: Package, roles: ['admin', 'depo', 'staff'] },
        { id: 'warehouse_layout', label: 'Depo Hareketleri', icon: Warehouse, roles: ['admin', 'depo'] },
        { id: 'scanner', label: 'Sayım', icon: ScanBarcode, roles: ['admin', 'depo'] }
      ]
    },
    // 5. Üretim
    {
      id: 'manufacturing',
      title: 'Üretim',
      icon: Factory,
      roles: ['admin', 'uretim', 'operator', 'fabrika_muduru', 'depo'],
      items: [
        { id: 'factory_dashboard', label: 'Üretim Emirleri', icon: Activity, roles: ['admin', 'uretim', 'fabrika_muduru'] },
        { id: 'bom_management', label: 'Reçeteler', icon: FlaskConical, roles: ['admin', 'fabrika_muduru'] },
        { id: 'pallet_box_center', label: 'Koli / Palet Barkod', icon: Barcode, roles: ['admin', 'uretim', 'operator', 'depo', 'fabrika_muduru'] },
        { id: 'traceability', label: 'Kalite & İzlenebilirlik', icon: ShieldAlert, roles: ['admin', 'uretim', 'fabrika_muduru'] }
      ]
    },
    // 6. Finans
    {
      id: 'finance',
      title: 'Finans',
      icon: Wallet,
      roles: ['admin', 'muhasebe'],
      items: [
        { id: 'fin_invoices', label: 'Faturalar', icon: FileText, roles: ['admin', 'muhasebe'] },
        { id: 'fin_payments', label: 'Tahsilat / Ödeme', icon: Wallet, roles: ['admin', 'muhasebe'] },
        { id: 'fin_accounts', label: 'Cari Hesaplar', icon: Building2, roles: ['admin', 'muhasebe'] },
        { id: 'dashboard', label: 'Raporlar', icon: LayoutDashboard, roles: ['admin', 'muhasebe'] }
      ]
    },
    // 7. İnsan Kaynakları (Sadece Admin / Firma Sahibi)
    {
      id: 'human_resources',
      title: 'İnsan Kaynakları',
      icon: Users,
      roles: ['admin'],
      items: [
        { id: 'hr_interviews', label: 'Personel', icon: Users, roles: ['admin'] },
        { id: 'hr_leave', label: 'İzin', icon: Calendar, roles: ['admin'] },
        { id: 'hr_attendance', label: 'Puantaj', icon: UserCheck, roles: ['admin'] },
        { id: 'reports_employee', label: 'Personel Raporları', icon: FileText, roles: ['admin'] }
      ]
    },
    // 8. Ayarlar (Sadece Admin / Firma Sahibi)
    {
      id: 'settings_group',
      title: 'Ayarlar',
      icon: Settings,
      roles: ['admin'],
      items: [
        { id: 'settings_users', label: 'Kullanıcılar', icon: Users, roles: ['admin'] },
        { id: 'settings_permissions', label: 'Yetkiler', icon: Sliders, roles: ['admin'] },
        { id: 'settings_system', label: 'Sistem', icon: ShieldCheck, roles: ['admin'] }
      ]
    }
  ];

  // Helper to find which group contains an active view ID
  const findGroupIdForView = (viewId: string): string | null => {
    if (viewId === 'ana_panel' || viewId === 'main_dashboard') return 'ana_panel_group';
    // Mapping for Aliased Finance & Settings sub-items
    if (viewId === 'fin_invoices' || viewId === 'fin_payments' || viewId === 'fin_accounts' || viewId === 'dashboard') {
      return 'finance';
    }
    if (viewId === 'settings_users' || viewId === 'settings_permissions' || viewId === 'settings_system' || viewId === 'user_management') {
      return 'settings_group';
    }
    if (viewId === 'hr_leave' || viewId === 'hr_attendance' || viewId === 'hr_interviews' || viewId === 'reports_employee') {
      return 'human_resources';
    }

    for (const group of menuGroups) {
      if (group.items.some((it) => it.id === viewId)) {
        return group.id;
      }
    }
    return null;
  };

  // SINGLE ACCORDION STATE: Exactly one group open at a time
  const [openGroupId, setOpenGroupId] = useState<string | null>(() => findGroupIdForView(currentView));

  // Sync open group automatically whenever currentView changes
  useEffect(() => {
    const matchedGroupId = findGroupIdForView(currentView);
    if (matchedGroupId && matchedGroupId !== 'ana_panel_group') {
      setOpenGroupId(matchedGroupId);
    }
  }, [currentView]);

  const toggleGroup = (groupId: string) => {
    // If clicking the currently open group, collapse it. Otherwise, close previous and open new.
    setOpenGroupId((prev) => (prev === groupId ? null : groupId));
  };

  // DYNAMIC ACL & ZERO-TRUST FILTERING:
  // Shows only menu groups and sub-items for which the user holds 'read' permission.
  const filterGroupsByRole = (): MenuGroup[] => {
    if (isAdmin) {
      return menuGroups;
    }

    if (isBayi) {
      // B2B: Sadece Satış & B2B (Bayi Siparişleri)
      return menuGroups
        .filter((g) => g.id === 'sales_b2b')
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => (it.id === 'b2b' || it.id === 'orders') && hasPermission(it.id, 'read'))
        }))
        .filter((g) => g.items.length > 0);
    }

    // Dynamic filtering for all users based on 'read' permission
    return menuGroups
      .filter((g) => {
        if (g.isDirectLink) {
          return hasPermission(g.directViewId || 'ana_panel', 'read');
        }
        return true;
      })
      .map((g) => {
        if (g.isDirectLink) return g;
        const allowedItems = g.items.filter((it) => hasPermission(it.id, 'read'));
        return {
          ...g,
          items: allowedItems
        };
      })
      .filter((g) => g.isDirectLink || g.items.length > 0);
  };

  const visibleGroups = filterGroupsByRole();

  // Vibrant Corporate Module Color Palettes
  const groupColorMap: Record<
    string,
    { badgeBg: string; textColor: string; border: string; accentBorder: string }
  > = {
    ana_panel_group: {
      badgeBg: 'bg-primary-soft',
      textColor: 'text-primary',
      border: 'border-primary-border',
      accentBorder: 'border-l-primary'
    },
    sales_b2b: {
      badgeBg: 'bg-mod-satis-soft',
      textColor: 'text-mod-satis',
      border: 'border-mod-satis-border',
      accentBorder: 'border-l-blue-600'
    },
    procurement: {
      badgeBg: 'bg-purple-500/10',
      textColor: 'text-purple-600',
      border: 'border-purple-500/20',
      accentBorder: 'border-l-purple-600'
    },
    inventory_warehouse: {
      badgeBg: 'bg-mod-stok-soft',
      textColor: 'text-mod-stok',
      border: 'border-mod-stok-border',
      accentBorder: 'border-l-emerald-600'
    },
    manufacturing: {
      badgeBg: 'bg-mod-uretim-soft',
      textColor: 'text-mod-uretim',
      border: 'border-mod-uretim-border',
      accentBorder: 'border-l-amber-600'
    },
    finance: {
      badgeBg: 'bg-mod-finans-soft',
      textColor: 'text-mod-finans',
      border: 'border-mod-finans-border',
      accentBorder: 'border-l-violet-600'
    },
    human_resources: {
      badgeBg: 'bg-rose-500/10',
      textColor: 'text-rose-600',
      border: 'border-rose-500/20',
      accentBorder: 'border-l-rose-600'
    },
    settings_group: {
      badgeBg: 'bg-slate-500/10',
      textColor: 'text-slate-600',
      border: 'border-slate-500/20',
      accentBorder: 'border-l-slate-600'
    }
  };

  const isSubItemActive = (subId: string): boolean => {
    if (currentView === subId) return true;
    if (subId === 'fin_invoices' && currentView === 'fin_invoices') return true;
    if (subId === 'fin_payments' && currentView === 'fin_payments') return true;
    if (subId === 'fin_accounts' && (currentView === 'fin_accounts' || currentView === 'customers_finance')) return true;
    if (subId === 'dashboard' && currentView === 'dashboard') return true;
    if (subId === 'settings_users' && (currentView === 'settings_users' || currentView === 'user_management')) return true;
    if (subId === 'settings_permissions' && currentView === 'settings_permissions') return true;
    if (subId === 'settings_system' && currentView === 'settings_system') return true;
    if (subId === 'hr_interviews' && currentView === 'hr_interviews') return true;
    if (subId === 'hr_leave' && currentView === 'hr_leave') return true;
    if (subId === 'hr_attendance' && currentView === 'hr_attendance') return true;
    return false;
  };

  const isGroupActive = (group: MenuGroup): boolean => {
    if (group.isDirectLink) {
      return currentView === 'ana_panel' || currentView === 'main_dashboard';
    }
    return openGroupId === group.id || group.items.some((it) => isSubItemActive(it.id));
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      {/* COMPACT SIDEBAR: Fits cleanly on screen without vertical scrollbars */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-10 w-64 bg-surface border-r border-border flex flex-col justify-between shrink-0 h-screen select-none transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Section: Brand + Menu Navigation */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Brand Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-surface shrink-0">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo-mark.png"
                alt="Günay Kimya Logo"
                className="w-8 h-8 object-contain shrink-0"
              />
              <div className="min-w-0">
                <span className="font-extrabold text-text text-sm tracking-tight leading-none block truncate">
                  GÜNAY KİMYA
                </span>
                <span className="text-[9px] text-text-muted font-bold tracking-wider uppercase leading-none block mt-1 truncate">
                  {panelSubtitle}
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg transition"
              aria-label="Menüyü Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* EXACT 8-HEADING ACCORDION NAVIGATION */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-none">
            {visibleGroups.map((group) => {
              const GroupIcon = group.icon;
              const isOpen = openGroupId === group.id;
              const isActive = isGroupActive(group);
              const colorConfig = groupColorMap[group.id] || groupColorMap.ana_panel_group;

              // 1. Ana Panel (Direct Click - No Accordion Submenu)
              if (group.isDirectLink) {
                const isAnaPanelActive = currentView === 'ana_panel' || currentView === 'main_dashboard';
                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      setOpenGroupId(null);
                      onNavigate('ana_panel');
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left ${
                      isAnaPanelActive
                        ? `${colorConfig.badgeBg} ${colorConfig.textColor} shadow-sm border border-primary/20`
                        : 'text-text hover:bg-bg border border-transparent'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-md ${colorConfig.badgeBg} ${colorConfig.textColor} flex items-center justify-center shrink-0 border ${colorConfig.border}`}
                    >
                      <GroupIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate tracking-wide">{group.title}</span>
                  </button>
                );
              }

              // 2 - 8. Process Accordion Groups
              return (
                <div
                  key={group.id}
                  className={`rounded-lg border transition-colors overflow-hidden ${
                    isOpen || isActive ? 'border-border/90 bg-surface' : 'border-transparent'
                  }`}
                >
                  {/* Group Header Button */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold transition-all ${
                      isOpen
                        ? `${colorConfig.badgeBg} ${colorConfig.textColor}`
                        : isActive
                        ? 'bg-bg text-text'
                        : 'text-text hover:bg-bg'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-md ${colorConfig.badgeBg} ${colorConfig.textColor} flex items-center justify-center shrink-0 border ${colorConfig.border}`}
                      >
                        <GroupIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate tracking-wide">{group.title}</span>
                    </div>

                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                        isOpen ? `transform rotate-180 ${colorConfig.textColor}` : 'text-text-muted'
                      }`}
                    />
                  </button>

                  {/* Sub-Items (Indented, Compact Font, Left Colored Accent Bar) */}
                  {isOpen && (
                    <div className="py-1 px-1 bg-surface space-y-0.5 border-t border-border/50">
                      {group.items.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = isSubItemActive(subItem.id);

                        return (
                          <button
                            key={subItem.id}
                            onClick={() => {
                              onNavigate(subItem.id);
                              onCloseMobile?.();
                            }}
                            className={`w-full flex items-center justify-between pl-6 pr-2 py-1 text-[11px] rounded-r-md transition-all text-left border-l-2 ${
                              isSubActive
                                ? `${colorConfig.accentBorder} ${colorConfig.badgeBg} ${colorConfig.textColor} font-bold`
                                : 'border-l-transparent text-text-muted hover:text-text hover:bg-bg font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <SubIcon
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isSubActive ? colorConfig.textColor : 'text-text-muted'
                                }`}
                              />
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

        {/* Footer: User Profile & Zero-Trust Logout */}
        <div className="p-2.5 border-t border-border bg-surface shrink-0">
          <div className="bg-bg rounded-lg p-2 mb-2 border border-border">
            <div className="flex items-center gap-2 text-xs font-semibold text-text truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate text-[11px]">{user?.full_name || 'Kullanıcı'}</span>
            </div>
            <div className="text-[10px] text-text-muted truncate mt-0.5 font-mono">
              {user?.email}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {user?.roles?.slice(0, 2).map((r) => (
                <span
                  key={r}
                  className="text-[9px] bg-surface text-text px-1 py-0.5 rounded font-semibold border border-border font-mono uppercase"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-danger hover:bg-danger-soft border border-danger-border transition-colors active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Güvenli Çıkış</span>
          </button>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
