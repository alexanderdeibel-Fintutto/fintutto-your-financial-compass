import { useState, useEffect } from 'react';
import { Plus, Search, Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface Receipt {
  id: string;
  file_name: string;
  file_type: string | null;
  amount: number | null;
  date: string;
  description: string | null;
}

export default function Receipts() {
  const { currentCompany } = useCompany();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      fetchReceipts();
    }
  }, [currentCompany]);

  const fetchReceipts = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('receipts')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('date', { ascending: false });

    if (data) {
      setReceipts(data);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const filteredReceipts = receipts.filter(
    (r) =>
      r.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h1 className="text-3xl font-bold mb-2">Belege</h1>
          <p className="text-muted-foreground">Verwalten Sie Ihre Belege und Dokumente</p>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Beleg hochladen
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Beleg suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-secondary/50"
        />
      </div>

      {/* Receipts Grid */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Laden...</div>
      ) : filteredReceipts.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">Keine Belege vorhanden</p>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Ersten Beleg hochladen
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredReceipts.map((receipt) => (
            <div
              key={receipt.id}
              className="glass rounded-xl p-4 hover:bg-secondary/30 transition-colors cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <FolderOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{receipt.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(receipt.date)}
                  </p>
                  {receipt.amount && (
                    <p className="text-sm font-semibold mt-1 text-primary">
                      {formatCurrency(receipt.amount)}
                    </p>
                  )}
                </div>
              </div>
              {receipt.description && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                  {receipt.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
