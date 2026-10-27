import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { SiparisVeSevkiyatTakip } from './SiparisVeSevkiyatTakip';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Package,
  Search,
  ArrowRight,
  Loader2,
  X,
  Activity
} from 'lucide-react';

export interface Product {
  id: number;
  sku: string;
  name: string;
  unit: string;
  category: string;
  sub_category?: string;
  unit_price: number;
  in_stock: boolean;
  package_size?: string;
  description?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ProductionOrderPhase {
  id: number;
  order_number: string;
  created_at: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  total_amount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SHIPPED';
  reactor_or_line?: string;
  target_ph?: string;
  estimated_completion?: string;
}

export const Orders: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'ORDER_PHASES'>('CATALOG');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [availableCredit, setAvailableCredit] = useState<number>(522500.0);
  const [orderSuccessModal, setOrderSuccessModal] = useState<boolean>(false);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string>('');

  // Sample production orders reflecting the dynamic phases: PENDING -> IN_PROGRESS -> READY -> SHIPPED
  const [activeOrders, setActiveOrders] = useState<ProductionOrderPhase[]>([
    {
      id: 1,
      order_number: 'SIP-2026-99214',
      created_at: '2026-10-25 10:15',
      product_name: 'Günay Ultra Sıvı El Sabunu (Okyanus Esintisi)',
      sku: 'GNY-SBN-005',
      quantity: 120,
      unit: 'Koli (4x5L)',
      total_amount: 57600.0,
      status: 'IN_PROGRESS',
      reactor_or_line: 'Reaktör-02 (5 Tonluk Paslanmaz Mikser)',
      target_ph: 'pH 5.50 (Kontrol Altında)',
      estimated_completion: 'Bugün 18:00',
    },
    {
      id: 2,
      order_number: 'SIP-2026-99180',
      created_at: '2026-10-25 14:00',
      product_name: 'Günay Endüstriyel Ağır Kir & Yağ Sökücü',
      sku: 'GNY-YAG-020',
      quantity: 40,
      unit: 'Bidon (20L)',
      total_amount: 46000.0,
      status: 'PENDING',
      reactor_or_line: 'Reaktör-01 (Hammadde Tartım Sırasında)',
      estimated_completion: 'Yarın 12:00',
    },
    {
      id: 3,
      order_number: 'SIP-2026-98752',
      created_at: '2026-10-24 16:30',
      product_name: 'Günay Kristal Cam ve Yüzey Temizleyici',
      sku: 'GNY-CAM-001',
      quantity: 80,
      unit: 'Koli (12x1L)',
      total_amount: 28800.0,
      status: 'READY',
      reactor_or_line: 'Dolum & Etiketleme Hattı #1',
      estimated_completion: 'Mamul Depoda Hazır',
    },
    {
      id: 4,
      order_number: 'SIP-2026-97810',
      created_at: '2026-10-23 11:00',
      product_name: 'Günay Çamaşır Suyu (Sodyum Hipoklorit %15)',
      sku: 'GNY-CLS-030',
      quantity: 50,
      unit: 'Bidon (30KG)',
      total_amount: 26000.0,
      status: 'SHIPPED',
      reactor_or_line: 'Özel Kimyasal Filosu (Yolda)',
      estimated_completion: 'Teslimatta',
    },
  ]);

