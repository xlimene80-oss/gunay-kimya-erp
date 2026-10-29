import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Info,
  DollarSign
} from 'lucide-react';

interface RiskStatusData {
  cari_id: number;
  cari_code: string;
  title: string;
  max_credit_limit: number;
  current_risk: number;
  utilization_pct: number;
  risk_status: 'HEALTHY' | 'APPROACHING_LIMIT' | 'BLOCKED';
  is_blocked: boolean;
  message: string;
}

interface CheckBondItem {
  id: number;
  portfolio_number: string;
  serial_number: string;
  instrument_type: string;
  bank_name: string;
  branch_name?: string;
  debtor_name: string;
  issue_date: string;
  maturity_date: string;
  amount: number;
  currency: string;
  status: string;
}

interface ProductionCostAnalytics {
  total_production_spend_usd: number;
  average_unit_cost_usd: number;
  total_produced_volume_kg: number;
  completed_orders_count: number;
  ingredient_spend_breakdown: Array<{
    name: string;
    sku: string;
    total_quantity_kg: number;
    total_cost_usd: number;
  }>;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [productionCosts, setProductionCosts] = useState<ProductionCostAnalytics | null>(null);
  const [currentBalance] = useState<number>(142500.0);
  const [riskData, setRiskData] = useState<RiskStatusData>({
    cari_id: 1,
    cari_code: '120.01.0042',
    title: 'Ege Kimya Sanayi ve Ticaret A.Ş.',
    max_credit_limit: 750000.0,
    current_risk: 227500.0,
    utilization_pct: 30.33,
    risk_status: 'HEALTHY',
    is_blocked: false,
    message: 'Kredi limiti güvenli operasyon seviyesindedir.',
  });

  const [checkBonds, setCheckBonds] = useState<CheckBondItem[]>([
    {
      id: 1,
      portfolio_number: 'PRT-2026-089',
      serial_number: 'CK-889021',
      instrument_type: 'RECEIVABLE_CHECK',
      bank_name: 'Garanti BBVA',
      branch_name: 'Gebze Ticari',
      debtor_name: 'Ege Kimya A.Ş.',
      issue_date: '2026-10-15',
      maturity_date: '2026-11-20',
      amount: 45000.0,
      currency: 'TRY',
      status: 'IN_PORTFOLIO',
    },
    {
      id: 2,
      portfolio_number: 'PRT-2026-074',
      serial_number: 'CK-771203',
      instrument_type: 'RECEIVABLE_CHECK',
      bank_name: 'İş Bankası',
      branch_name: 'Tuzla OSB',
      debtor_name: 'Ege Kimya A.Ş.',
      issue_date: '2026-09-20',
      maturity_date: '2026-10-30',
      amount: 40000.0,
      currency: 'TRY',
      status: 'IN_BANK_COLLECTION',
    },
    {
      id: 3,
      portfolio_number: 'PRT-2026-052',
      serial_number: 'CK-554109',
      instrument_type: 'RECEIVABLE_CHECK',
      bank_name: 'Akbank',
      branch_name: 'İzmir Liman',
      debtor_name: 'Ege Kimya A.Ş.',
      issue_date: '2026-08-10',
      maturity_date: '2026-09-15',
      amount: 60000.0,
      currency: 'TRY',
      status: 'COLLECTED',
    },
    {
      id: 4,
      portfolio_number: 'PRT-2026-031',
      serial_number: 'SNT-11029',
      instrument_type: 'RECEIVABLE_BOND',
      bank_name: 'Yapı Kredi',
      branch_name: 'Kemalpaşa',
      debtor_name: 'Ege Kimya A.Ş.',
      issue_date: '2026-07-05',
      maturity_date: '2026-08-01',
      amount: 25000.0,
      currency: 'TRY',
      status: 'COLLECTED',
    },
  ]);

  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'COLLECTED' | 'BOUNCED'>('ALL');

