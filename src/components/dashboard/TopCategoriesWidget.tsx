import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface CategoryData {
  category: string;
  total: number;
  count: number;
  type: 'income' | 'expense';
  change?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Umsatzerlöse': 'bg-green-500',
  'Sonstige Einnahmen': 'bg-emerald-500',
  'Miete': 'bg-blue-500',
  'Personal': 'bg-purple-500',
  'Marketing': 'bg-orange-500',
  'IT & Software': 'bg-cyan-500',
  'Bürobedarf': 'bg-yellow-500',
  'Fahrtkosten': 'bg-pink-500',
  'Versicherungen': 'bg-indigo-500',
  'Steuerberater': 'bg-teal-500',
  'Bankgebühren': 'bg-red-500',
  'Sonstige Ausgaben': 'bg-gray-500',
};

export function TopCategoriesWidget() {
  const { currentCompany } = useCompany();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'expense' | 'income'>('expense');

  useEffect(() => {
    if (!currentCompany) return;
    loadCategories();
  }, [currentCompany]);

  const loadCategories = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const { data } = await supabase
        .from('transactions')
        .select('category, amount, type')
        .eq('company_id', currentCompany.id)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth);

      if (!data) return;

      // Group by category
      const grouped: Record<string, { total: number; count: number; type: string }> = {};
      data.forEach((t) => {
        const key = t.category || 'Sonstige';
        if (!grouped[key]) grouped[key] = { total: 0, count: 0, type: t.type };
        grouped[key].total += Math.abs(t.amount);
        grouped[key].count += 1;
      });

      const result: CategoryData[] = Object.entries(grouped)
        .map(([category, { total, count, type }]) => ({
          category,
          total,
          count,
          type: type === 'income' ? 'income' : 'expense',
        }))
        .sort((a, b) => b.total - a.total);

      setCategories(result);
    } catch (err) {
      console.error('TopCategoriesWidget error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = categories.filter((c) => c.type === view);
  const maxValue = Math.max(...filtered.map((c) => c.total), 1);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Top Kategorien (Monat)</h3>
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
          <button
            onClick={() => setView('expense')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              view === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Ausgaben
          </button>
          <button
            onClick={() => setView('income')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              view === 'income' ? 'bg-green-500/20 text-green-400' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Einnahmen
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex justify-between mb-1">
                <div className="h-3 bg-secondary rounded w-24" />
                <div className="h-3 bg-secondary rounded w-16" />
              </div>
              <div className="h-2 bg-secondary rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {view === 'expense' ? 'Keine Ausgaben' : 'Keine Einnahmen'} in diesem Monat
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, 6).map(({ category, total, count }) => {
            const barWidth = (total / maxValue) * 100;
            const color = CATEGORY_COLORS[category] || 'bg-primary';
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate max-w-[60%]">{category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{count}×</span>
                    <span className={`text-xs font-bold font-mono ${view === 'expense' ? 'text-red-400' : 'text-green-400'}`}>
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Total */}
      {filtered.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {view === 'expense' ? (
              <TrendingDown className="h-3 w-3 text-red-400" />
            ) : (
              <TrendingUp className="h-3 w-3 text-green-400" />
            )}
            <span>Gesamt {view === 'expense' ? 'Ausgaben' : 'Einnahmen'}</span>
          </div>
          <span className={`text-sm font-bold font-mono ${view === 'expense' ? 'text-red-400' : 'text-green-400'}`}>
            {formatCurrency(filtered.reduce((s, c) => s + c.total, 0))}
          </span>
        </div>
      )}
    </div>
  );
}
