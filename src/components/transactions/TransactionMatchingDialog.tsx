import { useState, useEffect } from 'react';
import { Wand2, CheckCircle2, XCircle, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';

interface MatchResult {
  transaction_id: string;
  invoice_id: string;
  confidence: number;
  reason: string;
}

interface EnrichedMatch extends MatchResult {
  transaction_description: string;
  transaction_amount: number;
  transaction_date: string;
  invoice_number: string;
  invoice_amount: number;
  invoice_due_date: string | null;
}

interface TransactionMatchingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TransactionMatchingDialog({
  open,
  onOpenChange,
  onSuccess,
}: TransactionMatchingDialogProps) {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'idle' | 'results' | 'done'>('idle');

  useEffect(() => {
    if (open && step === 'idle') {
      runMatching();
    }
  }, [open]);

  const runMatching = async () => {
    if (!currentCompany) return;
    setLoading(true);
    setStep('idle');

    try {
      const { data, error } = await supabase.functions.invoke('auto-match-transactions', {
        body: { company_id: currentCompany.id, apply: false },
      });

      if (error) throw new Error(error.message);

      if (!data?.matches?.length) {
        toast({
          title: 'Keine Matches gefunden',
          description: 'Alle Transaktionen sind bereits zugeordnet oder es gibt keine offenen Rechnungen.',
        });
        onOpenChange(false);
        return;
      }

      // Transaktionen und Rechnungen für Anzeige laden
      const txIds = data.matches.map((m: MatchResult) => m.transaction_id);
      const invIds = data.matches.map((m: MatchResult) => m.invoice_id);

      const [{ data: txData }, { data: invData }] = await Promise.all([
        supabase.from('transactions').select('id, description, amount, date').in('id', txIds),
        supabase.from('invoices').select('id, invoice_number, amount, due_date').in('id', invIds),
      ]);

      const txMap = new Map(txData?.map((t: any) => [t.id, t]) ?? []);
      const invMap = new Map(invData?.map((i: any) => [i.id, i]) ?? []);

      const enriched: EnrichedMatch[] = data.matches.map((m: MatchResult) => {
        const tx = txMap.get(m.transaction_id) as any;
        const inv = invMap.get(m.invoice_id) as any;
        return {
          ...m,
          transaction_description: tx?.description || '-',
          transaction_amount: tx?.amount || 0,
          transaction_date: tx?.date || '',
          invoice_number: inv?.invoice_number || '-',
          invoice_amount: inv?.amount || 0,
          invoice_due_date: inv?.due_date || null,
        };
      });

      setMatches(enriched);
      // Alle Matches mit Konfidenz ≥70 vorselektieren
      setSelectedMatches(new Set(enriched.filter(m => m.confidence >= 70).map(m => m.transaction_id)));
      setStep('results');
    } catch (error) {
      console.error('Matching error:', error);
      toast({
        title: 'Fehler beim Matching',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!currentCompany || selectedMatches.size === 0) return;
    setApplying(true);

    try {
      const toApply = matches.filter(m => selectedMatches.has(m.transaction_id));

      for (const match of toApply) {
        // Rechnung als bezahlt markieren
        await supabase
          .from('invoices')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', match.invoice_id);

        // Transaktion kategorisieren
        await supabase
          .from('transactions')
          .update({ category: 'Einnahmen', updated_at: new Date().toISOString() })
          .eq('id', match.transaction_id);
      }

      toast({
        title: `${toApply.length} Matches angewendet`,
        description: `${toApply.length} Rechnungen wurden als bezahlt markiert.`,
      });

      setStep('done');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Matches konnten nicht angewendet werden.',
        variant: 'destructive',
      });
    } finally {
      setApplying(false);
    }
  };

  const toggleMatch = (transactionId: string) => {
    setSelectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return <Badge className="bg-success/10 text-success border-success/20">Sehr sicher ({confidence}%)</Badge>;
    if (confidence >= 60) return <Badge className="bg-primary/10 text-primary border-primary/20">Sicher ({confidence}%)</Badge>;
    return <Badge variant="outline" className="text-warning border-warning/50">Unsicher ({confidence}%)</Badge>;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('de-DE') : '-';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Automatisches Transaktions-Matching
          </DialogTitle>
          <DialogDescription>
            Die KI gleicht Ihre Bankbuchungen mit offenen Rechnungen ab und schlägt Zuordnungen vor.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Analysiere Transaktionen und Rechnungen...</p>
          </div>
        ) : step === 'results' && matches.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{matches.length} mögliche Matches gefunden</span>
              <span>{selectedMatches.size} ausgewählt</span>
            </div>

            <div className="space-y-3">
              {matches.map((match) => {
                const isSelected = selectedMatches.has(match.transaction_id);
                return (
                  <div
                    key={match.transaction_id}
                    className={`glass rounded-xl p-4 cursor-pointer transition-all border-2 ${
                      isSelected ? 'border-primary/50 bg-primary/5' : 'border-transparent'
                    }`}
                    onClick={() => toggleMatch(match.transaction_id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`mt-1 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        }`}>
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Transaktion */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Buchung</span>
                          </div>
                          <p className="font-medium text-sm truncate">{match.transaction_description}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(match.transaction_date)} · {formatCurrency(match.transaction_amount)}
                          </p>

                          {/* Pfeil */}
                          <div className="flex items-center gap-2 my-2">
                            <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                          </div>

                          {/* Rechnung */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rechnung</span>
                          </div>
                          <p className="font-medium text-sm">{match.invoice_number}</p>
                          <p className="text-xs text-muted-foreground">
                            Fällig: {formatDate(match.invoice_due_date)} · {formatCurrency(match.invoice_amount)}
                          </p>

                          {/* Grund */}
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Grund: {match.reason}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {getConfidenceBadge(match.confidence)}
                      </div>
                    </div>

                    {/* Konfidenz-Balken */}
                    <Progress value={match.confidence} className="mt-3 h-1" />
                  </div>
                );
              })}
            </div>

            {matches.some(m => m.confidence < 60) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-muted-foreground">
                  Matches mit niedriger Konfidenz sind nicht vorselektiert. Prüfen Sie diese manuell.
                </p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          {step === 'results' && (
            <Button
              onClick={handleApply}
              disabled={applying || selectedMatches.size === 0}
            >
              {applying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird angewendet...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {selectedMatches.size} Matches anwenden
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
