import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle, Info, TrendingUp, TrendingDown,
  Clock, FileText, Wallet, Calendar, ChevronRight, RefreshCw,
  Lightbulb, ShieldCheck, Calculator, ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface OpenInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  contact_name?: string;
  status: string;
  overdue: boolean;
  daysUntilDue: number;
}

interface LiquidityBar {
  label: string;
  einnahmen: number;
  ausgaben: number;
  saldo: number;
}

interface TaxHint {
  id: string;
  severity: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  action?: string;
  actionUrl?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const fmtFull = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);

export default function FinanceCockpit() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [liquidityData, setLiquidityData] = useState<LiquidityBar[]>([]);
  const [bankBalance, setBankBalance] = useState(0);
  const [monthlyAvgIncome, setMonthlyAvgIncome] = useState(0);
  const [monthlyAvgExpense, setMonthlyAvgExpense] = useState(0);
  const [recurringExpenses, setRecurringExpenses] = useState(0);
  const [taxHints, setTaxHints] = useState<TaxHint[]>([]);

  useEffect(() => {
    if (currentCompany) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id]);

  const fetchData = async () => {
    if (!currentCompany) return;
    setLoading(true);
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

    const [bankRes, invoicesRes, txRes, recurringRes] = await Promise.all([
      supabase.from('bank_accounts').select('balance').eq('company_id', currentCompany.id),
      supabase.from('invoices').select('id, invoice_number, amount, due_date, status, contacts(name)')
        .eq('company_id', currentCompany.id)
        .in('status', ['sent', 'overdue', 'draft'])
        .order('due_date', { ascending: true }),
      supabase.from('transactions').select('amount, type, date')
        .eq('company_id', currentCompany.id)
        .gte('date', sixMonthsAgo)
        .order('date', { ascending: true }),
      supabase.from('recurring_transactions').select('amount, type')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true),
    ]);

    // Bank balance
    const balance = bankRes.data?.reduce((s, a) => s + Number(a.balance || 0), 0) || 0;
    setBankBalance(balance);

    // Open invoices
    const today = new Date();
    const invoiceList: OpenInvoice[] = (invoicesRes.data || []).map((inv) => {
      const due = new Date(inv.due_date || today);
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount: Number(inv.amount),
        due_date: inv.due_date || '',
        contact_name: (inv.contacts as { name?: string } | null)?.name,
        status: inv.status,
        overdue: diff < 0,
        daysUntilDue: diff,
      };
    });
    setOpenInvoices(invoiceList);

    // Monthly liquidity (last 6 months + next 3 months projection)
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const txData = txRes.data || [];
    const monthlyMap = new Map<string, { einnahmen: number; ausgaben: number }>();

    // Past 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear() !== now.getFullYear() ? d.getFullYear() : ''}`.trim();
      monthlyMap.set(key, { einnahmen: 0, ausgaben: 0 });
    }

    txData.forEach((tx) => {
      const d = new Date(tx.date);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear() !== now.getFullYear() ? d.getFullYear() : ''}`.trim();
      if (monthlyMap.has(key)) {
        const cur = monthlyMap.get(key)!;
        if (tx.type === 'income') cur.einnahmen += Number(tx.amount);
        else cur.ausgaben += Number(tx.amount);
      }
    });

    const bars: LiquidityBar[] = Array.from(monthlyMap.entries()).map(([label, d]) => ({
      label, einnahmen: d.einnahmen, ausgaben: d.ausgaben, saldo: d.einnahmen - d.ausgaben,
    }));

    // Calculate averages from last 3 months
    const last3 = bars.slice(-3);
    const avgIncome = last3.reduce((s, b) => s + b.einnahmen, 0) / 3;
    const avgExpense = last3.reduce((s, b) => s + b.ausgaben, 0) / 3;
    setMonthlyAvgIncome(avgIncome);
    setMonthlyAvgExpense(avgExpense);

    // Add 3-month projection
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${monthNames[d.getMonth()]} →`;
      bars.push({ label: key, einnahmen: avgIncome, ausgaben: avgExpense, saldo: avgIncome - avgExpense });
    }
    setLiquidityData(bars);

    // Recurring expenses
    const recExp = (recurringRes.data || [])
      .filter((r) => r.type === 'expense')
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    setRecurringExpenses(recExp);

    // Generate tax hints
    generateTaxHints(invoiceList, balance, avgIncome, avgExpense, recExp, yearStart, txData);
    setLoading(false);
  };

  const generateTaxHints = (
    invoices: OpenInvoice[],
    balance: number,
    avgIncome: number,
    avgExpense: number,
    recurring: number,
    yearStart: string,
    txData: { amount: number; type: string; date: string }[]
  ) => {
    const hints: TaxHint[] = [];
    const now = new Date();
    const month = now.getMonth() + 1;

    // Überfällige Rechnungen
    const overdueCount = invoices.filter((i) => i.overdue).length;
    const overdueSum = invoices.filter((i) => i.overdue).reduce((s, i) => s + i.amount, 0);
    if (overdueCount > 0) {
      hints.push({
        id: 'overdue', severity: 'warning',
        title: `${overdueCount} überfällige Rechnung${overdueCount > 1 ? 'en' : ''}`,
        description: `Offener Betrag: ${fmtFull(overdueSum)}. Mahnung versenden oder Zahlungseingang prüfen.`,
        action: 'Zu Rechnungen', actionUrl: '/rechnungen',
      });
    }

    // Liquiditätswarnung
    const monthlyNet = avgIncome - avgExpense;
    if (balance < recurring * 2) {
      hints.push({
        id: 'liquidity', severity: 'warning',
        title: 'Liquiditätsrisiko',
        description: `Kontostand (${fmt(balance)}) deckt weniger als 2 Monatsfixkosten. Liquiditätsreserve aufbauen.`,
        action: 'Cashflow-Prognose', actionUrl: '/',
      });
    }

    // UStVA-Erinnerung (10. des Folgemonats)
    const day = now.getDate();
    if (day >= 1 && day <= 12) {
      hints.push({
        id: 'ustVA', severity: 'info',
        title: `UStVA für ${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][month - 2] || 'Vormonat'} fällig`,
        description: `Abgabefrist: 10. des Monats. Voranmeldung über ELSTER einreichen.`,
        action: 'Zu ELSTER', actionUrl: '/elster',
      });
    }

    // Jahresabschluss-Hinweis (Nov/Dez)
    if (month >= 11) {
      hints.push({
        id: 'yearend', severity: 'info',
        title: 'Jahresabschluss vorbereiten',
        description: 'Alle Belege erfassen, Abschreibungen prüfen, Inventur durchführen und Steuerberater informieren.',
        action: 'GoBD-Export', actionUrl: '/einstellungen',
      });
    }

    // Positive Entwicklung
    if (monthlyNet > 0) {
      hints.push({
        id: 'positive', severity: 'success',
        title: 'Positiver monatlicher Cashflow',
        description: `Ø ${fmt(monthlyNet)}/Monat Überschuss. Erwägen Sie, Gewinne zu investieren oder Rücklagen zu bilden.`,
        action: 'Kapitalverwaltung', actionUrl: '/kapital',
      });
    }

    // Hohe Fixkosten-Quote
    if (avgIncome > 0 && recurring / avgIncome > 0.5) {
      hints.push({
        id: 'fixcosts', severity: 'warning',
        title: 'Hohe Fixkostenquote',
        description: `Wiederkehrende Ausgaben (${fmt(recurring)}/Monat) übersteigen 50 % der Einnahmen. Kostenpositionen prüfen.`,
        action: 'Wiederkehrende Buchungen', actionUrl: '/wiederkehrend',
      });
    }

    // Belege ohne Zuordnung (geschätzt)
    hints.push({
      id: 'receipts', severity: 'info',
      title: 'Belege digitalisieren & zuordnen',
      description: 'Nicht zugeordnete Belege reduzieren die Vorsteuer-Abzugsfähigkeit. Regelmäßig prüfen.',
      action: 'Zu Belegen', actionUrl: '/belege',
    });

    setTaxHints(hints);
  };

  const overdueInvoices = openInvoices.filter((i) => i.overdue);
  const upcomingInvoices = openInvoices.filter((i) => !i.overdue && i.daysUntilDue <= 14);
  const totalOpen = openInvoices.reduce((s, i) => s + i.amount, 0);
  const totalOverdue = overdueInvoices.reduce((s, i) => s + i.amount, 0);

  const liquidityScore = useMemo(() => {
    if (monthlyAvgExpense === 0) return 100;
    const months = bankBalance / monthlyAvgExpense;
    return Math.min(100, Math.round(months * 25));
  }, [bankBalance, monthlyAvgExpense]);

  if (!currentCompany) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Finanz-Cockpit</h1>
          <p className="text-muted-foreground text-sm">Vollständige Übersicht · {currentCompany.name}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Kontostand', value: fmt(bankBalance), icon: Wallet, color: bankBalance >= 0 ? 'text-green-500' : 'text-red-500' },
          { label: 'Offene Forderungen', value: fmt(totalOpen), icon: FileText, color: 'text-blue-400' },
          { label: 'Überfällig', value: fmt(totalOverdue), icon: AlertTriangle, color: totalOverdue > 0 ? 'text-red-500' : 'text-muted-foreground' },
          { label: 'Ø Monatsergebnis', value: fmt(monthlyAvgIncome - monthlyAvgExpense), icon: TrendingUp, color: (monthlyAvgIncome - monthlyAvgExpense) >= 0 ? 'text-green-500' : 'text-red-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className={`text-xl font-bold ${color}`}>{loading ? '...' : value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Liquiditätsplanung Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Liquiditätsplanung – 6 Monate + 3 Monate Prognose
            </CardTitle>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />Einnahmen</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Ausgaben</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={liquidityData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                formatter={(v: number, name: string) => [fmt(v), name === 'einnahmen' ? 'Einnahmen' : name === 'ausgaben' ? 'Ausgaben' : 'Saldo']}
              />
              <Bar dataKey="einnahmen" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={32}>
                {liquidityData.map((entry, i) => (
                  <Cell key={i} fill={entry.label.includes('→') ? '#22c55e80' : '#22c55e'} />
                ))}
              </Bar>
              <Bar dataKey="ausgaben" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={32}>
                {liquidityData.map((entry, i) => (
                  <Cell key={i} fill={entry.label.includes('→') ? '#ef444480' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Liquiditätsscore</span>
                <span className={liquidityScore >= 75 ? 'text-green-500' : liquidityScore >= 40 ? 'text-yellow-500' : 'text-red-500'}>
                  {liquidityScore}/100
                </span>
              </div>
              <Progress value={liquidityScore}
                className={`h-2 ${liquidityScore >= 75 ? '[&>div]:bg-green-500' : liquidityScore >= 40 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`} />
            </div>
            <Badge variant={liquidityScore >= 75 ? 'default' : liquidityScore >= 40 ? 'secondary' : 'destructive'} className="shrink-0">
              {liquidityScore >= 75 ? 'Gut' : liquidityScore >= 40 ? 'Mittel' : 'Kritisch'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Offene Posten + Steuerhinweise */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Offene Posten */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Offene Posten
              {overdueInvoices.length > 0 && (
                <Badge variant="destructive" className="text-xs">{overdueInvoices.length} überfällig</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openInvoices.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground text-sm">
                <CheckCircle className="h-8 w-8 text-green-500 opacity-60" />
                <p>Keine offenen Forderungen</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...overdueInvoices, ...upcomingInvoices].slice(0, 6).map((inv) => (
                  <div key={inv.id} className={`flex items-center justify-between p-2 rounded-lg text-sm ${inv.overdue ? 'bg-red-500/10' : 'bg-yellow-500/10'}`}>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{inv.contact_name || inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.overdue
                          ? `${Math.abs(inv.daysUntilDue)} Tage überfällig`
                          : `Fällig in ${inv.daysUntilDue} Tagen`}
                      </p>
                    </div>
                    <p className={`font-bold shrink-0 ml-2 ${inv.overdue ? 'text-red-500' : 'text-yellow-600'}`}>
                      {fmtFull(inv.amount)}
                    </p>
                  </div>
                ))}
                {openInvoices.length > 6 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/rechnungen')}>
                    Alle {openInvoices.length} offenen Rechnungen <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Steueroptimierungs-Hinweise */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Steuer & Optimierung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {taxHints.map((hint) => {
                const Icon = hint.severity === 'warning' ? AlertTriangle
                  : hint.severity === 'success' ? CheckCircle : Info;
                const colorClass = hint.severity === 'warning' ? 'text-yellow-500 bg-yellow-500/10'
                  : hint.severity === 'success' ? 'text-green-500 bg-green-500/10'
                  : 'text-blue-400 bg-blue-500/10';
                return (
                  <div key={hint.id} className={`rounded-lg p-3 ${colorClass.split(' ')[1]}`}>
                    <div className="flex items-start gap-2">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorClass.split(' ')[0]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{hint.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{hint.description}</p>
                        {hint.action && hint.actionUrl && (
                          <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs"
                            onClick={() => navigate(hint.actionUrl!)}>
                            {hint.action} <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schnellzugriffe */}
      <div>
        <h2 className="text-base font-semibold mb-3">Schnellzugriffe</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'ELSTER UStVA', icon: ShieldCheck, url: '/elster', color: 'text-blue-400' },
            { label: 'DATEV Export', icon: Calculator, url: '/einstellungen', color: 'text-purple-400' },
            { label: 'Berichte', icon: TrendingUp, url: '/berichte', color: 'text-green-400' },
            { label: 'Kapitalverwaltung', icon: Wallet, url: '/kapital', color: 'text-orange-400' },
          ].map(({ label, icon: Icon, url, color }) => (
            <button key={url} onClick={() => navigate(url)}
              className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-secondary/40 transition-all text-center">
              <Icon className={`h-6 w-6 ${color}`} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
