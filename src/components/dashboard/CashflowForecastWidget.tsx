/**
 * CashflowForecastWidget – 30-Tage Cashflow-Prognose
 *
 * Berechnet auf Basis der letzten 90 Tage einen Durchschnitt und
 * projiziert die nächsten 30 Tage. Zeigt offene Rechnungen als
 * geplante Einnahmen.
 */
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';

interface ForecastDay {
  date: string;
  label: string;
  projectedIncome: number;
  projectedExpense: number;
  cumulativeBalance: number;
  hasInvoice?: boolean;
}

export function CashflowForecastWidget() {
  const { currentCompany } = useCompany();
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [openInvoicesTotal, setOpenInvoicesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [minBalance, setMinBalance] = useState(0);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);

  useEffect(() => {
    if (currentCompany) loadForecast();
  }, [currentCompany]);

  const loadForecast = async () => {
    if (!currentCompany) return;
    setLoading(true);

    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const [bankResult, txResult, invoicesResult] = await Promise.all([
      supabase
        .from('bank_accounts')
        .select('balance')
        .eq('company_id', currentCompany.id),
      supabase
        .from('transactions')
        .select('amount, type, date')
        .eq('company_id', currentCompany.id)
        .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true }),
      supabase
        .from('invoices')
        .select('amount, due_date')
        .eq('company_id', currentCompany.id)
        .eq('status', 'sent')
        .gte('due_date', now.toISOString().split('T')[0])
        .lte(
          'due_date',
          new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        ),
    ]);

    const balance = bankResult.data?.reduce((s, a) => s + Number(a.balance), 0) || 0;
    setCurrentBalance(balance);

    const txData = txResult.data || [];
    const totalIncome = txData.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpenses = txData.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    // Daily averages over 90 days
    const dailyIncome = totalIncome / 90;
    const dailyExpense = totalExpenses / 90;

    // Map open invoices by due_date
    const invoicesByDate = new Map<string, number>();
    const openTotal = (invoicesResult.data || []).reduce((s, inv) => {
      const dateKey = inv.due_date || '';
      invoicesByDate.set(dateKey, (invoicesByDate.get(dateKey) || 0) + Number(inv.amount));
      return s + Number(inv.amount);
    }, 0);
    setOpenInvoicesTotal(openTotal);

    // Build 30-day forecast
    let cumulative = balance;
    const days: ForecastDay[] = [];
    let min = balance;

    for (let i = 1; i <= 30; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dateKey = d.toISOString().split('T')[0];
      const invoiceIncome = invoicesByDate.get(dateKey) || 0;
      const projIncome = dailyIncome + invoiceIncome;
      const projExpense = dailyExpense;
      cumulative += projIncome - projExpense;
      if (cumulative < min) min = cumulative;

      days.push({
        date: dateKey,
        label: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
        projectedIncome: projIncome,
        projectedExpense: projExpense,
        cumulativeBalance: cumulative,
        hasInvoice: invoiceIncome > 0,
      });
    }

    setForecast(days);
    setMinBalance(min);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Lade Prognose...
        </CardContent>
      </Card>
    );
  }

  const endBalance = forecast[forecast.length - 1]?.cumulativeBalance || 0;
  const trend = endBalance - currentBalance;
  const isNegativeRisk = minBalance < 0;

  // Bar chart: show every 5th day as label, scale bars
  const maxAbs = Math.max(...forecast.map((d) => Math.abs(d.cumulativeBalance)), 1);

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            {trend >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            30-Tage Cashflow-Prognose
          </CardTitle>
          <div className="flex items-center gap-2">
            {isNegativeRisk && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Liquiditätsrisiko
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                'font-mono',
                trend >= 0 ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'
              )}
            >
              {trend >= 0 ? '+' : ''}{formatCurrency(trend)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="glass rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Aktueller Saldo</p>
            <p className="font-bold text-sm">{formatCurrency(currentBalance)}</p>
          </div>
          <div className="glass rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Offene Rechnungen</p>
            <p className="font-bold text-sm text-green-500">{formatCurrency(openInvoicesTotal)}</p>
          </div>
          <div className="glass rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Prognose in 30 Tagen</p>
            <p className={cn('font-bold text-sm', endBalance >= 0 ? 'text-green-500' : 'text-red-500')}>
              {formatCurrency(endBalance)}
            </p>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="flex items-end gap-0.5 h-28 w-full">
          {forecast.map((day, i) => {
            const heightPct = Math.abs(day.cumulativeBalance) / maxAbs;
            const isPositive = day.cumulativeBalance >= 0;
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center group relative"
                title={`${day.label}: ${formatCurrency(day.cumulativeBalance)}`}
              >
                {/* Bar */}
                <div
                  className={cn(
                    'w-full rounded-sm transition-all',
                    isPositive
                      ? day.hasInvoice
                        ? 'bg-blue-500/70'
                        : 'bg-green-500/60'
                      : 'bg-red-500/70'
                  )}
                  style={{ height: `${Math.max(heightPct * 100, 2)}%` }}
                />
                {/* Date label every 5 days */}
                {(i + 1) % 5 === 0 && (
                  <span className="absolute -bottom-5 text-[9px] text-muted-foreground whitespace-nowrap">
                    {day.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-7 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-500/60" />
            <span>Positiver Saldo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500/70" />
            <span>Offene Rechnung fällig</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500/70" />
            <span>Negativer Saldo</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