  const fetchDashboardData = async () => {
    try {
      // 1. Attempt to fetch dealer risk status
      const riskRes = await axios.get('/api/v1/caris/1/risk-status');
      if (riskRes.data) {
        setRiskData(riskRes.data);
      }

      // 2. Attempt to fetch upcoming check/bond maturities
      const bondRes = await axios.get('/api/v1/caris/checks-bonds/maturities?days_ahead=90');
      if (bondRes.data && bondRes.data.length > 0) {
        setCheckBonds(bondRes.data);
      }

      // 3. Attempt to fetch production USD cost analytics
      const prodRes = await axios.get('/api/v1/production/costs/analytics');
      if (prodRes.data) {
        setProductionCosts(prodRes.data);
      }
    } catch (err) {
      // Use fallback chemical dealer mock data on fresh local setup
      console.log('Using baseline dealer mock values for UI display.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Calculations
  const availableCredit = Math.max(0, riskData.max_credit_limit - riskData.current_risk);
  const pendingChecksTotal = checkBonds
    .filter((b) => b.status === 'IN_PORTFOLIO' || b.status === 'IN_BANK_COLLECTION')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Filtered check list
  const filteredBonds = checkBonds.filter((bond) => {
    if (activeTab === 'PENDING') {
      return bond.status === 'IN_PORTFOLIO' || bond.status === 'IN_BANK_COLLECTION';
    }
    if (activeTab === 'COLLECTED') {
      return bond.status === 'COLLECTED' || bond.status === 'PAID';
    }
    if (activeTab === 'BOUNCED') {
      return bond.status === 'BOUNCED';
    }
    return true;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COLLECTED':
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success-soft text-success-text border border-success-border">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            Tahsil Edildi
          </span>
        );
      case 'IN_BANK_COLLECTION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-soft text-warning-text border border-warning-border">
            <Clock className="w-3.5 h-3.5 text-warning" />
            Bankada Tahsilde
          </span>
        );
      case 'IN_PORTFOLIO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-bg text-text-muted border border-border">
            <Clock className="w-3.5 h-3.5 text-text-muted" />
            Portföyde (Bekliyor)
          </span>
        );
      case 'BOUNCED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-danger-soft text-danger-text border border-danger-border">
            <AlertTriangle className="w-3.5 h-3.5 text-danger" />
            Karşılıksız / İade
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-bg text-text-muted border border-border">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-text-muted font-medium">Finansal Risk ve Bakiye Verileri Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Account Header */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 className="w-5 h-5 text-text-muted" />
            <h1 className="text-xl font-bold text-text tracking-tight">
              {riskData.title}
            </h1>
            <span className="text-xs bg-bg text-text-muted border border-border px-2 py-0.5 rounded font-mono">
              {riskData.cari_code}
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Yetkili Bayi Temsilcisi: <span className="text-text font-medium">{user?.full_name}</span> ({user?.email})
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Risk Badge */}
          {riskData.risk_status === 'HEALTHY' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success-soft border border-success-border text-success-text text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-success" />
              <span>Risk Durumu: Güvenli</span>
            </div>
          )}
          {riskData.risk_status === 'APPROACHING_LIMIT' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-warning-soft border border-warning-border text-warning-text text-xs font-semibold">
              <ShieldAlert className="w-4 h-4 text-warning" />
              <span>Risk Durumu: Limit Yaklaştı</span>
            </div>
          )}
          {riskData.risk_status === 'BLOCKED' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-danger-soft border border-danger-border text-danger-text text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-danger" />
              <span>Risk Durumu: Sevkiyat Bloke</span>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-surface hover:bg-border/30 border border-border text-text transition-colors"
            title="Verileri Güncelle"
          >
            <RefreshCw className={`w-4 h-4 text-text-muted ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Net Bakiye */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-border/80 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Net Bakiye (Cari Borç)
            </span>
            <div className="text-text-muted">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-extrabold text-text font-mono">
              {formatCurrency(currentBalance)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
            {currentBalance > 0 ? (
              <>
                <ArrowUpRight className="w-3.5 h-3.5 text-text-muted" />
                <span>Açık fatura bakiyesi</span>
              </>
            ) : (
              <>
                <ArrowDownRight className="w-3.5 h-3.5 text-text-muted" />
                <span>Alacaklı bakiye</span>
              </>
            )}
          </div>
        </div>

        {/* Card 2: Kredi Risk Limiti */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-border/80 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Kredi Risk Limiti
            </span>
            <div className="text-text-muted">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-extrabold text-text font-mono">
              {formatCurrency(riskData.max_credit_limit)}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
            <span>Tanımlı Kredi Tavanı</span>
            <span className="text-text font-semibold">Tier-1 Bayi</span>
          </div>
        </div>

        {/* Card 3: Kullanılabilir Limit */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-border/80 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Kullanılabilir Limit
            </span>
            <div className="text-text-muted">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-extrabold text-text font-mono">
              {formatCurrency(availableCredit)}
            </h3>
          </div>
          {/* Progress bar */}
          <div className="mt-3 space-y-1">
            <div className="w-full bg-bg h-1.5 rounded-full overflow-hidden border border-border">
              <div
                className={`h-full rounded-full ${
                  riskData.utilization_pct > 80 ? 'bg-danger' : riskData.utilization_pct > 60 ? 'bg-warning' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(100, riskData.utilization_pct)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-text-muted pt-0.5">
              <span>Risk Doluluğu</span>
              <span className="font-semibold text-text">{riskData.utilization_pct.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Bekleyen Evrak */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-border/80 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Bekleyen Evrak (Çek/Senet)
            </span>
            <div className="text-text-muted">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-extrabold text-text font-mono">
              {formatCurrency(pendingChecksTotal)}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
            <span>Portföydeki Evrak Sayısı</span>
            <span className="text-text font-semibold">
              {checkBonds.filter((b) => b.status === 'IN_PORTFOLIO' || b.status === 'IN_BANK_COLLECTION').length} Adet
            </span>
          </div>
        </div>
      </div>

      {/* 5. Production USD Cost Analytics Card */}
      {productionCosts && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-2xl p-6 shadow-xl border border-emerald-500/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Üretim & Hammadde Maliyet Analizi ($ USD)
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    BOM & FEFO Entegre
                  </span>
                </h2>
                <p className="text-xs text-emerald-200/70 mt-0.5">
                  Kalite onaylı lotlardan FEFO prensibiyle tüketilen kimyasal hammaddelerin net maliyeti
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs text-emerald-300 block">Ortalama Birim Maliyet</span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  ${productionCosts.average_unit_cost_usd.toFixed(2)}
                  <span className="text-xs font-normal text-emerald-200/70 ml-1">/ kg</span>
                </span>
              </div>
              <div className="text-right pl-6 border-l border-emerald-500/20">
                <span className="text-xs text-emerald-300 block">Toplam Hammadde Harcaması</span>
                <span className="text-2xl font-black font-mono text-white">
                  ${productionCosts.total_production_spend_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {productionCosts.ingredient_spend_breakdown && productionCosts.ingredient_spend_breakdown.length > 0 && (
            <div className="mt-4 pt-2">
              <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider block mb-2.5">
                En Yüksek Tüketilen Hammaddeler (USD Harcama Payı)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {productionCosts.ingredient_spend_breakdown.slice(0, 4).map((ing, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="text-xs font-medium text-emerald-100 truncate">{ing.name}</div>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="font-mono font-bold text-white text-sm">
                        ${ing.total_cost_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-300">
                        {ing.total_quantity_kg.toLocaleString('tr-TR')} kg
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Checks & Promissory Notes Section */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <Calendar className="w-5 h-5 text-text-muted" />
              Çek & Senet Vade Takip Portföyü
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Günay Kimya finans portföyüne teslim edilen çek ve senetlerin canlı vade durumları
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-bg p-1.5 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'ALL' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              Tümü ({checkBonds.length})
            </button>
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'PENDING' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              Bekleyenler
            </button>
            <button
              onClick={() => setActiveTab('COLLECTED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'COLLECTED' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              Tahsil Edilenler
            </button>
            <button
              onClick={() => setActiveTab('BOUNCED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'BOUNCED' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              İade/Protestolu
            </button>
          </div>
        </div>

        {/* Documents Table */}
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left text-sm text-text">
            <thead className="bg-bg text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border">
              <tr>
                <th scope="col" className="px-4 py-3.5">Portföy / Seri No</th>
                <th scope="col" className="px-4 py-3.5">Evrak Türü</th>
                <th scope="col" className="px-4 py-3.5">Banka & Şube</th>
                <th scope="col" className="px-4 py-3.5">Muhatap / Borçlu</th>
                <th scope="col" className="px-4 py-3.5">Vade Tarihi</th>
                <th scope="col" className="px-4 py-3.5 text-right">Tutar</th>
                <th scope="col" className="px-4 py-3.5 text-center">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBonds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-text-muted">
                    Seçili filtreye uygun çek veya senet kaydı bulunmamaktadır.
                  </td>
                </tr>
              ) : (
                filteredBonds.map((bond) => (
                  <tr key={bond.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs font-medium text-text">
                      <div>{bond.portfolio_number}</div>
                      <div className="text-[11px] text-text-muted font-sans">{bond.serial_number}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      {bond.instrument_type === 'RECEIVABLE_CHECK' ? (
                        <span className="text-text font-medium">Müşteri Çeki</span>
                      ) : (
                        <span className="text-text font-medium">Senet (Bono)</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-medium text-text">{bond.bank_name}</div>
                      <div className="text-[11px] text-text-muted">{bond.branch_name || '-'}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text">
                      {bond.debtor_name}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium">
                      <span className="text-text font-mono">{bond.maturity_date}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-bold text-right font-mono text-text">
                      {formatCurrency(bond.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {getStatusBadge(bond.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="pt-2 flex items-center gap-2 text-xs text-text-muted">
          <Info className="w-4 h-4 text-text-muted shrink-0" />
          <span>
            Vadesi yaklaşan çekler için otomatik bildirimler ilgili banka takas merkezinden tahsil onaylandığında güncellenir.
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
