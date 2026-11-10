import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Activity,
  FileCheck2,
  FileText,
  WifiOff,
  ShieldAlert,
  LayoutDashboard
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './views/Login';
import { MainDashboard } from './views/MainDashboard';
import { FactoryDashboard } from './views/FactoryDashboard';
import { Dashboard } from './views/Dashboard';
import { Orders } from './views/Orders';
import { Logistics } from './views/Logistics';
import { Traceability } from './views/Traceability';
import { TerminalScanner } from './views/TerminalScanner';
import { SiparisVeSevkiyatTakip } from './views/SiparisVeSevkiyatTakip';
import { BomManagement } from './views/BomManagement';
import { StockManagement } from './views/StockManagement';
import { BarcodeCenter } from './views/BarcodeCenter';
import { ProductsManagement } from './views/ProductsManagement';
import { WarehouseLayout } from './views/WarehouseLayout';
import { CustomersManagement } from './views/CustomersManagement';
import { SuppliersManagement } from './views/SuppliersManagement';
import { GoodsReceiptManagement } from './views/GoodsReceiptManagement';
import { PackagingStation } from './views/PackagingStation';
import { QualityPending } from './views/QualityPending';
import { QualityTemplates } from './views/QualityTemplates';
import { QualityCoaList } from './views/QualityCoaList';
import { B2BDashboard } from './views/B2BDashboard';
import { EmployeeReports } from './views/EmployeeReports';
import { HRInterviews } from './views/HRInterviews';
import { HRPersonnel } from './views/HRPersonnel';
import { HRLeave } from './views/HRLeave';
import { HRAttendance } from './views/HRAttendance';
import { HRMovements } from './views/HRMovements';
import { PurchasingManagement } from './views/PurchasingManagement';
import { ManualOrdersPlanning } from './views/ManualOrdersPlanning';
import { QuotesManagement } from './views/QuotesManagement';
import { UserManagement } from './views/UserManagement';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { AssistantChat } from './components/AssistantChat';

