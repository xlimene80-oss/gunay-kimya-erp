import React, { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  ShoppingBag,
  Package,
  Wallet,
  Info,
  Check
} from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);
  const [showForgotNotice, setShowForgotNotice] = useState<boolean>(false);

  // Check demo mode environment variable (defaults to true if undefined)
  const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false';

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => {
      setShake(false);
    }, 600);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Lütfen e-posta adresinizi ve şifrenizi giriniz.');
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      triggerShake();
      if (err.response) {
        if (err.response.status === 401) {
          setErrorMessage('E-posta veya şifre hatalı');
        } else if (err.response.status === 403) {
          setErrorMessage('Hesabınız aktif değildir. Lütfen sistem yöneticinizle iletişime geçiniz.');
        } else if (err.response.data?.detail) {
          setErrorMessage(err.response.data.detail);
        } else {
          setErrorMessage('Giriş başarısız. Lütfen bilgilerinizi kontrol ediniz.');
        }
      } else {
        setErrorMessage('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol ediniz.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-full max-w-full bg-bg flex flex-col lg:flex-row relative overflow-x-hidden selection:bg-[#302480] selection:text-white">
      {/* Top Accent Line for Mobile */}
      <div className="lg:hidden h-1.5 w-full bg-[#302480] fixed top-0 left-0 z-50" />

      {/* =========================================================================
          LEFT BRANDING PANEL (>= 1024px)
          Explicit login-brand-panel gradient with min-h-screen
          ========================================================================= */}
      <aside
        aria-label="Günay Kimya Tanıtım Paneli"
        className="hidden lg:flex lg:w-[45%] xl:w-[42%] login-brand-panel min-h-screen text-white relative flex-col justify-between p-10 xl:p-14 select-none shrink-0 overflow-hidden"
      >
        {/* Subtle Molecular & Geometric Background Pattern */}
        <svg
          className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 600 900"
          fill="none"
          aria-hidden="true"
        >
          <g stroke="white" strokeWidth="1.5">
            {/* Hexagon 1 */}
            <path d="M120 160 L180 125 L240 160 L240 230 L180 265 L120 230 Z" />
            <path d="M180 125 L180 60" />
            <path d="M240 230 L300 265" />
            {/* Hexagon 2 */}
            <path d="M300 360 L360 325 L420 360 L420 430 L360 465 L300 430 Z" strokeDasharray="3 3" />
            <path d="M420 360 L480 325" />
            {/* Hexagon 3 */}
            <path d="M150 560 L210 525 L270 560 L270 630 L210 665 L150 630 Z" />
            <path d="M210 665 L210 740" />
            {/* Hexagon 4 */}
            <path d="M360 680 L420 645 L480 680 L480 750 L420 785 L360 750 Z" />
          </g>
          {/* Accent Nodes */}
          <circle cx="180" cy="125" r="5" fill="#4CAC30" />
          <circle cx="240" cy="230" r="4" fill="white" />
          <circle cx="120" cy="160" r="4" fill="white" />
          <circle cx="360" cy="325" r="5" fill="#4CAC30" />
          <circle cx="420" cy="430" r="4" fill="white" />
          <circle cx="210" cy="525" r="5" fill="#4CAC30" />
          <circle cx="270" cy="630" r="4" fill="white" />
          <circle cx="420" cy="645" r="5" fill="#4CAC30" />
        </svg>

        {/* Top: Logo in clean rounded white card for contrast */}
        <div className="relative z-10">
          <div className="bg-white rounded-2xl p-3.5 px-5 shadow-lg shadow-black/10 inline-flex items-center justify-center border border-white/20">
            <img
              src="/logo-gunay.png"
              alt="Günay Kimya"
              className="h-10 w-auto object-contain"
            />
          </div>
        </div>

        {/* Middle: Headline, Description & Trust Bullet Points */}
        <div className="relative z-10 my-auto py-8">
          {/* Tag Pill with high contrast */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs text-white font-medium mb-5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#4CAC30] shrink-0" />
            <span className="text-white tracking-wide">Endüstriyel ERP & B2B Portalı</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-snug">
            Üretimden sevkiyata tek ekran.
          </h1>

          <p className="mt-4 text-base text-white/85 leading-relaxed max-w-md font-normal">
            Sipariş, stok, üretim ve sevkiyat süreçlerinizi tek platformdan, izlenebilir şekilde yönetin.
          </p>

          {/* 3 Trust Bullet Points */}
          <ul className="mt-8 space-y-3.5 max-w-md">
            <li className="flex items-center gap-3 text-sm text-white/95">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#4CAC30]/25 border border-[#4CAC30]/50 text-white shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
              </span>
              <span className="font-medium">Parti ve lot bazlı tam izlenebilirlik</span>
            </li>
            <li className="flex items-center gap-3 text-sm text-white/95">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#4CAC30]/25 border border-[#4CAC30]/50 text-white shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
              </span>
              <span className="font-medium">FEFO ile akıllı stok yönetimi</span>
            </li>
            <li className="flex items-center gap-3 text-sm text-white/95">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#4CAC30]/25 border border-[#4CAC30]/50 text-white shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
              </span>
              <span className="font-medium">e-İrsaliye ile hızlı mal kabul</span>
            </li>
          </ul>
        </div>

        {/* Bottom: Legal Copyright */}
        <div className="relative z-10 pt-4 border-t border-white/15 text-xs text-white/70">
          <p>© 2026 Günay Kimya San. ve Tic. A.Ş.</p>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT AUTH PANEL (Responsive & Mobile View)
          Clean white/surface layout with max-w-[400px] centered container
          ========================================================================= */}
      <main className="w-full max-w-full flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-8 sm:py-10 lg:py-12 bg-white dark:bg-surface min-h-screen">
        <div
          className={`w-full max-w-[380px] transition-transform duration-200 ${
            shake ? 'animate-shake' : ''
          }`}
        >
          {/* Mobile-only Full Logo Header */}
          <div className="lg:hidden text-center mb-6">
            <img
              src="/logo-gunay.png"
              alt="Günay Kimya"
              className="h-10 w-auto mx-auto object-contain"
            />
          </div>

          {/* Form Header (Mark + Welcome Titles) */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F0FAEC] border border-[#C5E8BA] mb-3.5 shadow-sm">
              <img
                src="/logo-mark.png"
                alt="Günay Kimya Mark"
                className="w-10 h-10 object-contain"
              />
            </div>
            <h2 className="text-2xl font-bold text-text tracking-tight">
              Hoş geldiniz
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Hesabınıza giriş yapın
            </p>
          </div>

          {/* Error Alert Box - Strictly rendered ONLY when errorMessage is truthy */}
          {Boolean(errorMessage) && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-danger-soft border border-danger-border p-3.5 flex items-start gap-3 animate-fade-up"
            >
              <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div className="text-sm font-medium text-danger-text">
                {errorMessage}
              </div>
            </div>
          )}

          {/* Forgot Password Inline Info Notice */}
          {Boolean(showForgotNotice) && (
            <div
              role="status"
              className="mb-5 rounded-xl bg-primary-soft border border-primary-border p-3.5 flex items-start gap-3 animate-fade-up"
            >
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-primary-text flex-1">
                Şifre sıfırlama için sistem yöneticinizle iletişime geçin.
              </div>
              <button
                type="button"
                onClick={() => setShowForgotNotice(false)}
                className="text-primary-text/70 hover:text-primary-text text-xs font-semibold ml-2 min-h-[30px] flex items-center"
              >
                Kapat
              </button>
            </div>
          )}

          {/* Login Form */}
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5"
              >
                E-Posta
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ad@sirket.com"
                  className="block w-full min-h-[48px] h-12 pl-11 pr-4 bg-bg border border-border rounded-xl text-text placeholder-text-muted text-sm transition-all duration-150 input-brand-focus"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5"
              >
                Şifre
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full min-h-[48px] h-12 pl-11 pr-11 bg-bg border border-border rounded-xl text-text placeholder-text-muted text-sm transition-all duration-150 input-brand-focus"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-muted hover:text-text focus:outline-none min-h-[44px]"
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px] select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-bg border-border text-[#302480] focus:ring-[#302480]/30 cursor-pointer"
                />
                <span className="text-xs text-text-muted hover:text-text font-medium transition-colors whitespace-nowrap">
                  Beni hatırla
                </span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotNotice(true)}
                className="text-xs text-[#302480] dark:text-[#BFDBFE] hover:underline font-semibold min-h-[44px] flex items-center transition-colors whitespace-nowrap"
              >
                Şifremi unuttum
              </button>
            </div>

            {/* Submit Button - Solid Navy with clear white text */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] h-12 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white btn-brand-primary shadow-sm active:scale-[0.99] transition-all duration-150"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Giriş yapılıyor...</span>
                </>
              ) : (
                <span>Giriş Yap</span>
              )}
            </button>
          </form>

          {/* Footer Security Note (SSL removed) */}
          <div className="mt-5 text-center">
            <p className="text-xs text-text-muted flex items-center justify-center gap-1.5 font-medium">
              <Shield className="w-3.5 h-3.5 text-[#4CAC30]" />
              <span>Güvenli oturum · Verileriniz korunur</span>
            </p>
          </div>

          {/* =====================================================================
              DEMO ACCOUNTS (Conditionally rendered when isDemoMode is true)
              ===================================================================== */}
          {Boolean(isDemoMode) && (
            <div className="mt-7 pt-5 border-t border-border">
              <span className="text-[11px] uppercase font-bold text-text-muted tracking-wider block mb-2.5 text-center">
                Demo hesapları
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Yönetici */}
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@gunaykimya.net', 'Admin123!')}
                  className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 min-h-[44px] rounded-xl bg-bg hover:bg-surface text-text border border-border hover:border-[#302480]/40 transition-colors text-left group"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#EFEFFC] text-[#302480] border border-[#D5D0F5] flex items-center justify-center shrink-0">
                    <Shield className="w-3.5 h-3.5 text-[#302480]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[10px] sm:text-[11px] truncate text-text group-hover:text-[#302480]">
                      Yönetici
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-text-muted truncate">Admin</div>
                  </div>
                </button>

                {/* B2B Bayi */}
                <button
                  type="button"
                  onClick={() => handleQuickFill('bayi@gunaykimya.net', 'Bayi123!')}
                  className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 min-h-[44px] rounded-xl bg-bg hover:bg-surface text-text border border-border hover:border-mod-satis/40 transition-colors text-left group"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-mod-satis-soft text-mod-satis border border-mod-satis-border flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-3.5 h-3.5 text-mod-satis" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[10px] sm:text-[11px] truncate text-text group-hover:text-mod-satis">
                      B2B Bayi
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-text-muted truncate">Müşteri</div>
                  </div>
                </button>

                {/* Depo Sorumlusu */}
                <button
                  type="button"
                  onClick={() => handleQuickFill('depo@gunaykimya.net', 'Depo123!')}
                  className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 min-h-[44px] rounded-xl bg-bg hover:bg-surface text-text border border-border hover:border-mod-stok/40 transition-colors text-left group"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-mod-stok-soft text-mod-stok border border-mod-stok-border flex items-center justify-center shrink-0">
                    <Package className="w-3.5 h-3.5 text-mod-stok" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[10px] sm:text-[11px] truncate text-text group-hover:text-mod-stok">
                      Depo Sorumlusu
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-text-muted truncate">Lojistik</div>
                  </div>
                </button>

                {/* Muhasebe */}
                <button
                  type="button"
                  onClick={() => handleQuickFill('muhasebe@gunaykimya.net', 'Muhasebe123!')}
                  className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 min-h-[44px] rounded-xl bg-bg hover:bg-surface text-text border border-border hover:border-mod-finans/40 transition-colors text-left group"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-mod-finans-soft text-mod-finans border border-mod-finans-border flex items-center justify-center shrink-0">
                    <Wallet className="w-3.5 h-3.5 text-mod-finans" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[10px] sm:text-[11px] truncate text-text group-hover:text-mod-finans">
                      Muhasebe
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-text-muted truncate">Finans</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
