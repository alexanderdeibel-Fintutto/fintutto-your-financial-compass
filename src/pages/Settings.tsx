import { useState, useEffect, useRef } from 'react';
import { DatevExportDialog } from '@/components/settings/DatevExportDialog';
import { GdpduExportDialog } from '@/components/settings/GdpduExportDialog';
import { BillingTab } from '@/components/settings/BillingTab';
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
import { Progress } from '@/components/ui/progress';
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
  TrendingUp,
  Leaf,
  Calculator,
  Info,
  Euro,
} from 'lucide-react';

// CO2 cost allocation categories according to CO2KostAufG
const CO2_CATEGORIES = [
  { max: 12, tenantShare: 100, landlordShare: 0 },
  { max: 17, tenantShare: 90, landlordShare: 10 },
  { max: 22, tenantShare: 80, landlordShare: 20 },
  { max: 27, tenantShare: 70, landlordShare: 30 },
  { max: 32, tenantShare: 60, landlordShare: 40 },
  { max: 37, tenantShare: 50, landlordShare: 50 },
  { max: 42, tenantShare: 40, landlordShare: 60 },
  { max: 47, tenantShare: 30, landlordShare: 70 },
  { max: 52, tenantShare: 20, landlordShare: 80 },
  { max: Infinity, tenantShare: 5, landlordShare: 95 },
];

const getCO2Category = (consumption: number) => {
  for (let i = 0; i < CO2_CATEGORIES.length; i++) {
    if (consumption < CO2_CATEGORIES[i].max) {
      return { category: i + 1, ...CO2_CATEGORIES[i] };
    }
  }
  return { category: 10, ...CO2_CATEGORIES[9] };
};

