/**
 * Kassenbuch – GoBD-konformes digitales Kassenbuch
 *
 * Features:
 * - Bareinnahmen und -ausgaben erfassen
 * - Automatischer laufender Kassenstand
 * - Tagesabschluss mit Bestätigungspflicht
 * - GoBD-Export (CSV/PDF)
 * - Unveränderlichkeit abgeschlossener Einträge
 * - Belegnummern-Vergabe
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Download, Lock, Unlock, CheckCircle, AlertTriangle,
  TrendingUp, TrendingDown, DollarSign, Calendar, Printer, Filter,
  ChevronDown, ChevronUp, BookOpen,
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface KassenbuchEintrag {
  id: string;
  datum: string;
  belegnummer: string | null;
  beschreibung: string;
  typ: 'einnahme' | 'ausgabe';
  betrag: number;
  mwst_satz: number;
  mwst_betrag: number;
  netto_betrag: number;
  kassenstand: number;
  kategorie: string | null;
  zahlungsart: string;
  tagesabschluss_id: string | null;
  created_at: string;
}

interface Tagesabschluss {
  id: string;
  datum: string;
  anfangsbestand: number;
  einnahmen: number;
  ausgaben: number;
  endbestand: number;
  abgeschlossen: boolean;
  abgeschlossen_am: string | null;
}

const KATEGORIEN_EINNAHME = ['Umsatzerlöse', 'Sonstige Einnahmen', 'Trinkgelder', 'Pfand', 'Rückgaben'];
const KATEGORIEN_AUSGABE = [
  'Wareneinkauf', 'Büromaterial', 'Porto', 'Reinigung', 'Bewirtung',
  'Fahrtkosten', 'Kleinreparaturen', 'Sonstige Ausgaben', 'Rückzahlungen',
];
const MWST_SAETZE = [0, 7, 19];
const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('de-DE');

export default function Kassenbuch() {
  const { currentCompany } = useCompany();
  const [eintraege, setEintraege] = useState<KassenbuchEintrag[]>([]);
  const [tagesabschluesse, setTagesabschluesse] = useState<Tagesabschluss[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [abschlussDialogOpen, setAbschlussDialogOpen] = useState(false);
  const [filterDatum, setFilterDatum] = useState('');
  const [filterTyp, setFilterTyp] = useState<'alle' | 'einnahme' | 'ausgabe'>('alle');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAbschluesse, setShowAbschluesse] = useState(false);

  // Form state
  const [form, setForm] = useState({
    datum: new Date().toISOString().split('T')[0],
    beschreibung: '',
    typ: 'einnahme' as 'einnahme' | 'ausgabe',
    betrag: '',
    mwst_satz: '19',
    kategorie: '',
    zahlungsart: 'bar',
  });

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    const [{ data: e }, { data: t }] = await Promise.all([
      supabase.from('kassenbuch_eintraege' as any)
        .select('*').eq('company_id', currentCompany.id)
        .order('datum', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('kassenbuch_tagesabschluesse' as any)
        .select('*').eq('company_id', currentCompany.id)
        .order('datum', { ascending: false }),
    ]);
    setEintraege((e as KassenbuchEintrag[]) || []);
    setTagesabschluesse((t as Tagesabschluss[]) || []);
    setLoading(false);
  }, [currentCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!currentCompany || !form.beschreibung.trim() || !form.betrag) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    const brutto = parseFloat(form.betrag.replace(',', '.'));
    const mwstSatz = parseFloat(form.mwst_satz);
    const netto = mwstSatz > 0 ? brutto / (1 + mwstSatz / 100) : brutto;
    const mwstBetrag = brutto - netto;

    // Kassenstand berechnen: letzter Stand ± neuer Betrag
    const letzterStand = eintraege.length > 0 ? eintraege[0].kassenstand : 0;
    const neuerStand = form.typ === 'einnahme' ? letzterStand + brutto : letzterStand - brutto;

    if (neuerStand < 0) {
      toast.error('Kassenstand würde negativ werden – bitte prüfen');
      return;
    }

    // Belegnummer generieren
    const heute = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const tagesEintraege = eintraege.filter(e => e.datum === form.datum).length;
    const belegnummer = `KB-${heute}-${String(tagesEintraege + 1).padStart(3, '0')}`;

    const { error } = await (supabase as any).from('kassenbuch_eintraege').insert({
      company_id: currentCompany.id,
      datum: form.datum,
      belegnummer,
      beschreibung: form.beschreibung.trim(),
      typ: form.typ,
      betrag: brutto,
      mwst_satz: mwstSatz,
      mwst_betrag: Math.round(mwstBetrag * 100) / 100,
      netto_betrag: Math.round(netto * 100) / 100,
      kassenstand: Math.round(neuerStand * 100) / 100,
      kategorie: form.kategorie || null,
      zahlungsart: form.zahlungsart,
    });

    if (error) { toast.error('Fehler beim Speichern: ' + error.message); return; }
    toast.success('Kasseneintrag gespeichert');
    setDialogOpen(false);
    setForm({ datum: new Date().toISOString().split('T')[0], beschreibung: '', typ: 'einnahme', betrag: '', mwst_satz: '19', kategorie: '', zahlungsart: 'bar' });
    fetchData();
  };

  const handleTagesabschluss = async () => {
    if (!currentCompany) return;
    const heute = new Date().toISOString().split('T')[0];
    const tagesEintraege = eintraege.filter(e => e.datum === heute);
    const einnahmen = tagesEintraege.filter(e => e.typ === 'einnahme').reduce((s, e) => s + e.betrag, 0);
    const ausgaben = tagesEintraege.filter(e => e.typ === 'ausgabe').reduce((s, e) => s + e.betrag, 0);
    const vortagsStand = eintraege.find(e => e.datum < heute)?.kassenstand ?? 0;
    const endbestand = vortagsStand + einnahmen - ausgaben;

    const { error } = await (supabase as any).from('kassenbuch_tagesabschluesse').upsert({
      company_id: currentCompany.id,
      datum: heute,
      anfangsbestand: vortagsStand,
      einnahmen: Math.round(einnahmen * 100) / 100,
      ausgaben: Math.round(ausgaben * 100) / 100,
      endbestand: Math.round(endbestand * 100) / 100,
      abgeschlossen: true,
      abgeschlossen_am: new Date().toISOString(),
    }, { onConflict: 'company_id,datum' });

    if (error) { toast.error('Fehler beim Tagesabschluss'); return; }
    toast.success(`Tagesabschluss für ${fmtDate(heute)} erstellt – Kassenstand: ${fmt(endbestand)}`);
    setAbschlussDialogOpen(false);
    fetchData();
  };

  const handleExportCSV = () => {
    const header = ['Datum', 'Belegnummer', 'Beschreibung', 'Typ', 'Brutto', 'MwSt%', 'MwSt€', 'Netto', 'Kassenstand', 'Kategorie'];
    const rows = gefiltert.map(e => [
      fmtDate(e.datum), e.belegnummer || '', e.beschreibung,
      e.typ === 'einnahme' ? 'Einnahme' : 'Ausgabe',
      e.betrag.toFixed(2).replace('.', ','),
      e.mwst_satz.toString(),
      e.mwst_betrag.toFixed(2).replace('.', ','),
      e.netto_betrag.toFixed(2).replace('.', ','),
      e.kassenstand.toFixed(2).replace('.', ','),
      e.kategorie || '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Kassenbuch_${currentCompany?.name}_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Kassenbuch exportiert');
  };

  const gefiltert = eintraege.filter(e => {
    if (filterTyp !== 'alle' && e.typ !== filterTyp) return false;
    if (filterDatum && e.datum !== filterDatum) return false;
    if (searchQuery && !e.beschreibung.toLowerCase().includes(searchQuery.toLowerCase()) && !(e.belegnummer || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const aktuellerStand = eintraege.length > 0 ? eintraege[0].kassenstand : 0;
  const heuteEinnahmen = eintraege.filter(e => e.datum === new Date().toISOString().split('T')[0] && e.typ === 'einnahme').reduce((s, e) => s + e.betrag, 0);
  const heuteAusgaben = eintraege.filter(e => e.datum === new Date().toISOString().split('T')[0] && e.typ === 'ausgabe').reduce((s, e) => s + e.betrag, 0);
  const heutAbgeschlossen = tagesabschluesse.some(t => t.datum === new Date().toISOString().split('T')[0] && t.abgeschlossen);

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            Kassenbuch
          </h1>
          <p className="text-muted-foreground">GoBD-konformes digitales Kassenbuch</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAbschlussDialogOpen(true)} disabled={heutAbgeschlossen}>
            <Lock className="mr-2 h-4 w-4" />
            {heutAbgeschlossen ? 'Heute abgeschlossen' : 'Tagesabschluss'}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Eintrag
          </Button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Kassenstand', value: fmt(aktuellerStand), icon: DollarSign, color: aktuellerStand >= 0 ? 'text-success' : 'text-destructive', bg: 'bg-success/10' },
          { label: 'Heute Einnahmen', value: fmt(heuteEinnahmen), icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Heute Ausgaben', value: fmt(heuteAusgaben), icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/10' },
          { label: 'Einträge gesamt', value: eintraege.length.toString(), icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className={cn('p-1.5 rounded-lg', bg)}><Icon className={cn('h-4 w-4', color)} /></div>
              </div>
              <p className={cn('text-xl font-bold', color)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GoBD-Hinweis */}
      {!heutAbgeschlossen && eintraege.some(e => e.datum === new Date().toISOString().split('T')[0]) && (
        <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
          <p className="text-sm text-warning">Tagesabschluss für heute noch nicht durchgeführt. GoBD erfordert einen täglichen Abschluss.</p>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAbschlussDialogOpen(true)}>
            Jetzt abschließen
          </Button>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Beschreibung oder Belegnummer suchen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterTyp} onValueChange={(v: any) => setFilterTyp(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle</SelectItem>
            <SelectItem value="einnahme">Einnahmen</SelectItem>
            <SelectItem value="ausgabe">Ausgaben</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={filterDatum} onChange={e => setFilterDatum(e.target.value)} className="w-44" />
        {filterDatum && <Button variant="ghost" size="sm" onClick={() => setFilterDatum('')}>×</Button>}
      </div>

      {/* Einträge-Tabelle */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Kassenbucheinträge ({gefiltert.length})</span>
            <Badge variant="outline">{fmt(aktuellerStand)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-4 p-3 border rounded-lg animate-pulse">
                  <div className="w-20 h-4 bg-muted rounded" />
                  <div className="flex-1 h-4 bg-muted rounded" />
                  <div className="w-24 h-4 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : gefiltert.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="font-medium mb-1">Keine Einträge vorhanden</p>
              <p className="text-sm text-muted-foreground mb-4">Erfassen Sie Ihre ersten Bareinnahmen oder -ausgaben.</p>
              <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Ersten Eintrag erstellen</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Datum</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Beleg-Nr.</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Beschreibung</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Kategorie</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Einnahme</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Ausgabe</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Kassenstand</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {gefiltert.map((e) => {
                    const abgeschlossen = tagesabschluesse.some(t => t.datum === e.datum && t.abgeschlossen);
                    return (
                      <tr key={e.id} className={cn('hover:bg-muted/20 transition-colors', abgeschlossen && 'opacity-75')}>
                        <td className="p-3 text-muted-foreground">{fmtDate(e.datum)}</td>
                        <td className="p-3 font-mono text-xs">{e.belegnummer || '–'}</td>
                        <td className="p-3 font-medium">{e.beschreibung}</td>
                        <td className="p-3 text-muted-foreground text-xs">{e.kategorie || '–'}</td>
                        <td className="p-3 text-right text-success font-medium">
                          {e.typ === 'einnahme' ? fmt(e.betrag) : ''}
                        </td>
                        <td className="p-3 text-right text-destructive font-medium">
                          {e.typ === 'ausgabe' ? fmt(e.betrag) : ''}
                        </td>
                        <td className="p-3 text-right font-bold">{fmt(e.kassenstand)}</td>
                        <td className="p-3 text-center">
                          {abgeschlossen
                            ? <Lock className="h-3.5 w-3.5 text-muted-foreground mx-auto" />
                            : <Unlock className="h-3.5 w-3.5 text-warning mx-auto" />}
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

      {/* Tagesabschlüsse */}
      <div>
        <Button variant="ghost" className="w-full justify-between" onClick={() => setShowAbschluesse(!showAbschluesse)}>
          <span className="font-medium">Tagesabschlüsse ({tagesabschluesse.length})</span>
          {showAbschluesse ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {showAbschluesse && (
          <div className="mt-3 space-y-2">
            {tagesabschluesse.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg glass">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="font-medium">{fmtDate(t.datum)}</span>
                </div>
                <div className="flex gap-6 text-sm">
                  <span className="text-muted-foreground">Anfang: <span className="font-medium text-foreground">{fmt(t.anfangsbestand)}</span></span>
                  <span className="text-success">+ {fmt(t.einnahmen)}</span>
                  <span className="text-destructive">− {fmt(t.ausgaben)}</span>
                  <span className="font-bold">= {fmt(t.endbestand)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Eintrag-Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kasseneintrag erfassen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Datum *</Label>
                <Input type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })} />
              </div>
              <div>
                <Label>Typ *</Label>
                <Select value={form.typ} onValueChange={(v: any) => setForm({ ...form, typ: v, kategorie: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="einnahme">Einnahme</SelectItem>
                    <SelectItem value="ausgabe">Ausgabe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Beschreibung *</Label>
              <Input placeholder="z.B. Barverkauf Produkt XY" value={form.beschreibung} onChange={e => setForm({ ...form, beschreibung: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Betrag (brutto) *</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={form.betrag} onChange={e => setForm({ ...form, betrag: e.target.value })} />
              </div>
              <div>
                <Label>MwSt-Satz</Label>
                <Select value={form.mwst_satz} onValueChange={v => setForm({ ...form, mwst_satz: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MWST_SAETZE.map(s => <SelectItem key={s} value={String(s)}>{s}%</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Select value={form.kategorie} onValueChange={v => setForm({ ...form, kategorie: v })}>
                  <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {(form.typ === 'einnahme' ? KATEGORIEN_EINNAHME : KATEGORIEN_AUSGABE).map(k => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Zahlungsart</Label>
                <Select value={form.zahlungsart} onValueChange={v => setForm({ ...form, zahlungsart: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="ec">EC-Karte</SelectItem>
                    <SelectItem value="sonstige">Sonstige</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.betrag && parseFloat(form.mwst_satz) > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nettobetrag:</span>
                  <span>{fmt(parseFloat(form.betrag.replace(',', '.')) / (1 + parseFloat(form.mwst_satz) / 100))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MwSt ({form.mwst_satz}%):</span>
                  <span>{fmt(parseFloat(form.betrag.replace(',', '.')) - parseFloat(form.betrag.replace(',', '.')) / (1 + parseFloat(form.mwst_satz) / 100))}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>Bruttobetrag:</span>
                  <span>{fmt(parseFloat(form.betrag.replace(',', '.')))}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tagesabschluss-Dialog */}
      <AlertDialog open={abschlussDialogOpen} onOpenChange={setAbschlussDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tagesabschluss durchführen</AlertDialogTitle>
            <AlertDialogDescription>
              Der Tagesabschluss für <strong>{fmtDate(new Date().toISOString().split('T')[0])}</strong> wird erstellt.
              <br /><br />
              <strong>Heutige Einnahmen:</strong> {fmt(heuteEinnahmen)}<br />
              <strong>Heutige Ausgaben:</strong> {fmt(heuteAusgaben)}<br />
              <strong>Kassenstand:</strong> {fmt(aktuellerStand)}<br /><br />
              Nach dem Abschluss können die heutigen Einträge nicht mehr verändert werden (GoBD-Konformität).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleTagesabschluss}>Tagesabschluss bestätigen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
