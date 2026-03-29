/**
 * BudgetAnalyse – Soll/Ist-Vergleich mit Drill-Down und Trendanalyse
 * Professionelle Budgetabweichungsanalyse wie in Enterprise-ERP-Systemen
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Download, RefreshCw, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, LineChart, Line, ReferenceLine
} from 'recharts';

const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

interface BudgetCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  budget_amount: number;
  actual_amount: number;
  variance: number;
  variance_pct: number;
  status: 'ok' | 'warning' | 'critical';
}

interface MonthlyBudget {
  monat: string;
  budgetEinnahmen: number;
  istEinnahmen: number;
  budgetAusgaben: number;
  istAusgaben: number;
  varianzEinnahmen: number;
  varianzAusgaben: number;
}

export default function BudgetAnalyse() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyBudget[]>([]);
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [monat, setMonat] = useState(new Date().getMonth());
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const startDate = `${jahr}-01-01`;
      const endDate = `${jahr}-12-31`;
      const monatStart = `${jahr}-${String(monat + 1).padStart(2, '0')}-01`;
      const monatEnd = new Date(jahr, monat + 1, 0).toISOString().split('T')[0];

      // Budgets aus Budget-Tabelle
      const { data: budgets } = await supabase
        .from('budgets')
        .select('id, category, type, amount, period')
        .eq('company_id', currentCompany.id);

      // Ist-Transaktionen des Monats
      const { data: txMonth } = await supabase
        .from('transactions')
        .select('amount, type, category')
        .eq('company_id', currentCompany.id)
        .gte('date', monatStart)
        .lte('date', monatEnd);

      // Ist-Transaktionen des Jahres (für Monatstrend)
      const { data: txYear } = await supabase
        .from('transactions')
        .select('amount, type, date, category')
        .eq('company_id', currentCompany.id)
        .gte('date', startDate)
        .lte('date', endDate);

      // Kategorien aggregieren
      const categoryMap = new Map<string, { budget: number; actual: number; type: 'income' | 'expense' }>();

      (budgets || []).forEach(b => {
        const key = `${b.category}_${b.type}`;
        const existing = categoryMap.get(key) || { budget: 0, actual: 0, type: b.type as 'income' | 'expense' };
        const monthlyBudget = b.period === 'monthly' ? b.amount : b.period === 'quarterly' ? b.amount / 3 : b.amount / 12;
        categoryMap.set(key, { ...existing, budget: existing.budget + monthlyBudget });
      });

      (txMonth || []).forEach(t => {
        const key = `${t.category || 'Sonstiges'}_${t.type}`;
        const existing = categoryMap.get(key) || { budget: 0, actual: 0, type: t.type as 'income' | 'expense' };
        categoryMap.set(key, { ...existing, actual: existing.actual + Math.abs(t.amount || 0) });
      });

      const cats: BudgetCategory[] = Array.from(categoryMap.entries()).map(([key, v]) => {
        const [name] = key.split('_');
        const variance = v.type === 'income' ? v.actual - v.budget : v.budget - v.actual;
        const variancePct = v.budget > 0 ? (variance / v.budget) * 100 : 0;
        return {
          id: key,
          name: name || 'Sonstiges',
          type: v.type,
          budget_amount: v.budget,
          actual_amount: v.actual,
          variance,
          variance_pct: variancePct,
          status: variancePct >= 0 ? 'ok' : variancePct >= -20 ? 'warning' : 'critical',
        };
      }).filter(c => c.budget_amount > 0 || c.actual_amount > 0);

      setCategories(cats);

      // Monatstrend
      const monthly: MonthlyBudget[] = Array.from({ length: 12 }, (_, i) => {
        const mStart = `${jahr}-${String(i + 1).padStart(2, '0')}-01`;
        const mEnd = new Date(jahr, i + 1, 0).toISOString().split('T')[0];
        const mTx = (txYear || []).filter(t => t.date >= mStart && t.date <= mEnd);
        const istEin = mTx.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
        const istAus = mTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
        const budgetEin = (budgets || []).filter(b => b.type === 'income').reduce((s, b) => {
          const monthly = b.period === 'monthly' ? b.amount : b.period === 'quarterly' ? b.amount / 3 : b.amount / 12;
          return s + monthly;
        }, 0);
        const budgetAus = (budgets || []).filter(b => b.type === 'expense').reduce((s, b) => {
          const monthly = b.period === 'monthly' ? b.amount : b.period === 'quarterly' ? b.amount / 3 : b.amount / 12;
          return s + monthly;
        }, 0);
        return {
          monat: MONTHS[i],
          budgetEinnahmen: budgetEin,
          istEinnahmen: istEin,
          budgetAusgaben: budgetAus,
          istAusgaben: istAus,
          varianzEinnahmen: istEin - budgetEin,
          varianzAusgaben: budgetAus - istAus,
        };
      });
      setMonthlyData(monthly);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany, jahr, monat]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpis = useMemo(() => {
    const einnahmen = categories.filter(c => c.type === 'income');
    const ausgaben = categories.filter(c => c.type === 'expense');
    return {
      budgetEin: einnahmen.reduce((s, c) => s + c.budget_amount, 0),
      istEin: einnahmen.reduce((s, c) => s + c.actual_amount, 0),
      budgetAus: ausgaben.reduce((s, c) => s + c.budget_amount, 0),
      istAus: ausgaben.reduce((s, c) => s + c.actual_amount, 0),
      kritisch: categories.filter(c => c.status === 'critical').length,
      warnung: categories.filter(c => c.status === 'warning').length,
    };
  }, [categories]);

  const exportCSV = () => {
    const rows = [
      ['Kategorie', 'Typ', 'Budget', 'Ist', 'Abweichung', 'Abweichung %', 'Status'],
      ...categories.map(c => [c.name, c.type === 'income' ? 'Einnahme' : 'Ausgabe', c.budget_amount.toFixed(2), c.actual_amount.toFixed(2), c.variance.toFixed(2), c.variance_pct.toFixed(1) + '%', c.status]),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `BudgetAnalyse_${jahr}_${monat + 1}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Budgetanalyse
          </h1>
          <p className="text-muted-foreground">Soll/Ist-Vergleich mit Abweichungsanalyse und Trenddarstellung</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(monat)} onValueChange={v => setMonat(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(jahr)} onValueChange={v => setJahr(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[jahr - 1, jahr, jahr + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" />Aktualisieren</Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Einnahmen Budget</p>
          <p className="text-xl font-bold">{fmt(kpis.budgetEin)}</p>
          <p className={`text-sm font-medium ${kpis.istEin >= kpis.budgetEin ? 'text-green-600' : 'text-red-600'}`}>
            Ist: {fmt(kpis.istEin)} ({fmtPct(kpis.budgetEin > 0 ? ((kpis.istEin - kpis.budgetEin) / kpis.budgetEin) * 100 : 0)})
          </p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Ausgaben Budget</p>
          <p className="text-xl font-bold">{fmt(kpis.budgetAus)}</p>
          <p className={`text-sm font-medium ${kpis.istAus <= kpis.budgetAus ? 'text-green-600' : 'text-red-600'}`}>
            Ist: {fmt(kpis.istAus)} ({fmtPct(kpis.budgetAus > 0 ? ((kpis.budgetAus - kpis.istAus) / kpis.budgetAus) * 100 : 0)})
          </p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <p className="text-xs text-muted-foreground">Kritische Abweichungen</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{kpis.kritisch}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
            <p className="text-xs text-muted-foreground">Warnungen</p>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{kpis.warnung}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="kategorien">
        <TabsList>
          <TabsTrigger value="kategorien">Kategorien</TabsTrigger>
          <TabsTrigger value="trend">Jahrestrend</TabsTrigger>
          <TabsTrigger value="waterfall">Wasserfall</TabsTrigger>
        </TabsList>

        {/* Kategorien */}
        <TabsContent value="kategorien" className="space-y-3">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : categories.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Keine Budgets definiert. Erstellen Sie Budgets unter Budgetverwaltung.</p>
              <Button variant="outline" className="mt-3" onClick={() => window.location.href = '/budget'}>Zur Budgetverwaltung</Button>
            </CardContent></Card>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Einnahmen</h3>
              {categories.filter(c => c.type === 'income').sort((a, b) => a.variance_pct - b.variance_pct).map(cat => (
                <Card key={cat.id} className={`${cat.status === 'critical' ? 'border-red-200 dark:border-red-800' : cat.status === 'warning' ? 'border-yellow-200 dark:border-yellow-800' : ''}`}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {cat.status === 'critical' ? <AlertTriangle className="h-4 w-4 text-red-500" /> : cat.status === 'warning' ? <AlertTriangle className="h-4 w-4 text-yellow-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        <span className="font-medium text-sm">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{fmt(cat.actual_amount)} / {fmt(cat.budget_amount)}</span>
                        <Badge variant={cat.variance >= 0 ? 'default' : cat.status === 'critical' ? 'destructive' : 'outline'} className="text-xs">
                          {fmtPct(cat.variance_pct)}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={Math.min(100, (cat.actual_amount / Math.max(1, cat.budget_amount)) * 100)} className={`h-2 ${cat.status === 'critical' ? '[&>div]:bg-red-500' : cat.status === 'warning' ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`} />
                  </CardContent>
                </Card>
              ))}

              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mt-4">Ausgaben</h3>
              {categories.filter(c => c.type === 'expense').sort((a, b) => a.variance_pct - b.variance_pct).map(cat => (
                <Card key={cat.id} className={`${cat.status === 'critical' ? 'border-red-200 dark:border-red-800' : cat.status === 'warning' ? 'border-yellow-200 dark:border-yellow-800' : ''}`}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {cat.status === 'critical' ? <AlertTriangle className="h-4 w-4 text-red-500" /> : cat.status === 'warning' ? <AlertTriangle className="h-4 w-4 text-yellow-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        <span className="font-medium text-sm">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{fmt(cat.actual_amount)} / {fmt(cat.budget_amount)}</span>
                        <Badge variant={cat.variance >= 0 ? 'default' : cat.status === 'critical' ? 'destructive' : 'outline'} className="text-xs">
                          {fmtPct(cat.variance_pct)}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={Math.min(100, (cat.actual_amount / Math.max(1, cat.budget_amount)) * 100)} className={`h-2 ${cat.status === 'critical' ? '[&>div]:bg-red-500' : cat.status === 'warning' ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`} />
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* Jahrestrend */}
        <TabsContent value="trend">
          <Card>
            <CardHeader><CardTitle className="text-base">Einnahmen: Budget vs. Ist (monatlich)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monat" />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="budgetEinnahmen" name="Budget" fill="#6366f1" opacity={0.5} />
                  <Bar dataKey="istEinnahmen" name="Ist" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Ausgaben: Budget vs. Ist (monatlich)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monat" />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="budgetAusgaben" name="Budget" fill="#6366f1" opacity={0.5} />
                  <Bar dataKey="istAusgaben" name="Ist" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wasserfall */}
        <TabsContent value="waterfall">
          <Card>
            <CardHeader><CardTitle className="text-base">Abweichungen nach Monat</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monat" />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <ReferenceLine y={0} stroke="#666" />
                  <Bar dataKey="varianzEinnahmen" name="Einnahmen-Abw." fill="#10b981">
                    {monthlyData.map((d, i) => <Cell key={i} fill={d.varianzEinnahmen >= 0 ? '#10b981' : '#ef4444'} />)}
                  </Bar>
                  <Bar dataKey="varianzAusgaben" name="Ausgaben-Abw." fill="#6366f1">
                    {monthlyData.map((d, i) => <Cell key={i} fill={d.varianzAusgaben >= 0 ? '#6366f1' : '#f97316'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