// ─── Helper: API Key Field with show/hide and save to localStorage ───
function ApiKeyField({ label, storageKey, placeholder, hint }: { label: string; storageKey: string; placeholder?: string; hint?: string }) {
  const [value, setValue] = useState(() => localStorage.getItem(storageKey) || '');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    if (value.trim()) localStorage.setItem(storageKey, value.trim());
    else localStorage.removeItem(storageKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="bg-secondary/50 pr-10"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? '🙈' : '👁'}
          </button>
        </div>
        <Button size="sm" variant={saved ? 'default' : 'outline'} onClick={handleSave}>
          {saved ? '✓ Gespeichert' : 'Speichern'}
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Helper: API Token Generator ───
function ApiTokenGenerator() {
  const [tokens, setTokens] = useState<{ id: string; name: string; token: string; created: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('api_tokens') || '[]'); } catch { return []; }
  });
  const [newName, setNewName] = useState('');
  const generateToken = () => {
    if (!newName.trim()) return;
    const token = 'fc_' + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
    const newToken = { id: crypto.randomUUID(), name: newName.trim(), token, created: new Date().toLocaleDateString('de-DE') };
    const updated = [...tokens, newToken];
    setTokens(updated);
    localStorage.setItem('api_tokens', JSON.stringify(updated));
    setNewName('');
  };
  const deleteToken = (id: string) => {
    const updated = tokens.filter(t => t.id !== id);
    setTokens(updated);
    localStorage.setItem('api_tokens', JSON.stringify(updated));
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Token-Name (z.B. Zapier Integration)" className="bg-secondary/50" />
        <Button size="sm" onClick={generateToken} disabled={!newName.trim()}>Erstellen</Button>
      </div>
      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Noch keine API-Tokens erstellt.</p>
      ) : (
        <div className="space-y-2">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{t.token}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{t.created}</span>
              <button onClick={() => { navigator.clipboard.writeText(t.token); }} className="text-xs text-primary hover:underline shrink-0">Kopieren</button>
              <button onClick={() => deleteToken(t.id)} className="text-xs text-destructive hover:underline shrink-0">Löschen</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { currentCompany, companies, refetchCompanies } = useCompany();
  const { toast } = useToast();

  // Company form state — wird via useEffect aus currentCompany befüllt
  const [companyData, setCompanyData] = useState({
    name: currentCompany?.name || '',
    legalForm: currentCompany?.legal_form || 'einzelunternehmen',
    taxId: currentCompany?.tax_id || '',
    vatId: currentCompany?.vat_id || '',
    street: currentCompany?.street || '',
    postalCode: currentCompany?.postal_code || currentCompany?.zip || '',
    city: currentCompany?.city || '',
    chartOfAccounts: currentCompany?.chart_of_accounts || 'skr03',
    fiscalYearStart: currentCompany?.fiscal_year_start || '01',
    registerNumber: currentCompany?.register_number || '',
    registerCourt: currentCompany?.register_court || '',
    managingDirector: currentCompany?.managing_director || '',
    companyType: currentCompany?.company_type || 'freelancer',
    primaryIban: currentCompany?.primary_iban || '',
    primaryBic: currentCompany?.primary_bic || '',
    primaryBankName: currentCompany?.primary_bank_name || '',
    smallBusinessRegulation: currentCompany?.small_business_regulation || false,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(currentCompany?.logo_url || '');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Daten aus currentCompany nachladen wenn sich die Firma ändert
  useEffect(() => {
    if (!currentCompany) return;
    setCompanyData({
      name: currentCompany.name || '',
      legalForm: currentCompany.legal_form || 'einzelunternehmen',
      taxId: currentCompany.tax_id || '',
      vatId: currentCompany.vat_id || '',
      street: currentCompany.street || '',
      postalCode: currentCompany.postal_code || currentCompany.zip || '',
      city: currentCompany.city || '',
      chartOfAccounts: currentCompany.chart_of_accounts || 'skr03',
      fiscalYearStart: currentCompany.fiscal_year_start || '01',
      registerNumber: currentCompany.register_number || '',
      registerCourt: currentCompany.register_court || '',
      managingDirector: currentCompany.managing_director || '',
      companyType: currentCompany.company_type || 'freelancer',
      primaryIban: currentCompany.primary_iban || '',
      primaryBic: currentCompany.primary_bic || '',
      primaryBankName: currentCompany.primary_bank_name || '',
      smallBusinessRegulation: currentCompany.small_business_regulation || false,
    });
    setLogoPreview(currentCompany.logo_url || '');
    setLogoFile(null);
  }, [currentCompany?.id]);

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

  // Index rent calculator state
  const [indexRent, setIndexRent] = useState({
    baseRent: 1000,
    baseVPIMonth: 1,
    baseVPIYear: 2020,
    baseVPIValue: 105.3,
    currentVPIMonth: new Date().getMonth() + 1,
    currentVPIYear: new Date().getFullYear(),
    currentVPIValue: 118.4,
    threshold: 5,
  });

  // CO2 allocation state
  const [co2Data, setCO2Data] = useState({
    energyConsumption: 25,
    co2PricePerTon: 45,
    totalCO2Tons: 2.5,
  });

  // Calculate index rent
  const calculateIndexRent = () => {
    const factor = indexRent.currentVPIValue / indexRent.baseVPIValue;
    const newRent = indexRent.baseRent * factor;
    const increasePercent = ((factor - 1) * 100);
    return { newRent, increasePercent, factor };
  };

  // Calculate CO2 allocation
  const calculateCO2Allocation = () => {
    const categoryInfo = getCO2Category(co2Data.energyConsumption);
    const totalCO2Cost = co2Data.totalCO2Tons * co2Data.co2PricePerTon;
    const tenantCost = totalCO2Cost * (categoryInfo.tenantShare / 100);
    const landlordCost = totalCO2Cost * (categoryInfo.landlordShare / 100);
    return { ...categoryInfo, totalCO2Cost, tenantCost, landlordCost };
  };

  const indexRentCalc = calculateIndexRent();
  const co2Allocation = calculateCO2Allocation();

  const handleCreateRentIncreaseLetter = () => {
    toast({
      title: 'Mieterhöhungsschreiben erstellt',
      description: 'Das Dokument wurde erstellt und kann heruntergeladen werden.',
    });
  };


  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !currentCompany) return currentCompany?.logo_url || null;
    setLogoUploading(true);
    try {
      const ext = logoFile.name.split('.').pop();
      const path = `logos/${currentCompany.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(path, logoFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(path);
      return publicUrl;
    } catch (err) {
      console.error('Logo upload error:', err);
      return null;
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!currentCompany) return;
    const logoUrl = await handleUploadLogo();
    const { error } = await supabase
      .from('companies')
      .update({
        name: companyData.name,
        tax_id: companyData.taxId,
        vat_id: companyData.vatId || null,
        legal_form: companyData.legalForm,
        street: companyData.street || null,
        postal_code: companyData.postalCode || null,
        city: companyData.city || null,
        address: companyData.street ? `${companyData.street}, ${companyData.postalCode} ${companyData.city}` : null,
        chart_of_accounts: companyData.chartOfAccounts,
        fiscal_year_start: companyData.fiscalYearStart,
        register_number: companyData.registerNumber || null,
        register_court: companyData.registerCourt || null,
        managing_director: companyData.managingDirector || null,
        company_type: companyData.companyType,
        primary_iban: companyData.primaryIban || null,
        primary_bic: companyData.primaryBic || null,
        primary_bank_name: companyData.primaryBankName || null,
        small_business_regulation: companyData.smallBusinessRegulation,
        ...(logoUrl ? { logo_url: logoUrl } : {}),
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
      setLogoFile(null);
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
            value="rent"
            className="w-full justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg"
          >
            <TrendingUp className="h-5 w-5" />
            Mietanpassung
          </TabsTrigger>
          <TabsTrigger
            value="api"
            className="w-full justify-start gap-3 px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg"
          >
            <Key className="h-5 w-5" />
            API-Schlüssel
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
            {/* Logo-Upload Card */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Firmenlogo</CardTitle>
                <CardDescription>Wird auf Rechnungen und Angeboten angezeigt</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                    >
                      <Upload className="h-4 w-4" />
                      {logoUploading ? 'Wird hochgeladen...' : 'Logo hochladen'}
                    </Button>
                    {logoFile && (
                      <p className="text-sm text-muted-foreground">{logoFile.name} ausgewählt — wird beim Speichern hochgeladen</p>
                    )}
                    <p className="text-xs text-muted-foreground">PNG, JPG oder SVG, max. 2 MB</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Unternehmensdaten</CardTitle>
                <CardDescription>Grundlegende Informationen zu Ihrem Unternehmen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyType">Firmentyp</Label>
                    <Select
                      value={companyData.companyType}
                      onValueChange={(value) => setCompanyData({ ...companyData, companyType: value })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Typ wählen" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="freelancer">Freelancer / Selbstständig</SelectItem>
                        <SelectItem value="gmbh">Eigene GmbH / UG</SelectItem>
                        <SelectItem value="beteiligung">Beteiligung (Gesellschafter)</SelectItem>
                        <SelectItem value="gf_mandat">GF-Mandat (Fremd-GmbH)</SelectItem>
                      </SelectContent>
                    </Select>
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
                        <SelectItem value="einzelunternehmen">Einzelunternehmen / Freiberufler</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                    <Label htmlFor="managingDirector">Geschäftsführer / Inhaber</Label>
                    <Input
                      id="managingDirector"
                      value={companyData.managingDirector}
                      onChange={(e) => setCompanyData({ ...companyData, managingDirector: e.target.value })}
                      placeholder="Max Mustermann"
                    />
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
                  <div className="space-y-2">
                    <Label htmlFor="registerNumber">Handelsregisternummer</Label>
                    <Input
                      id="registerNumber"
                      value={companyData.registerNumber}
                      onChange={(e) => setCompanyData({ ...companyData, registerNumber: e.target.value })}
                      placeholder="HRB 12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registerCourt">Registergericht</Label>
                    <Input
                      id="registerCourt"
                      value={companyData.registerCourt}
                      onChange={(e) => setCompanyData({ ...companyData, registerCourt: e.target.value })}
                      placeholder="Amtsgericht München"
                    />
                  </div>
                </div>

                {/* Kleinunternehmerregelung */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
                  <div>
                    <p className="font-medium">Kleinunternehmerregelung §19 UStG</p>
                    <p className="text-sm text-muted-foreground">Keine MwSt-Ausweis auf Rechnungen, §19-Hinweis wird automatisch eingefügt</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={companyData.smallBusinessRegulation}
                    onClick={() => setCompanyData({ ...companyData, smallBusinessRegulation: !companyData.smallBusinessRegulation })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      companyData.smallBusinessRegulation ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      companyData.smallBusinessRegulation ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
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

            {/* Bankverbindung Card */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Euro className="h-5 w-5" />Bankverbindung</CardTitle>
                <CardDescription>Wird auf Rechnungen als Zahlungsziel angezeigt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="primaryIban">IBAN</Label>
                    <Input
                      id="primaryIban"
                      value={companyData.primaryIban}
                      onChange={(e) => setCompanyData({ ...companyData, primaryIban: e.target.value })}
                      placeholder="DE89 3704 0044 0532 0130 00"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primaryBic">BIC</Label>
                    <Input
                      id="primaryBic"
                      value={companyData.primaryBic}
                      onChange={(e) => setCompanyData({ ...companyData, primaryBic: e.target.value })}
                      placeholder="COBADEFFXXX"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="primaryBankName">Kreditinstitut</Label>
                    <Input
                      id="primaryBankName"
                      value={companyData.primaryBankName}
                      onChange={(e) => setCompanyData({ ...companyData, primaryBankName: e.target.value })}
                      placeholder="Commerzbank AG"
                    />
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
          <TabsContent value="billing" className="mt-0">
            <BillingTab />
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

          {/* Mietanpassung Tab */}
          <TabsContent value="rent" className="mt-0 space-y-6">
            {/* Index Rent Calculator */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Indexmiete-Rechner
                </CardTitle>
                <CardDescription>
                  Berechnen Sie Mietanpassungen basierend auf dem Verbraucherpreisindex (VPI)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Base Values */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Basiswerte</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Basis-Kaltmiete (€)</Label>
                        <Input
                          type="number"
                          value={indexRent.baseRent}
                          onChange={(e) => setIndexRent({ ...indexRent, baseRent: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Monat</Label>
                          <Select
                            value={String(indexRent.baseVPIMonth)}
                            onValueChange={(v) => setIndexRent({ ...indexRent, baseVPIMonth: parseInt(v) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Jahr</Label>
                          <Input
                            type="number"
                            value={indexRent.baseVPIYear}
                            onChange={(e) => setIndexRent({ ...indexRent, baseVPIYear: parseInt(e.target.value) || 2020 })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Basis-VPI</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={indexRent.baseVPIValue}
                          onChange={(e) => setIndexRent({ ...indexRent, baseVPIValue: parseFloat(e.target.value) || 100 })}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Current Values */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Aktuelle Werte</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Monat</Label>
                          <Select
                            value={String(indexRent.currentVPIMonth)}
                            onValueChange={(v) => setIndexRent({ ...indexRent, currentVPIMonth: parseInt(v) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Jahr</Label>
                          <Input
                            type="number"
                            value={indexRent.currentVPIYear}
                            onChange={(e) => setIndexRent({ ...indexRent, currentVPIYear: parseInt(e.target.value) || 2026 })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Aktueller VPI</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={indexRent.currentVPIValue}
                          onChange={(e) => setIndexRent({ ...indexRent, currentVPIValue: parseFloat(e.target.value) || 100 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Schwellenwert für Anpassung (%)</Label>
                        <Input
                          type="number"
                          value={indexRent.threshold}
                          onChange={(e) => setIndexRent({ ...indexRent, threshold: parseFloat(e.target.value) || 5 })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Result */}
                <Card className={indexRentCalc.increasePercent >= indexRent.threshold ? 'border-success/50 bg-success/5' : 'border-muted'}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Berechnungsergebnis</h3>
                      {indexRentCalc.increasePercent >= indexRent.threshold && (
                        <Badge className="bg-success text-white">Schwellenwert erreicht</Badge>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Neue Kaltmiete</p>
                        <p className="text-2xl font-bold">{indexRentCalc.newRent.toFixed(2)} €</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Erhöhung</p>
                        <p className="text-2xl font-bold text-success">+{indexRentCalc.increasePercent.toFixed(2)} %</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Differenz</p>
                        <p className="text-2xl font-bold">+{(indexRentCalc.newRent - indexRent.baseRent).toFixed(2)} €</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      Formel: Neue Miete = Alte Miete × (Neuer VPI / Alter VPI)
                    </p>
                  </CardContent>
                </Card>

                <Button onClick={handleCreateRentIncreaseLetter} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Mieterhöhungsschreiben erstellen
                </Button>
              </CardContent>
            </Card>

            {/* CO2 Cost Allocation */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="h-5 w-5" />
                  CO2-Kostenaufteilung
                </CardTitle>
                <CardDescription>
                  Berechnung nach dem CO2-Kostenaufteilungsgesetz (CO2KostAufG)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Energieverbrauch (kWh/m²/Jahr)</Label>
                    <Input
                      type="number"
                      value={co2Data.energyConsumption}
                      onChange={(e) => setCO2Data({ ...co2Data, energyConsumption: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CO2-Preis (€/Tonne)</Label>
                    <Input
                      type="number"
                      value={co2Data.co2PricePerTon}
                      onChange={(e) => setCO2Data({ ...co2Data, co2PricePerTon: parseFloat(e.target.value) || 45 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gesamt CO2 (Tonnen)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={co2Data.totalCO2Tons}
                      onChange={(e) => setCO2Data({ ...co2Data, totalCO2Tons: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Category Display */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold">Einstufung: Kategorie {co2Allocation.category}</h3>
                        <p className="text-sm text-muted-foreground">
                          {co2Data.energyConsumption} kWh/m²/Jahr = Stufe {co2Allocation.category} von 10
                        </p>
                      </div>
                      <Badge variant="outline" className="text-lg px-4 py-2">
                        {co2Allocation.tenantShare}% / {co2Allocation.landlordShare}%
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Mieteranteil ({co2Allocation.tenantShare}%)</span>
                          <span className="font-medium">{co2Allocation.tenantCost.toFixed(2)} €</span>
                        </div>
                        <Progress value={co2Allocation.tenantShare} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Vermieteranteil ({co2Allocation.landlordShare}%)</span>
                          <span className="font-medium">{co2Allocation.landlordCost.toFixed(2)} €</span>
                        </div>
                        <Progress value={co2Allocation.landlordShare} className="h-2 [&>div]:bg-orange-500" />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t flex justify-between">
                      <span className="font-medium">Gesamte CO2-Kosten:</span>
                      <span className="font-bold">{co2Allocation.totalCO2Cost.toFixed(2)} €</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Info Box */}
                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium mb-1">CO2-Kostenaufteilungsgesetz (CO2KostAufG)</p>
                        <p className="text-muted-foreground">
                          Seit dem 1. Januar 2023 müssen Vermieter einen Anteil der CO2-Kosten beim Heizen mit fossilen Brennstoffen
                          übernehmen. Die Aufteilung richtet sich nach der energetischen Qualität des Gebäudes: Je schlechter
                          die Energiebilanz, desto höher der Vermieteranteil. Bei Gebäuden mit einem Verbrauch unter 12 kWh/m²/Jahr
                          trägt der Mieter 100% der Kosten; bei über 52 kWh/m²/Jahr übernimmt der Vermieter 95%.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 10-Step Scale Visualization */}
                <div>
                  <h4 className="font-medium mb-3">10-Stufen-Modell</h4>
                  <div className="grid grid-cols-10 gap-1">
                    {CO2_CATEGORIES.map((cat, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded text-center text-xs ${
                          co2Allocation.category === index + 1
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                            : 'bg-muted/50'
                        }`}
                      >
                        <div className="font-bold">{index + 1}</div>
                        <div className="text-[10px] opacity-80">
                          {cat.tenantShare}/{cat.landlordShare}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>≤12 kWh/m²</span>
                    <span>≥52 kWh/m²</span>
                  </div>
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

           {/* API Keys Tab */}
           <TabsContent value="api" className="mt-0 space-y-6">
             {/* OpenAI API Key */}
             <Card className="glass">
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <Key className="h-5 w-5" />
                   KI-Konfiguration (OpenAI)
                 </CardTitle>
                 <CardDescription>API-Schlüssel für KI-Assistent, Beleganalyse und Buchungsvorschläge</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <ApiKeyField label="OpenAI API-Schlüssel" storageKey="openai_api_key" placeholder="sk-proj-..." hint="Wird lokal im Browser gespeichert. Niemals an Dritte weitergeben." />
                 <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                   <p className="font-medium text-primary mb-1">Unterstützte Modelle</p>
                   <p className="text-muted-foreground">GPT-4o (Beleganalyse), GPT-4o-mini (KI-Assistent), GPT-4.1-nano (Buchungsvorschläge)</p>
                 </div>
               </CardContent>
             </Card>

             {/* FinAPI */}
             <Card className="glass">
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <CreditCard className="h-5 w-5" />
                   Bankanbindung (FinAPI)
                 </CardTitle>
                 <CardDescription>Automatischer Transaktionsimport aus Ihrem Bankkonto</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <ApiKeyField label="FinAPI Client ID" storageKey="finapi_client_id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                 <ApiKeyField label="FinAPI Client Secret" storageKey="finapi_client_secret" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                 <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                   <AlertTriangle className="h-4 w-4 shrink-0" />
                   <span>FinAPI-Zugangsdaten erhalten Sie unter finapi.io nach Registrierung.</span>
                 </div>
               </CardContent>
             </Card>

             {/* Webhook */}
             <Card className="glass">
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <Key className="h-5 w-5" />
                   Webhook-Konfiguration
                 </CardTitle>
                 <CardDescription>Echtzeit-Benachrichtigungen bei neuen Buchungen oder Rechnungen</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <ApiKeyField label="Webhook-URL" storageKey="webhook_url" placeholder="https://ihre-app.de/webhook/financial-compass" hint="POST-Request mit JSON-Payload bei jedem Ereignis" />
                 <div className="space-y-2">
                   <label className="text-sm font-medium">Ereignisse</label>
                   {['Neue Transaktion', 'Rechnung erstellt', 'Rechnung bezahlt', 'Neuer Beleg', 'Budget überschritten'].map((event) => (
                     <div key={event} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30">
                       <input type="checkbox" defaultChecked className="rounded" id={`webhook-${event}`} />
                       <label htmlFor={`webhook-${event}`} className="text-sm cursor-pointer">{event}</label>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>

             {/* API Token Generator */}
             <Card className="glass">
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <Key className="h-5 w-5" />
                   Persönliche API-Tokens
                 </CardTitle>
                 <CardDescription>Tokens für externe Integrationen (Zapier, Make, eigene Apps)</CardDescription>
               </CardHeader>
               <CardContent>
                 <ApiTokenGenerator />
               </CardContent>
             </Card>

             {/* API-Status */}
             <Card className="glass">
               <CardHeader>
                 <CardTitle>Verbindungsstatus</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="space-y-3">
                   {[
                     { name: 'Supabase Datenbank', connected: true },
                     { name: 'OpenAI KI-Gateway', connected: !!localStorage.getItem('openai_api_key') },
                     { name: 'FinAPI Bankanbindung', connected: !!localStorage.getItem('finapi_client_id') },
                     { name: 'DATEV Export', connected: true },
                   ].map(({ name, connected }) => (
                     <div key={name} className="flex items-center justify-between p-3 rounded-lg border">
                       <span className="text-sm">{name}</span>
                       <Badge className={connected ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}>
                         {connected ? 'Verbunden' : 'Nicht konfiguriert'}
                       </Badge>
                     </div>
                   ))}
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
