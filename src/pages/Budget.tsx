/**
 * Budget – Vollständige Budgetverwaltung
 *
 * Features:
 * - Monats-/Jahresbudgets pro Kategorie
 * - Echtzeit-Vergleich mit tatsächlichen Ausgaben aus Supabase
 * - Fortschrittsbalken mit Farbcodierung (grün/gelb/rot)
 * - Warnungen bei Überschreitung
 * - Budget-Zusammenfassung KPI-Karten
 * - Historischer Vergleich (letzter Monat)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, AlertTriangle, CheckCircle, TrendingUp,
  TrendingDown, PiggyBank, Target, BarChart3, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';

interface Budget {
  id: string;
  company_id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'yearly';
  alert_threshold: number; // Prozent (z.B. 80 = Warnung bei 80%)
  color?: string;
  created_at: string;
}

interface BudgetWithActual extends Budget {
  actual: number;
  actualLastPeriod: number;
  percentage: number;
  remaining: number;
  status: 'ok' | 'warning' | 'exceeded';
}

const EXPENSE_CATEGORIES = [
  'Büromaterial', 'Software & IT', 'Reisekosten', 'Bewirtung', 'Telekommunikation',
  'Miete & Nebenkosten', 'Fahrzeugkosten', 'Versicherungen', 'Werbung & Marketing',
  'Personalkosten', 'Waren & Material', 'Dienstleistungen', 'Sonstige Ausgaben',
  'Lebensmittel', 'Elektronik', 'Post & Versand', 'Steuerberatung', 'Bankgebühren',
];

const CATEGORY_COLORS: Record<string, string> = {
  'Büromaterial': '#3b82f6', 'Software & IT': '#8b5cf6', 'Reisekosten': '#f59e0b',
  'Bewirtung': '#10b981', 'Telekommunikation': '#06b6d4', 'Miete & Nebenkosten': '#ef4444',
  'Fahrzeugkosten': '#f97316', 'Versicherungen': '#84cc16', 'Werbung & Marketing': '#ec4899',
  'Personalkosten': '#6366f1', 'Waren & Material': '#14b8a6', 'Dienstleistungen': '#a855f7',
  'Sonstige Ausgaben': '#94a3b8',
};

const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);

export default function Budget() {
  const { currentCompany } = useCompany();
  const [budgets, setBudgets] = useState<BudgetWithActual[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showChart, setShowChart] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);

  // Form state
  const [formCategory, setFormCategory] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPeriod, setFormPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [formThreshold, setFormThreshold] = useState('80');

  const fetchBudgets = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);

    // Budgets laden
    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('category');

    if (!budgetData) { setLoading(false); return; }

    // Zeitraum berechnen
    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const lastMonthStart = new Date(year, month - 2, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(year, month - 1, 0).toISOString().split('T')[0];

    // Aktuelle Ausgaben pro Kategorie
    const { data: txData } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('company_id', currentCompany.id)
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate);

    // Vormonat-Ausgaben
    const { data: lastTxData } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('company_id', currentCompany.id)
      .eq('type', 'expense')
      .gte('date', lastMonthStart)
      .lte('date', lastMonthEnd);

    const actualByCategory: Record<string, number> = {};
    const lastActualByCategory: Record<string, number> = {};

    (txData || []).forEach((tx) => {
      const cat = tx.category || 'Sonstige Ausgaben';
      actualByCategory[cat] = (actualByCategory[cat] || 0) + tx.amount;
    });
    (lastTxData || []).forEach((tx) => {
      const cat = tx.category || 'Sonstige Ausgaben';
      lastActualByCategory[cat] = (lastActualByCategory[cat] || 0) + tx.amount;
    });

    const enriched: BudgetWithActual[] = budgetData.map((b) => {
      const actual = actualByCategory[b.category] || 0;
      const actualLastPeriod = lastActualByCategory[b.category] || 0;
      const budgetAmount = b.period === 'yearly' ? b.amount / 12 : b.amount;
      const percentage = budgetAmount > 0 ? Math.round((actual / budgetAmount) * 100) : 0;
      const remaining = budgetAmount - actual;
      const status: BudgetWithActual['status'] =
        percentage >= 100 ? 'exceeded' : percentage >= b.alert_threshold ? 'warning' : 'ok';
      return { ...b, actual, actualLastPeriod, percentage, remaining, status };
    });

    setBudgets(enriched);

    // Chart-Daten: letzte 6 Monate
    const chartMonths: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const mStart = d.toISOString().split('T')[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const { data: mTx } = await supabase
        .from('transactions')
        .select('category, amount')
        .eq('company_id', currentCompany.id)
        .eq('type', 'expense')
        .gte('date', mStart)
        .lte('date', mEnd);
      const total = (mTx || []).reduce((s, t) => s + t.amount, 0);
      const budgetTotal = budgetData.reduce((s, b) => s + (b.period === 'yearly' ? b.amount / 12 : b.amount), 0);
      chartMonths.push({
        month: d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        Ausgaben: Math.round(total),
        Budget: Math.round(budgetTotal),
      });
    }
    setChartData(chartMonths);
    setLoading(false);
  }, [currentCompany, selectedMonth]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const handleSave = async () => {
    if (!currentCompany || !formCategory || !formAmount) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    const payload = {
      company_id: currentCompany.id,
      category: formCategory,
      amount: parseFloat(formAmount.replace(',', '.')),
      period: formPeriod,
      alert_threshold: parseInt(formThreshold),
    };
    if (editingBudget) {
      const { error } = await supabase.from('budgets').update(payload).eq('id', editingBudget.id);
      if (error) { toast.error('Fehler beim Speichern'); return; }
      toast.success('Budget aktualisiert');
    } else {
      const { error } = await supabase.from('budgets').insert(payload);
      if (error) { toast.error('Fehler beim Speichern'); return; }
      toast.success('Budget erstellt');
    }
    setDialogOpen(false);
    resetForm();
    fetchBudgets();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Budget gelöscht');
    fetchBudgets();
  };

  const openEdit = (b: BudgetWithActual) => {
    setEditingBudget(b);
    setFormCategory(b.category);
    setFormAmount(String(b.amount));
    setFormPeriod(b.period);
    setFormThreshold(String(b.alert_threshold));
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingBudget(null);
    setFormCategory('');
    setFormAmount('');
    setFormPeriod('monthly');
    setFormThreshold('80');
  };

  const totalBudget = budgets.reduce((s, b) => s + (b.period === 'yearly' ? b.amount / 12 : b.amount), 0);
  const totalActual = budgets.reduce((s, b) => s + b.actual, 0);
  const totalPercentage = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const exceededCount = budgets.filter((b) => b.status === 'exceeded').length;
  const warningCount = budgets.filter((b) => b.status === 'warning').length;

  const getProgressColor = (status: string) => {
    if (status === 'exceeded') return 'bg-destructive';
    if (status === 'warning') return 'bg-warning';
    return 'bg-success';
  };

  // Monate für Selektor
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    return { val, label };
  });

  if (!currentCompany) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Budgetverwaltung</h1>
          <p className="text-muted-foreground">Kategoriebudgets planen und Ausgaben überwachen</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44 bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Budget hinzufügen
          </Button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Target className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Gesamtbudget (Monat)</p>
              <p className="text-xl font-bold">{fmt(totalBudget)}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10"><TrendingUp className="h-5 w-5 text-info" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Tatsächliche Ausgaben</p>
              <p className="text-xl font-bold">{fmt(totalActual)}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${totalPercentage >= 100 ? 'bg-destructive/10' : totalPercentage >= 80 ? 'bg-warning/10' : 'bg-success/10'}`}>
              <PiggyBank className={`h-5 w-5 ${totalPercentage >= 100 ? 'text-destructive' : totalPercentage >= 80 ? 'text-warning' : 'text-success'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Budget genutzt</p>
              <p className="text-xl font-bold">{totalPercentage}%</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${exceededCount > 0 ? 'bg-destructive/10' : warningCount > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
              {exceededCount > 0 ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <CheckCircle className="h-5 w-5 text-success" />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Warnungen</p>
              <p className="text-xl font-bold">
                {exceededCount > 0 ? `${exceededCount} überschritten` : warningCount > 0 ? `${warningCount} Warnung${warningCount > 1 ? 'en' : ''}` : 'Alles OK'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Verlaufs-Chart */}
      <div className="glass rounded-xl p-4">
        <button
          className="flex items-center gap-2 text-sm font-semibold w-full text-left"
          onClick={() => setShowChart(!showChart)}
        >
          <BarChart3 className="h-4 w-4 text-primary" />
          6-Monats-Verlauf: Budget vs. Ausgaben
          {showChart ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
        </button>
        {showChart && (
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Budget" fill="hsl(var(--primary))" opacity={0.4} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Ausgaben" fill="hsl(var(--destructive))" opacity={0.8} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Budget-Liste */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="glass rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-muted" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
              <div className="h-2 bg-muted rounded w-full mb-2" />
              <div className="flex justify-between">
                <div className="h-3 bg-muted rounded w-1/4" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Noch keine Budgets definiert</h3>
          <p className="text-muted-foreground mb-4">Legen Sie Budgets für Ihre Ausgabenkategorien fest, um Ihre Finanzen im Griff zu behalten.</p>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Erstes Budget erstellen
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map((b) => {
            const monthlyBudget = b.period === 'yearly' ? b.amount / 12 : b.amount;
            const color = CATEGORY_COLORS[b.category] || '#94a3b8';
            return (
              <div key={b.id} className={`glass rounded-xl p-4 border-l-4 ${b.status === 'exceeded' ? 'border-destructive' : b.status === 'warning' ? 'border-warning' : 'border-success'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <div>
                      <p className="font-semibold">{b.category}</p>
                      <p className="text-xs text-muted-foreground">{b.period === 'yearly' ? 'Jahresbudget' : 'Monatsbudget'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {b.status === 'exceeded' && <Badge variant="destructive" className="text-xs">Überschritten</Badge>}
                    {b.status === 'warning' && <Badge className="bg-warning/20 text-warning text-xs">Warnung</Badge>}
                    {b.status === 'ok' && <Badge className="bg-success/20 text-success text-xs">OK</Badge>}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(b)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(b.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Fortschrittsbalken */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{fmt(b.actual)} ausgegeben</span>
                    <span className="font-medium">{b.percentage}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(b.status)}`}
                      style={{ width: `${Math.min(b.percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Budget: {fmt(monthlyBudget)}</span>
                  <span className={b.remaining < 0 ? 'text-destructive font-medium' : 'text-success font-medium'}>
                    {b.remaining < 0 ? `${fmt(Math.abs(b.remaining))} über Budget` : `${fmt(b.remaining)} verbleibend`}
                  </span>
                </div>

                {/* Vormonatsvergleich */}
                {b.actualLastPeriod > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    {b.actual > b.actualLastPeriod
                      ? <TrendingUp className="h-3 w-3 text-destructive" />
                      : <TrendingDown className="h-3 w-3 text-success" />}
                    <span>
                      Vormonat: {fmt(b.actualLastPeriod)}
                      {' '}({b.actual > b.actualLastPeriod ? '+' : ''}{Math.round(((b.actual - b.actualLastPeriod) / b.actualLastPeriod) * 100)}%)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Budget bearbeiten' : 'Neues Budget'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Kategorie *</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Betrag (€) *</Label>
                <Input
                  className="mt-1"
                  type="text"
                  inputMode="decimal"
                  placeholder="500,00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Zeitraum</Label>
                <Select value={formPeriod} onValueChange={(v) => setFormPeriod(v as 'monthly' | 'yearly')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monatlich</SelectItem>
                    <SelectItem value="yearly">Jährlich</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Warnschwelle: {formThreshold}%</Label>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={formThreshold}
                onChange={(e) => setFormThreshold(e.target.value)}
                className="w-full mt-2 accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>50%</span><span>Warnung bei {formThreshold}%</span><span>95%</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Abbrechen</Button>
            <Button onClick={handleSave}>{editingBudget ? 'Aktualisieren' : 'Erstellen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
