import { useState, useCallback } from 'react';
import {
  Zap,
  Plus,
  Trash2,
  Edit,
  Play,
  Pause,
  Bell,
  Mail,
  Tag,
  Clock,
  AlertTriangle,
  CheckCircle,
  Send,
  Euro,
  Calendar,
  Filter,
  Globe,
  Timer,
  Copy,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useCompany } from '@/contexts/CompanyContext';
import { useAutomationRules, AutomationRule, RuleCondition, RuleAction } from '@/hooks/useAutomationRules';
import { usePaymentReminders, PaymentReminder } from '@/hooks/usePaymentReminders';

const ruleTypeLabels = {
  categorization: 'Kategorisierung',
  reminder: 'Erinnerung',
  notification: 'Benachrichtigung',
};

const ruleTypeIcons = {
  categorization: Tag,
  reminder: Bell,
  notification: Mail,
};

const conditionFieldLabels = {
  description: 'Beschreibung',
  amount: 'Betrag',
  contact: 'Kontakt',
  category: 'Kategorie',
  due_date: 'Fälligkeitsdatum',
};

const conditionOperatorLabels = {
  contains: 'enthält',
  equals: 'ist gleich',
  greater_than: 'größer als',
  less_than: 'kleiner als',
  days_before: 'Tage vor',
  days_after: 'Tage nach',
};

