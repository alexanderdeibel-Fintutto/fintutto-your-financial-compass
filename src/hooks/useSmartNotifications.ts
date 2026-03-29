/**
 * useSmartNotifications – Proaktive Benachrichtigungs-Engine
 *
 * Prüft beim App-Start und in regelmäßigen Abständen auf:
 * - Überfällige Rechnungen (sofort + täglich)
 * - Rechnungen die in 3 Tagen fällig werden
 * - Monatliche Ausgaben > 20% über Vormonat
 * - Neue Belege ohne Kategorie
 * - Fällige wiederkehrende Buchungen
 */

import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 Minuten
const LAST_CHECK_KEY = 'fintutto_smart_notifications_last_check';

async function createNotification(
  userId: string,
  type: 'info' | 'success' | 'warning' | 'error',
  title: string,
  message: string,
  link?: string
) {
  // Check for duplicate in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .gte('created_at', since)
    .limit(1);

  if (existing && existing.length > 0) return; // Already notified today

  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    link,
    read: false,
  });
}

export function useSmartNotifications() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runChecks = useCallback(async () => {
    if (!currentCompany || !user) return;

    const today = new Date().toISOString().split('T')[0];
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const companyId = currentCompany.id;
    const userId = user.id;

    // ── 1. Überfällige Rechnungen ──────────────────────────────────────────
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, amount, due_date, contact_name')
      .eq('company_id', companyId)
      .eq('status', 'sent')
      .lt('due_date', today);

    if (overdueInvoices && overdueInvoices.length > 0) {
      const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.amount), 0);
      await createNotification(
        userId,
        'error',
        `${overdueInvoices.length} überfällige Rechnung${overdueInvoices.length > 1 ? 'en' : ''}`,
        `Offener Betrag: ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalOverdue)}. Bitte Mahnungen versenden.`,
        '/rechnungen'
      );
    }

    // ── 2. Rechnungen fällig in 3 Tagen ───────────────────────────────────
    const { data: soonDue } = await supabase
      .from('invoices')
      .select('id, invoice_number, amount, due_date, contact_name')
      .eq('company_id', companyId)
      .eq('status', 'sent')
      .gte('due_date', today)
      .lte('due_date', in3Days);

    if (soonDue && soonDue.length > 0) {
      await createNotification(
        userId,
        'warning',
        `${soonDue.length} Rechnung${soonDue.length > 1 ? 'en' : ''} bald fällig`,
        `In den nächsten 3 Tagen fällig: ${soonDue.map(i => i.invoice_number || i.id.slice(0, 8)).join(', ')}`,
        '/rechnungen'
      );
    }

    // ── 3. Ausgaben > 20% über Vormonat ───────────────────────────────────
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const [thisMonthRes, lastMonthRes] = await Promise.all([
      supabase.from('transactions').select('amount')
        .eq('company_id', companyId).eq('type', 'expense')
        .gte('date', thisMonthStart).lte('date', today),
      supabase.from('transactions').select('amount')
        .eq('company_id', companyId).eq('type', 'expense')
        .gte('date', lastMonthStart).lte('date', lastMonthEnd),
    ]);

    const thisMonthExpenses = (thisMonthRes.data || []).reduce((s, t) => s + Number(t.amount), 0);
    const lastMonthExpenses = (lastMonthRes.data || []).reduce((s, t) => s + Number(t.amount), 0);
    const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);

    if (lastMonthExpenses > 0 && thisMonthExpenses > lastMonthExpenses * 1.2) {
      const pct = Math.round((thisMonthExpenses / lastMonthExpenses - 1) * 100);
      await createNotification(
        userId,
        'warning',
        `Ausgaben +${pct}% gegenüber Vormonat`,
        `Aktuell: ${fmt(thisMonthExpenses)} vs. Vormonat: ${fmt(lastMonthExpenses)}. Bitte Ausgaben prüfen.`,
        '/buchungen'
      );
    }

    // ── 4. Belege ohne Kategorie ───────────────────────────────────────────
    const { data: uncategorized } = await supabase
      .from('receipts')
      .select('id')
      .eq('company_id', companyId)
      .is('category', null)
      .limit(10);

    if (uncategorized && uncategorized.length >= 3) {
      await createNotification(
        userId,
        'info',
        `${uncategorized.length} Belege ohne Kategorie`,
        'Bitte kategorisieren Sie die offenen Belege für eine korrekte Buchhaltung.',
        '/belege'
      );
    }

    // ── 5. Fällige wiederkehrende Buchungen ────────────────────────────────
    const { data: dueRecurring } = await supabase
      .from('recurring_transactions')
      .select('id, description, amount')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .lte('next_date', today);

    if (dueRecurring && dueRecurring.length > 0) {
      await createNotification(
        userId,
        'info',
        `${dueRecurring.length} wiederkehrende Buchung${dueRecurring.length > 1 ? 'en' : ''} fällig`,
        `Fällig: ${dueRecurring.map(r => r.description).slice(0, 3).join(', ')}${dueRecurring.length > 3 ? ' ...' : ''}`,
        '/wiederkehrend'
      );
    }

    // ── 6. UStVA-Erinnerung (10. des Folgemonats) ─────────────────────────
    const dayOfMonth = now.getDate();
    if (dayOfMonth >= 1 && dayOfMonth <= 3) {
      await createNotification(
        userId,
        'warning',
        'UStVA-Abgabe bis 10. des Monats',
        `Die Umsatzsteuer-Voranmeldung für ${new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('de-DE', { month: 'long' })} ist bis zum 10. fällig.`,
        '/elster'
      );
    }

    // Update last check timestamp
    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
  }, [currentCompany, user]);

  useEffect(() => {
    if (!currentCompany || !user) return;

    // Check if we should run (not run in last 30 min)
    const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0');
    const shouldRun = Date.now() - lastCheck > CHECK_INTERVAL_MS;

    if (shouldRun) {
      // Small delay to not block initial render
      const timeout = setTimeout(runChecks, 3000);
      return () => clearTimeout(timeout);
    }

    // Set up interval for periodic checks
    timerRef.current = setInterval(runChecks, CHECK_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentCompany, user, runChecks]);

  return { runChecks };
}
