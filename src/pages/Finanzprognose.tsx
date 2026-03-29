/**
 * Finanzprognose – KI-gestützte Umsatzvorhersage
 * Lineare Regression, Saisonalitätsanalyse, Monte-Carlo-Simulation
 * Professionelle Forecasting-Funktionen wie in Enterprise-BI-Tools
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, Brain, RefreshCw, Download, Info, AlertCircle,
  CheckCircle2, Target, Zap, BarChart3, ChevronRight
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, AreaChart, BarChart, Bar, Legend, Cell
} from 'recharts';

const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

interface MonthlyData {
  monat: string;
  monatIdx: number;
  jahr: number;
  einnahmen: number;
  ausgaben: number;
  gewinn: number;
  isPrognose: boolean;
}

// Lineare Regression
function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0, r2: 0 };
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = data.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * data[i], 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const yMean = sumY / n;
  const ssTot = data.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const ssRes = data.reduce((s, v, i) => s + (v - (slope * i + intercept)) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2: Math.max(0, r2) };
}

// Saisonalitätsfaktoren berechnen
function calculateSeasonality(data: number[]): number[] {
  if (data.length < 12) return Array(12).fill(1);
  const monthlyAvg = Array(12).fill(0).map((_, m) => {
    const vals = data.filter((_, i) => i % 12 === m);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  });
  const overallAvg = monthlyAvg.reduce((s, v) => s + v, 0) / 12;
  return monthlyAvg.map(v => overallAvg > 0 ? v / overallAvg : 1);
}

// Monte-Carlo-Simulation
function monteCarloSimulation(base: number, slope: number, months: number, iterations = 500): { p10: number[]; p50: number[]; p90: number[] } {
  const results: number[][] = Array.from({ length: months }, () => []);
  for (let iter = 0; iter < iterations; iter++) {
    const noise = (Math.random() - 0.5) * 0.3;
    for (let m = 0; m < months; m++) {
      const trend = base + slope * m;
      const randomFactor = 1 + noise + (Math.random() - 0.5) * 0.2;
      results[m].push(Math.max(0, trend * randomFactor));
    }
  }
  return {
    p10: results.map(r => r.sort((a, b) => a - b)[Math.floor(iterations * 0.1)]),
    p50: results.map(r => r[Math.floor(iterations * 0.5)]),
    p90: results.map(r => r[Math.floor(iterations * 0.9)]),
  };
}

export default function Finanzprognose() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [historicalData, setHistoricalData] = useState<MonthlyData[]>([]);
  const [forecastMonths, setForecastMonths] = useState(6);
  const [forecastMethod, setForecastMethod] = useState<'linear' | 'seasonal' | 'monte_carlo'>('seasonal');

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type, date')
        .eq('company_id', currentCompany.id)
        .gte('date', twoYearsAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      // Monatlich aggregieren
      const monthMap = new Map<string, { einnahmen: number; ausgaben: number }>();
      (transactions || []).forEach(t => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const existing = monthMap.get(key) || { einnahmen: 0, ausgaben: 0 };
        if (t.type === 'income') existing.einnahmen += Math.abs(t.amount || 0);
        else existing.ausgaben += Math.abs(t.amount || 0);
        monthMap.set(key, existing);
      });

      const now = new Date();
      const data: MonthlyData[] = [];
      // Lücken füllen (letzte 24 Monate)
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const vals = monthMap.get(key) || { einnahmen: 0, ausgaben: 0 };
        data.push({
          monat: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
          monatIdx: d.getMonth(),
          jahr: d.getFullYear(),
          einnahmen: vals.einnahmen,
          ausgaben: vals.ausgaben,
          gewinn: vals.einnahmen - vals.ausgaben,
          isPrognose: false,
        });
      }

      setHistoricalData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { chartData, forecastStats, regression } = useMemo(() => {
    if (historicalData.length === 0) return { chartData: [], forecastStats: null, regression: null };

    const einnahmenValues = historicalData.map(d => d.einnahmen);
    const ausgabenValues = historicalData.map(d => d.ausgaben);
    const reg = linearRegression(einnahmenValues);
    const seasonality = calculateSeasonality(einnahmenValues);
    const monteCarlo = monteCarloSimulation(
      reg.intercept + reg.slope * einnahmenValues.length,
      reg.slope,
      forecastMonths
    );

    const now = new Date();
    const prognoseData: MonthlyData[] = [];
    for (let i = 1; i <= forecastMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const baseValue = reg.intercept + reg.slope * (einnahmenValues.length + i - 1);
      let progEinnahmen = baseValue;
      if (forecastMethod === 'seasonal') {
        progEinnahmen = baseValue * seasonality[d.getMonth()];
      } else if (forecastMethod === 'monte_carlo') {
        progEinnahmen = monteCarlo.p50[i - 1];
      }
      const avgAusgabenRatio = ausgabenValues.reduce((s, v, idx) => s + (einnahmenValues[idx] > 0 ? v / einnahmenValues[idx] : 0.6), 0) / ausgabenValues.length;
      const progAusgaben = progEinnahmen * avgAusgabenRatio;
      prognoseData.push({
        monat: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        monatIdx: d.getMonth(),
        jahr: d.getFullYear(),
        einnahmen: Math.max(0, progEinnahmen),
        ausgaben: Math.max(0, progAusgaben),
        gewinn: Math.max(0, progEinnahmen) - Math.max(0, progAusgaben),
        isPrognose: true,
      });
    }

    const allData = [...historicalData.slice(-12), ...prognoseData];
    const totalPrognoseEinnahmen = prognoseData.reduce((s, d) => s + d.einnahmen, 0);
    const totalPrognoseGewinn = prognoseData.reduce((s, d) => s + d.gewinn, 0);
    const avgHistorisch = einnahmenValues.slice(-3).reduce((s, v) => s + v, 0) / 3;
    const avgPrognose = totalPrognoseEinnahmen / forecastMonths;
    const wachstum = avgHistorisch > 0 ? ((avgPrognose - avgHistorisch) / avgHistorisch) * 100 : 0;

    return {
      chartData: allData,
      forecastStats: {
        totalEinnahmen: totalPrognoseEinnahmen,
        totalGewinn: totalPrognoseGewinn,
        wachstum,
        konfidenz: Math.round(reg.r2 * 100),
        p10: monteCarlo.p10.reduce((s, v) => s + v, 0),
        p90: monteCarlo.p90.reduce((s, v) => s + v, 0),
      },
      regression: reg,
    };
  }, [historicalData, forecastMonths, forecastMethod]);

  const exportForecast = () => {
    const rows = [
      ['Monat', 'Einnahmen', 'Ausgaben', 'Gewinn', 'Typ'],
      ...chartData.map(d => [d.monat, d.einnahmen.toFixed(2), d.ausgaben.toFixed(2), d.gewinn.toFixed(2), d.isPrognose ? 'Prognose' : 'Ist']),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Finanzprognose.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const isPrognose = payload[0]?.payload?.isPrognose;
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-bold mb-1">{label} {isPrognose && <Badge className="ml-1 text-xs">Prognose</Badge>}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
        ))}
      </div>
    );
  };

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Finanzprognose
          </h1>
          <p className="text-muted-foreground">KI-gestützte Umsatzvorhersage mit Trendanalyse und Monte-Carlo-Simulation</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(forecastMonths)} onValueChange={v => setForecastMonths(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Monate</SelectItem>
              <SelectItem value="6">6 Monate</SelectItem>
              <SelectItem value="12">12 Monate</SelectItem>
            </SelectContent>
          </Select>
          <Select value={forecastMethod} onValueChange={v => setForecastMethod(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="seasonal">Saisonal</SelectItem>
              <SelectItem value="monte_carlo">Monte Carlo</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" />Aktualisieren</Button>
          <Button variant="outline" size="sm" onClick={exportForecast}><Download className="h-4 w-4 mr-1" />Export</Button>
        </div>
      </div>

      {/* KPIs */}
      {forecastStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Progn. Einnahmen ({forecastMonths}M)</p>
            <p className="text-xl font-bold text-green-600">{fmt(forecastStats.totalEinnahmen)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Progn. Gewinn ({forecastMonths}M)</p>
            <p className={`text-xl font-bold ${forecastStats.totalGewinn >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(forecastStats.totalGewinn)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Wachstum (vs. Ø 3M)</p>
            <p className={`text-xl font-bold ${forecastStats.wachstum >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {forecastStats.wachstum >= 0 ? '+' : ''}{forecastStats.wachstum.toFixed(1)}%
            </p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Modell-Konfidenz (R²)</p>
            <div className="flex items-center gap-2">
              <p className={`text-xl font-bold ${forecastStats.konfidenz >= 70 ? 'text-green-600' : forecastStats.konfidenz >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                {forecastStats.konfidenz}%
              </p>
              {forecastStats.konfidenz >= 70 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-yellow-600" />}
            </div>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Bandbreite (Monte Carlo)</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">{fmt(forecastStats.p10)} – {fmt(forecastStats.p90)}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Methoden-Info */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-sm">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              {forecastMethod === 'linear' && <p><strong>Lineare Regression:</strong> Berechnet den Trend aus historischen Daten und extrapoliert linear. Gut für stabile Geschäfte ohne starke Saisonalität.</p>}
              {forecastMethod === 'seasonal' && <p><strong>Saisonale Anpassung:</strong> Berücksichtigt monatliche Schwankungsmuster aus der Vergangenheit. Ideal für Unternehmen mit saisonalem Geschäft.</p>}
              {forecastMethod === 'monte_carlo' && <p><strong>Monte-Carlo-Simulation:</strong> 500 Zufallsszenarien liefern eine Wahrscheinlichkeitsverteilung. P10/P50/P90 zeigen pessimistisches/realistisches/optimistisches Szenario.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="einnahmen">
        <TabsList>
          <TabsTrigger value="einnahmen">Einnahmen-Prognose</TabsTrigger>
          <TabsTrigger value="gewinn">Gewinn-Prognose</TabsTrigger>
          <TabsTrigger value="vergleich">Ist vs. Prognose</TabsTrigger>
        </TabsList>

        {/* Einnahmen-Prognose */}
        <TabsContent value="einnahmen">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Einnahmen: Historisch + Prognose
              <Badge variant="outline" className="ml-auto text-xs">Grau = Prognose</Badge>
            </CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-72 bg-muted animate-pulse rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="einnahmenGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="prognoseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine x={historicalData[historicalData.length - 1]?.monat} stroke="#666" strokeDasharray="4 4" label={{ value: 'Heute', fontSize: 11 }} />
                    <Area type="monotone" dataKey="einnahmen" name="Einnahmen" stroke="#10b981" fill="url(#einnahmenGrad)" strokeWidth={2}
                      strokeDasharray={(d: any) => d?.isPrognose ? '6 3' : '0'} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gewinn-Prognose */}
        <TabsContent value="gewinn">
          <Card>
            <CardHeader><CardTitle className="text-base">Gewinn/Verlust: Historisch + Prognose</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-72 bg-muted animate-pulse rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#666" />
                    <Bar dataKey="gewinn" name="Gewinn" radius={[4, 4, 0, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.isPrognose ? '#6366f1' : d.gewinn >= 0 ? '#10b981' : '#ef4444'} opacity={d.isPrognose ? 0.7 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ist vs. Prognose */}
        <TabsContent value="vergleich">
          <Card>
            <CardHeader><CardTitle className="text-base">Einnahmen vs. Ausgaben (Prognose)</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-72 bg-muted animate-pulse rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <ReferenceLine x={historicalData[historicalData.length - 1]?.monat} stroke="#666" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="einnahmen" name="Einnahmen" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ausgaben" name="Ausgaben" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Prognose-Tabelle */}
          <Card>
            <CardHeader><CardTitle className="text-base">Prognose-Details</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-4">Monat</th>
                      <th className="text-right py-2 pr-4">Einnahmen</th>
                      <th className="text-right py-2 pr-4">Ausgaben</th>
                      <th className="text-right py-2">Gewinn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.filter(d => d.isPrognose).map((d, i) => (
                      <tr key={i} className="border-b last:border-0 bg-muted/20">
                        <td className="py-2 pr-4 font-medium">{d.monat} <Badge variant="outline" className="ml-1 text-xs">Prognose</Badge></td>
                        <td className="text-right py-2 pr-4 text-green-600 font-medium">{fmt(d.einnahmen)}</td>
                        <td className="text-right py-2 pr-4 text-red-600">{fmt(d.ausgaben)}</td>
                        <td className={`text-right py-2 font-bold ${d.gewinn >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(d.gewinn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
