/**
 * Steueroptimierung – Steueroptimierungs-Assistent
 * Einkommensteuer-Rechner, Gewerbesteuer, USt-Voranmeldung, Optimierungstipps
 * Aktuell für Steuerjahr 2024/2025 (Deutschland)
 */
import { useState, useMemo } from 'react';
import {
  Calculator, TrendingDown, Lightbulb, CheckCircle2, AlertTriangle,
  Info, ChevronDown, ChevronUp, Download, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';

const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

// Einkommensteuer 2024 (vereinfacht, Grundtabelle)
function calcEinkommensteuer(zvE: number, kirchensteuer = false, bundesland = 'BY'): {
  est: number; soli: number; kist: number; gesamt: number; grenzsteuersatz: number; durchschnittssteuersatz: number;
} {
  let est = 0;
  if (zvE <= 11604) {
    est = 0;
  } else if (zvE <= 17005) {
    const y = (zvE - 11604) / 10000;
    est = (979.18 * y + 1400) * y;
  } else if (zvE <= 66760) {
    const z = (zvE - 17005) / 10000;
    est = (192.59 * z + 2397) * z + 966.53;
  } else if (zvE <= 277825) {
    est = 0.42 * zvE - 10602.13;
  } else {
    est = 0.45 * zvE - 18936.88;
  }
  est = Math.max(0, Math.round(est));

  // Solidaritätszuschlag (ab 2021 nur noch für hohe Einkommen)
  const soliFreigrenze = 18130;
  const soliMilderungszone = 31527;
  let soli = 0;
  if (est > soliFreigrenze) {
    if (est <= soliMilderungszone) {
      soli = Math.min(0.055 * est, 0.119 * (est - soliFreigrenze));
    } else {
      soli = 0.055 * est;
    }
  }
  soli = Math.round(soli);

  // Kirchensteuer (Bayern/BW: 8%, Rest: 9%)
  const kistSatz = ['BY', 'BW'].includes(bundesland) ? 0.08 : 0.09;
  const kist = kirchensteuer ? Math.round(est * kistSatz) : 0;

  const gesamt = est + soli + kist;
  const grenzsteuersatz = zvE > 277825 ? 45 : zvE > 66760 ? 42 : zvE > 17005 ? (192.59 * 2 * (zvE - 17005) / 10000 + 2397) / 10000 * 100 : zvE > 11604 ? (979.18 * 2 * (zvE - 11604) / 10000 + 1400) / 10000 * 100 : 0;
  const durchschnittssteuersatz = zvE > 0 ? (gesamt / zvE) * 100 : 0;

  return { est, soli, kist, gesamt, grenzsteuersatz: Math.min(45, grenzsteuersatz), durchschnittssteuersatz };
}

// Gewerbesteuer
function calcGewerbesteuer(gewinn: number, hebesatz: number, freibetrag = 24500): number {
  const gewerbeertrag = Math.max(0, gewinn - freibetrag);
  const steuermessbetrag = gewerbeertrag * 0.035;
  return Math.round(steuermessbetrag * (hebesatz / 100));
}

// Optimierungstipps
const OPTIMIERUNGSTIPPS = [
  {
    kategorie: 'Betriebsausgaben',
    tipps: [
      { titel: 'Homeoffice-Pauschale', beschreibung: 'Bis zu 1.260 € pro Jahr (6 €/Tag, max. 210 Tage)', ersparnis: 'bis 567 €', schwierigkeit: 'einfach' },
      { titel: 'Arbeitszimmer', beschreibung: 'Anteilige Miete/Nebenkosten bei ausschließlich beruflicher Nutzung', ersparnis: 'variabel', schwierigkeit: 'mittel' },
      { titel: 'Kfz-Kosten', beschreibung: 'Fahrtenbuch oder 1%-Regel – Vergleich lohnt sich', ersparnis: 'variabel', schwierigkeit: 'mittel' },
      { titel: 'Fortbildungskosten', beschreibung: 'Seminare, Bücher, Online-Kurse vollständig absetzbar', ersparnis: 'variabel', schwierigkeit: 'einfach' },
    ],
  },
  {
    kategorie: 'Investitionen',
    tipps: [
      { titel: 'GWG-Sofortabschreibung', beschreibung: 'Wirtschaftsgüter bis 800 € netto sofort abschreiben', ersparnis: 'bis 360 €/GWG', schwierigkeit: 'einfach' },
      { titel: 'Investitionsabzugsbetrag (IAB)', beschreibung: '50% geplanter Investitionen vorab abziehen (max. 200.000 €)', ersparnis: 'bis 90.000 €', schwierigkeit: 'komplex' },
      { titel: 'Sonderabschreibung §7g EStG', beschreibung: '20% Sonderabschreibung auf bewegliche Wirtschaftsgüter', ersparnis: 'variabel', schwierigkeit: 'mittel' },
    ],
  },
  {
    kategorie: 'Rechtsform',
    tipps: [
      { titel: 'GmbH-Gründung prüfen', beschreibung: 'Ab ca. 60.000 € Gewinn kann GmbH steuerlich vorteilhafter sein', ersparnis: 'ab 5.000 €/Jahr', schwierigkeit: 'komplex' },
      { titel: 'Gewinnverlagerung', beschreibung: 'Investitionen in Hochertragsjahre vorziehen', ersparnis: 'variabel', schwierigkeit: 'mittel' },
    ],
  },
  {
    kategorie: 'Vorsorge',
    tipps: [
      { titel: 'Altersvorsorge', beschreibung: 'Basisrente (Rürup) bis 27.566 € absetzbar (2024)', ersparnis: 'bis 12.405 €', schwierigkeit: 'einfach' },
      { titel: 'Betriebliche Altersvorsorge', beschreibung: 'Direktversicherung, Pensionskasse – steuer- und sozialabgabenfrei', ersparnis: 'variabel', schwierigkeit: 'mittel' },
    ],
  },
];

const BUNDESLAENDER = [
  { value: 'BY', label: 'Bayern' }, { value: 'BW', label: 'Baden-Württemberg' },
  { value: 'BE', label: 'Berlin' }, { value: 'HB', label: 'Bremen' },
  { value: 'HH', label: 'Hamburg' }, { value: 'HE', label: 'Hessen' },
  { value: 'NI', label: 'Niedersachsen' }, { value: 'NW', label: 'Nordrhein-Westfalen' },
  { value: 'RP', label: 'Rheinland-Pfalz' }, { value: 'SL', label: 'Saarland' },
  { value: 'SH', label: 'Schleswig-Holstein' }, { value: 'TH', label: 'Thüringen' },
  { value: 'SN', label: 'Sachsen' }, { value: 'ST', label: 'Sachsen-Anhalt' },
  { value: 'MV', label: 'Mecklenburg-Vorpommern' }, { value: 'BB', label: 'Brandenburg' },
];

export default function Steueroptimierung() {
  const [einnahmen, setEinnahmen] = useState(80000);
  const [ausgaben, setAusgaben] = useState(30000);
  const [sonderausgaben, setSonderausgaben] = useState(5000);
  const [kirchensteuer, setKirchensteuer] = useState(false);
  const [bundesland, setBundesland] = useState('BY');
  const [hebesatz, setHebesatz] = useState(380);
  const [rechtsform, setRechtsform] = useState<'einzelunternehmen' | 'gmbh'>('einzelunternehmen');
  const [expandedKat, setExpandedKat] = useState<string | null>('Betriebsausgaben');

  const gewinn = Math.max(0, einnahmen - ausgaben);
  const zvE = Math.max(0, gewinn - sonderausgaben);

  const estCalc = useMemo(() => calcEinkommensteuer(zvE, kirchensteuer, bundesland), [zvE, kirchensteuer, bundesland]);
  const gewerbesteuer = useMemo(() => calcGewerbesteuer(gewinn, hebesatz), [gewinn, hebesatz]);

  // GmbH-Vergleich
  const gmbhKoerperschaftsteuer = Math.round(gewinn * 0.15);
  const gmbhSoli = Math.round(gmbhKoerperschaftsteuer * 0.055);
  const gmbhGewerbesteuer = calcGewerbesteuer(gewinn, hebesatz, 0);
  const gmbhGesamt = gmbhKoerperschaftsteuer + gmbhSoli + gmbhGewerbesteuer;
  const einzelGesamt = estCalc.gesamt + gewerbesteuer;
  const gmbhVorteil = einzelGesamt - gmbhGesamt;

  const exportReport = () => {
    const lines = [
      'STEUEROPTIMIERUNGS-REPORT',
      `Datum: ${new Date().toLocaleDateString('de-DE')}`,
      '',
      'EINGABEN',
      `Einnahmen: ${fmt(einnahmen)}`,
      `Ausgaben: ${fmt(ausgaben)}`,
      `Gewinn: ${fmt(gewinn)}`,
      `Sonderausgaben: ${fmt(sonderausgaben)}`,
      `zu versteuerndes Einkommen: ${fmt(zvE)}`,
      '',
      'STEUERBERECHNUNG (Einzelunternehmen)',
      `Einkommensteuer: ${fmt(estCalc.est)}`,
      `Solidaritätszuschlag: ${fmt(estCalc.soli)}`,
      kirchensteuer ? `Kirchensteuer: ${fmt(estCalc.kist)}` : '',
      `Gewerbesteuer (Hebesatz ${hebesatz}%): ${fmt(gewerbesteuer)}`,
      `Gesamtbelastung: ${fmt(einzelGesamt)}`,
      `Durchschnittssteuersatz: ${fmtPct(estCalc.durchschnittssteuersatz)}`,
      '',
      'GmbH-VERGLEICH',
      `Körperschaftsteuer: ${fmt(gmbhKoerperschaftsteuer)}`,
      `Soli: ${fmt(gmbhSoli)}`,
      `Gewerbesteuer: ${fmt(gmbhGewerbesteuer)}`,
      `Gesamtbelastung GmbH: ${fmt(gmbhGesamt)}`,
      `Vorteil GmbH: ${fmt(gmbhVorteil)}`,
    ].filter(Boolean).join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Steueroptimierung.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Calculator className="h-8 w-8 text-primary" />
            Steueroptimierung
          </h1>
          <p className="text-muted-foreground">Steuerrechner 2024, Rechtsformvergleich und Optimierungstipps</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportReport}><Download className="h-4 w-4 mr-1" />Report exportieren</Button>
      </div>

      <Tabs defaultValue="rechner">
        <TabsList>
          <TabsTrigger value="rechner">Steuerrechner</TabsTrigger>
          <TabsTrigger value="vergleich">Rechtsformvergleich</TabsTrigger>
          <TabsTrigger value="tipps">Optimierungstipps</TabsTrigger>
        </TabsList>

        {/* Steuerrechner */}
        <TabsContent value="rechner" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Eingaben */}
            <Card>
              <CardHeader><CardTitle className="text-base">Eingaben</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Jahreseinnahmen: {fmt(einnahmen)}</Label>
                  <Slider value={[einnahmen]} onValueChange={([v]) => setEinnahmen(v)} min={0} max={500000} step={1000} className="mt-2" />
                  <Input type="number" value={einnahmen} onChange={e => setEinnahmen(Number(e.target.value))} className="mt-2" />
                </div>
                <div>
                  <Label>Betriebsausgaben: {fmt(ausgaben)}</Label>
                  <Slider value={[ausgaben]} onValueChange={([v]) => setAusgaben(v)} min={0} max={Math.max(einnahmen, 100000)} step={500} className="mt-2" />
                  <Input type="number" value={ausgaben} onChange={e => setAusgaben(Number(e.target.value))} className="mt-2" />
                </div>
                <div>
                  <Label>Sonderausgaben / Vorsorge: {fmt(sonderausgaben)}</Label>
                  <Slider value={[sonderausgaben]} onValueChange={([v]) => setSonderausgaben(v)} min={0} max={30000} step={100} className="mt-2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Bundesland</Label>
                    <Select value={bundesland} onValueChange={setBundesland}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{BUNDESLAENDER.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Gewerbesteuer-Hebesatz: {hebesatz}%</Label>
                    <Input type="number" value={hebesatz} onChange={e => setHebesatz(Number(e.target.value))} className="mt-1" min={200} max={600} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="kist" checked={kirchensteuer} onChange={e => setKirchensteuer(e.target.checked)} className="w-4 h-4" />
                  <Label htmlFor="kist">Kirchensteuer ({['BY', 'BW'].includes(bundesland) ? '8%' : '9%'})</Label>
                </div>
              </CardContent>
            </Card>

            {/* Ergebnis */}
            <Card>
              <CardHeader><CardTitle className="text-base">Steuerberechnung 2024</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between"><span>Einnahmen</span><span className="font-medium">{fmt(einnahmen)}</span></div>
                  <div className="flex justify-between"><span>- Betriebsausgaben</span><span className="font-medium text-red-600">- {fmt(ausgaben)}</span></div>
                  <div className="flex justify-between border-t pt-1"><span className="font-semibold">Gewinn</span><span className="font-bold">{fmt(gewinn)}</span></div>
                  <div className="flex justify-between"><span>- Sonderausgaben</span><span className="font-medium text-red-600">- {fmt(sonderausgaben)}</span></div>
                  <div className="flex justify-between border-t pt-1"><span className="font-semibold">zu versteuerndes Einkommen</span><span className="font-bold">{fmt(zvE)}</span></div>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Einkommensteuer', value: estCalc.est, color: 'text-red-600' },
                    { label: 'Solidaritätszuschlag', value: estCalc.soli, color: 'text-orange-600' },
                    ...(kirchensteuer ? [{ label: 'Kirchensteuer', value: estCalc.kist, color: 'text-orange-600' }] : []),
                    { label: `Gewerbesteuer (${hebesatz}%)`, value: gewerbesteuer, color: 'text-yellow-600' },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0">
                      <span className="text-sm">{item.label}</span>
                      <span className={`font-bold ${item.color}`}>{fmt(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2 bg-red-50 dark:bg-red-950/20 rounded-lg px-3 mt-2">
                    <span className="font-bold">Gesamtsteuerbelastung</span>
                    <span className="font-bold text-red-600 text-lg">{fmt(einzelGesamt)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Grenzsteuersatz</p>
                    <p className="text-xl font-bold text-orange-600">{fmtPct(estCalc.grenzsteuersatz)}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Durchschnittssteuersatz</p>
                    <p className="text-xl font-bold text-blue-600">{fmtPct(estCalc.durchschnittssteuersatz)}</p>
                  </div>
                </div>

                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Netto nach Steuern</p>
                  <p className="text-2xl font-bold text-green-600">{fmt(gewinn - einzelGesamt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rechtsformvergleich */}
        <TabsContent value="vergleich" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className={`border-2 ${einzelGesamt <= gmbhGesamt ? 'border-green-500' : 'border-border'}`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Einzelunternehmen / Freiberufler
                  {einzelGesamt <= gmbhGesamt && <Badge className="bg-green-600">Günstiger</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Einkommensteuer</span><span className="font-medium">{fmt(estCalc.est)}</span></div>
                <div className="flex justify-between"><span>Solidaritätszuschlag</span><span className="font-medium">{fmt(estCalc.soli)}</span></div>
                <div className="flex justify-between"><span>Gewerbesteuer</span><span className="font-medium">{fmt(gewerbesteuer)}</span></div>
                <div className="flex justify-between border-t pt-2 font-bold text-base">
                  <span>Gesamt</span><span className="text-red-600">{fmt(einzelGesamt)}</span>
                </div>
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Netto</span><span>{fmt(gewinn - einzelGesamt)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-2 ${gmbhGesamt < einzelGesamt ? 'border-green-500' : 'border-border'}`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  GmbH
                  {gmbhGesamt < einzelGesamt && <Badge className="bg-green-600">Günstiger</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Körperschaftsteuer (15%)</span><span className="font-medium">{fmt(gmbhKoerperschaftsteuer)}</span></div>
                <div className="flex justify-between"><span>Solidaritätszuschlag</span><span className="font-medium">{fmt(gmbhSoli)}</span></div>
                <div className="flex justify-between"><span>Gewerbesteuer</span><span className="font-medium">{fmt(gmbhGewerbesteuer)}</span></div>
                <div className="flex justify-between border-t pt-2 font-bold text-base">
                  <span>Gesamt</span><span className="text-red-600">{fmt(gmbhGesamt)}</span>
                </div>
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Netto (thesauriert)</span><span>{fmt(gewinn - gmbhGesamt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className={`${gmbhVorteil > 0 ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' : 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20'}`}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                {gmbhVorteil > 0 ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <AlertTriangle className="h-6 w-6 text-orange-600" />}
                <div>
                  <p className="font-bold">
                    {gmbhVorteil > 0
                      ? `GmbH spart ${fmt(gmbhVorteil)} Steuern pro Jahr`
                      : `Einzelunternehmen spart ${fmt(-gmbhVorteil)} Steuern pro Jahr`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {gmbhVorteil > 0
                      ? 'Bei diesem Gewinn ist eine GmbH-Gründung steuerlich vorteilhaft. Beachten Sie jedoch Gründungskosten (~2.000 €) und laufende Verwaltungskosten.'
                      : 'Bei diesem Gewinn ist das Einzelunternehmen steuerlich günstiger. Eine GmbH lohnt sich typischerweise ab 60.000 € Jahresgewinn.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimierungstipps */}
        <TabsContent value="tipps" className="space-y-3">
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <p>Diese Tipps sind allgemeine Hinweise und ersetzen keine Steuerberatung. Konsultieren Sie für Ihre individuelle Situation einen Steuerberater.</p>
              </div>
            </CardContent>
          </Card>

          {OPTIMIERUNGSTIPPS.map(kat => (
            <Card key={kat.kategorie}>
              <CardHeader className="py-3 cursor-pointer" onClick={() => setExpandedKat(expandedKat === kat.kategorie ? null : kat.kategorie)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    {kat.kategorie}
                    <Badge variant="outline" className="text-xs">{kat.tipps.length} Tipps</Badge>
                  </CardTitle>
                  {expandedKat === kat.kategorie ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
              {expandedKat === kat.kategorie && (
                <CardContent className="pt-0 space-y-3">
                  {kat.tipps.map((tipp, i) => (
                    <div key={i} className="p-3 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{tipp.titel}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{tipp.beschreibung}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">{tipp.ersparnis}</Badge>
                          <Badge variant="outline" className={`text-xs ${tipp.schwierigkeit === 'einfach' ? 'border-green-500 text-green-600' : tipp.schwierigkeit === 'mittel' ? 'border-yellow-500 text-yellow-600' : 'border-red-500 text-red-600'}`}>
                            {tipp.schwierigkeit}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
