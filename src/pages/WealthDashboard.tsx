import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Wallet, Building2, Car, Shield,
  PieChart, BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw,
  ChevronRight, Landmark, Gem, Briefcase,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface AssetSummary {
  type: string;
  label: string;
  icon: React.ElementType;
  color: string;
  url: string;
  totalValue: number;
  totalCost: number;
  count: number;
}

interface PerformancePoint {
  month: string;
  wert: number;
}

const ASSET_CATEGORIES: Omit<AssetSummary, 'totalValue' | 'totalCost' | 'count'>[] = [
  { type: 'investment', label: 'Wertpapiere & Depot', icon: TrendingUp, color: '#6366f1', url: '/vermoegen/investments' },
  { type: 'real_estate', label: 'Immobilien', icon: Building2, color: '#10b981', url: '/vermoegen/immobilien' },
  { type: 'vehicle', label: 'Fahrzeuge', icon: Car, color: '#f59e0b', url: '/vermoegen/fahrzeuge' },
  { type: 'insurance', label: 'Versicherungen', icon: Shield, color: '#3b82f6', url: '/vermoegen/versicherungen' },
  { type: 'company_share', label: 'Beteiligungen', icon: Briefcase, color: '#8b5cf6', url: '/vermoegen/beteiligungen' },
  { type: 'asset', label: 'Sachwerte', icon: Gem, color: '#ec4899', url: '/vermoegen/sachwerte' },
];

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} %`;

export default function WealthDashboard() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<{ type: string; current_value: number | null; purchase_price: number | null }[]>([]);
  const [bankBalance, setBankBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<PerformancePoint[]>([]);

  useEffect(() => {
    if (currentCompany) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id]);

  const fetchData = async () => {
    if (!currentCompany) return;
    setLoading(true);

    const [assetsRes, bankRes, txRes] = await Promise.all([
      supabase
        .from('assets')
        .select('type, current_value, purchase_price')
        .eq('company_id', currentCompany.id),
      supabase
        .from('bank_accounts')
        .select('balance')
        .eq('company_id', currentCompany.id),
      supabase
        .from('transactions')
        .select('amount, type, date')
        .eq('company_id', currentCompany.id)
        .gte('date', new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
        .order('date', { ascending: true }),
    ]);

    if (assetsRes.data) setAssets(assetsRes.data);
    const balance = bankRes.data?.reduce((s, a) => s + Number(a.balance || 0), 0) || 0;
    setBankBalance(balance);

    // Build 12-month performance timeline (cumulative net worth estimate)
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const now = new Date();
    const monthlyNet = new Array(12).fill(0);
    (txRes.data || []).forEach((tx) => {
      const m = new Date(tx.date).getMonth();
      monthlyNet[m] += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
    });
    // Cumulative from current balance
    let running = balance;
    const perf: PerformancePoint[] = [];
    for (let i = now.getMonth(); i >= 0; i--) {
      running -= monthlyNet[i];
    }
    for (let i = 0; i <= now.getMonth(); i++) {
      running += monthlyNet[i];
      perf.push({ month: monthNames[i], wert: Math.round(running) });
    }
    setPerformanceData(perf);
    setLoading(false);
  };

  const categorySummaries = useMemo<AssetSummary[]>(() => {
    return ASSET_CATEGORIES.map((cat) => {
      const catAssets = assets.filter((a) => a.type === cat.type);
      return {
        ...cat,
        count: catAssets.length,
        totalValue: catAssets.reduce((s, a) => s + Number(a.current_value || a.purchase_price || 0), 0),
        totalCost: catAssets.reduce((s, a) => s + Number(a.purchase_price || 0), 0),
      };
    });
  }, [assets]);

  const totalAssetValue = useMemo(
    () => categorySummaries.reduce((s, c) => s + c.totalValue, 0),
    [categorySummaries]
  );

  const totalCost = useMemo(
    () => categorySummaries.reduce((s, c) => s + c.totalCost, 0),
    [categorySummaries]
  );

  const netWorth = bankBalance + totalAssetValue;
  const totalGain = totalAssetValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  const pieData = categorySummaries
    .filter((c) => c.totalValue > 0)
    .map((c) => ({ name: c.label, value: c.totalValue, color: c.color }));

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Bitte wählen Sie eine Firma aus.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Kapitalverwaltung</h1>
          <p className="text-muted-foreground text-sm">{currentCompany.name}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Nettovermögen Hero Card */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a21caf 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, white 0%, transparent 60%)' }} />
        <p className="text-sm font-medium text-white/70 mb-1">Gesamtnettovermögen</p>
        <p className="text-4xl font-bold tracking-tight mb-3">
          {loading ? '...' : fmt(netWorth)}
        </p>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-white/60">Bankguthaben</p>
            <p className="font-semibold">{fmt(bankBalance)}</p>
          </div>
          <div>
            <p className="text-white/60">Vermögenswerte</p>
            <p className="font-semibold">{fmt(totalAssetValue)}</p>
          </div>
          <div>
            <p className="text-white/60">Gesamtperformance</p>
            <p className={`font-semibold flex items-center gap-1 ${totalGain >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {totalGain >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {fmtPct(totalGainPct)}
            </p>
          </div>
        </div>
      </div>

      {/* Performance Chart + Allokation */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Liquiditätsentwicklung */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Liquiditätsentwicklung {new Date().getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {performanceData.length > 1 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={performanceData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: number) => [fmt(v), 'Kontostand']}
                  />
                  <Area type="monotone" dataKey="wert" stroke="#6366f1" strokeWidth={2} fill="url(#wealthGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                Noch keine Transaktionsdaten vorhanden
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asset-Allokation Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Asset-Allokation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={140} height={140}>
                  <RechartsPie>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                      dataKey="value" paddingAngle={2}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: number) => [fmt(v), '']}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-muted-foreground truncate max-w-[100px]">{d.name}</span>
                      </div>
                      <span className="font-medium">{totalAssetValue > 0 ? `${((d.value / totalAssetValue) * 100).toFixed(0)} %` : '–'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[140px] flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
                <PieChart className="h-8 w-8 opacity-30" />
                Noch keine Vermögenswerte erfasst
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kategorie-Karten */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Vermögenskategorien</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categorySummaries.map((cat) => {
            const Icon = cat.icon;
            const gain = cat.totalValue - cat.totalCost;
            const gainPct = cat.totalCost > 0 ? (gain / cat.totalCost) * 100 : 0;
            const allocationPct = totalAssetValue > 0 ? (cat.totalValue / totalAssetValue) * 100 : 0;
            return (
              <button
                key={cat.type}
                onClick={() => navigate(cat.url)}
                className="glass rounded-xl p-4 text-left hover:bg-secondary/40 transition-all group w-full"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg" style={{ background: cat.color + '20' }}>
                    <Icon className="h-5 w-5" style={{ color: cat.color }} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">{cat.count}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
                <p className="font-semibold text-sm mb-0.5">{cat.label}</p>
                <p className="text-xl font-bold mb-2">{cat.count > 0 ? fmt(cat.totalValue) : '–'}</p>
                {cat.count > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Anteil am Portfolio</span>
                      <span className="font-medium">{allocationPct.toFixed(1)} %</span>
                    </div>
                    <Progress value={allocationPct} className="h-1" />
                    {cat.totalCost > 0 && (
                      <p className={`text-xs mt-1.5 flex items-center gap-0.5 ${gain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {gain >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {fmt(Math.abs(gain))} ({fmtPct(gainPct)})
                      </p>
                    )}
                  </>
                )}
                {cat.count === 0 && (
                  <p className="text-xs text-muted-foreground">Noch keine Einträge</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bankkonten-Übersicht */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            Bankkonten & Liquidität
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BankAccountsOverview companyId={currentCompany.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function BankAccountsOverview({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<{ id: string; name: string; iban: string | null; balance: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('bank_accounts').select('id, name, iban, balance')
      .eq('company_id', companyId).order('name')
      .then(({ data }) => { if (data) setAccounts(data); setLoading(false); });
  }, [companyId]);

  const total = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);

  if (loading) return <div className="text-sm text-muted-foreground py-2">Lade Konten...</div>;
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground text-sm">
        <Landmark className="h-8 w-8 opacity-30" />
        <p>Noch keine Bankkonten verknüpft</p>
        <Button size="sm" variant="outline" onClick={() => navigate('/bankkonten')}>Konto hinzufügen</Button>
      </div>
    );
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);

  return (
    <div className="space-y-2">
      {accounts.map((acc) => (
        <div key={acc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
          <div>
            <p className="font-medium text-sm">{acc.name}</p>
            {acc.iban && <p className="text-xs text-muted-foreground font-mono">{acc.iban.replace(/(.{4})/g, '$1 ').trim()}</p>}
          </div>
          <p className={`font-semibold ${Number(acc.balance) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {fmt(Number(acc.balance || 0))}
          </p>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 font-bold">
        <span>Gesamt Liquidität</span>
        <span className={total >= 0 ? 'text-green-500' : 'text-red-500'}>{fmt(total)}</span>
      </div>
    </div>
  );
}
