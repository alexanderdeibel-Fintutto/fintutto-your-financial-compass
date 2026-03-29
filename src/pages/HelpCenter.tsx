/**
 * HelpCenter – vollständig mit Support-Ticket-System und Supabase-Anbindung
 */
import { useState, useEffect } from 'react';
import {
  Search, HelpCircle, BookOpen, Receipt, FileText, FolderOpen,
  BarChart3, Building2, Mail, ExternalLink, MessageCircle,
  Plus, Send, Clock, CheckCircle, AlertCircle, Ticket, ChevronRight,
  Bot, Zap, PiggyBank
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const categories = [
  { id: 'getting-started', name: 'Erste Schritte', icon: BookOpen, color: 'bg-blue-500' },
  { id: 'transactions', name: 'Buchungen', icon: Receipt, color: 'bg-green-500' },
  { id: 'invoices', name: 'Rechnungen', icon: FileText, color: 'bg-purple-500' },
  { id: 'receipts', name: 'Belege', icon: FolderOpen, color: 'bg-orange-500' },
  { id: 'reports', name: 'Berichte', icon: BarChart3, color: 'bg-cyan-500' },
  { id: 'datev', name: 'DATEV & ELSTER', icon: Building2, color: 'bg-pink-500' },
  { id: 'ai', name: 'KI-Funktionen', icon: Bot, color: 'bg-violet-500' },
  { id: 'budget', name: 'Budgetverwaltung', icon: PiggyBank, color: 'bg-emerald-500' },
];

const faqs = [
  {
    category: 'getting-started',
    questions: [
      { q: 'Wie erstelle ich meine erste Firma?', a: 'Klicken Sie in der Sidebar auf "Firmen" und dann auf "Neue Firma". Geben Sie den Firmennamen und optional die Rechtsform ein. Nach dem Speichern können Sie sofort mit der Buchhaltung beginnen.' },
      { q: 'Wie verbinde ich mein Bankkonto?', a: 'Navigieren Sie zu "Bankverbindung" in der Sidebar. Klicken Sie auf "Bank verbinden" und wählen Sie Ihre Bank aus der Liste. Folgen Sie den Anweisungen zur sicheren Authentifizierung über FinAPI.' },
      { q: 'Kann ich mehrere Firmen verwalten?', a: 'Ja! Fintutto unterstützt die Verwaltung mehrerer Firmen. Wechseln Sie einfach über das Dropdown-Menü in der Sidebar zwischen Ihren Firmen. Alle Daten werden getrennt gehalten.' },
      { q: 'Wie lade ich Mitarbeiter ein?', a: 'Gehen Sie zu Einstellungen > Team und klicken Sie auf "Mitglied einladen". Geben Sie die E-Mail-Adresse ein und wählen Sie die Rolle (Admin, Buchhalter, etc.).' },
    ],
  },
  {
    category: 'transactions',
    questions: [
      { q: 'Wie erstelle ich eine neue Buchung?', a: 'Unter "Buchungen" klicken Sie auf "Neue Buchung". Wählen Sie den Typ (Einnahme/Ausgabe), geben Sie Betrag, Datum und optional eine Kategorie ein.' },
      { q: 'Was ist der Unterschied zwischen Einnahme und Ausgabe?', a: 'Eine Einnahme erhöht Ihr Guthaben (z.B. Kundenrechnungen), eine Ausgabe verringert es (z.B. Lieferantenrechnungen, Miete).' },
      { q: 'Wie importiere ich Bankumsätze?', a: 'Verbinden Sie zuerst Ihre Bank unter "Bankverbindung". Danach können Sie unter "Bankkonten" auf "Umsätze importieren" klicken.' },
      { q: 'Wie funktionieren Zuordnungsregeln?', a: 'Unter "Zuordnungsregeln" können Sie Regeln erstellen, die Buchungen automatisch kategorisieren – z.B. alle Buchungen mit "MIETE" im Verwendungszweck als Mietausgabe.' },
    ],
  },
  {
    category: 'invoices',
    questions: [
      { q: 'Wie erstelle ich eine Rechnung?', a: 'Unter "Rechnungen" klicken Sie auf "Neue Rechnung". Wählen Sie einen Kontakt, geben Sie Positionen ein und die Rechnung wird automatisch nummeriert.' },
      { q: 'Wie funktioniert das Mahnwesen?', a: 'Überfällige Rechnungen werden automatisch markiert. Klicken Sie auf das QR-Code-Symbol bei einer Rechnung, um den Mahnwesen-Workflow zu starten (1.–3. Mahnung mit Vorlagen).' },
      { q: 'Was ist eine E-Rechnung (ZUGFeRD)?', a: 'ZUGFeRD 2.1.1 ist ein Standard für elektronische Rechnungen. Beim Erstellen einer Rechnung können Sie "ZUGFeRD 2.1.1" auswählen – das erzeugt eine XML-Datei nach EN 16931.' },
      { q: 'Wie erstelle ich Angebote und Auftragsbestätigungen?', a: 'Unter "Angebote" und "Auftragsbestätigungen" können Sie Dokumente erstellen, die automatisch in Rechnungen umgewandelt werden können.' },
    ],
  },
  {
    category: 'receipts',
    questions: [
      { q: 'Wie lade ich Belege hoch?', a: 'Unter "Belege" können Sie Dateien per Drag & Drop hochladen oder über den Upload-Button auswählen. Unterstützt werden PDF, JPG und PNG.' },
      { q: 'Werden Belege automatisch erkannt?', a: 'Ja! Unser KI-System (GPT-4o Vision) analysiert hochgeladene Belege und extrahiert automatisch Betrag, Datum, Lieferant und schlägt das passende SKR03-Konto vor.' },
      { q: 'Wie funktioniert der E-Mail-Belegeingang?', a: 'Unter Belege > E-Mail-Eingang erhalten Sie eine eindeutige E-Mail-Adresse. Senden Sie Belege einfach an diese Adresse und sie erscheinen automatisch in Fintutto.' },
    ],
  },
  {
    category: 'reports',
    questions: [
      { q: 'Welche Berichte sind verfügbar?', a: 'Fintutto bietet: BWA, GuV (§ 275 HGB), Bilanz, Buchungsjournal, Summen & Salden (SuSa) und UStVA-Übersicht. Alle als PDF exportierbar.' },
      { q: 'Wie exportiere ich Berichte als PDF?', a: 'Klicken Sie auf den "PDF exportieren"-Button oben rechts auf der Berichte-Seite. Der Export enthält Firmenname, Zeitraum und alle Daten.' },
      { q: 'Was ist der GdPDU/GoBD-Export?', a: 'Unter Einstellungen > GdPDU können Sie einen rechtskonformen ZIP-Export für Betriebsprüfungen erstellen: Buchungen, Rechnungen, Kontakte und GoBD-Hinweise.' },
    ],
  },
  {
    category: 'datev',
    questions: [
      { q: 'Wie exportiere ich für DATEV?', a: 'Unter Einstellungen > DATEV-Export wählen Sie einen Zeitraum. Der Export entspricht DATEV EXTF Format 7.0 mit vollständigem 26-Felder-Header.' },
      { q: 'Wie funktioniert die ELSTER-Übermittlung?', a: 'Unter "ELSTER" berechnet Fintutto automatisch alle UStVA-Kennzahlen (KZ 81, 83, 86, 93, 66, 69). Das XML kann heruntergeladen oder direkt zu Mein ELSTER übertragen werden.' },
      { q: 'Was ist der Unterschied zwischen SKR03 und SKR04?', a: 'SKR03 (Prozessgliederungsprinzip) und SKR04 (Abschlussgliederungsprinzip) sind Standard-Kontenrahmen. Fintutto nutzt SKR03 als Standard.' },
    ],
  },
  {
    category: 'ai',
    questions: [
      { q: 'Was kann der KI-Assistent?', a: 'Der KI-Assistent (GPT-4o) analysiert Ihre Finanzdaten und beantwortet Fragen zu Buchungen, Steueroptimierung, SKR03-Konten und erkennt Anomalien in Ihren Ausgaben.' },
      { q: 'Wie funktioniert die KI-Beleganalyse?', a: 'Laden Sie einen Beleg hoch und klicken Sie auf "KI analysieren". GPT-4o Vision extrahiert Betrag, Datum, Lieferant und schlägt Kategorie und SKR03-Konto vor.' },
      { q: 'Werden meine Daten für KI-Training verwendet?', a: 'Nein. Ihre Finanzdaten werden ausschließlich für die Analyse in Ihrer Session verwendet und nicht für das Training von KI-Modellen gespeichert.' },
    ],
  },
  {
    category: 'budget',
    questions: [
      { q: 'Wie erstelle ich ein Budget?', a: 'Unter "Budgetverwaltung" klicken Sie auf "Budget erstellen". Wählen Sie eine Kategorie, geben Sie den Betrag ein und setzen Sie eine Warnschwelle (z.B. 80%).' },
      { q: 'Wie werden Budgets überwacht?', a: 'Fintutto vergleicht automatisch Ihre tatsächlichen Ausgaben mit den Budgets. Bei Überschreitung der Warnschwelle erscheint ein gelber Balken, bei 100% ein roter.' },
      { q: 'Kann ich jährliche Budgets erstellen?', a: 'Ja, beim Erstellen eines Budgets können Sie zwischen "Monatlich" und "Jährlich" wählen. Jährliche Budgets werden auf Monatsbasis aufgeteilt.' },
    ],
  },
];

interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Offen', color: 'bg-blue-100 text-blue-700', icon: Clock },
  in_progress: { label: 'In Bearbeitung', color: 'bg-yellow-100 text-yellow-700', icon: Zap },
  waiting: { label: 'Warten auf Antwort', color: 'bg-orange-100 text-orange-700', icon: Clock },
  resolved: { label: 'Gelöst', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Geschlossen', color: 'bg-gray-100 text-gray-700', icon: CheckCircle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Niedrig', color: 'bg-gray-100 text-gray-600' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-600' },
  high: { label: 'Hoch', color: 'bg-orange-100 text-orange-600' },
  urgent: { label: 'Dringend', color: 'bg-red-100 text-red-600' },
};

export default function HelpCenter() {
  const { currentCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'normal',
    contact_email: '',
  });

  const filteredFaqs = faqs
    .filter((cat) => !selectedCategory || cat.category === selectedCategory)
    .map((cat) => ({
      ...cat,
      questions: cat.questions.filter(
        (faq) =>
          !searchQuery ||
          faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.a.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((cat) => cat.questions.length > 0);

  const totalResults = filteredFaqs.reduce((acc, cat) => acc + cat.questions.length, 0);

  useEffect(() => {
    loadTickets();
  }, [currentCompany]);

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      const { data } = await supabase
        .from('support_tickets')
        .select('id, ticket_number, subject, description, category, priority, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      setTickets(data || []);
    } catch (err) {
      console.error('Tickets load error:', err);
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast.error('Bitte Betreff und Beschreibung ausfüllen');
      return;
    }
    setSubmitting(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from('support_tickets').insert({
        company_id: currentCompany?.id || null,
        user_id: user.user?.id || null,
        subject: newTicket.subject,
        description: newTicket.description,
        category: newTicket.category,
        priority: newTicket.priority,
        contact_email: newTicket.contact_email || user.user?.email || null,
        contact_name: user.user?.user_metadata?.full_name || null,
        status: 'open',
      });
      if (error) throw error;
      toast.success('Support-Ticket erstellt. Wir melden uns innerhalb von 24 Stunden.');
      setNewTicketOpen(false);
      setNewTicket({ subject: '', description: '', category: 'general', priority: 'normal', contact_email: '' });
      loadTickets();
    } catch (err) {
      toast.error('Ticket konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Search */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Hilfe-Center</h1>
        <p className="text-muted-foreground mb-6">
          Finden Sie Antworten auf häufige Fragen oder öffnen Sie ein Support-Ticket.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Suchen Sie nach Hilfe..."
            className="pl-10 h-12 text-lg"
          />
        </div>
        {searchQuery && (
          <p className="text-sm text-muted-foreground mt-2">
            {totalResults} Ergebnis{totalResults !== 1 ? 'se' : ''} gefunden
          </p>
        )}
      </div>

      <Tabs defaultValue="faq">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="faq">FAQ & Dokumentation</TabsTrigger>
          <TabsTrigger value="tickets">
            Meine Tickets
            {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs">
                {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── FAQ Tab ── */}
        <TabsContent value="faq" className="space-y-6 mt-6">
          {/* Categories */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === category.id;
              const questionCount = faqs.find((f) => f.category === category.id)?.questions.length || 0;
              return (
                <Card
                  key={category.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedCategory(isSelected ? null : category.id)}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`p-2 rounded-lg ${category.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{category.name}</p>
                      <p className="text-xs text-muted-foreground">{questionCount} Artikel</p>
                    </div>
                    {isSelected && <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* FAQ Accordion */}
          <div className="space-y-4">
            {filteredFaqs.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">Keine Ergebnisse gefunden</p>
                  <p className="text-muted-foreground mb-4">Versuchen Sie andere Suchbegriffe oder öffnen Sie ein Support-Ticket.</p>
                  <Button onClick={() => setNewTicketOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Support-Ticket öffnen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredFaqs.map((categoryFaqs) => {
                const category = categories.find((c) => c.id === categoryFaqs.category);
                if (!category) return null;
                return (
                  <Card key={categoryFaqs.category}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${category.color}`}>
                          <category.icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{category.name}</CardTitle>
                          <CardDescription>{categoryFaqs.questions.length} Fragen</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {categoryFaqs.questions.map((faq, index) => (
                          <AccordionItem key={index} value={`${categoryFaqs.category}-${index}`}>
                            <AccordionTrigger className="text-left text-sm">{faq.q}</AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-sm">{faq.a}</AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Contact Box */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/20">
                  <HelpCircle className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Noch Fragen?</h3>
                  <p className="text-muted-foreground">Unser Support-Team hilft Ihnen gerne weiter.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <a href="mailto:support@fintutto.cloud">
                    <Mail className="h-4 w-4 mr-2" />
                    support@fintutto.cloud
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="https://docs.fintutto.cloud" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Dokumentation
                  </a>
                </Button>
                <Button onClick={() => setNewTicketOpen(true)}>
                  <Ticket className="h-4 w-4 mr-2" />
                  Ticket öffnen
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tickets Tab ── */}
        <TabsContent value="tickets" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Meine Support-Tickets</h2>
              <p className="text-sm text-muted-foreground">{tickets.length} Ticket{tickets.length !== 1 ? 's' : ''} insgesamt</p>
            </div>
            <Button onClick={() => setNewTicketOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neues Ticket
            </Button>
          </div>

          {ticketsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded animate-pulse mb-2 w-3/4" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Noch keine Tickets</p>
                <p className="text-muted-foreground mb-4">Öffnen Sie ein Ticket wenn Sie Hilfe benötigen.</p>
                <Button onClick={() => setNewTicketOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Erstes Ticket öffnen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const status = statusConfig[ticket.status] || statusConfig.open;
                const priority = priorityConfig[ticket.priority] || priorityConfig.normal;
                const StatusIcon = status.icon;
                return (
                  <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground font-mono">{ticket.ticket_number}</span>
                            <Badge className={`text-xs ${status.color}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                            <Badge className={`text-xs ${priority.color}`}>{priority.label}</Badge>
                          </div>
                          <p className="font-medium truncate">{ticket.subject}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{ticket.description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(ticket.created_at), 'dd.MM.yyyy', { locale: de })}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{ticket.category}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Ticket Dialog */}
      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Support-Ticket öffnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategorie</Label>
                <Select value={newTicket.category} onValueChange={(v) => setNewTicket((p) => ({ ...p, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Allgemein</SelectItem>
                    <SelectItem value="billing">Abrechnung</SelectItem>
                    <SelectItem value="technical">Technisches Problem</SelectItem>
                    <SelectItem value="feature">Feature-Anfrage</SelectItem>
                    <SelectItem value="bug">Fehler melden</SelectItem>
                    <SelectItem value="datev">DATEV / ELSTER</SelectItem>
                    <SelectItem value="other">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorität</Label>
                <Select value={newTicket.priority} onValueChange={(v) => setNewTicket((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="urgent">Dringend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Betreff *</Label>
              <Input
                value={newTicket.subject}
                onChange={(e) => setNewTicket((p) => ({ ...p, subject: e.target.value }))}
                placeholder="Kurze Beschreibung des Problems"
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung *</Label>
              <Textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket((p) => ({ ...p, description: e.target.value }))}
                placeholder="Beschreiben Sie das Problem so detailliert wie möglich..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Ihre E-Mail (optional)</Label>
              <Input
                type="email"
                value={newTicket.contact_email}
                onChange={(e) => setNewTicket((p) => ({ ...p, contact_email: e.target.value }))}
                placeholder="für Rückmeldungen"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setNewTicketOpen(false)}>Abbrechen</Button>
              <Button onClick={handleSubmitTicket} disabled={submitting}>
                {submitting ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Ticket senden
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
