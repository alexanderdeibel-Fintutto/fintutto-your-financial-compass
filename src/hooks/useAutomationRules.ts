import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface AutomationRule {
  id: string;
  company_id: string;
  name: string;
  description: string;
  type: 'categorization' | 'reminder' | 'notification';
  is_active: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  created_at: string;
  updated_at: string;
}

export interface RuleCondition {
  field: 'description' | 'amount' | 'contact' | 'category' | 'due_date';
  operator: 'contains' | 'equals' | 'greater_than' | 'less_than' | 'days_before' | 'days_after';
  value: string | number;
}

export interface RuleAction {
  type: 'set_category' | 'send_email' | 'create_notification' | 'add_tag';
  value: string;
  template_id?: string;
}


const defaultRules: Omit<AutomationRule, 'id' | 'company_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Gehaltszahlungen kategorisieren',
    description: 'Buchungen mit "Gehalt" automatisch kategorisieren',
    type: 'categorization',
    is_active: true,
    conditions: [{ field: 'description', operator: 'contains', value: 'gehalt' }],
    actions: [{ type: 'set_category', value: 'Personalaufwand' }],
  },
  {
    name: 'Mietzahlungen kategorisieren',
    description: 'Buchungen mit "Miete" automatisch kategorisieren',
    type: 'categorization',
    is_active: true,
    conditions: [{ field: 'description', operator: 'contains', value: 'miete' }],
    actions: [{ type: 'set_category', value: 'Miete' }],
  },
  {
    name: 'Zahlungserinnerung 7 Tage',
    description: 'Benachrichtigung 7 Tage vor Fälligkeit',
    type: 'reminder',
    is_active: true,
    conditions: [{ field: 'due_date', operator: 'days_before', value: 7 }],
    actions: [{ type: 'create_notification', value: 'Rechnung wird in 7 Tagen fällig' }],
  },
  {
    name: '1. Mahnung nach 14 Tagen',
    description: 'Erste Mahnung 14 Tage nach Fälligkeit',
    type: 'reminder',
    is_active: true,
    conditions: [{ field: 'due_date', operator: 'days_after', value: 14 }],
    actions: [{ type: 'send_email', value: '1. Zahlungserinnerung', template_id: 'reminder_1' }],
  },
  {
    name: '2. Mahnung nach 28 Tagen',
    description: 'Zweite Mahnung 28 Tage nach Fälligkeit',
    type: 'reminder',
    is_active: true,
    conditions: [{ field: 'due_date', operator: 'days_after', value: 28 }],
    actions: [{ type: 'send_email', value: '2. Zahlungserinnerung', template_id: 'reminder_2' }],
  },
];

export function useAutomationRules() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      loadRules();
    }
  }, [currentCompany]);

  const loadRules = async () => {
    if (!currentCompany) return;
    setLoading(true);

    const { data, error } = await (supabase as any)
      .from('automation_rules')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: true });

    if (error) { setLoading(false); return; }

    let companyRules: AutomationRule[] = data || [];

    // Seed default rules for new companies
    if (companyRules.length === 0) {
      const seeds = defaultRules.map((rule) => ({ ...rule, company_id: currentCompany.id }));
      const { data: seeded } = await (supabase as any)
        .from('automation_rules').insert(seeds).select();
      companyRules = seeded || [];
    }

    setRules(companyRules);
    setLoading(false);
  };

  const createRule = useCallback(
    async (data: Omit<AutomationRule, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => {
      if (!currentCompany) return null;
      const { data: created, error } = await (supabase as any)
        .from('automation_rules')
        .insert({ ...data, company_id: currentCompany.id })
        .select().single();
      if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return null; }
      setRules((prev) => [...prev, created]);
      toast({ title: 'Erfolg', description: 'Automatisierungsregel wurde erstellt.' });
      return created as AutomationRule;
    },
    [currentCompany, toast]
  );

  const updateRule = useCallback(
    async (id: string, data: Partial<AutomationRule>) => {
      const { data: updated, error } = await (supabase as any)
        .from('automation_rules').update(data).eq('id', id).select().single();
      if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return null; }
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
      toast({ title: 'Erfolg', description: 'Automatisierungsregel wurde aktualisiert.' });
      return updated as AutomationRule;
    },
    [toast]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      const { error } = await (supabase as any).from('automation_rules').delete().eq('id', id);
      if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast({ title: 'Erfolg', description: 'Automatisierungsregel wurde gelöscht.' });
    },
    [toast]
  );

  const toggleRule = useCallback(
    async (id: string) => {
      const rule = rules.find((r) => r.id === id);
      if (rule) {
        await updateRule(id, { is_active: !rule.is_active });
      }
    },
    [rules, updateRule]
  );

  return {
    rules,
    loading,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  };
}
