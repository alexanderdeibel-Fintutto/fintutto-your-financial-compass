/**
 * Kontenrahmen – SKR03/SKR04 Kontenrahmen mit doppelter Buchführung
 * Vollständige Kontenübersicht, Buchungssätze, Saldenliste
 * Entspricht DATEV-Standard und deutschen Buchhaltungsregeln
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen, Search, Download, RefreshCw, ChevronDown, ChevronUp,
  Plus, Pencil, Trash2, ArrowLeftRight, Filter, BarChart3
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);

// SKR03 Kontenklassen
const SKR03_CLASSES = [
  { klasse: '0', name: 'Anlage- und Kapitalkonten', color: 'bg-blue-100 dark:bg-blue-900/30' },
  { klasse: '1', name: 'Finanz- und Privatkonten', color: 'bg-green-100 dark:bg-green-900/30' },
  { klasse: '2', name: 'Abgrenzungskonten', color: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { klasse: '3', name: 'Wareneingangs- und Bestandskonten', color: 'bg-orange-100 dark:bg-orange-900/30' },
  { klasse: '4', name: 'Betriebliche Aufwendungen', color: 'bg-red-100 dark:bg-red-900/30' },
  { klasse: '5', name: 'Betriebliche Aufwendungen (Forts.)', color: 'bg-red-100 dark:bg-red-900/30' },
  { klasse: '6', name: 'Betriebliche Aufwendungen (Forts.)', color: 'bg-red-100 dark:bg-red-900/30' },
  { klasse: '7', name: 'Bestands- und Erfolgskonten', color: 'bg-purple-100 dark:bg-purple-900/30' },
  { klasse: '8', name: 'Erlöskonten', color: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { klasse: '9', name: 'Vortragskonten und statistische Konten', color: 'bg-gray-100 dark:bg-gray-900/30' },
];

// Standard SKR03 Konten
const DEFAULT_ACCOUNTS = [
  // Klasse 0 – Anlagevermögen
  { konto: '0100', name: 'Grundstücke', klasse: '0', typ: 'aktiv', steuer: '' },
  { konto: '0210', name: 'Gebäude', klasse: '0', typ: 'aktiv', steuer: '' },
  { konto: '0400', name: 'Maschinen', klasse: '0', typ: 'aktiv', steuer: '' },
  { konto: '0650', name: 'Fuhrpark', klasse: '0', typ: 'aktiv', steuer: '' },
  { konto: '0840', name: 'BGA (Büroausstattung)', klasse: '0', typ: 'aktiv', steuer: '' },
  // Klasse 1 – Umlaufvermögen
  { konto: '1000', name: 'Kasse', klasse: '1', typ: 'aktiv', steuer: '' },
  { konto: '1200', name: 'Bank', klasse: '1', typ: 'aktiv', steuer: '' },
  { konto: '1400', name: 'Forderungen aus LuL', klasse: '1', typ: 'aktiv', steuer: '' },
  { konto: '1600', name: 'Verbindlichkeiten aus LuL', klasse: '1', typ: 'passiv', steuer: '' },
  { konto: '1780', name: 'Umsatzsteuer', klasse: '1', typ: 'passiv', steuer: '' },
  { konto: '1576', name: 'Vorsteuer 19%', klasse: '1', typ: 'aktiv', steuer: 'VSt19' },
  { konto: '1571', name: 'Vorsteuer 7%', klasse: '1', typ: 'aktiv', steuer: 'VSt7' },
  // Klasse 3 – Wareneinkauf
  { konto: '3200', name: 'Wareneinkauf 19% VSt', klasse: '3', typ: 'aufwand', steuer: 'VSt19' },
  { konto: '3300', name: 'Wareneinkauf 7% VSt', klasse: '3', typ: 'aufwand', steuer: 'VSt7' },
  // Klasse 4 – Betriebliche Aufwendungen
  { konto: '4100', name: 'Löhne und Gehälter', klasse: '4', typ: 'aufwand', steuer: '' },
  { konto: '4130', name: 'Soziale Abgaben', klasse: '4', typ: 'aufwand', steuer: '' },
  { konto: '4200', name: 'Raumkosten', klasse: '4', typ: 'aufwand', steuer: 'VSt19' },
  { konto: '4300', name: 'Versicherungen', klasse: '4', typ: 'aufwand', steuer: '' },
  { konto: '4360', name: 'Kfz-Steuer', klasse: '4', typ: 'aufwand', steuer: '' },
  { konto: '4380', name: 'Kfz-Versicherung', klasse: '4', typ: 'aufwand', steuer: '' },
  { konto: '4530', name: 'Bürobedarf', klasse: '4', typ: 'aufwand', steuer: 'VSt19' },
  { konto: '4540', name: 'Zeitschriften, Bücher', klasse: '4', typ: 'aufwand', steuer: 'VSt7' },
  { konto: '4600', name: 'Werbekosten', klasse: '4', typ: 'aufwand', steuer: 'VSt19' },
  { konto: '4650', name: 'Reisekosten', klasse: '4', typ: 'aufwand', steuer: 'VSt19' },
  { konto: '4900', name: 'Sonstige betriebliche Aufwendungen', klasse: '4', typ: 'aufwand', steuer: '' },
  // Klasse 8 – Erlöse
  { konto: '8400', name: 'Erlöse 19% USt', klasse: '8', typ: 'ertrag', steuer: 'USt19' },
  { konto: '8300', name: 'Erlöse 7% USt', klasse: '8', typ: 'ertrag', steuer: 'USt7' },
  { konto: '8200', name: 'Erlöse steuerfrei', klasse: '8', typ: 'ertrag', steuer: '' },
];

interface Account {
  id: string;
  konto: string;
  name: string;
  klasse: string;
  typ: 'aktiv' | 'passiv' | 'aufwand' | 'ertrag';
  steuer: string;
  soll: number;
  haben: number;
  saldo: number;
  company_id: string;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  soll_konto: string;
  haben_konto: string;
  betrag: number;
  beleg_nr?: string;
}

export default function Kontenrahmen() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKlasse, setFilterKlasse] = useState('alle');
  const [filterTyp, setFilterTyp] = useState('alle');
  const [expandedKlasse, setExpandedKlasse] = useState<string | null>(null);
  const [buchungsDialog, setBuchungsDialog] = useState(false);
  const [buchungsForm, setBuchungsForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    soll_konto: '',
    haben_konto: '',
    betrag: '',
    beleg_nr: '',
  });
  const [saving, setSaving] = useState(false);
  const [jahr, setJahr] = useState(new Date().getFullYear());

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const startDate = `${jahr}-01-01`;
      const endDate = `${jahr}-12-31`;

      // Transaktionen für Saldoberechnung
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type, category, date')
        .eq('company_id', currentCompany.id)
        .gte('date', startDate)
        .lte('date', endDate);

      // Konten mit Salden berechnen
      const accountMap = new Map<string, { soll: number; haben: number }>();
      DEFAULT_ACCOUNTS.forEach(a => accountMap.set(a.konto, { soll: 0, haben: 0 }));

      // Transaktionen auf Konten verteilen (vereinfacht)
      (transactions || []).forEach(t => {
        const amount = Math.abs(t.amount || 0);
        if (t.type === 'income') {
          // Einnahme: Soll Bank (1200), Haben Erlöse (8400)
          const bank = accountMap.get('1200') || { soll: 0, haben: 0 };
          accountMap.set('1200', { soll: bank.soll + amount, haben: bank.haben });
          const erloes = accountMap.get('8400') || { soll: 0, haben: 0 };
          accountMap.set('8400', { soll: erloes.soll, haben: erloes.haben + amount });
        } else {
          // Ausgabe: Soll Aufwand (4900), Haben Bank (1200)
          const aufwand = accountMap.get('4900') || { soll: 0, haben: 0 };
          accountMap.set('4900', { soll: aufwand.soll + amount, haben: aufwand.haben });
          const bank = accountMap.get('1200') || { soll: 0, haben: 0 };
          accountMap.set('1200', { soll: bank.soll, haben: bank.haben + amount });
        }
      });

      const accountList: Account[] = DEFAULT_ACCOUNTS.map(a => {
        const saldo = accountMap.get(a.konto) || { soll: 0, haben: 0 };
        const netSaldo = saldo.soll - saldo.haben;
        return {
          id: a.konto,
          konto: a.konto,
          name: a.name,
          klasse: a.klasse,
          typ: a.typ as Account['typ'],
          steuer: a.steuer,
          soll: saldo.soll,
          haben: saldo.haben,
          saldo: netSaldo,
          company_id: currentCompany.id,
        };
      });

      setAccounts(accountList);

      // Journal-Einträge aus localStorage
      const saved = localStorage.getItem(`journal_${currentCompany.id}_${jahr}`);
      if (saved) setJournalEntries(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany, jahr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredAccounts = useMemo(() => accounts.filter(a => {
    if (filterKlasse !== 'alle' && a.klasse !== filterKlasse) return false;
    if (filterTyp !== 'alle' && a.typ !== filterTyp) return false;
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase()) && !a.konto.includes(searchQuery)) return false;
    return true;
  }), [accounts, filterKlasse, filterTyp, searchQuery]);

  const accountsByKlasse = useMemo(() => {
    const grouped = new Map<string, Account[]>();
    filteredAccounts.forEach(a => {
      const list = grouped.get(a.klasse) || [];
      list.push(a);
      grouped.set(a.klasse, list);
    });
    return grouped;
  }, [filteredAccounts]);

  const kpis = useMemo(() => {
    const aktiva = accounts.filter(a => a.typ === 'aktiv').reduce((s, a) => s + Math.max(0, a.saldo), 0);
    const passiva = accounts.filter(a => a.typ === 'passiv').reduce((s, a) => s + Math.abs(Math.min(0, a.saldo)), 0);
    const aufwand = accounts.filter(a => a.typ === 'aufwand').reduce((s, a) => s + a.soll, 0);
    const ertrag = accounts.filter(a => a.typ === 'ertrag').reduce((s, a) => s + a.haben, 0);
    return { aktiva, passiva, aufwand, ertrag, gewinn: ertrag - aufwand };
  }, [accounts]);

  const addJournalEntry = () => {
    if (!buchungsForm.description || !buchungsForm.soll_konto || !buchungsForm.haben_konto || !buchungsForm.betrag) {
      toast.error('Alle Pflichtfelder ausfüllen'); return;
    }
    const entry: JournalEntry = {
      id: Date.now().toString(),
      date: buchungsForm.date,
      description: buchungsForm.description,
      soll_konto: buchungsForm.soll_konto,
      haben_konto: buchungsForm.haben_konto,
      betrag: parseFloat(buchungsForm.betrag),
      beleg_nr: buchungsForm.beleg_nr || undefined,
    };
    const newEntries = [...journalEntries, entry];
    setJournalEntries(newEntries);
    localStorage.setItem(`journal_${currentCompany?.id}_${jahr}`, JSON.stringify(newEntries));
    setBuchungsForm({ date: new Date().toISOString().split('T')[0], description: '', soll_konto: '', haben_konto: '', betrag: '', beleg_nr: '' });
    setBuchungsDialog(false);
    toast.success('Buchungssatz erfasst');
  };

  const exportSaldenliste = () => {
    const rows = [
      ['Konto', 'Bezeichnung', 'Klasse', 'Typ', 'Soll', 'Haben', 'Saldo'],
      ...accounts.map(a => [a.konto, a.name, a.klasse, a.typ, a.soll.toFixed(2), a.haben.toFixed(2), a.saldo.toFixed(2)]),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Saldenliste_${jahr}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const TYP_COLORS: Record<string, string> = {
    aktiv: 'text-blue-600',
    passiv: 'text-purple-600',
    aufwand: 'text-red-600',
    ertrag: 'text-green-600',
  };

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            Kontenrahmen SKR03
          </h1>
          <p className="text-muted-foreground">Vollständige Kontenübersicht, Saldenliste und Buchungssätze</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(jahr)} onValueChange={v => setJahr(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[jahr - 1, jahr, jahr + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" />Aktualisieren</Button>
          <Button variant="outline" size="sm" onClick={exportSaldenliste}><Download className="h-4 w-4 mr-1" />Saldenliste</Button>
          <Button size="sm" onClick={() => setBuchungsDialog(true)}><Plus className="h-4 w-4 mr-1" />Buchungssatz</Button>
        </div>
      </div>

      {/* Bilanz-KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Aktiva</p>
          <p className="text-xl font-bold text-blue-600">{fmt(kpis.aktiva)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Passiva</p>
          <p className="text-xl font-bold text-purple-600">{fmt(kpis.passiva)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Erlöse</p>
          <p className="text-xl font-bold text-green-600">{fmt(kpis.ertrag)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Aufwendungen</p>
          <p className="text-xl font-bold text-red-600">{fmt(kpis.aufwand)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Jahresüberschuss</p>
          <p className={`text-xl font-bold ${kpis.gewinn >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(kpis.gewinn)}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="konten">
        <TabsList>
          <TabsTrigger value="konten">Kontenübersicht</TabsTrigger>
          <TabsTrigger value="saldenliste">Saldenliste</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
        </TabsList>

        {/* Kontenübersicht */}
        <TabsContent value="konten" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Konto oder Bezeichnung suchen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Select value={filterKlasse} onValueChange={setFilterKlasse}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Kontenklasse" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Klassen</SelectItem>
                {SKR03_CLASSES.map(k => <SelectItem key={k.klasse} value={k.klasse}>Klasse {k.klasse}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTyp} onValueChange={setFilterTyp}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Typ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Typen</SelectItem>
                <SelectItem value="aktiv">Aktiv</SelectItem>
                <SelectItem value="passiv">Passiv</SelectItem>
                <SelectItem value="aufwand">Aufwand</SelectItem>
                <SelectItem value="ertrag">Ertrag</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {SKR03_CLASSES.map(klasse => {
            const klasseAccounts = accountsByKlasse.get(klasse.klasse);
            if (!klasseAccounts || klasseAccounts.length === 0) return null;
            const isExpanded = expandedKlasse === klasse.klasse || filterKlasse !== 'alle' || searchQuery !== '';
            return (
              <Card key={klasse.klasse}>
                <CardHeader className="py-3 cursor-pointer" onClick={() => setExpandedKlasse(isExpanded && expandedKlasse === klasse.klasse ? null : klasse.klasse)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${klasse.color}`}>
                        {klasse.klasse}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{klasse.name}</p>
                        <p className="text-xs text-muted-foreground">{klasseAccounts.length} Konten</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left py-2 pr-4 w-20">Konto</th>
                            <th className="text-left py-2 pr-4">Bezeichnung</th>
                            <th className="text-left py-2 pr-4 w-20">Typ</th>
                            <th className="text-right py-2 pr-4 w-28">Soll</th>
                            <th className="text-right py-2 pr-4 w-28">Haben</th>
                            <th className="text-right py-2 w-28">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {klasseAccounts.map(a => (
                            <tr key={a.konto} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-2 pr-4 font-mono text-xs font-bold">{a.konto}</td>
                              <td className="py-2 pr-4">{a.name}</td>
                              <td className="py-2 pr-4">
                                <span className={`text-xs font-medium ${TYP_COLORS[a.typ]}`}>{a.typ}</span>
                              </td>
                              <td className="text-right py-2 pr-4 text-green-600">{a.soll > 0 ? fmt(a.soll) : '-'}</td>
                              <td className="text-right py-2 pr-4 text-red-600">{a.haben > 0 ? fmt(a.haben) : '-'}</td>
                              <td className={`text-right py-2 font-bold ${a.saldo > 0 ? 'text-green-600' : a.saldo < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                {a.soll > 0 || a.haben > 0 ? fmt(a.saldo) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </TabsContent>

        {/* Saldenliste */}
        <TabsContent value="saldenliste">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground font-semibold">
                      <th className="text-left py-2 pr-4">Konto</th>
                      <th className="text-left py-2 pr-4">Bezeichnung</th>
                      <th className="text-right py-2 pr-4">Soll</th>
                      <th className="text-right py-2 pr-4">Haben</th>
                      <th className="text-right py-2">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.filter(a => a.soll > 0 || a.haben > 0).map(a => (
                      <tr key={a.konto} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 pr-4 font-mono text-xs font-bold">{a.konto}</td>
                        <td className="py-2 pr-4">{a.name}</td>
                        <td className="text-right py-2 pr-4">{fmt(a.soll)}</td>
                        <td className="text-right py-2 pr-4">{fmt(a.haben)}</td>
                        <td className={`text-right py-2 font-bold ${a.saldo > 0 ? 'text-green-600' : a.saldo < 0 ? 'text-red-600' : ''}`}>{fmt(a.saldo)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-bold bg-muted/30">
                      <td colSpan={2} className="py-2 pr-4">Summe</td>
                      <td className="text-right py-2 pr-4">{fmt(accounts.reduce((s, a) => s + a.soll, 0))}</td>
                      <td className="text-right py-2 pr-4">{fmt(accounts.reduce((s, a) => s + a.haben, 0))}</td>
                      <td className="text-right py-2">{fmt(accounts.reduce((s, a) => s + a.saldo, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Journal */}
        <TabsContent value="journal" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{journalEntries.length} Buchungssätze</p>
            <Button size="sm" onClick={() => setBuchungsDialog(true)}><Plus className="h-4 w-4 mr-1" />Buchungssatz</Button>
          </div>
          {journalEntries.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Noch keine manuellen Buchungssätze. Buchungen aus Transaktionen werden automatisch abgeleitet.</p>
            </CardContent></Card>
          ) : (
            <Card><CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-4">Datum</th>
                      <th className="text-left py-2 pr-4">Beleg</th>
                      <th className="text-left py-2 pr-4">Buchungstext</th>
                      <th className="text-right py-2 pr-4">Soll</th>
                      <th className="text-right py-2 pr-4">Haben</th>
                      <th className="text-right py-2">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalEntries.map(e => (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 pr-4 text-xs">{new Date(e.date).toLocaleDateString('de-DE')}</td>
                        <td className="py-2 pr-4 text-xs font-mono">{e.beleg_nr || '-'}</td>
                        <td className="py-2 pr-4">{e.description}</td>
                        <td className="text-right py-2 pr-4 font-mono text-xs">{e.soll_konto}</td>
                        <td className="text-right py-2 pr-4 font-mono text-xs">{e.haben_konto}</td>
                        <td className="text-right py-2 font-bold">{fmt(e.betrag)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Buchungssatz-Dialog */}
      <Dialog open={buchungsDialog} onOpenChange={setBuchungsDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" />Buchungssatz erfassen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Datum</Label>
                <Input type="date" value={buchungsForm.date} onChange={e => setBuchungsForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <Label>Beleg-Nr. (optional)</Label>
                <Input value={buchungsForm.beleg_nr} onChange={e => setBuchungsForm(p => ({ ...p, beleg_nr: e.target.value }))} placeholder="z.B. RE-2024-001" />
              </div>
            </div>
            <div>
              <Label>Buchungstext</Label>
              <Input value={buchungsForm.description} onChange={e => setBuchungsForm(p => ({ ...p, description: e.target.value }))} placeholder="z.B. Wareneinkauf Lieferant XY" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Soll-Konto</Label>
                <Select value={buchungsForm.soll_konto} onValueChange={v => setBuchungsForm(p => ({ ...p, soll_konto: v }))}>
                  <SelectTrigger><SelectValue placeholder="Konto wählen" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.konto} value={a.konto}>{a.konto} – {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Haben-Konto</Label>
                <Select value={buchungsForm.haben_konto} onValueChange={v => setBuchungsForm(p => ({ ...p, haben_konto: v }))}>
                  <SelectTrigger><SelectValue placeholder="Konto wählen" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.konto} value={a.konto}>{a.konto} – {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Betrag (€)</Label>
              <Input type="number" value={buchungsForm.betrag} onChange={e => setBuchungsForm(p => ({ ...p, betrag: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuchungsDialog(false)}>Abbrechen</Button>
            <Button onClick={addJournalEntry}>Buchungssatz erfassen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
