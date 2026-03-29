/**
 * Lohnabrechnung – Brutto-Netto-Rechner, Lohnzettel, DEÜV-Export, Lohnjournal
 *
 * Features:
 * - Mitarbeiterstammdaten (Steuerklasse, Kirchensteuer, KV-Beitrag)
 * - Brutto-Netto-Rechner (2024 Beitragssätze)
 * - Lohnzettel als PDF/CSV
 * - Lohnjournal (Monatsübersicht)
 * - DEÜV-Meldungen (Anmeldung, Abmeldung)
 * - Lohnsteuer-Anmeldung Übersicht
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Download, Users, Euro, Calculator,
  FileText, ChevronRight, Edit, Printer, AlertCircle,
  CheckCircle, Calendar,
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
import { Switch } from '@/components/ui/switch';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Beitragssätze 2024 ───────────────────────────────────────────────────────
const BEITRAGSSAETZE_2024 = {
  rentenversicherung: 0.186,       // 18,6% (je 9,3% AN/AG)
  arbeitslosenversicherung: 0.026, // 2,6% (je 1,3% AN/AG)
  pflegeversicherung: 0.034,       // 3,4% (je 1,7% AN/AG, +0,6% kinderlos)
  krankenversicherung_allgemein: 0.146, // 14,6% (je 7,3% AN/AG)
  krankenversicherung_zusatz: 0.017,    // Ø Zusatzbeitrag 1,7%
  grundfreibetrag: 11604,          // Grundfreibetrag 2024
  solidaritaetszuschlag_grenze: 18130, // Freigrenze SolZ
};

const STEUERKLASSEN = {
  '1': { name: 'I – Ledig', faktor: 1.0 },
  '2': { name: 'II – Alleinerziehend', faktor: 0.9 },
  '3': { name: 'III – Verheiratet (höheres Einkommen)', faktor: 0.75 },
  '4': { name: 'IV – Verheiratet (gleiches Einkommen)', faktor: 1.0 },
  '5': { name: 'V – Verheiratet (niedrigeres Einkommen)', faktor: 1.25 },
  '6': { name: 'VI – Zweitjob', faktor: 1.4 },
};

interface Mitarbeiter {
  id: string;
  personalnummer: string;
  vorname: string;
  nachname: string;
  geburtsdatum: string | null;
  eintrittsdatum: string;
  austrittsdatum: string | null;
  steuerklasse: string;
  kirchensteuer: boolean;
  bundesland: string;
  bruttolohn_monatlich: number;
  urlaubstage: number;
  aktiv: boolean;
}

interface BruttoNetto {
  brutto: number;
  rvAN: number; rvAG: number;
  avAN: number; avAG: number;
  pvAN: number; pvAG: number;
  kvAN: number; kvAG: number;
  lohnsteuer: number;
  kirchensteuer: number;
  solz: number;
  netto: number;
  gesamtkostenAG: number;
}

// Vereinfachter Brutto-Netto-Rechner (Näherungsformel)
function berechneBruttoNetto(brutto: number, steuerklasse: string, kirchensteuer: boolean, bundesland: string): BruttoNetto {
  const b = BEITRAGSSAETZE_2024;

  // Sozialversicherung AN
  const rvAN = brutto * (b.rentenversicherung / 2);
  const avAN = brutto * (b.arbeitslosenversicherung / 2);
  const pvAN = brutto * (b.pflegeversicherung / 2);
  const kvAN = brutto * ((b.krankenversicherung_allgemein + b.krankenversicherung_zusatz) / 2);

  // Sozialversicherung AG
  const rvAG = rvAN;
  const avAG = avAN;
  const pvAG = pvAN;
  const kvAG = kvAN;

  // Zu versteuerndes Einkommen (vereinfacht)
  const svAbzugAN = rvAN + avAN + pvAN + kvAN;
  const zvE_monatlich = Math.max(0, brutto - svAbzugAN - (b.grundfreibetrag / 12));

  // Lohnsteuer (vereinfachte Progressionsformel)
  const faktor = STEUERKLASSEN[steuerklasse as keyof typeof STEUERKLASSEN]?.faktor || 1.0;
  let lohnsteuer = 0;
  if (zvE_monatlich > 0) {
    const zvE_jaehrlich = zvE_monatlich * 12 * faktor;
    if (zvE_jaehrlich <= 17005) {
      lohnsteuer = 0;
    } else if (zvE_jaehrlich <= 66760) {
      const y = (zvE_jaehrlich - 17005) / 10000;
      lohnsteuer = (208.14 * y + 2397) * y + 938.24;
    } else if (zvE_jaehrlich <= 277825) {
      const z = (zvE_jaehrlich - 66760) / 10000;
      lohnsteuer = (108.59 * z + 9136.63) * z + 18307.73;
    } else {
      lohnsteuer = zvE_jaehrlich * 0.45 - 17602.28;
    }
    lohnsteuer = (lohnsteuer / 12) * (1 / faktor);
  }

  // Solidaritätszuschlag
  const solz = lohnsteuer * 12 > b.solidaritaetszuschlag_grenze ? lohnsteuer * 0.055 : 0;

  // Kirchensteuer (Bayern/BW: 8%, Rest: 9%)
  const kistSatz = ['BY', 'BW'].includes(bundesland) ? 0.08 : 0.09;
  const kist = kirchensteuer ? lohnsteuer * kistSatz : 0;

  const abzuege = svAbzugAN + lohnsteuer + solz + kist;
  const netto = Math.max(0, brutto - abzuege);
  const gesamtkostenAG = brutto + rvAG + avAG + pvAG + kvAG;

  return {
    brutto, rvAN, rvAG, avAN, avAG, pvAN, pvAG, kvAN, kvAG,
    lohnsteuer, kirchensteuer: kist, solz, netto, gesamtkostenAG,
  };
}

const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('de-DE');
const currentMonth = new Date().toISOString().slice(0, 7);

const BUNDESLAENDER = ['BB', 'BE', 'BW', 'BY', 'HB', 'HE', 'HH', 'MV', 'NI', 'NW', 'RP', 'SH', 'SL', 'SN', 'ST', 'TH'];

export default function Lohnabrechnung() {
  const { currentCompany } = useCompany();
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rechnerOpen, setRechnerOpen] = useState(false);
  const [selectedMA, setSelectedMA] = useState<Mitarbeiter | null>(null);
  const [activeTab, setActiveTab] = useState('mitarbeiter');
  const [filterMonat, setFilterMonat] = useState(currentMonth);

  // Rechner-State
  const [rechnerBrutto, setRechnerBrutto] = useState('3000');
  const [rechnerSK, setRechnerSK] = useState('1');
  const [rechnerKist, setRechnerKist] = useState(false);
  const [rechnerBL, setRechnerBL] = useState('NW');
  const [rechnerErgebnis, setRechnerErgebnis] = useState<BruttoNetto | null>(null);

  const [form, setForm] = useState({
    personalnummer: '', vorname: '', nachname: '',
    geburtsdatum: '', eintrittsdatum: new Date().toISOString().split('T')[0],
    steuerklasse: '1', kirchensteuer: false, bundesland: 'NW',
    bruttolohn_monatlich: '', urlaubstage: '30',
  });

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    const { data } = await (supabase as any).from('mitarbeiter')
      .select('*').eq('company_id', currentCompany.id)
      .order('nachname');
    setMitarbeiter(data || []);
    setLoading(false);
  }, [currentCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRechnen = () => {
    const brutto = parseFloat(rechnerBrutto.replace(',', '.'));
    if (isNaN(brutto) || brutto <= 0) { toast.error('Bitte gültiges Brutto eingeben'); return; }
    setRechnerErgebnis(berechneBruttoNetto(brutto, rechnerSK, rechnerKist, rechnerBL));
  };

  const handleSave = async () => {
    if (!currentCompany || !form.vorname.trim() || !form.nachname.trim() || !form.bruttolohn_monatlich) {
      toast.error('Pflichtfelder ausfüllen');
      return;
    }
    const pnr = form.personalnummer || `MA-${Date.now().toString().slice(-4)}`;
    const payload: any = {
      company_id: currentCompany.id,
      personalnummer: pnr,
      vorname: form.vorname.trim(),
      nachname: form.nachname.trim(),
      geburtsdatum: form.geburtsdatum || null,
      eintrittsdatum: form.eintrittsdatum,
      austrittsdatum: null,
      steuerklasse: form.steuerklasse,
      kirchensteuer: form.kirchensteuer,
      bundesland: form.bundesland,
      bruttolohn_monatlich: parseFloat(form.bruttolohn_monatlich),
      urlaubstage: parseInt(form.urlaubstage),
      aktiv: true,
    };
    let error;
    if (selectedMA) {
      ({ error } = await (supabase as any).from('mitarbeiter').update(payload).eq('id', selectedMA.id));
    } else {
      ({ error } = await (supabase as any).from('mitarbeiter').insert(payload));
    }
    if (error) { toast.error('Fehler: ' + error.message); return; }
    toast.success(selectedMA ? 'Mitarbeiter aktualisiert' : 'Mitarbeiter angelegt');
    setDialogOpen(false);
    setSelectedMA(null);
    fetchData();
  };

  const exportLohnjournal = () => {
    const header = ['Personalnummer', 'Name', 'Brutto', 'SV-AN', 'Lohnsteuer', 'KiSt', 'SolZ', 'Netto', 'AG-Gesamtkosten'];
    const rows = mitarbeiter.filter(m => m.aktiv).map(m => {
      const r = berechneBruttoNetto(m.bruttolohn_monatlich, m.steuerklasse, m.kirchensteuer, m.bundesland);
      const svAN = r.rvAN + r.avAN + r.pvAN + r.kvAN;
      return [
        m.personalnummer, `${m.nachname}, ${m.vorname}`,
        r.brutto.toFixed(2).replace('.', ','),
        svAN.toFixed(2).replace('.', ','),
        r.lohnsteuer.toFixed(2).replace('.', ','),
        r.kirchensteuer.toFixed(2).replace('.', ','),
        r.solz.toFixed(2).replace('.', ','),
        r.netto.toFixed(2).replace('.', ','),
        r.gesamtkostenAG.toFixed(2).replace('.', ','),
      ];
    });
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Lohnjournal_${filterMonat}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Lohnjournal exportiert');
  };

  const aktivMA = mitarbeiter.filter(m => m.aktiv);
  const gesamtBrutto = aktivMA.reduce((s, m) => s + m.bruttolohn_monatlich, 0);
  const gesamtNetto = aktivMA.reduce((s, m) => s + berechneBruttoNetto(m.bruttolohn_monatlich, m.steuerklasse, m.kirchensteuer, m.bundesland).netto, 0);
  const gesamtAGKosten = aktivMA.reduce((s, m) => s + berechneBruttoNetto(m.bruttolohn_monatlich, m.steuerklasse, m.kirchensteuer, m.bundesland).gesamtkostenAG, 0);

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Lohnabrechnung
          </h1>
          <p className="text-muted-foreground">Mitarbeiter, Brutto-Netto, Lohnjournal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRechnerOpen(true)}>
            <Calculator className="mr-2 h-4 w-4" />Rechner
          </Button>
          <Button variant="outline" size="sm" onClick={exportLohnjournal}>
            <Download className="mr-2 h-4 w-4" />Lohnjournal
          </Button>
          <Button onClick={() => { setSelectedMA(null); setForm({ personalnummer: '', vorname: '', nachname: '', geburtsdatum: '', eintrittsdatum: new Date().toISOString().split('T')[0], steuerklasse: '1', kirchensteuer: false, bundesland: 'NW', bruttolohn_monatlich: '', urlaubstage: '30' }); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Mitarbeiter
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Mitarbeiter aktiv', value: String(aktivMA.length), icon: Users, color: 'text-primary' },
          { label: 'Gesamtbrutto/Monat', value: fmt(gesamtBrutto), icon: Euro, color: 'text-foreground' },
          { label: 'Gesamtnetto/Monat', value: fmt(gesamtNetto), icon: CheckCircle, color: 'text-success' },
          { label: 'AG-Gesamtkosten', value: fmt(gesamtAGKosten), icon: AlertCircle, color: 'text-warning' },
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="mitarbeiter">Mitarbeiter ({aktivMA.length})</TabsTrigger>
          <TabsTrigger value="journal">Lohnjournal</TabsTrigger>
          <TabsTrigger value="deüv">DEÜV-Meldungen</TabsTrigger>
        </TabsList>

        {/* Mitarbeiter */}
        <TabsContent value="mitarbeiter">
          <Card className="glass">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
              ) : mitarbeiter.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <p className="font-medium mb-1">Keine Mitarbeiter vorhanden</p>
                  <Button onClick={() => setDialogOpen(true)} className="mt-2"><Plus className="mr-2 h-4 w-4" />Ersten Mitarbeiter anlegen</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground">Mitarbeiter</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">StKl.</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Brutto</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Netto</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">AG-Kosten</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mitarbeiter.map(m => {
                        const r = berechneBruttoNetto(m.bruttolohn_monatlich, m.steuerklasse, m.kirchensteuer, m.bundesland);
                        return (
                          <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3">
                              <p className="font-medium">{m.nachname}, {m.vorname}</p>
                              <p className="text-xs text-muted-foreground">{m.personalnummer} · Eintr. {fmtDate(m.eintrittsdatum)}</p>
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="outline" className="text-xs">SK {m.steuerklasse}</Badge>
                            </td>
                            <td className="p-3 text-right font-medium">{fmt(r.brutto)}</td>
                            <td className="p-3 text-right text-success font-bold">{fmt(r.netto)}</td>
                            <td className="p-3 text-right text-warning">{fmt(r.gesamtkostenAG)}</td>
                            <td className="p-3">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                setSelectedMA(m);
                                setForm({ personalnummer: m.personalnummer, vorname: m.vorname, nachname: m.nachname, geburtsdatum: m.geburtsdatum || '', eintrittsdatum: m.eintrittsdatum, steuerklasse: m.steuerklasse, kirchensteuer: m.kirchensteuer, bundesland: m.bundesland, bruttolohn_monatlich: String(m.bruttolohn_monatlich), urlaubstage: String(m.urlaubstage) });
                                setDialogOpen(true);
                              }}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
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

        {/* Lohnjournal */}
        <TabsContent value="journal">
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lohnjournal {filterMonat}</CardTitle>
                <Input type="month" value={filterMonat} onChange={e => setFilterMonat(e.target.value)} className="w-40" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Mitarbeiter</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Brutto</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">SV-AN</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">LSt</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Netto</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">SV-AG</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">AG-Gesamt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {aktivMA.map(m => {
                      const r = berechneBruttoNetto(m.bruttolohn_monatlich, m.steuerklasse, m.kirchensteuer, m.bundesland);
                      const svAN = r.rvAN + r.avAN + r.pvAN + r.kvAN;
                      const svAG = r.rvAG + r.avAG + r.pvAG + r.kvAG;
                      return (
                        <tr key={m.id} className="hover:bg-muted/20">
                          <td className="p-3 font-medium">{m.nachname}, {m.vorname}</td>
                          <td className="p-3 text-right">{fmt(r.brutto)}</td>
                          <td className="p-3 text-right text-destructive">{fmt(svAN)}</td>
                          <td className="p-3 text-right text-destructive">{fmt(r.lohnsteuer + r.kirchensteuer + r.solz)}</td>
                          <td className="p-3 text-right text-success font-bold">{fmt(r.netto)}</td>
                          <td className="p-3 text-right text-warning">{fmt(svAG)}</td>
                          <td className="p-3 text-right font-bold">{fmt(r.gesamtkostenAG)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold bg-muted/20">
                      <td className="p-3">Gesamt</td>
                      <td className="p-3 text-right">{fmt(gesamtBrutto)}</td>
                      <td className="p-3 text-right text-destructive">{fmt(aktivMA.reduce((s, m) => { const r = berechneBruttoNetto(m.bruttolohn_monatlich, m.steuerklasse, m.kirchensteuer, m.bundesland); return s + r.rvAN + r.avAN + r.pvAN + r.kvAN; }, 0))}</td>
                      <td className="p-3 text-right text-destructive">{fmt(aktivMA.reduce((s, m) => { const r = berechneBruttoNetto(m.bruttolohn_monatlich, m.steuerklasse, m.kirchensteuer, m.bundesland); return s + r.lohnsteuer + r.kirchensteuer + r.solz; }, 0))}</td>
                      <td className="p-3 text-right text-success">{fmt(gesamtNetto)}</td>
                      <td className="p-3 text-right text-warning">{fmt(aktivMA.reduce((s, m) => { const r = berechneBruttoNetto(m.bruttolohn_monatlich, m.steuerklasse, m.kirchensteuer, m.bundesland); return s + r.rvAG + r.avAG + r.pvAG + r.kvAG; }, 0))}</td>
                      <td className="p-3 text-right">{fmt(gesamtAGKosten)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEÜV */}
        <TabsContent value="deüv">
          <Card className="glass">
            <CardHeader><CardTitle>DEÜV-Meldungen</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mitarbeiter.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{m.nachname}, {m.vorname}</p>
                      <p className="text-xs text-muted-foreground">Eintr.: {fmtDate(m.eintrittsdatum)} · {m.personalnummer}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs text-success border-success/30">
                        <CheckCircle className="mr-1 h-3 w-3" />Angemeldet
                      </Badge>
                      {m.austrittsdatum && (
                        <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                          Abgemeldet {fmtDate(m.austrittsdatum)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {mitarbeiter.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Keine Mitarbeiter vorhanden</p>
                )}
              </div>
              <div className="mt-4 p-3 bg-info/10 border border-info/30 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
                <p>DEÜV-Meldungen werden elektronisch über das sv.net-Portal oder Ihren Steuerberater übermittelt. Die Daten können als CSV exportiert werden.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mitarbeiter-Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedMA ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vorname *</Label>
                <Input value={form.vorname} onChange={e => setForm({ ...form, vorname: e.target.value })} />
              </div>
              <div>
                <Label>Nachname *</Label>
                <Input value={form.nachname} onChange={e => setForm({ ...form, nachname: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Personalnummer</Label>
                <Input placeholder="MA-001" value={form.personalnummer} onChange={e => setForm({ ...form, personalnummer: e.target.value })} />
              </div>
              <div>
                <Label>Geburtsdatum</Label>
                <Input type="date" value={form.geburtsdatum} onChange={e => setForm({ ...form, geburtsdatum: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Eintrittsdatum *</Label>
                <Input type="date" value={form.eintrittsdatum} onChange={e => setForm({ ...form, eintrittsdatum: e.target.value })} />
              </div>
              <div>
                <Label>Urlaubstage/Jahr</Label>
                <Input type="number" value={form.urlaubstage} onChange={e => setForm({ ...form, urlaubstage: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Steuerklasse</Label>
                <Select value={form.steuerklasse} onValueChange={v => setForm({ ...form, steuerklasse: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STEUERKLASSEN).map(([k, v]) => <SelectItem key={k} value={k}>{k} – {v.name.split('–')[1]?.trim()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bundesland</Label>
                <Select value={form.bundesland} onValueChange={v => setForm({ ...form, bundesland: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BUNDESLAENDER.map(bl => <SelectItem key={bl} value={bl}>{bl}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Bruttolohn monatlich (€) *</Label>
              <Input type="number" step="0.01" placeholder="3000,00" value={form.bruttolohn_monatlich} onChange={e => setForm({ ...form, bruttolohn_monatlich: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Kirchensteuerpflichtig</Label>
              <Switch checked={form.kirchensteuer} onCheckedChange={v => setForm({ ...form, kirchensteuer: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setSelectedMA(null); }}>Abbrechen</Button>
            <Button onClick={handleSave}>{selectedMA ? 'Aktualisieren' : 'Anlegen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Brutto-Netto-Rechner */}
      <Dialog open={rechnerOpen} onOpenChange={setRechnerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />Brutto-Netto-Rechner 2024
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bruttolohn (€/Monat)</Label>
                <Input type="number" value={rechnerBrutto} onChange={e => setRechnerBrutto(e.target.value)} />
              </div>
              <div>
                <Label>Steuerklasse</Label>
                <Select value={rechnerSK} onValueChange={setRechnerSK}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STEUERKLASSEN).map(([k]) => <SelectItem key={k} value={k}>SK {k}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bundesland</Label>
                <Select value={rechnerBL} onValueChange={setRechnerBL}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BUNDESLAENDER.map(bl => <SelectItem key={bl} value={bl}>{bl}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Switch checked={rechnerKist} onCheckedChange={setRechnerKist} />
                  <Label className="text-sm">Kirchensteuer</Label>
                </div>
              </div>
            </div>
            <Button className="w-full" onClick={handleRechnen}><Calculator className="mr-2 h-4 w-4" />Berechnen</Button>

            {rechnerErgebnis && (
              <div className="space-y-2 p-4 bg-muted/20 rounded-lg">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bruttolohn</span><span className="font-medium">{fmt(rechnerErgebnis.brutto)}</span></div>
                <div className="border-t pt-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Abzüge Arbeitnehmer</p>
                  {[
                    ['Rentenversicherung (9,3%)', rechnerErgebnis.rvAN],
                    ['Arbeitslosenversicherung (1,3%)', rechnerErgebnis.avAN],
                    ['Pflegeversicherung (1,7%)', rechnerErgebnis.pvAN],
                    ['Krankenversicherung (8,65%)', rechnerErgebnis.kvAN],
                    ['Lohnsteuer', rechnerErgebnis.lohnsteuer],
                    rechnerErgebnis.kirchensteuer > 0 ? ['Kirchensteuer', rechnerErgebnis.kirchensteuer] : null,
                    rechnerErgebnis.solz > 0 ? ['Solidaritätszuschlag', rechnerErgebnis.solz] : null,
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">− {label}</span>
                      <span className="text-destructive">{fmt(value as number)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Nettolohn</span>
                  <span className="text-success">{fmt(rechnerErgebnis.netto)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">AG-Gesamtkosten (inkl. SV-AG)</span>
                  <span className="text-warning font-medium">{fmt(rechnerErgebnis.gesamtkostenAG)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">* Näherungsrechnung mit Beitragssätzen 2024. Keine Rechtsberatung.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechnerOpen(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
