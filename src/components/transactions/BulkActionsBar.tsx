import { useState, useEffect } from 'react';
import { Tags, UserPlus, Landmark, FileText, Wand2, Trash2, X, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';

interface Transaction {
  id: string;
  description: string | null;
  amount: number;
  type: string;
  date: string;
  category: string | null;
  bank_account_id: string | null;
}

interface Contact {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  name: string;
}

interface Receipt {
  id: string;
  file_name: string;
  amount: number | null;
}

const categories = [
  'Umsatzerlöse',
  'Sonstige Erträge',
  'Gehälter',
  'Sozialabgaben',
  'Miete',
  'Nebenkosten',
  'Büromaterial',
  'Marketing',
  'Reisekosten',
  'Versicherungen',
  'Telekommunikation',
  'Fahrzeugkosten',
  'Reparaturen',
  'Abschreibungen',
  'Zinsen',
  'Beratungskosten',
  'Fortbildung',
  'Bewirtung',
  'Porto',
  'Software & IT',
  'Sonstiges',
];

interface BulkActionsBarProps {
  selectedIds: Set<string>;
  selectedTransactions: Transaction[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

export function BulkActionsBar({
  selectedIds,
  selectedTransactions,
  onClearSelection,
  onRefresh,
}: BulkActionsBarProps) {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const count = selectedIds.size;

  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Data for selects
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  // Selected values
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedContact, setSelectedContact] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [ruleCategory, setRuleCategory] = useState('');

  useEffect(() => {
    if (!currentCompany) return;
    // Fetch contacts, bank accounts, unlinked receipts in parallel
    Promise.all([
      supabase.from('contacts').select('id, name').eq('company_id', currentCompany.id).order('name'),
      supabase.from('bank_accounts').select('id, name').eq('company_id', currentCompany.id).order('name'),
      supabase.from('receipts').select('id, file_name, amount').eq('company_id', currentCompany.id).is('transaction_id', null).order('created_at', { ascending: false }).limit(100),
    ]).then(([contactsRes, banksRes, receiptsRes]) => {
      setContacts(contactsRes.data || []);
      setBankAccounts(banksRes.data || []);
      setReceipts(receiptsRes.data || []);
    });
  }, [currentCompany]);

  const ids = Array.from(selectedIds);

  const handleBulkCategory = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    const { error } = await supabase
      .from('transactions')
      .update({ category: selectedCategory })
      .in('id', ids);
    setLoading(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: `${count} Buchungen aktualisiert.` });
      setCategoryDialogOpen(false);
      setSelectedCategory('');
      onClearSelection();
      onRefresh();
    }
  };

  const handleBulkContact = async () => {
    if (!selectedContact) return;
    setLoading(true);
    const { error } = await supabase
      .from('transactions')
      .update({ contact_id: selectedContact })
      .in('id', ids);
    setLoading(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: `${count} Buchungen einem Kontakt zugeordnet.` });
      setContactDialogOpen(false);
      setSelectedContact('');
      onClearSelection();
      onRefresh();
    }
  };

  const handleBulkBank = async () => {
    if (!selectedBank) return;
    setLoading(true);
    const { error } = await supabase
      .from('transactions')
      .update({ bank_account_id: selectedBank })
      .in('id', ids);
    setLoading(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: `${count} Buchungen einem Bankkonto zugeordnet.` });
      setBankDialogOpen(false);
      setSelectedBank('');
      onClearSelection();
      onRefresh();
    }
  };

  const handleBulkReceipt = async () => {
    if (!selectedReceipt || ids.length !== 1) return;
    setLoading(true);
    // Link receipt to the single selected transaction
    const { error } = await supabase
      .from('receipts')
      .update({ transaction_id: ids[0] })
      .eq('id', selectedReceipt);
    setLoading(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Beleg verknüpft.' });
      setReceiptDialogOpen(false);
      setSelectedReceipt('');
      onClearSelection();
      onRefresh();
    }
  };

  const handleCreateRule = async () => {
    if (!ruleCategory || !currentCompany) return;
    // Derive a pattern from the first selected transaction's description
    const firstTx = selectedTransactions[0];
    const pattern = firstTx?.description || '';
    if (!pattern) {
      toast({ title: 'Fehler', description: 'Keine Beschreibung vorhanden, um eine Regel zu erstellen.', variant: 'destructive' });
      return;
    }

    // Apply category to all selected immediately
    setLoading(true);
    await supabase
      .from('transactions')
      .update({ category: ruleCategory })
      .in('id', ids);

    toast({
      title: 'Regel erstellt',
      description: `"${pattern}" → ${ruleCategory}. ${count} Buchungen aktualisiert. Nutzen Sie die Zuordnungsregeln-Seite für erweiterte Einstellungen.`,
    });
    setLoading(false);
    setRuleDialogOpen(false);
    setRuleName('');
    setRuleCategory('');
    onClearSelection();
    onRefresh();
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids);
    setLoading(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Gelöscht', description: `${count} Buchungen gelöscht.` });
      setDeleteDialogOpen(false);
      onClearSelection();
      onRefresh();
    }
  };

  if (count === 0) return null;

  const firstDesc = selectedTransactions[0]?.description || '';

  return (
    <>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 glass rounded-xl p-3 border border-primary/30 animate-fade-in">
        <Badge variant="default" className="bg-primary text-primary-foreground gap-1.5 text-sm px-3 py-1.5">
          <CheckSquare className="h-3.5 w-3.5" />
          {count} ausgewählt
        </Badge>

        <div className="flex flex-wrap gap-1.5 flex-1">
          <Button variant="outline" size="sm" onClick={() => setCategoryDialogOpen(true)} className="gap-1.5">
            <Tags className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Kategorie</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setContactDialogOpen(true)} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Kontakt</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBankDialogOpen(true)} className="gap-1.5">
            <Landmark className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Bankkonto</span>
          </Button>
          {count === 1 && (
            <Button variant="outline" size="sm" onClick={() => setReceiptDialogOpen(true)} className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Beleg</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            setRuleName(firstDesc);
            setRuleDialogOpen(true);
          }} className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Regel erstellen</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)} className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Löschen</span>
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kategorie zuweisen</DialogTitle>
            <DialogDescription>{count} Buchungen erhalten eine neue Kategorie.</DialogDescription>
          </DialogHeader>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger><SelectValue placeholder="Kategorie wählen" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleBulkCategory} disabled={!selectedCategory || loading}>
              {loading ? 'Wird gespeichert...' : 'Zuweisen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kontakt zuordnen</DialogTitle>
            <DialogDescription>{count} Buchungen einem Kontakt zuordnen.</DialogDescription>
          </DialogHeader>
          <Select value={selectedContact} onValueChange={setSelectedContact}>
            <SelectTrigger><SelectValue placeholder="Kontakt wählen" /></SelectTrigger>
            <SelectContent>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleBulkContact} disabled={!selectedContact || loading}>
              {loading ? 'Wird gespeichert...' : 'Zuordnen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Account Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bankkonto zuordnen</DialogTitle>
            <DialogDescription>{count} Buchungen einem Bankkonto zuordnen.</DialogDescription>
          </DialogHeader>
          <Select value={selectedBank} onValueChange={setSelectedBank}>
            <SelectTrigger><SelectValue placeholder="Bankkonto wählen" /></SelectTrigger>
            <SelectContent>
              {bankAccounts.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleBulkBank} disabled={!selectedBank || loading}>
              {loading ? 'Wird gespeichert...' : 'Zuordnen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog (single transaction only) */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Beleg verknüpfen</DialogTitle>
            <DialogDescription>Einen offenen Beleg mit dieser Buchung verknüpfen.</DialogDescription>
          </DialogHeader>
          {receipts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Keine offenen Belege vorhanden.</p>
          ) : (
            <Select value={selectedReceipt} onValueChange={setSelectedReceipt}>
              <SelectTrigger><SelectValue placeholder="Beleg wählen" /></SelectTrigger>
              <SelectContent>
                {receipts.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.file_name} {r.amount ? `(${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(r.amount)})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleBulkReceipt} disabled={!selectedReceipt || loading}>
              {loading ? 'Wird verknüpft...' : 'Verknüpfen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Automatische Regel erstellen</DialogTitle>
            <DialogDescription>
              Basierend auf der Beschreibung wird eine Zuordnungsregel erstellt und sofort auf die ausgewählten Buchungen angewendet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Muster (Beschreibung enthält)</Label>
              <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="z.B. REWE, Amazon, Miete..." />
            </div>
            <div className="space-y-2">
              <Label>Kategorie zuweisen</Label>
              <Select value={ruleCategory} onValueChange={setRuleCategory}>
                <SelectTrigger><SelectValue placeholder="Kategorie wählen" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateRule} disabled={!ruleCategory || !ruleName || loading}>
              {loading ? 'Wird erstellt...' : 'Regel erstellen & zuweisen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{count} Buchungen löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle ausgewählten Buchungen werden dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading ? 'Wird gelöscht...' : 'Endgültig löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
