/**
 * Liquiditätsplanung – 12-Monats-Forecast, Szenarien und Stresstest
 * Echte Daten aus Supabase + Planwerte manuell eingebbar
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Plus, Trash2,
  Download, RefreshCw, Info, ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';

const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

interface MonthData {
  monat: string;
  istEinnahmen: number;
  istAusgaben: number;
  planEinnahmen: number;
  planAusgaben: number;
  saldoIst: number;
  saldoPlan: number;
  kumuliertIst: number;
  kumuliertPlan: number;
}

interface PlanPosition {
  id: string;
  bezeichnung: string;
  betrag: number;
  typ: 'einnahme' | 'ausgabe';
  monat: number; // 0-11
  kategorie: string;
  wiederkehrend: boolean;
  intervall?: 'monatlich' | 'quartalsweise' | 'jaehrlich';
}

interface Szenario {
  id: string;
  name: string;
  faktor: number; // z.B. 0.8 = 20% weniger Einnahmen
  typ: 'pessimistisch' | 'realistisch' | 'optimistisch';
}

const SZENARIEN: Szenario[] = [
  { id: 'pessimistisch', name: 'Pessimistisch', faktor: 0.75, typ: 'pessimistisch' },
  { id: 'realistisch', name: 'Realistisch', faktor: 1.0, typ: 'realistisch' },
  { id: 'optimistisch', name: 'Optimistisch', faktor: 1.25, typ: 'optimistisch' },
];

export default function Liquiditaetsplanung() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [istDaten, setIstDaten] = useState<{ monat: number; einnahmen: number; ausgaben: number }[]>([]);
  const [planPositionen, setPlanPositionen] = useState<PlanPosition[]>([]);
  const [aktivSzenario, setAktivSzenario] = useState<string>('realistisch');
  const [startSaldo, setStartSaldo] = useState(0);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [planForm, setPlanForm] = useState({
    bezeichnung: '', betrag: '', typ: 'einnahme' as 'einnahme' | 'ausgabe',
    monat: new Date().getMonth(), kategorie: 'Sonstiges',
    wiederkehrend: false, intervall: 'monatlich' as PlanPosition['intervall'],
  });
  const [jahr, setJahr] = useState(new Date().getFullYear());

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      // Ist-Daten: Transaktionen des aktuellen Jahres
      const startDate = `${jahr}-01-01`;
      const endDate = `${jahr}-12-31`;
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type, date')
        .eq('company_id', currentCompany.id)
        .gte('date', startDate)
        .lte('date', endDate);

      // Aggregiere nach Monat
      const monatsDaten: { monat: number; einnahmen: number; ausgaben: number }[] = Array.from({ length: 12 }, (_, i) => ({ monat: i, einnahmen: 0, ausgaben: 0 }));
      (transactions || []).forEach(t => {
        const m = new Date(t.date).getMonth();
        if (t.type === 'income') monatsDaten[m].einnahmen += Math.abs(t.amount);
        else monatsDaten[m].ausgaben += Math.abs(t.amount);
      });
      setIstDaten(monatsDaten);

      // Startkontostand aus Bankkonten
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('balance')
        .eq('company_id', currentCompany.id);
      const gesamtSaldo = (accounts || []).reduce((s, a) => s + (a.balance || 0), 0);
      setStartSaldo(gesamtSaldo);

      // Planpositionen aus localStorage (einfache Persistenz für Planwerte)
      const saved = localStorage.getItem(`liquiditaet_plan_${currentCompany.id}_${jahr}`);
      if (saved) setPlanPositionen(JSON.parse(saved));
      else {
        // Standard-Planpositionen basierend auf Ist-Durchschnitt
        const avgEinnahmen = monatsDaten.reduce((s, m) => s + m.einnahmen, 0) / 12;
        const avgAusgaben = monatsDaten.reduce((s, m) => s + m.ausgaben, 0) / 12;
        const defaultPlan: PlanPosition[] = avgEinnahmen > 0 ? [
          { id: '1', bezeichnung: 'Geplante Einnahmen (Ø)', betrag: avgEinnahmen, typ: 'einnahme', monat: -1, kategorie: 'Umsatz', wiederkehrend: true, intervall: 'monatlich' },
          { id: '2', bezeichnung: 'Geplante Ausgaben (Ø)', betrag: avgAusgaben, typ: 'ausgabe', monat: -1, kategorie: 'Betrieb', wiederkehrend: true, intervall: 'monatlich' },
        ] : [];
        setPlanPositionen(defaultPlan);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany, jahr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Planpositionen speichern
  useEffect(() => {
    if (!currentCompany || loading) return;
    localStorage.setItem(`liquiditaet_plan_${currentCompany.id}_${jahr}`, JSON.stringify(planPositionen));
  }, [planPositionen, currentCompany, jahr, loading]);

  const szenario = SZENARIEN.find(s => s.id === aktivSzenario) || SZENARIEN[1];

  // Monatsdaten berechnen
  const chartDaten: MonthData[] = useMemo(() => {
    const heute = new Date();
    const aktuellerMonat = heute.getFullYear() === jahr ? heute.getMonth() : (jahr < heute.getFullYear() ? 11 : -1);

    let kumuliertIst = startSaldo;
    let kumuliertPlan = startSaldo;

    return Array.from({ length: 12 }, (_, i) => {
      const ist = istDaten[i] || { einnahmen: 0, ausgaben: 0 };

      // Plan-Einnahmen und -Ausgaben berechnen
      let planEin = 0, planAus = 0;
      planPositionen.forEach(p => {
        const betrag = p.betrag * szenario.faktor;
        const istAktiv = p.monat === -1 || p.monat === i ||
          (p.wiederkehrend && p.intervall === 'monatlich') ||
          (p.wiederkehrend && p.intervall === 'quartalsweise' && i % 3 === 0) ||
          (p.wiederkehrend && p.intervall === 'jaehrlich' && i === 0);
        if (istAktiv) {
          if (p.typ === 'einnahme') planEin += betrag;
          else planAus += betrag;
        }
      });

      // Wenn keine Planpositionen, nutze Ist-Durchschnitt für Zukunft
      if (planPositionen.length === 0 && i > aktuellerMonat) {
        const avgEin = istDaten.slice(0, actuellerMonat + 1).reduce((s, m) => s + m.einnahmen, 0) / Math.max(1, actuellerMonat + 1);
        const avgAus = istDaten.slice(0, actuellerMonat + 1).reduce((s, m) => s + m.ausgaben, 0) / Math.max(1, actuellerMonat + 1);
        planEin = avgEin * szenario.faktor;
        planAus = avgAus;
      }

      const saldoIst = ist.einnahmen - ist.ausgaben;
      const saldoPlan = planEin - planAus;

      kumuliertIst += i <= actuellerMonat ? saldoIst : 0;
      kumuliertPlan += saldoPlan;

      return {
        monat: MONTHS[i],
        istEinnahmen: ist.einnahmen,
        istAusgaben: ist.ausgaben,
        planEinnahmen: planEin,
        planAusgaben: planAus,
        saldoIst,
        saldoPlan,
        kumuliertIst: i <= actuellerMonat ? kumuliertIst : 0,
        kumuliertPlan: kumuliertPlan,
      };
    });
  }, [istDaten, planPositionen, szenario, startSaldo, jahr]);

  // Hilfsvariable für aktuellerMonat
  const actuellerMonat = new Date().getFullYear() === jahr ? new Date().getMonth() : (jahr < new Date().getFullYear() ? 11 : -1);

  const kpis = useMemo(() => {
    const gesamtPlanEin = chartDaten.reduce((s, m) => s + m.planEinnahmen, 0);
    const gesamtPlanAus = chartDaten.reduce((s, m) => s + m.planAusgaben, 0);
    const endSaldo = chartDaten[11].kumuliertPlan;
    const minSaldo = Math.min(...chartDaten.map(m => m.kumuliertPlan));
    const liquiditaetsScore = minSaldo > 0 ? Math.min(100, Math.round((minSaldo / Math.max(1, gesamtPlanAus / 12)) * 100)) : 0;
    return { gesamtPlanEin, gesamtPlanAus, endSaldo, minSaldo, liquiditaetsScore };
  }, [chartDaten]);

  const addPlanPosition = () => {
    if (!planForm.bezeichnung || !planForm.betrag) { toast.error('Bezeichnung und Betrag erforderlich'); return; }
    const neu: PlanPosition = {
      id: Date.now().toString(),
      bezeichnung: planForm.bezeichnung,
      betrag: parseFloat(planForm.betrag),
      typ: planForm.typ,
      monat: planForm.wiederkehrend ? -1 : planForm.monat,
      kategorie: planForm.kategorie,
      wiederkehrend: planForm.wiederkehrend,
      intervall: planForm.wiederkehrend ? planForm.intervall : undefined,
    };
    setPlanPositionen(prev => [...prev, neu]);
    setPlanForm({ bezeichnung: '', betrag: '', typ: 'einnahme', monat: new Date().getMonth(), kategorie: 'Sonstiges', wiederkehrend: false, intervall: 'monatlich' });
    setShowPlanDialog(false);
    toast.success('Planposition hinzugefügt');
  };

  const exportCSV = () => {
    const rows = [
      ['Monat', 'Ist-Einnahmen', 'Ist-Ausgaben', 'Ist-Saldo', 'Plan-Einnahmen', 'Plan-Ausgaben', 'Plan-Saldo', 'Kumuliert Plan'],
      ...chartDaten.map(m => [m.monat, m.istEinnahmen.toFixed(2), m.istAusgaben.toFixed(2), m.saldoIst.toFixed(2), m.planEinnahmen.toFixed(2), m.planAusgaben.toFixed(2), m.saldoPlan.toFixed(2), m.kumuliertPlan.toFixed(2)]),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Liquiditaetsplanung_${jahr}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              Liquiditätsplanung
            </h1>
            <p className="text-muted-foreground">12-Monats-Forecast, Szenarien und Stresstest</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(jahr)} onValueChange={v => setJahr(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[jahr - 1, jahr, jahr + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" />Aktualisieren</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button size="sm" onClick={() => setShowPlanDialog(true)}><Plus className="h-4 w-4 mr-1" />Planposition</Button>
          </div>
        </div>

        {/* Szenario-Auswahl */}
        <div className="flex gap-2 flex-wrap">
          {SZENARIEN.map(s => (
            <button
              key={s.id}
              onClick={() => setAktivSzenario(s.id)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${aktivSzenario === s.id
                ? s.typ === 'pessimistisch' ? 'bg-red-500 text-white border-red-500'
                  : s.typ === 'optimistisch' ? 'bg-green-500 text-white border-green-500'
                    : 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted border-border'}`}
            >
              {s.typ === 'pessimistisch' ? '📉' : s.typ === 'optimistisch' ? '📈' : '📊'} {s.name}
              {s.faktor !== 1 && <span className="ml-1 opacity-75">({s.faktor > 1 ? '+' : ''}{Math.round((s.faktor - 1) * 100)}%)</span>}
            </button>
          ))}
        </div>

        {/* KPI-Karten */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Geplante Einnahmen</p>
              <p className="text-xl font-bold text-green-600">{fmt(kpis.gesamtPlanEin)}</p>
              <p className="text-xs text-muted-foreground">{jahr} gesamt</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Geplante Ausgaben</p>
              <p className="text-xl font-bold text-red-600">{fmt(kpis.gesamtPlanAus)}</p>
              <p className="text-xs text-muted-foreground">{jahr} gesamt</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Jahresend-Saldo</p>
              <p className={`text-xl font-bold ${kpis.endSaldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(kpis.endSaldo)}</p>
              <p className="text-xs text-muted-foreground">Prognose Dez {jahr}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                Liquiditätsscore
                <Tooltip><TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                  <TooltipContent>Verhältnis Mindestsaldo zu Ø-Monatsausgaben (0–100)</TooltipContent>
                </Tooltip>
              </p>
              <p className={`text-xl font-bold ${kpis.liquiditaetsScore >= 70 ? 'text-green-600' : kpis.liquiditaetsScore >= 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                {kpis.liquiditaetsScore}/100
              </p>
              <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                <div className={`h-1.5 rounded-full ${kpis.liquiditaetsScore >= 70 ? 'bg-green-500' : kpis.liquiditaetsScore >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${kpis.liquiditaetsScore}%` }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Warnung bei negativem Saldo */}
        {kpis.minSaldo < 0 && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">Liquiditätsrisiko erkannt</p>
              <p className="text-sm text-red-600 dark:text-red-500">
                Der Mindestsaldo fällt auf {fmt(kpis.minSaldo)}. Prüfen Sie Ihre Planpositionen oder passen Sie das Szenario an.
              </p>
            </div>
          </div>
        )}

        <Tabs defaultValue="forecast">
          <TabsList>
            <TabsTrigger value="forecast">Forecast-Chart</TabsTrigger>
            <TabsTrigger value="monatlich">Monatsübersicht</TabsTrigger>
            <TabsTrigger value="plan">Planpositionen</TabsTrigger>
            <TabsTrigger value="stresstest">Stresstest</TabsTrigger>
          </TabsList>

          {/* Forecast-Chart */}
          <TabsContent value="forecast" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Kumulierter Liquiditätsverlauf {jahr}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartDaten}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monat" />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <RechartTooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="kumuliertPlan" name="Plan-Saldo" stroke="#6366f1" fill="#6366f120" strokeWidth={2} />
                    <Area type="monotone" dataKey="kumuliertIst" name="Ist-Saldo" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Einnahmen vs. Ausgaben (monatlich)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartDaten}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monat" />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <RechartTooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="planEinnahmen" name="Plan-Einnahmen" fill="#10b981" opacity={0.8} />
                    <Bar dataKey="planAusgaben" name="Plan-Ausgaben" fill="#ef4444" opacity={0.8} />
                    <Bar dataKey="istEinnahmen" name="Ist-Einnahmen" fill="#059669" />
                    <Bar dataKey="istAusgaben" name="Ist-Ausgaben" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monatsübersicht */}
          <TabsContent value="monatlich">
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-4">Monat</th>
                        <th className="text-right py-2 pr-4">Ist-Ein.</th>
                        <th className="text-right py-2 pr-4">Ist-Aus.</th>
                        <th className="text-right py-2 pr-4">Ist-Saldo</th>
                        <th className="text-right py-2 pr-4">Plan-Ein.</th>
                        <th className="text-right py-2 pr-4">Plan-Aus.</th>
                        <th className="text-right py-2 pr-4">Plan-Saldo</th>
                        <th className="text-right py-2">Kumuliert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartDaten.map((m, i) => (
                        <tr key={i} className={`border-b hover:bg-muted/50 ${i === actuellerMonat ? 'bg-primary/5 font-medium' : ''}`}>
                          <td className="py-2 pr-4 font-medium">{m.monat} {i === actuellerMonat && <Badge variant="outline" className="ml-1 text-xs">Aktuell</Badge>}</td>
                          <td className="text-right py-2 pr-4 text-green-600">{m.istEinnahmen > 0 ? fmt(m.istEinnahmen) : '-'}</td>
                          <td className="text-right py-2 pr-4 text-red-600">{m.istAusgaben > 0 ? fmt(m.istAusgaben) : '-'}</td>
                          <td className={`text-right py-2 pr-4 font-medium ${m.saldoIst >= 0 ? 'text-green-600' : 'text-red-600'}`}>{m.istEinnahmen > 0 || m.istAusgaben > 0 ? fmt(m.saldoIst) : '-'}</td>
                          <td className="text-right py-2 pr-4 text-green-600/70">{fmt(m.planEinnahmen)}</td>
                          <td className="text-right py-2 pr-4 text-red-600/70">{fmt(m.planAusgaben)}</td>
                          <td className={`text-right py-2 pr-4 ${m.saldoPlan >= 0 ? 'text-green-600/70' : 'text-red-600/70'}`}>{fmt(m.saldoPlan)}</td>
                          <td className={`text-right py-2 font-bold ${m.kumuliertPlan >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(m.kumuliertPlan)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Planpositionen */}
          <TabsContent value="plan" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{planPositionen.length} Planpositionen</p>
              <Button size="sm" onClick={() => setShowPlanDialog(true)}><Plus className="h-4 w-4 mr-1" />Hinzufügen</Button>
            </div>
            {planPositionen.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Noch keine Planpositionen. Fügen Sie geplante Einnahmen und Ausgaben hinzu.</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {planPositionen.map(p => (
                  <Card key={p.id}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-8 rounded-full ${p.typ === 'einnahme' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="font-medium text-sm">{p.bezeichnung}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.kategorie} · {p.wiederkehrend ? `Wiederkehrend (${p.intervall})` : MONTHS[p.monat]}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${p.typ === 'einnahme' ? 'text-green-600' : 'text-red-600'}`}>
                          {p.typ === 'einnahme' ? '+' : '-'}{fmt(p.betrag)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setPlanPositionen(prev => prev.filter(x => x.id !== p.id))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Stresstest */}
          <TabsContent value="stresstest" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-500" />Stresstest-Szenarien</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'Umsatzeinbruch -30%', faktor: 0.7, icon: '📉', beschreibung: 'Simuliert einen Umsatzrückgang um 30% (z.B. Kundenverlust, Krise)' },
                  { name: 'Umsatzeinbruch -50%', faktor: 0.5, icon: '💥', beschreibung: 'Extremszenario: Halbierung der Einnahmen' },
                  { name: 'Ausgaben +20%', faktor: 1.2, icon: '📈', beschreibung: 'Kostensteigerung um 20% (Inflation, neue Mitarbeiter)' },
                  { name: 'Kombination: -20% / +15%', faktor: 0.8, icon: '⚡', beschreibung: 'Einnahmen -20% und Ausgaben +15% gleichzeitig' },
                ].map((test, i) => {
                  const planEin = chartDaten.reduce((s, m) => s + m.planEinnahmen, 0);
                  const planAus = chartDaten.reduce((s, m) => s + m.planAusgaben, 0);
                  const stressEin = i === 3 ? planEin * 0.8 : (i < 2 ? planEin * test.faktor : planEin);
                  const stressAus = i === 3 ? planAus * 1.15 : (i === 2 ? planAus * test.faktor : planAus);
                  const stressSaldo = startSaldo + stressEin - stressAus;
                  return (
                    <div key={i} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{test.icon}</span>
                          <div>
                            <p className="font-semibold text-sm">{test.name}</p>
                            <p className="text-xs text-muted-foreground">{test.beschreibung}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${stressSaldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(stressSaldo)}</p>
                          <p className="text-xs text-muted-foreground">Jahresend-Saldo</p>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Einnahmen: {fmt(stressEin)}</span>
                        <span>Ausgaben: {fmt(stressAus)}</span>
                        <span className={stressSaldo >= 0 ? 'text-green-600' : 'text-red-600 font-semibold'}>
                          {stressSaldo >= 0 ? <CheckCircle2 className="inline h-3 w-3 mr-1" /> : <AlertTriangle className="inline h-3 w-3 mr-1" />}
                          {stressSaldo >= 0 ? 'Stabil' : 'Kritisch'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Planposition-Dialog */}
        {showPlanDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader><CardTitle>Planposition hinzufügen</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Bezeichnung</Label>
                    <Input value={planForm.bezeichnung} onChange={e => setPlanForm(p => ({ ...p, bezeichnung: e.target.value }))} placeholder="z.B. Mieteinnahmen" />
                  </div>
                  <div>
                    <Label>Betrag (€)</Label>
                    <Input type="number" value={planForm.betrag} onChange={e => setPlanForm(p => ({ ...p, betrag: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>Typ</Label>
                    <Select value={planForm.typ} onValueChange={v => setPlanForm(p => ({ ...p, typ: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="einnahme">Einnahme</SelectItem>
                        <SelectItem value="ausgabe">Ausgabe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kategorie</Label>
                    <Input value={planForm.kategorie} onChange={e => setPlanForm(p => ({ ...p, kategorie: e.target.value }))} placeholder="Kategorie" />
                  </div>
                  <div>
                    <Label>Wiederkehrend</Label>
                    <Select value={planForm.wiederkehrend ? 'ja' : 'nein'} onValueChange={v => setPlanForm(p => ({ ...p, wiederkehrend: v === 'ja' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ja">Ja</SelectItem>
                        <SelectItem value="nein">Nein (einmalig)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {planForm.wiederkehrend ? (
                    <div className="col-span-2">
                      <Label>Intervall</Label>
                      <Select value={planForm.intervall} onValueChange={v => setPlanForm(p => ({ ...p, intervall: v as any }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monatlich">Monatlich</SelectItem>
                          <SelectItem value="quartalsweise">Quartalsweise</SelectItem>
                          <SelectItem value="jaehrlich">Jährlich</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="col-span-2">
                      <Label>Monat</Label>
                      <Select value={String(planForm.monat)} onValueChange={v => setPlanForm(p => ({ ...p, monat: Number(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowPlanDialog(false)}>Abbrechen</Button>
                  <Button onClick={addPlanPosition}>Hinzufügen</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
