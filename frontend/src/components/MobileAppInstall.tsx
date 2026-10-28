import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  TabletSmartphone,
  ScanBarcode,
  X,
  Share2,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  ArrowRight,
  Camera,
  Keyboard,
  Info
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type ModalTab = 'android' | 'ios' | 'scanner';

export const MobileAppInstall: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('android');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOSNonSafari, setIsIOSNonSafari] = useState<boolean>(false);
  const [currentOrigin, setCurrentOrigin] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Check standalone mode and capture PWA beforeinstallprompt event
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);

      const standaloneMatch =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true;
      setIsStandalone(standaloneMatch);

      // Check iOS user agent for Safari
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      const isSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
      if (isIOS && !isSafari) {
        setIsIOSNonSafari(true);
      }

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }
  }, []);

  // Keyboard accessibility: ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Click outside to close modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  // Android Card Click Handler
  const handleAndroidClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setDeferredPrompt(null);
          return;
        }
      } catch (err) {
        console.warn('Native prompt failed, showing guide instead', err);
      }
    }
    setActiveTab('android');
    setIsOpen(true);
  };

  // iOS Card Click Handler
  const handleIOSClick = () => {
    setActiveTab('ios');
    setIsOpen(true);
  };

  // Barcode Card Click Handler
  const handleScannerClick = () => {
    setActiveTab('scanner');
    setIsOpen(true);
  };

  // Direct Scanner Navigation
  const handleOpenScanner = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/?view=scanner';
    }
  };

  // If already running in standalone PWA, do not render this section
  if (isStandalone) {
    return null;
  }

  return (
    <div className="mt-6 pt-5 border-t border-border select-none">
      {/* Section Header */}
      <div className="text-center mb-3">
        <h3 className="text-xs font-bold text-text uppercase tracking-wider">
          Mobil Uygulama
        </h3>
        <p className="text-[11px] text-text-muted mt-0.5">
          Telefonunuza yükleyin, barkod okutun, sahadan çalışın.
        </p>
      </div>

      {/* 3 Tight Cards for 390px and small mobile screens */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {/* 1. Android Card */}
        <button
          type="button"
          onClick={handleAndroidClick}
          className="flex flex-col items-center justify-center p-2 min-h-[48px] rounded-xl bg-bg hover:bg-surface text-text border border-border hover:border-[#302480]/30 transition-all active:scale-[0.98] group"
          aria-label="Android için Günay ERP mobil kurulumu"
        >
          <div className="w-6 h-6 rounded-lg bg-[#EFEFFC] text-[#302480] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold text-text leading-tight group-hover:text-[#302480]">
            Android
          </span>
          <span className="text-[9px] text-text-muted leading-none mt-0.5">
            PWA Yükle
          </span>
        </button>

        {/* 2. iPhone / iPad Card */}
        <button
          type="button"
          onClick={handleIOSClick}
          className="flex flex-col items-center justify-center p-2 min-h-[48px] rounded-xl bg-bg hover:bg-surface text-text border border-border hover:border-[#302480]/30 transition-all active:scale-[0.98] group"
          aria-label="iPhone ve iPad için Günay ERP mobil kurulumu"
        >
          <div className="w-6 h-6 rounded-lg bg-[#EFEFFC] text-[#302480] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
            <TabletSmartphone className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold text-text leading-tight group-hover:text-[#302480]">
            iPhone / iPad
          </span>
          <span className="text-[9px] text-text-muted leading-none mt-0.5">
            Safari Ekle
          </span>
        </button>

        {/* 3. Barkod Okuyucu Card */}
        <button
          type="button"
          onClick={handleScannerClick}
          className="flex flex-col items-center justify-center p-2 min-h-[48px] rounded-xl bg-bg hover:bg-surface text-text border border-border hover:border-[#4CAC30]/40 transition-all active:scale-[0.98] group"
          aria-label="Barkod Okuyucu ve El Terminali modülü"
        >
          <div className="w-6 h-6 rounded-lg bg-[#F0FAEC] text-[#4CAC30] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
            <ScanBarcode className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold text-text leading-tight group-hover:text-[#4CAC30]">
            Barkod Okuyucu
          </span>
          <span className="text-[9px] text-text-muted leading-none mt-0.5">
            Kamera & Cihaz
          </span>
        </button>
      </div>

      {/* Desktop QR Code Block (Visible only on desktop screens >= 1024px) */}
      <div className="hidden lg:flex items-center justify-center gap-3.5 mt-4 p-2.5 rounded-xl bg-bg border border-border">
        <div className="p-1.5 bg-white rounded-lg border border-border shadow-2xs shrink-0">
          <QRCodeSVG
            value={currentOrigin || 'https://gunay-kimya-web.onrender.com'}
            size={68}
            level="M"
            fgColor="#1E1654"
          />
        </div>
        <div className="text-left">
          <span className="text-[11px] font-bold text-text block leading-tight">
            Mobil Hızlı Erişim
          </span>
          <p className="text-[10px] text-text-muted mt-0.5 leading-snug">
            Telefonunuzun kamerasıyla okutun, uygulamayı hemen ana ekranınıza ekleyin.
          </p>
        </div>
      </div>

      {/* =====================================================================
          INSTALLATION MODAL & BOTTOM SHEET
          Desktop: Centered Modal / Mobile (< 640px): Bottom Sheet
          ===================================================================== */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-in fade-in duration-150"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            ref={modalRef}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between gap-3 bg-surface sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F0FAEC] border border-[#C5E8BA] flex items-center justify-center shrink-0">
                  <img
                    src="/logo-mark.png"
                    alt="Günay Kimya"
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <div>
                  <h4 id="modal-title" className="text-sm sm:text-base font-extrabold text-text tracking-tight">
                    Günay ERP Mobil Kurulumu
                  </h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    Android ve iPhone'da tam ekran uygulama deneyimi
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-text-muted hover:text-text hover:bg-bg flex items-center justify-center transition-colors"
                aria-label="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-border bg-bg/50 px-3 pt-2 gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`flex-1 min-h-[40px] py-2 px-2.5 rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTab === 'android'
                    ? 'bg-white text-[#302480] border-[#302480] font-bold shadow-2xs'
                    : 'text-text-muted hover:text-text border-transparent'
                }`}
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>Android</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`flex-1 min-h-[40px] py-2 px-2.5 rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTab === 'ios'
                    ? 'bg-white text-[#302480] border-[#302480] font-bold shadow-2xs'
                    : 'text-text-muted hover:text-text border-transparent'
                }`}
              >
                <TabletSmartphone className="w-4 h-4 shrink-0" />
                <span>iPhone / iPad</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('scanner')}
                className={`flex-1 min-h-[40px] py-2 px-2.5 rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTab === 'scanner'
                    ? 'bg-white text-[#4CAC30] border-[#4CAC30] font-bold shadow-2xs'
                    : 'text-text-muted hover:text-text border-transparent'
                }`}
              >
                <ScanBarcode className="w-4 h-4 shrink-0" />
                <span>Barkod Okuyucu</span>
              </button>
            </div>

            {/* Modal Scrollable Content Area */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {/* =============================================================
                  TAB 1: ANDROID INSTRUCTIONS
                  ============================================================= */}
              {activeTab === 'android' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text text-xs uppercase tracking-wide">
                      Google Chrome / Edge Kurulum Adımları
                    </span>
                    {deferredPrompt && (
                      <button
                        type="button"
                        onClick={handleAndroidClick}
                        className="px-3 py-1.5 rounded-lg bg-[#302480] text-white font-bold text-xs hover:bg-[#1E1654] transition shadow-xs flex items-center gap-1"
                      >
                        <span>Hemen Yükle</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <ol className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#4CAC30] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        1
                      </span>
                      <div className="text-text">
                        <span className="font-semibold block text-text">
                          Menüyü Açın
                        </span>
                        <span className="text-text-muted">
                          Chrome veya Edge tarayıcısında sağ üstteki üç nokta menüsüne (
                          <MoreVertical className="w-3.5 h-3.5 inline mx-0.5 text-text" />
                          ) dokunun.
                        </span>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#4CAC30] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        2
                      </span>
                      <div className="text-text">
                        <span className="font-semibold block text-text">
                          Uygulamayı Ekle Seçeneği
                        </span>
                        <span className="text-text-muted">
                          Açılan menüde <strong>"Uygulamayı Yükle"</strong> veya <strong>"Ana ekrana ekle"</strong> seçeneğine dokunun.
                        </span>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#4CAC30] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        3
                      </span>
                      <div className="text-text">
                        <span className="font-semibold block text-text">
                          Onaylayın ve Başlatın
                        </span>
                        <span className="text-text-muted">
                          Gelen onay penceresinde <strong>"Yükle"</strong> butonuna dokunun. Günay ERP ikonu telefonunuzun ana ekranına eklenecektir.
                        </span>
                      </div>
                    </li>
                  </ol>
                </div>
              )}

              {/* =============================================================
                  TAB 2: IPHONE / IPAD INSTRUCTIONS
                  ============================================================= */}
              {activeTab === 'ios' && (
                <div className="space-y-3.5">
                  {/* Safari Warning if opened in another browser on iOS */}
                  {isIOSNonSafari && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Apple iOS kuralları gereği ana ekrana ekleme işlemi için lütfen bu sayfayı <strong>Apple Safari</strong> tarayıcısında açınız.
                      </span>
                    </div>
                  )}

                  <span className="font-bold text-text text-xs uppercase tracking-wide block">
                    Apple Safari Kurulum Adımları
                  </span>

                  <ol className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#4CAC30] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        1
                      </span>
                      <div className="text-text">
                        <span className="font-semibold block text-text">
                          Safari'de Açın
                        </span>
                        <span className="text-text-muted">
                          Günay ERP adresini iPhone veya iPad cihazınızda <strong>Safari</strong> ile görüntüleyin.
                        </span>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#4CAC30] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        2
                      </span>
                      <div className="text-text">
                        <span className="font-semibold block text-text">
                          Paylaş Simgesine Dokunun
                        </span>
                        <span className="text-text-muted">
                          Ekranın altındaki araç çubuğunda ortada yer alan Paylaş simgesine (
                          <Share2 className="w-3.5 h-3.5 inline mx-0.5 text-text" />
                          ) dokunun.
                        </span>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#4CAC30] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        3
                      </span>
                      <div className="text-text">
                        <span className="font-semibold block text-text">
                          Ana Ekrana Ekle
                        </span>
                        <span className="text-text-muted">
                          Paylaş menüsünü yukarı kaydırıp <strong>"Ana Ekrana Ekle"</strong> (
                          <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-text" />
                          ) seçeneğine dokunun.
                        </span>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#4CAC30] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        4
                      </span>
                      <div className="text-text">
                        <span className="font-semibold block text-text">
                          Ekle'ye Basın
                        </span>
                        <span className="text-text-muted">
                          Sağ üst köşedeki <strong>"Ekle"</strong> düğmesine basın. Günay ERP ana ekranınızda yerini alır.
                        </span>
                      </div>
                    </li>
                  </ol>
                </div>
              )}

              {/* =============================================================
                  TAB 3: BARKOD OKUYUCU / EL TERMINALI
                  ============================================================= */}
              {activeTab === 'scanner' && (
                <div className="space-y-3.5">
                  {/* Section 1: Telefon Kamerası */}
                  <div className="p-3.5 rounded-xl bg-bg border border-border">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-[#F0FAEC] text-[#4CAC30] flex items-center justify-center shrink-0">
                        <Camera className="w-3.5 h-3.5" />
                      </div>
                      <h5 className="font-bold text-text text-xs">
                        Telefon Kamerası ile Barkod Okuma
                      </h5>
                    </div>
                    <p className="text-text-muted text-[11px] leading-relaxed mb-2.5">
                      Telefonunuzun arka kamerasını endüstriyel bir tarayıcıya dönüştürür. GS1-128, SSCC-18, EAN-13 ve QR formatlarını saniyeler içinde çözümler.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenScanner}
                      className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-[#4CAC30] hover:bg-[#439c2a] text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs active:scale-[0.99]"
                    >
                      <ScanBarcode className="w-4 h-4" />
                      <span>Barkod Okuyucuyu Aç</span>
                    </button>
                  </div>

                  {/* Section 2: El Terminali / Bluetooth-USB Okuyucu */}
                  <div className="p-3.5 rounded-xl bg-bg border border-border">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-[#EFEFFC] text-[#302480] flex items-center justify-center shrink-0">
                        <Keyboard className="w-3.5 h-3.5" />
                      </div>
                      <h5 className="font-bold text-text text-xs">
                        El Terminali / Bluetooth-USB Barkod Okuyucu
                      </h5>
                    </div>
                    <p className="text-text-muted text-[11px] leading-relaxed">
                      Zebra, Honeywell, Datalogic gibi endüstriyel el terminalleri veya kablosuz barkod okuyucu tabancalar klavye (HID) gibi çalışır. Terminal ekranındaki giriş alanına okutmanız yeterlidir; sistem Enter komutuyla sorguyu anında çalıştırır ve alanı bir sonraki okutma için otomatik hazır tutar.
                    </p>
                  </div>
                </div>
              )}

              {/* Informational Callout (Green soft box) */}
              <div className="p-3 rounded-xl bg-[#F0FAEC] border border-[#C5E8BA] text-[#166534] flex items-start gap-2.5 text-[11px] leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-[#4CAC30] shrink-0 mt-0.5" />
                <span>
                  Mağaza kurulumu gerekmez. Tam ekran açılır, adres çubuğu görünmez, kendi kullanıcı hesabınızla güvenle oturum açarsınız.
                </span>
              </div>
            </div>

            {/* Modal Bottom Close Action for Mobile */}
            <div className="p-3 bg-bg border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-white border border-border hover:bg-surface text-text font-bold text-xs transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
