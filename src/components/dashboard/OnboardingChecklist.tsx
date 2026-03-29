/**
 * OnboardingChecklist – Interaktive Onboarding-Checkliste für neue Nutzer
 * Führt Nutzer durch die wichtigsten Setup-Schritte
 * Verschwindet automatisch wenn alle Schritte abgeschlossen sind
 */
import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ChevronRight, X, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  url: string;
  completed: boolean;
}

const CHECKLIST_STEPS_BASE: Omit<ChecklistStep, 'completed'>[] = [
  { id: 'company', title: 'Firmenprofil vervollständigen', description: 'Name, Adresse, Steuernummer und Logo hinzufügen', url: '/einstellungen' },
  { id: 'bank', title: 'Bankkonto verknüpfen', description: 'Automatische Transaktions-Synchronisation aktivieren', url: '/bankkonten' },
  { id: 'contact', title: 'Ersten Kontakt anlegen', description: 'Kunden oder Lieferanten hinzufügen', url: '/kontakte' },
  { id: 'invoice', title: 'Erste Rechnung erstellen', description: 'Professionelle Rechnung in unter 2 Minuten', url: '/rechnungen' },
  { id: 'budget', title: 'Budget definieren', description: 'Monatliche Budgets für Kategorien festlegen', url: '/budget' },
  { id: 'tax', title: 'Steuereinstellungen konfigurieren', description: 'USt-Satz, Steuernummer und Finanzamt eintragen', url: '/einstellungen' },
];

export function OnboardingChecklist() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [steps, setSteps] = useState<ChecklistStep[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = `onboarding_dismissed_${currentCompany?.id}`;
    if (localStorage.getItem(key) === 'true') {
      setDismissed(true);
      setLoading(false);
      return;
    }

    async function checkCompletion() {
      if (!currentCompany) { setLoading(false); return; }
      try {
        const [contactsRes, invoicesRes, budgetsRes, banksRes] = await Promise.all([
          supabase.from('contacts').select('id').eq('company_id', currentCompany.id).limit(1),
          supabase.from('invoices').select('id').eq('company_id', currentCompany.id).limit(1),
          supabase.from('budgets').select('id').eq('company_id', currentCompany.id).limit(1),
          supabase.from('bank_accounts').select('id').eq('company_id', currentCompany.id).limit(1),
        ]);

        const hasContacts = (contactsRes.data?.length || 0) > 0;
        const hasInvoices = (invoicesRes.data?.length || 0) > 0;
        const hasBudgets = (budgetsRes.data?.length || 0) > 0;
        const hasBanks = (banksRes.data?.length || 0) > 0;
        const hasCompanyProfile = !!(currentCompany.name && currentCompany.address);
        const hasTaxSettings = !!(currentCompany.tax_number || currentCompany.vat_number);

        const completionMap: Record<string, boolean> = {
          company: hasCompanyProfile,
          bank: hasBanks,
          contact: hasContacts,
          invoice: hasInvoices,
          budget: hasBudgets,
          tax: hasTaxSettings,
        };

        const stepsWithCompletion = CHECKLIST_STEPS_BASE.map(s => ({
          ...s,
          completed: completionMap[s.id] || false,
        }));

        setSteps(stepsWithCompletion);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    checkCompletion();
  }, [currentCompany]);

  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const allCompleted = completedCount === totalCount;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const dismiss = () => {
    const key = `onboarding_dismissed_${currentCompany?.id}`;
    localStorage.setItem(key, 'true');
    setDismissed(true);
  };

  if (dismissed || loading || allCompleted) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Einrichtung abschließen
            <span className="text-sm font-normal text-muted-foreground ml-1">({completedCount}/{totalCount})</span>
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={dismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="h-2 mt-1" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {steps.map(step => (
            <button
              key={step.id}
              onClick={() => navigate(step.url)}
              disabled={step.completed}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${step.completed ? 'opacity-50 cursor-default' : 'hover:bg-muted/50 cursor-pointer'}`}
            >
              {step.completed
                ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                : <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.completed ? 'line-through text-muted-foreground' : ''}`}>{step.title}</p>
                {!step.completed && <p className="text-xs text-muted-foreground">{step.description}</p>}
              </div>
              {!step.completed && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground" onClick={dismiss}>
          Nicht mehr anzeigen
        </Button>
      </CardContent>
    </Card>
  );
}
