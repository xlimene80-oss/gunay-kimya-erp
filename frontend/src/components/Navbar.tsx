import React from 'react';
import { Bell, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from './Breadcrumb';

interface NavbarProps {
  currentView?: string;
  onNavigate?: (view: string) => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView = 'factory_dashboard',
  onNavigate,
  onToggleMobileMenu
}) => {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-surface border-b border-border px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Dynamic Process Breadcrumb & Mobile Hamburger */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-text hover:bg-bg border border-border flex items-center justify-center transition shrink-0"
          aria-label="Menüyü Aç"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Breadcrumb currentView={currentView} onNavigate={onNavigate} />
      </div>

      <div className="flex items-center gap-4">
        {/* Live Network Pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-bg border border-border text-[11px] text-text-muted">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="font-mono text-text-muted">Fabrika Ağı Canlı</span>
        </div>

        {/* Notifications Icon */}
        <button
          onClick={() => alert('Bildirim: Üretim emirleri ve parti stokları günceldir.')}
          className="relative p-2 rounded-xl text-text-muted hover:text-text hover:bg-bg transition-colors border border-transparent hover:border-border"
          title="Bildirimler"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
        </button>

        {/* User Pill */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs uppercase">
            {user?.full_name ? user.full_name[0] : 'U'}
          </div>
          <div className="hidden sm:block text-left text-xs">
            <span className="font-semibold text-text block leading-none">{user?.full_name}</span>
            <span className="text-[10px] text-text-muted block leading-none mt-1 font-mono">Aktif Oturum</span>
          </div>
        </div>
      </div>
    </header>
  );
};
