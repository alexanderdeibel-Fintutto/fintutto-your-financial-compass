/**
 * Projektverwaltung + Zeiterfassung
 *
 * Features:
 * - Projekte anlegen, verwalten, Status-Workflow
 * - Zeiterfassung pro Projekt (Start/Stop-Timer + manuelle Eingabe)
 * - Stundensatz-Kalkulation und Projektbudget
 * - Abrechenbare vs. nicht-abrechenbare Stunden
 * - Projektrechnung aus Zeiteinträgen generieren
 * - Auslastungsübersicht
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Play, Square, Clock, FolderOpen, Euro,
  BarChart3, Users, Calendar, ChevronRight, Edit, Trash2,
  FileText, Timer, CheckCircle, AlertCircle, Pause,
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Projekt {
  id: string;
  projektnummer: string;
  bezeichnung: string;
  beschreibung: string | null;
  status: 'planung' | 'aktiv' | 'pausiert' | 'abgeschlossen' | 'storniert';
  startdatum: string | null;
  enddatum: string | null;
  budget: number | null;
  stundensatz: number | null;
  farbe: string;
}

interface Zeiteintrag {
  id: string;
  projekt_id: string | null;
  datum: string;
  start_zeit: string | null;
  end_zeit: string | null;
  dauer_minuten: number;
  beschreibung: string | null;
  abrechenbar: boolean;
  abgerechnet: boolean;
  stundensatz: number | null;
  betrag: number | null;
}

const STATUS_CONFIG = {
  planung: { label: 'Planung', color: 'text-muted-foreground', bg: 'bg-muted/30' },
  aktiv: { label: 'Aktiv', color: 'text-success', bg: 'bg-success/10' },
  pausiert: { label: 'Pausiert', color: 'text-warning', bg: 'bg-warning/10' },
  abgeschlossen: { label: 'Abgeschlossen', color: 'text-primary', bg: 'bg-primary/10' },
  storniert: { label: 'Storniert', color: 'text-destructive', bg: 'bg-destructive/10' },
};

const FARBEN = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('de-DE');
const fmtMinuten = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m > 0 ? m + 'min' : ''}`.trim();
};

export default function Projektverwaltung() {
  const { currentCompany } = useCompany();
  const [projekte, setProjekte] = useState<Projekt[]>([]);
  const [zeiteintraege, setZeiteintraege] = useState<Zeiteintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [projektDialog, setProjektDialog] = useState(false);
  const [zeitDialog, setZeitDialog] = useState(false);
  const [selectedProjekt, setSelectedProjekt] = useState<Projekt | null>(null);
  const [selectedZeit, setSelectedZeit] = useState<Zeiteintrag | null>(null);
  const [activeTab, setActiveTab] = useState('projekte');
  const [filterStatus, setFilterStatus] = useState('alle');
  const [searchQuery, setSearchQuery] = useState('');

  // Timer-State
  const [timerLaeuft, setTimerLaeuft] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [timerSekunden, setTimerSekunden] = useState(0);
  const [timerProjektId, setTimerProjektId] = useState('');
  const [timerBeschreibung, setTimerBeschreibung] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [projektForm, setProjektForm] = useState({
    bezeichnung: '', beschreibung: '', status: 'aktiv' as Projekt['status'],
    startdatum: new Date().toISOString().split('T')[0], enddatum: '',
    budget: '', stundensatz: '', farbe: '#3b82f6',
  });

  const [zeitForm, setZeitForm] = useState({
    projekt_id: '', datum: new Date().toISOString().split('T')[0],
    start_zeit: '', end_zeit: '', dauer_minuten: '',
    beschreibung: '', abrechenbar: true, stundensatz: '',
  });

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    const [{ data: p }, { data: z }] = await Promise.all([
      (supabase as any).from('projekte').select('*').eq('company_id', currentCompany.id).order('created_at', { ascending: false }),
      (supabase as any).from('zeiteintraege').select('*').eq('company_id', currentCompany.id).order('datum', { ascending: false }).limit(200),
    ]);
    setProjekte(p || []);
    setZeiteintraege(z || []);
    setLoading(false);
  }, [currentCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Timer-Logik
  useEffect(() => {
    if (timerLaeuft) {
      timerRef.current = setInterval(() => {
        setTimerSekunden(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerLaeuft]);

  const startTimer = () => {
    if (!timerProjektId) { toast.error('Bitte erst ein Projekt auswählen'); return; }
    setTimerStart(new Date());
    setTimerSekunden(0);
    setTimerLaeuft(true);
    toast.success('Timer gestartet');
  };

  const stopTimer = async () => {
    if (!timerStart || !currentCompany) return;
    setTimerLaeuft(false);
    const endTime = new Date();
    const dauerMin = Math.round((endTime.getTime() - timerStart.getTime()) / 60000);
    if (dauerMin < 1) { toast.error('Mindestdauer: 1 Minute'); return; }

    const projekt = projekte.find(p => p.id === timerProjektId);
    const stundensatz = projekt?.stundensatz || 0;
    const betrag = stundensatz > 0 ? (dauerMin / 60) * stundensatz : null;

    const { error } = await (supabase as any).from('zeiteintraege').insert({
      company_id: currentCompany.id,
      projekt_id: timerProjektId || null,
      datum: timerStart.toISOString().split('T')[0],
      start_zeit: timerStart.toTimeString().slice(0, 5),
      end_zeit: endTime.toTimeString().slice(0, 5),
      dauer_minuten: dauerMin,
      beschreibung: timerBeschreibung || null,
      abrechenbar: true,
      abgerechnet: false,
      stundensatz: stundensatz || null,
      betrag,
    });

    if (error) { toast.error('Fehler beim Speichern'); return; }
    toast.success(`Zeiteintrag gespeichert: ${fmtMinuten(dauerMin)}`);
    setTimerSekunden(0);
    setTimerBeschreibung('');
    fetchData();
  };

  const saveProjekt = async () => {
    if (!currentCompany || !projektForm.bezeichnung.trim()) { toast.error('Bezeichnung erforderlich'); return; }
    const num = `P-${Date.now().toString().slice(-6)}`;
    const payload: any = {
      company_id: currentCompany.id,
      projektnummer: selectedProjekt?.projektnummer || num,
      bezeichnung: projektForm.bezeichnung.trim(),
      beschreibung: projektForm.beschreibung || null,
      status: projektForm.status,
      startdatum: projektForm.startdatum || null,
      enddatum: projektForm.enddatum || null,
      budget: projektForm.budget ? parseFloat(projektForm.budget) : null,
      stundensatz: projektForm.stundensatz ? parseFloat(projektForm.stundensatz) : null,
      farbe: projektForm.farbe,
    };

    let error;
    if (selectedProjekt) {
      ({ error } = await (supabase as any).from('projekte').update(payload).eq('id', selectedProjekt.id));
    } else {
      ({ error } = await (supabase as any).from('projekte').insert(payload));
    }
    if (error) { toast.error('Fehler: ' + error.message); return; }
    toast.success(selectedProjekt ? 'Projekt aktualisiert' : 'Projekt erstellt');
    setProjektDialog(false);
    setSelectedProjekt(null);
    fetchData();
  };

  const saveZeit = async () => {
    if (!currentCompany) return;
    let dauerMin = parseInt(zeitForm.dauer_minuten);
    if (zeitForm.start_zeit && zeitForm.end_zeit && !dauerMin) {
      const [sh, sm] = zeitForm.start_zeit.split(':').map(Number);
      const [eh, em] = zeitForm.end_zeit.split(':').map(Number);
      dauerMin = (eh * 60 + em) - (sh * 60 + sm);
    }
    if (!dauerMin || dauerMin <= 0) { toast.error('Bitte Dauer oder Start/Ende angeben'); return; }

    const projekt = projekte.find(p => p.id === zeitForm.projekt_id);
    const stundensatz = zeitForm.stundensatz ? parseFloat(zeitForm.stundensatz) : (projekt?.stundensatz || 0);
    const betrag = stundensatz > 0 && zeitForm.abrechenbar ? (dauerMin / 60) * stundensatz : null;

    const payload: any = {
      company_id: currentCompany.id,
      projekt_id: zeitForm.projekt_id || null,
      datum: zeitForm.datum,
      start_zeit: zeitForm.start_zeit || null,
      end_zeit: zeitForm.end_zeit || null,
      dauer_minuten: dauerMin,
      beschreibung: zeitForm.beschreibung || null,
      abrechenbar: zeitForm.abrechenbar,
      abgerechnet: false,
      stundensatz: stundensatz || null,
      betrag,
    };

    let error;
    if (selectedZeit) {
      ({ error } = await (supabase as any).from('zeiteintraege').update(payload).eq('id', selectedZeit.id));
    } else {
      ({ error } = await (supabase as any).from('zeiteintraege').insert(payload));
    }
    if (error) { toast.error('Fehler: ' + error.message); return; }
    toast.success('Zeiteintrag gespeichert');
    setZeitDialog(false);
    setSelectedZeit(null);
    fetchData();
  };

  const gefiltert = projekte.filter(p => {
    if (filterStatus !== 'alle' && p.status !== filterStatus) return false;
    if (searchQuery && !p.bezeichnung.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const gesamtStunden = zeiteintraege.reduce((s, z) => s + z.dauer_minuten, 0);
  const abrechenbarStunden = zeiteintraege.filter(z => z.abrechenbar).reduce((s, z) => s + z.dauer_minuten, 0);
  const offenerBetrag = zeiteintraege.filter(z => z.abrechenbar && !z.abgerechnet && z.betrag).reduce((s, z) => s + (z.betrag || 0), 0);

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <FolderOpen className="h-8 w-8 text-primary" />
            Projektverwaltung
          </h1>
          <p className="text-muted-foreground">Projekte, Zeiterfassung und Abrechnung</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setSelectedZeit(null); setZeitForm({ projekt_id: '', datum: new Date().toISOString().split('T')[0], start_zeit: '', end_zeit: '', dauer_minuten: '', beschreibung: '', abrechenbar: true, stundensatz: '' }); setZeitDialog(true); }}>
            <Clock className="mr-2 h-4 w-4" />Zeiteintrag
          </Button>
          <Button onClick={() => { setSelectedProjekt(null); setProjektForm({ bezeichnung: '', beschreibung: '', status: 'aktiv', startdatum: new Date().toISOString().split('T')[0], enddatum: '', budget: '', stundensatz: '', farbe: '#3b82f6' }); setProjektDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" />Projekt
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Aktive Projekte', value: String(projekte.filter(p => p.status === 'aktiv').length), icon: FolderOpen, color: 'text-primary' },
          { label: 'Gesamtstunden', value: fmtMinuten(gesamtStunden), icon: Clock, color: 'text-foreground' },
          { label: 'Abrechenbar', value: fmtMinuten(abrechenbarStunden), icon: CheckCircle, color: 'text-success' },
          { label: 'Offener Betrag', value: fmt(offenerBetrag), icon: Euro, color: 'text-warning' },
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

      {/* Timer-Widget */}
      <Card className={cn('glass border-2', timerLaeuft ? 'border-success/50 bg-success/5' : 'border-border')}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-full', timerLaeuft ? 'bg-success/20 animate-pulse' : 'bg-muted')}>
                <Timer className={cn('h-5 w-5', timerLaeuft ? 'text-success' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="font-medium text-sm">Zeiterfassung</p>
                <p className={cn('text-2xl font-mono font-bold tabular-nums', timerLaeuft ? 'text-success' : 'text-muted-foreground')}>
                  {String(Math.floor(timerSekunden / 3600)).padStart(2, '0')}:{String(Math.floor((timerSekunden % 3600) / 60)).padStart(2, '0')}:{String(timerSekunden % 60).padStart(2, '0')}
                </p>
              </div>
            </div>
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <Select value={timerProjektId} onValueChange={setTimerProjektId} disabled={timerLaeuft}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Projekt wählen..." /></SelectTrigger>
                <SelectContent>
                  {projekte.filter(p => p.status === 'aktiv').map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: p.farbe }} />
                      {p.bezeichnung}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Was wird gemacht?" value={timerBeschreibung} onChange={e => setTimerBeschreibung(e.target.value)} disabled={timerLaeuft} className="flex-1" />
            </div>
            {timerLaeuft ? (
              <Button variant="destructive" onClick={stopTimer}>
                <Square className="mr-2 h-4 w-4" />Stopp
              </Button>
            ) : (
              <Button variant="default" onClick={startTimer} className="bg-success hover:bg-success/90">
                <Play className="mr-2 h-4 w-4" />Start
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="projekte">Projekte ({projekte.length})</TabsTrigger>
          <TabsTrigger value="zeiten">Zeiteinträge ({zeiteintraege.length})</TabsTrigger>
        </TabsList>

        {/* Projekte */}
        <TabsContent value="projekte" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Projekt suchen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : gefiltert.length === 0 ? (
            <div className="p-12 text-center border rounded-xl">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="font-medium mb-1">Keine Projekte vorhanden</p>
              <Button onClick={() => setProjektDialog(true)} className="mt-2"><Plus className="mr-2 h-4 w-4" />Erstes Projekt</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gefiltert.map(p => {
                const pZeiten = zeiteintraege.filter(z => z.projekt_id === p.id);
                const gesamtMin = pZeiten.reduce((s, z) => s + z.dauer_minuten, 0);
                const abrechenbarBetrag = pZeiten.filter(z => z.abrechenbar && !z.abgerechnet && z.betrag).reduce((s, z) => s + (z.betrag || 0), 0);
                const budgetProzent = p.budget && gesamtMin > 0 ? Math.min((abrechenbarBetrag / p.budget) * 100, 100) : 0;
                const cfg = STATUS_CONFIG[p.status];
                return (
                  <Card key={p.id} className="glass hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedProjekt(p); setProjektForm({ bezeichnung: p.bezeichnung, beschreibung: p.beschreibung || '', status: p.status, startdatum: p.startdatum || '', enddatum: p.enddatum || '', budget: p.budget ? String(p.budget) : '', stundensatz: p.stundensatz ? String(p.stundensatz) : '', farbe: p.farbe }); setProjektDialog(true); }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.farbe }} />
                          <p className="font-semibold text-sm">{p.bezeichnung}</p>
                        </div>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color, cfg.bg)}>{cfg.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.beschreibung || 'Keine Beschreibung'}</p>
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtMinuten(gesamtMin)}</span>
                        {p.stundensatz && <span>{fmt(p.stundensatz)}/h</span>}
                        {abrechenbarBetrag > 0 && <span className="text-success font-medium">{fmt(abrechenbarBetrag)} offen</span>}
                      </div>
                      {p.budget && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Budget</span>
                            <span>{Math.round(budgetProzent)}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full">
                            <div className={cn('h-1.5 rounded-full', budgetProzent > 90 ? 'bg-destructive' : budgetProzent > 70 ? 'bg-warning' : 'bg-success')} style={{ width: `${budgetProzent}%` }} />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Zeiteinträge */}
        <TabsContent value="zeiten">
          <Card className="glass">
            <CardContent className="p-0">
              {zeiteintraege.length === 0 ? (
                <div className="p-12 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <p className="font-medium">Noch keine Zeiteinträge</p>
                  <p className="text-sm text-muted-foreground mt-1">Starten Sie den Timer oder fügen Sie manuell Zeiten hinzu.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground">Datum</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Projekt</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Beschreibung</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Dauer</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Betrag</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {zeiteintraege.slice(0, 50).map(z => {
                        const proj = projekte.find(p => p.id === z.projekt_id);
                        return (
                          <tr key={z.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3 text-muted-foreground">{fmtDate(z.datum)}</td>
                            <td className="p-3">
                              {proj ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: proj.farbe }} />
                                  {proj.bezeichnung}
                                </span>
                              ) : <span className="text-muted-foreground">–</span>}
                            </td>
                            <td className="p-3 text-muted-foreground">{z.beschreibung || '–'}</td>
                            <td className="p-3 text-right font-mono">{fmtMinuten(z.dauer_minuten)}</td>
                            <td className="p-3 text-right">{z.betrag ? fmt(z.betrag) : '–'}</td>
                            <td className="p-3 text-center">
                              {z.abgerechnet
                                ? <Badge variant="outline" className="text-xs text-success border-success/30">Abgerechnet</Badge>
                                : z.abrechenbar
                                  ? <Badge variant="outline" className="text-xs text-warning border-warning/30">Offen</Badge>
                                  : <Badge variant="outline" className="text-xs">Intern</Badge>}
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
      </Tabs>

      {/* Projekt-Dialog */}
      <Dialog open={projektDialog} onOpenChange={setProjektDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedProjekt ? 'Projekt bearbeiten' : 'Neues Projekt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bezeichnung *</Label>
              <Input placeholder="z.B. Website-Redesign Kunde XY" value={projektForm.bezeichnung} onChange={e => setProjektForm({ ...projektForm, bezeichnung: e.target.value })} />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea placeholder="Projektbeschreibung..." value={projektForm.beschreibung} onChange={e => setProjektForm({ ...projektForm, beschreibung: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={projektForm.status} onValueChange={(v: any) => setProjektForm({ ...projektForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Farbe</Label>
                <div className="flex gap-2 mt-1">
                  {FARBEN.map(f => (
                    <button key={f} className={cn('w-6 h-6 rounded-full border-2 transition-transform', projektForm.farbe === f ? 'border-foreground scale-110' : 'border-transparent')} style={{ backgroundColor: f }} onClick={() => setProjektForm({ ...projektForm, farbe: f })} />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Startdatum</Label>
                <Input type="date" value={projektForm.startdatum} onChange={e => setProjektForm({ ...projektForm, startdatum: e.target.value })} />
              </div>
              <div>
                <Label>Enddatum</Label>
                <Input type="date" value={projektForm.enddatum} onChange={e => setProjektForm({ ...projektForm, enddatum: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Budget (€)</Label>
                <Input type="number" placeholder="0,00" value={projektForm.budget} onChange={e => setProjektForm({ ...projektForm, budget: e.target.value })} />
              </div>
              <div>
                <Label>Stundensatz (€/h)</Label>
                <Input type="number" placeholder="0,00" value={projektForm.stundensatz} onChange={e => setProjektForm({ ...projektForm, stundensatz: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setProjektDialog(false); setSelectedProjekt(null); }}>Abbrechen</Button>
            <Button onClick={saveProjekt}>{selectedProjekt ? 'Aktualisieren' : 'Erstellen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zeiteintrag-Dialog */}
      <Dialog open={zeitDialog} onOpenChange={setZeitDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zeiteintrag manuell erfassen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Projekt</Label>
              <Select value={zeitForm.projekt_id} onValueChange={v => setZeitForm({ ...zeitForm, projekt_id: v })}>
                <SelectTrigger><SelectValue placeholder="Projekt wählen..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Kein Projekt</SelectItem>
                  {projekte.map(p => <SelectItem key={p.id} value={p.id}>{p.bezeichnung}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Datum *</Label>
                <Input type="date" value={zeitForm.datum} onChange={e => setZeitForm({ ...zeitForm, datum: e.target.value })} />
              </div>
              <div>
                <Label>Von</Label>
                <Input type="time" value={zeitForm.start_zeit} onChange={e => setZeitForm({ ...zeitForm, start_zeit: e.target.value })} />
              </div>
              <div>
                <Label>Bis</Label>
                <Input type="time" value={zeitForm.end_zeit} onChange={e => setZeitForm({ ...zeitForm, end_zeit: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Oder Dauer (Minuten)</Label>
              <Input type="number" placeholder="z.B. 90" value={zeitForm.dauer_minuten} onChange={e => setZeitForm({ ...zeitForm, dauer_minuten: e.target.value })} />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Input placeholder="Was wurde gemacht?" value={zeitForm.beschreibung} onChange={e => setZeitForm({ ...zeitForm, beschreibung: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Abrechenbar</Label>
              <Switch checked={zeitForm.abrechenbar} onCheckedChange={v => setZeitForm({ ...zeitForm, abrechenbar: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZeitDialog(false)}>Abbrechen</Button>
            <Button onClick={saveZeit}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
