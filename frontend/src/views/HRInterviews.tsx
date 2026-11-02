import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  X
} from 'lucide-react';

interface HRInterviewItem {
  id: number;
  candidate_name: string;
  position: string;
  status: 'onaylandi' | 'reddedildi' | 'gorusme_halinde';
  sub_status?: string | null;
  reason?: string | null;
  interview_date: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at: string;
}

export const HRInterviews: React.FC = () => {
  const [interviews, setInterviews] = useState<HRInterviewItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New Candidate Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [candidateForm, setCandidateForm] = useState({
    candidate_name: '',
    position: '',
    phone: '',
    email: '',
    sub_status: '1. Mülakat',
    notes: ''
  });

  // Action Modals State
  const [activeInterview, setActiveInterview] = useState<HRInterviewItem | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'STAGE' | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>('Üretim');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('1. Mülakat');
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/hr/interviews?limit=100';
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }
      const res = await axios.get(url);
      setInterviews(res.data || []);
    } catch (err: any) {
      console.error('Mülakatlar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, [statusFilter]);

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post('/api/v1/hr/interviews', {
        candidate_name: candidateForm.candidate_name.trim(),
        position: candidateForm.position.trim(),
        phone: candidateForm.phone.trim() || undefined,
        email: candidateForm.email.trim() || undefined,
        sub_status: candidateForm.sub_status,
        notes: candidateForm.notes.trim() || undefined,
        status: 'gorusme_halinde'
      });

      setIsAddModalOpen(false);
      setCandidateForm({
        candidate_name: '',
        position: '',
        phone: '',
        email: '',
        sub_status: '1. Mülakat',
        notes: ''
      });
      await fetchInterviews();
    } catch (err: any) {
      console.error('Aday eklenemedi:', err);
      alert('Aday eklenirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!activeInterview || !actionType) return;
    setActionError(null);

    let payload: any = {};

    if (actionType === 'APPROVE') {
      payload = {
        status: 'onaylandi',
        sub_status: selectedDept,
        reason: `${selectedDept} departmanı için işe alım onaylandı.`
      };
    } else if (actionType === 'REJECT') {
      if (!rejectReason.trim()) {
        setActionError('Lütfen adayın reddedilme gerekçesini belirtiniz (Zorunlu alan).');
        return;
      }
      payload = {
        status: 'reddedildi',
        reason: rejectReason.trim()
      };
    } else if (actionType === 'STAGE') {
      payload = {
        status: 'gorusme_halinde',
        sub_status: selectedStage
      };
    }

    try {
      await axios.patch(`/api/v1/hr/interviews/${activeInterview.id}`, payload);
      setActiveInterview(null);
      setActionType(null);
      setRejectReason('');
      await fetchInterviews();
    } catch (err: any) {
      console.error('Durum güncellenemedi:', err);
      setActionError(err?.response?.data?.detail || 'İşlem sırasında hata oluştu.');
    }
  };

  const filteredInterviews = interviews.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.candidate_name.toLowerCase().includes(q) ||
      item.position.toLowerCase().includes(q) ||
      (item.sub_status || '').toLowerCase().includes(q) ||
      (item.notes || '').toLowerCase().includes(q)
    );
  });

  const counts = {
    total: interviews.length,
    active: interviews.filter((i) => i.status === 'gorusme_halinde').length,
    approved: interviews.filter((i) => i.status === 'onaylandi').length,
    rejected: interviews.filter((i) => i.status === 'reddedildi').length
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            İnsan Kaynakları & Mülakat Yönetim Paneli
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            İşe alım aday havuzu, teknik değerlendirmeler ve departman kabul/red süreçleri
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-primary/25 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Yeni Aday Kaydı Ekle
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface border border-border shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Toplam Aday</span>
          <span className="text-2xl font-black text-text font-mono mt-1 block">{counts.total}</span>
        </div>
        <div className="p-4 rounded-xl bg-surface border border-border shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Görüşme Halinde</span>
          <span className="text-2xl font-black text-blue-500 font-mono mt-1 block">{counts.active}</span>
        </div>
        <div className="p-4 rounded-xl bg-surface border border-border shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Onaylanan / İşe Alınan</span>
          <span className="text-2xl font-black text-success font-mono mt-1 block">{counts.approved}</span>
        </div>
        <div className="p-4 rounded-xl bg-surface border border-border shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Reddedilen</span>
          <span className="text-2xl font-black text-danger font-mono mt-1 block">{counts.rejected}</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-bg border border-border rounded-xl">
            {[
              { id: 'ALL', label: 'Tümü' },
              { id: 'gorusme_halinde', label: 'Görüşme Halinde' },
              { id: 'onaylandi', label: 'Onaylandı' },
              { id: 'reddedildi', label: 'Reddedildi' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === tab.id
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Aday Adı / Pozisyon Ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary transition w-44 sm:w-60"
              />
            </div>

            <button
              onClick={fetchInterviews}
              className="p-2 rounded-xl bg-bg border border-border text-text hover:bg-border/40 transition"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Interviews Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-bg border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Aday Adı & Pozisyon</th>
                <th className="py-3 px-4">İletişim</th>
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Aşama / Departman</th>
                <th className="py-3 px-4 text-center">Durum</th>
                <th className="py-3 px-4">Notlar / Gerekçe</th>
                <th className="py-3 px-4 text-right">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                    Aday listesi yükleniyor...
                  </td>
                </tr>
              ) : filteredInterviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted text-xs">
                    Kayıtlı aday mülakatı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredInterviews.map((item) => (
                  <tr key={item.id} className="hover:bg-primary-soft/15 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-text text-xs">{item.candidate_name}</div>
                      <div className="text-[11px] text-primary font-semibold mt-0.5">{item.position}</div>
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      {item.phone && (
                        <div className="flex items-center gap-1 text-text">
                          <Phone className="w-3 h-3 text-text-muted" />
                          <span>{item.phone}</span>
                        </div>
                      )}
                      {item.email && (
                        <div className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
                          <Mail className="w-3 h-3 text-text-muted" />
                          <span>{item.email}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs font-mono text-text-muted">
                      {new Date(item.interview_date).toLocaleDateString('tr-TR')}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-bg border border-border text-text">
                        {item.sub_status || '1. Mülakat'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {item.status === 'onaylandi' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-soft text-success border border-success-border">
                          <CheckCircle2 className="w-3 h-3" />
                          Onaylandı
                        </span>
                      )}
                      {item.status === 'reddedildi' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-danger-soft text-danger border border-danger-border">
                          <UserX className="w-3 h-3" />
                          Reddedildi
                        </span>
                      )}
                      {item.status === 'gorusme_halinde' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/30">
                          <Clock className="w-3 h-3" />
                          Görüşme Halinde
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 max-w-xs text-xs text-text">
                      {item.reason && (
                        <div className="text-[11px] text-danger font-semibold mb-0.5">
                          Gerekçe: {item.reason}
                        </div>
                      )}
                      <div className="text-[11px] text-text-muted truncate" title={item.notes || ''}>
                        {item.notes || '-'}
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setActiveInterview(item);
                            setActionType('APPROVE');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-success-soft hover:bg-success text-success hover:text-white border border-success-border text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          title="Adayı Onayla (Departman Seçimi)"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Onayla</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveInterview(item);
                            setActionType('REJECT');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-danger-soft hover:bg-danger text-danger hover:text-white border border-danger-border text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          title="Adayı Reddet (Zorunlu Gerekçe Girişi)"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Reddet</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveInterview(item);
                            setActionType('STAGE');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white border border-blue-500/30 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          title="Aşama Güncelle"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Aşama</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Candidate Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Yeni Aday Mülakat Kaydı
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 rounded-xl text-text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCandidate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text mb-1">Aday Adı Soyadı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Caner Aydın"
                  value={candidateForm.candidate_name}
                  onChange={(e) => setCandidateForm({ ...candidateForm, candidate_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Başvurulan Pozisyon *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Kimya Laboratuvar Teknisyeni / Üretim Operatörü"
                  value={candidateForm.position}
                  onChange={(e) => setCandidateForm({ ...candidateForm, position: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text mb-1">Telefon Numarası</label>
                  <input
                    type="text"
                    placeholder="0532 000 00 00"
                    value={candidateForm.phone}
                    onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text mb-1">E-Posta Adresi</label>
                  <input
                    type="email"
                    placeholder="aday@ornek.com"
                    value={candidateForm.email}
                    onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Mülakat Aşaması</label>
                <select
                  value={candidateForm.sub_status}
                  onChange={(e) => setCandidateForm({ ...candidateForm, sub_status: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text focus:outline-none focus:border-primary"
                >
                  <option value="1. Mülakat">1. Mülakat (Ön Tanışma)</option>
                  <option value="Teknik Değerlendirme & Test">Teknik Değerlendirme & Test</option>
                  <option value="Yönetici Mülakatı">Yönetici Mülakatı</option>
                  <option value="Teklif Aşaması">Teklif Aşaması</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Özgeçmiş / Mülakat Notları</label>
                <textarea
                  rows={3}
                  placeholder="Eğitim geçmişi, referansları, tecrübesi ve genel izlenim..."
                  value={candidateForm.notes}
                  onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text resize-none focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-bg border border-border text-xs font-bold text-text"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-2 shadow-sm"
                >
                  {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Execution Modal (Approve, Reject, Stage) */}
      {actionType && activeInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-text">
                {actionType === 'APPROVE' && 'Aday İşe Alım Onayı'}
                {actionType === 'REJECT' && 'Aday Mülakat Ret İşlemi'}
                {actionType === 'STAGE' && 'Mülakat Aşaması Güncelleme'}
              </h3>
              <button
                onClick={() => {
                  setActionType(null);
                  setActiveInterview(null);
                }}
                className="p-1 rounded-xl text-text-muted hover:text-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-bg border border-border text-xs">
                <span className="text-text-muted block text-[10px] uppercase font-bold">Aday</span>
                <span className="font-bold text-text block text-sm">{activeInterview.candidate_name}</span>
                <span className="text-primary font-semibold">{activeInterview.position}</span>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-danger-soft border border-danger-border text-danger text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Approve Form: Select Department */}
              {actionType === 'APPROVE' && (
                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    İstihdam Edilecek Departman Seçimi *
                  </label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="Üretim">Üretim Tesisleri</option>
                    <option value="Depo & Lojistik">Depo & Lojistik</option>
                    <option value="Kalite Kontrol & Lab">Kalite Kontrol & Laboratuvar</option>
                    <option value="Satış & Pazarlama">Satış & Pazarlama</option>
                    <option value="İnsan Kaynakları">İnsan Kaynakları</option>
                    <option value="Muhasebe & Finans">Muhasebe & Finans</option>
                  </select>
                  <p className="text-[11px] text-text-muted mt-1.5">
                    Seçilen departman adayın profilinde 'sub_status' olarak kaydedilecek ve işe alım durumu 'Onaylandı' yapılacaktır.
                  </p>
                </div>
              )}

              {/* Reject Form: Required Reason */}
              {actionType === 'REJECT' && (
                <div>
                  <label className="block text-xs font-bold text-danger mb-1">
                    Reddedilme Detay Nedeni (Zorunlu) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Örn: Pozisyon için aranan 3 yıllık HPLC cihaz tecrübesi yetersiz bulundu..."
                    className="w-full p-3 rounded-xl bg-bg border border-danger/40 text-xs text-text focus:outline-none focus:border-danger resize-none"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    * Şirket standartları gereği gerekçe belirtilmeden mülakat ret işlemi onaylanamaz.
                  </p>
                </div>
              )}

              {/* Stage Form */}
              {actionType === 'STAGE' && (
                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    Yeni Mülakat Aşaması Seçimi *
                  </label>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-bg border border-border text-xs text-text font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="1. Mülakat">1. Mülakat (Ön Görüşme)</option>
                    <option value="Teknik Değerlendirme & Test">Teknik Değerlendirme & Laboratuvar Testi</option>
                    <option value="Yönetici Mülakatı">Yönetici Mülakatı</option>
                    <option value="Teklif Aşaması">Teklif & Ücret Müzakeresi</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setActionType(null);
                    setActiveInterview(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-bg border border-border text-xs font-bold text-text"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAction}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md transition ${
                    actionType === 'REJECT'
                      ? 'bg-danger hover:bg-danger-hover'
                      : 'bg-primary hover:bg-primary-hover'
                  }`}
                >
                  Onayla ve Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
