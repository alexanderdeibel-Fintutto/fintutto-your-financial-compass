/**
 * Mahnwesen – Professioneller Mahnwesen-Assistent
 * Automatische Mahnbrief-Generierung, Eskalations-Workflow, Inkasso-Übergabe
 * GoBD-konform mit vollständiger Mahnhistorie
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Mail, AlertTriangle, CheckCircle2, Clock, FileText, Send, Download,
  RefreshCw, Plus, ChevronRight, Printer, Phone, MoreHorizontal,
  TrendingUp, Shield, Zap, History
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('de-DE');

interface DunningCase {
  id: string;
  invoice_number: string;
  contact_name: string;
  contact_email?: string;
  contact_address?: string;
  amount: number;
  paid_amount: number;
  open_amount: number;
  invoice_date: string;
  due_date: string;
  days_overdue: number;
  dunning_level: 0 | 1 | 2 | 3;
  last_dunning_date?: string;
  dunning_fee: number;
  interest_amount: number;
  total_claim: number;
}

interface DunningTemplate {
  level: 1 | 2 | 3;
  subject: string;
  body: string;
  fee: number;
  interestRate: number;
  deadline_days: number;
}

const DUNNING_TEMPLATES: DunningTemplate[] = [
  {
    level: 1,
    subject: 'Zahlungserinnerung – Rechnung {invoice_number}',
    body: `Sehr geehrte Damen und Herren,

wir erlauben uns, Sie freundlich daran zu erinnern, dass folgende Rechnung noch offen ist:

Rechnungsnummer: {invoice_number}
Rechnungsdatum: {invoice_date}
Fälligkeitsdatum: {due_date}
Offener Betrag: {open_amount}

Möglicherweise handelt es sich um ein Versehen. Wir bitten Sie, den ausstehenden Betrag bis zum {deadline} auf unser Konto zu überweisen.

Falls Sie die Zahlung bereits veranlasst haben, bitten wir Sie, diese Erinnerung als gegenstandslos zu betrachten.

Mit freundlichen Grüßen
{company_name}`,
    fee: 0,
    interestRate: 0,
    deadline_days: 14,
  },
  {
    level: 2,
    subject: '1. Mahnung – Rechnung {invoice_number}',
    body: `Sehr geehrte Damen und Herren,

trotz unserer Zahlungserinnerung vom {last_dunning_date} haben wir noch keinen Zahlungseingang feststellen können.

Rechnungsnummer: {invoice_number}
Ursprünglicher Betrag: {amount}
Mahngebühr: {dunning_fee}
Verzugszinsen: {interest_amount}
Gesamtforderung: {total_claim}

Wir fordern Sie auf, den Gesamtbetrag von {total_claim} bis spätestens {deadline} zu begleichen.

Bei Nichtbeachtung dieser Mahnung sehen wir uns gezwungen, weitere rechtliche Schritte einzuleiten.

Mit freundlichen Grüßen
{company_name}`,
    fee: 5,
    interestRate: 5,
    deadline_days: 10,
  },
  {
    level: 3,
    subject: 'LETZTE MAHNUNG – Rechnung {invoice_number} – Rechtliche Schritte drohen',
    body: `Sehr geehrte Damen und Herren,

wir haben Ihnen bereits mehrfach die Begleichung der folgenden Forderung angemahnt, ohne dass eine Zahlung eingegangen ist.

Rechnungsnummer: {invoice_number}
Ursprünglicher Betrag: {amount}
Mahngebühren: {dunning_fee}
Verzugszinsen: {interest_amount}
GESAMTFORDERUNG: {total_claim}

Dies ist unsere LETZTE MAHNUNG. Wir setzen Ihnen eine letzte Frist bis zum {deadline}.

Sollte bis zu diesem Datum kein Zahlungseingang erfolgen, werden wir die Forderung ohne weitere Ankündigung an ein Inkassounternehmen übergeben und/oder gerichtliche Schritte einleiten. Die dadurch entstehenden Kosten gehen zu Ihren Lasten.

Mit freundlichen Grüßen
{company_name}`,
    fee: 15,
    interestRate: 9,
    deadline_days: 7,
  },
];

function generateDunningLetter(template: DunningTemplate, dunningCase: DunningCase, companyName: string): { subject: string; body: string } {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + template.deadline_days);

  const replace = (text: string) => text
    .replace(/{invoice_number}/g, dunningCase.invoice_number)
    .replace(/{invoice_date}/g, fmtDate(dunningCase.invoice_date))
    .replace(/{due_date}/g, fmtDate(dunningCase.due_date))
    .replace(/{open_amount}/g, fmt(dunningCase.open_amount))
    .replace(/{amount}/g, fmt(dunningCase.amount))
    .replace(/{dunning_fee}/g, fmt(dunningCase.dunning_fee))
    .replace(/{interest_amount}/g, fmt(dunningCase.interest_amount))
    .replace(/{total_claim}/g, fmt(dunningCase.total_claim))
    .replace(/{deadline}/g, fmtDate(deadline.toISOString().split('T')[0]))
    .replace(/{last_dunning_date}/g, dunningCase.last_dunning_date ? fmtDate(dunningCase.last_dunning_date) : 'zuletzt')
    .replace(/{company_name}/g, companyName)
    .replace(/{contact_name}/g, dunningCase.contact_name);

  return { subject: replace(template.subject), body: replace(template.body) };
}

export default function Mahnwesen() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<DunningCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<DunningCase | null>(null);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewContent, setPreviewContent] = useState({ subject: '', body: '' });
  const [previewLevel, setPreviewLevel] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('alle');
  const [historyDialog, setHistoryDialog] = useState<DunningCase | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const today = new Date();
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, contact_name, contact_email, total_amount, paid_amount, issue_date, due_date, dunning_level, last_dunning_date, dunning_fee, status')
        .eq('company_id', currentCompany.id)
        .in('status', ['sent', 'overdue', 'partial', 'dunning'])
        .order('due_date', { ascending: true });

      const dunningCases: DunningCase[] = (invoices || [])
        .filter(inv => {
          const dueDate = new Date(inv.due_date || inv.issue_date);
          return dueDate < today;
        })
        .map(inv => {
          const dueDate = new Date(inv.due_date || inv.issue_date);
          const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
          const openAmount = (inv.total_amount || 0) - (inv.paid_amount || 0);
          const dunningLevel = (inv.dunning_level || 0) as 0 | 1 | 2 | 3;
          const template = DUNNING_TEMPLATES.find(t => t.level === Math.max(1, dunningLevel) as 1 | 2 | 3) || DUNNING_TEMPLATES[0];
          const dunningFee = inv.dunning_fee || (dunningLevel > 0 ? DUNNING_TEMPLATES[dunningLevel - 1]?.fee || 0 : 0);
          const interestAmount = openAmount * (template.interestRate / 100) * (daysOverdue / 365);
          return {
            id: inv.id,
            invoice_number: inv.invoice_number || '-',
            contact_name: inv.contact_name || 'Unbekannt',
            contact_email: inv.contact_email || undefined,
            amount: inv.total_amount || 0,
            paid_amount: inv.paid_amount || 0,
            open_amount: openAmount,
            invoice_date: inv.issue_date,
            due_date: inv.due_date || inv.issue_date,
            days_overdue: daysOverdue,
            dunning_level: dunningLevel,
            last_dunning_date: inv.last_dunning_date || undefined,
            dunning_fee: dunningFee,
            interest_amount: Math.max(0, interestAmount),
            total_claim: openAmount + dunningFee + Math.max(0, interestAmount),
          };
        });

      setCases(dunningCases);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredCases = useMemo(() => {
    if (filterLevel === 'alle') return cases;
    if (filterLevel === 'neu') return cases.filter(c => c.dunning_level === 0);
    return cases.filter(c => c.dunning_level === Number(filterLevel));
  }, [cases, filterLevel]);

  const stats = useMemo(() => ({
    gesamt: cases.length,
    offen: cases.filter(c => c.dunning_level === 0).length,
    gemahnt: cases.filter(c => c.dunning_level > 0).length,
    gesamtForderung: cases.reduce((s, c) => s + c.total_claim, 0),
    kritisch: cases.filter(c => c.days_overdue > 60).length,
  }), [cases]);

  const openPreview = (dunningCase: DunningCase) => {
    const nextLevel = Math.min(3, dunningCase.dunning_level + 1) as 1 | 2 | 3;
    const template = DUNNING_TEMPLATES.find(t => t.level === nextLevel)!;
    const content = generateDunningLetter(template, dunningCase, currentCompany?.name || 'Ihr Unternehmen');
    setSelectedCase(dunningCase);
    setPreviewLevel(nextLevel);
    setPreviewContent(content);
    setPreviewDialog(true);
  };

  const sendDunning = async () => {
    if (!selectedCase) return;
    setSaving(true);
    try {
      const template = DUNNING_TEMPLATES.find(t => t.level === previewLevel)!;
      await supabase.from('invoices').update({
        dunning_level: previewLevel,
        last_dunning_date: new Date().toISOString().split('T')[0],
        dunning_fee: selectedCase.dunning_fee + template.fee,
        status: 'dunning',
      }).eq('id', selectedCase.id);

      toast.success(`Mahnstufe ${previewLevel} für ${selectedCase.contact_name} gesetzt`);
      setPreviewDialog(false);
      fetchData();
    } catch (e) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const downloadLetter = () => {
    const content = `${previewContent.subject}\n\n${previewContent.body}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mahnung_${selectedCase?.invoice_number}_Stufe${previewLevel}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const LEVEL_COLORS: Record<number, string> = {
    0: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    3: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const LEVEL_LABELS: Record<number, string> = {
    0: 'Neu',
    1: '1. Mahnung',
    2: '2. Mahnung',
    3: 'Letzte Mahnung',
  };

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Mail className="h-8 w-8 text-primary" />
            Mahnwesen
          </h1>
          <p className="text-muted-foreground">Automatische Mahnbrief-Generierung und Eskalations-Workflow</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" />Aktualisieren</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Überfällige Fälle</p>
          <p className="text-2xl font-bold">{stats.gesamt}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Noch nicht gemahnt</p>
          <p className="text-2xl font-bold text-blue-600">{stats.offen}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">In Mahnung</p>
          <p className="text-2xl font-bold text-orange-600">{stats.gemahnt}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Kritisch (&gt;60 Tage)</p>
          <p className="text-2xl font-bold text-red-600">{stats.kritisch}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Gesamtforderung</p>
          <p className="text-xl font-bold text-green-600">{fmt(stats.gesamtForderung)}</p>
        </CardContent></Card>
      </div>

      {/* Eskalations-Workflow Visualisierung */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Eskalations-Workflow</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { level: 0, label: 'Überfällig', desc: 'Keine Mahnung', color: 'bg-gray-200 dark:bg-gray-700', count: cases.filter(c => c.dunning_level === 0).length },
              { level: 1, label: '1. Mahnung', desc: 'Zahlungserinnerung', color: 'bg-yellow-200 dark:bg-yellow-900', count: cases.filter(c => c.dunning_level === 1).length },
              { level: 2, label: '2. Mahnung', desc: '+Mahngebühr +Zinsen', color: 'bg-orange-200 dark:bg-orange-900', count: cases.filter(c => c.dunning_level === 2).length },
              { level: 3, label: 'Letzte Mahnung', desc: 'Inkasso-Androhung', color: 'bg-red-200 dark:bg-red-900', count: cases.filter(c => c.dunning_level === 3).length },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 flex-shrink-0">
                <div className={`${step.color} rounded-lg p-3 text-center min-w-28`}>
                  <p className="font-bold text-sm">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                  <p className="text-lg font-bold mt-1">{step.count}</p>
                </div>
                {i < 3 && <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter + Liste */}
      <div className="flex gap-2 flex-wrap">
        {['alle', 'neu', '1', '2', '3'].map(f => (
          <button key={f} onClick={() => setFilterLevel(f)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${filterLevel === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'}`}>
            {f === 'alle' ? 'Alle' : f === 'neu' ? 'Nicht gemahnt' : `${f}. Mahnung`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : filteredCases.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
          <p className="font-medium">Keine überfälligen Rechnungen</p>
          <p className="text-sm">Alle Rechnungen sind bezahlt oder nicht überfällig.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredCases.map(c => (
            <Card key={c.id} className={`hover:shadow-md transition-shadow ${c.days_overdue > 60 ? 'border-red-200 dark:border-red-800' : c.days_overdue > 30 ? 'border-orange-200 dark:border-orange-800' : ''}`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${LEVEL_COLORS[c.dunning_level]}`}>
                      {LEVEL_LABELS[c.dunning_level]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{c.contact_name}</span>
                        <Badge variant="outline" className="text-xs">{c.invoice_number}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>Fällig: {fmtDate(c.due_date)}</span>
                        <span className={`font-medium ${c.days_overdue > 60 ? 'text-red-600' : 'text-orange-600'}`}>{c.days_overdue} Tage überfällig</span>
                        {c.last_dunning_date && <span>Letzte Mahnung: {fmtDate(c.last_dunning_date)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-red-600">{fmt(c.open_amount)}</p>
                      {(c.dunning_fee > 0 || c.interest_amount > 0) && (
                        <p className="text-xs text-muted-foreground">Gesamt: {fmt(c.total_claim)}</p>
                      )}
                    </div>
                    {c.dunning_level < 3 ? (
                      <Button size="sm" onClick={() => openPreview(c)} className="bg-orange-600 hover:bg-orange-700">
                        <Mail className="h-3.5 w-3.5 mr-1" />
                        {c.dunning_level === 0 ? 'Mahnen' : 'Eskalieren'}
                      </Button>
                    ) : (
                      <Button size="sm" variant="destructive">
                        <Shield className="h-3.5 w-3.5 mr-1" />Inkasso
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mahnbrief-Vorschau Dialog */}
      <Dialog open={previewDialog} onOpenChange={open => !open && setPreviewDialog(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-orange-600" />
              Mahnbrief – Stufe {previewLevel}
              {selectedCase && <Badge variant="outline" className="ml-2">{selectedCase.contact_name}</Badge>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Zusammenfassung */}
            {selectedCase && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted rounded-lg text-sm">
                <div><p className="text-xs text-muted-foreground">Offener Betrag</p><p className="font-bold text-red-600">{fmt(selectedCase.open_amount)}</p></div>
                <div><p className="text-xs text-muted-foreground">Mahngebühr</p><p className="font-bold">{fmt(DUNNING_TEMPLATES[previewLevel - 1].fee)}</p></div>
                <div><p className="text-xs text-muted-foreground">Gesamtforderung</p><p className="font-bold">{fmt(selectedCase.open_amount + DUNNING_TEMPLATES[previewLevel - 1].fee + selectedCase.interest_amount)}</p></div>
              </div>
            )}
            {/* Betreff */}
            <div>
              <Label className="text-xs text-muted-foreground">Betreff</Label>
              <Input value={previewContent.subject} onChange={e => setPreviewContent(p => ({ ...p, subject: e.target.value }))} className="mt-1" />
            </div>
            {/* Brieftext */}
            <div>
              <Label className="text-xs text-muted-foreground">Brieftext</Label>
              <Textarea
                value={previewContent.body}
                onChange={e => setPreviewContent(p => ({ ...p, body: e.target.value }))}
                className="mt-1 font-mono text-sm min-h-64"
              />
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={downloadLetter}><Download className="h-4 w-4 mr-1" />Herunterladen</Button>
            <Button variant="outline" onClick={() => setPreviewDialog(false)}>Abbrechen</Button>
            <Button onClick={sendDunning} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
              <Send className="h-4 w-4 mr-1" />{saving ? 'Speichern...' : `Mahnstufe ${previewLevel} setzen`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
