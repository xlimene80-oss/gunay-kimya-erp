import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Send,
  Sparkles,
  X,
  Bot,
  User as UserIcon,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type ChatMessage = {
  role: 'assistant' | 'user';
  text: string;
  timestamp?: string;
};

// --------------------------------------------------------------------------
// Animated Robot Mascot Component (Lightweight SVG with Pure CSS Keyframes)
// --------------------------------------------------------------------------
interface RobotMascotProps {
  size?: number;
  compact?: boolean;
  isHovered?: boolean;
}

const RobotMascot: React.FC<RobotMascotProps> = ({ size = 64, compact = false }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-lg select-none"
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="robotBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="45%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>

        <linearGradient id="robotFaceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>

        <linearGradient id="robotAccentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>

        {/* Glow Filters */}
        <filter id="eyeGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <filter id="beaconGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <filter id="thrusterGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Thruster Jet Light (bottom hover engine glow) */}
      {!compact && (
        <ellipse
          cx="50"
          cy="92"
          rx="14"
          ry="3.5"
          fill="#06b6d4"
          opacity="0.75"
          filter="url(#thrusterGlow)"
          className="robot-beacon-pulse"
        />
      )}

      {/* Robot Antenna Rod */}
      <line
        x1="50"
        y1="24"
        x2="50"
        y2="10"
        stroke="#818cf8"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Antenna Beacon Light (Flashing Crimson / Amber) */}
      <circle
        cx="50"
        cy="9"
        r="4.5"
        fill="#f43f5e"
        filter="url(#beaconGlow)"
        className="robot-beacon-flash"
      />
      <circle cx="50" cy="9" r="2" fill="#fff" opacity="0.9" />

      {/* Left Ear / Audio Pod */}
      <rect
        x="18"
        y="32"
        width="6"
        height="18"
        rx="3"
        fill="#312e81"
        stroke="#818cf8"
        strokeWidth="1.5"
      />
      <circle cx="21" cy="41" r="2" fill="#06b6d4" />

      {/* Right Ear / Audio Pod */}
      <rect
        x="76"
        y="32"
        width="6"
        height="18"
        rx="3"
        fill="#312e81"
        stroke="#818cf8"
        strokeWidth="1.5"
      />
      <circle cx="79" cy="41" r="2" fill="#06b6d4" />

      {/* Head Outer Shell */}
      <rect
        x="22"
        y="21"
        width="56"
        height="40"
        rx="14"
        fill="url(#robotBodyGrad)"
        stroke="#c7d2fe"
        strokeWidth="1.5"
      />

      {/* Head Top Highlight Sheen */}
      <path
        d="M 30 24 Q 50 20 70 24"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* Visor / Face Glass Screen */}
      <rect
        x="28"
        y="27"
        width="44"
        height="28"
        rx="8"
        fill="url(#robotFaceGrad)"
        stroke="#4338ca"
        strokeWidth="1"
      />

      {/* Eyes Group (Glowing Turquoise with CSS Blinking Animation) */}
      <g className="robot-eyes-blink" style={{ transformOrigin: '50px 40px' }}>
        {/* Left Eye */}
        <rect
          x="34"
          y="35"
          width="10"
          height="10"
          rx="5"
          fill="#22d3ee"
          filter="url(#eyeGlow)"
        />
        <circle cx="37" cy="37.5" r="1.5" fill="#ffffff" />

        {/* Right Eye */}
        <rect
          x="56"
          y="35"
          width="10"
          height="10"
          rx="5"
          fill="#22d3ee"
          filter="url(#eyeGlow)"
        />
        <circle cx="59" cy="37.5" r="1.5" fill="#ffffff" />
      </g>

      {/* Smiling Mouth / LED Soundwave Dots */}
      <path
        d="M 43 49 Q 50 54 57 49"
        stroke="#06b6d4"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />

      {!compact && (
        <>
          {/* Neck Joint */}
          <rect x="44" y="61" width="12" height="5" rx="2" fill="#4338ca" />

          {/* Left Arm (Relaxed) */}
          <rect
            x="17"
            y="66"
            width="8"
            height="16"
            rx="4"
            fill="#4f46e5"
            stroke="#818cf8"
            strokeWidth="1"
            transform="rotate(10 17 66)"
          />

          {/* Right Arm (Waving Hand with animation) */}
          <g className="robot-arm-wave" style={{ transformOrigin: '76px 66px' }}>
            <rect
              x="75"
              y="65"
              width="8"
              height="18"
              rx="4"
              fill="#4f46e5"
              stroke="#818cf8"
              strokeWidth="1"
            />
            {/* Cute hand */}
            <circle cx="79" cy="84" r="4.5" fill="#818cf8" />
          </g>

          {/* Body Torso */}
          <rect
            x="27"
            y="65"
            width="46"
            height="23"
            rx="9"
            fill="url(#robotBodyGrad)"
            stroke="#a5b4fc"
            strokeWidth="1.2"
          />

          {/* Chest Power Core / Reactor (Cyan Glowing Core) */}
          <circle
            cx="50"
            cy="76"
            r="5"
            fill="#06b6d4"
            filter="url(#eyeGlow)"
            className="robot-beacon-pulse"
          />
          <circle cx="50" cy="76" r="2" fill="#ffffff" />
        </>
      )}
    </svg>
  );
};

