import { useState, useEffect } from 'react';
import { Building2, CheckCircle2, XCircle, RefreshCw, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { SUPPORTED_BANKS, SupportedBank, BankConnection, syncAccount, checkFinAPIStatus } from '@/services/finapi';
import { BankConnectDialog } from '@/components/bank/BankConnectDialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function BankConnect() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [connections, setConnections] = useState<Record<string, BankConnection>>({});
  const [selectedBank, setSelectedBank] = useState<SupportedBank | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [finAPIConfigured, setFinAPIConfigured] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      loadConnections();
      checkFinAPIConfig();
    }
  }, [currentCompany]);

  const checkFinAPIConfig = async () => {
    const status = await checkFinAPIStatus();
    setFinAPIConfigured(status.configured);
  };

  const loadConnections = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', currentCompany.id);

      if (data) {
        const connMap: Record<string, BankConnection> = {};
        data.forEach((account: any) => {
          // Map bank accounts to connections by matching bank name to supported bank codes
          const matchedBank = SUPPORTED_BANKS.find(
            b => account.name?.toLowerCase().includes(b.name.toLowerCase())
          );
          const bankCode = matchedBank?.code || account.id;
          connMap[bankCode] = {
            id: account.id,
            bankName: account.name || 'Unbekannte Bank',
            iban: account.iban || '',
            lastSync: account.updated_at || new Date().toISOString(),
            status: 'active',
          };
        });
        setConnections(connMap);
      }
    } catch (error) {
      console.error('Error loading bank connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectClick = (bank: SupportedBank) => {
    setSelectedBank(bank);
    setDialogOpen(true);
  };

  const handleConnectionSuccess = () => {
    // Reload connections from DB after successful connection
    loadConnections();
  };

  const handleSync = async (bankCode: string) => {
    const connection = connections[bankCode];
    if (!connection) return;

    setSyncingId(bankCode);
    try {
      await syncAccount(connection.id);
      await loadConnections();
      toast({
        title: 'Synchronisiert',
        description: `${connection.bankName} wurde aktualisiert`,
      });
    } catch (error) {
      toast({
        title: 'Sync fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Bitte versuchen Sie es später erneut',
        variant: 'destructive',
      });
    } finally {
      setSyncingId(null);
    }
  };

  const formatLastSync = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: BankConnection['status']) => {
    switch (status) {
      case 'active':
        return (
         <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Verbunden
          </Badge>
        );
      case 'expired':
        return (
         <Badge variant="outline" className="text-warning border-warning/50">
            Erneuerung nötig
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Fehler
          </Badge>
        );
    }
  };

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Bitte wählen Sie eine Firma aus.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Bankkonten verbinden</h1>
        <p className="text-muted-foreground">
          Verbinden Sie Ihre Bankkonten für automatischen Kontoabruf
        </p>
      </div>

      {/* finAPI Status Warning */}
      {!finAPIConfigured && (
        <div className="rounded-xl p-4 bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          finAPI ist nicht konfiguriert. Bitte hinterlegen Sie die API-Schlüssel (FINAPI_CLIENT_ID, FINAPI_CLIENT_SECRET) in den Supabase Edge Function Einstellungen.
        </div>
      )}

      {/* Info Box */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">Sichere PSD2-Verbindung</h3>
            <p className="text-sm text-muted-foreground">
              Ihre Bankdaten werden über die regulierte PSD2-Schnittstelle abgerufen.
              Wir haben keinen Zugriff auf Ihre Zugangsdaten - die Autorisierung erfolgt direkt bei Ihrer Bank.
            </p>
          </div>
        </div>
      </div>

      {/* Bank List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Unterstützte Banken</h2>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Lade Bankverbindungen...
          </div>
        ) : (
          <div className="grid gap-3">
            {SUPPORTED_BANKS.map((bank) => {
              const connection = connections[bank.code];
              const isSyncing = syncingId === bank.code;

              return (
                <div
                  key={bank.code}
                  className="glass rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    {/* Bank Logo/Initial */}
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">
                        {bank.name.charAt(0)}
                      </span>
                    </div>

                    {/* Bank Info */}
                    <div>
                      <p className="font-semibold">{bank.name}</p>
                      {connection ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-mono">{connection.iban}</span>
                          <span>•</span>
                          <span>Zuletzt: {formatLastSync(connection.lastSync)}</span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nicht verbunden</p>
                      )}
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-3">
                    {connection ? (
                      <>
                        {getStatusBadge(connection.status)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(bank.code)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-2 hidden sm:inline">Synchronisieren</span>
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => handleConnectClick(bank)} disabled={!finAPIConfigured}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Bank verbinden
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect Dialog */}
      <BankConnectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bank={selectedBank}
        onSuccess={handleConnectionSuccess}
      />
    </div>
  );
}