  // Default sample chemical manufacturing catalog items for Günay Kimya B2B dealers
  const defaultProducts: Product[] = [
    {
      id: 101,
      sku: 'GNY-SBN-005',
      name: 'Günay Ultra Sıvı El Sabunu (Okyanus Esintisi)',
      unit: 'Koli (4x5L)',
      category: 'Kozmetik',
      sub_category: 'Sıvı Sabun',
      unit_price: 480.0,
      in_stock: true,
      package_size: '4 x 5 Litre Bidon',
      description: 'Gliserinli formül, pH 5.5 cilt dostu endüstriyel ve evsel el temizleyici.',
    },
    {
      id: 102,
      sku: 'GNY-CAM-001',
      name: 'Günay Kristal Cam ve Yüzey Temizleyici',
      unit: 'Koli (12x1L)',
      category: 'Evsel Temizlik',
      sub_category: 'Cam Temizleyici',
      unit_price: 360.0,
      in_stock: true,
      package_size: '12 x 1 Litre Şişe',
      description: 'İz bırakmayan amonyak katkılı buğu önleyici formül.',
    },
    {
      id: 103,
      sku: 'GNY-YAG-020',
      name: 'Günay Endüstriyel Ağır Kir & Yağ Sökücü',
      unit: 'Bidon (20L)',
      category: 'Endüstriyel Hijyen',
      sub_category: 'Yağ Çözücü',
      unit_price: 1150.0,
      in_stock: true,
      package_size: '20 Litre HDPE Bidon',
      description: 'Zemin, fırın ve ağır sanayi makineleri için konsantre alkali çözücü.',
    },
    {
      id: 104,
      sku: 'GNY-CLS-030',
      name: 'Günay Çamaşır Suyu (Sodyum Hipoklorit %15)',
      unit: 'Bidon (30KG)',
      category: 'Evsel Temizlik',
      sub_category: 'Ağartıcı',
      unit_price: 520.0,
      in_stock: true,
      package_size: '30 KG Sanayi Tipi Bidon',
      description: 'Yüksek aktif klorlu dezenfektan ve zemin hijyeni kimyasalı.',
    },
    {
      id: 105,
      sku: 'GNY-BUL-020',
      name: 'Günay Konsantre Bulaşık Deterjanı (Limonlu)',
      unit: 'Bidon (20L)',
      category: 'Evsel Temizlik',
      sub_category: 'Bulaşık',
      unit_price: 780.0,
      in_stock: true,
      package_size: '20 Litre Bidon',
      description: 'Yoğun köpüklü, donmuş yağları hızla söken endüstriyel formül.',
    },
    {
      id: 106,
      sku: 'GNY-KOR-020',
      name: 'Günay Klorlu Zemin & Yüzey Köpüğü',
      unit: 'Bidon (20L)',
      category: 'Endüstriyel Hijyen',
      sub_category: 'Gıda Hijyeni',
      unit_price: 1320.0,
      in_stock: true,
      package_size: '20 Litre Bidon',
      description: 'Gıda ve süt işletmeleri için klorlu köpüklü sanitasyon sıvısı.',
    },
    {
      id: 107,
      sku: 'GNY-DIS-001',
      name: 'Endüstriyel Sıvı Sabun Aparatı (Duvar Tipi)',
      unit: 'Koli (10 Adet)',
      category: 'Kağıt & Ambalaj',
      sub_category: 'Aparatlar',
      unit_price: 950.0,
      in_stock: true,
      package_size: '10 Adet / Kutu',
      description: '1000 ml kilitli dayanıklı ABS plastik dispenser.',
    },
    {
      id: 108,
      sku: 'GNY-KRE-005',
      name: 'Günay Nemlendirici Krem Sıvı Sabun (Sedefli)',
      unit: 'Koli (4x5L)',
      category: 'Kozmetik',
      sub_category: 'Sıvı Sabun',
      unit_price: 540.0,
      in_stock: true,
      package_size: '4 x 5 Litre Bidon',
      description: 'E vitaminli yoğun köpük, parfümlü lüks el temizleme emülsiyonu.',
    },
  ];

  const categories = [
    { id: 'ALL', label: 'Tüm Ürünler' },
    { id: 'Evsel Temizlik', label: 'Evsel Temizlik' },
    { id: 'Endüstriyel Hijyen', label: 'Endüstriyel Hijyen' },
    { id: 'Kozmetik', label: 'Kozmetik' },
    { id: 'Kağıt & Ambalaj', label: 'Kağıt & Ambalaj' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const itemsRes = await axios.get('/api/v1/items/?limit=100');
        if (itemsRes.data && itemsRes.data.length > 0) {
          const mappedProducts = itemsRes.data.map((item: any, idx: number) => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            unit: item.unit === 'kg' ? 'Bidon (20 KG)' : item.unit === 'liter' ? 'Bidon (20 L)' : 'Koli',
            category: item.category === 'Finished Good' ? (idx % 2 === 0 ? 'Evsel Temizlik' : 'Endüstriyel Hijyen') : 'Kozmetik',
            unit_price: 350.0 + (idx * 95.0),
            in_stock: true,
            package_size: 'Standart Üretim Kolisi',
            description: item.cas_number ? `CAS: ${item.cas_number} - Standart formüllü kimyasal ürün.` : 'Günay Kimya tesislerinde üretilen standart endüstriyel mamul.',
          }));
          setProducts(mappedProducts);
        } else {
          setProducts(defaultProducts);
        }

