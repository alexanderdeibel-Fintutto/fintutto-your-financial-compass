-- ============================================================
-- Migration: quotes, order_confirmations, assignment_rules
-- ============================================================

-- 1. QUOTES (Angebote)
CREATE TABLE IF NOT EXISTS public.quotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id    UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  quote_number  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','accepted','declined','expired')),
  amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  issue_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until   DATE,
  description   TEXT,
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_company_access" ON public.quotes
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON public.quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_contact_id ON public.quotes(contact_id);

-- 2. ORDER CONFIRMATIONS (Auftragsbestätigungen)
CREATE TABLE IF NOT EXISTS public.order_confirmations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  order_number        TEXT NOT NULL,
  quote_id            UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','sent','confirmed','cancelled','completed')),
  amount              NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date       DATE,
  description         TEXT,
  items               JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_confirmations_company_access" ON public.order_confirmations
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_order_confirmations_company_id ON public.order_confirmations(company_id);
CREATE INDEX IF NOT EXISTS idx_order_confirmations_status ON public.order_confirmations(status);

-- 3. ASSIGNMENT RULES (Zuordnungsregeln für Transaktionen)
CREATE TABLE IF NOT EXISTS public.assignment_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  priority      INTEGER NOT NULL DEFAULT 0,
  -- Conditions: JSONB array of {field, operator, value}
  conditions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Actions: JSONB array of {type, value}
  actions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Stats
  match_count   INTEGER NOT NULL DEFAULT 0,
  last_matched  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignment_rules_company_access" ON public.assignment_rules
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_assignment_rules_company_id ON public.assignment_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_assignment_rules_active ON public.assignment_rules(is_active);

-- 4. AUTOMATION RULES (Automatisierungsregeln)
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL DEFAULT 'categorization'
                  CHECK (type IN ('categorization','reminder','notification','recurring')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  trigger_event TEXT NOT NULL DEFAULT 'transaction_created',
  conditions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  run_count     INTEGER NOT NULL DEFAULT 0,
  last_run      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_rules_company_access" ON public.automation_rules
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_automation_rules_company_id ON public.automation_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_type ON public.automation_rules(type);

-- updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER order_confirmations_updated_at
  BEFORE UPDATE ON public.order_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER assignment_rules_updated_at
  BEFORE UPDATE ON public.assignment_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
