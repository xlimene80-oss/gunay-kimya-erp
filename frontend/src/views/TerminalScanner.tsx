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
  Info,
  XCircle,
  Keyboard,
  FileText,
  MapPin
} from 'lucide-react';
import { GhsPictogramGroup } from '../components/GhsPictogram';

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
  bin_code?: string | null;
  zone_name?: string | null;
  hazard_class?: string | null;
  signal_word?: string | null;
  ghs_pictograms?: string | null;
  storage_class?: string | null;
  cas_number?: string | null;
  un_number?: string | null;
  sds_file_url?: string | null;
  sds_revision_date?: string | null;
  status: string;
  status_label: string;
  lot_status?: string | null;
  warning?: string | null;
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

  // Manual & Hardware Barcode reader input state
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [visualFlash, setVisualFlash] = useState<'success' | 'error' | null>(null);

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

  // Sound Synthesizer via Web Audio API
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
      // AudioContext unavailable
    }
  };

  // Vibrate on mobile device (200ms on success as specified)
  const triggerHaptic = (success: boolean) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (success) {
        navigator.vibrate(200);
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

  // Always keep focus on the barcode text input (Hardware readers type like keyboards)
  const focusManualInput = () => {
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });
  };

  useEffect(() => {
    focusManualInput();
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Visual feedback flash trigger
  const triggerVisualFeedback = (type: 'success' | 'error') => {
    setVisualFlash(type);
    setTimeout(() => {
      setVisualFlash(null);
    }, 700);
  };

  // Barcode Lookup logic
  const processBarcodeLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setIsProcessing(true);
    setFeedback(null);
    playChime('scan');

    // Immediately clear input and keep focused for next reader scan
    setBarcodeInput('');

    try {
      const res = await axios.post('/api/v1/inventory/terminal/lookup', {
        barcode_string: trimmed
      });

      const data: ScannedResultData = res.data;
      setScannedCard(data);

      if (data.found) {
        triggerHaptic(true);
        triggerVisualFeedback('success');
        playChime('success');
        setFeedback({
          type: 'success',
          message: `Barkod Doğrulandı: ${data.type_label} - ${data.product_name}`
        });
      } else {
        triggerHaptic(false);
        triggerVisualFeedback('error');
        playChime('error');
        setFeedback({
          type: 'error',
          message: `Kayıt bulunamadı: ${trimmed}`
        });
      }
    } catch (err: any) {
      console.error('Barcode lookup error:', err);
      playChime('error');
      triggerHaptic(false);
      triggerVisualFeedback('error');
      setScannedCard({
        found: false,
        barcode_string: trimmed,
        barcode_type: 'UNKNOWN',
        type_label: 'Bilinmeyen Barkod',
        product_name: '',
        product_sku: '',
        lot_number: '',
        customer_name: '',
        quantity: 0,
        unit: 'Adet',
        warehouse: '',
        status: 'NOT_FOUND',
        status_label: 'Kayıt Bulunamadı',
        can_receive: false,
        can_dispatch: false
      });
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || `Barkod sorgulanamadı (${trimmed}).`
      });
    } finally {
      setIsProcessing(false);
      focusManualInput();
    }
  };

  // Start Camera scanning using html5-qrcode
  // Formats supported: CODE_128 (SSCC-18 and GS1-128), EAN_13, QR_CODE
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
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      };

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText: string) => {
          if (decodedText) {
            processBarcodeLookup(decodedText);
          }
        },
        () => {
          // Frame miss
        }
      );

      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera start error:', err);
      let errorMsg = 'Kamera başlatılamadı.';
      if (err?.name === 'NotAllowedError' || err?.toString().includes('NotAllowedError')) {
        errorMsg = 'Kamera erişim izni verilmedi. Donanım barkod okuyucu (lazer tabanca / el terminali) veya aşağıdaki giriş alanını kullanabilirsiniz.';
      } else if (err?.name === 'NotFoundError') {
        errorMsg = 'Cihazda uygun kamera bulunamadı.';
      }
      setCameraError(errorMsg);
      setIsCameraActive(false);
      focusManualInput();
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
    focusManualInput();
  };

  const toggleCamera = () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Action: Depoya Kabul
  const handleReceiveAction = async () => {
    if (!scannedCard || !scannedCard.found) return;
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
      triggerVisualFeedback('success');
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

      setScannedCard((prev) => (prev ? { ...prev, status: 'IN_STOCK', status_label: 'Depoda (Kullanıma Hazır)' } : null));
    } catch (err: any) {
      playChime('error');
      triggerHaptic(false);
      triggerVisualFeedback('error');
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
    if (!scannedCard || !scannedCard.found) return;
    setActionLoading('DISPATCH');
    setFeedback(null);

    try {
      const res = await axios.post('/api/v1/inventory/terminal/action', {
        barcode_string: scannedCard.barcode_string,
        action: 'DISPATCH'
      });

      playChime('success');
      triggerHaptic(true);
      triggerVisualFeedback('success');
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
      triggerVisualFeedback('error');
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
    <div
      className={`max-w-3xl mx-auto space-y-4 select-none pb-24 md:pb-6 transition-all duration-300 ${
        visualFlash === 'success'
          ? 'ring-4 ring-[#4CAC30]/40 rounded-3xl'
          : visualFlash === 'error'
          ? 'ring-4 ring-[#DC2626]/40 rounded-3xl'
          : ''
      }`}
    >
      {/* Top Rugged Status Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-mod-stok-soft text-mod-stok border border-mod-stok-soft flex items-center justify-center shrink-0">
            <ScanBarcode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-text">El Terminali</h1>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-success-soft text-success border border-success-border font-mono">
                PWA / Çevrimdışı
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Depo Mal Kabul & Sevkiyat Doğrulama • GS1-128 & SSCC-18
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

      {/* Main Barcode Actions & Trigger */}
      <div className="bg-surface border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
        {/* Toggle Camera and Reset Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={toggleCamera}
            className={`min-h-[52px] py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-3 transition shadow-md active:scale-[0.98] ${
              isCameraActive
                ? 'bg-danger text-white hover:bg-danger-hover'
                : 'bg-[#302480] text-white hover:bg-[#1E1654]'
            }`}
          >
            {isCameraActive ? (
              <>
                <CameraOff className="w-5 h-5" />
                <span>Kamerayı Kapat</span>
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
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
            className="min-h-[52px] py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 border border-border bg-bg hover:bg-surface text-text transition"
          >
            <RotateCcw className="w-5 h-5 text-text-muted" />
            <span>Ekranı Temizle</span>
          </button>
        </div>

        {/* Camera Viewport Container (Only shown when active) */}
        {isCameraActive && (
          <div className="transition-all animate-in fade-in duration-200">
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#302480] bg-black aspect-video max-h-80 mx-auto">
              <div id="terminal-camera-reader" className="w-full h-full" />
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-56 h-36 border-2 border-[#4CAC30] rounded-xl relative">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#4CAC30] animate-pulse shadow-sm shadow-[#4CAC30]" />
                </div>
                <span className="text-[11px] font-bold text-white/90 bg-black/70 px-3 py-1 rounded-full mt-3">
                  CODE-128 / EAN-13 / QR barkodu kılavuza tutun
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Camera Permission / Error Banner */}
        {cameraError && (
          <div className="p-4 rounded-xl bg-danger-soft border border-danger-border text-danger flex items-start gap-3 text-sm animate-in fade-in duration-150">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-danger" />
            <div className="flex-1 text-xs sm:text-sm">
              <span className="font-bold block text-danger-text">Kamera Bilgilendirmesi</span>
              <span className="text-danger-text/90 mt-0.5 block">{cameraError}</span>
            </div>
            <button
              onClick={() => {
                setCameraError(null);
                focusManualInput();
              }}
              className="text-xs font-bold uppercase underline text-danger-text"
            >
              Tamam
            </button>
          </div>
        )}

        {/* ALWAYS-FOCUSED HARDWARE & MANUAL SCANNER INPUT */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="barcode-input-field"
              className="block text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5"
            >
              <Keyboard className="w-4 h-4 text-[#302480]" />
              <span>Barkod Okuyucu / Manuel Giriş</span>
            </label>
            <span className="text-[10px] text-text-muted font-medium">
              Lazer okuyucu ve klavye Enter otomatik sorgular
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              processBarcodeLookup(barcodeInput);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <input
                id="barcode-input-field"
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    processBarcodeLookup(barcodeInput);
                  }
                }}
                placeholder="Örn: (00)186901230000010018 veya LOT-2026-001"
                className="w-full min-h-[50px] px-4 py-3 bg-bg border border-border rounded-xl font-mono text-base font-bold text-text focus:outline-none focus:border-[#302480] focus:ring-2 focus:ring-[#302480]/20 transition"
                autoCapitalize="characters"
                autoComplete="off"
                autoFocus
              />
              {barcodeInput && (
                <button
                  type="button"
                  onClick={() => {
                    setBarcodeInput('');
                    focusManualInput();
                  }}
                  className="absolute right-3 top-3 text-text-muted hover:text-text font-bold text-sm px-2 min-h-[28px]"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!barcodeInput.trim() || isProcessing}
              className="min-h-[50px] px-6 rounded-xl font-extrabold text-sm bg-[#302480] hover:bg-[#1E1654] text-white transition flex items-center gap-2 disabled:opacity-50 shrink-0 shadow-xs"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5" />
              )}
              <span>Sorgula</span>
            </button>
          </form>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-semibold transition animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-[#F0FAEC] border-[#C5E8BA] text-[#166534]'
              : feedback.type === 'error'
              ? 'bg-danger-soft border-danger-border text-danger'
              : 'bg-primary-soft border-primary-border text-primary'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#4CAC30]" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 shrink-0 text-danger" />
            ) : (
              <Info className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs uppercase font-extrabold opacity-75 hover:opacity-100 min-h-[30px]"
          >
            Kapat
          </button>
        </div>
      )}

      {/* =====================================================================
          SCANNED RESULT: BIG INDUSTRIAL CARD
          SUCCESS: Green Theme with Full Product & Logistics Details
          FAILURE: Red Theme "Kayıt Bulunamadı" with Guidance
          ===================================================================== */}
      {scannedCard && (
        <div>
          {scannedCard.found ? (
            /* ================= BIG GREEN CARD (SUCCESS) ================= */
            <div className="bg-[#F0FAEC] border-2 border-[#4CAC30] rounded-2xl p-5 shadow-md space-y-4 animate-in zoom-in-95 duration-200">
              {/* Header: Verified Badge & Barcode String */}
              <div className="flex items-start justify-between gap-2 border-b border-[#C5E8BA] pb-3.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-xs font-black uppercase bg-[#4CAC30] text-white flex items-center gap-1.5 shadow-xs">
                      {scannedCard.barcode_type === 'PALLET' ? (
                        <Boxes className="w-4 h-4" />
                      ) : scannedCard.barcode_type === 'BOX' ? (
                        <Package className="w-4 h-4" />
                      ) : (
                        <Tag className="w-4 h-4" />
                      )}
                      {scannedCard.type_label}
                    </span>

                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-[#166534] border border-[#C5E8BA]">
                      {scannedCard.status_label}
                    </span>
                  </div>

                  <div className="font-mono text-xl sm:text-2xl font-black text-[#166534] tracking-wide mt-2">
                    {scannedCard.barcode_string}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-[#166534]/70 block">MİKTAR</span>
                  <span className="text-2xl sm:text-3xl font-black text-[#166534]">
                    {scannedCard.quantity}{' '}
                    <span className="text-xs font-bold uppercase">{scannedCard.unit}</span>
                  </span>
                </div>
              </div>

              {/* Product & Logistics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
                <div className="p-3 bg-white rounded-xl border border-[#C5E8BA]">
                  <span className="text-[11px] font-bold text-text-muted uppercase block">Ürün & SKU</span>
                  <span className="font-extrabold text-text text-sm sm:text-base block mt-0.5">
                    {scannedCard.product_name}
                  </span>
                  <span className="text-xs font-mono text-text-muted mt-0.5 block">
                    {scannedCard.product_sku}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#C5E8BA]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-text-muted uppercase block">Parti / Lot & Emir</span>
                    {scannedCard.lot_status && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        scannedCard.lot_status === 'Serbest'
                          ? 'bg-success-soft text-success border border-success-border'
                          : scannedCard.lot_status === 'Karantina'
                          ? 'bg-warning-soft text-warning border border-warning-border'
                          : 'bg-danger-soft text-danger border border-danger-border'
                      }`}>
                        {scannedCard.status_label || scannedCard.lot_status}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-extrabold text-text text-sm sm:text-base block mt-0.5">
                    {scannedCard.lot_number}
                  </span>
                  <span className="text-xs text-text-muted mt-0.5 block font-mono">
                    Emir No: {scannedCard.production_order_number || 'N/A'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#C5E8BA] sm:col-span-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-[11px] font-bold text-text-muted uppercase block">Müşteri / Cari Hesap</span>
                      <span className="font-bold text-text block mt-0.5">{scannedCard.customer_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-text-muted uppercase block">Depo & Bölge / Raf</span>
                      <div className="flex items-center gap-1.5 justify-end mt-0.5">
                        <span className="font-semibold text-text text-xs">{scannedCard.warehouse}</span>
                        {(scannedCard.bin_code || scannedCard.zone_name) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#F0FAEC] border border-[#C5E8BA] text-[#166534]">
                            <MapPin className="w-3 h-3 text-[#4CAC30]" />
                            {scannedCard.zone_name ? `${scannedCard.zone_name} / ${scannedCard.bin_code || 'Raf Yok'}` : scannedCard.bin_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hazardous Material, GHS & SDS Section */}
                {(scannedCard.ghs_pictograms || scannedCard.signal_word || scannedCard.sds_file_url || scannedCard.storage_class) && (
                  <div className="p-3.5 bg-white rounded-xl border border-[#C5E8BA] sm:col-span-2 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-text-muted uppercase">Tehlike & Depolama:</span>
                        {scannedCard.storage_class && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary-soft text-primary border border-primary-border">
                            {scannedCard.storage_class}
                          </span>
                        )}
                        {scannedCard.signal_word && scannedCard.signal_word !== 'Yok' && (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              scannedCard.signal_word === 'Tehlike'
                                ? 'bg-danger text-white'
                                : 'bg-warning text-text'
                            }`}
                          >
                            {scannedCard.signal_word}
                          </span>
                        )}
                        {scannedCard.cas_number && (
                          <span className="text-[11px] font-mono text-text-muted">
                            CAS: <strong className="text-text">{scannedCard.cas_number}</strong>
                          </span>
                        )}
                        {scannedCard.un_number && (
                          <span className="text-[11px] font-mono text-text-muted">
                            UN: <strong className="text-text">{scannedCard.un_number}</strong>
                          </span>
                        )}
                      </div>

                      {scannedCard.sds_file_url && (
                        <a
                          href={scannedCard.sds_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:bg-bg text-primary font-bold text-xs transition shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>GBF Aç (PDF)</span>
                        </a>
                      )}
                    </div>

                    {scannedCard.ghs_pictograms && (
                      <div className="pt-0.5">
                        <GhsPictogramGroup
                          pictogramKeys={(() => {
                            try {
                              return JSON.parse(scannedCard.ghs_pictograms);
                            } catch {
                              return [];
                            }
                          })()}
                          size="sm"
                          showLabels={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quality & Safety Warning Callout */}
              {scannedCard.warning && (
                <div className="p-4 rounded-xl bg-danger-soft border-2 border-danger-border flex items-start gap-3 text-left">
                  <AlertTriangle className="w-6 h-6 text-danger shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-danger-text uppercase tracking-wide">
                      UYARI: Kalite Engeli
                    </h4>
                    <p className="text-xs sm:text-sm font-bold text-danger-text/90 mt-0.5">
                      {scannedCard.warning}
                    </p>
                    <p className="text-[11px] text-danger-text/70 mt-1">
                      Bu lotun Kalite Kontrol birimi tarafından serbest bırakılması gerekmektedir. Üretim, paketleme veya sevkiyata aktarılamaz.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleReceiveAction}
                  disabled={actionLoading !== null || scannedCard.can_receive === false}
                  className="min-h-[52px] py-3.5 px-5 rounded-xl font-black text-sm sm:text-base bg-[#4CAC30] text-white hover:bg-[#439c2a] transition shadow-xs flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
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
                  disabled={actionLoading !== null || scannedCard.can_dispatch === false}
                  className="min-h-[52px] py-3.5 px-5 rounded-xl font-black text-sm sm:text-base bg-[#302480] text-white hover:bg-[#1E1654] transition shadow-xs flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
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
          ) : (
            /* ================= BIG RED CARD (NOT FOUND) ================= */
            <div className="bg-danger-soft border-2 border-danger-border rounded-2xl p-6 shadow-md text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-danger text-white flex items-center justify-center mx-auto shadow-sm">
                <XCircle className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-black text-danger-text">
                  Kayıt Bulunamadı
                </h3>
                <p className="text-xs sm:text-sm text-danger-text/90 mt-1 max-w-md mx-auto">
                  Okutulan barkod veritabanında aktif bir palet, koli veya hammadde lot kaydı ile eşleşmedi.
                </p>
                <div className="mt-3 inline-block px-4 py-2 rounded-xl bg-white border border-danger-border font-mono text-base font-black text-danger tracking-wider">
                  {scannedCard.barcode_string}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setScannedCard(null);
                    setFeedback(null);
                    focusManualInput();
                  }}
                  className="min-h-[46px] px-6 rounded-xl bg-danger text-white font-bold text-sm hover:bg-danger-hover transition active:scale-[0.98]"
                >
                  Yeni Barkod Oku
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity Log */}
      {recentScans.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4CAC30]" />
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
                  <span className="text-[10px] font-bold text-[#302480]">{item.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
