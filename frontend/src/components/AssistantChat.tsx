import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type ChatMessage = { role: 'assistant' | 'user'; text: string };

export const AssistantChat: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setMessages([]);
      return;
    }
    const role = user.department_name || user.roles?.[0] || user.role || 'Kullanıcı';
    setMessages([{
      role: 'assistant',
      text: `Merhaba ${user.full_name || role} (${role}), Günay Kimya ERP Yapay Zeka Asistanı'na hoş geldiniz. Bugün hangi departmanın iş akışını denetlemek istersiniz?`,
    }]);
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || sending) return;
    setMessages((current) => [...current, { role: 'user', text: question }]);
    setInput('');
    setSending(true);
    try {
      const response = await axios.post('/api/ai/chat', { message: question });
      setMessages((current) => [...current, { role: 'assistant', text: response.data.answer }]);
    } catch (error: any) {
      setMessages((current) => [...current, {
        role: 'assistant', text: error?.response?.data?.detail || 'Asistana şu anda ulaşılamıyor. Biraz sonra tekrar deneyin.',
      }]);
    } finally {
      setSending(false);
    }
  };

  if (!isAuthenticated) return null;
  return (
    <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-[70] no-print">
      {open && (
        <section className="mb-3 flex h-[min(70vh,520px)] w-[min(92vw,370px)] flex-col overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-4 py-3 text-white">
            <div className="flex items-center gap-2"><Sparkles size={18} /><div><div className="font-bold">Günay Kimya AI</div><div className="text-[11px] text-white/80">Rolünüze göre ERP asistanı</div></div></div>
            <button onClick={() => setOpen(false)} aria-label="Asistanı kapat" className="rounded-lg p-1 hover:bg-white/20"><X size={18} /></button>
          </header>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-violet-50/70 to-white p-3">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.role === 'user' ? 'ml-auto bg-violet-600 text-white' : 'border border-violet-100 bg-white text-slate-700 shadow-sm'}`}>
                {message.text}
              </div>
            ))}
            {sending && <div className="text-xs text-violet-600">Veriler inceleniyor…</div>}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3">
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Bir soru yazın…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
            <button disabled={sending || !input.trim()} aria-label="Mesajı gönder" className="rounded-xl bg-violet-600 px-3 text-white disabled:opacity-40"><Send size={17} /></button>
          </form>
        </section>
      )}
      <button onClick={() => setOpen((value) => !value)} className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-xl ring-4 ring-white transition hover:scale-105" aria-label="AI Asistanı aç">
        {open ? <X size={22} /> : <MessageCircle size={23} />}
      </button>
    </div>
  );
};
