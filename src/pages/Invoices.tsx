import { useState, useEffect } from 'react';
import { Plus, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface Invoice {
  id: string;
  invoice_number: string;
  type: string;
  status: string;
  amount: number;
  due_date: string | null;
  issue_date: string;
  description: string | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-info/20 text-info',
  paid: 'bg-success/20 text-success',
  overdue: 'bg-destructive/20 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  draft: 'Entwurf',
  sent: 'Versendet',
  paid: 'Bezahlt',
  overdue: 'Überfällig',
  cancelled: 'Storniert',
};

export default function Invoices() {
  const { currentCompany } = useCompany();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      fetchInvoices();
    }
  }, [currentCompany]);

  const fetchInvoices = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('issue_date', { ascending: false });

    if (data) {
      setInvoices(data);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.description?.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h1 className="text-3xl font-bold mb-2">Rechnungen</h1>
          <p className="text-muted-foreground">Verwalten Sie Ihre Rechnungen</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Neue Rechnung
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechnung suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-secondary/50"
        />
      </div>

      {/* Invoices List */}
      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Laden...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Keine Rechnungen vorhanden</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{invoice.invoice_number}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {invoice.description || 'Keine Beschreibung'} • Fällig: {formatDate(invoice.due_date)}
                  </p>
                </div>
                <Badge className={statusColors[invoice.status || 'draft']}>
                  {statusLabels[invoice.status || 'draft']}
                </Badge>
                <span className="font-semibold">{formatCurrency(invoice.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
