import { useState } from 'react';
import { Building2, Wrench, Users, Gauge, ExternalLink, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InviteManagerDialog } from './InviteManagerDialog';

interface AppInfo {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  features: string[];
  url: string;
  signupPath: string;
  icon: React.ReactNode;
  gradient: string;
  accentColor: string;
  inviteLabel: string;
  inviteTarget: string;
}

const FINTUTTO_APPS: AppInfo[] = [
  {
    id: 'vermietify',
    name: 'VermieTify',
    subtitle: 'Immobilienverwaltung',
    description: 'Die professionelle Lösung für Vermieter – Nebenkostenabrechnung, Mieterkommunikation und Zahlungsverfolgung in einer App.',
    features: ['Automatische Nebenkostenabrechnung', 'CO₂-Kostenaufteilung', 'Bankanbindung & Miet-Matching', 'ELSTER-Integration'],
    url: 'https://vermietify.fintutto.cloud',
    signupPath: '/login',
    icon: <Building2 className="h-6 w-6" />,
    gradient: 'from-violet-600 via-purple-500 to-fuchsia-500',
    accentColor: 'text-violet-400',
    inviteLabel: 'Verwalter einladen',
    inviteTarget: 'Verwalter',
  },
  {
    id: 'hausmeister',
    name: 'Fintutto Hausmeister',
    subtitle: 'Facility Management',
    description: 'Digitale Auftrags- und Gebäudeverwaltung für Hausmeister – Wartungspläne, Ticketsystem und Einsatzplanung.',
    features: ['Auftrags- & Ticketsystem', 'Wartungspläne & Erinnerungen', 'Gebäude-Rundgänge digital', 'Foto-Dokumentation'],
    url: 'https://hausmeister-pro.vercel.app',
    signupPath: '/login',
    icon: <Wrench className="h-6 w-6" />,
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    accentColor: 'text-amber-400',
    inviteLabel: 'Hausmeister einladen',
    inviteTarget: 'Hausmeister',
  },
  {
    id: 'mieter',
    name: 'Fintutto Mieter',
    subtitle: 'Mieter-Portal',
    description: 'Das digitale Portal für Ihre Mieter – Mietdaten, Dokumente und direkte Kommunikation mit der Hausverwaltung.',
    features: ['Echtzeit-Mietübersicht', 'Direkte Kommunikation', 'Dokumente & Verträge', 'Schadenmeldung per App'],
    url: 'https://mieter-kw8d.vercel.app',
    signupPath: '/login',
    icon: <Users className="h-6 w-6" />,
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    accentColor: 'text-blue-400',
    inviteLabel: 'Mieter einladen',
    inviteTarget: 'Mieter',
  },
  {
    id: 'zaehler',
    name: 'Fintutto Zähler',
    subtitle: 'Digitale Ablesung',
    description: 'Zählerstände per Foto erfassen – KI-gestützte Erkennung, Verbrauchsanalyse und automatischer Export für die Abrechnung.',
    features: ['KI-Ablesung per Foto', 'Verbrauchsanalyse & Trends', 'CSV/Excel/PDF Import', 'Abrechnungsperioden'],
    url: 'https://ablesung.vercel.app',
    signupPath: '/login',
    icon: <Gauge className="h-6 w-6" />,
    gradient: 'from-indigo-600 via-purple-600 to-violet-600',
    accentColor: 'text-indigo-400',
    inviteLabel: 'Ableser einladen',
    inviteTarget: 'Ableser',
  },
];

interface FintuttoAppsPromoProps {
  propertyName?: string;
  propertyAddress?: string | null;
}

