import { useState, useEffect, useMemo } from 'react';
import { Plus, FileText, Search, Pencil, Trash2, Bell, AlertTriangle, CheckCircle, Clock, Calendar, Euro, Tag, Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Vertrag {
  id: string;
  company_id: string;
  name: string;
  vertragspartner: string;
  kategorie: string;
  status: 'aktiv' | 'gekuendigt' | 'abgelaufen' | 'entwurf';
  startdatum: string;
  enddatum: string | null;
  kuendigungsfrist_tage: number;
  naechste_kuendigung: string | null;
  betrag_monatlich: number | null;
  betrag_jaehrlich: number | null;
  zahlungsintervall: string;
  notizen: string | null;
  erinnerung_tage: number;
  created_at: string;
}

const KATEGORIEN = [
  'Miete & Immobilien', 'Software & Lizenzen', 'Versicherungen', 'Telekommunikation',
  'Energie & Strom', 'Leasing & Finanzierung', 'Wartung & Service', 'Marketing & Werbung',
  'Personal & HR', 'Beratung & Dienstleistung', 'Sonstiges'
];

const ZAHLUNGSINTERVALLE = [
  { value: 'monatlich', label: 'Monatlich' },
  { value: 'vierteljaehrlich', label: 'Vierteljährlich' },
  { value: 'halbjaehrlich', label: 'Halbjährlich' },
  { value: 'jaehrlich', label: 'Jährlich' },
  { value: 'einmalig', label: 'Einmalig' },
];

const STATUS_CONFIG = {
  aktiv: { label: 'Aktiv', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  gekuendigt: { label: 'Gekündigt', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  abgelaufen: { label: 'Abgelaufen', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  entwurf: { label: 'Entwurf', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatEuro(val: number | null): string {
  if (val == null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
}

export default function Vertragsmanagement() {
  const { currentCompany } = useCompany();
  const [vertraege, setVertraege] = useState<Vertrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKategorie, setFilterKategorie] = useState('alle');
  const [filterStatus, setFilterStatus] = useState('alle');
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVertrag, setEditVertrag] = useState<Vertrag | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', vertragspartner: '', kategorie: 'Sonstiges', status: 'aktiv' as Vertrag['status'],
    startdatum: new Date().toISOString().split('T')[0], enddatum: '',
    kuendigungsfrist_tage: 30, naechste_kuendigung: '', betrag_monatlich: '',
    betrag_jaehrlich: '', zahlungsintervall: 'monatlich', notizen: '', erinnerung_tage: 30,
  });

  const fetchVertraege = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('vertraege')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });
    if (error) { toast.error('Fehler beim Laden der Verträge'); }
    else { setVertraege((data || []) as Vertrag[]); }
    setLoading(false);
  };

  useEffect(() => { fetchVertraege(); }, [currentCompany?.id]);

  const openDialog = (v?: Vertrag) => {
    if (v) {
      setEditVertrag(v);
      setForm({
        name: v.name, vertragspartner: v.vertragspartner, kategorie: v.kategorie,
        status: v.status, startdatum: v.startdatum, enddatum: v.enddatum || '',
        kuendigungsfrist_tage: v.kuendigungsfrist_tage, naechste_kuendigung: v.naechste_kuendigung || '',
        betrag_monatlich: v.betrag_monatlich?.toString() || '', betrag_jaehrlich: v.betrag_jaehrlich?.toString() || '',
        zahlungsintervall: v.zahlungsintervall, notizen: v.notizen || '', erinnerung_tage: v.erinnerung_tage,
      });
    } else {
      setEditVertrag(null);
      setForm({
        name: '', vertragspartner: '', kategorie: 'Sonstiges', status: 'aktiv',
        startdatum: new Date().toISOString().split('T')[0], enddatum: '',
        kuendigungsfrist_tage: 30, naechste_kuendigung: '', betrag_monatlich: '',
        betrag_jaehrlich: '', zahlungsintervall: 'monatlich', notizen: '', erinnerung_tage: 30,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentCompany?.id || !form.name.trim() || !form.vertragspartner.trim()) {
      toast.error('Name und Vertragspartner sind Pflichtfelder'); return;
    }
    const payload = {
      company_id: currentCompany.id,
      name: form.name.trim(), vertragspartner: form.vertragspartner.trim(),
      kategorie: form.kategorie, status: form.status,
      startdatum: form.startdatum, enddatum: form.enddatum || null,
      kuendigungsfrist_tage: form.kuendigungsfrist_tage,
      naechste_kuendigung: form.naechste_kuendigung || null,
      betrag_monatlich: form.betrag_monatlich ? parseFloat(form.betrag_monatlich) : null,
      betrag_jaehrlich: form.betrag_jaehrlich ? parseFloat(form.betrag_jaehrlich) : null,
      zahlungsintervall: form.zahlungsintervall, notizen: form.notizen || null,
      erinnerung_tage: form.erinnerung_tage,
    };
    if (editVertrag) {
      const { error } = await supabase.from('vertraege').update(payload).eq('id', editVertrag.id);
      if (error) { toast.error('Fehler beim Speichern'); return; }
      toast.success('Vertrag aktualisiert');
    } else {
      const { error } = await supabase.from('vertraege').insert(payload);
      if (error) { toast.error('Fehler beim Erstellen'); return; }
      toast.success('Vertrag erstellt');
    }
    setDialogOpen(false);
    fetchVertraege();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('vertraege').delete().eq('id', deleteId);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Vertrag gelöscht');
    setDeleteId(null);
    fetchVertraege();
  };

  const filtered = useMemo(() => vertraege.filter(v => {
    const matchSearch = v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.vertragspartner.toLowerCase().includes(search.toLowerCase());
    const matchKat = filterKategorie === 'alle' || v.kategorie === filterKategorie;
    const matchStatus = filterStatus === 'alle' || v.status === filterStatus;
    return matchSearch && matchKat && matchStatus;
  }), [vertraege, search, filterKategorie, filterStatus]);

  // KPIs
  const gesamtMonatlich = vertraege.filter(v => v.status === 'aktiv').reduce((s, v) => {
    if (v.betrag_monatlich) return s + v.betrag_monatlich;
    if (v.betrag_jaehrlich) return s + v.betrag_jaehrlich / 12;
    return s;
  }, 0);
  const baldKuendbar = vertraege.filter(v => {
    if (v.status !== 'aktiv' || !v.naechste_kuendigung) return false;
    const days = getDaysUntil(v.naechste_kuendigung);
    return days !== null && days <= v.erinnerung_tage && days >= 0;
  });
  const aktiveVertraege = vertraege.filter(v => v.status === 'aktiv').length;

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-400" />
            Vertragsmanagement
          </h1>
          <p className="text-white/50 text-sm mt-1">Alle Verträge, Laufzeiten und Kündigungsfristen im Blick</p>
        </div>
        <Button onClick={() => openDialog()} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="h-4 w-4" /> Neuer Vertrag
        </Button>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <p className="text-white/50 text-xs">Aktive Verträge</p>
            <p className="text-2xl font-bold text-white mt-1">{aktiveVertraege}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <p className="text-white/50 text-xs">Monatliche Kosten</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{formatEuro(gesamtMonatlich)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <p className="text-white/50 text-xs">Jährliche Kosten</p>
            <p className="text-2xl font-bold text-orange-400 mt-1">{formatEuro(gesamtMonatlich * 12)}</p>
          </CardContent>
        </Card>
        <Card className={`border ${baldKuendbar.length > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/5 border-white/10'}`}>
          <CardContent className="p-4">
            <p className="text-white/50 text-xs">Bald kündbar</p>
            <p className={`text-2xl font-bold mt-1 ${baldKuendbar.length > 0 ? 'text-yellow-400' : 'text-white'}`}>
              {baldKuendbar.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Warnungen für bald kündbare Verträge */}
      {baldKuendbar.length > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-yellow-400 font-medium text-sm">Kündigungsfristen laufen ab</span>
            </div>
            <div className="space-y-2">
              {baldKuendbar.map(v => {
                const days = getDaysUntil(v.naechste_kuendigung);
                return (
                  <div key={v.id} className="flex items-center justify-between text-sm">
                    <span className="text-white">{v.name} – {v.vertragspartner}</span>
                    <span className="text-yellow-400">
                      {days === 0 ? 'Heute!' : `Noch ${days} Tag${days === 1 ? '' : 'e'}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="uebersicht" className="gap-2">
            <FileText className="h-4 w-4" /> Alle Verträge
          </TabsTrigger>
          <TabsTrigger value="kalender" className="gap-2">
            <Calendar className="h-4 w-4" /> Kalender
          </TabsTrigger>
          <TabsTrigger value="kosten" className="gap-2">
            <Euro className="h-4 w-4" /> Kostenanalyse
          </TabsTrigger>
        </TabsList>

        {/* Übersicht Tab */}
        <TabsContent value="uebersicht" className="space-y-4 mt-4">
          {/* Filter */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Vertrag oder Partner suchen..." className="pl-9 bg-white/5 border-white/10 text-white" />
            </div>
            <Select value={filterKategorie} onValueChange={setFilterKategorie}>
              <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                {KATEGORIEN.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vertrags-Liste */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">Keine Verträge gefunden</p>
              <Button onClick={() => openDialog()} variant="outline" className="mt-4 border-white/20 text-white/70">
                Ersten Vertrag anlegen
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(v => {
                const daysUntilKuendigung = getDaysUntil(v.naechste_kuendigung);
                const isWarning = daysUntilKuendigung !== null && daysUntilKuendigung <= v.erinnerung_tage && daysUntilKuendigung >= 0;
                return (
                  <Card key={v.id} className={`border transition-all hover:border-white/20 ${isWarning ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-white/5 border-white/10'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white truncate">{v.name}</h3>
                            <Badge className={`text-xs border ${STATUS_CONFIG[v.status].color}`}>
                              {STATUS_CONFIG[v.status].label}
                            </Badge>
                            {isWarning && (
                              <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                <Bell className="h-3 w-3 mr-1" />
                                Kündigung in {daysUntilKuendigung}d
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-white/50 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> {v.vertragspartner}
                            </span>
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" /> {v.kategorie}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> ab {new Date(v.startdatum).toLocaleDateString('de-DE')}
                              {v.enddatum && ` bis ${new Date(v.enddatum).toLocaleDateString('de-DE')}`}
                            </span>
                            {v.kuendigungsfrist_tage > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {v.kuendigungsfrist_tage} Tage Frist
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {v.betrag_monatlich && (
                            <p className="text-white font-semibold">{formatEuro(v.betrag_monatlich)}/Monat</p>
                          )}
                          {v.betrag_jaehrlich && !v.betrag_monatlich && (
                            <p className="text-white font-semibold">{formatEuro(v.betrag_jaehrlich)}/Jahr</p>
                          )}
                          <div className="flex gap-1 mt-2 justify-end">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-white/40 hover:text-white"
                              onClick={() => openDialog(v)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400/60 hover:text-red-400"
                              onClick={() => setDeleteId(v.id)}>
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

        {/* Kalender Tab */}
        <TabsContent value="kalender" className="mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Kündigungsfristen – nächste 12 Monate</CardTitle>
            </CardHeader>
            <CardContent>
              {vertraege.filter(v => v.naechste_kuendigung && v.status === 'aktiv').length === 0 ? (
                <p className="text-white/40 text-sm text-center py-8">Keine Kündigungsfristen eingetragen</p>
              ) : (
                <div className="space-y-3">
                  {vertraege
                    .filter(v => v.naechste_kuendigung && v.status === 'aktiv')
                    .sort((a, b) => new Date(a.naechste_kuendigung!).getTime() - new Date(b.naechste_kuendigung!).getTime())
                    .map(v => {
                      const days = getDaysUntil(v.naechste_kuendigung);
                      const isUrgent = days !== null && days <= 14;
                      const isSoon = days !== null && days <= 30;
                      return (
                        <div key={v.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                          isUrgent ? 'bg-red-500/10 border-red-500/30' :
                          isSoon ? 'bg-yellow-500/10 border-yellow-500/30' :
                          'bg-white/5 border-white/10'
                        }`}>
                          <div>
                            <p className="text-white font-medium text-sm">{v.name}</p>
                            <p className="text-white/50 text-xs">{v.vertragspartner} · Frist: {v.kuendigungsfrist_tage} Tage</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold text-sm ${isUrgent ? 'text-red-400' : isSoon ? 'text-yellow-400' : 'text-white'}`}>
                              {new Date(v.naechste_kuendigung!).toLocaleDateString('de-DE')}
                            </p>
                            <p className="text-white/40 text-xs">
                              {days === 0 ? 'Heute!' : days !== null ? `in ${days} Tagen` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kostenanalyse Tab */}
        <TabsContent value="kosten" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Kosten nach Kategorie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {KATEGORIEN.map(kat => {
                  const vertraegeInKat = vertraege.filter(v => v.kategorie === kat && v.status === 'aktiv');
                  if (vertraegeInKat.length === 0) return null;
                  const summe = vertraegeInKat.reduce((s, v) => {
                    if (v.betrag_monatlich) return s + v.betrag_monatlich;
                    if (v.betrag_jaehrlich) return s + v.betrag_jaehrlich / 12;
                    return s;
                  }, 0);
                  const anteil = gesamtMonatlich > 0 ? (summe / gesamtMonatlich) * 100 : 0;
                  return (
                    <div key={kat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white/70">{kat}</span>
                        <span className="text-white">{formatEuro(summe)}/Mo.</span>
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
                <CardTitle className="text-white text-base">Jahresübersicht</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                  const monat = new Date(2026, m - 1, 1).toLocaleDateString('de-DE', { month: 'long' });
                  return (
                    <div key={m} className="flex justify-between text-sm">
                      <span className="text-white/50">{monat}</span>
                      <span className="text-white">{formatEuro(gesamtMonatlich)}</span>
                    </div>
                  );
                })}
                <div className="border-t border-white/10 pt-3 flex justify-between font-semibold">
                  <span className="text-white">Gesamt 2026</span>
                  <span className="text-red-400">{formatEuro(gesamtMonatlich * 12)}</span>
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
            <DialogTitle>{editVertrag ? 'Vertrag bearbeiten' : 'Neuer Vertrag'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-white/70">Vertragsbezeichnung *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="z.B. Office 365 Lizenz" className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div className="col-span-2">
              <Label className="text-white/70">Vertragspartner *</Label>
              <Input value={form.vertragspartner} onChange={e => setForm(f => ({ ...f, vertragspartner: e.target.value }))}
                placeholder="z.B. Microsoft GmbH" className="mt-1 bg-white/5 border-white/10 text-white" />
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
            <div>
              <Label className="text-white/70">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Vertrag['status'] }))}>
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70">Startdatum</Label>
              <Input type="date" value={form.startdatum} onChange={e => setForm(f => ({ ...f, startdatum: e.target.value }))}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Enddatum (optional)</Label>
              <Input type="date" value={form.enddatum} onChange={e => setForm(f => ({ ...f, enddatum: e.target.value }))}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Kündigungsfrist (Tage)</Label>
              <Input type="number" value={form.kuendigungsfrist_tage}
                onChange={e => setForm(f => ({ ...f, kuendigungsfrist_tage: parseInt(e.target.value) || 0 }))}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Nächste Kündigung bis</Label>
              <Input type="date" value={form.naechste_kuendigung}
                onChange={e => setForm(f => ({ ...f, naechste_kuendigung: e.target.value }))}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Betrag monatlich (€)</Label>
              <Input type="number" step="0.01" value={form.betrag_monatlich}
                onChange={e => setForm(f => ({ ...f, betrag_monatlich: e.target.value }))}
                placeholder="0,00" className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Betrag jährlich (€)</Label>
              <Input type="number" step="0.01" value={form.betrag_jaehrlich}
                onChange={e => setForm(f => ({ ...f, betrag_jaehrlich: e.target.value }))}
                placeholder="0,00" className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70">Zahlungsintervall</Label>
              <Select value={form.zahlungsintervall} onValueChange={v => setForm(f => ({ ...f, zahlungsintervall: v }))}>
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZAHLUNGSINTERVALLE.map(z => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70">Erinnerung (Tage vorher)</Label>
              <Input type="number" value={form.erinnerung_tage}
                onChange={e => setForm(f => ({ ...f, erinnerung_tage: parseInt(e.target.value) || 30 }))}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div className="col-span-2">
              <Label className="text-white/70">Notizen</Label>
              <Textarea value={form.notizen} onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))}
                placeholder="Zusätzliche Informationen..." rows={3}
                className="mt-1 bg-white/5 border-white/10 text-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-white/60">Abbrechen</Button>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
              {editVertrag ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Vertrag löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-white/60 text-sm">Dieser Vertrag wird unwiderruflich gelöscht.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-white/60">Abbrechen</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
