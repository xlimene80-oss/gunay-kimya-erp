import React, { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { FlaskConical, Lock, Mail, AlertCircle, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic frontend validation
    if (!email.trim() || !password) {
      setErrorMessage('Lütfen tüm zorunlu alanları doldurunuz.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      // Navigation will be automatically triggered or handled by router state
    } catch (err: any) {
      if (err.response) {
        if (err.response.status === 401) {
          setErrorMessage('Hatalı şifre veya e-posta adresi girdiniz.');
        } else if (err.response.status === 403) {
          setErrorMessage('Hesabınız aktif değildir. Lütfen fabrika yöneticisi ile iletişime geçiniz.');
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

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface border border-border text-primary mb-4">
          <FlaskConical className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-text tracking-tight">
          GÜNAY KİMYA
        </h2>
        <p className="mt-1 text-xs text-text-muted font-medium tracking-wide uppercase">
          Endüstriyel ERP & B2B Portalı
        </p>
      </div>

      {/* Card Form */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-surface py-8 px-6 sm:px-10 rounded-2xl border border-border">
          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 mb-6 text-xs text-text-muted bg-bg py-1.5 px-3 rounded-full border border-border w-fit mx-auto">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>256-Bit SSL Şifreli Güvenli Giriş</span>
          </div>

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="mb-6 rounded-xl bg-danger-soft border border-danger-border p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div className="text-sm text-danger-text">{errorMessage}</div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                Kurumsal E-Posta
              </label>
              <div className="relative rounded-xl">
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
                  placeholder="bayi@gunaykimya.net"
                  className="block w-full pl-11 pr-4 py-2.5 bg-bg border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:border-primary text-sm transition-colors duration-150"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Şifre
                </label>
                <a
                  href="#contact-admin"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Şifre sıfırlama işlemi için lütfen Günay Kimya fabrika muhasebe veya sistem yöneticisi ile iletişime geçiniz.');
                  }}
                  className="text-xs text-text-muted hover:text-text font-medium transition-colors"
                >
                  Şifremi Unuttum?
                </a>
              </div>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-4 py-2.5 bg-bg border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:border-primary text-sm transition-colors duration-150"
                />
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded bg-bg border-border text-primary focus:ring-primary"
                />
                <span className="text-xs text-text-muted">Beni bu cihazda hatırla</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-primary rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-hover focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Kimlik Doğrulanıyor...</span>
                </>
              ) : (
                <>
                  <span>Giriş Yap</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-5 pt-4 border-t border-border">
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-2 text-center">
              Hızlı Giriş Seçenekleri:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@gunaykimya.net');
                  setPassword('Admin123!');
                }}
                className="p-2 rounded-lg bg-bg hover:bg-surface text-text border border-border text-center transition-colors truncate"
              >
                Yönetici (Admin)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('bayi@gunaykimya.net');
                  setPassword('Bayi123!');
                }}
                className="p-2 rounded-lg bg-bg hover:bg-surface text-text border border-border text-center transition-colors truncate"
              >
                B2B Bayi
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('depo@gunaykimya.net');
                  setPassword('Depo123!');
                }}
                className="p-2 rounded-lg bg-bg hover:bg-surface text-text border border-border text-center transition-colors truncate"
              >
                Depo Sorumlusu
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('muhasebe@gunaykimya.net');
                  setPassword('Muhasebe123!');
                }}
                className="p-2 rounded-lg bg-bg hover:bg-surface text-text border border-border text-center transition-colors truncate"
              >
                Muhasebe
              </button>
            </div>
          </div>

          {/* Footer Assistance */}
          <div className="mt-8 pt-6 border-t border-border text-center text-xs text-text-muted">
            <p>
              Günay Kimya San. ve Tic. A.Ş. &copy; {new Date().getFullYear()}
            </p>
            <p className="mt-1 text-text-muted">
              Endüstriyel & Kimyasal Üretim ERP Entegrasyonu
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
