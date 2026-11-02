import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Send,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  PlusCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface EmployeeReportItem {
  id: number;
  user_id: number;
  report_type: string;
  title?: string;
  content: string;
  created_at: string;
}

export const EmployeeReports: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<EmployeeReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Form State
  const [reportType, setReportType] = useState<string>('Gunluk');
  const [title, setTitle] = useState<string>('');
  const [todayWork, setTodayWork] = useState<string>('');
  const [tomorrowPlans, setTomorrowPlans] = useState<string>('');
  const [issuesAndNotes, setIssuesAndNotes] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/v1/reports/employee');
      setReports(res.data || []);
    } catch (err: any) {
      console.error('Raporlar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todayWork.trim()) {
      setFormError('Lütfen "Bugün Yapılan Faaliyetler" alanını doldurunuz.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    // Combine 3 textareas into structured, rich report content
    const structuredContent = `### 1. Bugün Yapılan Faaliyetler:\n${todayWork.trim()}\n\n### 2. Yarın Planlananlar:\n${tomorrowPlans.trim() || 'Belirtilmedi'}\n\n### 3. Varsa Karşılaşılan Sorunlar / Notlar:\n${issuesAndNotes.trim() || 'Yok'}`;

    try {
      await axios.post('/api/v1/reports/employee', {
        report_type: reportType,
        title: title.trim() || `${reportType} Faaliyet Raporu - ${new Date().toLocaleDateString('tr-TR')}`,
        content: structuredContent
      });

      setFormSuccess(true);
      setTitle('');
      setTodayWork('');
      setTomorrowPlans('');
      setIssuesAndNotes('');

      setTimeout(() => setFormSuccess(false), 3000);
      await fetchReports();
    } catch (err: any) {
      console.error('Rapor kaydedilemedi:', err);
      setFormError(err?.response?.data?.detail || 'Rapor kaydedilirken hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.content.toLowerCase().includes(searchQuery.toLowerCase());
    if (typeFilter === 'ALL') return matchesSearch;
    return matchesSearch && r.report_type.toLowerCase() === typeFilter.toLowerCase();
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Personel ve Plasiyer Faaliyet Raporlama
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Günlük operasyonel ilerlemelerinizi, saha/bayi ziyaretlerinizi ve planlarınızı merkeze aktarın
          </p>
        </div>
      </div>

      {/* 3 Text-Area Report Entry Form */}
      <div className="p-6 rounded-2xl bg-surface border border-border shadow-card">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-text">Yeni Faaliyet Raporu Girişi</h2>
          </div>
          {formSuccess && (
            <span className="text-xs font-bold text-success flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              Rapor başarıyla kaydedildi ve sisteme işlendi!
            </span>
          )}
        </div>

        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-danger-soft border border-danger-border text-danger text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-text mb-1">Rapor Tipi</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-semibold focus:outline-none focus:border-primary transition"
              >
                <option value="Gunluk">Günlük Faaliyet Raporu</option>
                <option value="Satis">Satış & Plasiyer Ziyareti</option>
                <option value="Saha">Saha / Tesis İncelemesi</option>
                <option value="Aylik">Aylık Değerlendirme Raporu</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-text mb-1">Rapor Başlığı (İsteğe Bağlı)</label>
              <input
                type="text"
                placeholder="Örn: Ege Bölgesi Bayi Ziyaretleri ve Hammadde Talepleri"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary transition"
              />
            </div>
          </div>

          {/* 3 Textareas */}
          <div className="space-y-4 pt-1">
            {/* 1. Bugün Yapılan Faaliyetler */}
            <div>
              <label className="block text-xs font-bold text-text mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] font-black flex items-center justify-center">1</span>
                  Bugün Yapılan Faaliyetler *
                </span>
                <span className="text-[10px] text-text-muted">Görüşülen cariler, tamamlanan işler, analizler</span>
              </label>
              <textarea
                rows={3}
                required
                value={todayWork}
                onChange={(e) => setTodayWork(e.target.value)}
                placeholder="Örn: Ege Kimya ve Akdeniz Boya ile yüz yüze görüşüldü. 15 ton LABSA ve 5 ton SLES için teklif sunuldu. Depo reaktif kimyasal stokları sayıldı..."
                className="w-full p-3 rounded-xl bg-bg border border-border text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition resize-none leading-relaxed"
              />
            </div>

            {/* 2. Yarın Planlananlar */}
            <div>
              <label className="block text-xs font-bold text-text mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center">2</span>
                  Yarın Planlananlar
                </span>
                <span className="text-[10px] text-text-muted">Hedeflenen ziyaretler, randevular, sipariş takipleri</span>
              </label>
              <textarea
                rows={3}
                value={tomorrowPlans}
                onChange={(e) => setTomorrowPlans(e.target.value)}
                placeholder="Örn: Torbalı Organize Sanayi Bölgesindeki 3 potansiyel müşteri ziyaret edilecek. Bekleyen analiz raporları laboratuvar sorumlusundan alınacak..."
                className="w-full p-3 rounded-xl bg-bg border border-border text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition resize-none leading-relaxed"
              />
            </div>

            {/* 3. Varsa Karşılaşılan Sorunlar / Notlar */}
            <div>
              <label className="block text-xs font-bold text-text mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-warning text-white text-[11px] font-black flex items-center justify-center">3</span>
                  Varsa Karşılaşılan Sorunlar / Notlar
                </span>
                <span className="text-[10px] text-text-muted">Geciken hammadde, fiyat itirazları, rakip durumları</span>
              </label>
              <textarea
                rows={2}
                value={issuesAndNotes}
                onChange={(e) => setIssuesAndNotes(e.target.value)}
                placeholder="Örn: Rakip firma benzer üründe 45 gün vade teklif etmiş. Müşteri bu koşulu talep ediyor..."
                className="w-full p-3 rounded-xl bg-bg border border-border text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition resize-none leading-relaxed"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-primary" />
              Rapor Sahibi: <strong className="text-text">{user?.full_name}</strong>
            </span>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-primary/25 transition disabled:opacity-50"
            >
              {submitting ? 'Kaydediliyor...' : (
                <>
                  <Send className="w-4 h-4" />
                  Raporu Gönder ve Kaydet
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Submitted Reports History */}
      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Faaliyet ve Rapor Geçmişi ({filteredReports.length})
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Sistemde arşivlenen geçmiş faaliyet bildirimleri
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Raporlarda Ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary transition w-44 sm:w-56"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="p-1.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary transition"
            >
              <option value="ALL">Tüm Tipler</option>
              <option value="Gunluk">Günlük</option>
              <option value="Satis">Satış</option>
              <option value="Saha">Saha</option>
              <option value="Aylik">Aylık</option>
            </select>

            <button
              onClick={fetchReports}
              className="p-2 rounded-xl bg-bg border border-border text-text hover:bg-border/40 transition"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {loading ? (
            <div className="py-12 text-center text-text-muted text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
              Raporlar yükleniyor...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-xs">
              Henüz kayıtlı faaliyet raporu bulunmamaktadır.
            </div>
          ) : (
            filteredReports.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <div key={item.id} className="p-5 hover:bg-primary-soft/10 transition-colors">
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex items-start justify-between cursor-pointer gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary-soft text-primary border border-primary-border">
                          {item.report_type}
                        </span>
                        <span className="text-[11px] text-text-muted font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.created_at).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-text">{item.title || 'Faaliyet Raporu'}</h4>
                    </div>

                    <button className="text-text-muted hover:text-text p-1">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 p-4 rounded-xl bg-bg border border-border text-xs text-text whitespace-pre-wrap leading-relaxed animate-fadeIn">
                      {item.content}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
