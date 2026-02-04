import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
} from 'lucide-react';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { currentCompany, refetchCompanies } = useCompany();
  const { toast } = useToast();

  // Company form state
  const [companyData, setCompanyData] = useState({
    name: currentCompany?.name || '',
    legalForm: '',
    taxId: currentCompany?.tax_id || '',
    vatId: '',
    address: currentCompany?.address || '',
  });

  // Accounting settings state
  const [accountingSettings, setAccountingSettings] = useState({
    chartOfAccounts: 'skr03',
    fiscalYearStart: '01',
    vatReportingPeriod: 'monthly',
  });

  // Profile state
  const [profileData, setProfileData] = useState({
    fullName: '',
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

  const handleSaveCompany = async () => {
    if (!currentCompany) return;

    const { error } = await supabase
      .from('companies')
      .update({
        name: companyData.name,
        tax_id: companyData.taxId,
        address: companyData.address,
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
    // Export logic would go here
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">Verwalten Sie Ihre Unternehmens- und Kontoeinstellungen</p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Unternehmen</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profil</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Abrechnung</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Benachrichtigungen</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Sicherheit</span>
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Datenexport</span>
          </TabsTrigger>
        </TabsList>

        {/* Unternehmen Tab */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Unternehmensdaten</CardTitle>
              <CardDescription>Grundlegende Informationen zu Ihrem Unternehmen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    <SelectTrigger>
                      <SelectValue placeholder="Rechtsform wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="einzelunternehmen">Einzelunternehmen</SelectItem>
                      <SelectItem value="gbr">GbR</SelectItem>
                      <SelectItem value="ohg">OHG</SelectItem>
                      <SelectItem value="kg">KG</SelectItem>
                      <SelectItem value="gmbh">GmbH</SelectItem>
                      <SelectItem value="ug">UG (haftungsbeschränkt)</SelectItem>
                      <SelectItem value="ag">AG</SelectItem>
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
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Textarea
                  id="address"
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                  placeholder="Musterstraße 123&#10;12345 Musterstadt"
                  rows={3}
                />
              </div>
              <Button onClick={handleSaveCompany} className="gap-2">
                <Save className="h-4 w-4" />
                Speichern
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Buchhaltungseinstellungen</CardTitle>
              <CardDescription>Konfigurieren Sie Ihre Buchhaltungsparameter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="chartOfAccounts">Kontenrahmen</Label>
                  <Select
                    value={accountingSettings.chartOfAccounts}
                    onValueChange={(value) =>
                      setAccountingSettings({ ...accountingSettings, chartOfAccounts: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skr03">SKR 03</SelectItem>
                      <SelectItem value="skr04">SKR 04</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiscalYear">Geschäftsjahr beginnt</Label>
                  <Select
                    value={accountingSettings.fiscalYearStart}
                    onValueChange={(value) =>
                      setAccountingSettings({ ...accountingSettings, fiscalYearStart: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">Januar</SelectItem>
                      <SelectItem value="04">April</SelectItem>
                      <SelectItem value="07">Juli</SelectItem>
                      <SelectItem value="10">Oktober</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vatReporting">USt-Voranmeldung</Label>
                  <Select
                    value={accountingSettings.vatReportingPeriod}
                    onValueChange={(value) =>
                      setAccountingSettings({ ...accountingSettings, vatReportingPeriod: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monatlich</SelectItem>
                      <SelectItem value="quarterly">Vierteljährlich</SelectItem>
                      <SelectItem value="yearly">Jährlich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="gap-2">
                <Save className="h-4 w-4" />
                Einstellungen speichern
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profil Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profilbild</CardTitle>
              <CardDescription>Laden Sie ein Profilbild hoch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

          <Card>
            <CardHeader>
              <CardTitle>Persönliche Daten</CardTitle>
              <CardDescription>Verwalten Sie Ihre persönlichen Informationen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Vollständiger Name</Label>
                  <Input
                    id="fullName"
                    value={profileData.fullName}
                    onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                    placeholder="Max Mustermann"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail-Adresse</Label>
                  <Input id="email" value={profileData.email} disabled className="bg-muted" />
                </div>
              </div>
              <Button className="gap-2">
                <Save className="h-4 w-4" />
                Profil speichern
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
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
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aktueller Plan</CardTitle>
              <CardDescription>Ihr aktuelles Abonnement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/5">
                <div>
                  <h3 className="font-semibold">Free Plan</h3>
                  <p className="text-sm text-muted-foreground">Grundlegende Buchhaltungsfunktionen</p>
                </div>
                <Button>Upgrade</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zahlungsmethode</CardTitle>
              <CardDescription>Verwalten Sie Ihre Zahlungsmethoden</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Keine Zahlungsmethode hinterlegt</p>
              <Button variant="outline" className="mt-4 gap-2">
                <CreditCard className="h-4 w-4" />
                Zahlungsmethode hinzufügen
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rechnungshistorie</CardTitle>
              <CardDescription>Ihre bisherigen Rechnungen</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Keine Rechnungen vorhanden</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Benachrichtigungen Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>E-Mail-Benachrichtigungen</CardTitle>
              <CardDescription>Wählen Sie, welche E-Mails Sie erhalten möchten</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Rechnungsbenachrichtigungen</p>
                  <p className="text-sm text-muted-foreground">Bei neuen und bezahlten Rechnungen</p>
                </div>
                <Switch
                  checked={notifications.emailInvoices}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailInvoices: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Zahlungseingänge</p>
                  <p className="text-sm text-muted-foreground">Bei eingegangenen Zahlungen</p>
                </div>
                <Switch
                  checked={notifications.emailPayments}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailPayments: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Monatliche Berichte</p>
                  <p className="text-sm text-muted-foreground">Zusammenfassung per E-Mail</p>
                </div>
                <Switch
                  checked={notifications.emailReports}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailReports: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Push-Benachrichtigungen</CardTitle>
              <CardDescription>Browser-Benachrichtigungen aktivieren</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Push-Benachrichtigungen</p>
                  <p className="text-sm text-muted-foreground">Erhalten Sie Echtzeit-Updates</p>
                </div>
                <Switch
                  checked={notifications.pushNotifications}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, pushNotifications: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sicherheit Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Passwort ändern
              </CardTitle>
              <CardDescription>Aktualisieren Sie Ihr Passwort regelmäßig</CardDescription>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Zwei-Faktor-Authentifizierung (2FA)
              </CardTitle>
              <CardDescription>Erhöhen Sie die Sicherheit Ihres Kontos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">2FA aktivieren</p>
                  <p className="text-sm text-muted-foreground">
                    Verwenden Sie eine Authenticator-App für zusätzliche Sicherheit
                  </p>
                </div>
                <Switch
                  checked={securityData.twoFactorEnabled}
                  onCheckedChange={(checked) =>
                    setSecurityData({ ...securityData, twoFactorEnabled: checked })
                  }
                />
              </div>
              {securityData.twoFactorEnabled && (
                <div className="p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    2FA-Konfiguration wird in einer zukünftigen Version verfügbar sein.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aktive Sitzungen</CardTitle>
              <CardDescription>Verwalten Sie Ihre angemeldeten Geräte</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Aktuelle Sitzung</p>
                    <p className="text-sm text-muted-foreground">Dieses Gerät</p>
                  </div>
                </div>
                <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">Aktiv</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Datenexport Tab */}
        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>DATEV-Export</CardTitle>
              <CardDescription>Exportieren Sie Ihre Daten für den Steuerberater</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Exportieren Sie Ihre Buchungsdaten im DATEV-Format für die Übergabe an Ihren Steuerberater.
              </p>
              <Button onClick={() => handleExport('DATEV')} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                DATEV-Export starten
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GDPdU-Export</CardTitle>
              <CardDescription>Steuerprüfungskonformer Export</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Erstellen Sie einen GDPdU-konformen Export für Betriebsprüfungen.
              </p>
              <Button onClick={() => handleExport('GDPdU')} variant="outline" className="gap-2">
                <Database className="h-4 w-4" />
                GDPdU-Export starten
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CSV-Export</CardTitle>
              <CardDescription>Daten als CSV-Datei exportieren</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Exportieren Sie einzelne Datenbereiche als CSV für die Weiterverarbeitung.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleExport('CSV-Buchungen')} variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Buchungen
                </Button>
                <Button onClick={() => handleExport('CSV-Rechnungen')} variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Rechnungen
                </Button>
                <Button onClick={() => handleExport('CSV-Kontakte')} variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Kontakte
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vollständiges Backup</CardTitle>
              <CardDescription>Sichern Sie alle Ihre Daten</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Erstellen Sie ein vollständiges Backup aller Unternehmensdaten.
              </p>
              <Button onClick={() => handleExport('Backup')} variant="outline" className="gap-2">
                <HardDrive className="h-4 w-4" />
                Backup erstellen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
