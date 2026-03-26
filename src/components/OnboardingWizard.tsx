/**
 * OnboardingWizard — vollständiger Firmen-Onboarding-Flow
 * 6 Schritte: Willkommen → Firmentyp → Firmendaten → Bankkonto → Logo → Fertig
 */
import { useState, useRef } from 'react';
import {
  Check, Building2, CreditCard, Sparkles,
  ChevronRight, ChevronLeft, Upload, Briefcase, Users, BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

const steps = [
  { id: 'welcome',  title: 'Willkommen',  icon: Sparkles   },
  { id: 'type',     title: 'Firmentyp',   icon: Briefcase  },
  { id: 'company',  title: 'Firmendaten', icon: Building2  },
  { id: 'bank',     title: 'Bankkonto',   icon: CreditCard },
  { id: 'logo',     title: 'Logo',        icon: Upload     },
  { id: 'done',     title: 'Fertig',      icon: Check      },
];

const legalForms = [
  { value: 'einzelunternehmen', label: 'Einzelunternehmen / Freiberufler' },
  { value: 'gbr',               label: 'GbR' },
  { value: 'ug',                label: 'UG (haftungsbeschränkt)' },
  { value: 'gmbh',              label: 'GmbH' },
  { value: 'gmbh_co_kg',        label: 'GmbH & Co. KG' },
  { value: 'ag',                label: 'Aktiengesellschaft (AG)' },
  { value: 'kg',                label: 'KG' },
  { value: 'ohg',               label: 'OHG' },
];

const companyTypes = [
  { value: 'freelancer',  label: 'Freelancer / Freiberufler',  description: 'Ich bin selbstständig und stelle Rechnungen als Einzelperson.',              icon: Briefcase  },
  { value: 'gmbh',        label: 'Eigene GmbH / UG',           description: 'Ich bin Gesellschafter und/oder Geschäftsführer einer Kapitalgesellschaft.', icon: Building2  },
  { value: 'beteiligung', label: 'Beteiligung',                 description: 'Ich bin Gesellschafter, aber nicht operativ tätig (stille Beteiligung).',    icon: BarChart2  },
  { value: 'gf_mandat',   label: 'GF-Mandat (Fremd-GF)',       description: 'Ich verwalte eine Firma als Geschäftsführer, bin aber nicht Eigentümer.',    icon: Users      },
];

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [companyType, setCompanyType] = useState('');
  const [companyData, setCompanyData] = useState({
    name: '', legalForm: '', street: '', zip: '', city: '',
    taxNumber: '', vatId: '', registerNumber: '', registerCourt: '',
    managingDirector: '', isManagingDirector: false, ownershipPercentage: '',
    phone: '', email: '', website: '', smallBusinessRegulation: false,
  });
  const [bankData, setBankData] = useState({ iban: '', bic: '', bankName: '' });

  const progress = ((currentStep + 1) / steps.length) * 100;
  const nextStep = () => { if (currentStep < steps.length - 1) setCurrentStep(s => s + 1); };
  const prevStep = () => { if (currentStep > 0) setCurrentStep(s => s - 1); };

  const handleLogoChange = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const saveAndComplete = async () => {
    if (!companyData.name || !user) return;
    setLoading(true);
    try {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyData.name,
          legal_form: companyData.legalForm || null,
          street: companyData.street || null,
          zip: companyData.zip || null,
          city: companyData.city || null,
          tax_number: companyData.taxNumber || null,
          vat_id: companyData.vatId || null,
          register_number: companyData.registerNumber || null,
          register_court: companyData.registerCourt || null,
          managing_director: companyData.managingDirector || null,
          is_managing_director: companyData.isManagingDirector,
          ownership_percentage: companyData.ownershipPercentage ? parseFloat(companyData.ownershipPercentage) : null,
          phone: companyData.phone || null,
          email: companyData.email || null,
          website: companyData.website || null,
          small_business_regulation: companyData.smallBusinessRegulation,
          company_type: companyType || 'freelancer',
          primary_iban: bankData.iban || null,
          primary_bic: bankData.bic || null,
          primary_bank_name: bankData.bankName || null,
          onboarding_completed: true,
          onboarding_step: steps.length,
        })
        .select().single();
      if (companyError) throw companyError;
      if (logoFile && company) {
        const ext = logoFile.name.split('.').pop();
        const path = `company-logos/${company.id}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage.from('company-assets').upload(path, logoFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(path);
          await supabase.from('companies').update({ logo_url: urlData.publicUrl }).eq('id', company.id);
        }
      }
      if (bankData.iban && company) {
        await supabase.from('bank_accounts').insert({
          company_id: company.id,
          name: bankData.bankName || 'Geschäftskonto',
          iban: bankData.iban,
          bic: bankData.bic || null,
        });
      }
      toast({ title: 'Firma angelegt!', description: `${companyData.name} wurde erfolgreich eingerichtet.` });
      onComplete();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    const stepId = steps[currentStep].id;

    if (stepId === 'welcome') return (
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Willkommen bei Financial Compass!</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Ihre zentrale Schaltzentrale für alle Firmen — Rechnungen, Banking, Steuern und mehr.
          </p>
        </div>
        <div className="grid gap-3 mt-6 text-left">
          {[
            { icon: Building2,  title: 'Multi-Company',            description: 'Freelancer, GmbH, Beteiligungen — alles in einer App' },
            { icon: CreditCard, title: 'Banking-Sync',             description: 'Kontoauszüge automatisch importieren und zuordnen' },
            { icon: Upload,     title: 'GoBD-konforme Rechnungen', description: 'Professionelle PDFs mit Logo und allen Pflichtangaben' },
          ].map((f) => (
            <Card key={f.title}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="p-2 rounded-lg bg-primary/10"><f.icon className="h-5 w-5 text-primary" /></div>
                <div><p className="font-medium">{f.title}</p><p className="text-sm text-muted-foreground">{f.description}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );

    if (stepId === 'type') return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold">Was trifft auf Sie zu?</h2>
          <p className="text-muted-foreground text-sm">Sie können später weitere Firmen hinzufügen.</p>
        </div>
        <div className="grid gap-3">
          {companyTypes.map((type) => (
            <button key={type.value} onClick={() => setCompanyType(type.value)}
              className={cn('flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all w-full',
                companyType === type.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}>
              <div className={cn('p-2 rounded-lg mt-0.5', companyType === type.value ? 'bg-primary/10' : 'bg-muted')}>
                <type.icon className={cn('h-5 w-5', companyType === type.value ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{type.label}</p>
                <p className="text-sm text-muted-foreground">{type.description}</p>
              </div>
              {companyType === type.value && <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    );

    if (stepId === 'company') return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold">Firmendaten</h2>
          <p className="text-sm text-muted-foreground">Diese Daten erscheinen auf Ihren Rechnungen.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Firmenname *</Label>
            <Input value={companyData.name} onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })} placeholder="z.B. Muster GmbH" />
          </div>
          <div className="space-y-1">
            <Label>Rechtsform</Label>
            <Select value={companyData.legalForm} onValueChange={(v) => setCompanyData({ ...companyData, legalForm: v })}>
              <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
              <SelectContent>{legalForms.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Steuernummer</Label>
            <Input value={companyData.taxNumber} onChange={(e) => setCompanyData({ ...companyData, taxNumber: e.target.value })} placeholder="123/456/78901" />
          </div>
          <div className="space-y-1">
            <Label>USt-IdNr.</Label>
            <Input value={companyData.vatId} onChange={(e) => setCompanyData({ ...companyData, vatId: e.target.value })} placeholder="DE123456789" />
          </div>
          <div className="space-y-1">
            <Label>Straße und Hausnummer</Label>
            <Input value={companyData.street} onChange={(e) => setCompanyData({ ...companyData, street: e.target.value })} placeholder="Musterstraße 1" />
          </div>
          <div className="space-y-1">
            <Label>PLZ</Label>
            <Input value={companyData.zip} onChange={(e) => setCompanyData({ ...companyData, zip: e.target.value })} placeholder="12345" />
          </div>
          <div className="space-y-1">
            <Label>Stadt</Label>
            <Input value={companyData.city} onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })} placeholder="München" />
          </div>
          {(companyType === 'gmbh' || companyType === 'gf_mandat') && (
            <>
              <div className="space-y-1">
                <Label>HRB-Nummer</Label>
                <Input value={companyData.registerNumber} onChange={(e) => setCompanyData({ ...companyData, registerNumber: e.target.value })} placeholder="12345" />
              </div>
              <div className="space-y-1">
                <Label>Registergericht</Label>
                <Input value={companyData.registerCourt} onChange={(e) => setCompanyData({ ...companyData, registerCourt: e.target.value })} placeholder="Amtsgericht München" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Geschäftsführer</Label>
                <Input value={companyData.managingDirector} onChange={(e) => setCompanyData({ ...companyData, managingDirector: e.target.value })} placeholder="Max Mustermann" />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Switch checked={companyData.isManagingDirector} onCheckedChange={(v) => setCompanyData({ ...companyData, isManagingDirector: v })} />
                <Label>Ich bin selbst Geschäftsführer dieser Firma</Label>
              </div>
            </>
          )}
          {companyType === 'beteiligung' && (
            <div className="space-y-1">
              <Label>Beteiligungsquote (%)</Label>
              <Input type="number" min="0" max="100" value={companyData.ownershipPercentage} onChange={(e) => setCompanyData({ ...companyData, ownershipPercentage: e.target.value })} placeholder="z.B. 25" />
            </div>
          )}
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <Switch checked={companyData.smallBusinessRegulation} onCheckedChange={(v) => setCompanyData({ ...companyData, smallBusinessRegulation: v })} />
            <div>
              <Label>Kleinunternehmerregelung (§19 UStG)</Label>
              <p className="text-xs text-muted-foreground">Keine Umsatzsteuer auf Rechnungen ausweisen</p>
            </div>
          </div>
        </div>
      </div>
    );

    if (stepId === 'bank') return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Bankverbindung</h2>
          <p className="text-sm text-muted-foreground">Diese IBAN erscheint auf Ihren Rechnungen.</p>
        </div>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>IBAN</Label>
            <Input value={bankData.iban}
              onChange={(e) => setBankData({ ...bankData, iban: e.target.value.replace(/\s/g, '').toUpperCase() })}
              placeholder="DE89370400440532013000" className="font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>BIC / SWIFT</Label>
              <Input value={bankData.bic} onChange={(e) => setBankData({ ...bankData, bic: e.target.value.toUpperCase() })} placeholder="COBADEFFXXX" className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label>Bank</Label>
              <Input value={bankData.bankName} onChange={(e) => setBankData({ ...bankData, bankName: e.target.value })} placeholder="Commerzbank" />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center pt-2">Optional — Sie können die Bankverbindung später in den Einstellungen hinterlegen.</p>
      </div>
    );

    if (stepId === 'logo') return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Firmenlogo</h2>
          <p className="text-sm text-muted-foreground">Ihr Logo erscheint auf Rechnungen und im Dashboard.</p>
        </div>
        <div
          className={cn('border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            logoPreview ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}
          onClick={() => logoInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleLogoChange(file); }}
        >
          {logoPreview ? (
            <div className="flex flex-col items-center gap-3">
              <img src={logoPreview} alt="Logo-Vorschau" className="max-h-24 max-w-48 object-contain" />
              <p className="text-sm text-muted-foreground">Klicken zum Ändern</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Upload className="h-10 w-10" />
              <p className="font-medium">Logo hier ablegen oder klicken</p>
              <p className="text-xs">PNG, JPG oder SVG · max. 2 MB</p>
            </div>
          )}
        </div>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoChange(file); }} />
        <p className="text-xs text-muted-foreground text-center">Optional — Sie können das Logo auch später hochladen.</p>
      </div>
    );

    if (stepId === 'done') return (
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Alles bereit!</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            <strong>{companyData.name}</strong> wurde eingerichtet.
          </p>
        </div>
        <div className="grid gap-3 text-left">
          {[
            { done: true,            label: 'Firma angelegt' },
            { done: !!bankData.iban, label: 'Bankverbindung hinterlegt' },
            { done: !!logoPreview,   label: 'Logo hochgeladen' },
            { done: false,           label: 'Erste Rechnung erstellen (als nächstes)' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                item.done ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted')}>
                <Check className={cn('h-3.5 w-3.5', item.done ? 'text-green-600' : 'text-muted-foreground')} />
              </div>
              <span className={cn('text-sm', !item.done && 'text-muted-foreground')}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );

    return null;
  };

  const isNextDisabled = () => {
    if (steps[currentStep].id === 'type' && !companyType) return true;
    if (steps[currentStep].id === 'company' && !companyData.name.trim()) return true;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Firma einrichten</DialogTitle>
          <DialogDescription className="sr-only">Onboarding-Assistent</DialogDescription>
        </DialogHeader>
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {steps.map((step, i) => (
              <div key={step.id} className={cn('flex flex-col items-center gap-1',
                i <= currentStep ? 'text-primary' : 'text-muted-foreground')}>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors',
                  i < currentStep ? 'bg-primary border-primary text-primary-foreground' :
                  i === currentStep ? 'border-primary bg-primary/10' : 'border-muted-foreground/30')}>
                  {i < currentStep ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                </div>
                <span className="text-[10px] hidden sm:block">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
        <div className="min-h-[300px]">{renderStep()}</div>
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button variant="ghost" onClick={prevStep} disabled={currentStep === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" />Zurück
          </Button>
          {currentStep === steps.length - 1 ? (
            <Button onClick={saveAndComplete} disabled={loading}>
              {loading ? 'Wird gespeichert...' : 'Loslegen'}<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={nextStep} disabled={isNextDisabled()}>
              {steps[currentStep].id === 'bank' || steps[currentStep].id === 'logo' ? 'Überspringen' : 'Weiter'}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
