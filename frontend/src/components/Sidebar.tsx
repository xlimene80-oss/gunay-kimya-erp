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
  FileSpreadsheet,
  PackageCheck,
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

const viewPermissionMap: Record<string, string> = {
  ana_panel: 'ana_panel',
  main_dashboard: 'ana_panel',
  // CRM ve Sipariş
  customers: 'crm',
  quotes: 'crm',
  orders: 'orders',
  b2b: 'b2b_orders',
  manual_orders_planning: 'planning',
  // Satın Alma
  suppliers: 'purchasing',
  purchasing_requests: 'purchasing',
  goods_receipt: 'purchasing',
  // Envanter
  products_raw_materials: 'inventory',
  products_sds_warning: 'inventory',
  inventory_stock: 'inventory',
  warehouse_layout: 'inventory',
  scanner: 'inventory',
  // Planlama ve Üretim
  factory_dashboard: 'manufacturing',
  mrp: 'manufacturing',
  bom_management: 'manufacturing',
  pallet_box_center: 'manufacturing',
  packaging_station: 'manufacturing',
  // Kalite
  quality_pending: 'quality',
  quality_templates: 'quality',
  quality_coas: 'quality',
  traceability: 'quality',
  // Lojistik
  logistics: 'planning',
  tracking: 'b2b_tracking',
  // Finans
  fin_invoices: 'accounting',
  fin_payments: 'accounting',
  fin_accounts: 'accounting',
  dashboard: 'accounting',
  fin_reports: 'accounting',
  // İK
  hr_interviews: 'hr',
  hr_personnel: 'hr',
  hr_leave: 'hr',
  hr_attendance: 'hr',
  hr_movements: 'hr',
  reports_employee: 'hr',
  // Ayarlar
  settings_users: 'users',
  settings_permissions: 'users',
  settings_system: 'users',
  user_management: 'users'
};

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
  if (isAdmin) panelSubtitle = 'Endüstriyel Kimya ERP';
  else if (isOperator) panelSubtitle = 'Üretim Terminali';
  else if (isMuhasebe) panelSubtitle = 'Muhasebe & Finans';

  // EXACT 10 GROUPS ACCORDING TO CHEMICAL MANUFACTURING ERP SPECIFICATION
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
    // 2. CRM ve Sipariş
    {
      id: 'crm_orders',
      title: 'CRM ve Sipariş',
      icon: ShoppingCart,
      roles: ['admin', 'muhasebe', 'staff', 'bayi', 'customer'],
      items: [
        { id: 'customers', label: 'Müşteriler', icon: Users, roles: ['admin', 'staff', 'muhasebe'] },
        { id: 'quotes', label: 'Teklifler', icon: FileSpreadsheet, roles: ['admin', 'staff', 'muhasebe'] },
        { id: 'orders', label: 'Satış Siparişleri', icon: ShoppingBag, roles: ['admin', 'staff', 'muhasebe', 'bayi'] },
        { id: 'b2b', label: 'B2B Bayi Siparişleri', icon: Building2, roles: ['admin', 'bayi', 'customer', 'staff', 'muhasebe'] },
        { id: 'manual_orders_planning', label: 'Manuel Sipariş / Planlama', icon: Calendar, roles: ['admin', 'staff', 'muhasebe'] }
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
        { id: 'purchasing_requests', label: 'Satın Alma Talepleri / Siparişleri', icon: Briefcase, roles: ['admin', 'staff', 'depo', 'muhasebe'] },
        { id: 'goods_receipt', label: 'Mal Kabul', icon: FileCheck2, roles: ['admin', 'depo', 'staff', 'muhasebe'] }
      ]
    },
    // 4. Envanter
    {
      id: 'inventory',
      title: 'Envanter',
      icon: Boxes,
      roles: ['admin', 'depo', 'staff'],
      items: [
        { id: 'products_raw_materials', label: 'Ürünler (Mamul)', icon: Layers, roles: ['admin', 'depo', 'staff'] },
        { id: 'products_sds_warning', label: 'Hammaddeler (SDS/GHS)', icon: FlaskConical, roles: ['admin', 'depo', 'staff'] },
        { id: 'inventory_stock', label: 'Stok Durumu (Lot/FEFO)', icon: Package, roles: ['admin', 'depo', 'staff'] },
        { id: 'warehouse_layout', label: 'Depo Hareketleri', icon: Warehouse, roles: ['admin', 'depo'] },
        { id: 'scanner', label: 'Sayım / El Terminali', icon: ScanBarcode, roles: ['admin', 'depo'] }
      ]
    },
    // 5. Planlama ve Üretim
    {
      id: 'manufacturing_planning',
      title: 'Planlama ve Üretim',
      icon: Factory,
      roles: ['admin', 'uretim', 'operator', 'fabrika_muduru', 'depo'],
      items: [
        { id: 'factory_dashboard', label: 'Üretim Emirleri', icon: Activity, roles: ['admin', 'uretim', 'operator', 'fabrika_muduru'] },
        { id: 'mrp', label: 'Malzeme Planlama (MRP)', icon: Layers, roles: ['admin', 'uretim', 'fabrika_muduru'] },
        { id: 'bom_management', label: 'Reçeteler (BOM)', icon: FlaskConical, roles: ['admin', 'fabrika_muduru', 'uretim'] },
        { id: 'pallet_box_center', label: 'Koli / Palet Barkod', icon: Barcode, roles: ['admin', 'uretim', 'operator', 'depo', 'fabrika_muduru'] },
        { id: 'packaging_station', label: 'İş İstasyonu / Parti', icon: PackageCheck, roles: ['admin', 'uretim', 'operator', 'fabrika_muduru'] }
      ]
    },
    // 6. Kalite (Üretimden AYRI grup)
    {
      id: 'quality_management',
      title: 'Kalite',
      icon: ShieldCheck,
      roles: ['admin', 'uretim', 'fabrika_muduru', 'staff', 'kalite'],
      items: [
        { id: 'quality_pending', label: 'Bekleyen Kalite', icon: Activity, roles: ['admin', 'uretim', 'fabrika_muduru', 'staff', 'kalite'] },
        { id: 'quality_templates', label: 'Kalite Şablonları', icon: FileCheck2, roles: ['admin', 'fabrika_muduru', 'kalite'] },
        { id: 'quality_coas', label: 'CoA Listesi', icon: FileText, roles: ['admin', 'uretim', 'fabrika_muduru', 'staff', 'kalite'] },
        { id: 'traceability', label: 'İzlenebilirlik', icon: ShieldAlert, roles: ['admin', 'uretim', 'fabrika_muduru', 'staff', 'kalite'] }
      ]
    },
    // 7. Lojistik
    {
      id: 'logistics_group',
      title: 'Lojistik',
      icon: Truck,
      roles: ['admin', 'staff', 'muhasebe', 'depo', 'bayi', 'customer'],
      items: [
        { id: 'logistics', label: 'Sevkiyat / İrsaliye', icon: Truck, roles: ['admin', 'staff', 'muhasebe', 'depo'] },
        { id: 'tracking', label: 'Sipariş & Sevkiyat Takip', icon: Activity, roles: ['admin', 'staff', 'muhasebe', 'depo', 'bayi', 'customer'] }
      ]
    },
    // 8. Finans
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
    // 9. İnsan Kaynakları (Admin ve İK Departmanı)
    {
      id: 'human_resources',
      title: 'İnsan Kaynakları',
      icon: Users,
      roles: ['admin', 'ik', 'staff'],
      items: [
        { id: 'hr_interviews', label: 'İş Başvuruları', icon: Users, roles: ['admin', 'ik', 'staff'] },
        { id: 'hr_personnel', label: 'Personel', icon: UserCheck, roles: ['admin', 'ik', 'staff'] },
        { id: 'hr_leave', label: 'İzinler', icon: Calendar, roles: ['admin', 'ik', 'staff'] },
        { id: 'hr_attendance', label: 'Puantaj', icon: Calendar, roles: ['admin', 'ik', 'staff'] },
        { id: 'hr_movements', label: 'Personel Hareketleri', icon: Layers, roles: ['admin', 'ik', 'staff'] },
        { id: 'reports_employee', label: 'Faaliyet Raporları', icon: FileText, roles: ['admin', 'ik', 'staff'] }
      ]
    },
    // 10. Ayarlar (Sadece Admin / Firma Sahibi)
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
    if (['customers', 'quotes', 'orders', 'b2b', 'manual_orders_planning'].includes(viewId)) return 'crm_orders';
    if (['suppliers', 'purchasing_requests', 'goods_receipt'].includes(viewId)) return 'procurement';
    if (['products_raw_materials', 'products_sds_warning', 'inventory_stock', 'warehouse_layout', 'scanner'].includes(viewId)) return 'inventory';
    if (['factory_dashboard', 'mrp', 'bom_management', 'pallet_box_center', 'packaging_station'].includes(viewId)) return 'manufacturing_planning';
    if (['quality_pending', 'quality_templates', 'quality_coas', 'traceability'].includes(viewId)) return 'quality_management';
    if (['logistics', 'tracking'].includes(viewId)) return 'logistics_group';
    if (['fin_invoices', 'fin_payments', 'fin_accounts', 'dashboard', 'fin_reports', 'customers_finance'].includes(viewId)) return 'finance';
    if (['hr_leave', 'hr_attendance', 'hr_interviews', 'hr_personnel', 'hr_movements', 'reports_employee'].includes(viewId)) return 'human_resources';
    if (['settings_users', 'settings_permissions', 'settings_system', 'user_management'].includes(viewId)) return 'settings_group';

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
  // Role rules:
  // - Admin: Sees all modules and items
  // - Bayi (B2B): Only CRM ve Sipariş (B2B + Siparişler) + Lojistik (tracking)
  // - Operator: Only Üretim (Barkod, Emirler, İş İstasyonu) + Envanter (Terminal)
  // - Muhasebe: Finans + CRM (Sipariş/Müşteri) + Satın Alma + Lojistik
  // - İK & Ayarlar: Admin only
  const filterGroupsByRole = (): MenuGroup[] => {
    if (isAdmin) {
      return menuGroups;
    }

    if (isBayi) {
      // B2B Müşteri: Ana Panel (sade), Siparişlerim, Yeni Sipariş, Cari Hesabım, Sevkiyat Takibi
      return [
        {
          id: 'bayi_portal',
          title: 'B2B Bayi Portalı',
          icon: ShoppingCart,
          roles: ['customer', 'bayi'],
          items: [
            { id: 'b2b', label: 'Ana Panel (Cari Özet)', icon: LayoutDashboard },
            { id: 'orders', label: 'Siparişlerim', icon: ShoppingBag },
            { id: 'tracking', label: 'Sevkiyat Takibi', icon: Truck }
          ]
        }
      ];
    }

    if (isOperator) {
      // Operatör: üretim barkod/terminal/üretim emri/iş istasyonu
      return menuGroups
        .filter((g) => g.id === 'manufacturing_planning' || g.id === 'inventory')
        .map((g) => ({
          ...g,
          items: g.items.filter((it) =>
            ['pallet_box_center', 'factory_dashboard', 'packaging_station', 'scanner'].includes(it.id)
          )
        }))
        .filter((g) => g.items.length > 0);
    }

    if (isMuhasebe) {
      // Muhasebe: finans + sipariş/mal kabul okuma + sevkiyat
      return menuGroups
        .filter((g) =>
          ['ana_panel_group', 'crm_orders', 'procurement', 'finance', 'logistics_group'].includes(g.id)
        )
        .map((g) => {
          if (g.isDirectLink) return g;
          return {
            ...g,
            items: g.items.filter((it) => {
              if (g.id === 'finance') return true;
              if (it.id === 'orders' || it.id === 'customers') return true;
              if (it.id === 'goods_receipt' || it.id === 'suppliers' || it.id === 'purchasing_requests') return true;
              if (it.id === 'logistics') return true;
              return false;
            })
          };
        })
        .filter((g) => g.isDirectLink || g.items.length > 0);
    }

    // Dynamic filtering for all other users based on 'read' permission
    return menuGroups
      .filter((g) => {
        if (g.id === 'settings_group') {
          return isAdmin;
        }
        if (g.id === 'human_resources') {
          const isIK = user?.department_code === 'IK' || userRolesStr.includes('ik') || hasPermission('hr', 'read');
          return isAdmin || isIK;
        }
        if (g.isDirectLink) {
          return hasPermission(g.directViewId || 'ana_panel', 'read');
        }
        return true;
      })
      .map((g) => {
        if (g.isDirectLink) return g;
        const allowedItems = g.items.filter((it) => {
          const permKey = viewPermissionMap[it.id] || it.id;
          return hasPermission(it.id, 'read') || hasPermission(permKey, 'read');
        });
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
    crm_orders: {
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
    inventory: {
      badgeBg: 'bg-mod-stok-soft',
      textColor: 'text-mod-stok',
      border: 'border-mod-stok-border',
      accentBorder: 'border-l-emerald-600'
    },
    manufacturing_planning: {
      badgeBg: 'bg-mod-uretim-soft',
      textColor: 'text-mod-uretim',
      border: 'border-mod-uretim-border',
      accentBorder: 'border-l-amber-600'
    },
    quality_management: {
      badgeBg: 'bg-teal-500/10',
      textColor: 'text-teal-600',
      border: 'border-teal-500/20',
      accentBorder: 'border-l-teal-600'
    },
    logistics_group: {
      badgeBg: 'bg-sky-500/10',
      textColor: 'text-sky-600',
      border: 'border-sky-500/20',
      accentBorder: 'border-l-sky-600'
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
    if (subId === 'orders' && currentView === 'orders') return true;
    if (subId === 'b2b' && currentView === 'b2b') return true;
    if (subId === 'quotes' && currentView === 'quotes') return true;
    if (subId === 'factory_dashboard' && currentView === 'factory_dashboard') return true;
    if (subId === 'mrp' && currentView === 'mrp') return true;
    if (subId === 'fin_invoices' && currentView === 'fin_invoices') return true;
    if (subId === 'fin_payments' && currentView === 'fin_payments') return true;
    if (subId === 'fin_accounts' && (currentView === 'fin_accounts' || currentView === 'customers_finance')) return true;
    if (subId === 'dashboard' && (currentView === 'dashboard' || currentView === 'fin_reports')) return true;
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

          {/* 10-HEADING ACCORDION NAVIGATION */}
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

              // 2 - 10. Process Accordion Groups
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
