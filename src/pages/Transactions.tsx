import { useState, useEffect } from 'react';
import { Plus, Search, Filter, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface Transaction {
  id: string;
  description: string | null;
  amount: number;
  type: string;
  date: string;
  category: string | null;
}

export default function Transactions() {
  const { currentCompany } = useCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      fetchTransactions();
    }
  }, [currentCompany]);

  const fetchTransactions = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('date', { ascending: false });

    if (data) {
      setTransactions(data);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const filteredTransactions = transactions.filter(
    (t) =>
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold mb-2">Buchungen</h1>
          <p className="text-muted-foreground">Verwalten Sie Ihre Transaktionen</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Neue Buchung
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50"
          />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Transactions List */}
      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Laden...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Keine Buchungen gefunden
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors cursor-pointer"
              >
                <div
                  className={`p-2 rounded-lg ${
                    transaction.type === 'income'
                      ? 'bg-success/10 text-success'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {transaction.type === 'income' ? (
                    <ArrowDownLeft className="h-5 w-5" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {transaction.description || 'Ohne Beschreibung'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {transaction.category || 'Sonstiges'} • {formatDate(transaction.date)}
                  </p>
                </div>
                <span
                  className={`font-semibold ${
                    transaction.type === 'income' ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(Math.abs(transaction.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
