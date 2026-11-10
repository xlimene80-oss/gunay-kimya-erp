import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Printer,
  Edit,
  Trash2,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Settings,
  X,
  Loader2,
  Eye,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';

export interface ProformaItem {
  id?: number;
  item_id: number;
  item_name?: string;
  item_sku?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_rate: number;
  discount_amount?: number;
  tax_rate: number;
  tax_amount?: number;
  total_price: number;
}

export interface ProformaQuote {
  id: number;
  quote_number: string;
  cari_id: number;
  cari_name?: string;
  cari_code?: string;
  cari_tax_office?: string;
  cari_tax_number?: string;
  cari_address?: string;
  cari_phone?: string;
  cari_email?: string;
  created_by_id?: number;
  created_by_name?: string;
  quote_date: string;
  valid_until: string;
  status: 'Taslak' | 'Onay Bekliyor' | 'Gönderildi' | 'Kabul Edildi' | 'Reddedildi' | 'Siparişe Dönüştü' | 'Süresi Doldu';
  currency: string;
  exchange_rate: number;
  discount_rate: number;
  discount_amount: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  payment_terms: string;
  delivery_terms: string;
  notes?: string;
  requires_approval: boolean;
  approval_status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  approval_notes?: string;
  approved_by_name?: string;
  approved_at?: string;
  converted_order_id?: number;
  items: ProformaItem[];
}

export interface ProformaSettings {
  id: number;
  max_discount_without_approval: number;
  company_name: string;
  company_title: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  bank_name: string;
  bank_branch: string;
  iban_try: string;
  iban_usd: string;
  iban_eur: string;
  default_validity_days: number;
  default_payment_terms: string;
  default_delivery_terms: string;
  footer_note: string;
}

export interface CariAccount {
  id: number;
  code: string;
  title: string;
  tax_number?: string;
  tax_office?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_b2b?: boolean;
}

export interface ProductItem {
  id: number;
  sku: string;
  name: string;
  unit: string;
  list_price?: number;
  unit_price?: number;
}

