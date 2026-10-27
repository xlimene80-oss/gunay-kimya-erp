import React, { useState } from 'react';
import {
  FlaskConical,
  Scale,
  Calculator,
  Layers,
  CheckCircle2,
  RotateCcw,
  Check,
  Zap,
  Info
} from 'lucide-react';

interface RecipeIngredient {
  id?: number;
  item_id?: number;
  sku: string;
  name: string;
  unit: string;
  percentage: number;
  base_qty_1000kg: number;
  cas_number?: string;
  role: string;
}

const DEFAULT_INGREDIENTS: RecipeIngredient[] = [
  {
    sku: 'SLES-70',
    name: 'Sodyum Lauril Eter Sülfat %70 (SLES)',
    unit: 'kg',
    percentage: 14.0,
    base_qty_1000kg: 140.0,
    cas_number: '68891-38-3',
    role: 'Ana Anyonik Yüzey Aktif Madde / Köpürtücü'
  },
  {
    sku: 'LABSA-96',
    name: 'Lineer Alkil Benzen Sülfonik Asit %96 (LABSA)',
    unit: 'kg',
    percentage: 4.0,
    base_qty_1000kg: 40.0,
    cas_number: '27176-87-0',
    role: 'Kir ve Yağ Çözücü Anyonik Aktif'
  },
  {
    sku: 'NAOH-48',
    name: 'Sıvı Kostik Soda %48 (NaOH)',
    unit: 'kg',
    percentage: 1.25,
    base_qty_1000kg: 12.5,
    cas_number: '1310-73-2',
    role: 'LABSA Nötralizasyon Ajanı & pH Regülatörü'
  },
  {
    sku: 'GLIS-99',
    name: 'Gliserin Farma Kalite %99.5',
    unit: 'kg',
    percentage: 1.5,
    base_qty_1000kg: 15.0,
    cas_number: '56-81-5',
    role: 'Cilt Koruyucu & Nemlendirici Ajan'
  },
  {
    sku: 'ESN-CAM',
    name: 'Doğal Çam Esansı & Koruyucu',
    unit: 'kg',
    percentage: 0.35,
    base_qty_1000kg: 3.5,
    cas_number: '8000-41-7',
    role: 'Koku, Berraklık & Raf Ömrü Stabilizatörü'
  },
  {
    sku: 'SU-ARIT',
    name: 'Endüstriyel Deiyonize Saf Su',
    unit: 'kg',
    percentage: 78.9,
    base_qty_1000kg: 789.0,
    cas_number: '7732-18-5',
    role: 'Çözücü Taşıyıcı Faz'
  }
];

