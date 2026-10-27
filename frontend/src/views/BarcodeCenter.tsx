import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Barcode,
  Boxes,
  Search,
  Copy,
  RefreshCw,
  PackageCheck,
  Check
} from 'lucide-react';

interface BarcodeUnitItem {
  id: number;
  barcode_string: string;
  type: 'PALLET' | 'BOX';
  quantity: number;
  status: 'IN_STOCK' | 'SHIPPED';
  item?: {
    sku: string;
    name: string;
  };
  children_count?: number;
  parent_pallet?: string;
}

export const BarcodeCenter: React.FC = () => {
  const [barcodes, setBarcodes] = useState<BarcodeUnitItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PALLET' | 'BOX'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchBarcodes = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/v1/inventory/barcodes');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setBarcodes(res.data);
      } else {
        // Fallback seeded demo view
        setBarcodes([
          {
            id: 1,
            barcode_string: '(00)186900000000001015',
            type: 'PALLET',
            quantity: 20,
            status: 'IN_STOCK',
            children_count: 20,
            item: { sku: 'GNY-SBN-01', name: 'Ultra Hijyenik Sıvı Sabun 5L' }
          },
          {
            id: 2,
            barcode_string: '(01)8690000101015(21)KOLI-001',
            type: 'BOX',
            quantity: 1,
            status: 'IN_STOCK',
            parent_pallet: '(00)186900000000001015',
            item: { sku: 'GNY-SBN-01', name: 'Ultra Hijyenik Sıvı Sabun 5L (4x5L Koli)' }
          },
          {
            id: 3,
            barcode_string: '(01)8690000101015(21)KOLI-002',
            type: 'BOX',
            quantity: 1,
            status: 'IN_STOCK',
            parent_pallet: '(00)186900000000001015',
            item: { sku: 'GNY-SBN-01', name: 'Ultra Hijyenik Sıvı Sabun 5L (4x5L Koli)' }
          },
          {
            id: 4,
            barcode_string: '(00)186900000000001022',
            type: 'PALLET',
            quantity: 15,
            status: 'IN_STOCK',
            children_count: 15,
            item: { sku: 'GNY-DTG-01', name: 'Endüstriyel Bulaşık Deterjanı 20L' }
          }
        ]);
      }
    } catch (err) {
      console.error('Barkod verisi çekilemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBarcodes();
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredBarcodes = barcodes.filter((b) => {
    const matchesSearch =
      b.barcode_string.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.item?.name && b.item.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.item?.sku && b.item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'ALL' || b.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const palletsCount = barcodes.filter((b) => b.type === 'PALLET').length;
  const boxesCount = barcodes.filter((b) => b.type === 'BOX').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border border-border text-text-muted">
              <Barcode className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
                Hazır Palet & Koli Barkod Merkezi
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-primary-soft text-primary border border-primary-border rounded-full font-mono">
                  SSCC-18 / GS1-128
                </span>
              </h1>
              <p className="text-xs text-text-muted mt-1">
                Üretim hattından çıkan mamul koli ve ana palet hiyerarşisi, sevkiyata hazır barkod etiketleri.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBarcodes}
            className="px-3.5 py-2 bg-surface hover:bg-surface/80 text-text rounded-xl border border-border transition flex items-center gap-2 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Hazır Paletler (SSCC-18)
            </span>
            <Boxes className="w-5 h-5 text-text-muted" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text font-mono">{palletsCount}</span>
            <span className="text-xs text-text-muted font-medium">Palet Depoda</span>
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Çok kademeli koli taşıyıcı paletler</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Bireysel Koli Barkodları
            </span>
            <Barcode className="w-5 h-5 text-text-muted" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text font-mono">{boxesCount}</span>
            <span className="text-xs text-text-muted font-medium">Koli Etiketlendi</span>
          </div>
          <div className="mt-1 text-[11px] text-text-muted">GS1-128 koli seri numaralandırması</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Barkod Doğrulama Standartı
            </span>
            <PackageCheck className="w-5 h-5 text-text-muted" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold text-text font-mono">GS1 SSCC-18</span>
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Uluslararası lojistik sevkiyat uyumlu</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
          <input
            type="text"
            placeholder="Barkod dizesi veya ürün adı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-text placeholder-text-muted focus:outline-none focus:border-primary font-mono"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              typeFilter === 'ALL'
                ? 'bg-primary border-primary text-white'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            Tümü
          </button>
          <button
            onClick={() => setTypeFilter('PALLET')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              typeFilter === 'PALLET'
                ? 'bg-primary border-primary text-white'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            Sadece Paletler (SSCC)
          </button>
          <button
            onClick={() => setTypeFilter('BOX')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              typeFilter === 'BOX'
                ? 'bg-primary border-primary text-white'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            Sadece Koliler
          </button>
        </div>
      </div>

      {/* Barcode List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBarcodes.map((item) => (
          <div
            key={item.id}
            className="bg-surface border border-border rounded-2xl p-5 space-y-3 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium border border-border bg-bg text-text-muted">
                {item.type === 'PALLET' ? 'Palet (SSCC-18)' : 'Koli Barkodu'}
              </span>

              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-success-soft text-success-text border border-success-border">
                Depoda Hazır
              </span>
            </div>

            <div className="bg-bg p-3 rounded-xl border border-border flex items-center justify-between">
              <div className="font-mono text-xs md:text-sm text-text font-bold tracking-wider truncate mr-2">
                {item.barcode_string}
              </div>
              <button
                onClick={() => handleCopy(item.barcode_string)}
                className="p-1.5 bg-surface hover:bg-surface/80 text-text rounded-lg text-xs transition shrink-0 border border-border"
                title="Barkodu Kopyala"
              >
                {copiedId === item.barcode_string ? (
                  <Check className="w-3.5 h-3.5 text-success" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div>
                <div className="text-text font-bold">{item.item?.name || 'Ürün'}</div>
                <div className="text-[11px] text-text-muted font-mono">{item.item?.sku}</div>
              </div>
              <div className="text-right">
                <div className="text-text-muted text-[11px]">Miktar / İçerik</div>
                <div className="font-mono text-text font-bold">{item.quantity} Birim</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
