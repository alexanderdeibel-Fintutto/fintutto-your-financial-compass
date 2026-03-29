/**
 * Kostenstellen – Buchungszuordnung, Kostenstellenberichte, Auswertungen
 *
 * Features:
 * - Kostenstellen anlegen (Nummern, Bezeichnungen, Budgets)
 * - Transaktionen Kostenstellen zuordnen
 * - Kostenstellenberichte (Ist vs. Plan)
 * - Kostenarten-Auswertung
 * - Export als CSV
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Download, BarChart3, Tag, Euro,
  TrendingUp, TrendingDown, Edit, Trash2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Kostenstelle {
  id: string;
  nummer: string;
  bezeichnung: string;
  beschreibung: string | null;
  budget_monatlich: number | null;
  farbe: string;
  aktiv: boolean;
}

interface KostenstelleStats {
  id: string;
  bezeichnung: string;
  nummer: string;
  farbe: string;
  budget: number | null;
  istBetrag: number;
  transaktionenAnzahl: number;
}

const FARBEN = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
const currentMonth = new Date().toISOString().slice(0, 7);

export default function Kostenstellen() {
  const { currentCompany } = useCompany();
  const [kostenstellen, setKostenstellen] = useState<Kostenstelle[]>([]);
  const [stats, setStats] = useState<KostenstelleStats[]>([]);
  const [transaktionen, setTransaktionen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zuordnungOpen, setZuordnungOpen] = useState(false);
  const [selectedKS, setSelectedKS] = useState<Kostenstelle | null>(null);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [zuordnungKS, setZuordnungKS] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [filterMonat, setFilterMonat] = useState(currentMonth);

  const [form, setForm] = useState({
    nummer: '', bezeichnung: '', beschreibung: '',
    budget_monatlich: '', farbe: '#3b82f6',
  });

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);

    const [{ data: ks }, { data: tx }] = await Promise.all([
      (supabase as any).from('kostenstellen').select('*').eq('company_id', currentCompany.id).order('nummer'),
      (supabase as any).from('transactions').select('id, date, description, amount, type, category, kostenstelle_id')
        .eq('company_id', currentCompany.id)
        .gte('date', filterMonat + '-01')
        .lte('date', filterMonat + '-31')
        .order('date', { ascending: false }),
    ]);

    setKostenstellen(ks || []);
    setTransaktionen(tx || []);

    // Stats berechnen
    const statsData: KostenstelleStats[] = (ks || []).map((k: Kostenstelle) => {
      const ksTx = (tx || []).filter((t: any) => t.kostenstelle_id === k.id && t.type === 'expense');
      return {
        id: k.id,
        bezeichnung: k.bezeichnung,
        nummer: k.nummer,
        farbe: k.farbe,
        budget: k.budget_monatlich,
        istBetrag: ksTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
        transaktionenAnzahl: ksTx.length,
      };
    });
    setStats(statsData);
    setLoading(false);
  }, [currentCompany, filterMonat]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!currentCompany || !form.bezeichnung.trim() || !form.nummer.trim()) {
      toast.error('Nummer und Bezeichnung erforderlich');
      return;
    }
    const payload: any = {
      company_id: currentCompany.id,
      nummer: form.nummer.trim(),
      bezeichnung: form.bezeichnung.trim(),
      beschreibung: form.beschreibung || null,
      budget_monatlich: form.budget_monatlich ? parseFloat(form.budget_monatlich) : null,
      farbe: form.farbe,
      aktiv: true,
    };
    let error;
    if (selectedKS) {
      ({ error } = await (supabase as any).from('kostenstellen').update(payload).eq('id', selectedKS.id));
    } else {
      ({ error } = await (supabase as any).from('kostenstellen').insert(payload));
    }
    if (error) { toast.error('Fehler: ' + error.message); return; }
    toast.success(selectedKS ? 'Kostenstelle aktualisiert' : 'Kostenstelle erstellt');
    setDialogOpen(false);
    setSelectedKS(null);
    fetchData();
  };

  const handleZuordnung = async () => {
    if (!selectedTx) return;
    const { error } = await (supabase as any).from('transactions')
      .update({ kostenstelle_id: zuordnungKS || null })
      .eq('id', selectedTx.id);
    if (error) { toast.error('Fehler beim Zuordnen'); return; }
    toast.success('Kostenstelle zugeordnet');
    setZuordnungOpen(false);
    setSelectedTx(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from('kostenstellen').delete().eq('id', id);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Kostenstelle gelöscht');
    fetchData();
  };

  const handleExport = () => {
    const header = ['Kostenstelle', 'Nummer', 'Ist-Kosten', 'Budget', 'Abweichung', 'Buchungen'];
    const rows = stats.map(s => [
      s.bezeichnung, s.nummer,
      s.istBetrag.toFixed(2).replace('.', ','),
      s.budget ? s.budget.toFixed(2).replace('.', ',') : '',
      s.budget ? (s.budget - s.istBetrag).toFixed(2).replace('.', ',') : '',
      String(s.transaktionenAnzahl),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Kostenstellen_${filterMonat}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = stats.map(s => ({
    name: `${s.nummer} ${s.bezeichnung.slice(0, 12)}`,
    Ist: s.istBetrag,
    Plan: s.budget || 0,
  })).filter(d => d.Ist > 0 || d.Plan > 0);

  const gesamtIst = stats.reduce((s, k) => s + k.istBetrag, 0);
  const gesamtBudget = stats.reduce((s, k) => s + (k.budget || 0), 0);
  const ohneKS = transaktionen.filter(t => !t.kostenstelle_id && t.type === 'expense').length;

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Tag className="h-8 w-8 text-primary" />
            Kostenstellen
          </h1>
          <p className="text-muted-foreground">Kosten zuordnen und auswerten</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export</Button>
          <Button onClick={() => { setSelectedKS(null); setForm({ nummer: '', bezeichnung: '', beschreibung: '', budget_monatlich: '', farbe: '#3b82f6' }); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Kostenstelle
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Kostenstellen', value: String(kostenstellen.length), icon: Tag, color: 'text-primary' },
          { label: `Ist-Kosten ${filterMonat}`, value: fmt(gesamtIst), icon: Euro, color: 'text-destructive' },
          { label: 'Gesamtbudget', value: gesamtBudget > 0 ? fmt(gesamtBudget) : '–', icon: BarChart3, color: 'text-foreground' },
          { label: 'Ohne Kostenstelle', value: String(ohneKS), icon: AlertCircle, color: ohneKS > 0 ? 'text-warning' : 'text-muted-foreground' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <p className={cn('text-xl font-bold', color)}>{value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Monat-Filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground">Monat:</Label>
        <Input type="month" value={filterMonat} onChange={e => setFilterMonat(e.target.value)} className="w-40" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="buchungen">Buchungen zuordnen {ohneKS > 0 && <Badge className="ml-1 h-4 w-4 p-0 text-xs">{ohneKS}</Badge>}</TabsTrigger>
          <TabsTrigger value="chart">Diagramm</TabsTrigger>
        </TabsList>

        {/* Übersicht */}
        <TabsContent value="uebersicht" className="space-y-4">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : kostenstellen.length === 0 ? (
            <div className="p-12 text-center border rounded-xl">
              <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="font-medium mb-1">Keine Kostenstellen vorhanden</p>
              <p className="text-sm text-muted-foreground mb-4">Erstellen Sie Kostenstellen um Ausgaben gezielt zuzuordnen.</p>
              <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Erste Kostenstelle</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.map(s => {
                const prozent = s.budget ? Math.min((s.istBetrag / s.budget) * 100, 100) : 0;
                const ueberschritten = s.budget && s.istBetrag > s.budget;
                return (
                  <Card key={s.id} className="glass">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-10 rounded-full" style={{ backgroundColor: s.farbe }} />
                          <div>
                            <p className="font-semibold">{s.bezeichnung}</p>
                            <p className="text-xs text-muted-foreground">KST {s.nummer} · {s.transaktionenAnzahl} Buchungen</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn('font-bold text-lg', ueberschritten ? 'text-destructive' : 'text-foreground')}>{fmt(s.istBetrag)}</p>
                          {s.budget && <p className="text-xs text-muted-foreground">von {fmt(s.budget)}</p>}
                        </div>
                      </div>
                      {s.budget && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={ueberschritten ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                              {ueberschritten ? `Überschreitung: ${fmt(s.istBetrag - s.budget)}` : `Verbleibend: ${fmt(s.budget - s.istBetrag)}`}
                            </span>
                            <span>{Math.round(prozent)}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full">
                            <div className={cn('h-2 rounded-full transition-all', prozent > 100 ? 'bg-destructive' : prozent > 80 ? 'bg-warning' : 'bg-success')} style={{ width: `${Math.min(prozent, 100)}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                          const ks = kostenstellen.find(k => k.id === s.id)!;
                          setSelectedKS(ks);
                          setForm({ nummer: ks.nummer, bezeichnung: ks.bezeichnung, beschreibung: ks.beschreibung || '', budget_monatlich: ks.budget_monatlich ? String(ks.budget_monatlich) : '', farbe: ks.farbe });
                          setDialogOpen(true);
                        }}>
                          <Edit className="mr-1 h-3 w-3" />Bearbeiten
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="mr-1 h-3 w-3" />Löschen
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Buchungen zuordnen */}
        <TabsContent value="buchungen">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Ausgaben ohne Kostenstelle ({ohneKS})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transaktionen.filter(t => !t.kostenstelle_id && t.type === 'expense').length === 0 ? (
                <div className="p-8 text-center">
                  <Tag className="h-10 w-10 mx-auto mb-3 text-success opacity-50" />
                  <p className="font-medium text-success">Alle Buchungen sind zugeordnet!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground">Datum</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Beschreibung</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Betrag</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transaktionen.filter(t => !t.kostenstelle_id && t.type === 'expense').map(t => (
                        <tr key={t.id} className="hover:bg-muted/20">
                          <td className="p-3 text-muted-foreground">{new Date(t.date).toLocaleDateString('de-DE')}</td>
                          <td className="p-3">{t.description}</td>
                          <td className="p-3 text-right text-destructive font-medium">{fmt(Math.abs(t.amount))}</td>
                          <td className="p-3">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setSelectedTx(t); setZuordnungKS(''); setZuordnungOpen(true); }}>
                              <Tag className="mr-1 h-3 w-3" />Zuordnen
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagramm */}
        <TabsContent value="chart">
          <Card className="glass">
            <CardHeader><CardTitle>Ist vs. Plan – {filterMonat}</CardTitle></CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Keine Daten für diesen Monat
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="Ist" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Plan" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Kostenstelle-Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedKS ? 'Kostenstelle bearbeiten' : 'Neue Kostenstelle'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nummer *</Label>
                <Input placeholder="z.B. 100" value={form.nummer} onChange={e => setForm({ ...form, nummer: e.target.value })} />
              </div>
              <div>
                <Label>Bezeichnung *</Label>
                <Input placeholder="z.B. Vertrieb" value={form.bezeichnung} onChange={e => setForm({ ...form, bezeichnung: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Input placeholder="optional" value={form.beschreibung} onChange={e => setForm({ ...form, beschreibung: e.target.value })} />
            </div>
            <div>
              <Label>Monatliches Budget (€)</Label>
              <Input type="number" placeholder="0,00" value={form.budget_monatlich} onChange={e => setForm({ ...form, budget_monatlich: e.target.value })} />
            </div>
            <div>
              <Label>Farbe</Label>
              <div className="flex gap-2 mt-1">
                {FARBEN.map(f => (
                  <button key={f} className={cn('w-7 h-7 rounded-full border-2 transition-transform', form.farbe === f ? 'border-foreground scale-110' : 'border-transparent')} style={{ backgroundColor: f }} onClick={() => setForm({ ...form, farbe: f })} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setSelectedKS(null); }}>Abbrechen</Button>
            <Button onClick={handleSave}>{selectedKS ? 'Aktualisieren' : 'Erstellen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zuordnungs-Dialog */}
      <Dialog open={zuordnungOpen} onOpenChange={setZuordnungOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kostenstelle zuordnen</DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg text-sm">
                <p className="font-medium">{selectedTx.description}</p>
                <p className="text-destructive font-bold">{fmt(Math.abs(selectedTx.amount))}</p>
              </div>
              <div>
                <Label>Kostenstelle</Label>
                <Select value={zuordnungKS} onValueChange={setZuordnungKS}>
                  <SelectTrigger><SelectValue placeholder="Kostenstelle wählen..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Keine Kostenstelle</SelectItem>
                    {kostenstellen.map(k => (
                      <SelectItem key={k.id} value={k.id}>
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: k.farbe }} />
                        {k.nummer} – {k.bezeichnung}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setZuordnungOpen(false)}>Abbrechen</Button>
            <Button onClick={handleZuordnung}>Zuordnen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
