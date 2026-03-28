-- Migration: Tax Advisor Portal
-- Steuerberater-Zugänge und Aktivitätslogs in Supabase speichern

-- Tabelle: tax_advisor_access
CREATE TABLE IF NOT EXISTS public.tax_advisor_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  advisor_name TEXT NOT NULL,
  advisor_email TEXT NOT NULL,
  firm_name TEXT,
  access_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  permissions JSONB NOT NULL DEFAULT '{
    "view_transactions": true,
    "view_invoices": true,
    "view_receipts": true,
    "view_reports": true,
    "export_datev": true,
    "export_gdpdu": false,
    "view_bank_accounts": false,
    "view_contacts": true
  }'::jsonb,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_access_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '365 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabelle: tax_advisor_activity_log
CREATE TABLE IF NOT EXISTS public.tax_advisor_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id UUID NOT NULL REFERENCES public.tax_advisor_access(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('login', 'view_transactions', 'view_invoices', 'export_datev', 'export_gdpdu', 'view_reports', 'logout')),
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabelle: tax_advisor_portal_settings
CREATE TABLE IF NOT EXISTS public.tax_advisor_portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  portal_enabled BOOLEAN NOT NULL DEFAULT true,
  require_2fa BOOLEAN NOT NULL DEFAULT false,
  auto_expire_days INTEGER NOT NULL DEFAULT 365,
  notification_on_access BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS aktivieren
ALTER TABLE public.tax_advisor_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_advisor_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_advisor_portal_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Nur eigene Firmen-Daten sichtbar
CREATE POLICY "Users see own company advisor access"
  ON public.tax_advisor_access FOR ALL
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users see own company advisor logs"
  ON public.tax_advisor_activity_log FOR ALL
  USING (
    access_id IN (
      SELECT ta.id FROM public.tax_advisor_access ta
      JOIN public.companies c ON c.id = ta.company_id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users see own company portal settings"
  ON public.tax_advisor_portal_settings FOR ALL
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Trigger: updated_at automatisch setzen
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tax_advisor_access_updated_at
  BEFORE UPDATE ON public.tax_advisor_access
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_advisor_portal_settings_updated_at
  BEFORE UPDATE ON public.tax_advisor_portal_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index für schnelle Suche nach Access-Code
CREATE INDEX IF NOT EXISTS idx_tax_advisor_access_code ON public.tax_advisor_access(access_code);
CREATE INDEX IF NOT EXISTS idx_tax_advisor_access_company ON public.tax_advisor_access(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_advisor_activity_access ON public.tax_advisor_activity_log(access_id);
