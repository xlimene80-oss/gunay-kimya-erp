import React, { useState, useEffect } from 'react';
import {
  Activity,
  FileCheck2,
  PackageCheck,
  ScanBarcode,
  WifiOff
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './views/Login';
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
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';

const MainShell: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentView, setCurrentView] = useState<string>('factory_dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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
    } else if (viewParam) {
      setCurrentView(viewParam);
    }
  }, []);

  // Role-based initial panel routing on login
  useEffect(() => {
    const pathname = window.location.pathname;
    if (pathname === '/terminal') {
      setCurrentView('scanner');
      return;
    }

    if (user && user.roles && user.roles.length > 0) {
      const roleStr = user.roles.map((r) => r.toLowerCase()).join(' ');

      if (roleStr.includes('admin') || roleStr.includes('yönetici') || roleStr.includes('yonetici')) {
        setCurrentView('factory_dashboard');
      } else if (roleStr.includes('kalite')) {
        setCurrentView('quality_pending');
      } else if (roleStr.includes('bayi') || roleStr.includes('b2b')) {
        setCurrentView('orders');
      } else if (roleStr.includes('depo')) {
        setCurrentView('scanner');
      } else if (roleStr.includes('muhasebe')) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('factory_dashboard');
      }
    }
  }, [user]);

  // Security guard: If a B2B user tries to access 'dashboard', bounce to 'orders'
  useEffect(() => {
    if (user && user.roles) {
      const roleStr = user.roles.map((r) => r.toLowerCase()).join(' ');
      const isBayi = roleStr.includes('bayi') || roleStr.includes('b2b');
      if (isBayi && currentView === 'dashboard') {
        setCurrentView('orders');
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
            {/* 1. ÜRETİM YÖNETİMİ */}
            {currentView === 'factory_dashboard' && <FactoryDashboard onNavigate={setCurrentView} />}
            {currentView === 'bom_management' && <BomManagement />}
            {currentView === 'packaging_station' && <PackagingStation />}

            {/* 2. STOK & LOJİSTİK */}
            {currentView === 'inventory_stock' && <StockManagement />}
            {currentView === 'products_raw_materials' && <ProductsManagement />}
            {currentView === 'products_sds_warning' && <ProductsManagement initialFilter="SDS_WARNING" />}
            {currentView === 'warehouse_layout' && <WarehouseLayout />}
            {currentView === 'pallet_box_center' && <BarcodeCenter />}
            {currentView === 'scanner' && <TerminalScanner onNavigate={setCurrentView} />}

            {/* 3. SATIN ALMA */}
            {currentView === 'goods_receipt' && <GoodsReceiptManagement />}
            {currentView === 'suppliers' && <SuppliersManagement />}

            {/* 4. SATIŞ & SEVKİYAT */}
            {currentView === 'orders' && <Orders />}
            {currentView === 'customers' && <CustomersManagement />}
            {currentView === 'tracking' && <SiparisVeSevkiyatTakip />}
            {currentView === 'logistics' && <Logistics />}

            {/* 5. FİNANSAL YÖNETİM */}
            {currentView === 'dashboard' && <Dashboard />}

            {/* 6. KALİTE YÖNETİMİ */}
            {currentView === 'quality_pending' && <QualityPending onNavigate={setCurrentView} />}
            {currentView === 'quality_templates' && <QualityTemplates />}
            {currentView === 'quality_coas' && <QualityCoaList />}

            {/* İZLENEBİLİRLİK (ŞECERE) */}
            {currentView === 'traceability' && <Traceability />}
          </main>
        </div>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (< 768px, >= 44px Touch Targets) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 py-1 shadow-lg no-print">
        <button
          onClick={() => {
            setCurrentView('factory_dashboard');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] flex-1 py-1 text-xs font-bold transition rounded-xl ${
            currentView === 'factory_dashboard' ? 'text-primary bg-primary-soft/50' : 'text-text-muted hover:text-text'
          }`}
        >
          <Activity className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight font-bold">Ana Sayfa</span>
        </button>

        <button
          onClick={() => {
            setCurrentView('goods_receipt');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] flex-1 py-1 text-xs font-bold transition rounded-xl ${
            currentView === 'goods_receipt' ? 'text-primary bg-primary-soft/50' : 'text-text-muted hover:text-text'
          }`}
        >
          <FileCheck2 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight font-bold">Mal Kabul</span>
        </button>

        <button
          onClick={() => {
            setCurrentView('packaging_station');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] flex-1 py-1 text-xs font-bold transition rounded-xl ${
            currentView === 'packaging_station' ? 'text-primary bg-primary-soft/50' : 'text-text-muted hover:text-text'
          }`}
        >
          <PackageCheck className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight font-bold">Paketleme</span>
        </button>

        <button
          onClick={() => {
            setCurrentView('scanner');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] flex-1 py-1 text-xs font-bold transition rounded-xl ${
            currentView === 'scanner' ? 'text-primary bg-primary-soft/50' : 'text-text-muted hover:text-text'
          }`}
        >
          <ScanBarcode className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight font-bold">Terminal</span>
        </button>
      </nav>
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
