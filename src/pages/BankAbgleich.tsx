/**
 * BankAbgleich – Bankabgleich-Assistent
 * Automatisches Matching von Banktransaktionen mit offenen Rechnungen
 * Ähnlich wie in lexoffice/DATEV – ein Kernfeature für professionelle Buchhaltung
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Landmark, CheckCircle2, AlertCircle, Link2, Unlink, Search, RefreshCw,
  ChevronRight, ArrowRight, Banknote, FileText, Zap, Download, Filter
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('de-DE');

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  matched: boolean;
  invoice_id?: string;
  invoice_number?: string;
  contact_name?: string;
}

interface OpenInvoice {
  id: string;
  invoice_number: string;
  contact_name: string;
  total_amount: number;
  paid_amount: number;
  open_amount: number;
  due_date: string;
  issue_date: string;
}

interface MatchSuggestion {
  transaction: BankTransaction;
  invoice: OpenInvoice;
  confidence: number; // 0-100
  reason: string;
}

function calculateMatchConfidence(tx: BankTransaction, inv: OpenInvoice): { confidence: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Betrag-Match (wichtigstes Kriterium)
  const amountDiff = Math.abs(Math.abs(tx.amount) - inv.open_amount);
  if (amountDiff < 0.01) { score += 50; reasons.push('Betrag exakt'); }
  else if (amountDiff < 1) { score += 30; reasons.push('Betrag fast identisch'); }
  else if (amountDiff / inv.open_amount < 0.05) { score += 15; reasons.push('Betrag ähnlich'); }

  // Kontaktname in Beschreibung
  if (inv.contact_name && tx.description.toLowerCase().includes(inv.contact_name.toLowerCase().split(' ')[0])) {
    score += 25; reasons.push('Kontaktname erkannt');
  }

  // Rechnungsnummer in Beschreibung
  if (inv.invoice_number && tx.description.includes(inv.invoice_number.replace(/[^0-9]/g, ''))) {
    score += 20; reasons.push('Rechnungsnummer erkannt');
  }

  // Datum-Nähe (Zahlung nach Fälligkeit)
  const txDate = new Date(tx.date);
  const dueDate = new Date(inv.due_date);
  const daysDiff = Math.abs((txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff <= 3) { score += 5; reasons.push('Datum nahe Fälligkeit'); }

  return { confidence: Math.min(100, score), reason: reasons.join(', ') || 'Kein Treffer' };
}

export default function BankAbgleich() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'alle' | 'offen' | 'abgeglichen'>('offen');
  const [matchDialog, setMatchDialog] = useState<{ tx: BankTransaction; inv: OpenInvoice | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoMatchRunning, setAutoMatchRunning] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Banktransaktionen der letzten 30 Tage
      const { data: txData } = await supabase
        .from('transactions')
        .select('id, date, description, amount, type, invoice_id')
        .eq('company_id', currentCompany.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(200);

      // Offene Rechnungen
      const { data: invData } = await supabase
        .from('invoices')
        .select('id, invoice_number, contact_name, total_amount, paid_amount, due_date, issue_date, status')
        .eq('company_id', currentCompany.id)
        .in('status', ['sent', 'overdue', 'partial', 'dunning'])
        .order('due_date', { ascending: true });

      const txList: BankTransaction[] = (txData || []).map(t => ({
        id: t.id,
        date: t.date,
        description: t.description || '',
        amount: t.amount || 0,
        type: t.type as 'income' | 'expense',
        matched: !!t.invoice_id,
        invoice_id: t.invoice_id || undefined,
      }));

      const invList: OpenInvoice[] = (invData || []).map(i => ({
        id: i.id,
        invoice_number: i.invoice_number || '-',
        contact_name: i.contact_name || 'Unbekannt',
        total_amount: i.total_amount || 0,
        paid_amount: i.paid_amount || 0,
        open_amount: (i.total_amount || 0) - (i.paid_amount || 0),
        due_date: i.due_date || i.issue_date,
        issue_date: i.issue_date,
      }));

      setTransactions(txList);
      setInvoices(invList);

      // Auto-Vorschläge berechnen
      const newSuggestions: MatchSuggestion[] = [];
      txList.filter(t => !t.matched && t.type === 'income').forEach(tx => {
        invList.forEach(inv => {
          const { confidence, reason } = calculateMatchConfidence(tx, inv);
          if (confidence >= 40) {
            newSuggestions.push({ transaction: tx, invoice: inv, confidence, reason });
          }
        });
      });
      newSuggestions.sort((a, b) => b.confidence - a.confidence);
      setSuggestions(newSuggestions.slice(0, 20));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    if (filterStatus === 'offen' && tx.matched) return false;
    if (filterStatus === 'abgeglichen' && !tx.matched) return false;
    if (searchQuery && !tx.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }), [transactions, filterStatus, searchQuery]);

  const confirmMatch = async (txId: string, invId: string, amount: number) => {
    setSaving(true);
    try {
      // Transaktion mit Rechnung verknüpfen
      await supabase.from('transactions').update({ invoice_id: invId }).eq('id', txId);

      // Rechnung als bezahlt/teilbezahlt markieren
      const inv = invoices.find(i => i.id === invId);
      if (inv) {
        const newPaid = inv.paid_amount + Math.abs(amount);
        const newStatus = newPaid >= inv.total_amount ? 'paid' : 'partial';
        await supabase.from('invoices').update({
          paid_amount: newPaid,
          status: newStatus,
          payment_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
        }).eq('id', invId);
      }

      toast.success('Transaktion erfolgreich zugeordnet');
      setMatchDialog(null);
      fetchData();
    } catch (e) {
      toast.error('Fehler beim Zuordnen');
    } finally {
      setSaving(false);
    }
  };

  const autoMatch = async () => {
    setAutoMatchRunning(true);
    let matched = 0;
    try {
      const highConfidence = suggestions.filter(s => s.confidence >= 80);
      for (const s of highConfidence) {
        await confirmMatch(s.transaction.id, s.invoice.id, s.transaction.amount);
        matched++;
      }
      toast.success(`${matched} Transaktionen automatisch zugeordnet`);
    } catch (e) {
      toast.error('Fehler beim Auto-Abgleich');
    } finally {
      setAutoMatchRunning(false);
    }
  };

  const unmatch = async (txId: string) => {
    try {
      await supabase.from('transactions').update({ invoice_id: null }).eq('id', txId);
      toast.success('Zuordnung aufgehoben');
      fetchData();
    } catch (e) {
      toast.error('Fehler');
    }
  };

  const stats = useMemo(() => ({
    total: transactions.length,
    matched: transactions.filter(t => t.matched).length,
    unmatched: transactions.filter(t => !t.matched && t.type === 'income').length,
    highConfidence: suggestions.filter(s => s.confidence >= 80).length,
  }), [transactions, suggestions]);

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Landmark className="h-8 w-8 text-primary" />
            Bankabgleich
          </h1>
          <p className="text-muted-foreground">Automatisches Matching von Banktransaktionen mit offenen Rechnungen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" />Aktualisieren</Button>
          {stats.highConfidence > 0 && (
            <Button size="sm" onClick={autoMatch} disabled={autoMatchRunning} className="bg-green-600 hover:bg-green-700">
              <Zap className="h-4 w-4 mr-1" />{autoMatchRunning ? 'Läuft...' : `Auto-Abgleich (${stats.highConfidence})`}
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Transaktionen (30 Tage)</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Abgeglichen</p>
          <p className="text-2xl font-bold text-green-600">{stats.matched}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Offen (Einnahmen)</p>
          <p className="text-2xl font-bold text-orange-600">{stats.unmatched}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Auto-Vorschläge ≥80%</p>
          <p className="text-2xl font-bold text-blue-600">{stats.highConfidence}</p>
        </CardContent></Card>
      </div>

      {/* Vorschläge */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Automatische Zuordnungsvorschläge
              <Badge className="ml-auto">{suggestions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.slice(0, 8).map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{s.transaction.description}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{s.invoice.contact_name} ({s.invoice.invoice_number})</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{fmt(Math.abs(s.transaction.amount))} ↔ {fmt(s.invoice.open_amount)}</span>
                    <span className="text-muted-foreground">{s.reason}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className={`text-xs font-bold px-2 py-1 rounded-full ${s.confidence >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : s.confidence >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'}`}>
                    {s.confidence}%
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setMatchDialog({ tx: s.transaction, inv: s.invoice })}>
                    <Link2 className="h-3.5 w-3.5 mr-1" />Zuordnen
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transaktionsliste */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Transaktionen (letzte 30 Tage)</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 h-8 w-48" placeholder="Suchen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
                <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle</SelectItem>
                  <SelectItem value="offen">Offen</SelectItem>
                  <SelectItem value="abgeglichen">Abgeglichen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Landmark className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Keine Transaktionen gefunden</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTransactions.map(tx => (
                <div key={tx.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${tx.matched ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'hover:bg-muted/50'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {tx.matched ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(tx.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(Math.abs(tx.amount))}
                    </span>
                    {tx.matched ? (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => unmatch(tx.id)}>
                        <Unlink className="h-3 w-3 mr-1" />Aufheben
                      </Button>
                    ) : tx.type === 'income' ? (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMatchDialog({ tx, inv: null })}>
                        <Link2 className="h-3 w-3 mr-1" />Zuordnen
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match-Dialog */}
      <Dialog open={!!matchDialog} onOpenChange={open => !open && setMatchDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Transaktion zuordnen</DialogTitle></DialogHeader>
          {matchDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">{matchDialog.tx.description}</p>
                <p className="text-sm text-muted-foreground">{fmtDate(matchDialog.tx.date)} · {fmt(Math.abs(matchDialog.tx.amount))}</p>
              </div>
              <p className="text-sm font-medium">Wählen Sie die zugehörige Rechnung:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {invoices.map(inv => {
                  const { confidence } = calculateMatchConfidence(matchDialog.tx, inv);
                  return (
                    <button
                      key={inv.id}
                      onClick={() => setMatchDialog(prev => prev ? { ...prev, inv } : null)}
                      className={`w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors ${matchDialog.inv?.id === inv.id ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{inv.contact_name} – {inv.invoice_number}</p>
                          <p className="text-xs text-muted-foreground">Offen: {fmt(inv.open_amount)} · Fällig: {fmtDate(inv.due_date)}</p>
                        </div>
                        {confidence >= 40 && (
                          <Badge variant={confidence >= 80 ? 'default' : 'outline'} className="text-xs">{confidence}% Match</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialog(null)}>Abbrechen</Button>
            <Button
              disabled={!matchDialog?.inv || saving}
              onClick={() => matchDialog?.inv && confirmMatch(matchDialog.tx.id, matchDialog.inv.id, matchDialog.tx.amount)}
            >
              <Link2 className="h-4 w-4 mr-1" />{saving ? 'Speichern...' : 'Zuordnung bestätigen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
