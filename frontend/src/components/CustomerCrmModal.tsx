import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  Building2,
  Clock,
  User,
  Plus,
  Send,
  MessageSquare,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

export interface CustomerSummary {
  id: number;
  code: string;
  title: string;
  tax_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  current_balance: number;
  credit_limit: number;
  payment_term_days: number;
  risk_status: string;
}

export interface CariNoteItem {
  id: number;
  cari_id: number;
  created_by_id?: number | null;
  note: string;
  created_at: string;
}

interface CustomerCrmModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerSummary | null;
}

export const CustomerCrmModal: React.FC<CustomerCrmModalProps> = ({
  isOpen,
  onClose,
  customer
}) => {
  const [notes, setNotes] = useState<CariNoteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [newNote, setNewNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && customer) {
      fetchNotes();
      setNewNote('');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, customer]);

  const fetchNotes = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/v1/crm/notes/cari/${customer.id}`);
      setNotes(res.data || []);
    } catch (err: any) {
      console.error('CRM notları yüklenemedi:', err);
      setError('CRM notları sunucudan alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !newNote.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await axios.post('/api/v1/crm/notes', {
        cari_id: customer.id,
        note: newNote.trim()
      });
      setNewNote('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await fetchNotes();
    } catch (err: any) {
      console.error('Not eklenirken hata:', err);
      setError(err?.response?.data?.detail || 'Not eklenirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border bg-gradient-to-r from-surface via-primary-soft/10 to-surface flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary-soft border border-primary-border">
                  {customer.code}
                </span>
                <span className="text-xs text-text-muted">Müşteri Profil Kartı & CRM</span>
              </div>
              <h2 className="text-lg font-bold text-text truncate max-w-md">{customer.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-bg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial & Contact Summary Pills */}
        <div className="p-4 bg-bg border-b border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-surface border border-border">
            <span className="text-text-muted block text-[10px] font-semibold uppercase">Güncel Bakiye</span>
            <span className={`font-bold font-mono text-sm ${customer.current_balance > 0 ? 'text-danger' : 'text-success'}`}>
              ₺{Number(customer.current_balance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface border border-border">
            <span className="text-text-muted block text-[10px] font-semibold uppercase">Kredi Limiti</span>
            <span className="font-bold font-mono text-sm text-text">
              ₺{Number(customer.credit_limit).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface border border-border">
            <span className="text-text-muted block text-[10px] font-semibold uppercase">Vade Koşulu</span>
            <span className="font-bold text-sm text-text font-mono">
              {customer.payment_term_days} Gün
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface border border-border">
            <span className="text-text-muted block text-[10px] font-semibold uppercase">Risk Durumu</span>
            <span className={`inline-block font-bold text-xs uppercase px-2 py-0.5 rounded mt-0.5 ${
              customer.risk_status === 'HEALTHY'
                ? 'bg-success-soft text-success border border-success-border'
                : 'bg-danger-soft text-danger border border-danger-border'
            }`}>
              {customer.risk_status}
            </span>
          </div>
        </div>

        {/* Modal Body: Two sections (New Note Form + Timeline) */}
        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {/* New Note Form */}
          <form onSubmit={handleAddNote} className="p-4 rounded-xl bg-surface border border-border space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-primary" />
                Yeni Görüşme / Ziyaret Notu Ekle
              </label>
              {success && (
                <span className="text-xs font-bold text-success flex items-center gap-1 animate-fadeIn">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Not başarıyla kaydedildi!
                </span>
              )}
            </div>

            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Örn: Fabrika satın alma yetkilisi ile görüşüldü. Haftaya 15 ton LABSA siparişi geçmeyi planlıyorlar, vade şartları değerlendirildi..."
              rows={3}
              required
              className="w-full p-3 rounded-xl bg-bg border border-border text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition resize-none"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted">
                Bu not müşteri geçmişine kronolojik olarak eklenecek ve CRM kayıtlarında saklanacaktır.
              </span>
              <button
                type="submit"
                disabled={submitting || !newNote.trim()}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-2 hover:bg-primary-hover disabled:opacity-50 transition shadow-sm"
              >
                {submitting ? 'Kaydediliyor...' : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Notu Kaydet
                  </>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="p-3 rounded-xl bg-danger-soft border border-danger-border text-danger text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Chronological Notes History */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Görüşme ve İletişim Geçmişi ({notes.length})
            </h3>

            {loading ? (
              <div className="py-8 text-center text-text-muted text-xs">
                Notlar yükleniyor...
              </div>
            ) : notes.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-bg border border-dashed border-border text-text-muted text-xs">
                Bu müşteri için henüz CRM notu kaydedilmemiş. İlk notu yukarıdaki alandan ekleyebilirsiniz.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {notes.map((item) => (
                  <div key={item.id} className="relative group">
                    {/* Dot */}
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-surface" />
                    
                    <div className="p-4 rounded-xl bg-bg border border-border hover:border-primary/40 transition">
                      <div className="flex items-center justify-between text-[11px] text-text-muted mb-1.5">
                        <span className="flex items-center gap-1 font-semibold text-text">
                          <User className="w-3.5 h-3.5 text-primary" />
                          Plasiyer / Müşteri Temsilcisi
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[10px]">
                          <Clock className="w-3 h-3" />
                          {new Date(item.created_at).toLocaleString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-text whitespace-pre-wrap leading-relaxed">
                        {item.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-surface flex items-center justify-between text-xs text-text-muted">
          <span>Vergi No: {customer.tax_number || 'Belirtilmemiş'}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-bg border border-border text-text font-bold hover:bg-border/50 transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