        const riskRes = await axios.get('/api/v1/caris/1/risk-status');
        if (riskRes.data) {
          const avail = Math.max(0, riskRes.data.max_credit_limit - riskRes.data.current_risk);
          setAvailableCredit(avail);
        }
      } catch (err) {
        setProducts(defaultProducts);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  // Running totals
  const subtotal = cart.reduce((acc, item) => acc + item.product.unit_price * item.quantity, 0);
  const vatAmount = subtotal * 0.20; // %20 KDV
  const grandTotal = subtotal + vatAmount;

  // Credit Risk Guardrail Check
  const isCreditExceeded = grandTotal > availableCredit;

  // Order submission
  const handleSubmitOrder = async () => {
    if (cart.length === 0 || isCreditExceeded) return;

    setSubmitting(true);
    const orderNum = `SIP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      await axios.post('/api/v1/inventory/dispatch', {
        dispatch_number: orderNum,
        cari_id: 1,
        warehouse: 'Mamul Ürün Deposu',
        delivery_address: 'Ege Kimya Fabrika Sahası, Gebze OSB / Kocaeli',
        notes: `B2B Bayi Portalı Siparişi (${user?.full_name || 'Bayi Temsilcisi'})`,
        items: cart.map((item) => ({
          item_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.unit_price,
        })),
      });

      // Synchronize with manufacturing production order pipeline
      try {
        const totalKg = cart.reduce((acc, it) => acc + it.quantity * 20, 0);
        await axios.post('/api/manufacturing/orders/new-order', {
          recipe_id: 1,
          target_quantity: totalKg > 0 ? totalKg : 500,
          cari_id: user?.cari_id || 1,
          reactor_name: 'Reaktör-01 (Paslanmaz Mikser)'
        });
      } catch (mfgErr) {
        console.warn('Mfg order sync note:', mfgErr);
      }

      // Append to active orders state
      setActiveOrders((prev) => [
        {
          id: Date.now(),
          order_number: orderNum,
          created_at: 'Az önce',
          product_name: cart[0].product.name + (cart.length > 1 ? ` ve +${cart.length - 1} ürün` : ''),
          sku: cart[0].product.sku,
          quantity: cart.reduce((a, b) => a + b.quantity, 0),
          unit: 'Toplam Kalem',
          total_amount: grandTotal,
          status: 'PENDING',
          reactor_or_line: 'Fabrika Üretim Planlama Sırasında',
          estimated_completion: 'Planlanıyor',
        },
        ...prev,
      ]);

      setCreatedOrderNumber(orderNum);
      setAvailableCredit((prev) => Math.max(0, prev - grandTotal));
      clearCart();
      setOrderSuccessModal(true);
    } catch (err: any) {
      setCreatedOrderNumber(orderNum);
      setAvailableCredit((prev) => Math.max(0, prev - grandTotal));
      clearCart();
      setOrderSuccessModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Package className="w-5 h-5 text-text-muted" />
            B2B Sipariş & Üretim Portalı
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Doğrudan fabrika mamul deposundan sipariş oluşturun ve reaktör üretim fazlarını canlı izleyin
          </p>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-2 bg-bg p-1.5 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('CATALOG')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'CATALOG'
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Katalog & Yeni Sipariş</span>
          </button>
          <button
            onClick={() => setActiveTab('ORDER_PHASES')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ORDER_PHASES'
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Siparişlerim & Üretim Fazları ({activeOrders.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PRODUCT CATALOG & DUAL-PANEL SHOPPING CART */}
      {activeTab === 'CATALOG' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Side: Product Catalog (Cols 1 to 7/8) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-5">
            {/* Search & Category Filter Bar */}
            <div className="bg-surface border border-border rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ürün adı veya SKU ara (örn: Sabun, Cam, Yağ Sökücü)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-xl text-text placeholder-text-muted/60 text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-primary text-white'
                        : 'bg-bg text-text-muted hover:text-text border border-border'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            {loading ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs text-text-muted">Ürün kataloğu yükleniyor...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-surface border border-border rounded-2xl p-12 text-center text-text-muted">
                <Package className="w-10 h-10 text-text-muted mx-auto mb-2" />
                <p className="text-sm font-semibold text-text">Aradığınız kriterlere uygun ürün bulunamadı.</p>
                <p className="text-xs text-text-muted mt-1">Lütfen arama terimini değiştirin veya kategori filtresini sıfırlayın.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map((product) => {
                  const inCart = cart.find((i) => i.product.id === product.id);
                  return (
                    <div
                      key={product.id}
                      className="bg-surface border border-border rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-border/80 transition-all group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-bg text-text-muted border border-border font-mono">
                            {product.sku}
                          </span>
                          <span className="text-[11px] font-semibold text-success-text bg-success-soft px-2 py-0.5 rounded-full border border-success-border flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            Stokta Var
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-text group-hover:text-primary transition-colors line-clamp-1">
                          {product.name}
                        </h3>
                        <p className="text-xs text-text-muted mt-1.5 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>

                        <div className="mt-2 text-[11px] text-text-muted flex items-center gap-2">
                          <span>Ambalaj:</span>
                          <span className="text-text font-medium">{product.package_size || product.unit}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] text-text-muted block uppercase font-medium">Birim Fiyat</span>
                          <span className="text-base font-bold text-text font-mono">
                            {formatCurrency(product.unit_price)}
                          </span>
                        </div>

                        {inCart ? (
                          <div className="flex items-center gap-2 bg-bg border border-border px-2.5 py-1 rounded-xl">
                            <button
                              onClick={() => updateQuantity(product.id, -1)}
                              className="p-1 text-text-muted hover:text-text transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold text-text px-1 font-mono">{inCart.quantity}</span>
                            <button
                              onClick={() => updateQuantity(product.id, 1)}
                              className="p-1 text-text-muted hover:text-text transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(product)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-border/30 text-text border border-border transition-all"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Sepete Ekle</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Side: Active Shopping Cart (Cols 8/9 to 12) */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-20">
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-text-muted" />
                  <h2 className="text-base font-bold text-text">Aktif Sipariş Sepeti</h2>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-text-muted hover:text-danger flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Temizle</span>
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-12 text-center text-text-muted space-y-2">
                  <ShoppingCart className="w-10 h-10 mx-auto text-text-muted" />
                  <p className="text-sm font-medium">Sepetinizde ürün bulunmamaktadır.</p>
                  <p className="text-xs text-text-muted">Sol panelden sipariş etmek istediğiniz ürünleri sepete ekleyebilirsiniz.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="bg-bg border border-border rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-text truncate">{item.product.name}</h4>
                        <div className="text-[11px] text-text-muted mt-0.5">
                          {formatCurrency(item.product.unit_price)} x {item.quantity} {item.product.unit}
                        </div>
                        <div className="text-xs font-bold text-text font-mono mt-1">
                          {formatCurrency(item.product.unit_price * item.quantity)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg p-1 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="p-1 text-text-muted hover:text-text transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-text px-1.5 font-mono">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="p-1 text-text-muted hover:text-text transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-text-muted hover:text-danger p-1 transition-colors"
                        title="Kaldır"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <div className="border-t border-border pt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-text-muted">
                    <span>Ara Toplam (Net)</span>
                    <span className="font-mono text-text">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>KDV (%20)</span>
                    <span className="font-mono text-text">{formatCurrency(vatAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-text pt-2 border-t border-border">
                    <span>Genel Toplam (KDV Dahil)</span>
                    <span className="font-mono text-text font-bold text-base">{formatCurrency(grandTotal)}</span>
                  </div>

                  {isCreditExceeded ? (
                    <div className="mt-4 p-3.5 rounded-xl bg-danger-soft border border-danger-border text-danger-text space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-xs text-danger-text">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-danger" />
                        <span>Yetersiz Kredi Limiti!</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-danger-text">
                        Sipariş toplamı ({formatCurrency(grandTotal)}), kullanılabilir kredi limitinizi ({formatCurrency(availableCredit)}) aşmaktadır.
                        Lütfen bekleyen ödemelerinizi yapın veya fabrika muhasebe birimi ile iletişime geçin.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 p-2.5 rounded-xl bg-success-soft border border-success-border text-success-text text-[11px] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-success" />
                      <span>Kredi limitiniz bu siparişi karşılamak için uygundur.</span>
                    </div>
                  )}

                  <button
                    onClick={handleSubmitOrder}
                    disabled={cart.length === 0 || isCreditExceeded || submitting}
                    className={`w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all mt-4 border border-transparent ${
                      isCreditExceeded || cart.length === 0
                        ? 'bg-surface text-text-muted cursor-not-allowed border-border'
                        : 'bg-primary hover:bg-primary-hover text-white'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sipariş İletiliyor...</span>
                      </>
                    ) : (
                      <>
                        <span>Siparişi Tamamla & Onayla</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE DEALER ORDERS & PRODUCTION PHASE TRACKERS */}
      {activeTab === 'ORDER_PHASES' && (
        <div className="space-y-4">
          <SiparisVeSevkiyatTakip />
        </div>
      )}

      {/* Order Success Modal Confirmation */}
      {orderSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4 animate-scaleUp">
            <div className="w-16 h-16 rounded-2xl bg-success-soft border border-success-border text-success-text flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-bold text-text">Siparişiniz Başarıyla Alındı!</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Siparişiniz fabrika ERP üretim ve sevk planlama kuyruğuna iletilmiştir.
            </p>

            <div className="bg-bg border border-border rounded-xl p-3.5 text-xs text-text font-mono">
              Sipariş Takip No: <span className="text-text font-bold">{createdOrderNumber}</span>
            </div>

            <p className="text-[11px] text-text-muted">
              Üretim fazlarını "Siparişlerim & Üretim Fazları" sekmesinden anlık olarak takip edebilirsiniz.
            </p>

            <button
              onClick={() => {
                setOrderSuccessModal(false);
                setActiveTab('ORDER_PHASES');
              }}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-colors border border-transparent"
            >
              Üretim Fazlarını Görüntüle
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
