import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  ScanBarcode,
  Camera,
  CameraOff,
  Boxes,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Tag,
  ArrowRight,
  Package,
  Loader2,
  Info
} from 'lucide-react';

interface ScannedResultData {
  found: boolean;
  barcode_string: string;
  barcode_type: 'PALLET' | 'BOX' | 'LOT' | string;
  type_label: string;
  item_id?: number | null;
  product_name: string;
  product_sku: string;
  lot_number: string;
  production_order_number?: string;
  customer_name: string;
  customer_id?: number | null;
  quantity: number;
  unit: string;
  warehouse: string;
  status: string;
  status_label: string;
  can_receive: boolean;
  can_dispatch: boolean;
  child_box_count?: number;
}

export const TerminalScanner: React.FC = () => {
  // Screen / view state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStartingCameraRef = useRef<boolean>(false);

  // Manual input state
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Active Scanned Result
  const [scannedCard, setScannedCard] = useState<ScannedResultData | null>(null);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Recent Scan Log for the shift
  const [recentScans, setRecentScans] = useState<
    Array<{ barcode: string; type: string; time: string; action: string }>
  >([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Sound Synthesizer via Web Audio API (Zero external audio file dependency)
  const playChime = (type: 'success' | 'error' | 'scan') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'scan') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(750, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.setValueAtTime(110, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      }
    } catch {
      // AudioContext unavailable or blocked by autoplay
    }
  };

  // Vibrate on mobile device
  const triggerHaptic = (success: boolean) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (success) {
        navigator.vibrate(80);
      } else {
        navigator.vibrate([100, 50, 150]);
      }
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Focus input automatically
  const focusManualInput = () => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 150);
  };

  useEffect(() => {
    focusManualInput();
    return () => {
      // Cleanup camera on unmount
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Barcode Lookup logic
  const processBarcodeLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setIsProcessing(true);
    setFeedback(null);
    playChime('scan');
    triggerHaptic(true);

    try {
      const res = await axios.post('/api/v1/inventory/terminal/lookup', {
        barcode_string: trimmed
      });

      const data: ScannedResultData = res.data;
      setScannedCard(data);
      setBarcodeInput('');

      if (data.found) {
        setFeedback({
          type: 'success',
          message: `Barkod Tanındı: ${data.type_label} - ${data.product_name}`
        });
        playChime('success');
      } else {
        setFeedback({
          type: 'info',
          message: `Sistemde henüz kayıtlı olmayan barkod (${trimmed}). Aşağıdaki aksiyonlarla işlem yapabilirsiniz.`
        });
      }
    } catch (err: any) {
      console.error('Barcode lookup error:', err);
      playChime('error');
      triggerHaptic(false);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Barkod sorgulanırken bir iletişim hatası oluştu.'
      });
    } finally {
      setIsProcessing(false);
      focusManualInput();
    }
  };

  // Start Camera scanning using html5-qrcode
  const startCamera = async () => {
    if (isStartingCameraRef.current) return;
    isStartingCameraRef.current = true;
    setCameraError(null);

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('terminal-camera-reader');
      }

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      };

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText: string) => {
          // Success Callback
          if (decodedText) {
            processBarcodeLookup(decodedText);
          }
        },
        () => {
          // Scan frame miss (ignore)
        }
      );

      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera start error:', err);
      let errorMsg = 'Kamera başlatılamadı.';
      if (err?.name === 'NotAllowedError' || err?.toString().includes('NotAllowedError')) {
        errorMsg = 'Kamera izni reddedildi. Lütfen tarayıcı ayarlarından kameraya izin veriniz veya manuel barkod girişini kullanınız.';
      } else if (err?.name === 'NotFoundError') {
        errorMsg = 'Cihazda uygun kamera bulunamadı.';
      }
      setCameraError(errorMsg);
      setIsCameraActive(false);
    } finally {
      isStartingCameraRef.current = false;
    }
  };

  // Stop Camera
  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }
    setIsCameraActive(false);
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Action: Depoya Kabul
  const handleReceiveAction = async () => {
    if (!scannedCard) return;
    setActionLoading('RECEIVE');
    setFeedback(null);

    try {
      const res = await axios.post('/api/v1/inventory/terminal/action', {
        barcode_string: scannedCard.barcode_string,
        action: 'RECEIVE',
        target_warehouse: 'Mamul Ürün Deposu'
      });

      playChime('success');
      triggerHaptic(true);
      setFeedback({
        type: 'success',
        message: res.data.message || 'Depoya kabul işlemi başarıyla tamamlandı!'
      });

      setRecentScans((prev) => [
        {
          barcode: scannedCard.barcode_string,
          type: scannedCard.type_label,
          time: new Date().toLocaleTimeString('tr-TR'),
          action: 'Depoya Kabul'
        },
        ...prev.slice(0, 7)
      ]);

      // Refresh card state
      setScannedCard((prev) => (prev ? { ...prev, status: 'IN_STOCK', status_label: 'Depoda (Kullanıma Hazır)' } : null));
    } catch (err: any) {
      playChime('error');
      triggerHaptic(false);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Depoya kabul işlemi başarısız oldu.'
      });
    } finally {
      setActionLoading(null);
      focusManualInput();
    }
  };

  // Action: Sevkiyat Doğrula
  const handleDispatchAction = async () => {
    if (!scannedCard) return;
    setActionLoading('DISPATCH');
    setFeedback(null);

    try {
      const res = await axios.post('/api/v1/inventory/terminal/action', {
        barcode_string: scannedCard.barcode_string,
        action: 'DISPATCH'
      });

      playChime('success');
      triggerHaptic(true);
      setFeedback({
        type: 'success',
        message: res.data.message || 'Barkod sevkiyat için başarıyla doğrulandı!'
      });

      setRecentScans((prev) => [
        {
          barcode: scannedCard.barcode_string,
          type: scannedCard.type_label,
          time: new Date().toLocaleTimeString('tr-TR'),
          action: 'Sevkiyat Doğrulandı'
        },
        ...prev.slice(0, 7)
      ]);

      setScannedCard((prev) => (prev ? { ...prev, status: 'RESERVED', status_label: 'Sevkiyata Ayrılmış' } : null));
    } catch (err: any) {
      playChime('error');
      triggerHaptic(false);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Sevkiyat doğrulaması başarısız oldu.'
      });
    } finally {
      setActionLoading(null);
      focusManualInput();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 select-none pb-24 md:pb-6">
      {/* Top Rugged Status Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-mod-stok-soft text-mod-stok border border-mod-stok-soft flex items-center justify-center shrink-0">
            <ScanBarcode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-text">El Terminali</h1>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-success-soft text-success border border-success-border font-mono">
                Mobil Çevrimdışı PWA
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Depo Mal Kabul & Sevkiyat Doğrulama • GS1 SSCC-18 & Barkod Tarayıcı
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-xs flex items-center justify-center border transition ${
              soundEnabled
                ? 'bg-primary-soft text-primary border-primary-border'
                : 'bg-bg text-text-muted border-border'
            }`}
            title="Terminal Sesi"
            aria-label="Terminal Sesi"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-surface hover:bg-bg text-text-muted hover:text-text border border-border flex items-center justify-center transition"
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Modu'}
            aria-label="Tam Ekran"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Barcode Scan Trigger (Big Industrial Camera Button) */}
      <div className="bg-surface border border-border rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={toggleCamera}
            className={`min-h-[56px] py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition shadow-md active:scale-[0.98] ${
              isCameraActive
                ? 'bg-danger text-white hover:bg-danger-hover'
                : 'bg-primary text-white hover:bg-primary-hover shadow-primary/20'
            }`}
          >
            {isCameraActive ? (
              <>
                <CameraOff className="w-6 h-6" />
                <span>Kamerayı Kapat</span>
              </>
            ) : (
              <>
                <Camera className="w-6 h-6" />
                <span>Barkod Tara (Kamera)</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setScannedCard(null);
              setFeedback(null);
              focusManualInput();
            }}
            className="min-h-[56px] py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2 border border-border bg-bg hover:bg-surface text-text transition"
          >
            <RotateCcw className="w-5 h-5 text-text-muted" />
            <span>Ekranı Temizle</span>
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div className={`${isCameraActive ? 'block' : 'hidden'} transition-all`}>
          <div className="relative rounded-2xl overflow-hidden border-2 border-primary bg-black aspect-video max-h-80 mx-auto">
            <div id="terminal-camera-reader" className="w-full h-full" />
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-56 h-36 border-2 border-primary/80 rounded-xl relative">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-danger animate-pulse shadow-sm shadow-danger" />
                </div>
                <span className="text-[11px] font-bold text-white/90 bg-black/60 px-3 py-1 rounded-full mt-3">
                  Barkodu kılavuz içine tutunuz
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Camera Permission / Error Banner */}
        {cameraError && (
          <div className="p-4 rounded-xl bg-danger-soft border border-danger-border text-danger flex items-start gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Kamera Uyarısı</span>
              <span>{cameraError}</span>
            </div>
            <button
              onClick={() => setCameraError(null)}
              className="text-xs font-bold uppercase underline"
            >
              Tamam
            </button>
          </div>
        )}

        {/* Manual Barcode Input Fallback (Always Ready for Laser Guns or Typing) */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-text-muted mb-1.5">
            Manuel Barkod veya Lazer Tabanca Girişi
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              processBarcodeLookup(barcodeInput);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Örn: (00)186901230000010018 veya KOLI-5001"
                className="w-full min-h-[50px] px-4 py-3 bg-bg border border-border rounded-xl font-mono text-base font-bold text-text focus:outline-none focus:border-primary transition"
                autoCapitalize="characters"
                enterKeyHint="go"
              />
              {barcodeInput && (
                <button
                  type="button"
                  onClick={() => setBarcodeInput('')}
                  className="absolute right-3 top-3 text-text-muted hover:text-text font-bold text-sm px-2"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!barcodeInput.trim() || isProcessing}
              className="min-h-[50px] px-6 rounded-xl font-extrabold text-sm bg-primary hover:bg-primary-hover text-white transition flex items-center gap-2 disabled:opacity-50 shrink-0 shadow-sm"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              <span>Sorgula</span>
            </button>
          </form>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-semibold transition ${
            feedback.type === 'success'
              ? 'bg-success-soft border-success-border text-success'
              : feedback.type === 'error'
              ? 'bg-danger-soft border-danger-border text-danger'
              : 'bg-primary-soft border-primary-border text-primary'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            ) : (
              <Info className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs uppercase font-extrabold opacity-75 hover:opacity-100"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Scanned Result Card with Industrial Action Buttons */}
      {scannedCard && (
        <div className="bg-surface border-2 border-primary/30 rounded-2xl p-5 shadow-lg space-y-5 animate-in fade-in duration-200">
          {/* Card Top: Type Badge & Monospace Code */}
          <div className="flex items-start justify-between gap-2 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg text-xs font-extrabold uppercase bg-mod-stok-soft text-mod-stok border border-mod-stok-soft flex items-center gap-1.5">
                  {scannedCard.barcode_type === 'PALLET' ? (
                    <Boxes className="w-4 h-4" />
                  ) : scannedCard.barcode_type === 'BOX' ? (
                    <Package className="w-4 h-4" />
                  ) : (
                    <Tag className="w-4 h-4" />
                  )}
                  {scannedCard.type_label}
                </span>

                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    scannedCard.status === 'IN_STOCK'
                      ? 'bg-success-soft text-success border-success-border'
                      : scannedCard.status === 'RESERVED'
                      ? 'bg-primary-soft text-primary border-primary-border'
                      : scannedCard.status === 'SHIPPED'
                      ? 'bg-danger-soft text-danger border-danger-border'
                      : 'bg-warning-soft text-warning border-warning-border'
                  }`}
                >
                  {scannedCard.status_label}
                </span>
              </div>

              <div className="font-mono text-xl md:text-2xl font-black text-text tracking-wide mt-2">
                {scannedCard.barcode_string}
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-text-muted block">MİKTAR</span>
              <span className="text-2xl font-black text-text">
                {scannedCard.quantity}{' '}
                <span className="text-xs font-bold text-text-muted uppercase">{scannedCard.unit}</span>
              </span>
            </div>
          </div>

          {/* Product & Logistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-bg rounded-xl border border-border">
              <span className="text-xs font-bold text-text-muted uppercase block">Ürün & SKU</span>
              <span className="font-extrabold text-text text-base block mt-0.5">{scannedCard.product_name}</span>
              <span className="text-xs font-mono text-text-muted mt-0.5 block">{scannedCard.product_sku}</span>
            </div>

            <div className="p-3 bg-bg rounded-xl border border-border">
              <span className="text-xs font-bold text-text-muted uppercase block">Parti / Lot & Emir</span>
              <span className="font-mono font-extrabold text-text text-base block mt-0.5">
                {scannedCard.lot_number}
              </span>
              <span className="text-xs text-text-muted mt-0.5 block font-mono">
                Emir No: {scannedCard.production_order_number || 'N/A'}
              </span>
            </div>

            <div className="p-3 bg-bg rounded-xl border border-border sm:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-text-muted uppercase block">Müşteri / Cari Hesap</span>
                  <span className="font-bold text-text block mt-0.5">{scannedCard.customer_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-text-muted uppercase block">Konum / Depo</span>
                  <span className="font-semibold text-text text-xs block mt-0.5">{scannedCard.warehouse}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Big Action Buttons (Min 52px Touch Target) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleReceiveAction}
              disabled={actionLoading !== null}
              className="min-h-[52px] py-3.5 px-5 rounded-xl font-black text-base bg-mod-stok text-white hover:bg-mod-stok/90 transition shadow-md flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-50"
            >
              {actionLoading === 'RECEIVE' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Boxes className="w-5 h-5" />
              )}
              <span>Depoya Kabul Et</span>
            </button>

            <button
              onClick={handleDispatchAction}
              disabled={actionLoading !== null}
              className="min-h-[52px] py-3.5 px-5 rounded-xl font-black text-base bg-primary text-white hover:bg-primary-hover transition shadow-md shadow-primary/20 flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-50"
            >
              {actionLoading === 'DISPATCH' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Truck className="w-5 h-5" />
              )}
              <span>Sevkiyat Doğrula</span>
            </button>
          </div>
        </div>
      )}

      {/* Recent Activity Log for Handheld Operator */}
      {recentScans.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            Vardiya Son İşlemleri ({recentScans.length})
          </h3>
          <div className="space-y-2">
            {recentScans.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-bg border border-border text-xs"
              >
                <div>
                  <span className="font-bold text-text block">{item.action}</span>
                  <span className="font-mono text-text-muted text-[11px] block">{item.barcode}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-text-muted block text-[11px]">{item.time}</span>
                  <span className="text-[10px] font-bold text-primary">{item.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