// --------------------------------------------------------------------------
// Main AssistantChat Component
// --------------------------------------------------------------------------
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
    return `Merhaba ${userGreetingName}, Günay Kimya ERP Asistanı'na hoş geldiniz. Bugün stok, sipariş veya üretim konusunda nasıl yardımcı olabilirim?`;
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
  }, [messages, open]);

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

  // Periodic Speech Bubble Interval (every 12-16 seconds)
  useEffect(() => {
    if (open || isTyping) {
      setSpeechText(null);
      return;
    }

    const speechPool = isB2B
      ? [
          'Yardım lazım mı? 👋',
          'Sipariş durumunu sorabilirsin! 📦',
          'Cari bakiyene bakalım mı? 💳',
          'Sevkiyat takibi burada! 🚚',
          'Sana özel tekliflere bakalım mı? ✨'
        ]
      : [
          'Yardım lazım mı? 👋',
          'Stoğa bakalım mı? 📦',
          'Sipariş durumunu sorabilirsin! 🚀',
          'SKT\'si yaklaşan partileri sor! ⏳',
          'Hangi hammadde azaldı bakalım mı? 🧪',
          'Acil iş emirleri için buradayım! ⚙️'
        ];

    let hideTimeout: any = null;

    const interval = setInterval(() => {
      // Don't show if window is hidden, chat is open, or user is focused on an input
      if (document.hidden || open) return;
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const randomMsg = speechPool[Math.floor(Math.random() * speechPool.length)];
      setSpeechText(randomMsg);

      hideTimeout = setTimeout(() => {
        setSpeechText(null);
      }, 4200);
    }, 14000);

    return () => {
      clearInterval(interval);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [open, isTyping, isB2B]);

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

  // Quick prompt chips based on role
  const quickPrompts = isB2B
    ? [
        'Bekleyen siparişlerim',
        'Sipariş durumum',
        'Cari bakiyem / Borcum',
        'Sevkiyat durumum',
        'Bana özel teklifler'
      ]
    : [
        'Bekleyen siparişlerim',
        'Hangi hammadde azaldı?',
        'SKT\'si yaklaşan partiler',
        'Sipariş durumum',
        'Acil üretim emirleri'
      ];

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Self-contained Mascot CSS Keyframe Animations */}
      <style>{`
        @keyframes robot-float-gentle {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-4px) rotate(1.2deg);
          }
          50% {
            transform: translateY(-7px) rotate(-0.8deg);
          }
          75% {
            transform: translateY(-2px) rotate(0.8deg);
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

        @keyframes robot-blink-anim {
          0%, 90%, 100% {
            transform: scaleY(1);
          }
          95% {
            transform: scaleY(0.12);
          }
        }

        @keyframes robot-wave-anim {
          0%, 72%, 100% {
            transform: rotate(0deg);
          }
          76% {
            transform: rotate(-22deg);
          }
          80% {
            transform: rotate(12deg);
          }
          84% {
            transform: rotate(-18deg);
          }
          88% {
            transform: rotate(8deg);
          }
        }

        @keyframes robot-beacon-flash-anim {
          0%, 100% {
            opacity: 0.5;
            transform: scale(0.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.35);
          }
        }

        @keyframes robot-pulse-glow {
          0%, 100% {
            opacity: 0.6;
            transform: scale(0.95);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        @keyframes robot-excited-wiggle {
          0%, 100% {
            transform: translateY(-5px) scale(1.08) rotate(0deg);
          }
          20% {
            transform: translateY(-7px) scale(1.12) rotate(-7deg);
          }
          40% {
            transform: translateY(-4px) scale(1.12) rotate(7deg);
          }
          60% {
            transform: translateY(-7px) scale(1.12) rotate(-5deg);
          }
          80% {
            transform: translateY(-5px) scale(1.1) rotate(4deg);
          }
        }

        .robot-floating {
          animation: robot-float-gentle 4s ease-in-out infinite, robot-loop-flight 16s ease-in-out infinite;
        }

        .robot-floating:hover, .robot-wiggle {
          animation: robot-excited-wiggle 0.75s ease-in-out infinite !important;
        }

        .robot-eyes-blink {
          animation: robot-blink-anim 4.5s ease-in-out infinite;
        }

        .robot-arm-wave {
          animation: robot-wave-anim 5.5s ease-in-out infinite;
        }

        .robot-beacon-flash {
          animation: robot-beacon-flash-anim 1.8s ease-in-out infinite;
          transform-origin: 50px 9px;
        }

        .robot-beacon-pulse {
          animation: robot-pulse-glow 2.4s ease-in-out infinite;
          transform-origin: 50px 76px;
        }

        @media (prefers-reduced-motion: reduce) {
          .robot-floating, .robot-wiggle, .robot-eyes-blink, .robot-arm-wave, .robot-beacon-flash, .robot-beacon-pulse {
            animation: none !important;
          }
        }
      `}</style>

      <div className="fixed bottom-6 right-6 z-[75] no-print select-none">
        {/* Chat Window */}
        {open && (
          <section
            aria-label="Günay Kimya Sanal Asistanı"
            className="mb-3 flex h-[540px] w-[390px] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl transition-all duration-200"
          >
            {/* Header with Docked Compact Robot Mascot */}
            <header className="flex items-center justify-between bg-gradient-to-r from-indigo-700 via-indigo-600 to-primary px-4 py-3 text-white shadow-md">
              <div className="flex items-center gap-2.5">
                {/* Robot sits happily in the header when chat is open */}
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md shadow-inner ring-1 ring-white/30">
                  <RobotMascot size={34} compact={true} />
                </div>
                <div>
                  <div className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                    <span>Günay Kimya Asistanı</span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-semibold">
                      {isB2B ? 'B2B' : 'ERP'}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/80 font-medium">
                    {roleTitle}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleResetChat}
                  className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition"
                  title="Sohbeti Temizle"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition"
                  title="Kapat"
                >
                  <X size={18} />
                </button>
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
                    <div className="w-7 h-7 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0 border border-primary-border mt-0.5">
                      <Bot size={15} />
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
                    <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon size={14} />
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="flex gap-2 items-center text-primary font-medium text-xs py-1">
                  <Loader2 size={15} className="animate-spin" />
                  <span>ERP canlı verileri sorgulanıyor...</span>
                </div>
              )}
            </div>

            {/* Quick Suggestions Chips */}
            <div className="px-3.5 py-2 border-t border-border bg-surface flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {quickPrompts.map((promptText, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={sending}
                  onClick={() => handleSendMessage(promptText)}
                  className="shrink-0 text-[11px] font-semibold text-primary bg-primary-soft/60 hover:bg-primary-soft border border-primary-border px-2.5 py-1 rounded-full transition"
                >
                  {promptText}
                </button>
              ))}
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
                className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
              >
              </input>
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

        {/* Floating Interactive Robot Mascot Launcher (When Chat Closed) */}
        {!open && (
          <div className="relative flex flex-col items-end">
            {/* Speech Bubble (pops up every 12-16s, suppressed when typing or chat open) */}
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
                <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-indigo-500/30 bg-surface/95" />
              </div>
            )}

            {/* Mascot Button */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="group relative flex items-center justify-center p-1 focus:outline-none transition-transform duration-200"
              title="Günay Kimya Sanal Asistanı (Sohbeti Başlat)"
              aria-label="Günay Kimya Sanal Asistanı"
            >
              {/* Soft Radial Ambient Glow */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/30 to-indigo-500/40 blur-md group-hover:scale-125 transition-transform duration-300" />

              {/* The Robot Character */}
              <div className={`relative transition-transform duration-200 ${isHovered ? 'robot-wiggle' : 'robot-floating'}`}>
                <RobotMascot size={64} isHovered={isHovered} />
              </div>

              {/* Online / Active Badge Indicator */}
              <span className="absolute bottom-1 right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900" />
              </span>
            </button>
          </div>
        )}

        {/* Minimized Quick Close Floating Button (When Chat Open) */}
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl bg-surface border border-border text-text-muted hover:text-text hover:bg-bg shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            title="Asistanı Simge Durumuna Küçült"
            aria-label="Asistanı Simge Durumuna Küçült"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </>
  );
};
