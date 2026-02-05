import { useState } from 'react';
 import { DatevExportDialog } from '@/components/settings/DatevExportDialog';
 import { GdpduExportDialog } from '@/components/settings/GdpduExportDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  User,
  CreditCard,
  Bell,
  Shield,
  Download,
  Save,
  LogOut,
  Upload,
  Key,
  Smartphone,
  FileSpreadsheet,
  Database,
  FileText,
  HardDrive,
  AlertTriangle,
  Check,
  Building,
  Receipt,
  FolderOpen,
} from 'lucide-react';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { currentCompany, companies, refetchCompanies } = useCompany();
  const { toast } = useToast();

  // Company form state
  const [companyData, setCompanyData] = useState({
    name: currentCompany?.name || '',
    legalForm: 'gmbh',
    taxId: currentCompany?.tax_id || '',
    vatId: '',
    street: '',
    postalCode: '',
    city: '',
    chartOfAccounts: 'skr03',
    fiscalYearStart: '01',
  });

  // Profile state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: user?.email || '',
  });

  // Security state
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false,
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailInvoices: true,
    emailPayments: true,
    emailReports: false,
    pushNotifications: false,
  });

   // Export dialog states
   const [datevDialogOpen, setDatevDialogOpen] = useState(false);
   const [gdpduDialogOpen, setGdpduDialogOpen] = useState(false);
 
  const handleSaveCompany = async () => {
    if (!currentCompany) return;

    const { error } = await supabase
      .from('companies')
      .update({
        name: companyData.name,
        tax_id: companyData.taxId,
        address: `${companyData.street}, ${companyData.postalCode} ${companyData.city}`,
      })
      .eq('id', currentCompany.id);

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Unternehmensdaten konnten nicht gespeichert werden.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Gespeichert',
        description: 'Unternehmensdaten wurden aktualisiert.',
      });
      refetchCompanies();
    }
  };

  const handlePasswordChange = async () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast({
        title: 'Fehler',
        description: 'Die Passwörter stimmen nicht überein.',
        variant: 'destructive',
      });
      return;
    }

    if (securityData.newPassword.length < 6) {
      toast({
        title: 'Fehler',
        description: 'Das Passwort muss mindestens 6 Zeichen lang sein.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: securityData.newPassword,
    });

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Passwort konnte nicht geändert werden.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Erfolg',
        description: 'Passwort wurde erfolgreich geändert.',
      });
      setSecurityData({ ...securityData, currentPassword: '', newPassword: '', confirmPassword: '' });
    }
  };

  const handleExport = (format: string) => {
    toast({
      title: 'Export gestartet',
      description: `Daten werden im ${format}-Format exportiert...`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">Verwalten Sie Ihre Unternehmens- und Kontoeinstellungen</p>
      </div>

      <Tabs defaultValue="company" className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar Navigation */}
        <TabsList className="flex flex-col h-fit w-full lg:w-64 bg-transparent p-0 gap-1">
          <TabsTrigger
            value="company"
            className="w-full justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg"
          >
            <Building2 className="h-5 w-5" />
            Unternehmen
          </TabsTrigger>
          <TabsTrigger
            value="profile"
            className="w-full justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg"
          >
            <User className="h-5 w-5" />
            Profil
          </TabsTrigger>
          <TabsTrigger
            value="billing"
            className="w-full justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg"
          >
            <CreditCard className="h-5 w-5" />
            Abrechnung
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="w-full justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg"
          >
            <Bell className="h-5 w-5" />
            Benachrichtigungen
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="w-full justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg"
          >
            <Shield className="h-5 w-5" />
            Sicherheit
          </TabsTrigger>
          <TabsTrigger
            value="export"
            className="w-full justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg"
          >
            <Download className="h-5 w-5" />
            Datenexport
          </TabsTrigger>
        </TabsList>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {/* Unternehmen Tab */}
          <TabsContent value="company" className="mt-0 space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Unternehmensdaten</CardTitle>
                <CardDescription>Grundlegende Informationen zu Ihrem Unternehmen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Firmenname</Label>
                    <Input
                      id="companyName"
                      value={companyData.name}
                      onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                      placeholder="Muster GmbH"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalForm">Rechtsform</Label>
                    <Select
                      value={companyData.legalForm}
                      onValueChange={(value) => setCompanyData({ ...companyData, legalForm: value })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Rechtsform wählen" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="gmbh">GmbH</SelectItem>
                        <SelectItem value="ug">UG (haftungsbeschränkt)</SelectItem>
                        <SelectItem value="ag">AG</SelectItem>
                        <SelectItem value="kg">KG</SelectItem>
                        <SelectItem value="ohg">OHG</SelectItem>
                        <SelectItem value="gbr">GbR</SelectItem>
                        <SelectItem value="einzelunternehmen">Einzelunternehmen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxId">Steuernummer</Label>
                    <Input
                      id="taxId"
                      value={companyData.taxId}
                      onChange={(e) => setCompanyData({ ...companyData, taxId: e.target.value })}
                      placeholder="123/456/78901"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatId">USt-IdNr.</Label>
                    <Input
                      id="vatId"
                      value={companyData.vatId}
                      onChange={(e) => setCompanyData({ ...companyData, vatId: e.target.value })}
                      placeholder="DE123456789"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="street">Straße und Hausnummer</Label>
                    <Input
                      id="street"
                      value={companyData.street}
                      onChange={(e) => setCompanyData({ ...companyData, street: e.target.value })}
                      placeholder="Musterstraße 123"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">PLZ</Label>
                      <Input
                        id="postalCode"
                        value={companyData.postalCode}
                        onChange={(e) => setCompanyData({ ...companyData, postalCode: e.target.value })}
                        placeholder="12345"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Stadt</Label>
                      <Input
                        id="city"
                        value={companyData.city}
                        onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })}
                        placeholder="Musterstadt"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Buchhaltungseinstellungen</CardTitle>
                <CardDescription>Konfigurieren Sie Ihre Buchhaltungsparameter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="chartOfAccounts">Kontenrahmen</Label>
                    <Select
                      value={companyData.chartOfAccounts}
                      onValueChange={(value) => setCompanyData({ ...companyData, chartOfAccounts: value })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="skr03">SKR 03</SelectItem>
                        <SelectItem value="skr04">SKR 04</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fiscalYear">Geschäftsjahr beginnt</Label>
                    <Select
                      value={companyData.fiscalYearStart}
                      onValueChange={(value) => setCompanyData({ ...companyData, fiscalYearStart: value })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="01">Januar</SelectItem>
                        <SelectItem value="04">April</SelectItem>
                        <SelectItem value="07">Juli</SelectItem>
                        <SelectItem value="10">Oktober</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleSaveCompany} className="gap-2">
                  <Save className="h-4 w-4" />
                  Änderungen speichern
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profil Tab */}
          <TabsContent value="profile" className="mt-0 space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Profilbild</CardTitle>
                <CardDescription>Laden Sie ein Profilbild hoch</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src="" />
                    <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Button variant="outline" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Bild hochladen
                    </Button>
                    <p className="text-sm text-muted-foreground">JPG, PNG oder GIF. Max. 2MB.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Persönliche Daten</CardTitle>
                <CardDescription>Verwalten Sie Ihre persönlichen Informationen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      placeholder="Max"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      placeholder="Mustermann"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail-Adresse</Label>
                  <Input id="email" value={profileData.email} disabled className="bg-muted/50" />
                </div>
                <Button className="gap-2">
                  <Save className="h-4 w-4" />
                  Profil speichern
                </Button>
              </CardContent>
            </Card>

            <Card className="glass border-destructive/30">
              <CardHeader>
                <CardTitle className="text-destructive">Abmelden</CardTitle>
                <CardDescription>Melden Sie sich von Ihrem Konto ab</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={signOut} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Abmelden
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Abrechnung Tab */}
          <TabsContent value="billing" className="mt-0 space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Aktueller Plan</CardTitle>
                <CardDescription>Ihr aktuelles Abonnement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">Free Plan</h3>
                        <Badge variant="secondary" className="bg-success/20 text-success border-0">
                          <Check className="h-3 w-3 mr-1" />
                          Aktiv
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Grundlegende Buchhaltungsfunktionen</p>
                    </div>
                  </div>
                  <Button>Upgrade</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Nutzungsübersicht</CardTitle>
                <CardDescription>Ihre aktuellen Limits und Verbrauch</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg border bg-card/50">
                    <div className="flex items-center gap-3 mb-2">
                      <Building className="h-5 w-5 text-primary" />
                      <span className="text-sm text-muted-foreground">Firmen</span>
                    </div>
                    <p className="text-2xl font-bold">{companies.length}</p>
                    <p className="text-xs text-muted-foreground">unbegrenzt</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-card/50">
                    <div className="flex items-center gap-3 mb-2">
                      <Receipt className="h-5 w-5 text-primary" />
                      <span className="text-sm text-muted-foreground">Buchungen</span>
                    </div>
                    <p className="text-2xl font-bold">∞</p>
                    <p className="text-xs text-muted-foreground">unbegrenzt</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-card/50">
                    <div className="flex items-center gap-3 mb-2">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      <span className="text-sm text-muted-foreground">Belege</span>
                    </div>
                    <p className="text-2xl font-bold">∞</p>
                    <p className="text-xs text-muted-foreground">unbegrenzt</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Benachrichtigungen Tab */}
          <TabsContent value="notifications" className="mt-0 space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>E-Mail-Benachrichtigungen</CardTitle>
                <CardDescription>Wählen Sie, welche E-Mails Sie erhalten möchten</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'emailInvoices', title: 'Rechnungsbenachrichtigungen', desc: 'Bei neuen und bezahlten Rechnungen' },
                  { key: 'emailPayments', title: 'Zahlungseingänge', desc: 'Bei eingegangenen Zahlungen' },
                  { key: 'emailReports', title: 'Monatliche Berichte', desc: 'Zusammenfassung per E-Mail' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Button
                      variant={notifications[item.key as keyof typeof notifications] ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setNotifications({
                          ...notifications,
                          [item.key]: !notifications[item.key as keyof typeof notifications],
                        })
                      }
                    >
                      {notifications[item.key as keyof typeof notifications] ? 'An' : 'Aus'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sicherheit Tab */}
          <TabsContent value="security" className="mt-0 space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Passwort ändern
                </CardTitle>
                <CardDescription>Aktualisieren Sie Ihr Passwort regelmäßig für mehr Sicherheit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={securityData.currentPassword}
                    onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Neues Passwort</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handlePasswordChange} className="gap-2">
                  <Save className="h-4 w-4" />
                  Passwort ändern
                </Button>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Zwei-Faktor-Authentifizierung (2FA)
                </CardTitle>
                <CardDescription>Erhöhen Sie die Sicherheit Ihres Kontos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${securityData.twoFactorEnabled ? 'bg-success/10' : 'bg-muted'}`}>
                      <Shield className={`h-6 w-6 ${securityData.twoFactorEnabled ? 'text-success' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-medium">2FA Status</p>
                      <p className="text-sm text-muted-foreground">
                        {securityData.twoFactorEnabled ? 'Aktiviert und geschützt' : 'Nicht aktiviert'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={securityData.twoFactorEnabled ? 'outline' : 'default'}
                    onClick={() => {
                      setSecurityData({ ...securityData, twoFactorEnabled: !securityData.twoFactorEnabled });
                      toast({
                        title: securityData.twoFactorEnabled ? '2FA deaktiviert' : '2FA aktiviert',
                        description: securityData.twoFactorEnabled
                          ? 'Zwei-Faktor-Authentifizierung wurde deaktiviert.'
                          : 'Zwei-Faktor-Authentifizierung wurde aktiviert.',
                      });
                    }}
                  >
                    {securityData.twoFactorEnabled ? 'Deaktivieren' : 'Aktivieren'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

           {/* Datenexport Tab */}
           <TabsContent value="export" className="mt-0 space-y-6">
             <div className="grid gap-4 md:grid-cols-2">
               <Card 
                 className="glass hover:border-blue-500/50 transition-colors cursor-pointer" 
                 onClick={() => setDatevDialogOpen(true)}
               >
                 <CardContent className="p-6">
                   <div className="flex items-start gap-4">
                     <div className="p-3 rounded-xl bg-blue-500/10">
                       <FileSpreadsheet className="h-6 w-6 text-blue-500" />
                     </div>
                     <div className="flex-1">
                       <h3 className="font-semibold mb-1">DATEV-Export</h3>
                       <p className="text-sm text-muted-foreground">
                         Exportieren Sie Ihre Buchungsdaten für den Steuerberater im DATEV-Format.
                       </p>
                     </div>
                   </div>
                 </CardContent>
               </Card>
 
               <Card 
                 className="glass hover:border-purple-500/50 transition-colors cursor-pointer" 
                 onClick={() => setGdpduDialogOpen(true)}
               >
                 <CardContent className="p-6">
                   <div className="flex items-start gap-4">
                     <div className="p-3 rounded-xl bg-purple-500/10">
                       <Database className="h-6 w-6 text-purple-500" />
                     </div>
                     <div className="flex-1">
                       <h3 className="font-semibold mb-1">GDPdU-Export</h3>
                       <p className="text-sm text-muted-foreground">
                         Steuerprüfungskonformer Export für Betriebsprüfungen.
                       </p>
                     </div>
                   </div>
                 </CardContent>
               </Card>
 
               <Card className="glass hover:border-green-500/50 transition-colors cursor-pointer" onClick={() => handleExport('CSV')}>
                 <CardContent className="p-6">
                   <div className="flex items-start gap-4">
                     <div className="p-3 rounded-xl bg-green-500/10">
                       <FileText className="h-6 w-6 text-green-500" />
                     </div>
                     <div className="flex-1">
                       <h3 className="font-semibold mb-1">CSV-Export</h3>
                       <p className="text-sm text-muted-foreground">
                         Exportieren Sie einzelne Datenbereiche als CSV-Datei.
                       </p>
                     </div>
                   </div>
                 </CardContent>
               </Card>
 
               <Card className="glass hover:border-orange-500/50 transition-colors cursor-pointer" onClick={() => handleExport('Backup')}>
                 <CardContent className="p-6">
                   <div className="flex items-start gap-4">
                     <div className="p-3 rounded-xl bg-orange-500/10">
                       <HardDrive className="h-6 w-6 text-orange-500" />
                     </div>
                     <div className="flex-1">
                       <h3 className="font-semibold mb-1">Kompletter Backup</h3>
                       <p className="text-sm text-muted-foreground">
                         Sichern Sie alle Ihre Unternehmensdaten vollständig.
                       </p>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             </div>
 
             <Card className="glass border-warning/30 bg-warning/5">
               <CardContent className="p-6">
                 <div className="flex items-start gap-4">
                   <div className="p-3 rounded-xl bg-warning/10">
                     <AlertTriangle className="h-6 w-6 text-warning" />
                   </div>
                   <div>
                     <h3 className="font-semibold mb-1">GoBD-Hinweis</h3>
                     <p className="text-sm text-muted-foreground">
                       Gemäß den Grundsätzen zur ordnungsmäßigen Führung und Aufbewahrung von Büchern, Aufzeichnungen 
                       und Unterlagen in elektronischer Form (GoBD) sind Sie verpflichtet, Ihre Buchführungsdaten 
                       revisionssicher aufzubewahren. Wir empfehlen regelmäßige Backups und die Aufbewahrung aller 
                       steuerrelevanten Belege für mindestens 10 Jahre.
                     </p>
                   </div>
                 </div>
               </CardContent>
             </Card>
           </TabsContent>
        </div>
      </Tabs>

       {/* Export Dialogs */}
       <DatevExportDialog open={datevDialogOpen} onOpenChange={setDatevDialogOpen} />
       <GdpduExportDialog open={gdpduDialogOpen} onOpenChange={setGdpduDialogOpen} />
    </div>
  );
}
