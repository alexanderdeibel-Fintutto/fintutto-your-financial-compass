/**
 * Offene Posten (OP-Liste) – Forderungen & Verbindlichkeiten
 * Aging-Analyse, Mahnwesen-Workflow, Zahlungseingangs-Matching
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, CheckCircle2, AlertTriangle, Clock, Search, Download,
  RefreshCw, ChevronDown, Filter, ArrowUpRight, ArrowDownRight,
  Mail, Phone, MoreHorizontal, TrendingDown, Banknote, Calendar
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('de-DE');

interface OpenItem {
  id: string;
  type: 'forderung' | 'verbindlichkeit';
  number: string;
  contact_name: string;
  contact_email?: string;
  amount: number;
  paid_amount: number;
  open_amount: number;
  invoice_date: string;
  due_date: string;
  days_overdue: number;
  aging_bucket: '0-30' | '31-60' | '61-90' | '90+';
  dunning_level: 0 | 1 | 2 | 3;
  last_dunning_date?: string;
  status: 'offen' | 'gemahnt' | 'inkasso' | 'teilbezahlt';
  notes?: string;
}

interface PaymentDialog {
  item: OpenItem | null;
  amount: string;
  date: string;
  notes: string;
}

const AGING_COLORS = { '0-30': '#10b981', '31-60': '#f59e0b', '61-90': '#f97316', '90+': '#ef4444' };
const DUNNING_LABELS = { 0: 'Keine', 1: '1. Mahnung', 2: '2. Mahnung', 3: 'Letzte Mahnung' };
const DUNNING_COLORS = { 0: 'secondary', 1: 'outline', 2: 'default', 3: 'destructive' } as const;

export default function OffenePosten() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OpenItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'alle' | 'forderung' | 'verbindlichkeit'>('alle');
  const [filterAging, setFilterAging] = useState<string>('alle');
  const [paymentDialog, setPaymentDialog] = useState<PaymentDialog>({ item: null, amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [dunningDialog, setDunningDialog] = useState<OpenItem | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const today = new Date();

      // Offene Rechnungen (Forderungen)
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, contact_name, contact_email, total_amount, paid_amount, issue_date, due_date, status, dunning_level, last_dunning_date, notes')
        .eq('company_id', currentCompany.id)
        .in('status', ['sent', 'overdue', 'partial', 'dunning'])
        .order('due_date', { ascending: true });

      const forderungen: OpenItem[] = (invoices || []).map(inv => {
        const dueDate = new Date(inv.due_date || inv.issue_date);
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        const openAmount = (inv.total_amount || 0) - (inv.paid_amount || 0);
        const agingBucket: OpenItem['aging_bucket'] = daysOverdue <= 30 ? '0-30' : daysOverdue <= 60 ? '31-60' : daysOverdue <= 90 ? '61-90' : '90+';
        const dunningLevel = (inv.dunning_level || 0) as 0 | 1 | 2 | 3;
        return {
          id: inv.id, type: 'forderung',
          number: inv.invoice_number || '-',
          contact_name: inv.contact_name || 'Unbekannt',
          contact_email: inv.contact_email || undefined,
          amount: inv.total_amount || 0,
          paid_amount: inv.paid_amount || 0,
          open_amount: openAmount,
          invoice_date: inv.issue_date || today.toISOString(),
          due_date: inv.due_date || inv.issue_date || today.toISOString(),
          days_overdue: daysOverdue,
          aging_bucket: agingBucket,
          dunning_level: dunningLevel,
          last_dunning_date: inv.last_dunning_date || undefined,
          status: dunningLevel > 0 ? 'gemahnt' : (inv.paid_amount || 0) > 0 ? 'teilbezahlt' : 'offen',
          notes: inv.notes || undefined,
        };
      });

      // Offene Verbindlichkeiten (aus Ausgaben/Lieferantenrechnungen)
      const { data: expenses } = await supabase
        .from('transactions')
        .select('id, description, contact_name, amount, date, due_date, status, notes')
        .eq('company_id', currentCompany.id)
        .eq('type', 'expense')
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      const verbindlichkeiten: OpenItem[] = (expenses || []).map(exp => {
        const dueDate = new Date(exp.due_date || exp.date);
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        const agingBucket: OpenItem['aging_bucket'] = daysOverdue <= 30 ? '0-30' : daysOverdue <= 60 ? '31-60' : daysOverdue <= 90 ? '61-90' : '90+';
        return {
          id: exp.id, type: 'verbindlichkeit',
          number: exp.id.slice(0, 8).toUpperCase(),
          contact_name: exp.contact_name || exp.description || 'Lieferant',
          amount: Math.abs(exp.amount || 0),
          paid_amount: 0,
          open_amount: Math.abs(exp.amount || 0),
          invoice_date: exp.date,
          due_date: exp.due_date || exp.date,
          days_overdue: daysOverdue,
          aging_bucket: agingBucket,
          dunning_level: 0,
          status: 'offen',
          notes: exp.notes || undefined,
        };
      });

      setItems([...forderungen, ...verbindlichkeiten]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => items.filter(item => {
    if (filterType !== 'alle' && item.type !== filterType) return false;
    if (filterAging !== 'alle' && item.aging_bucket !== filterAging) return false;
    if (searchQuery && !item.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.number.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }), [items, filterType, filterAging, searchQuery]);

  const kpis = useMemo(() => {
    const forderungen = items.filter(i => i.type === 'forderung');
    const verbindlichkeiten = items.filter(i => i.type === 'verbindlichkeit');
    const ueberfaelligForderungen = forderungen.filter(i => i.days_overdue > 0);
    return {
      gesamtForderungen: forderungen.reduce((s, i) => s + i.open_amount, 0),
      gesamtVerbindlichkeiten: verbindlichkeiten.reduce((s, i) => s + i.open_amount, 0),
      ueberfaellig: ueberfaelligForderungen.reduce((s, i) => s + i.open_amount, 0),
      anzahlUeberfaellig: ueberfaelligForderungen.length,
      dso: forderungen.length > 0 ? Math.round(forderungen.reduce((s, i) => s + i.days_overdue, 0) / forderungen.length) : 0,
    };
  }, [items]);

  const agingData = useMemo(() => {
    const buckets = ['0-30', '31-60', '61-90', '90+'] as const;
    return buckets.map(b => ({
      name: b + ' Tage',
      forderungen: items.filter(i => i.type === 'forderung' && i.aging_bucket === b).reduce((s, i) => s + i.open_amount, 0),
      verbindlichkeiten: items.filter(i => i.type === 'verbindlichkeit' && i.aging_bucket === b).reduce((s, i) => s + i.open_amount, 0),
      color: AGING_COLORS[b],
    }));
  }, [items]);

  const markAsPaid = async () => {
    if (!paymentDialog.item || !paymentDialog.amount) { toast.error('Betrag erforderlich'); return; }
    setSaving(true);
    try {
      const item = paymentDialog.item;
      const paidNow = parseFloat(paymentDialog.amount);
      const newPaid = item.paid_amount + paidNow;
      const newStatus = newPaid >= item.amount ? 'paid' : 'partial';

      if (item.type === 'forderung') {
        await supabase.from('invoices').update({
          paid_amount: newPaid,
          status: newStatus,
          payment_date: newStatus === 'paid' ? paymentDialog.date : null,
        }).eq('id', item.id);
      } else {
        await supabase.from('transactions').update({ status: 'completed' }).eq('id', item.id);
      }

      toast.success(newStatus === 'paid' ? 'Als vollständig bezahlt markiert' : `Teilzahlung von ${fmt(paidNow)} erfasst`);
      setPaymentDialog({ item: null, amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (e) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const sendDunning = async (item: OpenItem) => {
    if (item.type !== 'forderung') return;
    const newLevel = Math.min(3, item.dunning_level + 1) as 1 | 2 | 3;
    try {
      await supabase.from('invoices').update({
        dunning_level: newLevel,
        last_dunning_date: new Date().toISOString().split('T')[0],
        status: 'dunning',
      }).eq('id', item.id);
      toast.success(`${DUNNING_LABELS[newLevel]} für ${item.contact_name} versendet`);
      setDunningDialog(null);
      fetchData();
    } catch (e) {
      toast.error('Fehler beim Mahnen');
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Typ', 'Nummer', 'Kontakt', 'Rechnungsdatum', 'Fällig am', 'Betrag', 'Offen', 'Überfällig (Tage)', 'Mahnstufe', 'Status'],
      ...filtered.map(i => [
        i.type === 'forderung' ? 'Forderung' : 'Verbindlichkeit',
        i.number, i.contact_name, fmtDate(i.invoice_date), fmtDate(i.due_date),
        i.amount.toFixed(2), i.open_amount.toFixed(2), i.days_overdue,
        DUNNING_LABELS[i.dunning_level], i.status,
      ]),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'OffenePosten.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            Offene Posten
          </h1>
          <p className="text-muted-foreground">Forderungen, Verbindlichkeiten, Aging-Analyse und Mahnwesen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" />Aktualisieren</Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="col-span-1">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              <p className="text-xs text-muted-foreground">Offene Forderungen</p>
            </div>
            <p className="text-xl font-bold text-green-600">{fmt(kpis.gesamtForderungen)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="h-4 w-4 text-red-600" />
              <p className="text-xs text-muted-foreground">Verbindlichkeiten</p>
            </div>
            <p className="text-xl font-bold text-red-600">{fmt(kpis.gesamtVerbindlichkeiten)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-muted-foreground">Überfällig</p>
            </div>
            <p className="text-xl font-bold text-orange-600">{fmt(kpis.ueberfaellig)}</p>
            <p className="text-xs text-muted-foreground">{kpis.anzahlUeberfaellig} Posten</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Netto-Position</p>
            </div>
            <p className={`text-xl font-bold ${kpis.gesamtForderungen - kpis.gesamtVerbindlichkeiten >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(kpis.gesamtForderungen - kpis.gesamtVerbindlichkeiten)}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-muted-foreground">Ø DSO</p>
            </div>
            <p className="text-xl font-bold">{kpis.dso} Tage</p>
            <p className="text-xs text-muted-foreground">Days Sales Outstanding</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="liste">
        <TabsList>
          <TabsTrigger value="liste">OP-Liste</TabsTrigger>
          <TabsTrigger value="aging">Aging-Analyse</TabsTrigger>
          <TabsTrigger value="mahnwesen">Mahnwesen</TabsTrigger>
        </TabsList>

        {/* OP-Liste */}
        <TabsContent value="liste" className="space-y-4">
          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Kontakt oder Nummer suchen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Typen</SelectItem>
                <SelectItem value="forderung">Nur Forderungen</SelectItem>
                <SelectItem value="verbindlichkeit">Nur Verbindlichkeiten</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAging} onValueChange={setFilterAging}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Altersklassen</SelectItem>
                <SelectItem value="0-30">0–30 Tage</SelectItem>
                <SelectItem value="31-60">31–60 Tage</SelectItem>
                <SelectItem value="61-90">61–90 Tage</SelectItem>
                <SelectItem value="90+">90+ Tage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
              <p className="font-medium">Keine offenen Posten gefunden</p>
              <p className="text-sm">Alle Rechnungen sind bezahlt oder keine Einträge vorhanden.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(item => (
                <Card key={item.id} className={`hover:shadow-md transition-shadow ${item.days_overdue > 90 ? 'border-red-200 dark:border-red-800' : item.days_overdue > 30 ? 'border-orange-200 dark:border-orange-800' : ''}`}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-1 h-10 rounded-full flex-shrink-0 ${item.type === 'forderung' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">{item.contact_name}</span>
                            <Badge variant="outline" className="text-xs">{item.number}</Badge>
                            <Badge variant={item.type === 'forderung' ? 'default' : 'secondary'} className="text-xs">
                              {item.type === 'forderung' ? 'Forderung' : 'Verbindlichkeit'}
                            </Badge>
                            {item.dunning_level > 0 && (
                              <Badge variant={DUNNING_COLORS[item.dunning_level]} className="text-xs">
                                {DUNNING_LABELS[item.dunning_level]}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Fällig: {fmtDate(item.due_date)}</span>
                            {item.days_overdue > 0 && (
                              <span className={`font-medium ${item.days_overdue > 60 ? 'text-red-600' : 'text-orange-600'}`}>
                                {item.days_overdue} Tage überfällig
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className={`font-bold ${item.type === 'forderung' ? 'text-green-600' : 'text-red-600'}`}>{fmt(item.open_amount)}</p>
                          {item.paid_amount > 0 && <p className="text-xs text-muted-foreground">von {fmt(item.amount)}</p>}
                        </div>
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: AGING_COLORS[item.aging_bucket] }}
                          title={`Altersklasse: ${item.aging_bucket} Tage`}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setPaymentDialog({ item, amount: item.open_amount.toFixed(2), date: new Date().toISOString().split('T')[0], notes: '' })}>
                              <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />Als bezahlt markieren
                            </DropdownMenuItem>
                            {item.type === 'forderung' && item.dunning_level < 3 && (
                              <DropdownMenuItem onClick={() => setDunningDialog(item)}>
                                <Mail className="h-4 w-4 mr-2 text-orange-600" />Mahnung senden
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Aging-Analyse */}
        <TabsContent value="aging" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Aging-Analyse nach Altersklassen</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="forderungen" name="Forderungen" fill="#10b981" />
                  <Bar dataKey="verbindlichkeiten" name="Verbindlichkeiten" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['0-30', '31-60', '61-90', '90+'] as const).map(bucket => {
              const bucketItems = items.filter(i => i.type === 'forderung' && i.aging_bucket === bucket);
              const total = bucketItems.reduce((s, i) => s + i.open_amount, 0);
              return (
                <Card key={bucket} style={{ borderLeftColor: AGING_COLORS[bucket], borderLeftWidth: 4 }}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">{bucket} Tage</p>
                    <p className="text-lg font-bold">{fmt(total)}</p>
                    <p className="text-xs text-muted-foreground">{bucketItems.length} Posten</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Mahnwesen */}
        <TabsContent value="mahnwesen" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([1, 2, 3] as const).map(level => {
              const levelItems = items.filter(i => i.type === 'forderung' && i.dunning_level === level);
              const total = levelItems.reduce((s, i) => s + i.open_amount, 0);
              return (
                <Card key={level}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant={DUNNING_COLORS[level]}>{DUNNING_LABELS[level]}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{levelItems.length}</p>
                    <p className="text-sm text-muted-foreground">{fmt(total)} offen</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Mahnwesen-Übersicht</CardTitle></CardHeader>
            <CardContent>
              {items.filter(i => i.type === 'forderung' && i.days_overdue > 0).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500 opacity-50" />
                  <p>Keine überfälligen Forderungen</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.filter(i => i.type === 'forderung' && i.days_overdue > 0)
                    .sort((a, b) => b.days_overdue - a.days_overdue)
                    .map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{item.contact_name}</p>
                          <p className="text-xs text-muted-foreground">{item.number} · {item.days_overdue} Tage überfällig</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-red-600">{fmt(item.open_amount)}</span>
                          <Badge variant={DUNNING_COLORS[item.dunning_level]}>{DUNNING_LABELS[item.dunning_level]}</Badge>
                          {item.dunning_level < 3 && (
                            <Button size="sm" variant="outline" onClick={() => setDunningDialog(item)}>
                              <Mail className="h-3.5 w-3.5 mr-1" />Mahnen
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Zahlungs-Dialog */}
      <Dialog open={!!paymentDialog.item} onOpenChange={open => !open && setPaymentDialog(p => ({ ...p, item: null }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zahlung erfassen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {paymentDialog.item && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium">{paymentDialog.item.contact_name}</p>
                <p className="text-muted-foreground">Offen: {fmt(paymentDialog.item.open_amount)}</p>
              </div>
            )}
            <div>
              <Label>Zahlungsbetrag (€)</Label>
              <Input type="number" value={paymentDialog.amount} onChange={e => setPaymentDialog(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Zahlungsdatum</Label>
              <Input type="date" value={paymentDialog.date} onChange={e => setPaymentDialog(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <Label>Notiz (optional)</Label>
              <Input value={paymentDialog.notes} onChange={e => setPaymentDialog(p => ({ ...p, notes: e.target.value }))} placeholder="z.B. Banküberweisung" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(p => ({ ...p, item: null }))}>Abbrechen</Button>
            <Button onClick={markAsPaid} disabled={saving}>
              <CheckCircle2 className="h-4 w-4 mr-1" />{saving ? 'Speichern...' : 'Zahlung erfassen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mahnungs-Dialog */}
      <Dialog open={!!dunningDialog} onOpenChange={open => !open && setDunningDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mahnung senden</DialogTitle></DialogHeader>
          {dunningDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{dunningDialog.contact_name}</p>
                <p className="text-sm text-muted-foreground">Rechnung {dunningDialog.number} · {fmt(dunningDialog.open_amount)} offen</p>
                <p className="text-sm text-muted-foreground">{dunningDialog.days_overdue} Tage überfällig</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-sm font-medium">Nächste Mahnstufe:</p>
                <Badge variant={DUNNING_COLORS[Math.min(3, dunningDialog.dunning_level + 1) as 1 | 2 | 3]} className="mt-1">
                  {DUNNING_LABELS[Math.min(3, dunningDialog.dunning_level + 1) as 0 | 1 | 2 | 3]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Die Mahnstufe wird in der Rechnung aktualisiert. Sie können die Mahnung anschließend aus der Rechnungsansicht drucken oder per E-Mail versenden.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDunningDialog(null)}>Abbrechen</Button>
            <Button onClick={() => dunningDialog && sendDunning(dunningDialog)} className="bg-orange-600 hover:bg-orange-700">
              <Mail className="h-4 w-4 mr-1" />Mahnstufe setzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
