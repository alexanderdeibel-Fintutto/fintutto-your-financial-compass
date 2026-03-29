import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';

export interface RecurringTransaction {
  id: string;
  company_id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  day_of_month?: number;
  day_of_week?: number;
  start_date: string;
  end_date?: string;
  next_execution: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function calculateNextExecution(
  frequency: RecurringTransaction['frequency'],
  fromDate: string,
  dayOfMonth?: number,
  dayOfWeek?: number
): string {
  const now = new Date();
  const start = new Date(fromDate);
  let next = new Date(Math.max(now.getTime(), start.getTime()));

  switch (frequency) {
    case 'daily':
      if (next <= now) next.setDate(next.getDate() + 1);
      break;
    case 'weekly': {
      const targetDay = dayOfWeek ?? next.getDay();
      const daysUntil = (targetDay - next.getDay() + 7) % 7 || 7;
      next.setDate(next.getDate() + daysUntil);
      break;
    }
    case 'monthly': {
      const targetDom = dayOfMonth ?? next.getDate();
      if (next.getDate() >= targetDom) next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(targetDom, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
    }
    case 'quarterly':
      next.setMonth(Math.floor(next.getMonth() / 3) * 3 + 3);
      next.setDate(dayOfMonth ?? 1);
      break;
    case 'yearly':
      if (next.getMonth() > start.getMonth() ||
        (next.getMonth() === start.getMonth() && next.getDate() >= (dayOfMonth ?? start.getDate()))) {
        next.setFullYear(next.getFullYear() + 1);
      }
      next.setMonth(start.getMonth());
      next.setDate(dayOfMonth ?? start.getDate());
      break;
  }
  return next.toISOString().split('T')[0];
}

export function useRecurringTransactions() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    if (!currentCompany) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('next_execution', { ascending: true });
    if (!error && data) {
      // Map snake_case DB fields to camelCase interface
      setRecurringTransactions(data.map((r: any) => ({
        ...r,
        next_execution: r.next_date ?? r.next_execution,
        day_of_month: r.day_of_month,
        day_of_week: r.day_of_week,
      })));
    }
    setLoading(false);
  }, [currentCompany]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const createRecurringTransaction = useCallback(
    async (data: Omit<RecurringTransaction, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'next_execution'>) => {
      if (!currentCompany) return null;
      const nextExecution = calculateNextExecution(data.frequency, data.start_date, data.day_of_month, data.day_of_week);
      const { data: inserted, error } = await supabase.from('recurring_transactions').insert({
        company_id: currentCompany.id,
        description: data.description,
        amount: data.amount,
        type: data.type,
        category: data.category,
        frequency: data.frequency,
        start_date: data.start_date,
        end_date: data.end_date || null,
        next_date: nextExecution,
        is_active: data.is_active ?? true,
      }).select().single();
      if (error) {
        toast({ title: 'Fehler', description: 'Buchung konnte nicht erstellt werden.', variant: 'destructive' });
        return null;
      }
      toast({ title: 'Erfolg', description: 'Wiederkehrende Buchung wurde erstellt.' });
      await loadTransactions();
      return { ...inserted, next_execution: inserted.next_date } as RecurringTransaction;
    },
    [currentCompany, toast, loadTransactions]
  );

  const updateRecurringTransaction = useCallback(
    async (id: string, data: Partial<RecurringTransaction>) => {
      const existing = recurringTransactions.find(t => t.id === id);
      if (!existing) return null;
      const merged = { ...existing, ...data };
      let nextDate = merged.next_execution;
      if (data.frequency || data.start_date || data.day_of_month || data.day_of_week) {
        nextDate = calculateNextExecution(merged.frequency, merged.start_date, merged.day_of_month, merged.day_of_week);
      }
      const { error } = await supabase.from('recurring_transactions').update({
        description: merged.description,
        amount: merged.amount,
        type: merged.type,
        category: merged.category,
        frequency: merged.frequency,
        start_date: merged.start_date,
        end_date: merged.end_date || null,
        next_date: nextDate,
        is_active: merged.is_active,
      }).eq('id', id);
      if (error) {
        toast({ title: 'Fehler', description: 'Buchung konnte nicht aktualisiert werden.', variant: 'destructive' });
        return null;
      }
      toast({ title: 'Erfolg', description: 'Wiederkehrende Buchung wurde aktualisiert.' });
      await loadTransactions();
      return { ...merged, next_execution: nextDate };
    },
    [recurringTransactions, toast, loadTransactions]
  );

  const deleteRecurringTransaction = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
      if (error) {
        toast({ title: 'Fehler', description: 'Buchung konnte nicht gelöscht werden.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Erfolg', description: 'Wiederkehrende Buchung wurde gelöscht.' });
      await loadTransactions();
    },
    [toast, loadTransactions]
  );

  const executeRecurringTransaction = useCallback(
    async (recurring: RecurringTransaction) => {
      if (!currentCompany) return null;
      const { error, data } = await supabase.from('transactions').insert({
        company_id: currentCompany.id,
        type: recurring.type,
        amount: recurring.amount,
        description: `[Wiederkehrend] ${recurring.description}`,
        category: recurring.category,
        date: new Date().toISOString().split('T')[0],
      }).select().single();
      if (error) {
        toast({ title: 'Fehler', description: 'Buchung konnte nicht ausgeführt werden.', variant: 'destructive' });
        return null;
      }
      const nextExecution = calculateNextExecution(
        recurring.frequency, recurring.next_execution, recurring.day_of_month, recurring.day_of_week
      );
      await updateRecurringTransaction(recurring.id, { next_execution: nextExecution });
      toast({ title: 'Erfolg', description: `Buchung "${recurring.description}" wurde ausgeführt.` });
      return data;
    },
    [currentCompany, toast, updateRecurringTransaction]
  );

  const checkAndExecuteDueTransactions = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const due = recurringTransactions.filter(
      t => t.is_active && t.next_execution <= today && (!t.end_date || t.end_date >= today)
    );
    for (const t of due) await executeRecurringTransaction(t);
    return due.length;
  }, [recurringTransactions, executeRecurringTransaction]);

  return {
    recurringTransactions, loading,
    createRecurringTransaction, updateRecurringTransaction,
    deleteRecurringTransaction, executeRecurringTransaction,
    checkAndExecuteDueTransactions,
  };
}
