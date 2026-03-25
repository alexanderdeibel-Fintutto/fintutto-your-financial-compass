-- Migration: Auto-Matching Support
-- Erweitert transactions und invoices für automatisches Matching

-- 1. Transaktionen: matched_invoice_id Spalte hinzufügen (falls nicht vorhanden)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS matched_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_confidence INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS match_status TEXT CHECK (match_status IN ('pending', 'confirmed', 'rejected')) DEFAULT NULL;

-- 2. Index für schnelles Matching nach Betrag und Datum
CREATE INDEX IF NOT EXISTS idx_transactions_amount_date ON public.transactions(company_id, amount, date);
CREATE INDEX IF NOT EXISTS idx_invoices_amount_status ON public.invoices(company_id, amount, status);

-- 3. Funktion: Offene Rechnungen mit passenden Transaktionen abgleichen
-- Gibt Matches zurück, die noch nicht bestätigt wurden
CREATE OR REPLACE FUNCTION public.find_transaction_matches(p_company_id UUID)
RETURNS TABLE (
  transaction_id UUID,
  invoice_id UUID,
  transaction_amount DECIMAL,
  invoice_amount DECIMAL,
  amount_diff DECIMAL,
  transaction_date DATE,
  invoice_due_date DATE,
  days_diff INTEGER,
  invoice_number TEXT,
  transaction_description TEXT
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    t.id AS transaction_id,
    i.id AS invoice_id,
    t.amount AS transaction_amount,
    i.amount AS invoice_amount,
    ABS(t.amount - i.amount) AS amount_diff,
    t.date AS transaction_date,
    i.due_date AS invoice_due_date,
    ABS(EXTRACT(DAY FROM (t.date::timestamp - i.due_date::timestamp))::integer) AS days_diff,
    i.invoice_number,
    t.description AS transaction_description
  FROM public.transactions t
  CROSS JOIN public.invoices i
  WHERE 
    t.company_id = p_company_id
    AND i.company_id = p_company_id
    AND t.type = 'income'
    AND i.type = 'outgoing'
    AND i.status IN ('sent', 'overdue')
    AND t.matched_invoice_id IS NULL
    AND ABS(t.amount - i.amount) <= i.amount * 0.05  -- 5% Toleranz
  ORDER BY amount_diff ASC, days_diff ASC
  LIMIT 100;
$$;

-- 4. Funktion: Match bestätigen (Rechnung als bezahlt markieren)
CREATE OR REPLACE FUNCTION public.confirm_transaction_match(
  p_transaction_id UUID,
  p_invoice_id UUID,
  p_confidence INTEGER DEFAULT 100
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Transaktion aktualisieren
  UPDATE public.transactions
  SET 
    matched_invoice_id = p_invoice_id,
    match_confidence = p_confidence,
    match_status = 'confirmed',
    category = COALESCE(category, 'Einnahmen'),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- Rechnung als bezahlt markieren
  UPDATE public.invoices
  SET 
    status = 'paid',
    updated_at = now()
  WHERE id = p_invoice_id;
END;
$$;

-- 5. bank_accounts: last_sync Spalte hinzufügen
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS last_sync TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS finapi_account_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sync_status TEXT CHECK (sync_status IN ('active', 'error', 'pending')) DEFAULT 'active';

-- 6. RLS: Neue Spalten sind durch bestehende Policies abgedeckt (company_id-basiert)
-- Keine neuen Policies notwendig

COMMENT ON COLUMN public.transactions.matched_invoice_id IS 'Verknüpfte Rechnung nach Auto-Matching';
COMMENT ON COLUMN public.transactions.match_confidence IS 'Konfidenz des Matches in Prozent (0-100)';
COMMENT ON COLUMN public.transactions.match_status IS 'Status des Matches: pending/confirmed/rejected';
COMMENT ON COLUMN public.bank_accounts.last_sync IS 'Zeitpunkt der letzten Synchronisierung';
COMMENT ON COLUMN public.bank_accounts.finapi_account_id IS 'FinAPI interne Account-ID für automatischen Sync';