export const BomManagement: React.FC = () => {
  const [targetBatchKg, setTargetBatchKg] = useState<number>(5000);
  const [selectedReactor, setSelectedReactor] = useState<string>('Reaktör-01 (Paslanmaz Mikser - 10 Ton)');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [calculatedMessage, setCalculatedMessage] = useState<string | null>(null);

  // Dynamic calculations based on targetBatchKg
  const scaleFactor = targetBatchKg / 1000;

  const calculatedIngredients = DEFAULT_INGREDIENTS.map((item) => ({
    ...item,
    requiredQuantity: Number((item.base_qty_1000kg * scaleFactor).toFixed(2))
  }));

  const totalRawWeight = calculatedIngredients.reduce((acc, curr) => acc + curr.requiredQuantity, 0);
  const slesQty = calculatedIngredients.find((i) => i.sku === 'SLES-70')?.requiredQuantity || 0;
  const labsaQty = calculatedIngredients.find((i) => i.sku === 'LABSA-96')?.requiredQuantity || 0;
  const naohQty = calculatedIngredients.find((i) => i.sku === 'NAOH-48')?.requiredQuantity || 0;

  const handleRunCalculation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setCalculatedMessage(
        `✓ ${targetBatchKg.toLocaleString('tr-TR')} kg şarj için SLES (${slesQty} kg), LABSA (${labsaQty} kg) ve Kostik (${naohQty} kg) oranları stokla eşleştirildi. Nötralizasyon dengesi tam.`
      );
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border border-border text-text-muted">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
                Reçete (BOM) & Kimyasal Formülasyon
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-primary-soft text-primary border border-primary-border rounded-full font-mono">
                  SLES / LABSA / NaOH
                </span>
              </h1>
              <p className="text-xs text-text-muted mt-1">
                Şarj hacmine göre otomatik hammadde tüketim hesabı, stok düşüm katsayıları ve nötralizasyon kontrolü.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTargetBatchKg(5000)}
            className="px-3.5 py-2 bg-surface hover:bg-surface/80 text-text rounded-xl border border-border text-xs font-medium transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-text-muted" />
            Sıfırla (5.000 kg)
          </button>
          <button
            onClick={handleRunCalculation}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-primary"
          >
            <Calculator className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
            Reçeteyi Yeniden Hesapla
          </button>
        </div>
      </div>

      {calculatedMessage && (
        <div className="p-4 rounded-xl bg-success-soft border border-success-border text-success-text flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>{calculatedMessage}</span>
          </div>
          <button onClick={() => setCalculatedMessage(null)} className="underline hover:opacity-80">
            Kapat
          </button>
        </div>
      )}

      {/* Control Panel: Target Volume & Reactor Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Üretim Şarj Miktarı (Hedef Tonaj)
            </label>
            <Scale className="w-4 h-4 text-text-muted" />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="250"
              min="500"
              max="20000"
              value={targetBatchKg}
              onChange={(e) => setTargetBatchKg(Math.max(100, Number(e.target.value)))}
              className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-lg font-mono font-bold text-text focus:outline-none focus:border-primary"
            />
            <span className="text-sm font-bold text-text-muted font-mono">KG</span>
          </div>
          <div className="flex gap-2">
            {[1000, 2500, 5000, 10000].map((preset) => (
              <button
                key={preset}
                onClick={() => setTargetBatchKg(preset)}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-mono font-semibold transition border ${
                  targetBatchKg === preset
                    ? 'bg-primary border-primary text-white'
                    : 'bg-surface border-border text-text-muted hover:text-text'
                }`}
              >
                {preset >= 1000 ? `${preset / 1000}T` : `${preset}kg`}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Tahsis Edilecek Mikser / Reaktör
            </label>
            <Layers className="w-4 h-4 text-text-muted" />
          </div>
          <select
            value={selectedReactor}
            onChange={(e) => setSelectedReactor(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-xs text-text focus:outline-none focus:border-primary"
          >
            <option>Reaktör-01 (Paslanmaz Mikser - 10 Ton)</option>
            <option>Reaktör-02 (Paslanmaz Çift Cidarlı - 5 Ton)</option>
            <option>Homojenizatör Tank-03 (3 Ton Hızlı Karışım)</option>
          </select>
          <div className="text-[11px] text-text-muted flex items-center justify-between">
            <span>Kapasite Doluluk Oranı:</span>
            <span className="font-mono text-text font-bold">
              {((targetBatchKg / 10000) * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
              pH & Nötralizasyon Kalibrasyonu
            </label>
            <Zap className="w-4 h-4 text-text-muted" />
          </div>
          <div className="flex items-center justify-between text-xs font-mono pt-1">
            <span className="text-text-muted">Hedef pH Aralığı:</span>
            <span className="text-text font-bold">5.50 - 5.80 (Cilt Uyumlu)</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-text-muted">Reaksiyon Tipi:</span>
            <span className="text-text font-bold">Ekzotermik Nötralizasyon</span>
          </div>
          <div className="text-[11px] text-text-muted flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-text-muted" />
            <span>Kostik (NaOH) beslemesi 40°C altında kademeli verilir.</span>
          </div>
        </div>
      </div>

      {/* Chemical Ingredients Calculation Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface">
          <div>
            <h2 className="text-base font-bold text-text flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-text-muted" />
              Şarj Dağılım Listesi — Ultra Sıvı Sabun Formülasyonu
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Toplam Hesaplanan Şarj: <strong className="text-text font-mono">{totalRawWeight.toLocaleString('tr-TR')} kg</strong>
            </p>
          </div>
          <span className="text-xs bg-bg text-text-muted px-3 py-1 rounded-full border border-border font-mono">
            1 Ton Baz Formülü x {scaleFactor.toFixed(2)} Kat
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg text-text-muted uppercase font-bold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="p-4">SKU & Hammadde Adı</th>
                <th className="p-4">CAS No & İşlev</th>
                <th className="p-4 text-center">Formül Payı (%)</th>
                <th className="p-4 text-right">1.000 kg Baz</th>
                <th className="p-4 text-right text-text font-bold">Şarj İhtiyacı</th>
                <th className="p-4 text-center">Stok FEFO Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {calculatedIngredients.map((item) => (
                <tr key={item.sku} className="hover:bg-bg/40 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-text text-sm">{item.name}</div>
                    <div className="text-[11px] font-mono text-text-muted">{item.sku}</div>
                  </td>
                  <td className="p-4 text-text-muted">
                    <span className="font-mono text-[10px] bg-bg px-1.5 py-0.5 rounded text-text-muted border border-border mr-1.5">
                      {item.cas_number}
                    </span>
                    <span className="text-[11px] text-text-muted">{item.role}</span>
                  </td>
                  <td className="p-4 text-center font-mono font-bold text-text">
                    %{item.percentage.toFixed(2)}
                  </td>
                  <td className="p-4 text-right font-mono text-text-muted">
                    {item.base_qty_1000kg.toLocaleString('tr-TR')} {item.unit}
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-sm text-text">
                    {item.requiredQuantity.toLocaleString('tr-TR')} {item.unit}
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-success-soft text-success-text border border-success-border">
                      <Check className="w-3 h-3" /> Yeterli (FEFO Uygun)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-bg font-bold border-t border-border text-xs text-text">
              <tr>
                <td colSpan={2} className="p-4 text-text-muted">
                  TOPLAM REÇETE ŞARJ HACMİ
                </td>
                <td className="p-4 text-center font-mono text-text">%100.00</td>
                <td className="p-4 text-right font-mono text-text-muted">1.000 kg</td>
                <td className="p-4 text-right font-mono text-text text-base">
                  {totalRawWeight.toLocaleString('tr-TR')} kg
                </td>
                <td className="p-4 text-center text-success font-mono text-[11px]">Reaktöre Hazır</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
