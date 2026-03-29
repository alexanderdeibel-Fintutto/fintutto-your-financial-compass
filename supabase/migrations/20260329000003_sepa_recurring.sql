-- SEPA Payments & Batches
CREATE TABLE IF NOT EXISTS public.sepa_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('transfer', 'direct_debit')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'exported', 'executed', 'failed')),
  creditor_name TEXT NOT NULL,
  creditor_iban TEXT NOT NULL,
  creditor_bic TEXT,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  reference TEXT NOT NULL,
  end_to_end_id TEXT NOT NULL,
  mandate_id TEXT,
  mandate_date DATE,
  sequence_type TEXT CHECK (sequence_type IN ('FRST', 'RCUR', 'OOFF', 'FNAL')),
  execution_date DATE NOT NULL,
  batch_id UUID,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sepa_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('transfer', 'direct_debit')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'exported')),
  message_id TEXT NOT NULL,
  payment_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  execution_date DATE NOT NULL,
  xml_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from sepa_payments to sepa_batches
ALTER TABLE public.sepa_payments
  ADD CONSTRAINT sepa_payments_batch_id_fkey
  FOREIGN KEY (batch_id) REFERENCES public.sepa_batches(id) ON DELETE SET NULL;

-- Recurring Transactions (migrate from localStorage to Supabase)
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  next_date DATE NOT NULL,
  last_executed DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.sepa_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sepa_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_sepa_payments" ON public.sepa_payments
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "company_members_sepa_batches" ON public.sepa_batches
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "company_members_recurring" ON public.recurring_transactions
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER sepa_payments_updated_at BEFORE UPDATE ON public.sepa_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER recurring_updated_at BEFORE UPDATE ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
