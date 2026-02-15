import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

export default function BankCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = searchParams.get('status');
  const [syncing, setSyncing] = useState(status === 'success');
  const [syncStep, setSyncStep] = useState('Verbindung wird verarbeitet...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'success') {
      syncAfterCallback();
    }
  }, [status]);

  const syncAfterCallback = async () => {
    setSyncing(true);
    try {
      // Fetch accounts from finAPI after successful bank connection
      setSyncStep('Kontoinformationen werden abgerufen...');
      const { data: accountsData, error: accountsError } = await supabase.functions.invoke('finapi/accounts');

      if (accountsError) {
        throw new Error(`Konten konnten nicht abgerufen werden: ${accountsError.message}`);
      }

      setSyncStep('Transaktionen werden synchronisiert...');
      const { error: txError } = await supabase.functions.invoke('finapi/transactions', {
        body: {},
      });

      if (txError) {
        console.warn('Transaction sync warning:', txError.message);
      }

      setSyncing(false);
    } catch (err) {
      setSyncing(false);
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12 px-6">
          {syncing ? (
            <>
              <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
              <h2 className="text-xl font-semibold mb-2">Bankverbindung wird eingerichtet</h2>
              <p className="text-muted-foreground text-center mb-6">{syncStep}</p>
            </>
          ) : error ? (
            <>
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Fehler bei der Synchronisierung</h2>
              <p className="text-muted-foreground text-center mb-6">{error}</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate('/bankverbindung')}>
                  Erneut versuchen
                </Button>
                <Button variant="ghost" onClick={() => navigate('/bankkonten')}>
                  Zurück
                </Button>
              </div>
            </>
          ) : status === 'success' ? (
            <>
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <CheckCircle className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Bank erfolgreich verbunden!</h2>
              <p className="text-muted-foreground text-center mb-6">
                Ihre Bankverbindung wurde hergestellt und die Kontoinformationen wurden importiert.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => navigate('/bankkonten')}>
                  Zu den Bankkonten
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Verbindung abgebrochen</h2>
              <p className="text-muted-foreground text-center mb-6">
                Die Bankverbindung wurde nicht hergestellt. Sie können es jederzeit erneut versuchen.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate('/bankverbindung')}>
                  Erneut versuchen
                </Button>
                <Button variant="ghost" onClick={() => navigate('/bankkonten')}>
                  Zurück
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