const MainShell: React.FC = () => {
  const { isAuthenticated, isLoading, user, hasPermission } = useAuth();
  // 1. Ana Panel is the default landing view on initial open/login
  const [currentView, setCurrentView] = useState<string>('ana_panel');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [productionAlertCount, setProductionAlertCount] = useState(0);
  const [productionToast, setProductionToast] = useState<{ id: number; message: string } | null>(null);
  const toastShownIds = useRef<Set<number>>(new Set());

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

  const isBayi =
    user?.role === 'customer' ||
    userRolesStr.includes('bayi') ||
    userRolesStr.includes('b2b') ||
    userRolesStr.includes('customer');

  const canMonitorProduction = !isBayi && (
    isAdmin || isOperator || userRolesStr.includes('fabrika_muduru') ||
    userRolesStr.includes('uretim') || (user?.department_code || '').toUpperCase() === 'URETIM'
  );

  useEffect(() => {
    if (!isAuthenticated || !canMonitorProduction) {
      setProductionAlertCount(0);
      return;
    }
    let active = true;
    const pollProductionAlerts = async () => {
      try {
        const response = await axios.get('/api/notifications/production', { params: { unread_only: true } });
        if (!active) return;
        const alerts: Array<{ id: number; message: string }> = response.data || [];
        setProductionAlertCount(alerts.length);
        if (['factory_dashboard', 'mrp'].includes(currentView)) {
          const unseen = alerts.find((alert) => !toastShownIds.current.has(alert.id));
          if (unseen) {
            toastShownIds.current.add(unseen.id);
            setProductionToast(unseen);
          }
        }
      } catch {
        // The backend also enforces production role access; non-production screens stay quiet.
      }
    };
    void pollProductionAlerts();
    const intervalId = window.setInterval(pollProductionAlerts, 12000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, canMonitorProduction, currentView, user?.id]);

  // Permission Map across all 10 ERP groups
  const viewPermissionMap: Record<string, string> = {
    ana_panel: '',
    main_dashboard: '',
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
    reports_employee: 'crm',
    // Ayarlar
    settings_users: 'users',
    settings_permissions: 'users',
    settings_system: 'users',
    user_management: 'users'
  };

  const isViewAllowed = () => {
    if (isAdmin) return true;

    // Strict Role Filtering for B2B Customer
    if (isBayi) {
      return (
        (currentView === 'b2b' || currentView === 'orders' || currentView === 'tracking') &&
        (hasPermission(currentView, 'read') || hasPermission('b2b', 'read') || true)
      );
    }

    if (currentView === 'ana_panel' || currentView === 'main_dashboard') {
      return true;
    }

    const permKey = viewPermissionMap[currentView] || currentView;
    return hasPermission(currentView, 'read') || hasPermission(permKey, 'read');
  };

  // Monitor network status for PWA offline resilience
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Direct URL route & PWA shortcut handling (/terminal or ?view=scanner)
  useEffect(() => {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const viewParam = searchParams.get('view');
    if (pathname === '/terminal' || viewParam === 'scanner' || viewParam === 'terminal') {
      setCurrentView('scanner');
    } else if (pathname === '/b2b' || viewParam === 'b2b') {
      setCurrentView('b2b');
    } else if (pathname === '/reports/employee' || viewParam === 'reports_employee') {
      setCurrentView('reports_employee');
    } else if (pathname === '/hr/interviews' || viewParam === 'hr_interviews') {
      setCurrentView('hr_interviews');
    } else if (pathname === '/hr/personnel' || viewParam === 'hr_personnel') {
      setCurrentView('hr_personnel');
    } else if (pathname === '/hr/leave' || viewParam === 'hr_leave') {
      setCurrentView('hr_leave');
    } else if (pathname === '/hr/attendance' || viewParam === 'hr_attendance') {
      setCurrentView('hr_attendance');
    } else if (pathname === '/hr/movements' || viewParam === 'hr_movements') {
      setCurrentView('hr_movements');
    } else if (pathname === '/purchasing/requests' || viewParam === 'purchasing_requests') {
      setCurrentView('purchasing_requests');
    } else if (pathname === '/orders/planning' || viewParam === 'manual_orders_planning') {
      setCurrentView('manual_orders_planning');
    } else if (pathname === '/admin/users' || viewParam === 'user_management') {
      setCurrentView('settings_users');
    } else if (pathname === '/finance' || viewParam === 'dashboard') {
      setCurrentView('dashboard');
    } else if (viewParam) {
      setCurrentView(viewParam);
    }
  }, []);

  // Role-based initial panel routing on login
  useEffect(() => {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const viewParam = searchParams.get('view');

    // Honor explicit URL deep-links
    if (pathname !== '/' || viewParam) return;

    if (user) {
      if (user.role === 'customer' || isBayi) {
        setCurrentView('b2b');
      } else if (isOperator) {
        setCurrentView('pallet_box_center');
      } else {
        // Admin, Muhasebe, and Staff: Default to 'Ana Panel' (1st heading)
        setCurrentView('ana_panel');
      }
    }
  }, [user]);

  // Security guard: Prevent unauthorized cross-role view URL hijacking
  useEffect(() => {
    if (user) {
      if (isBayi && currentView !== 'b2b' && currentView !== 'orders' && currentView !== 'tracking') {
        setCurrentView('b2b');
      } else if (isOperator && !['pallet_box_center', 'factory_dashboard', 'scanner', 'packaging_station', 'reports_employee'].includes(currentView)) {
        setCurrentView('pallet_box_center');
      }
    }
  }, [currentView, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans antialiased text-text">
      {/* Offline Status Top Banner */}
      {!isOnline && (
        <div className="bg-danger text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Bağlantı Yok (Çevrimdışı Mod) — Fabrika sunucusuna veya internete ulaşılamıyor. Çevrimdışı önbellek devrede.</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-3 underline uppercase text-[10px] font-extrabold"
          >
            Yeniden Dene
          </button>
        </div>
      )}

      <div className="flex-1 flex min-w-0">
        <div className="no-print">
          <Sidebar
            currentView={currentView}
            onNavigate={setCurrentView}
            productionAlertCount={productionAlertCount}
            isOpenMobile={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="no-print">
            <Navbar
              currentView={currentView}
              onNavigate={setCurrentView}
              onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
            />
          </div>

          <main className="p-4 md:p-8 max-w-7xl w-full mx-auto pb-28 md:pb-8 print:p-0 print:m-0 print:max-w-none">
            {!isViewAllowed() ? (
              <div className="p-8 text-center bg-surface rounded-2xl border border-border shadow-sm max-w-xl mx-auto my-12 animate-fade-in">
                <div className="p-3 bg-danger/10 text-danger rounded-xl inline-flex mb-3">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-bold text-text">Erişim Engellendi (Yetki Yetersiz)</h2>
                <p className="text-sm text-text-muted mt-2">
                  Bu modülü görüntülemek için gerekli olan <strong className="text-text font-mono">'{viewPermissionMap[currentView] || currentView}'</strong> yetkisine sahip değilsiniz. Lütfen fabrika yöneticinizle iletişime geçiniz.
                </p>
                <div className="mt-5">
                  <button
                    onClick={() => setCurrentView(isBayi ? 'b2b' : 'ana_panel')}
                    className="px-5 py-2.5 bg-[#302480] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#241a63] transition"
                  >
                    Ana Ekrana Dön
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 1. ANA PANEL (3 BÜYÜK YÖNETİCİ KARTI) */}
                {(currentView === 'ana_panel' || currentView === 'main_dashboard') && (
                  <MainDashboard onNavigate={setCurrentView} />
                )}

                {/* 2. CRM VE SİPARİŞ */}
                {currentView === 'customers' && <CustomersManagement />}
                {currentView === 'quotes' && <QuotesManagement />}
                {currentView === 'orders' && <Orders />}
                {currentView === 'b2b' && <B2BDashboard />}
                {currentView === 'manual_orders_planning' && <ManualOrdersPlanning />}

                {/* 3. SATIN ALMA */}
                {currentView === 'suppliers' && <SuppliersManagement />}
                {currentView === 'purchasing_requests' && <PurchasingManagement />}
                {currentView === 'goods_receipt' && <GoodsReceiptManagement />}

                {/* 4. ENVANTER */}
                {currentView === 'products_raw_materials' && <ProductsManagement />}
                {currentView === 'products_sds_warning' && <ProductsManagement initialFilter="SDS_WARNING" />}
                {currentView === 'inventory_stock' && <StockManagement />}
                {currentView === 'warehouse_layout' && <WarehouseLayout />}
                {currentView === 'scanner' && <TerminalScanner onNavigate={setCurrentView} />}

                {/* 5. PLANLAMA VE ÜRETİM */}
                {currentView === 'factory_dashboard' && <FactoryDashboard onNavigate={setCurrentView} />}
                {currentView === 'mrp' && (
                  <div className="space-y-4">
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-amber-600 shrink-0" />
                        <span><strong>Malzeme İhtiyaç Planlama (MRP):</strong> Hammadde ihtiyaçları ve lot rezervasyonları doğrudan canlı Üretim Emirleri üzerinden yönetilmektedir.</span>
                      </div>
                      <button
                        onClick={() => setCurrentView('factory_dashboard')}
                        className="underline font-bold text-amber-800 dark:text-amber-200 shrink-0 ml-3"
                      >
                        Üretim Emirleri
                      </button>
                    </div>
                    <FactoryDashboard onNavigate={setCurrentView} />
                  </div>
                )}
                {currentView === 'bom_management' && <BomManagement />}
                {currentView === 'pallet_box_center' && <BarcodeCenter />}
                {currentView === 'packaging_station' && <PackagingStation />}

                {/* 6. KALİTE (Üretimden AYRI grup) */}
                {currentView === 'quality_pending' && <QualityPending onNavigate={setCurrentView} />}
                {currentView === 'quality_templates' && <QualityTemplates />}
                {currentView === 'quality_coas' && <QualityCoaList />}
                {currentView === 'traceability' && <Traceability />}

                {/* 7. LOJİSTİK */}
                {currentView === 'logistics' && <Logistics />}
                {currentView === 'tracking' && <SiparisVeSevkiyatTakip />}

                {/* 8. FİNANS */}
                {(currentView === 'dashboard' ||
                  currentView === 'fin_invoices' ||
                  currentView === 'fin_payments' ||
                  currentView === 'fin_reports') && <Dashboard />}
                {currentView === 'fin_accounts' && <CustomersManagement />}

                {/* 9. İNSAN KAYNAKLARI */}
                {currentView === 'hr_interviews' && <HRInterviews />}
                {currentView === 'hr_personnel' && <HRPersonnel />}
                {currentView === 'hr_leave' && <HRLeave />}
                {currentView === 'hr_attendance' && <HRAttendance />}
                {currentView === 'hr_movements' && <HRMovements />}
                {currentView === 'reports_employee' && <EmployeeReports />}

                {/* 10. AYARLAR (Sadece Admin) */}
                {(currentView === 'settings_users' ||
                  currentView === 'settings_permissions' ||
                  currentView === 'settings_system' ||
                  currentView === 'user_management') && (
                  <UserManagement currentView={currentView} onNavigate={setCurrentView} />
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (< 768px, >= 44px Touch Targets) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 py-1 shadow-lg no-print">
        <button
          onClick={() => {
            setCurrentView(isBayi ? 'b2b' : 'ana_panel');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] flex-1 py-1 text-xs font-bold transition rounded-xl ${
            currentView === 'ana_panel' || currentView === 'main_dashboard'
              ? 'text-primary bg-primary-soft/50'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight font-bold">Ana Panel</span>
        </button>

        <button
          onClick={() => {
            setCurrentView(isBayi ? 'orders' : 'goods_receipt');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] flex-1 py-1 text-xs font-bold transition rounded-xl ${
            currentView === 'goods_receipt' || currentView === 'orders'
              ? 'text-primary bg-primary-soft/50'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <FileCheck2 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight font-bold">{isBayi ? 'Siparişler' : 'Mal Kabul'}</span>
        </button>

        <button
          onClick={() => {
            setCurrentView(isBayi ? 'b2b' : 'factory_dashboard');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] flex-1 py-1 text-xs font-bold transition rounded-xl ${
            currentView === 'factory_dashboard' || currentView === 'b2b'
              ? 'text-primary bg-primary-soft/50'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Activity className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight font-bold">{isBayi ? 'B2B Portal' : 'Üretim'}</span>
        </button>

        <button
          onClick={() => {
            setCurrentView(isBayi ? 'orders' : 'reports_employee');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] flex-1 py-1 text-xs font-bold transition rounded-xl ${
            currentView === 'reports_employee' || (isBayi && currentView === 'orders')
              ? 'text-primary bg-primary-soft/50'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight font-bold">{isBayi ? 'Siparişler' : 'Raporlarım'}</span>
        </button>
      </nav>
      {productionToast && (
        <button
          onClick={async () => {
            try { await axios.patch(`/api/notifications/${productionToast.id}/read`); } catch { /* next poll retries */ }
            setProductionAlertCount((count) => Math.max(0, count - 1));
            setProductionToast(null);
            setCurrentView('factory_dashboard');
          }}
          className="fixed right-4 top-4 z-[80] max-w-sm rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-950 shadow-xl"
        >
          {productionToast.message}
          <span className="mt-1 block text-xs font-medium text-amber-800">Üretim emirlerini açmak için tıklayın</span>
        </button>
      )}
      <AssistantChat />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainShell />
      <PWAUpdatePrompt />
    </AuthProvider>
  );
};

export default App;
