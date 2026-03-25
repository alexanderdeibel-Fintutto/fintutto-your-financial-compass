import { useState, useEffect } from "react";
import { Building2, CheckCircle2, RefreshCw, Plus, Loader2, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { BankConnectDialog } from "@/components/bank/BankConnectDialog";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface BankAccount { id: string; name: string; iban: string | null; bic: string | null; balance: number | null; currency: string | null; created_at: string; updated_at: string | null; }

export default function BankConnect() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [finapiStatus, setFinapiStatus] = useState<{ configured: boolean; connected: boolean; sandbox?: boolean } | null>(null);

  useEffect(() => { if (currentCompany) { fetchAccounts(); checkFinapiStatus(); } }, [currentCompany]);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data } = await supabase.from("bank_accounts").select("*").eq("company_id", currentCompany.id).order("created_at", { ascending: true });
    if (data) setAccounts(data);
    setLoading(false);
  };

  const checkFinapiStatus = async () => {
    try {
      const { data } = await supabase.functions.invoke("finapi", { body: { action: "status" } });
      setFinapiStatus(data);
    } catch { setFinapiStatus({ configured: false, connected: false }); }
  };

  const handleSync = async (account: BankAccount) => {
    setSyncingId(account.id);
    try {
      const { data, error } = await supabase.functions.invoke("finapi", { body: { action: "transactions", from: new Date(Date.now() - 90*24*60*60*1000).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] } });
      if (error) throw new Error(error.message);
      if (data?.transactions?.length > 0) {
        await supabase.from("transactions").insert(txToInsert);
        toast({ title: "Synchronisiert", description: data.transactions.length + " Transaktionen importiert" });
      } else { toast({ title: "Keine neuen Transaktionen", description: "Alle Buchungen sind aktuell." }); }
      await supabase.from("bank_accounts").update({ updated_at: new Date().toISOString() }).eq("id", account.id);
    } catch (error) {
      toast({ title: "Sync fehlgeschlagen", description: "Bitte nutzen Sie den PDF-Import unter Bankkonten.", variant: "destructive" });
    } finally { setSyncingId(null); fetchAccounts(); }
  };

  const handleDelete = async (accountId: string) => {
    setDeletingId(accountId);
    try {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", accountId);
      if (error) throw error;
      toast({ title: "Konto entfernt" });
      fetchAccounts();
    } catch { toast({ title: "Fehler", variant: "destructive" }); }
    finally { setDeletingId(null); }
  };

  const formatIBAN = (iban: string | null) => iban ? iban.replace(/(.{4})/g, " ").trim() : "-";
  const formatCurrency = (amount: number | null, currency: string | null = "EUR") => amount === null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(amount);
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Noch nie";


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Bankkonten verbinden</h1>
          <p className="text-muted-foreground">Verbinden Sie Ihre Bankkonten — {currentCompany.name}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Konto hinzufügen</Button>
      </div>

      {finapiStatus !== null && (
        <div className={"glass rounded-xl p-4 flex items-start gap-4 " + (finapiStatus.connected ? "border border-success/30" : "border border-warning/30")}>
          <div className={"p-2 rounded-lg " + (finapiStatus.connected ? "bg-success/10" : "bg-warning/10")}>
            {finapiStatus.connected ? <CheckCircle2 className="h-5 w-5 text-success" /> : <AlertCircle className="h-5 w-5 text-warning" />}
          </div>
          <div>
            <p className="font-medium text-sm">{finapiStatus.connected ? "FinAPI PSD2-Banking aktiv" + (finapiStatus.sandbox ? " (Sandbox)" : "") : finapiStatus.configured ? "FinAPI konfiguriert — Verbindungstest fehlgeschlagen" : "FinAPI nicht konfiguriert — PDF-Import verfügbar"}</p>
            <p className="text-xs text-muted-foreground mt-1">{finapiStatus.connected ? "Automatischer Kontoabruf über PSD2-Schnittstelle aktiv." : "Kontoauszüge können als PDF unter Bankkonten importiert werden."}</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Verbundene Konten</h2>
          {accounts.length > 0 && <Badge variant="secondary">{accounts.length}</Badge>}
        </div>
        {loading ? (
          <div className="glass rounded-xl p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />Lade...</div>
        ) : accounts.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-6">Noch keine Bankkonten verbunden</p>
            <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Erstes Konto hinzufügen</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {accounts.map((account) => (
              <div key={account.id} className="glass rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-primary">{account.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{account.name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      {account.iban && <span className="font-mono">{formatIBAN(account.iban)}</span>}
                      {account.bic && <span>BIC: {account.bic}</span>}
                      <span>Letzte Sync: {formatDate(account.updated_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">Kontostand</p>
                    <p className={(account.balance ?? 0) >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>{formatCurrency(account.balance, account.currency)}</p>
                  </div>
                  <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="mr-1 h-3 w-3" />Verbunden</Badge>
                  <Button variant="outline" size="sm" onClick={() => handleSync(account)} disabled={syncingId === account.id}>
                    {syncingId === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-2 hidden sm:inline">Sync</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={deletingId === account.id}>
                        {deletingId === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Konto entfernen?</AlertDialogTitle><AlertDialogDescription>Das Bankkonto "{account.name}" wird entfernt. Transaktionen bleiben erhalten.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(account.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Entfernen</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Kontoauszug als PDF importieren</p>
        <p>Kein automatischer Banking-Zugang? Unter <a href="/bankkonten" className="text-primary underline underline-offset-4">Bankkonten</a> können Sie Kontoauszüge als PDF hochladen.</p>
      </div>

      <BankConnectDialog open={dialogOpen} onOpenChange={setDialogOpen} bank={null} onSuccess={() => { fetchAccounts(); toast({ title: "Konto hinzugefügt" }); }} />
    </div>
  );
}
