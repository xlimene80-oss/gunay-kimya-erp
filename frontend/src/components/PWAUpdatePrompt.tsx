import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';

export const PWAUpdatePrompt: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFunction, setUpdateFunction] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    // Register service worker with auto-update lifecycle
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onNeedReload() {
        setNeedRefresh(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          // Check for new version on initial launch
          registration.update().catch(() => {});

          // Periodically check for updates every 10 minutes
          const intervalId = setInterval(() => {
            registration.update().catch(() => {});
          }, 10 * 60 * 1000);

          // Check for update whenever user returns to the tab/app
          const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => {});
            }
          };
          document.addEventListener('visibilitychange', handleVisibilityChange);

          return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
          };
        }
      },
      onRegisterError(error) {
        console.error('PWA service worker registration error:', error);
      }
    });

    setUpdateFunction(() => async () => {
      try {
        await updateSW(true);
      } finally {
        window.location.reload();
      }
    });

    // Listen for direct service worker controllerchange event
    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
    };
  }, []);

  const handleRefresh = async () => {
    if (updateFunction) {
      await updateFunction();
    } else {
      window.location.reload();
    }
  };

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
    >
      <div className="bg-[#1E1654] text-white border-2 border-[#4CAC30] p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#4CAC30]/20 border border-[#4CAC30]/40 flex items-center justify-center shrink-0 text-[#4CAC30]">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Yeni sürüm hazır</span>
              <span className="w-2 h-2 rounded-full bg-[#4CAC30] animate-ping" />
            </h4>
            <p className="text-xs text-slate-300 truncate">
              Güncel ERP sistemini yüklemek için sayfayı yenileyin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#4CAC30] hover:bg-[#439c2a] active:scale-95 text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Yenile</span>
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            aria-label="Kapat"
            className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
