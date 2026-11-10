import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  MessageCircle,
  Send,
  Sparkles,
  X,
  Bot,
  User as UserIcon,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  Loader2
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
    <div className="fixed bottom-6 right-6 z-[75] no-print select-none">
      {/* Chat Window */}
      {open && (
        <section
          aria-label="Günay Kimya Sanal Asistanı"
          className="mb-3 flex h-[540px] w-[390px] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl transition-all duration-200"
        >
          {/* Header */}
          <header className="flex items-center justify-between bg-primary px-4 py-3.5 text-white shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                <Sparkles size={18} className="animate-pulse" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                  <span>Günay Kimya Asistanı</span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-mono font-semibold">
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

      {/* Floating Launcher Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-xl ring-4 ring-white dark:ring-slate-900 transition-all duration-200 hover:scale-105 hover:bg-primary/90 active:scale-95"
        title={open ? "Sanal Asistanı Kapat" : "Günay Kimya Sanal Asistanı"}
        aria-label="Sanal Asistanı Aç/Kapat"
      >
        {open ? <X size={24} /> : <MessageCircle size={25} />}
      </button>
    </div>
  );
};