export function FintuttoAppsPromo({ propertyName, propertyAddress }: FintuttoAppsPromoProps) {
  const [inviteApp, setInviteApp] = useState<AppInfo | null>(null);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Fintutto Ökosystem</h2>
          <Badge variant="secondary" className="text-xs">4 Apps</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Vernetzen Sie Ihr Immobilienmanagement – nutzen Sie unsere spezialisierten Apps selbst oder laden Sie Partner ein.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {FINTUTTO_APPS.map(app => (
            <div
              key={app.id}
              className="group relative overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg"
            >
              {/* Gradient header bar */}
              <div className={`h-1.5 bg-gradient-to-r ${app.gradient}`} />

              <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg bg-gradient-to-br ${app.gradient} text-white shadow-md`}>
                      {app.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{app.name}</h3>
                      <p className="text-xs text-muted-foreground">{app.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {app.description}
                </p>

                {/* Features */}
                <div className="flex flex-wrap gap-1.5">
                  {app.features.map(f => (
                    <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
                      {f}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                    onClick={() => window.open(`${app.url}${app.signupPath}`, '_blank')}
                  >
                    <ExternalLink className="mr-1.5 h-3 w-3" />
                    Selbst nutzen
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs h-8"
                    onClick={() => setInviteApp(app)}
                  >
                    <Send className="mr-1.5 h-3 w-3" />
                    {app.inviteLabel}
                  </Button>
                </div>

                {/* Pricing link */}
                <a
                  href={`${app.url}/preise`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  Preise ansehen →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reuse invite dialog for any app */}
      {inviteApp && (
        <InviteAppDialog
          open={!!inviteApp}
          onOpenChange={open => { if (!open) setInviteApp(null); }}
          app={inviteApp}
          propertyName={propertyName || ''}
          propertyAddress={propertyAddress || null}
        />
      )}
    </>
  );
}

// Generic invite dialog that works for all apps
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

function InviteAppDialog({
  open, onOpenChange, app, propertyName, propertyAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: AppInfo;
  propertyName: string;
  propertyAddress: string | null;
}) {
  const [email, setEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');

  const signupUrl = `${app.url}${app.signupPath}${app.signupPath.includes('?') ? '&' : '?'}email=${encodeURIComponent(email)}`;

  const subject = `Einladung: Nutzen Sie ${app.name} für professionelles ${app.subtitle}`;

  const body = `Sehr geehrte/r ${recipientName || app.inviteTarget},

Sie wurden eingeladen, ${app.name} zu nutzen${propertyName ? ` – im Zusammenhang mit der Immobilie „${propertyName}"${propertyAddress ? ` (${propertyAddress})` : ''}` : ''}.

${app.name} ist die ${app.subtitle}-Lösung aus dem Fintutto Ökosystem:

${app.features.map(f => `✅ ${f}`).join('\n')}

🚀 Jetzt kostenlos starten:
${signupUrl}

Ihre E-Mail-Adresse ist bereits vorausgefüllt – Sie können sofort loslegen.

Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr Fintutto-Team

---
Fintutto GmbH · fintutto.cloud
Powered by ${app.name}`;

  const handleSend = () => {
    if (!email.trim()) { toast.error('Bitte geben Sie eine E-Mail-Adresse ein.'); return; }
    window.open(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    toast.success('E-Mail-Client wird geöffnet...');
    onOpenChange(false);
  };

  const handleCopyLink = () => {
    if (!email.trim()) { toast.error('Bitte geben Sie eine E-Mail-Adresse ein.'); return; }
    navigator.clipboard.writeText(signupUrl);
    toast.success('Einladungslink kopiert.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {app.icon}
            {app.inviteLabel}
          </DialogTitle>
          <DialogDescription>
            Laden Sie eine/n {app.inviteTarget} ein, {app.name} zu nutzen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder={`z.B. Herr Müller`} />
          </div>
          <div>
            <Label className="text-xs">E-Mail-Adresse *</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.de" />
          </div>
          {email.trim() && (
            <div className="glass rounded-lg p-2 flex items-center gap-2">
              <code className="text-[10px] bg-secondary/50 px-2 py-1 rounded flex-1 break-all">{signupUrl}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopyLink}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSend} disabled={!email.trim()}>
            <Send className="mr-2 h-4 w-4" />Einladung senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
