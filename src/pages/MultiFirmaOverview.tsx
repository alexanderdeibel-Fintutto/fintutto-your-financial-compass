/**
 * Multi-Firma-Übersicht — Konsolidierungsbericht
 *
 * Features:
 * - Alle Firmen des Nutzers auf einen Blick
 * - Konsolidierter Umsatz, Ausgaben, Ergebnis
 * - Vergleichstabelle mit Sparklines
 * - Schnellwechsel zur Firma
 */
import { useEffect, useState } from 'react';
import { Building2, TrendingUp, TrendingDown, ArrowRight, RefreshCw, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FirmaStats {
  id: string;
  name: string;
  is_personal: boolean;
  revenue: number;
  expenses: number;
  balance: number;
  openInvoices: number;
  openInvoicesAmount: number;
}

export default function MultiFirmaOverview() {
  const { companies, switchCompany, currentCompany } = useCompany();
  const [stats, setStats] = useState<FirmaStats[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    loadAllStats();
  }, [companies]);

  const loadAllStats = async () => {
    if (!companies?.length) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        companies.map(async (company) => {
          const [txResult, invResult] = await Promise.all([
            supabase
              .from('transactions')
              .select('amount, type')
              .eq('company_id', company.id)
              .gte('date', `${currentYear}-01-01`)
              .lte('date', `${currentYear}-12-31`),
            supabase
              .from('invoices')
              .select('total_amount, status')
              .eq('company_id', company.id)
              .in('status', ['sent', 'overdue']),
          ]);

          const tx = txResult.data || [];
          const revenue = tx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
          const expenses = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
          const inv = invResult.data || [];
          const openInvoicesAmount = inv.reduce((s, i) => s + Number(i.total_amount || 0), 0);

          return {
            id: company.id,
            name: company.name,
            is_personal: company.is_personal || false,
            revenue,
            expenses,
            balance: revenue - expenses,
            openInvoices: inv.length,
            openInvoicesAmount,
          } as FirmaStats;
        })
      );
      setStats(results);
    } catch (err) {
      toast.error('Fehler beim Laden der Firmen-Statistiken');
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = stats.reduce((s, f) => s + f.revenue, 0);
  const totalExpenses = stats.reduce((s, f) => s + f.expenses, 0);
  const totalBalance = totalRevenue - totalExpenses;
  const totalOpenInvoices = stats.reduce((s, f) => s + f.openInvoicesAmount, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Multi-Firma-Übersicht
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Konsolidierter Bericht · {companies?.length || 0} Firmen · {currentYear}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllStats}>
          <RefreshCw className="h-4 w-4 mr-1" /> Aktualisieren
        </Button>
      </div>

      {/* Konsolidierte KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Gesamtumsatz', value: fmt(totalRevenue), color: 'text-green-500', sub: `${currentYear}` },
          { label: 'Gesamtausgaben', value: fmt(totalExpenses), color: 'text-red-500', sub: `${currentYear}` },
          { label: 'Konsolidiertes Ergebnis', value: fmt(totalBalance), color: totalBalance >= 0 ? 'text-green-500' : 'text-red-500', sub: 'Gewinn/Verlust' },
          { label: 'Offene Rechnungen', value: fmt(totalOpenInvoices), color: 'text-orange-400', sub: `${stats.reduce((s, f) => s + f.openInvoices, 0)} Rechnungen` },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="glass rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Firmen-Vergleichstabelle */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-secondary/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold">Firmen-Vergleich {currentYear}</h2>
          </div>
          <div className="divide-y divide-border/30">
            {stats.map((firma) => {
              const isActive = firma.id === currentCompany?.id;
              const margin = firma.revenue > 0 ? ((firma.balance / firma.revenue) * 100).toFixed(1) : '0.0';
              return (
                <div
                  key={firma.id}
                  className={cn(
                    'flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors',
                    isActive && 'bg-primary/5'
                  )}
                >
                  <div className="flex-shrink-0">
                    <div className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center',
                      firma.is_personal ? 'bg-blue-500/20' : 'bg-purple-500/20'
                    )}>
                      {firma.is_personal ? (
                        <Wallet className="h-5 w-5 text-blue-400" />
                      ) : (
                        <Building2 className="h-5 w-5 text-purple-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{firma.name}</p>
                      {isActive && (
                        <Badge className="text-xs bg-primary/20 text-primary border-primary/30">Aktiv</Badge>
                      )}
                      {firma.is_personal && (
                        <Badge variant="outline" className="text-xs">Privat</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-green-400">+{fmt(firma.revenue)}</span>
                      <span className="text-xs text-red-400">-{fmt(firma.expenses)}</span>
                      <span className={cn('text-xs font-medium', firma.balance >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {firma.balance >= 0 ? '▲' : '▼'} {fmt(Math.abs(firma.balance))}
                      </span>
                      <span className="text-xs text-muted-foreground">Marge: {margin}%</span>
                    </div>
                    {/* Mini-Fortschrittsbalken */}
                    <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden w-48">
                      <div
                        className={cn('h-full rounded-full', firma.balance >= 0 ? 'bg-green-500' : 'bg-red-500')}
                        style={{ width: `${Math.min(100, Math.abs(Number(margin)))}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {firma.openInvoices > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-orange-400 font-medium">{fmt(firma.openInvoicesAmount)}</p>
                        <p className="text-xs text-muted-foreground">{firma.openInvoices} offen</p>
                      </div>
                    )}
                    {!isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => switchCompany(firma.id)}
                        className="text-xs"
                      >
                        Wechseln <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hinweis */}
      <div className="glass rounded-xl p-4 border border-blue-500/20">
        <p className="text-sm text-muted-foreground">
          <span className="text-blue-400 font-medium">Hinweis:</span> Die Multi-Firma-Übersicht zeigt alle
          Firmen und Privatbereiche, auf die Sie Zugriff haben. Klicken Sie auf „Wechseln", um direkt
          zur Buchhaltung einer anderen Firma zu wechseln.
        </p>
      </div>
    </div>
  );
}
