import { useState, useEffect } from 'react';
import { Plus, Building2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface BankAccount {
  id: string;
  name: string;
  iban: string | null;
  bic: string | null;
  balance: number;
  currency: string;
}

export default function BankAccounts() {
  const { currentCompany } = useCompany();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      fetchAccounts();
    }
  }, [currentCompany]);

  const fetchAccounts = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('name');

    if (data) {
      setAccounts(data);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatIBAN = (iban: string | null) => {
    if (!iban) return '-';
    return iban.replace(/(.{4})/g, '$1 ').trim();
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Bitte wählen Sie eine Firma aus.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Bankkonten</h1>
          <p className="text-muted-foreground">Verwalten Sie Ihre Bankverbindungen</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Konto hinzufügen
        </Button>
      </div>

      {/* Total Balance Card */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-xl bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Gesamtguthaben</p>
            <p className="text-3xl font-bold">{formatCurrency(totalBalance)}</p>
          </div>
        </div>
      </div>

      {/* Bank Accounts */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Laden...</div>
      ) : accounts.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">Keine Bankkonten vorhanden</p>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Erstes Bankkonto hinzufügen
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="glass rounded-xl p-6 hover:bg-secondary/30 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{account.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {account.bic || 'Kein BIC'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IBAN</span>
                  <span className="font-mono">{formatIBAN(account.iban)}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-border">
                  <span className="text-muted-foreground">Kontostand</span>
                  <span className={`text-xl font-bold ${Number(account.balance) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(Number(account.balance), account.currency)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