export const QuotesManagement: React.FC = () => {
  const { user } = useAuth();

  const isB2B = user?.role === 'customer' || (user?.role as string) === 'CUSTOMER';
  const deptCode = (user?.department_code || '').toUpperCase().trim();
  const isAdmin = user?.role === 'admin' || deptCode === 'ADMIN' || deptCode === 'YONETIM';
  const isSales = isAdmin || deptCode === 'SATIS' || user?.roles?.some(r => r.toLowerCase().includes('satis'));
  const isFinance = isAdmin || deptCode === 'MUHASEBE' || user?.roles?.some(r => r.toLowerCase().includes('muhasebe'));

  // State
  const [quotes, setQuotes] = useState<ProformaQuote[]>([]);
  const [settingsData, setSettingsData] = useState<ProformaSettings | null>(null);
  const [caris, setCaris] = useState<CariAccount[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [showRespondModal, setShowRespondModal] = useState<boolean>(false);
  const [activeQuote, setActiveQuote] = useState<ProformaQuote | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State for New Quote
  const [formCariId, setFormCariId] = useState<number | ''>('');
  const [formValidUntil, setFormValidUntil] = useState<string>('');
  const [formCurrency, setFormCurrency] = useState<string>('TRY');
  const [formExchangeRate, setFormExchangeRate] = useState<number>(1.0);
  const [formOverallDiscount, setFormOverallDiscount] = useState<number>(0);
  const [formPaymentTerms, setFormPaymentTerms] = useState<string>('30 Gün Vade / Banka Havalesi');
  const [formDeliveryTerms, setFormDeliveryTerms] = useState<string>('Fabrika Teslim (EXW) - Kemalpaşa Depo');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formItems, setFormItems] = useState<ProformaItem[]>([
    { item_id: 0, quantity: 1, unit: 'adet', unit_price: 0, discount_rate: 0, tax_rate: 20, total_price: 0 }
  ]);

  // Approval Form
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [respondAction, setRespondAction] = useState<'accept' | 'reject'>('accept');
  const [respondNote, setRespondNote] = useState<string>('');

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/v1/proformas', {
        params: {
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          q: searchQuery || undefined
        }
      });
      setQuotes(res.data);
    } catch (err: any) {
      console.error('Error fetching proformas:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [settRes, cariRes, prodRes] = await Promise.all([
        axios.get('/api/v1/proformas/settings').catch(() => ({ data: null })),
        isB2B ? Promise.resolve({ data: [] }) : axios.get('/api/v1/caris').catch(() => axios.get('/api/caris')),
        axios.get('/api/v1/products').catch(() => axios.get('/api/products'))
      ]);

      if (settRes.data) setSettingsData(settRes.data);
      if (cariRes.data) setCaris(cariRes.data);
      if (prodRes.data) setProducts(prodRes.data);
    } catch (err) {
      console.error('Failed loading dependencies:', err);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [statusFilter, searchQuery]);

  // Recalculate line total in form
  const updateFormItem = (index: number, field: keyof ProformaItem, value: any) => {
    const updated = [...formItems];
    const item = { ...updated[index], [field]: value };

    // If item_id changed, auto-fill unit & default price
    if (field === 'item_id') {
      const foundProd = products.find(p => p.id === Number(value));
      if (foundProd) {
        item.item_name = foundProd.name;
        item.item_sku = foundProd.sku;
        item.unit = foundProd.unit || 'adet';
        item.unit_price = foundProd.list_price || foundProd.unit_price || 0;
      }
    }

    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const disc = Number(item.discount_rate) || 0;
    const tax = Number(item.tax_rate) || 20;

    const gross = qty * price;
    const discAmount = (gross * disc) / 100;
    const net = gross - discAmount;
    const taxAmount = (net * tax) / 100;
    item.total_price = Number((net + taxAmount).toFixed(2));
    item.discount_amount = Number(discAmount.toFixed(2));
    item.tax_amount = Number(taxAmount.toFixed(2));

    updated[index] = item;
    setFormItems(updated);
  };

  const addFormItem = () => {
    setFormItems([
      ...formItems,
      { item_id: 0, quantity: 1, unit: 'adet', unit_price: 0, discount_rate: 0, tax_rate: 20, total_price: 0 }
    ]);
  };

  const removeFormItem = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  // Form Subtotal and Totals
  const formSubtotal = formItems.reduce((acc, it) => {
    const gross = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    const disc = (gross * (Number(it.discount_rate) || 0)) / 100;
    return acc + (gross - disc);
  }, 0);

  const formOverallDiscAmount = (formSubtotal * (Number(formOverallDiscount) || 0)) / 100;
  const formNetSubtotal = formSubtotal - formOverallDiscAmount;
  const formTaxAmount = (formNetSubtotal * 20) / 100;
  const formGrandTotal = formNetSubtotal + formTaxAmount;

  // Max discount warning check
  const maxDiscInForm = Math.max(
    Number(formOverallDiscount) || 0,
    ...formItems.map(it => Number(it.discount_rate) || 0)
  );
  const discountLimit = settingsData?.max_discount_without_approval || 15;
  const willRequireApproval = maxDiscInForm > discountLimit;

  const handleOpenCreateModal = () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + (settingsData?.default_validity_days || 15));
    setFormValidUntil(futureDate.toISOString().split('T')[0]);
    setFormCariId(caris.length > 0 ? caris[0].id : '');
    setFormCurrency('TRY');
    setFormExchangeRate(1.0);
    setFormOverallDiscount(0);
    setFormPaymentTerms(settingsData?.default_payment_terms || '30 Gün Vade / Banka Havalesi');
    setFormDeliveryTerms(settingsData?.default_delivery_terms || 'Fabrika Teslim (EXW) - Kemalpaşa Depo');
    setFormNotes('');
    setFormItems([
      { item_id: products[0]?.id || 0, quantity: 1, unit: products[0]?.unit || 'adet', unit_price: products[0]?.list_price || 0, discount_rate: 0, tax_rate: 20, total_price: 0 }
    ]);
    setShowCreateModal(true);
  };

  const handleSaveQuote = async () => {
    if (!formCariId) {
      alert('Lütfen bir Cari / Müşteri seçiniz.');
      return;
    }
    if (formItems.some(it => !it.item_id || it.quantity <= 0)) {
      alert('Lütfen tüm satırlarda ürün ve geçerli miktar giriniz.');
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        cari_id: Number(formCariId),
        valid_until: formValidUntil,
        currency: formCurrency,
        exchange_rate: Number(formExchangeRate) || 1.0,
        discount_rate: Number(formOverallDiscount) || 0,
        payment_terms: formPaymentTerms,
        delivery_terms: formDeliveryTerms,
        notes: formNotes,
        items: formItems.map(it => ({
          item_id: Number(it.item_id),
          quantity: Number(it.quantity),
          unit: it.unit,
          unit_price: Number(it.unit_price),
          discount_rate: Number(it.discount_rate) || 0,
          tax_rate: Number(it.tax_rate) || 20
        }))
      };

      const res = await axios.post('/api/v1/proformas', payload);
      setFeedbackMsg({
        type: 'success',
        text: res.data.requires_approval
          ? `Teklif #${res.data.quote_number} oluşturuldu. İskonto limiti aşıldığı için Finans onayına gönderildi.`
          : `Teklif #${res.data.quote_number} Taslak olarak başarıyla kaydedildi.`
      });
      setShowCreateModal(false);
      fetchQuotes();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Teklif oluşturulurken hata meydana geldi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendToCustomer = async (quote: ProformaQuote) => {
    if (!confirm(`Teklif #${quote.quote_number} müşteriye gönderilsin mi?`)) return;
    try {
      setActionLoading(true);
      await axios.post(`/api/v1/proformas/${quote.id}/send`);
      setFeedbackMsg({ type: 'success', text: `Teklif #${quote.quote_number} müşteriye başarıyla iletildi.` });
      fetchQuotes();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Gönderim sırasında hata oluştu.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessApproval = async (action: 'approve' | 'reject') => {
    if (!activeQuote) return;
    try {
      setActionLoading(true);
      await axios.post(`/api/v1/proformas/${activeQuote.id}/approval`, {
        action,
        notes: approvalNote
      });
      setFeedbackMsg({
        type: 'success',
        text: action === 'approve'
          ? `Teklif #${activeQuote.quote_number} iskontosu onaylandı. Müşteriye gönderilebilir.`
          : `Teklif #${activeQuote.quote_number} iskontosu reddedildi.`
      });
      setShowApprovalModal(false);
      setApprovalNote('');
      fetchQuotes();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Onay işlemi sırasında hata oluştu.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCustomerResponse = async () => {
    if (!activeQuote) return;
    try {
      setActionLoading(true);
      await axios.post(`/api/v1/proformas/${activeQuote.id}/respond`, {
        action: respondAction,
        notes: respondNote
      });
      setFeedbackMsg({
        type: 'success',
        text: respondAction === 'accept'
          ? `Teklif #${activeQuote.quote_number} başarıyla kabul edildi.`
          : `Teklif #${activeQuote.quote_number} reddedildi.`
      });
      setShowRespondModal(false);
      setRespondNote('');
      fetchQuotes();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'İşlem sırasında hata oluştu.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToOrder = async (quote: ProformaQuote) => {
    if (!confirm(`Teklif #${quote.quote_number} Satış Siparişi'ne dönüştürülsün mü? Depo stok rezervi ve eksik ürün varsa üretim emri otomatik açılacaktır.`)) {
      return;
    }
    try {
      setActionLoading(true);
      const res = await axios.post(`/api/v1/proformas/${quote.id}/convert-to-order`);
      setFeedbackMsg({
        type: 'success',
        text: `Tebrikler! Teklif #${quote.quote_number} başarıyla Sipariş #${res.data.converted_order_id} olarak dönüştürüldü ve stok rezervi işlendi.`
      });
      fetchQuotes();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Siparişe dönüştürme sırasında hata oluştu.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPrintWindow = (quoteId: number) => {
    window.open(`/api/v1/proformas/${quoteId}/print`, '_blank');
  };

  // Status Badge Component
  const renderStatusBadge = (status: ProformaQuote['status'], _requiresApproval?: boolean, _approvalStatus?: string) => {
    switch (status) {
      case 'Taslak':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <Edit className="w-3.5 h-3.5" />
            Taslak
          </span>
        );
      case 'Onay Bekliyor':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            Finans Onayı Bekliyor
          </span>
        );
      case 'Gönderildi':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200">
            <Send className="w-3.5 h-3.5" />
            Gönderildi
          </span>
        );
      case 'Kabul Edildi':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Kabul Edildi
          </span>
        );
      case 'Reddedildi':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Reddedildi
          </span>
        );
      case 'Siparişe Dönüştü':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200">
            <Check className="w-3.5 h-3.5" />
            Siparişe Dönüştü
          </span>
        );
      case 'Süresi Doldu':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            Süresi Doldu
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & KPI Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center border border-primary-border">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text">Proforma & Müşteri Teklifleri</h1>
              <p className="text-xs text-text-muted mt-0.5">
                {isB2B
                  ? 'Firmanıza özel hazırlanan proforma faturaları inceleyebilir, onaylayabilir veya PDF olarak indirebilirsiniz.'
                  : 'Dövizli teklif hazırlama, Finans iskonto onay kontrolü, PDF çıktısı ve tek tıkla sipariş entegrasyonu.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchQuotes}
            className="p-2.5 text-text-muted hover:text-text bg-bg border border-border rounded-xl hover:bg-surface transition"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {!isB2B && isFinance && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3.5 py-2.5 text-xs font-bold text-text bg-bg border border-border rounded-xl hover:bg-surface transition flex items-center gap-2 shadow-sm"
            >
              <Sliders className="w-4 h-4 text-text-muted" />
              <span>İskonto & Banka Ayarları</span>
            </button>
          )}

          {!isB2B && isSales && (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 text-xs font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Proforma Hazırla</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface p-4 rounded-xl border border-border">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Toplam Teklif</span>
          <div className="text-2xl font-black text-text mt-1">{quotes.length}</div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/20">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Onay Bekleyen</span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {quotes.filter(q => q.status === 'Onay Bekliyor').length}
          </div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/20">
          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Gönderilen / Aktif</span>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {quotes.filter(q => q.status === 'Gönderildi').length}
          </div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Kabul & Sipariş</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {quotes.filter(q => q.status === 'Kabul Edildi' || q.status === 'Siparişe Dönüştü').length}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-border">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Teklif No (PRF-2026-...) veya Müşteri Ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {['ALL', 'Taslak', 'Onay Bekliyor', 'Gönderildi', 'Kabul Edildi', 'Siparişe Dönüştü', 'Reddedildi'].map(st => {
              if (isB2B && (st === 'Taslak' || st === 'Onay Bekliyor')) return null;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition ${
                    statusFilter === st
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-muted hover:text-text hover:bg-bg'
                  }`}
                >
                  {st === 'ALL' ? 'Tümü' : st}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
            <span className="text-xs text-text-muted font-medium">Teklifler yükleniyor...</span>
          </div>
        ) : quotes.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
            <FileSpreadsheet className="w-10 h-10 text-text-muted/40 mb-1" />
            <h3 className="text-sm font-bold text-text">Kayıtlı Teklif Bulunamadı</h3>
            <p className="text-xs text-text-muted max-w-sm">
              Filtrelere uygun proforma teklif kaydı bulunamadı. Yeni bir teklif oluşturabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg/60 border-b border-border text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Teklif No</th>
                  <th className="py-3 px-4">Müşteri / Cari</th>
                  <th className="py-3 px-4">Tarih / Geçerlilik</th>
                  <th className="py-3 px-4">Döviz & Kur</th>
                  <th className="py-3 px-4 text-right">Toplam Tutar</th>
                  <th className="py-3 px-4 text-center">Durum</th>
                  <th className="py-3 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {quotes.map(q => {
                  const isExpired = new Date(q.valid_until) < new Date() && q.status !== 'Siparişe Dönüştü';
                  return (
                    <tr key={q.id} className="hover:bg-bg/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-mono font-bold text-primary">
                          <span>{q.quote_number}</span>
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {q.items?.length || 0} Kalem Ürün
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-text truncate max-w-[220px]">
                          {q.cari_name || `Cari #${q.cari_id}`}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono">
                          {q.cari_code || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-text">
                          {new Date(q.quote_date).toLocaleDateString('tr-TR')}
                        </div>
                        <div className={`text-[10px] flex items-center gap-1 ${isExpired ? 'text-rose-500 font-bold' : 'text-text-muted'}`}>
                          <Clock className="w-3 h-3" />
                          <span>Son: {new Date(q.valid_until).toLocaleDateString('tr-TR')}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-text">{q.currency}</span>
                        {q.currency !== 'TRY' && (
                          <div className="text-[10px] text-text-muted font-mono">
                            Kur: {Number(q.exchange_rate).toFixed(4)} TL
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-black text-text text-sm">
                          {Number(q.grand_total).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {q.currency}
                        </div>
                        {q.discount_rate > 0 && (
                          <div className="text-[10px] text-amber-600 font-semibold">
                            İskonto: %{q.discount_rate}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {renderStatusBadge(q.status, q.requires_approval, q.approval_status)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Yazdır / PDF */}
                          <button
                            onClick={() => handleOpenPrintWindow(q.id)}
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-primary-soft rounded-lg transition"
                            title="Yazdır / PDF İndir"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* İncele */}
                          <button
                            onClick={() => {
                              setActiveQuote(q);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 text-text-muted hover:text-text hover:bg-bg rounded-lg transition"
                            title="Detaylı İncele"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* B2B Bayi Onay / Red Butonu */}
                          {isB2B && q.status === 'Gönderildi' && (
                            <button
                              onClick={() => {
                                setActiveQuote(q);
                                setRespondAction('accept');
                                setShowRespondModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Yanıtla</span>
                            </button>
                          )}

                          {/* Finans / Yönetici İskonto Onayı */}
                          {!isB2B && isFinance && q.status === 'Onay Bekliyor' && (
                            <button
                              onClick={() => {
                                setActiveQuote(q);
                                setShowApprovalModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition flex items-center gap-1"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Onayla</span>
                            </button>
                          )}

                          {/* Satış Müşteriye Gönder */}
                          {!isB2B && isSales && q.status === 'Taslak' && (
                            <button
                              onClick={() => handleSendToCustomer(q)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
                              title="Müşteriye Gönder"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}

                          {/* Tek tıkla Siparişe Dönüştür */}
                          {!isB2B && isSales && (q.status === 'Kabul Edildi' || q.status === 'Gönderildi') && (
                            <button
                              onClick={() => handleConvertToOrder(q)}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition flex items-center gap-1"
                              title="Siparişe Dönüştür"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              <span>Sipariş Yap</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: YENİ PROFORMA OLUŞTURMA */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text">Yeni Proforma Teklif Hazırla</h2>
                  <p className="text-[11px] text-text-muted">Müşteriye özel dövizli ve iskontolu resmi proforma düzenleyin.</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-text-muted hover:text-text rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Approval Warning Banner */}
              {willRequireApproval && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 dark:bg-amber-950/40 dark:border-amber-700 text-amber-800 dark:text-amber-200 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold">Finans Onay Uyarısı: </span>
                    Girilen iskonto oranı (%{maxDiscInForm}), şirket limitini (%{discountLimit}) aştığı için teklif kaydedildiğinde doğrudan <strong>Finans/Yönetici Onayına</strong> sevk edilecek ve onaylanmadan müşteriye gönderilemeyecektir.
                  </div>
                </div>
              )}

              {/* Main Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Müşteri / Cari Seçimi *</label>
                  <select
                    value={formCariId}
                    onChange={e => setFormCariId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text font-medium"
                  >
                    <option value="">Cari Hesap Seçiniz...</option>
                    {caris.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Geçerlilik Tarihi *</label>
                  <input
                    type="date"
                    value={formValidUntil}
                    onChange={e => setFormValidUntil(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Döviz</label>
                    <select
                      value={formCurrency}
                      onChange={e => setFormCurrency(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text font-bold"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Döviz Kuru</label>
                    <input
                      type="number"
                      step="0.0001"
                      disabled={formCurrency === 'TRY'}
                      value={formExchangeRate}
                      onChange={e => setFormExchangeRate(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Terms Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Ödeme Şartları</label>
                  <input
                    type="text"
                    value={formPaymentTerms}
                    onChange={e => setFormPaymentTerms(e.target.value)}
                    placeholder="Örn: 30 Gün Vade / Banka Havalesi"
                    className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Teslim Şekli</label>
                  <input
                    type="text"
                    value={formDeliveryTerms}
                    onChange={e => setFormDeliveryTerms(e.target.value)}
                    placeholder="Örn: Fabrika Teslim (EXW) - Kemalpaşa Depo"
                    className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-text uppercase tracking-wider">Teklif Kalemleri</h3>
                  <button
                    type="button"
                    onClick={addFormItem}
                    className="px-3 py-1.5 text-xs font-bold text-primary bg-primary-soft border border-primary-border rounded-lg hover:bg-primary/20 transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Satır Ekle</span>
                  </button>
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-bg border-b border-border text-[11px] font-bold text-text-muted">
                      <tr>
                        <th className="py-2.5 px-3">Ürün / Kimyasal</th>
                        <th className="py-2.5 px-2 w-28">Miktar</th>
                        <th className="py-2.5 px-2 w-20">Birim</th>
                        <th className="py-2.5 px-2 w-28">Birim Fiyat ({formCurrency})</th>
                        <th className="py-2.5 px-2 w-20">İskonto %</th>
                        <th className="py-2.5 px-3 text-right w-28">Toplam</th>
                        <th className="py-2.5 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {formItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-bg/30">
                          <td className="p-2">
                            <select
                              value={item.item_id}
                              onChange={e => updateFormItem(idx, 'item_id', Number(e.target.value))}
                              className="w-full p-1.5 text-xs bg-bg border border-border rounded-lg text-text"
                            >
                              <option value={0}>Ürün Seçiniz...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.sku} - {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.quantity}
                              onChange={e => updateFormItem(idx, 'quantity', e.target.value)}
                              className="w-full p-1.5 text-xs bg-bg border border-border rounded-lg text-text font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={e => updateFormItem(idx, 'unit', e.target.value)}
                              className="w-full p-1.5 text-xs bg-bg border border-border rounded-lg text-text"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={e => updateFormItem(idx, 'unit_price', e.target.value)}
                              className="w-full p-1.5 text-xs bg-bg border border-border rounded-lg text-text font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={item.discount_rate}
                              onChange={e => updateFormItem(idx, 'discount_rate', e.target.value)}
                              className="w-full p-1.5 text-xs bg-bg border border-border rounded-lg text-text font-semibold text-amber-600"
                            />
                          </td>
                          <td className="p-2 text-right font-black text-text">
                            {Number(item.total_price || 0).toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeFormItem(idx)}
                              disabled={formItems.length === 1}
                              className="text-text-muted hover:text-rose-600 disabled:opacity-30 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Section: Notes & Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-border">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Teklif Notları & Ek Koşullar</label>
                  <textarea
                    rows={4}
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Müşteriye iletilecek özel sevkiyat, ambalaj veya ödeme notları..."
                    className="w-full p-2.5 text-xs bg-bg border border-border rounded-xl text-text"
                  />
                </div>

                <div className="bg-bg/60 p-4 rounded-xl border border-border space-y-2">
                  <div className="flex justify-between text-text-muted">
                    <span>Ara Toplam:</span>
                    <span className="font-bold text-text">{formSubtotal.toFixed(2)} {formCurrency}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-text-muted flex items-center gap-2">
                      <span>Genel İskonto %:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formOverallDiscount}
                        onChange={e => setFormOverallDiscount(Number(e.target.value))}
                        className="w-16 px-1.5 py-0.5 text-xs bg-surface border border-border rounded font-bold text-amber-600"
                      />
                    </span>
                    <span className="font-bold text-amber-600">-{formOverallDiscAmount.toFixed(2)} {formCurrency}</span>
                  </div>

                  <div className="flex justify-between text-text-muted">
                    <span>KDV (%20):</span>
                    <span className="font-bold text-text">+{formTaxAmount.toFixed(2)} {formCurrency}</span>
                  </div>

                  <div className="pt-2 border-t border-border flex justify-between items-center">
                    <span className="font-black text-sm text-text">GENEL TOPLAM:</span>
                    <span className="font-black text-base text-primary">
                      {formGrandTotal.toFixed(2)} {formCurrency}
                    </span>
                  </div>

                  {formCurrency !== 'TRY' && (
                    <div className="text-[11px] text-right text-text-muted">
                      TL Karşılığı: {(formGrandTotal * formExchangeRate).toFixed(2)} TRY
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex justify-end gap-2 bg-surface">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text bg-bg border border-border rounded-xl"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveQuote}
                disabled={actionLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition flex items-center gap-2 shadow-sm"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{willRequireApproval ? 'Kaydet & Onaya Gönder' : 'Teklifi Kaydet (Taslak)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PROFORMA DETAY & PDF ÖNİZLEME */}
      {/* ========================================================================= */}
      {showDetailModal && activeQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-bg/50">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm text-primary">#{activeQuote.quote_number}</span>
                {renderStatusBadge(activeQuote.status, activeQuote.requires_approval, activeQuote.approval_status)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenPrintWindow(activeQuote.id)}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Yazdır / PDF</span>
                </button>
                <button onClick={() => setShowDetailModal(false)} className="p-1.5 text-text-muted hover:text-text rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Preview Container */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs bg-white text-slate-800">
              {/* Corporate Header */}
              <div className="flex justify-between items-start border-b-2 border-primary pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-primary text-white rounded-xl flex items-center justify-center text-xl font-black">
                    GK
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">{settingsData?.company_name || 'GÜNAY KİMYA SAN. VE TİC. LTD. ŞTİ.'}</h2>
                    <p className="text-[10px] text-slate-500 font-semibold">{settingsData?.company_title || 'Endüstriyel Kimyasal Üretim & Çözümler'}</p>
                    <p className="text-[10px] text-slate-400">{settingsData?.company_address}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h1 className="text-xl font-black text-primary uppercase tracking-wider">PROFORMA FATURA</h1>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">PROFORMA INVOICE</div>
                  <div className="font-mono font-extrabold text-slate-900 mt-1">#{activeQuote.quote_number}</div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-black text-primary uppercase border-b border-slate-200 pb-1 mb-2">Müşteri / Cari Bilgileri</div>
                  <div className="font-bold text-slate-900 text-sm mb-1">{activeQuote.cari_name}</div>
                  <div className="text-[11px] text-slate-600">Cari Kodu: {activeQuote.cari_code}</div>
                  <div className="text-[11px] text-slate-600">Vergi Dairesi / No: {activeQuote.cari_tax_office} / {activeQuote.cari_tax_number}</div>
                  <div className="text-[11px] text-slate-600">Adres: {activeQuote.cari_address || '-'}</div>
                  <div className="text-[11px] text-slate-600">İletişim: {activeQuote.cari_phone || '-'} | {activeQuote.cari_email || '-'}</div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-black text-primary uppercase border-b border-slate-200 pb-1 mb-2">Teklif Koşulları</div>
                  <div className="text-[11px] text-slate-700"><strong>Teklif Tarihi:</strong> {new Date(activeQuote.quote_date).toLocaleDateString('tr-TR')}</div>
                  <div className="text-[11px] text-rose-700"><strong>Geçerlilik Tarihi:</strong> {new Date(activeQuote.valid_until).toLocaleDateString('tr-TR')}</div>
                  <div className="text-[11px] text-slate-700"><strong>Döviz / Kur:</strong> {activeQuote.currency} (Kur: {Number(activeQuote.exchange_rate).toFixed(4)} TL)</div>
                  <div className="text-[11px] text-slate-700"><strong>Ödeme Şartı:</strong> {activeQuote.payment_terms}</div>
                  <div className="text-[11px] text-slate-700"><strong>Teslim Şekli:</strong> {activeQuote.delivery_terms}</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Ürün Kodu</th>
                      <th className="py-2 px-3">Ürün / Kimyasal Adı</th>
                      <th className="py-2 px-3 text-right">Miktar</th>
                      <th className="py-2 px-3 text-right">Birim Fiyat</th>
                      <th className="py-2 px-3 text-right">İskonto</th>
                      <th className="py-2 px-3 text-right">KDV</th>
                      <th className="py-2 px-3 text-right">Net Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeQuote.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">{it.item_sku || '-'}</td>
                        <td className="py-2 px-3 text-slate-900 font-medium">{it.item_name}</td>
                        <td className="py-2 px-3 text-right font-bold">{Number(it.quantity).toFixed(2)} {it.unit}</td>
                        <td className="py-2 px-3 text-right font-mono">{Number(it.unit_price).toFixed(2)} {activeQuote.currency}</td>
                        <td className="py-2 px-3 text-right text-amber-600 font-semibold">%{Number(it.discount_rate).toFixed(1)}</td>
                        <td className="py-2 px-3 text-right font-mono">%{Number(it.tax_rate).toFixed(0)}</td>
                        <td className="py-2 px-3 text-right font-bold text-primary font-mono">{Number(it.total_price).toFixed(2)} {activeQuote.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="flex justify-end">
                <div className="w-72 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-medium">
                  <div className="flex justify-between text-slate-600">
                    <span>Ara Toplam:</span>
                    <span className="font-mono font-bold">{Number(activeQuote.subtotal).toFixed(2)} {activeQuote.currency}</span>
                  </div>
                  <div className="flex justify-between text-amber-600">
                    <span>Toplam İskonto:</span>
                    <span className="font-mono font-bold">-{Number(activeQuote.discount_amount).toFixed(2)} {activeQuote.currency}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>KDV Tutarı:</span>
                    <span className="font-mono font-bold">+{Number(activeQuote.tax_amount).toFixed(2)} {activeQuote.currency}</span>
                  </div>
                  <div className="pt-2 border-t-2 border-primary flex justify-between items-center text-primary font-black text-sm">
                    <span>GENEL TOPLAM:</span>
                    <span className="font-mono">{Number(activeQuote.grand_total).toFixed(2)} {activeQuote.currency}</span>
                  </div>
                </div>
              </div>

              {/* Bank & Notes */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-[11px]">
                <div>
                  <div className="font-bold text-primary uppercase mb-1">Banka & Havale Bilgileri</div>
                  <div><strong>Banka:</strong> {settingsData?.bank_name} - {settingsData?.bank_branch}</div>
                  <div><strong>TRY IBAN:</strong> <span className="font-mono font-bold">{settingsData?.iban_try}</span></div>
                  <div><strong>USD IBAN:</strong> <span className="font-mono font-bold">{settingsData?.iban_usd}</span></div>
                  <div><strong>EUR IBAN:</strong> <span className="font-mono font-bold">{settingsData?.iban_eur}</span></div>
                </div>
                <div>
                  <div className="font-bold text-primary uppercase mb-1">Teklif Notları</div>
                  <p className="text-slate-600">{activeQuote.notes || settingsData?.footer_note}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: FİNANS İSKONTO ONAY / RED */}
      {/* ========================================================================= */}
      {showApprovalModal && activeQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">İskonto Onay Değerlendirmesi</h3>
                <p className="text-xs text-text-muted">Teklif No: #{activeQuote.quote_number}</p>
              </div>
            </div>

            <div className="bg-bg p-3.5 rounded-xl border border-border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-text-muted">Müşteri:</span>
                <span className="font-bold text-text">{activeQuote.cari_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Teklif Tutarı:</span>
                <span className="font-bold text-text">{activeQuote.grand_total} {activeQuote.currency}</span>
              </div>
              <div className="flex justify-between text-amber-600 font-bold">
                <span>Talep Edilen İskonto:</span>
                <span>%{activeQuote.discount_rate}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Standart Limit:</span>
                <span>%{settingsData?.max_discount_without_approval || 15}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Onay / Red Notu</label>
              <textarea
                rows={3}
                value={approvalNote}
                onChange={e => setApprovalNote(e.target.value)}
                placeholder="İskontoya ilişkin gerekçe veya açıklama..."
                className="w-full p-2.5 text-xs bg-bg border border-border rounded-xl text-text"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-text-muted hover:text-text bg-bg border border-border rounded-xl"
              >
                Kapat
              </button>
              <button
                onClick={() => handleProcessApproval('reject')}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition"
              >
                İskontoyu Reddet
              </button>
              <button
                onClick={() => handleProcessApproval('approve')}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm"
              >
                İskontoyu Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: B2B BAYİ KABUL / RED YANITI */}
      {/* ========================================================================= */}
      {showRespondModal && activeQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-primary">
              <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">Teklif Yanıtı</h3>
                <p className="text-xs text-text-muted">Teklif No: #{activeQuote.quote_number}</p>
              </div>
            </div>

            <div className="bg-bg p-3.5 rounded-xl border border-border text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-muted">Toplam Tutar:</span>
                <span className="font-bold text-text text-sm">{activeQuote.grand_total} {activeQuote.currency}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Ödeme / Vade:</span>
                <span className="font-medium text-text">{activeQuote.payment_terms}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Teslimat:</span>
                <span className="font-medium text-text">{activeQuote.delivery_terms}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRespondAction('accept')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${
                  respondAction === 'accept'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-bg text-text border-border hover:bg-surface'
                }`}
              >
                Teklifi Kabul Et
              </button>
              <button
                type="button"
                onClick={() => setRespondAction('reject')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${
                  respondAction === 'reject'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-bg text-text border-border hover:bg-surface'
                }`}
              >
                Teklifi Reddet
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">
                {respondAction === 'accept' ? 'Sipariş / Kabul Notunuz (Opsiyonel)' : 'Red Gerekçeniz *'}
              </label>
              <textarea
                rows={3}
                value={respondNote}
                onChange={e => setRespondNote(e.target.value)}
                placeholder={respondAction === 'accept' ? 'Varsa özel sevkiyat notunuz...' : 'Teklif fiyatı, vade veya teslimat koşulu uyuşmazlığı...'}
                className="w-full p-2.5 text-xs bg-bg border border-border rounded-xl text-text"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRespondModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-text-muted hover:text-text bg-bg border border-border rounded-xl"
              >
                Vazgeç
              </button>
              <button
                onClick={handleCustomerResponse}
                disabled={actionLoading || (respondAction === 'reject' && !respondNote.trim())}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition ${
                  respondAction === 'accept' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                <span>Yanıtı Onayla ve Gönder</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: İSKONTO VE BANKA AYARLARI */}
      {/* ========================================================================= */}
      {showSettingsModal && settingsData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-text">Proforma & İskonto Onay Parametreleri</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="p-1 text-text-muted hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-xl">
                <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                  Finans Onaysız Maksimum İskonto Limiti (%) *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={settingsData.max_discount_without_approval}
                    onChange={e => setSettingsData({ ...settingsData, max_discount_without_approval: Number(e.target.value) })}
                    className="w-28 p-2 bg-surface border border-border rounded-lg text-text font-black text-sm"
                  />
                  <span className="text-[11px] text-amber-800 dark:text-amber-300">
                    Bu oranın üzerindeki teklifler Finans onayı almadan müşteriye gönderilemez.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted mb-1">Banka Adı & Şube</label>
                  <input
                    type="text"
                    value={settingsData.bank_name}
                    onChange={e => setSettingsData({ ...settingsData, bank_name: e.target.value })}
                    className="w-full p-2 bg-bg border border-border rounded-lg text-text"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted mb-1">Şube Adı</label>
                  <input
                    type="text"
                    value={settingsData.bank_branch}
                    onChange={e => setSettingsData({ ...settingsData, bank_branch: e.target.value })}
                    className="w-full p-2 bg-bg border border-border rounded-lg text-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-muted mb-1">TRY IBAN</label>
                <input
                  type="text"
                  value={settingsData.iban_try}
                  onChange={e => setSettingsData({ ...settingsData, iban_try: e.target.value })}
                  className="w-full p-2 bg-bg border border-border rounded-lg text-text font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted mb-1">USD IBAN</label>
                  <input
                    type="text"
                    value={settingsData.iban_usd}
                    onChange={e => setSettingsData({ ...settingsData, iban_usd: e.target.value })}
                    className="w-full p-2 bg-bg border border-border rounded-lg text-text font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted mb-1">EUR IBAN</label>
                  <input
                    type="text"
                    value={settingsData.iban_eur}
                    onChange={e => setSettingsData({ ...settingsData, iban_eur: e.target.value })}
                    className="w-full p-2 bg-bg border border-border rounded-lg text-text font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text bg-bg border border-border rounded-xl"
              >
                Kapat
              </button>
              <button
                onClick={async () => {
                  try {
                    await axios.put('/api/v1/proformas/settings', settingsData);
                    alert('Ayarlar başarıyla kaydedildi.');
                    setShowSettingsModal(false);
                  } catch (err: any) {
                    alert(err.response?.data?.detail || 'Ayarlar kaydedilemedi.');
                  }
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-primary rounded-xl hover:bg-primary/90"
              >
                Ayarları Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
