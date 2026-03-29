/**
 * Steuer-Assistent – Differenzbesteuerung, Kleinunternehmer, Multi-Währung, Jahresabschluss
 *
 * Features:
 * - Kleinunternehmer-Modus (§ 19 UStG): Umsatzgrenze-Tracking
 * - Differenzbesteuerung (§ 25a UStG): Händlermargen-Berechnung
 * - Multi-Währung: EUR/USD/GBP/CHF mit Live-Kursen
 * - Jahresabschluss-Checkliste mit Fortschrittsanzeige
 * - Steuertermin-Kalender
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Calculator, Globe, CheckSquare, Calendar, AlertCircle,
  TrendingUp, Euro, CheckCircle, Clock, ChevronRight,
  RefreshCw, Info, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const fmt = (n: number, currency = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(n);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)} %`;

// ─── Steuertermine ────────────────────────────────────────────────────────────
const STEUERTERMINE = [
  { datum: '2026-01-10', bezeichnung: 'UStVA November', art: 'UStVA', dringend: false },
  { datum: '2026-02-10', bezeichnung: 'UStVA Dezember', art: 'UStVA', dringend: false },
  { datum: '2026-03-10', bezeichnung: 'UStVA Januar', art: 'UStVA', dringend: false },
  { datum: '2026-03-31', bezeichnung: 'Jahressteuererklärung 2024 (ohne Berater)', art: 'ESt/KSt', dringend: true },
  { datum: '2026-04-10', bezeichnung: 'UStVA Februar', art: 'UStVA', dringend: false },
  { datum: '2026-05-10', bezeichnung: 'UStVA März', art: 'UStVA', dringend: false },
  { datum: '2026-05-31', bezeichnung: 'Gewerbesteuererklärung 2024', art: 'GewSt', dringend: false },
  { datum: '2026-06-10', bezeichnung: 'UStVA April', art: 'UStVA', dringend: false },
  { datum: '2026-07-10', bezeichnung: 'UStVA Mai', art: 'UStVA', dringend: false },
  { datum: '2026-07-31', bezeichnung: 'Jahressteuererklärung 2024 (mit Berater)', art: 'ESt/KSt', dringend: false },
  { datum: '2026-08-10', bezeichnung: 'UStVA Juni', art: 'UStVA', dringend: false },
  { datum: '2026-09-10', bezeichnung: 'UStVA Juli', art: 'UStVA', dringend: false },
  { datum: '2026-10-10', bezeichnung: 'UStVA August', art: 'UStVA', dringend: false },
  { datum: '2026-11-10', bezeichnung: 'UStVA September', art: 'UStVA', dringend: false },
  { datum: '2026-12-10', bezeichnung: 'UStVA Oktober', art: 'UStVA', dringend: false },
];

// ─── Jahresabschluss-Checkliste ───────────────────────────────────────────────
const CHECKLISTE = [
  { id: 'konten', titel: 'Kontenabstimmung', beschreibung: 'Alle Bankkonten mit Kontoauszügen abgestimmt', kategorie: 'Vorbereitung' },
  { id: 'belege', titel: 'Belegablage komplett', beschreibung: 'Alle Belege digital erfasst und kategorisiert', kategorie: 'Vorbereitung' },
  { id: 'offene_posten', titel: 'Offene Posten bereinigt', beschreibung: 'Alle Forderungen und Verbindlichkeiten geprüft', kategorie: 'Vorbereitung' },
  { id: 'afa', titel: 'AfA-Buchungen', beschreibung: 'Jahres-AfA für alle Anlagegüter gebucht', kategorie: 'Abschluss' },
  { id: 'rueckstellungen', titel: 'Rückstellungen gebildet', beschreibung: 'Urlaub, Steuern, Garantien etc.', kategorie: 'Abschluss' },
  { id: 'inventur', titel: 'Inventur durchgeführt', beschreibung: 'Warenbestand zum 31.12. erfasst', kategorie: 'Abschluss' },
  { id: 'ustva_12', titel: 'UStVA Dezember eingereicht', beschreibung: 'Letzte Voranmeldung des Jahres', kategorie: 'Steuern' },
  { id: 'lohnsteuer', titel: 'Lohnsteuer-Jahresausgleich', beschreibung: 'Lohnsteuerbescheinigungen erstellt', kategorie: 'Steuern' },
  { id: 'datev', titel: 'DATEV-Export erstellt', beschreibung: 'Buchungsdaten für Steuerberater exportiert', kategorie: 'Übergabe' },
  { id: 'gdpdu', titel: 'GdPDU-Export erstellt', beschreibung: 'Für eventuelle Betriebsprüfung', kategorie: 'Übergabe' },
  { id: 'bwa', titel: 'BWA geprüft', beschreibung: 'Betriebswirtschaftliche Auswertung plausibilisiert', kategorie: 'Übergabe' },
  { id: 'steuerberater', titel: 'Unterlagen an Steuerberater', beschreibung: 'Alle Dokumente übergeben', kategorie: 'Übergabe' },
];

// ─── Währungskurse (Fallback-Werte, werden live abgerufen) ────────────────────
const FALLBACK_KURSE: Record<string, number> = {
  USD: 1.085, GBP: 0.857, CHF: 0.946, JPY: 162.5, CNY: 7.83,
  PLN: 4.27, CZK: 25.3, HUF: 395, SEK: 11.4, NOK: 11.7,
};

interface WaehrungsRechner {
  betrag: string;
  von: string;
  nach: string;
  ergebnis: number | null;
}

export default function SteuerAssistent() {
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState('termine');
  const [checklistStatus, setChecklistStatus] = useState<Record<string, boolean>>({});
  const [kurse, setKurse] = useState<Record<string, number>>(FALLBACK_KURSE);
  const [kurseLoading, setKurseLoading] = useState(false);
  const [waehrung, setWaehrung] = useState<WaehrungsRechner>({ betrag: '1000', von: 'EUR', nach: 'USD', ergebnis: null });

  // Kleinunternehmer-State
  const [kuJahresUmsatz, setKuJahresUmsatz] = useState('');
  const [kuVorjahr, setKuVorjahr] = useState('');

  // Differenzbesteuerung-State
  const [diffEinkauf, setDiffEinkauf] = useState('');
  const [diffVerkauf, setDiffVerkauf] = useState('');
  const [diffMwstSatz, setDiffMwstSatz] = useState('19');

  const [jahresabschlussJahr, setJahresabschlussJahr] = useState(String(new Date().getFullYear() - 1));

  // Checkliste aus localStorage laden (pro Firma + Jahr)
  useEffect(() => {
    if (!currentCompany) return;
    const key = `checklist_${currentCompany.id}_${jahresabschlussJahr}`;
    const saved = localStorage.getItem(key);
    if (saved) setChecklistStatus(JSON.parse(saved));
  }, [currentCompany, jahresabschlussJahr]);

  const toggleCheck = (id: string) => {
    if (!currentCompany) return;
    const neu = { ...checklistStatus, [id]: !checklistStatus[id] };
    setChecklistStatus(neu);
    const key = `checklist_${currentCompany.id}_${jahresabschlussJahr}`;
    localStorage.setItem(key, JSON.stringify(neu));
  };

  const fetchKurse = async () => {
    setKurseLoading(true);
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
      if (res.ok) {
        const data = await res.json();
        setKurse(data.rates);
        toast.success('Wechselkurse aktualisiert');
      }
    } catch {
      toast.error('Kurse konnten nicht geladen werden – Fallback-Werte werden verwendet');
    }
    setKurseLoading(false);
  };

  const berechneWaehrung = () => {
    const betrag = parseFloat(waehrung.betrag.replace(',', '.'));
    if (isNaN(betrag)) return;
    let ergebnis: number;
    if (waehrung.von === 'EUR') {
      ergebnis = betrag * (kurse[waehrung.nach] || 1);
    } else if (waehrung.nach === 'EUR') {
      ergebnis = betrag / (kurse[waehrung.von] || 1);
    } else {
      const inEur = betrag / (kurse[waehrung.von] || 1);
      ergebnis = inEur * (kurse[waehrung.nach] || 1);
    }
    setWaehrung(w => ({ ...w, ergebnis }));
  };

  // Differenzbesteuerung
  const berechneDiff = () => {
    const ek = parseFloat(diffEinkauf.replace(',', '.'));
    const vk = parseFloat(diffVerkauf.replace(',', '.'));
    if (isNaN(ek) || isNaN(vk)) return null;
    const marge = vk - ek;
    const mwstSatz = parseInt(diffMwstSatz) / 100;
    const mwstBetrag = marge / (1 + mwstSatz) * mwstSatz;
    const nettoMarge = marge - mwstBetrag;
    return { marge, mwstBetrag, nettoMarge };
  };
  const diffErgebnis = berechneDiff();

  // Kleinunternehmer
  const kuGrenze2024 = 22000;
  const kuGrenze2025 = 25000; // ab 2025
  const kuAktuell = parseFloat(kuJahresUmsatz.replace(',', '.')) || 0;
  const kuVorjahrWert = parseFloat(kuVorjahr.replace(',', '.')) || 0;
  const kuStatus = kuVorjahrWert <= kuGrenze2025 && kuAktuell <= 100000;

  const heute = new Date().toISOString().split('T')[0];
  const naechsteTermine = STEUERTERMINE.filter(t => t.datum >= heute).slice(0, 5);
  const checklisteFortschritt = CHECKLISTE.filter(c => checklistStatus[c.id]).length;
  const kategorien = [...new Set(CHECKLISTE.map(c => c.kategorie))];

  const WAEHRUNGEN = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CNY', 'PLN', 'CZK', 'SEK', 'NOK'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Steuer-Assistent
          </h1>
          <p className="text-muted-foreground">Kleinunternehmer, Differenzbesteuerung, Jahresabschluss</p>
        </div>
      </div>

      {/* Quick-KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Nächster Termin</p>
          <p className="font-bold text-sm">{naechsteTermine[0]?.bezeichnung || '–'}</p>
          <p className="text-xs text-warning">{naechsteTermine[0] ? new Date(naechsteTermine[0].datum).toLocaleDateString('de-DE') : ''}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Jahresabschluss</p>
          <p className="font-bold text-2xl">{checklisteFortschritt}/{CHECKLISTE.length}</p>
          <div className="h-1.5 bg-muted rounded-full mt-1">
            <div className="h-1.5 bg-primary rounded-full" style={{ width: `${(checklisteFortschritt / CHECKLISTE.length) * 100}%` }} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Kleinunternehmer</p>
          <p className={cn('font-bold', kuStatus ? 'text-success' : 'text-destructive')}>
            {kuStatus ? 'Berechtigt' : 'Nicht berechtigt'}
          </p>
          <p className="text-xs text-muted-foreground">Grenze: {fmt(kuGrenze2025)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">EUR/USD</p>
          <p className="font-bold text-xl">{(kurse['USD'] || 1.085).toFixed(4)}</p>
          <p className="text-xs text-muted-foreground">Wechselkurs</p>
        </CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="termine">Steuertermine</TabsTrigger>
          <TabsTrigger value="checkliste">Jahresabschluss</TabsTrigger>
          <TabsTrigger value="kleinunternehmer">Kleinunternehmer</TabsTrigger>
          <TabsTrigger value="differenz">Differenzbesteuerung</TabsTrigger>
          <TabsTrigger value="waehrung">Multi-Währung</TabsTrigger>
        </TabsList>

        {/* Steuertermine */}
        <TabsContent value="termine">
          <Card className="glass">
            <CardHeader><CardTitle>Steuertermine {new Date().getFullYear()}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {STEUERTERMINE.map(t => {
                  const vergangen = t.datum < heute;
                  const naechste7 = !vergangen && new Date(t.datum) <= new Date(Date.now() + 7 * 86400000);
                  return (
                    <div key={t.datum + t.bezeichnung} className={cn('flex items-center justify-between p-4', vergangen && 'opacity-40')}>
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', vergangen ? 'bg-muted' : naechste7 ? 'bg-warning/10' : 'bg-muted/30')}>
                          <Calendar className={cn('h-4 w-4', vergangen ? 'text-muted-foreground' : naechste7 ? 'text-warning' : 'text-primary')} />
                        </div>
                        <div>
                          <p className={cn('font-medium text-sm', vergangen && 'line-through')}>{t.bezeichnung}</p>
                          <p className="text-xs text-muted-foreground">{new Date(t.datum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{t.art}</Badge>
                        {vergangen && <CheckCircle className="h-4 w-4 text-success" />}
                        {naechste7 && !vergangen && <Badge className="text-xs bg-warning text-warning-foreground">Bald fällig</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Jahresabschluss-Checkliste */}
        <TabsContent value="checkliste" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Label>Abschlussjahr:</Label>
              <Input type="number" value={jahresabschlussJahr} onChange={e => setJahresabschlussJahr(e.target.value)} className="w-24" />
            </div>
            <Badge variant="outline" className="text-sm">
              {checklisteFortschritt}/{CHECKLISTE.length} erledigt ({Math.round((checklisteFortschritt / CHECKLISTE.length) * 100)}%)
            </Badge>
          </div>
          <div className="h-2 bg-muted rounded-full">
            <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${(checklisteFortschritt / CHECKLISTE.length) * 100}%` }} />
          </div>
          {kategorien.map(kat => (
            <Card key={kat} className="glass">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{kat}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {CHECKLISTE.filter(c => c.kategorie === kat).map(c => (
                    <div key={c.id} className={cn('flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors', checklistStatus[c.id] && 'bg-success/5')} onClick={() => toggleCheck(c.id)}>
                      <div className={cn('mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0', checklistStatus[c.id] ? 'bg-success border-success' : 'border-muted-foreground')}>
                        {checklistStatus[c.id] && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                      </div>
                      <div>
                        <p className={cn('font-medium text-sm', checklistStatus[c.id] && 'line-through text-muted-foreground')}>{c.titel}</p>
                        <p className="text-xs text-muted-foreground">{c.beschreibung}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Kleinunternehmer */}
        <TabsContent value="kleinunternehmer" className="space-y-4">
          <Card className="glass">
            <CardHeader><CardTitle>Kleinunternehmer-Prüfung (§ 19 UStG)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-info/10 border border-info/30 rounded-lg text-sm flex items-start gap-2">
                <Info className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Kleinunternehmerregelung ab 2025</p>
                  <p className="text-muted-foreground mt-1">Ab 2025 gilt: Vorjahresumsatz ≤ 25.000 € UND laufendes Jahr voraussichtlich ≤ 100.000 €. Kleinunternehmer stellen keine Umsatzsteuer in Rechnung und dürfen keine Vorsteuer abziehen.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Umsatz Vorjahr (€)</Label>
                  <Input type="number" placeholder="0,00" value={kuVorjahr} onChange={e => setKuVorjahr(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Grenze: {fmt(kuGrenze2025)}</p>
                </div>
                <div>
                  <Label>Umsatz laufendes Jahr (€)</Label>
                  <Input type="number" placeholder="0,00" value={kuJahresUmsatz} onChange={e => setKuJahresUmsatz(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Grenze: 100.000 €</p>
                </div>
              </div>
              {(kuVorjahr || kuJahresUmsatz) && (
                <div className={cn('p-4 rounded-lg border', kuStatus ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30')}>
                  <div className="flex items-center gap-2 mb-2">
                    {kuStatus ? <CheckCircle className="h-5 w-5 text-success" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
                    <p className={cn('font-bold', kuStatus ? 'text-success' : 'text-destructive')}>
                      {kuStatus ? 'Kleinunternehmerregelung anwendbar' : 'Kleinunternehmerregelung NICHT anwendbar'}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vorjahresumsatz</span>
                      <span className={kuVorjahrWert > kuGrenze2025 ? 'text-destructive font-medium' : 'text-success'}>{fmt(kuVorjahrWert)} {kuVorjahrWert > kuGrenze2025 ? '✗' : '✓'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Laufender Jahresumsatz</span>
                      <span className={kuAktuell > 100000 ? 'text-destructive font-medium' : 'text-success'}>{fmt(kuAktuell)} {kuAktuell > 100000 ? '✗' : '✓'}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Differenzbesteuerung */}
        <TabsContent value="differenz" className="space-y-4">
          <Card className="glass">
            <CardHeader><CardTitle>Differenzbesteuerung (§ 25a UStG)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-info/10 border border-info/30 rounded-lg text-sm flex items-start gap-2">
                <Info className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
                <p>Die Differenzbesteuerung gilt für Wiederverkäufer von Gebrauchtwaren (Antiquitäten, Kunstgegenstände, Sammlerstücke, Gebrauchtfahrzeuge). Die Umsatzsteuer wird nur auf die Marge (Verkaufspreis minus Einkaufspreis) berechnet.</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Einkaufspreis (€)</Label>
                  <Input type="number" step="0.01" placeholder="0,00" value={diffEinkauf} onChange={e => setDiffEinkauf(e.target.value)} />
                </div>
                <div>
                  <Label>Verkaufspreis (€)</Label>
                  <Input type="number" step="0.01" placeholder="0,00" value={diffVerkauf} onChange={e => setDiffVerkauf(e.target.value)} />
                </div>
                <div>
                  <Label>MwSt-Satz</Label>
                  <Select value={diffMwstSatz} onValueChange={setDiffMwstSatz}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="19">19 %</SelectItem>
                      <SelectItem value="7">7 %</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {diffErgebnis && (
                <div className="p-4 bg-muted/20 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Gesamtmarge (Brutto)</span><span className="font-medium">{fmt(diffErgebnis.marge)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">MwSt auf Marge ({diffMwstSatz}%)</span><span className="text-destructive">{fmt(diffErgebnis.mwstBetrag)}</span></div>
                  <div className="flex justify-between font-bold border-t pt-2"><span>Nettomarge</span><span className="text-success">{fmt(diffErgebnis.nettoMarge)}</span></div>
                  <p className="text-xs text-muted-foreground mt-2">Hinweis: Auf der Rechnung darf keine Umsatzsteuer ausgewiesen werden. Stattdessen: „Differenzbesteuerung nach § 25a UStG".</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Multi-Währung */}
        <TabsContent value="waehrung" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Währungsrechner</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchKurse} disabled={kurseLoading}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', kurseLoading && 'animate-spin')} />
                  Kurse aktualisieren
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 items-end">
                <div>
                  <Label>Betrag</Label>
                  <Input type="number" value={waehrung.betrag} onChange={e => setWaehrung(w => ({ ...w, betrag: e.target.value, ergebnis: null }))} />
                </div>
                <div>
                  <Label>Von</Label>
                  <Select value={waehrung.von} onValueChange={v => setWaehrung(w => ({ ...w, von: v, ergebnis: null }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{WAEHRUNGEN.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nach</Label>
                  <Select value={waehrung.nach} onValueChange={v => setWaehrung(w => ({ ...w, nach: v, ergebnis: null }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{WAEHRUNGEN.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={berechneWaehrung}>
                <Calculator className="mr-2 h-4 w-4" />Umrechnen
              </Button>
              {waehrung.ergebnis !== null && (
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">{parseFloat(waehrung.betrag).toLocaleString('de-DE')} {waehrung.von} =</p>
                  <p className="text-3xl font-bold text-primary mt-1">
                    {waehrung.ergebnis.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {waehrung.nach}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Kurs: 1 {waehrung.von} = {(waehrung.ergebnis / parseFloat(waehrung.betrag)).toFixed(6)} {waehrung.nach}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Kursliste */}
          <Card className="glass">
            <CardHeader><CardTitle className="text-sm">Aktuelle Kurse (Basis: EUR)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {WAEHRUNGEN.filter(c => c !== 'EUR').map(c => (
                  <div key={c} className="p-3 bg-muted/20 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">{c}</p>
                    <p className="font-bold">{(kurse[c] || 0).toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
