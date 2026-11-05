import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  GitCommit,
  RefreshCw,
  Search,
  ArrowRight,
} from 'lucide-react';

interface MovementItem {
  id: number;
  personnel_id: number;
  personnel_name: string;
  department: string;
  movement_type: string;
  movement_date: string;
  old_value?: string | null;
  new_value?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export const HRMovements: React.FC = () => {
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/v1/hr/movements');
      setMovements(res.data || []);
    } catch (err: any) {
      console.error('Personel hareketleri yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  const filteredMovements = movements.filter(m => {
    if (typeFilter !== 'ALL' && m.movement_type !== typeFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.personnel_name.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q) ||
      (m.notes && m.notes.toLowerCase().includes(q))
    );
  });

  const getBadgeStyle = (mType: string) => {
    switch (mType) {
      case 'İşe Giriş':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Terfi':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Departman Değişikliği':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Unvan Değişikliği':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'İşten Çıkış':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <GitCommit className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-800">Personel Hareketleri (Özlük Kütüğü)</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            İşe alım, terfi, departman aktarımı, unvan revizyonu ve kariyer hareketleri kronolojik kaydı
          </p>
        </div>

        <button
          onClick={fetchMovements}
          disabled={loading}
          className="p-2.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          title="Yenile"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Personel adı, departman veya açıklama ile ara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">Tüm Hareket Tipleri</option>
          <option value="İşe Giriş">İşe Giriş</option>
          <option value="Terfi">Terfi</option>
          <option value="Departman Değişikliği">Departman Değişikliği</option>
          <option value="Unvan Değişikliği">Unvan Değişikliği</option>
          <option value="İşten Çıkış">İşten Çıkış</option>
        </select>
      </div>

      {/* Movement List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">İşlem Tarihi</th>
                <th className="px-6 py-3.5">Personel</th>
                <th className="px-6 py-3.5">Departman</th>
                <th className="px-6 py-3.5">Hareket Tipi</th>
                <th className="px-6 py-3.5">Değişiklik Detayı</th>
                <th className="px-6 py-3.5">Açıklama / Gerekçe</th>
                <th className="px-6 py-3.5 text-right">İşlemi Yapan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Hareket geçmişi yükleniyor...
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Kayıtlı personel hareketi bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredMovements.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-mono text-slate-900 whitespace-nowrap">
                      {item.movement_date}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {item.personnel_name}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {item.department}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle(
                          item.movement_type
                        )}`}
                      >
                        {item.movement_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {item.old_value && (
                        <span className="text-slate-400 line-through mr-1.5">
                          {item.old_value}
                        </span>
                      )}
                      {item.old_value && item.new_value && (
                        <ArrowRight className="inline w-3 h-3 text-slate-400 mr-1.5" />
                      )}
                      <span className="font-semibold text-slate-800">
                        {item.new_value || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 max-w-sm truncate">
                      {item.notes || '-'}
                    </td>
                    <td className="px-6 py-4 text-xs text-right text-slate-400">
                      {item.created_by || 'Sistem'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HRMovements;
