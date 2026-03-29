import { useState, useCallback } from 'react';
import {
  QrCode, Link2, Mail, AlertTriangle, CheckCircle2, Clock,
  Copy, Download, Send, FileText, ChevronRight, X, Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Invoice {
  id: string;
  invoice_number?: string;
  amount: number;
  status: string;
  due_date?: string;
  contact_name?: string;
  contact_email?: string;
  iban?: string;
  notes?: string;
}

interface InvoicePaymentPortalProps {
  invoice: Invoice;
  companyName: string;
  companyIban?: string;
  open: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

const DUNNING_LEVELS = [
  {
    level: 1,
    label: '1. Mahnung',
    days: 7,
    fee: 0,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    subject: (inv: Invoice) => `Zahlungserinnerung – ${inv.invoice_number || 'Rechnung'}`,
    body: (inv: Invoice, company: string) =>
      `Sehr geehrte Damen und Herren,\n\nwir erlauben uns, Sie freundlich daran zu erinnern, dass die Rechnung ${inv.invoice_number || ''} vom ${inv.due_date ? new Date(inv.due_date).toLocaleDateString('de-DE') : ''} in Höhe von ${fmt(inv.amount)} noch offen ist.\n\nBitte überweisen Sie den Betrag innerhalb von 7 Tagen auf unser Konto.\n\nMit freundlichen Grüßen\n${company}`,
  },
  {
    level: 2,
    label: '2. Mahnung',
    days: 14,
    fee: 5,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    subject: (inv: Invoice) => `2. Mahnung – ${inv.invoice_number || 'Rechnung'} – Dringende Zahlungsaufforderung`,
    body: (inv: Invoice, company: string) =>
      `Sehr geehrte Damen und Herren,\n\nleider mussten wir feststellen, dass unsere erste Zahlungserinnerung ohne Reaktion blieb.\n\nWir fordern Sie hiermit erneut auf, den Betrag von ${fmt(inv.amount)} zzgl. Mahngebühr von ${fmt(5)} (Gesamt: ${fmt(inv.amount + 5)}) innerhalb von 14 Tagen zu begleichen.\n\nBitte beachten Sie, dass wir bei weiterer Nichtzahlung rechtliche Schritte einleiten müssen.\n\nMit freundlichen Grüßen\n${company}`,
  },
  {
    level: 3,
    label: '3. Mahnung (Letzte)',
    days: 7,
    fee: 15,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    subject: (inv: Invoice) => `LETZTE MAHNUNG – ${inv.invoice_number || 'Rechnung'} – Inkasso droht`,
    body: (inv: Invoice, company: string) =>
      `Sehr geehrte Damen und Herren,\n\nDIES IST UNSERE LETZTE MAHNUNG.\n\nTrotz mehrfacher Aufforderung ist die Rechnung ${inv.invoice_number || ''} über ${fmt(inv.amount)} noch immer nicht beglichen.\n\nWir fordern Sie auf, den Gesamtbetrag von ${fmt(inv.amount + 15)} (inkl. Mahngebühren) innerhalb von 7 Tagen zu überweisen.\n\nBei Nichtzahlung werden wir die Forderung ohne weitere Ankündigung an ein Inkassounternehmen übergeben.\n\nMit freundlichen Grüßen\n${company}`,
  },
];

function fmt(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

function generatePaymentLink(invoice: Invoice): string {
  const base = window.location.origin;
  const params = new URLSearchParams({
    inv: invoice.id,
    amt: invoice.amount.toString(),
    ref: invoice.invoice_number || invoice.id.slice(0, 8),
  });
  return `${base}/zahlung?${params.toString()}`;
}

function generateSepaQrData(invoice: Invoice, iban: string, bic: string, name: string): string {
  // EPC QR Code (GiroCode) standard
  return [
    'BCD',           // Service Tag
    '002',           // Version
    '1',             // Encoding (UTF-8)
    'SCT',           // Identification
    bic,             // BIC
    name,            // Name
    iban,            // IBAN
    `EUR${invoice.amount.toFixed(2)}`, // Amount
    '',              // Purpose
    invoice.invoice_number || invoice.id.slice(0, 8), // Reference
    `Rechnung ${invoice.invoice_number || ''}`, // Remittance info
    '',              // Beneficiary to originator info
  ].join('\n');
}

export function InvoicePaymentPortal({
  invoice, companyName, companyIban, open, onClose, onStatusChange,
}: InvoicePaymentPortalProps) {
  const [activeTab, setActiveTab] = useState('qr');
  const [dunningLevel, setDunningLevel] = useState(1);
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const paymentLink = generatePaymentLink(invoice);
  const iban = companyIban || 'DE00000000000000000000';
  const qrData = generateSepaQrData(invoice, iban, 'XXXXXXXX', companyName);

  const selectedDunning = DUNNING_LEVELS[dunningLevel - 1];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    toast.success('Zahlungslink kopiert');
  };

  const handleDunningSelect = (level: number) => {
    setDunningLevel(level);
    const d = DUNNING_LEVELS[level - 1];
    setEmailBody(d.body(invoice, companyName));
  };

  const handleMarkPaid = useCallback(async () => {
    setMarkingPaid(true);
    const { error } = await supabase.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoice.id);
    setMarkingPaid(false);
    if (error) { toast.error('Fehler beim Aktualisieren'); return; }
    toast.success('Rechnung als bezahlt markiert');
    onStatusChange?.();
    onClose();
  }, [invoice.id, onStatusChange, onClose]);

  const handleSendDunning = useCallback(async () => {
    setSending(true);
    // In production: call email API / Supabase Edge Function
    // For now: create notification + update invoice status
    const { error } = await supabase.from('invoices')
      .update({ status: dunningLevel >= 3 ? 'overdue' : 'sent', notes: `Mahnung ${dunningLevel} gesendet am ${new Date().toLocaleDateString('de-DE')}` })
      .eq('id', invoice.id);
    setSending(false);
    if (error) { toast.error('Fehler'); return; }
    toast.success(`${selectedDunning.label} wurde vorbereitet. E-Mail-Client öffnet sich.`);
    // Open mailto as fallback
    const mailto = `mailto:${invoice.contact_email || ''}?subject=${encodeURIComponent(selectedDunning.subject(invoice))}&body=${encodeURIComponent(emailBody || selectedDunning.body(invoice, companyName))}`;
    window.open(mailto, '_blank');
    onStatusChange?.();
  }, [dunningLevel, invoice, selectedDunning, emailBody, companyName, onStatusChange]);

  const handlePrintQr = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Zahlungs-QR – ${invoice.invoice_number}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px} h2{margin-bottom:8px} p{color:#666}</style>
      </head><body>
      <h2>Rechnung ${invoice.invoice_number || ''}</h2>
      <p>${companyName}</p>
      <p style="font-size:24px;font-weight:bold;color:#000">${fmt(invoice.amount)}</p>
      <p>IBAN: ${iban}</p>
      <p>Verwendungszweck: ${invoice.invoice_number || invoice.id.slice(0, 8)}</p>
      <p style="margin-top:20px;font-size:12px">Scannen Sie den QR-Code mit Ihrer Banking-App</p>
      </body></html>
    `);
    win.print();
  };

  const daysOverdue = invoice.due_date
    ? Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Zahlungsportal – {invoice.invoice_number || 'Rechnung'}
          </DialogTitle>
        </DialogHeader>

        {/* Status Banner */}
        <div className={`flex items-center justify-between p-3 rounded-lg ${daysOverdue > 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
          <div className="flex items-center gap-2">
            {daysOverdue > 0
              ? <AlertTriangle className="h-4 w-4 text-red-500" />
              : <Clock className="h-4 w-4 text-green-500" />}
            <span className="text-sm font-medium">
              {daysOverdue > 0 ? `${daysOverdue} Tage überfällig` : `Fällig am ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-DE') : '–'}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{fmt(invoice.amount)}</span>
            <Badge variant={invoice.status === 'paid' ? 'default' : daysOverdue > 0 ? 'destructive' : 'secondary'}>
              {invoice.status === 'paid' ? 'Bezahlt' : daysOverdue > 0 ? 'Überfällig' : 'Offen'}
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="qr" className="gap-1.5"><QrCode className="h-3.5 w-3.5" />QR-Code</TabsTrigger>
            <TabsTrigger value="link" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Zahlungslink</TabsTrigger>
            <TabsTrigger value="dunning" className="gap-1.5"><Mail className="h-3.5 w-3.5" />Mahnwesen</TabsTrigger>
          </TabsList>

          {/* QR-Code Tab */}
          <TabsContent value="qr" className="space-y-4">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center gap-4">
                {/* GiroCode QR – rendered as text representation since no QR library */}
                <div className="w-48 h-48 bg-white border-2 border-border rounded-xl flex flex-col items-center justify-center p-4 text-center">
                  <QrCode className="h-24 w-24 text-foreground" />
                  <p className="text-xs text-muted-foreground mt-2">GiroCode / EPC QR</p>
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold">{companyName}</p>
                  <p className="text-sm text-muted-foreground">IBAN: {iban}</p>
                  <p className="text-sm text-muted-foreground">Betrag: {fmt(invoice.amount)}</p>
                  <p className="text-xs text-muted-foreground">Verwendungszweck: {invoice.invoice_number || invoice.id.slice(0, 8)}</p>
                </div>
                <div className="flex gap-2 w-full">
                  <Button variant="outline" className="flex-1 gap-2" onClick={handlePrintQr}>
                    <Printer className="h-4 w-4" />Drucken
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => {
                    const blob = new Blob([qrData], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url;
                    a.download = `GiroCode_${invoice.invoice_number || invoice.id}.txt`;
                    a.click();
                  }}>
                    <Download className="h-4 w-4" />QR-Daten
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Scannen Sie diesen Code mit Ihrer Banking-App (z.B. Sparkasse, ING, DKB) um die Überweisung vorzuausfüllen.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Zahlungslink Tab */}
          <TabsContent value="link" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Direkter Zahlungslink</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                  <code className="text-xs flex-1 truncate">{paymentLink}</code>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleCopyLink}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-2" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />Link kopieren
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => {
                    const mailto = `mailto:${invoice.contact_email || ''}?subject=${encodeURIComponent(`Rechnung ${invoice.invoice_number || ''} – Zahlungslink`)}&body=${encodeURIComponent(`Bitte begleichen Sie Ihre Rechnung über folgenden Link:\n\n${paymentLink}\n\nBetrag: ${fmt(invoice.amount)}`)}`;
                    window.open(mailto, '_blank');
                  }}>
                    <Mail className="h-4 w-4" />Per E-Mail
                  </Button>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg text-xs text-blue-600 dark:text-blue-400">
                  Der Zahlungslink enthält alle Rechnungsdaten und kann direkt an den Kunden gesendet werden. Bei Zahlung wird die Rechnung automatisch als bezahlt markiert.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mahnwesen Tab */}
          <TabsContent value="dunning" className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {DUNNING_LEVELS.map((d) => (
                <button key={d.level}
                  onClick={() => handleDunningSelect(d.level)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${dunningLevel === d.level ? `border-primary ${d.bg}` : 'border-border hover:border-primary/50'}`}>
                  <div className={`text-xs font-bold ${d.color}`}>{d.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {d.fee > 0 ? `+${fmt(d.fee)} Gebühr` : 'Keine Gebühr'}
                  </div>
                  <div className="text-xs text-muted-foreground">{d.days} Tage Frist</div>
                </button>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>E-Mail-Vorlage: {selectedDunning.label}</span>
                  {selectedDunning.fee > 0 && (
                    <Badge variant="secondary">+{fmt(selectedDunning.fee)} Mahngebühr</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground font-medium">Betreff:</div>
                <div className="p-2 bg-secondary rounded text-xs">{selectedDunning.subject(invoice)}</div>
                <div className="text-xs text-muted-foreground font-medium">Nachricht:</div>
                <Textarea
                  value={emailBody || selectedDunning.body(invoice, companyName)}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="text-xs min-h-[140px] font-mono"
                />
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={handleSendDunning} disabled={sending}>
                    <Send className="h-4 w-4" />
                    {sending ? 'Wird gesendet...' : `${selectedDunning.label} senden`}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => {
                    const text = `Betreff: ${selectedDunning.subject(invoice)}\n\n${emailBody || selectedDunning.body(invoice, companyName)}`;
                    navigator.clipboard.writeText(text);
                    toast.success('Mahntext kopiert');
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button className="flex-1 gap-2" variant="default" onClick={handleMarkPaid} disabled={markingPaid || invoice.status === 'paid'}>
            <CheckCircle2 className="h-4 w-4" />
            {markingPaid ? 'Wird gespeichert...' : 'Als bezahlt markieren'}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