export default function Automation() {
  const { currentCompany } = useCompany();
  const { rules, loading: rulesLoading, createRule, updateRule, deleteRule, toggleRule } = useAutomationRules();
  const { reminders, loading: remindersLoading, sendReminder, markAsPaid, getRecommendedAction, stats } = usePaymentReminders();

  const [activeTab, setActiveTab] = useState('rules');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'categorization' as AutomationRule['type'],
    is_active: true,
    conditions: [{ field: 'description', operator: 'contains', value: '' }] as RuleCondition[],
    actions: [{ type: 'set_category', value: '' }] as RuleAction[],
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'categorization',
      is_active: true,
      conditions: [{ field: 'description', operator: 'contains', value: '' }],
      actions: [{ type: 'set_category', value: '' }],
    });
    setSelectedRule(null);
  };

  const handleOpenDialog = (rule?: AutomationRule) => {
    if (rule) {
      setSelectedRule(rule);
      setFormData({
        name: rule.name,
        description: rule.description,
        type: rule.type,
        is_active: rule.is_active,
        conditions: rule.conditions,
        actions: rule.actions,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (selectedRule) {
      await updateRule(selectedRule.id, formData);
    } else {
      await createRule(formData);
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (selectedRule) {
      await deleteRule(selectedRule.id);
      setDeleteDialogOpen(false);
      setSelectedRule(null);
    }
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

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Bitte wählen Sie eine Firma aus.
      </div>
    );
  }

  const categorizationRules = rules.filter((r) => r.type === 'categorization');
  const reminderRules = rules.filter((r) => r.type === 'reminder' || r.type === 'notification');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Automatisierung</h1>
          <p className="text-muted-foreground">Regeln und Zahlungserinnerungen automatisch verwalten</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Regel
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aktive Regeln</p>
                <p className="text-2xl font-bold">{rules.filter((r) => r.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Überfällige Rechnungen</p>
                <p className="text-2xl font-bold text-warning">{stats.totalOverdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kritisch ({'>'}30 Tage)</p>
                <p className="text-2xl font-bold text-destructive">{stats.criticalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Euro className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Offener Betrag</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass">
          <TabsTrigger value="rules" className="gap-2">
            <Zap className="h-4 w-4" />
            Automatisierungsregeln
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Globe className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="zeitgesteuert" className="gap-2">
            <Timer className="h-4 w-4" />
            Zeitgesteuert
          </TabsTrigger>
          <TabsTrigger value="reminders" className="gap-2">
            <Bell className="h-4 w-4" />
            Zahlungserinnerungen
            {stats.pendingReminders > 0 && (
              <Badge variant="destructive" className="ml-1">{stats.pendingReminders}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Automation Rules Tab */}
        <TabsContent value="rules" className="space-y-6 mt-6">
          {/* Categorization Rules */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Kategorisierungsregeln
              </CardTitle>
              <CardDescription>Automatische Kategorisierung von Buchungen</CardDescription>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Laden...</div>
              ) : categorizationRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Keine Kategorisierungsregeln vorhanden</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {categorizationRules.map((rule) => (
                    <RuleItem
                      key={rule.id}
                      rule={rule}
                      onToggle={() => toggleRule(rule.id)}
                      onEdit={() => handleOpenDialog(rule)}
                      onDelete={() => {
                        setSelectedRule(rule);
                        setDeleteDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reminder Rules */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5 text-warning" />
                Erinnerungs- und Benachrichtigungsregeln
              </CardTitle>
              <CardDescription>Automatische Mahnungen und Benachrichtigungen</CardDescription>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Laden...</div>
              ) : reminderRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Keine Erinnerungsregeln vorhanden</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {reminderRules.map((rule) => (
                    <RuleItem
                      key={rule.id}
                      rule={rule}
                      onToggle={() => toggleRule(rule.id)}
                      onEdit={() => handleOpenDialog(rule)}
                      onDelete={() => {
                        setSelectedRule(rule);
                        setDeleteDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6 mt-6">
          <WebhooksTab />
        </TabsContent>
        {/* Zeitgesteuert Tab */}
        <TabsContent value="zeitgesteuert" className="space-y-6 mt-6">
          <ZeitgesteuertTab />
        </TabsContent>
        {/* Payment Reminders Tab */}
        <TabsContent value="reminders" className="space-y-6 mt-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Offene Mahnungen</CardTitle>
              <CardDescription>Überfällige Rechnungen, die eine Erinnerung benötigen</CardDescription>
            </CardHeader>
            <CardContent>
              {remindersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Laden...</div>
              ) : reminders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success opacity-50" />
                  <p className="text-lg font-medium">Keine überfälligen Rechnungen</p>
                  <p>Alle Rechnungen wurden pünktlich bezahlt.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {reminders.map((reminder) => (
                    <ReminderItem
                      key={reminder.id}
                      reminder={reminder}
                      onSendReminder={sendReminder}
                      onMarkAsPaid={markAsPaid}
                      getRecommendedAction={getRecommendedAction}
                      formatCurrency={formatCurrency}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedRule ? 'Regel bearbeiten' : 'Neue Regel erstellen'}</DialogTitle>
            <DialogDescription>
              Erstellen Sie Automatisierungsregeln für Ihre Buchhaltung.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. Gehaltszahlungen kategorisieren"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Beschreiben Sie, was diese Regel macht..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Regeltyp</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as AutomationRule['type'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="categorization">Kategorisierung</SelectItem>
                  <SelectItem value="reminder">Erinnerung</SelectItem>
                  <SelectItem value="notification">Benachrichtigung</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Aktiv</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave}>
              {selectedRule ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Regel "{selectedRule?.name}" wirklich löschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RuleItem({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: AutomationRule;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = ruleTypeIcons[rule.type];

  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <div className={`p-2 rounded-lg ${rule.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
        <Icon className={`h-5 w-5 ${rule.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-medium ${!rule.is_active ? 'text-muted-foreground' : ''}`}>{rule.name}</p>
          <Badge variant="secondary">{ruleTypeLabels[rule.type]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate">{rule.description}</p>
      </div>
      <Switch checked={rule.is_active} onCheckedChange={onToggle} />
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Edit className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Webhooks Tab ────────────────────────────────────────────────────────────
const WEBHOOK_EVENTS = [
  { id: 'invoice.created', label: 'Rechnung erstellt', icon: '📄' },
  { id: 'invoice.paid', label: 'Rechnung bezahlt', icon: '✅' },
  { id: 'invoice.overdue', label: 'Rechnung überfällig', icon: '⚠️' },
  { id: 'transaction.created', label: 'Buchung erstellt', icon: '💳' },
  { id: 'budget.exceeded', label: 'Budget überschritten', icon: '🔴' },
  { id: 'reminder.sent', label: 'Mahnung gesendet', icon: '📬' },
];

function WebhooksTab() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['invoice.paid', 'invoice.overdue']);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const samplePayload = JSON.stringify({
    event: 'invoice.paid',
    timestamp: new Date().toISOString(),
    data: { invoice_id: 'INV-2026-0042', amount: 1190.00, contact: 'Mustermann GmbH' }
  }, null, 2);

  const toggleEvent = (id: string) => {
    setSelectedEvents(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(samplePayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testWebhook = async () => {
    if (!webhookUrl) return;
    setTestResult('Sende Test-Request...');
    try {
      await fetch(webhookUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: samplePayload,
      });
      setTestResult('✅ Test-Request gesendet (no-cors – prüfe dein Endpoint-Log)');
    } catch (e) {
      setTestResult('❌ Fehler: ' + String(e));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Webhook-Konfiguration
          </CardTitle>
          <CardDescription>Sende Ereignisse an externe Systeme (Zapier, Make.com, eigene API)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Webhook-URL</Label>
            <div className="flex gap-2 mt-1">
              <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.zapier.com/hooks/catch/..." className="flex-1" />
              <Button variant="outline" onClick={testWebhook} disabled={!webhookUrl} className="gap-1">
                <RefreshCw className="h-4 w-4" /> Test
              </Button>
            </div>
            {testResult && <p className="text-xs mt-1 text-muted-foreground">{testResult}</p>}
          </div>
          <div>
            <Label className="mb-2 block">Ereignisse auswählen</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {WEBHOOK_EVENTS.map(ev => (
                <div key={ev.id}
                  onClick={() => toggleEvent(ev.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm ${
                    selectedEvents.includes(ev.id)
                      ? 'bg-primary/10 border-primary/50 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}>
                  <span>{ev.icon}</span>
                  <span>{ev.label}</span>
                  {selectedEvents.includes(ev.id) && <CheckCheck className="h-3 w-3 ml-auto" />}
                </div>
              ))}
            </div>
          </div>
          <Button className="w-full" disabled={!webhookUrl || selectedEvents.length === 0}>
            <Globe className="h-4 w-4 mr-2" /> Webhook speichern
          </Button>
        </CardContent>
      </Card>
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Beispiel-Payload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="text-xs bg-black/30 rounded-lg p-3 overflow-x-auto text-green-400">{samplePayload}</pre>
            <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6" onClick={copyPayload}>
              {copied ? <CheckCheck className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Zeitgesteuert Tab ────────────────────────────────────────────────────────
const SCHEDULED_TEMPLATES = [
  { id: 'monthly_report', label: 'Monatsbericht', icon: '📊', schedule: 'Jeden 1. des Monats', desc: 'BWA und GuV automatisch per E-Mail' },
  { id: 'weekly_summary', label: 'Wochenzusammenfassung', icon: '📋', schedule: 'Jeden Montag 08:00', desc: 'Offene Rechnungen und Buchungsübersicht' },
  { id: 'ustva_reminder', label: 'UStVA-Erinnerung', icon: '🏛️', schedule: 'Jeden 8. des Monats', desc: 'Erinnerung zur Abgabe der Voranmeldung' },
  { id: 'budget_check', label: 'Budget-Check', icon: '💰', schedule: 'Jeden Freitag 17:00', desc: 'Budgetauslastung und Warnungen' },
  { id: 'invoice_followup', label: 'Rechnungs-Follow-up', icon: '📬', schedule: 'Täglich 09:00', desc: 'Automatische Mahnung für überfällige Rechnungen' },
  { id: 'datev_export', label: 'DATEV-Export', icon: '📁', schedule: 'Jeden 1. des Monats', desc: 'Automatischer DATEV-Export für Steuerberater' },
];

function ZeitgesteuertTab() {
  const [activeJobs, setActiveJobs] = useState<string[]>(['ustva_reminder', 'invoice_followup']);

  const toggleJob = (id: string) => {
    setActiveJobs(prev => prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" /> Zeitgesteuerte Aufgaben
          </CardTitle>
          <CardDescription>Automatische Berichte, Exporte und Erinnerungen nach Zeitplan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {SCHEDULED_TEMPLATES.map(job => (
              <div key={job.id} className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${
                activeJobs.includes(job.id) ? 'bg-primary/5 border-primary/30' : 'border-border'
              }`}>
                <span className="text-2xl">{job.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{job.label}</p>
                    {activeJobs.includes(job.id) && (
                      <Badge variant="outline" className="text-xs text-primary border-primary/50">Aktiv</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{job.desc}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> {job.schedule}
                  </p>
                </div>
                <Switch
                  checked={activeJobs.includes(job.id)}
                  onCheckedChange={() => toggleJob(job.id)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Nächste geplante Ausführungen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeJobs.map(id => {
              const job = SCHEDULED_TEMPLATES.find(j => j.id === id);
              if (!job) return null;
              return (
                <div key={id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{job.icon} {job.label}</span>
                  <Badge variant="secondary" className="text-xs">{job.schedule}</Badge>
                </div>
              );
            })}
            {activeJobs.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">Keine aktiven Aufgaben</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReminderItem({
  reminder,
  onSendReminder,
  onMarkAsPaid,
  getRecommendedAction,
  formatCurrency,
  formatDate,
}: {
  reminder: PaymentReminder;
  onSendReminder: (id: string, level: 1 | 2 | 3) => void;
  onMarkAsPaid: (id: string) => void;
  getRecommendedAction: (r: PaymentReminder) => { level: 1 | 2 | 3; label: string } | null;
  formatCurrency: (n: number) => string;
  formatDate: (d: string) => string;
}) {
  const recommended = getRecommendedAction(reminder);
  const urgencyClass =
    reminder.days_overdue > 30
      ? 'bg-destructive/10 border-destructive/30'
      : reminder.days_overdue > 14
      ? 'bg-warning/10 border-warning/30'
      : 'bg-muted';

  const reminderLabels: Record<number, string> = {
    0: 'Keine Mahnung',
    1: '1. Erinnerung gesendet',
    2: '2. Mahnung gesendet',
    3: 'Letzte Mahnung gesendet',
  };

  return (
    <div className={`flex items-center gap-4 py-4 first:pt-0 last:pb-0 rounded-lg px-3 -mx-3 ${urgencyClass}`}>
      <div className="p-2 rounded-lg bg-background">
        <AlertTriangle
          className={`h-5 w-5 ${
            reminder.days_overdue > 30
              ? 'text-destructive'
              : reminder.days_overdue > 14
              ? 'text-warning'
              : 'text-muted-foreground'
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{reminder.invoice_number}</p>
          <Badge variant={reminder.days_overdue > 30 ? 'destructive' : 'secondary'}>
            {reminder.days_overdue} Tage überfällig
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {reminder.contact_name} • Fällig: {formatDate(reminder.due_date)}
          {reminder.reminder_level > 0 && ` • ${reminderLabels[reminder.reminder_level]}`}
        </p>
      </div>
      <span className="font-semibold">{formatCurrency(reminder.amount)}</span>
      <div className="flex gap-2">
        {recommended && (
          <Button
            size="sm"
            variant="default"
            onClick={() => onSendReminder(reminder.id, recommended.level)}
          >
            <Send className="mr-1 h-3 w-3" />
            {recommended.label}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onMarkAsPaid(reminder.id)}>
          <CheckCircle className="mr-1 h-3 w-3" />
          Bezahlt
        </Button>
      </div>
    </div>
  );
}
