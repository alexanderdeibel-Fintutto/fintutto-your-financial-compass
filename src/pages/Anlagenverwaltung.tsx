/**
 * Anlagenverwaltung – AfA-Abschreibungsrechner, Anlagenspiegel, automatische Buchungen
 *
 * Features:
 * - Anlagegüter erfassen (alle Kategorien)
 * - Lineare und degressive Abschreibung (§ 7 EStG)
 * - Sofortabschreibung GWG (§ 6 Abs. 2 EStG, bis 800 € netto)
 * - Automatischer Abschreibungsplan
 * - Anlagenspiegel (Jahresübersicht)
 * - Abgang mit Gewinn/Verlust-Berechnung
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Download, TrendingDown, Package, Calendar,
  Euro, BarChart3, AlertCircle, ChevronRight, Trash2, Edit,
  CheckCircle, Clock,
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

interface Anlagegut {
  id: string;
  bezeichnung: string;
  kategorie: string;
  anschaffungsdatum: string;
  anschaffungskosten: number;
  nutzungsdauer_jahre: number;
  abschreibungsart: 'linear' | 'degressiv' | 'sofort';
  restwert: number;
  aktueller_buchwert: number | null;
  seriennummer: string | null;
  lieferant: string | null;
  aktiv: boolean;
  abgang_datum: string | null;
  abgang_erloese: number | null;
  notizen: string | null;
}

interface AbschreibungsPlan {
  jahr: number;
  buchwertAnfang: number;
  afaBetrag: number;
  buchwertEnde: number;
  abgeschrieben: boolean;
}

const KATEGORIEN = [
  'Büroausstattung', 'EDV/Software', 'Fahrzeuge', 'Maschinen',
  'Gebäude', 'Grundstücke', 'Immaterielle Wirtschaftsgüter',
  'Betriebs- und Geschäftsausstattung', 'Sonstiges',
];

// Typische Nutzungsdauern nach AfA-Tabelle
const NUTZUNGSDAUERN: Record<string, number> = {
  'Büroausstattung': 13, 'EDV/Software': 3, 'Fahrzeuge': 6,
  'Maschinen': 10, 'Gebäude': 33, 'Grundstücke': 0,
  'Immaterielle Wirtschaftsgüter': 3, 'Betriebs- und Geschäftsausstattung': 13, 'Sonstiges': 10,
};

const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('de-DE');
const currentYear = new Date().getFullYear();

function berechneAfaPlan(gut: Anlagegut): AbschreibungsPlan[] {
  if (gut.abschreibungsart === 'sofort') {
    const jahr = new Date(gut.anschaffungsdatum).getFullYear();
    return [{ jahr, buchwertAnfang: gut.anschaffungskosten, afaBetrag: gut.anschaffungskosten - gut.restwert, buchwertEnde: gut.restwert, abgeschrieben: true }];
  }
  const startJahr = new Date(gut.anschaffungsdatum).getFullYear();
  const plan: AbschreibungsPlan[] = [];
  let buchwert = gut.anschaffungskosten;
  const jahresAfa = gut.abschreibungsart === 'linear'
    ? (gut.anschaffungskosten - gut.restwert) / gut.nutzungsdauer_jahre
    : gut.anschaffungskosten * 0.25; // 25% degressiv (vereinfacht)

  for (let i = 0; i < gut.nutzungsdauer_jahre && buchwert > gut.restwert; i++) {
    const afa = Math.min(jahresAfa, buchwert - gut.restwert);
    plan.push({
      jahr: startJahr + i,
      buchwertAnfang: buchwert,
      afaBetrag: Math.round(afa * 100) / 100,
      buchwertEnde: Math.round((buchwert - afa) * 100) / 100,
      abgeschrieben: startJahr + i < currentYear,
    });
    buchwert -= afa;
  }
  return plan;
}

function berechneAktuellenBuchwert(gut: Anlagegut): number {
  const plan = berechneAfaPlan(gut);
  const vergangen = plan.filter(p => p.jahr < currentYear);
  if (vergangen.length === 0) return gut.anschaffungskosten;
  return vergangen[vergangen.length - 1].buchwertEnde;
}

export default function Anlagenverwaltung() {
  const { currentCompany } = useCompany();
  const [anlagen, setAnlagen] = useState<Anlagegut[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAnlage, setSelectedAnlage] = useState<Anlagegut | null>(null);
  const [detailAnlage, setDetailAnlage] = useState<Anlagegut | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKategorie, setFilterKategorie] = useState('alle');
  const [activeTab, setActiveTab] = useState('anlagen');

  const [form, setForm] = useState({
    bezeichnung: '', kategorie: 'EDV/Software',
    anschaffungsdatum: new Date().toISOString().split('T')[0],
    anschaffungskosten: '', nutzungsdauer_jahre: '3',
    abschreibungsart: 'linear' as 'linear' | 'degressiv' | 'sofort',
    restwert: '0', seriennummer: '', lieferant: '', notizen: '',
  });

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    const { data } = await (supabase as any).from('anlagegueter')
      .select('*').eq('company_id', currentCompany.id)
      .order('anschaffungsdatum', { ascending: false });
    setAnlagen(data || []);
    setLoading(false);
  }, [currentCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleKategorieChange = (kat: string) => {
    const nd = NUTZUNGSDAUERN[kat] || 10;
    setForm(f => ({ ...f, kategorie: kat, nutzungsdauer_jahre: String(nd) }));
  };

  const handleAbschreibungsartChange = (art: 'linear' | 'degressiv' | 'sofort') => {
    if (art === 'sofort') {
      setForm(f => ({ ...f, abschreibungsart: art, nutzungsdauer_jahre: '1' }));
    } else {
      setForm(f => ({ ...f, abschreibungsart: art }));
    }
  };

  const handleSave = async () => {
    if (!currentCompany || !form.bezeichnung.trim() || !form.anschaffungskosten) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    const awk = parseFloat(form.anschaffungskosten.replace(',', '.'));
    const rv = parseFloat(form.restwert.replace(',', '.') || '0');

    // GWG-Prüfung
    if (awk <= 800 && form.abschreibungsart !== 'sofort') {
      toast.info('Hinweis: Güter bis 800 € netto können als GWG sofort abgeschrieben werden (§ 6 Abs. 2 EStG)');
    }

    const payload: any = {
      company_id: currentCompany.id,
      bezeichnung: form.bezeichnung.trim(),
      kategorie: form.kategorie,
      anschaffungsdatum: form.anschaffungsdatum,
      anschaffungskosten: awk,
      nutzungsdauer_jahre: parseInt(form.nutzungsdauer_jahre),
      abschreibungsart: form.abschreibungsart,
      restwert: rv,
      seriennummer: form.seriennummer || null,
      lieferant: form.lieferant || null,
      notizen: form.notizen || null,
      aktiv: true,
    };

    let error;
    if (selectedAnlage) {
      ({ error } = await (supabase as any).from('anlagegueter').update(payload).eq('id', selectedAnlage.id));
    } else {
      ({ error } = await (supabase as any).from('anlagegueter').insert(payload));
    }

    if (error) { toast.error('Fehler: ' + error.message); return; }
    toast.success(selectedAnlage ? 'Anlagegut aktualisiert' : 'Anlagegut erfasst');
    setDialogOpen(false);
    setSelectedAnlage(null);
    resetForm();
    fetchData();
  };

  const handleAbgang = async (anlage: Anlagegut, erloese: number) => {
    const buchwert = berechneAktuellenBuchwert(anlage);
    const gewinnVerlust = erloese - buchwert;
    const { error } = await (supabase as any).from('anlagegueter').update({
      aktiv: false,
      abgang_datum: new Date().toISOString().split('T')[0],
      abgang_erloese: erloese,
    }).eq('id', anlage.id);
    if (error) { toast.error('Fehler beim Abgang'); return; }
    toast.success(`Abgang gebucht. ${gewinnVerlust >= 0 ? 'Gewinn' : 'Verlust'}: ${fmt(Math.abs(gewinnVerlust))}`);
    fetchData();
  };

  const resetForm = () => setForm({
    bezeichnung: '', kategorie: 'EDV/Software',
    anschaffungsdatum: new Date().toISOString().split('T')[0],
    anschaffungskosten: '', nutzungsdauer_jahre: '3',
    abschreibungsart: 'linear', restwert: '0',
    seriennummer: '', lieferant: '', notizen: '',
  });

  const openEdit = (anlage: Anlagegut) => {
    setSelectedAnlage(anlage);
    setForm({
      bezeichnung: anlage.bezeichnung,
      kategorie: anlage.kategorie,
      anschaffungsdatum: anlage.anschaffungsdatum,
      anschaffungskosten: String(anlage.anschaffungskosten),
      nutzungsdauer_jahre: String(anlage.nutzungsdauer_jahre),
      abschreibungsart: anlage.abschreibungsart,
      restwert: String(anlage.restwert),
      seriennummer: anlage.seriennummer || '',
      lieferant: anlage.lieferant || '',
      notizen: anlage.notizen || '',
    });
    setDialogOpen(true);
  };

  const handleExportCSV = () => {
    const header = ['Bezeichnung', 'Kategorie', 'Anschaffungsdatum', 'Anschaffungskosten', 'Nutzungsdauer', 'Abschreibungsart', 'Aktueller Buchwert', 'Restwert', 'Status'];
    const rows = anlagen.map(a => [
      a.bezeichnung, a.kategorie, fmtDate(a.anschaffungsdatum),
      a.anschaffungskosten.toFixed(2).replace('.', ','),
      a.nutzungsdauer_jahre + ' Jahre', a.abschreibungsart,
      berechneAktuellenBuchwert(a).toFixed(2).replace('.', ','),
      a.restwert.toFixed(2).replace('.', ','),
      a.aktiv ? 'Aktiv' : 'Abgegangen',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Anlagenspiegel_${currentYear}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const gefiltert = anlagen.filter(a => {
    if (filterKategorie !== 'alle' && a.kategorie !== filterKategorie) return false;
    if (searchQuery && !a.bezeichnung.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const aktivAnlagen = anlagen.filter(a => a.aktiv);
  const gesamtAnschaffung = aktivAnlagen.reduce((s, a) => s + a.anschaffungskosten, 0);
  const gesamtBuchwert = aktivAnlagen.reduce((s, a) => s + berechneAktuellenBuchwert(a), 0);
  const jahresAfa = aktivAnlagen.reduce((s, a) => {
    const plan = berechneAfaPlan(a);
    const diesJahr = plan.find(p => p.jahr === currentYear);
    return s + (diesJahr?.afaBetrag || 0);
  }, 0);

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            Anlagenverwaltung
          </h1>
          <p className="text-muted-foreground">AfA-Abschreibungen nach § 7 EStG</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="mr-2 h-4 w-4" />Anlagenspiegel</Button>
          <Button onClick={() => { resetForm(); setSelectedAnlage(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Anlagegut
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Anlagegüter aktiv', value: String(aktivAnlagen.length), icon: Package, color: 'text-primary' },
          { label: 'Anschaffungskosten', value: fmt(gesamtAnschaffung), icon: Euro, color: 'text-foreground' },
          { label: 'Aktueller Buchwert', value: fmt(gesamtBuchwert), icon: BarChart3, color: 'text-success' },
          { label: `AfA ${currentYear}`, value: fmt(jahresAfa), icon: TrendingDown, color: 'text-warning' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <p className={cn('text-xl font-bold', color)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="anlagen">Anlagegüter</TabsTrigger>
          <TabsTrigger value="spiegel">Anlagenspiegel {currentYear}</TabsTrigger>
          {detailAnlage && <TabsTrigger value="detail">AfA-Plan: {detailAnlage.bezeichnung}</TabsTrigger>}
        </TabsList>

        {/* Anlagegüter-Liste */}
        <TabsContent value="anlagen" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Anlagegut suchen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterKategorie} onValueChange={setFilterKategorie}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                {KATEGORIEN.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className="glass">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
              ) : gefiltert.length === 0 ? (
                <div className="p-12 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <p className="font-medium mb-1">Keine Anlagegüter vorhanden</p>
                  <p className="text-sm text-muted-foreground mb-4">Erfassen Sie Ihre Anlagegüter für die automatische AfA-Berechnung.</p>
                  <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />Erstes Anlagegut</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground">Bezeichnung</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Kategorie</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Anschaffung</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Buchwert</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">AfA {currentYear}</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {gefiltert.map(a => {
                        const buchwert = berechneAktuellenBuchwert(a);
                        const plan = berechneAfaPlan(a);
                        const diesJahrAfa = plan.find(p => p.jahr === currentYear)?.afaBetrag || 0;
                        const fortschritt = ((a.anschaffungskosten - buchwert) / (a.anschaffungskosten - a.restwert || 1)) * 100;
                        return (
                          <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3">
                              <p className="font-medium">{a.bezeichnung}</p>
                              <p className="text-xs text-muted-foreground">{fmtDate(a.anschaffungsdatum)} · {a.nutzungsdauer_jahre} Jahre · {a.abschreibungsart}</p>
                            </td>
                            <td className="p-3"><Badge variant="outline" className="text-xs">{a.kategorie}</Badge></td>
                            <td className="p-3 text-right">{fmt(a.anschaffungskosten)}</td>
                            <td className="p-3 text-right">
                              <p className="font-bold">{fmt(buchwert)}</p>
                              <div className="w-16 h-1 bg-muted rounded-full ml-auto mt-1">
                                <div className="h-1 bg-warning rounded-full" style={{ width: `${Math.min(fortschritt, 100)}%` }} />
                              </div>
                            </td>
                            <td className="p-3 text-right text-warning font-medium">{diesJahrAfa > 0 ? fmt(diesJahrAfa) : '–'}</td>
                            <td className="p-3 text-center">
                              {a.aktiv
                                ? <Badge variant="outline" className="text-success border-success/30 text-xs">Aktiv</Badge>
                                : <Badge variant="outline" className="text-muted-foreground text-xs">Abgegangen</Badge>}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDetailAnlage(a); setActiveTab('detail'); }}>
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anlagenspiegel */}
        <TabsContent value="spiegel">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Anlagenspiegel {currentYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Kategorie</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Buchwert 01.01.</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Zugänge</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Abgänge</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">AfA {currentYear}</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Buchwert 31.12.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {KATEGORIEN.map(kat => {
                      const katAnlagen = aktivAnlagen.filter(a => a.kategorie === kat);
                      if (katAnlagen.length === 0) return null;
                      const bwAnfang = katAnlagen.reduce((s, a) => {
                        const plan = berechneAfaPlan(a);
                        const vorjahr = plan.find(p => p.jahr === currentYear - 1);
                        return s + (vorjahr?.buchwertEnde || a.anschaffungskosten);
                      }, 0);
                      const zugaenge = katAnlagen.filter(a => new Date(a.anschaffungsdatum).getFullYear() === currentYear).reduce((s, a) => s + a.anschaffungskosten, 0);
                      const afa = katAnlagen.reduce((s, a) => {
                        const plan = berechneAfaPlan(a);
                        return s + (plan.find(p => p.jahr === currentYear)?.afaBetrag || 0);
                      }, 0);
                      const bwEnde = bwAnfang + zugaenge - afa;
                      return (
                        <tr key={kat} className="hover:bg-muted/20">
                          <td className="p-3 font-medium">{kat} <span className="text-xs text-muted-foreground">({katAnlagen.length})</span></td>
                          <td className="p-3 text-right">{fmt(bwAnfang)}</td>
                          <td className="p-3 text-right text-success">{zugaenge > 0 ? fmt(zugaenge) : '–'}</td>
                          <td className="p-3 text-right text-destructive">–</td>
                          <td className="p-3 text-right text-warning">{afa > 0 ? fmt(afa) : '–'}</td>
                          <td className="p-3 text-right font-bold">{fmt(bwEnde)}</td>
                        </tr>
                      );
                    }).filter(Boolean)}
                    <tr className="border-t-2 font-bold bg-muted/20">
                      <td className="p-3">Gesamt</td>
                      <td className="p-3 text-right">{fmt(gesamtAnschaffung)}</td>
                      <td className="p-3 text-right text-success">–</td>
                      <td className="p-3 text-right text-destructive">–</td>
                      <td className="p-3 text-right text-warning">{fmt(jahresAfa)}</td>
                      <td className="p-3 text-right">{fmt(gesamtBuchwert)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AfA-Plan Detail */}
        {detailAnlage && (
          <TabsContent value="detail">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>AfA-Plan: {detailAnlage.bezeichnung}</span>
                  <Badge variant="outline">{detailAnlage.abschreibungsart}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/20 rounded-lg">
                  <div><p className="text-xs text-muted-foreground">Anschaffungskosten</p><p className="font-bold">{fmt(detailAnlage.anschaffungskosten)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Nutzungsdauer</p><p className="font-bold">{detailAnlage.nutzungsdauer_jahre} Jahre</p></div>
                  <div><p className="text-xs text-muted-foreground">Restwert</p><p className="font-bold">{fmt(detailAnlage.restwert)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Aktueller Buchwert</p><p className="font-bold text-success">{fmt(berechneAktuellenBuchwert(detailAnlage))}</p></div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Jahr</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Buchwert Anfang</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">AfA-Betrag</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Buchwert Ende</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {berechneAfaPlan(detailAnlage).map(p => (
                      <tr key={p.jahr} className={cn('hover:bg-muted/20', p.jahr === currentYear && 'bg-primary/5 font-semibold')}>
                        <td className="p-3">{p.jahr} {p.jahr === currentYear && <Badge className="ml-2 text-xs">Aktuell</Badge>}</td>
                        <td className="p-3 text-right">{fmt(p.buchwertAnfang)}</td>
                        <td className="p-3 text-right text-warning">− {fmt(p.afaBetrag)}</td>
                        <td className="p-3 text-right font-bold">{fmt(p.buchwertEnde)}</td>
                        <td className="p-3 text-center">
                          {p.abgeschrieben
                            ? <CheckCircle className="h-4 w-4 text-success mx-auto" />
                            : <Clock className="h-4 w-4 text-muted-foreground mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Erfassungs-Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedAnlage ? 'Anlagegut bearbeiten' : 'Anlagegut erfassen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <Label>Bezeichnung *</Label>
              <Input placeholder="z.B. MacBook Pro 16 Zoll" value={form.bezeichnung} onChange={e => setForm({ ...form, bezeichnung: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie *</Label>
                <Select value={form.kategorie} onValueChange={handleKategorieChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{KATEGORIEN.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Anschaffungsdatum *</Label>
                <Input type="date" value={form.anschaffungsdatum} onChange={e => setForm({ ...form, anschaffungsdatum: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Anschaffungskosten (netto) *</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={form.anschaffungskosten} onChange={e => setForm({ ...form, anschaffungskosten: e.target.value })} />
              </div>
              <div>
                <Label>Restwert (€)</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={form.restwert} onChange={e => setForm({ ...form, restwert: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Abschreibungsart</Label>
                <Select value={form.abschreibungsart} onValueChange={handleAbschreibungsartChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linear (§ 7 Abs. 1)</SelectItem>
                    <SelectItem value="degressiv">Degressiv (25%)</SelectItem>
                    <SelectItem value="sofort">Sofortabschreibung GWG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nutzungsdauer (Jahre)</Label>
                <Input type="number" min="1" max="50" value={form.nutzungsdauer_jahre} onChange={e => setForm({ ...form, nutzungsdauer_jahre: e.target.value })} disabled={form.abschreibungsart === 'sofort'} />
              </div>
            </div>
            {form.anschaffungskosten && parseFloat(form.anschaffungskosten) <= 800 && (
              <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/30 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
                <p>GWG-Hinweis: Güter bis 800 € netto können als geringwertiges Wirtschaftsgut sofort abgeschrieben werden (§ 6 Abs. 2 EStG).</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Seriennummer</Label>
                <Input placeholder="optional" value={form.seriennummer} onChange={e => setForm({ ...form, seriennummer: e.target.value })} />
              </div>
              <div>
                <Label>Lieferant</Label>
                <Input placeholder="optional" value={form.lieferant} onChange={e => setForm({ ...form, lieferant: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setSelectedAnlage(null); }}>Abbrechen</Button>
            <Button onClick={handleSave}>{selectedAnlage ? 'Aktualisieren' : 'Speichern'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
