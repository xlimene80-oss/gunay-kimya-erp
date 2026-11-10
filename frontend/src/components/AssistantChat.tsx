import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Send,
  Sparkles,
  X,
  User as UserIcon,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type ChatMessage = {
  role: 'assistant' | 'user';
  text: string;
  timestamp?: string;
};

export const AssistantChat: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Mascot Animation States
  const [speechText, setSpeechText] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const isB2B = user?.role === 'customer' || (user?.role as string) === 'CUSTOMER';
  const roleTitle = user?.department_name || (isB2B ? 'B2B Bayi Yetkilisi' : (user?.role === 'admin' ? 'Sistem Yöneticisi' : 'ERP Kullanıcısı'));
  const userGreetingName = user?.full_name ? `${user.full_name} (${roleTitle})` : roleTitle;

  const getInitialGreeting = (): string => {
    return `Merhaba ${userGreetingName}, Günay Kimya ERP Yapay Zeka Asistanı'na hoş geldiniz. Fabrikamızdaki süreçleri kolaylaştırmak için buradayım. Bugün hangi departmanın iş akışını, stok durumunu veya üretim emirlerini denetlemek istersiniz?`;
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setMessages([]);
      return;
    }
    setMessages([
      {
        role: 'assistant',
        text: getInitialGreeting(),
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (open) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, open, sending]);

  // Form detection: Suppress speech bubbles when user is actively typing in any input/textarea
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
        setIsTyping(true);
        setSpeechText(null);
      }
    };
    const handleFocusOut = () => {
      setIsTyping(false);
    };
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Periodic Speech Bubble Interval (every 10-15 seconds)
  useEffect(() => {
    if (open || isTyping) {
      setSpeechText(null);
      return;
    }

    const speechPool = [
      'Yardım lazım mı? 👋',
      'Stoğa bakalım mı?',
      'Sipariş durumunu sorabilirsin!'
    ];

    let hideTimeout: any = null;

    const interval = setInterval(() => {
      if (document.hidden || open) return;
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const randomMsg = speechPool[Math.floor(Math.random() * speechPool.length)];
      setSpeechText(randomMsg);

      hideTimeout = setTimeout(() => {
        setSpeechText(null);
      }, 4000);
    }, 12000);

    return () => {
      clearInterval(interval);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [open, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const question = (textToSend || input).trim();
    if (!question || sending) return;

    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      { role: 'user', text: question, timestamp: timeStr }
    ]);
    if (!textToSend) setInput('');
    setSending(true);

    try {
      const res = await axios.post('/api/ai/chat', { message: question });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.data.answer || 'Bilgi bulunamadı.',
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || 'Asistana şu anda bağlanılamıyor. Lütfen tekrar deneyiniz.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: errMsg,
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: 'assistant',
        text: getInitialGreeting(),
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Quick 2-Column Question Cards
  // Şirket içi: "Bekleyen siparişler", "Azalan hammaddeler", "SKT'si yaklaşan partiler", "Üretim emirleri"
  // B2B bayisi SADECE: "Siparişlerim", "Sevkiyat durumum", "Cari ekstrem"
  const quickQuestionCards = isB2B
    ? [
        { label: 'Siparişlerim', query: 'Siparişlerim' },
        { label: 'Sevkiyat durumum', query: 'Sevkiyat durumum' },
        { label: 'Cari ekstrem', query: 'Cari ekstrem' }
      ]
    : [
        { label: 'Bekleyen siparişler', query: 'Bekleyen siparişler' },
        { label: 'Azalan hammaddeler', query: 'Azalan hammaddeler' },
        { label: 'SKT\'si yaklaşan partiler', query: 'SKT\'si yaklaşan partiler' },
        { label: 'Üretim emirleri', query: 'Üretim emirleri' }
      ];

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Self-contained Keyframe Animations */}
      <style>{`
        @keyframes robot-float-gentle {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-4px) rotate(1deg);
          }
          50% {
            transform: translateY(-7px) rotate(-0.8deg);
          }
          75% {
            transform: translateY(-2px) rotate(0.8deg);
          }
        }

        @keyframes robot-shadow-scale {
          0%, 100% {
            transform: translateX(-50%) scale(1);
            opacity: 0.35;
          }
          50% {
            transform: translateX(-50%) scale(0.8);
            opacity: 0.18;
          }
        }

        @keyframes robot-loop-flight {
          0%, 100% {
            transform: translate(0px, 0px) rotate(0deg);
          }
          25% {
            transform: translate(-3px, -5px) rotate(-1.5deg);
          }
          50% {
            transform: translate(-5px, 2px) rotate(1deg);
          }
          75% {
            transform: translate(2px, -3px) rotate(-0.5deg);
          }
        }

        @keyframes robot-excited-wiggle {
          0%, 100% {
            transform: translateY(-5px) scale(1.08) rotate(0deg);
          }
          20% {
            transform: translateY(-7px) scale(1.12) rotate(-6deg);
          }
          40% {
            transform: translateY(-4px) scale(1.12) rotate(6deg);
          }
          60% {
            transform: translateY(-7px) scale(1.12) rotate(-4deg);
          }
          80% {
            transform: translateY(-5px) scale(1.1) rotate(3deg);
          }
        }

        .robot-floating-launcher {
          animation: robot-float-gentle 4s ease-in-out infinite, robot-loop-flight 16s ease-in-out infinite;
        }

        .robot-floating-launcher:hover, .robot-hover-wiggle {
          animation: robot-excited-wiggle 0.75s ease-in-out infinite !important;
        }

        .robot-shadow-breathe {
          animation: robot-shadow-scale 4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .robot-floating-launcher, .robot-shadow-breathe, .robot-hover-wiggle {
            animation: none !important;
          }
          .robot-floating-launcher {
            animation: robot-float-gentle 6s ease-in-out infinite !important;
          }
        }
      `}</style>

      <div className="fixed bottom-6 right-6 z-[75] no-print select-none">
        {/* Chat Window */}
        {open && (
          <section
            aria-label="Günay Kimya Sanal Asistanı"
            className="mb-3 flex h-[570px] w-[395px] max-w-[94vw] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl transition-all duration-200"
          >
            {/* Header with robot-wave-512.png and Title */}
            <header className="relative bg-gradient-to-r from-indigo-800 via-indigo-700 to-primary px-4 py-3.5 text-white shadow-lg overflow-hidden">
              {/* Subtle ambient light */}
              <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-cyan-400/20 blur-2xl pointer-events-none" />

              <div className="relative flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <img
                      src="/assistant/robot-wave-512.png"
                      alt="Günay Kimya Robot Asistanı"
                      className="w-12 h-12 rounded-2xl object-contain bg-white/10 p-1 backdrop-blur-md border border-white/25 shadow-md"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white" />
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                      <span>Size nasıl yardımcı olabilirim?</span>
                    </h3>
                    <p className="text-[11px] text-indigo-100/80 font-medium">
                      Günay Kimya Asistanı • {roleTitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleResetChat}
                    className="rounded-xl p-2 text-white/80 hover:bg-white/20 hover:text-white transition"
                    title="Sohbeti Temizle"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl p-2 text-white/80 hover:bg-white/20 hover:text-white transition"
                    title="Kapat"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </header>

            {/* Messages Body */}
            <div
              ref={listRef}
              className="flex-1 space-y-3.5 overflow-y-auto p-4 bg-bg/50 text-xs"
            >
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-white shrink-0 border border-indigo-200 dark:border-indigo-800 shadow-sm mt-0.5 p-0.5">
                      <img
                        src="/assistant/robot-wave-256.png"
                        alt="Asistan Robot Avatarı"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-primary text-white font-medium rounded-tr-none'
                        : 'bg-surface text-text border border-border rounded-tl-none font-normal'
                    }`}
                  >
                    <div className="break-words">{m.text}</div>
                    {m.timestamp && (
                      <div
                        className={`text-[9.5px] mt-1 text-right ${
                          m.role === 'user' ? 'text-white/70' : 'text-text-muted'
                        }`}
                      >
                        {m.timestamp}
                      </div>
                    )}
                  </div>

                  {m.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon size={14} />
                    </div>
                  )}
                </div>
              ))}

              {/* Three Dots Typing Animation */}
              {sending && (
                <div className="flex gap-2.5 items-end justify-start">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-white shrink-0 border border-indigo-200 dark:border-indigo-800 shadow-sm p-0.5">
                    <img
                      src="/assistant/robot-wave-256.png"
                      alt="Asistan Robot Avatarı"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="rounded-2xl px-4 py-3 bg-surface text-text border border-border rounded-tl-none font-normal shadow-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '180ms' }} />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '360ms' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Question Cards (2 Columns) */}
            <div className="p-3 bg-surface border-t border-border">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2 px-0.5">
                Hızlı Sorular
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickQuestionCards.map((card, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={sending}
                    onClick={() => handleSendMessage(card.query)}
                    className="flex items-center gap-2 p-2 rounded-xl border border-border bg-bg/70 hover:bg-primary-soft/60 hover:border-primary/40 text-left text-xs font-semibold text-text hover:text-primary transition shadow-sm active:scale-95 group"
                  >
                    <Sparkles size={13} className="text-primary/70 group-hover:text-primary shrink-0 transition" />
                    <span className="truncate">{card.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 border-t border-border p-3 bg-surface"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Soru yazınız (örn: Bekleyen siparişlerim)..."
                disabled={sending}
                className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-xs text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary/90 disabled:opacity-40 shadow-sm shrink-0"
                title="Gönder"
              >
                <Send size={15} />
              </button>
            </form>
          </section>
        )}

        {/* Floating Robot Mascot Launcher (When Chat Closed) */}
        {!open && (
          <div className="relative flex flex-col items-end">
            {/* Speech Bubble (every 10-15s, suppressed when typing or chat open) */}
            {speechText && (
              <div
                onClick={() => setOpen(true)}
                className="mb-2.5 max-w-[240px] cursor-pointer rounded-2xl bg-surface/95 px-3.5 py-2 text-xs font-bold text-text shadow-xl border border-indigo-500/30 backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 animate-fade-in"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-indigo-500 shrink-0 animate-pulse" />
                  <span className="leading-tight">{speechText}</span>
                </div>
                {/* Speech Bubble Arrow pointing to the robot */}
                <div className="absolute -bottom-1.5 right-7 h-3 w-3 rotate-45 border-b border-r border-indigo-500/30 bg-surface/95" />
              </div>
            )}

            {/* Mascot Button using robot-wave-128.png */}
            <div className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => setOpen(true)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="group relative flex items-center justify-center focus:outline-none transition-transform duration-200"
                title="Günay Kimya Sanal Asistanı (Sohbeti Başlat)"
                aria-label="Günay Kimya Sanal Asistanı"
              >
                {/* Soft Radial Ambient Glow */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/25 to-indigo-500/35 blur-md group-hover:scale-125 transition-transform duration-300" />

                {/* Animated Robot Image (robot-wave-128.png) */}
                <div className={`relative transition-transform duration-200 ${isHovered ? 'robot-hover-wiggle' : 'robot-floating-launcher'}`}>
                  <img
                    src="/assistant/robot-wave-128.png"
                    alt="Günay Kimya Sanal Asistan Robotu"
                    className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-xl select-none"
                    draggable={false}
                  />
                </div>

                {/* Online Indicator Badge */}
                <span className="absolute bottom-1 right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </span>
              </button>

              {/* Breathing Glow/Shadow Underneath Robot */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-2.5 bg-indigo-500/30 rounded-full blur-sm robot-shadow-breathe pointer-events-none" />
            </div>
          </div>
        )}

        {/* Minimized Close Floating Button (When Chat Open) */}
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-surface border border-border text-text-muted hover:text-text hover:bg-bg shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            title="Asistanı Kapat"
            aria-label="Asistanı Kapat"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </>
  );
};
