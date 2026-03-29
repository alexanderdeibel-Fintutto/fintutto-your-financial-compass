import { useState, useEffect, useMemo } from 'react';
import { Plus, Package, Search, Pencil, Trash2, AlertTriangle, TrendingDown, TrendingUp, BarChart3, ShoppingCart, Tag, Euro, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Artikel {
  id: string;
  company_id: string;
  artikelnummer: string;
  name: string;
  kategorie: string;
  beschreibung: string | null;
  bestand: number;
  mindestbestand: number;
  maximalbestand: number;
  einheit: string;
  einkaufspreis: number | null;
  verkaufspreis: number | null;
  lieferant: string | null;
  lagerort: string | null;
  aktiv: boolean;
  created_at: string;
}

const KATEGORIEN = ['Rohstoffe', 'Halbfertigwaren', 'Fertigwaren', 'Handelswaren', 'Verbrauchsmaterial', 'Ersatzteile', 'Büromaterial', 'Sonstiges'];
const EINHEITEN = ['Stück', 'kg', 'g', 'Liter', 'ml', 'Meter', 'cm', 'Karton', 'Palette', 'Paket', 'Flasche', 'Dose'];

function formatEuro(val: number | null): string {
  if (val == null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
}

function getBestandStatus(artikel: Artikel): { label: string; color: string; bg: string } {
  if (artikel.bestand <= 0) return { label: 'Leer', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' };
  if (artikel.bestand <= artikel.mindestbestand) return { label: 'Kritisch', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30' };
  if (artikel.bestand <= artikel.mindestbestand * 1.5) return { label: 'Niedrig', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' };
  return { label: 'OK', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30' };
}

export default function Inventar() {
  const { currentCompany } = useCompany();
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKategorie, setFilterKategorie] = useState('alle');
  const [filterStatus, setFilterStatus] = useState('alle');
  const [activeTab, setActiveTab] = useState('lager');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [buchungDialogOpen, setBuchungDialogOpen] = useState(false);
  const [editArtikel, setEditArtikel] = useState<Artikel | null>(null);
  const [buchungArtikel, setBuchungArtikel] = useState<Artikel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [buchungMenge, setBuchungMenge] = useState('');
  const [buchungTyp, setBuchungTyp] = useState<'zugang' | 'abgang'>('zugang');
  const [buchungGrund, setBuchungGrund] = useState('');
  const [form, setForm] = useState({
    artikelnummer: '', name: '', kategorie: 'Handelswaren', beschreibung: '',
    bestand: '0', mindestbestand: '5', maximalbestand: '100', einheit: 'Stück',
    einkaufspreis: '', verkaufspreis: '', lieferant: '', lagerort: '', aktiv: true,
  });

  const fetchArtikel = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('inventar')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('name');
    if (error) toast.error('Fehler beim Laden');
    else setArtikel((data || []) as Artikel[]);
    setLoading(false);
  };

  useEffect(() => { fetchArtikel(); }, [currentCompany?.id]);

  const openDialog = (a?: Artikel) => {
    if (a) {
      setEditArtikel(a);
      setForm({
        artikelnummer: a.artikelnummer, name: a.name, kategorie: a.kategorie,
        beschreibung: a.beschreibung || '', bestand: a.bestand.toString(),
        mindestbestand: a.mindestbestand.toString(), maximalbestand: a.maximalbestand.toString(),
        einheit: a.einheit, einkaufspreis: a.einkaufspreis?.toString() || '',
        verkaufspreis: a.verkaufspreis?.toString() || '', lieferant: a.lieferant || '',
        lagerort: a.lagerort || '', aktiv: a.aktiv,
      });
    } else {
      setEditArtikel(null);
      const nr = `ART-${String(artikel.length + 1).padStart(4, '0')}`;
      setForm({
        artikelnummer: nr, name: '', kategorie: 'Handelswaren', beschreibung: '',
        bestand: '0', mindestbestand: '5', maximalbestand: '100', einheit: 'Stück',
        einkaufspreis: '', verkaufspreis: '', lieferant: '', lagerort: '', aktiv: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentCompany?.id || !form.name.trim()) { toast.error('Name ist Pflichtfeld'); return; }
    const payload = {
      company_id: currentCompany.id,
      artikelnummer: form.artikelnummer.trim(), name: form.name.trim(),
      kategorie: form.kategorie, beschreibung: form.beschreibung || null,
      bestand: parseFloat(form.bestand) || 0, mindestbestand: parseFloat(form.mindestbestand) || 0,
      maximalbestand: parseFloat(form.maximalbestand) || 0, einheit: form.einheit,
      einkaufspreis: form.einkaufspreis ? parseFloat(form.einkaufspreis) : null,
      verkaufspreis: form.verkaufspreis ? parseFloat(form.verkaufspreis) : null,
      lieferant: form.lieferant || null, lagerort: form.lagerort || null, aktiv: form.aktiv,
    };
    if (editArtikel) {
      const { error } = await supabase.from('inventar').update(payload).eq('id', editArtikel.id);
      if (error) { toast.error('Fehler beim Speichern'); return; }
      toast.success('Artikel aktualisiert');
    } else {
      const { error } = await supabase.from('inventar').insert(payload);
      if (error) { toast.error('Fehler beim Erstellen'); return; }
      toast.success('Artikel erstellt');
    }
    setDialogOpen(false);
    fetchArtikel();
  };

  const handleBuchung = async () => {
    if (!buchungArtikel || !buchungMenge) return;
    const menge = parseFloat(buchungMenge);
    if (isNaN(menge) || menge <= 0) { toast.error('Ungültige Menge'); return; }
    const neuerBestand = buchungTyp === 'zugang'
      ? buchungArtikel.bestand + menge
      : buchungArtikel.bestand - menge;
    if (neuerBestand < 0) { toast.error('Bestand kann nicht negativ werden'); return; }
    const { error } = await supabase.from('inventar').update({ bestand: neuerBestand }).eq('id', buchungArtikel.id);
    if (error) { toast.error('Fehler bei der Buchung'); return; }
    toast.success(`${buchungTyp === 'zugang' ? 'Zugang' : 'Abgang'} von ${menge} ${buchungArtikel.einheit} gebucht`);
    setBuchungDialogOpen(false);
    setBuchungMenge('');
    setBuchungGrund('');
    fetchArtikel();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('inventar').delete().eq('id', deleteId);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Artikel gelöscht');
    setDeleteId(null);
    fetchArtikel();
  };

  const filtered = useMemo(() => artikel.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.artikelnummer.toLowerCase().includes(search.toLowerCase()) ||
      (a.lieferant || '').toLowerCase().includes(search.toLowerCase());
    const matchKat = filterKategorie === 'alle' || a.kategorie === filterKategorie;
    const matchStatus = filterStatus === 'alle' ||
      (filterStatus === 'kritisch' && a.bestand <= a.mindestbestand) ||
      (filterStatus === 'ok' && a.bestand > a.mindestbestand);
    return matchSearch && matchKat && matchStatus;
  }), [artikel, search, filterKategorie, filterStatus]);

  // KPIs
  const gesamtwertEinkauf = artikel.reduce((s, a) => s + (a.bestand * (a.einkaufspreis || 0)), 0);
  const gesamtwertVerkauf = artikel.reduce((s, a) => s + (a.bestand * (a.verkaufspreis || 0)), 0);
  const kritischeArtikel = artikel.filter(a => a.bestand <= a.mindestbestand).length;
  const leereArtikel = artikel.filter(a => a.bestand <= 0).length;

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-400" />
            Inventarverwaltung
          </h1>
          <p className="text-white/50 text-sm mt-1">Lagerbestand, Warenwirtschaft und Bestellauslöser</p>
        </div>
        <Button onClick={() => openDialog()} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="h-4 w-4" /> Neuer Artikel
        </Button>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <p className="text-white/50 text-xs">Artikel gesamt</p>
            <p className="text-2xl font-bold text-white mt-1">{artikel.length}</p>
          </CardContent>
        </Card>
        <Card className={`border ${kritischeArtikel > 0 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/10'}`}>
          <CardContent className="p-4">
            <p className="text-white/50 text-xs">Kritischer Bestand</p>
            <p className={`text-2xl font-bold mt-1 ${kritischeArtikel > 0 ? 'text-orange-400' : 'text-white'}`}>{kritischeArtikel}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <p className="text-white/50 text-xs">Lagerwert (EK)</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{formatEuro(gesamtwertEinkauf)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <p className="text-white/50 text-xs">Lagerwert (VK)</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{formatEuro(gesamtwertVerkauf)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Kritische Artikel Warnung */}
      {kritischeArtikel > 0 && (
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <span className="text-orange-400 font-medium text-sm">
                {leereArtikel > 0 ? `${leereArtikel} Artikel leer, ` : ''}{kritischeArtikel} Artikel unter Mindestbestand
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {artikel.filter(a => a.bestand <= a.mindestbestand).slice(0, 5).map(a => (
                <Badge key={a.id} className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                  {a.name}: {a.bestand} {a.einheit}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="lager" className="gap-2"><Package className="h-4 w-4" /> Lager</TabsTrigger>
          <TabsTrigger value="bestellvorschlaege" className="gap-2"><ShoppingCart className="h-4 w-4" /> Bestellvorschläge</TabsTrigger>
          <TabsTrigger value="auswertung" className="gap-2"><BarChart3 className="h-4 w-4" /> Auswertung</TabsTrigger>
        </TabsList>

        {/* Lager Tab */}
        <TabsContent value="lager" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Artikel, Nummer oder Lieferant..." className="pl-9 bg-white/5 border-white/10 text-white" />
            </div>
            <Select value={filterKategorie} onValueChange={setFilterKategorie}>
              <SelectTrigger className="w-44 bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                {KATEGORIEN.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle</SelectItem>
                <SelectItem value="kritisch">Kritisch</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-12 w-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">Keine Artikel gefunden</p>
              <Button onClick={() => openDialog()} variant="outline" className="mt-4 border-white/20 text-white/70">
                Ersten Artikel anlegen
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(a => {
                const status = getBestandStatus(a);
                const bestandProzent = a.maximalbestand > 0 ? Math.min((a.bestand / a.maximalbestand) * 100, 100) : 0;
                return (
                  <Card key={a.id} className="bg-white/5 border-white/10 hover:border-white/20 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white/40 text-xs font-mono">{a.artikelnummer}</span>
                            <h3 className="font-semibold text-white">{a.name}</h3>
                            <Badge className={`text-xs border ${status.bg}`}>{status.label}</Badge>
                            <Badge variant="outline" className="text-xs border-white/20 text-white/50">{a.kategorie}</Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-sm text-white/50 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              <span className={status.color}>{a.bestand}</span> / {a.mindestbestand} Min. {a.einheit}
                            </span>
                            {a.lieferant && <span>{a.lieferant}</span>}
                            {a.lagerort && <span>📍 {a.lagerort}</span>}
                          </div>
                          <div className="mt-2">
                            <Progress value={bestandProzent} className="h-1.5 bg-white/10" />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm space-y-0.5">
                            {a.einkaufspreis && <p className="text-white/50">EK: {formatEuro(a.einkaufspreis)}</p>}
                            {a.verkaufspreis && <p className="text-green-400">VK: {formatEuro(a.verkaufspreis)}</p>}
                          </div>
                          <div className="flex gap-1 mt-2 justify-end">
                            <Button size="sm" variant="outline" className="h-7 text-xs border-white/20 text-white/60 hover:text-white gap-1"
                              onClick={() => { setBuchungArtikel(a); setBuchungTyp('zugang'); setBuchungDialogOpen(true); }}>
                              <TrendingUp className="h-3 w-3" /> Zugang
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-white/20 text-white/60 hover:text-white gap-1"
                              onClick={() => { setBuchungArtikel(a); setBuchungTyp('abgang'); setBuchungDialogOpen(true); }}>
                              <TrendingDown className="h-3 w-3" /> Abgang
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-white/40 hover:text-white"
                              onClick={() => openDialog(a)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400/60 hover:text-red-400"
                              onClick={() => setDeleteId(a.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Bestellvorschläge Tab */}
        <TabsContent value="bestellvorschlaege" className="mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-orange-400" />
                Automatische Bestellvorschläge
              </CardTitle>
            </CardHeader>
            <CardContent>
              {artikel.filter(a => a.bestand <= a.mindestbestand).length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-10 w-10 text-white/20 mx-auto mb-2" />
                  <p className="text-white/40 text-sm">Alle Artikel haben ausreichend Bestand</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {artikel.filter(a => a.bestand <= a.mindestbestand).map(a => {
                    const bestellmenge = a.maximalbestand - a.bestand;
                    const bestellwert = bestellmenge * (a.einkaufspreis || 0);
                    return (
                      <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                        <div>
                          <p className="text-white font-medium text-sm">{a.name}</p>
                          <p className="text-white/50 text-xs">
                            Bestand: {a.bestand} {a.einheit} · Minimum: {a.mindestbestand} · Bestellen: {bestellmenge} {a.einheit}
                          </p>
                          {a.lieferant && <p className="text-white/40 text-xs">Lieferant: {a.lieferant}</p>}
                        </div>
                        <div className="text-right">
                          {bestellwert > 0 && <p className="text-orange-400 font-semibold text-sm">{formatEuro(bestellwert)}</p>}
                          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs mt-1">
                            {bestellmenge} {a.einheit} bestellen
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t border-white/10 pt-3 flex justify-between font-semibold">
                    <span className="text-white">Gesamter Bestellwert</span>
                    <span className="text-orange-400">
                      {formatEuro(artikel.filter(a => a.bestand <= a.mindestbestand).reduce((s, a) => {
                        return s + (a.maximalbestand - a.bestand) * (a.einkaufspreis || 0);
                      }, 0))}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auswertung Tab */}
        <TabsContent value="auswertung" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Bestand nach Kategorie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {KATEGORIEN.map(kat => {
                  const artikelInKat = artikel.filter(a => a.kategorie === kat);
                  if (artikelInKat.length === 0) return null;
                  const wert = artikelInKat.reduce((s, a) => s + a.bestand * (a.einkaufspreis || 0), 0);
                  const anteil = gesamtwertEinkauf > 0 ? (wert / gesamtwertEinkauf) * 100 : 0;
                  return (
                    <div key={kat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white/70">{kat} ({artikelInKat.length})</span>
                        <span className="text-white">{formatEuro(wert)}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${anteil}%` }} />
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Lager-Kennzahlen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-white/50 text-sm">Artikel gesamt</span>
                  <span className="text-white font-semibold">{artikel.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50 text-sm">Aktive Artikel</span>
                  <span className="text-white font-semibold">{artikel.filter(a => a.aktiv).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50 text-sm">Lagerwert (EK)</span>
                  <span className="text-blue-400 font-semibold">{formatEuro(gesamtwertEinkauf)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50 text-sm">Lagerwert (VK)</span>
                  <span className="text-green-400 font-semibold">{formatEuro(gesamtwertVerkauf)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50 text-sm">Rohertragspotenzial</span>
                  <span className="text-indigo-400 font-semibold">{formatEuro(gesamtwertVerkauf - gesamtwertEinkauf)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50 text-sm">Kritische Artikel</span>
                  <span className={`font-semibold ${kritischeArtikel > 0 ? 'text-orange-400' : 'text-green-400'}`}>{kritischeArtikel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50 text-sm">Leere Artikel</span>
                  <span className={`font-semibold ${leereArtikel > 0 ? 'text-red-400' : 'text-green-400'}`}>{leereArtikel}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editArtikel ? 'Artikel bearbeiten' : 'Neuer Artikel'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-white/70">Artikelnummer</Label>
              <Input value={form.artikelnummer} onChange={e => setForm(f => ({ ...f, artikelnummer: e.target.value }))}
                className="mt-1 bg-white/5 border-white/10 text-white font-mono" />
            </div>
            <div>
              <Label className="text-white/70">Kategorie</Label>
              <Select value={form.kategorie} onValueChange={v => setForm(f => ({ ...f, kategorie: v }))}>
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KATEGORIEN.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-white/70">Artikelname *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="z.B. Druckerpapier A4" className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Aktueller Bestand</Label>
              <Input type="number" value={form.bestand} onChange={e => setForm(f => ({ ...f, bestand: e.target.value }))}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Einheit</Label>
              <Select value={form.einheit} onValueChange={v => setForm(f => ({ ...f, einheit: v }))}>
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EINHEITEN.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70">Mindestbestand</Label>
              <Input type="number" value={form.mindestbestand} onChange={e => setForm(f => ({ ...f, mindestbestand: e.target.value }))}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Maximalbestand</Label>
              <Input type="number" value={form.maximalbestand} onChange={e => setForm(f => ({ ...f, maximalbestand: e.target.value }))}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Einkaufspreis (€)</Label>
              <Input type="number" step="0.01" value={form.einkaufspreis} onChange={e => setForm(f => ({ ...f, einkaufspreis: e.target.value }))}
                placeholder="0,00" className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Verkaufspreis (€)</Label>
              <Input type="number" step="0.01" value={form.verkaufspreis} onChange={e => setForm(f => ({ ...f, verkaufspreis: e.target.value }))}
                placeholder="0,00" className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Lieferant</Label>
              <Input value={form.lieferant} onChange={e => setForm(f => ({ ...f, lieferant: e.target.value }))}
                placeholder="z.B. Bürobedarf GmbH" className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Lagerort</Label>
              <Input value={form.lagerort} onChange={e => setForm(f => ({ ...f, lagerort: e.target.value }))}
                placeholder="z.B. Regal A3" className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div className="col-span-2">
              <Label className="text-white/70">Beschreibung</Label>
              <Textarea value={form.beschreibung} onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
                rows={2} className="mt-1 bg-white/5 border-white/10 text-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-white/60">Abbrechen</Button>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
              {editArtikel ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buchungs-Dialog */}
      <Dialog open={buchungDialogOpen} onOpenChange={setBuchungDialogOpen}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {buchungTyp === 'zugang' ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
              {buchungTyp === 'zugang' ? 'Zugang' : 'Abgang'} buchen
            </DialogTitle>
          </DialogHeader>
          {buchungArtikel && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-white font-medium">{buchungArtikel.name}</p>
                <p className="text-white/50 text-sm">Aktueller Bestand: {buchungArtikel.bestand} {buchungArtikel.einheit}</p>
              </div>
              <div className="flex gap-2">
                <Button variant={buchungTyp === 'zugang' ? 'default' : 'outline'}
                  className={buchungTyp === 'zugang' ? 'bg-green-600 hover:bg-green-700 flex-1' : 'flex-1 border-white/20 text-white/60'}
                  onClick={() => setBuchungTyp('zugang')}>
                  <TrendingUp className="h-4 w-4 mr-1" /> Zugang
                </Button>
                <Button variant={buchungTyp === 'abgang' ? 'default' : 'outline'}
                  className={buchungTyp === 'abgang' ? 'bg-red-600 hover:bg-red-700 flex-1' : 'flex-1 border-white/20 text-white/60'}
                  onClick={() => setBuchungTyp('abgang')}>
                  <TrendingDown className="h-4 w-4 mr-1" /> Abgang
                </Button>
              </div>
              <div>
                <Label className="text-white/70">Menge ({buchungArtikel.einheit})</Label>
                <Input type="number" value={buchungMenge} onChange={e => setBuchungMenge(e.target.value)}
                  placeholder="0" className="mt-1 bg-white/5 border-white/10 text-white text-lg" autoFocus />
              </div>
              <div>
                <Label className="text-white/70">Grund (optional)</Label>
                <Input value={buchungGrund} onChange={e => setBuchungGrund(e.target.value)}
                  placeholder="z.B. Lieferung, Verkauf, Inventur..." className="mt-1 bg-white/5 border-white/10 text-white" />
              </div>
              {buchungMenge && !isNaN(parseFloat(buchungMenge)) && (
                <div className="p-2 rounded bg-white/5 text-sm text-white/60">
                  Neuer Bestand: <span className="text-white font-semibold">
                    {buchungTyp === 'zugang'
                      ? buchungArtikel.bestand + parseFloat(buchungMenge)
                      : buchungArtikel.bestand - parseFloat(buchungMenge)
                    } {buchungArtikel.einheit}
                  </span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuchungDialogOpen(false)} className="text-white/60">Abbrechen</Button>
            <Button onClick={handleBuchung}
              className={buchungTyp === 'zugang' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}>
              Buchen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white">
          <DialogHeader><DialogTitle>Artikel löschen?</DialogTitle></DialogHeader>
          <p className="text-white/60 text-sm">Dieser Artikel wird unwiderruflich gelöscht.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-white/60">Abbrechen</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
