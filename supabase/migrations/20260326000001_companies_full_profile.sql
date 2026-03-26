-- ============================================================
-- Migration: companies_full_profile
-- Erweitert die companies-Tabelle um alle Pflichtfelder für
-- GoBD-konforme Rechnungen (§14 UStG) und Firmen-Onboarding.
-- ============================================================

-- Logo und Branding
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#1e3a5f';

-- Rechtliche Angaben (§14 UStG Pflichtfelder)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS legal_form TEXT,                    -- GmbH, UG, Einzelunternehmen, GbR, etc.
  ADD COLUMN IF NOT EXISTS vat_id TEXT,                        -- USt-IdNr. DE123456789
  ADD COLUMN IF NOT EXISTS tax_number TEXT,                    -- Steuernummer 123/456/78901
  ADD COLUMN IF NOT EXISTS register_number TEXT,               -- HRB 12345
  ADD COLUMN IF NOT EXISTS register_court TEXT,                -- Amtsgericht München
  ADD COLUMN IF NOT EXISTS managing_director TEXT;             -- Geschäftsführer

-- Kontaktdaten für Rechnungsfußzeile
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;

-- Adresse aufgeteilt (für strukturierte Verarbeitung)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DE';

-- Rechnungseinstellungen
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'RE',   -- RE-2024-001
  ADD COLUMN IF NOT EXISTS invoice_counter INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 14,
  ADD COLUMN IF NOT EXISTS default_vat_rate INTEGER DEFAULT 19,
  ADD COLUMN IF NOT EXISTS invoice_notes TEXT,                 -- Standard-Fußnote auf Rechnungen
  ADD COLUMN IF NOT EXISTS small_business_regulation BOOLEAN DEFAULT FALSE; -- §19 UStG Kleinunternehmer

-- Bankverbindung direkt an der Firma (Primärkonto für Rechnungen)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS primary_iban TEXT,
  ADD COLUMN IF NOT EXISTS primary_bic TEXT,
  ADD COLUMN IF NOT EXISTS primary_bank_name TEXT;

-- Steuerberater-Zugang
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tax_advisor_email TEXT,
  ADD COLUMN IF NOT EXISTS tax_advisor_name TEXT,
  ADD COLUMN IF NOT EXISTS elster_certificate_path TEXT;

-- Firmentyp (für Financial Compass: Freelancer vs. GmbH vs. Beteiligung)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT 'freelancer'
    CHECK (company_type IN ('freelancer', 'gmbh', 'ug', 'gbr', 'einzelunternehmen', 'beteiligung', 'other')),
  ADD COLUMN IF NOT EXISTS ownership_percentage DECIMAL(5,2),  -- Bei Beteiligungen: Anteil in %
  ADD COLUMN IF NOT EXISTS is_managing_director BOOLEAN DEFAULT FALSE; -- Bin ich GF?

-- Onboarding-Status
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- RLS: Nur Mitglieder der Firma können Profil sehen/ändern
-- (RLS ist bereits über company_members geregelt, kein Änderungsbedarf)

-- Funktion: Nächste Rechnungsnummer atomisch erhöhen
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix TEXT;
  v_counter INTEGER;
  v_year TEXT;
BEGIN
  SELECT invoice_prefix, invoice_counter
  INTO v_prefix, v_counter
  FROM public.companies
  WHERE id = p_company_id;

  v_counter := COALESCE(v_counter, 0) + 1;
  v_year := TO_CHAR(NOW(), 'YYYY');

  UPDATE public.companies
  SET invoice_counter = v_counter, updated_at = NOW()
  WHERE id = p_company_id;

  RETURN COALESCE(v_prefix, 'RE') || '-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');
END;
$$;

-- Funktion: Firmen-Vollprofil für Rechnungs-PDF abrufen
CREATE OR REPLACE FUNCTION public.get_company_invoice_profile(p_company_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company RECORD;
  v_bank RECORD;
BEGIN
  SELECT * INTO v_company FROM public.companies WHERE id = p_company_id;

  -- Primäres Bankkonto laden (entweder direkt oder aus bank_accounts)
  SELECT iban, bic, name INTO v_bank
  FROM public.bank_accounts
  WHERE company_id = p_company_id
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN json_build_object(
    'id', v_company.id,
    'name', v_company.name,
    'legal_form', v_company.legal_form,
    'address', COALESCE(
      v_company.street || E'\n' || v_company.zip || ' ' || v_company.city,
      v_company.address
    ),
    'tax_id', COALESCE(v_company.tax_number, v_company.tax_id),
    'vat_id', v_company.vat_id,
    'register_number', v_company.register_number,
    'register_court', v_company.register_court,
    'managing_director', v_company.managing_director,
    'phone', v_company.phone,
    'email', v_company.email,
    'website', v_company.website,
    'logo_url', v_company.logo_url,
    'primary_color', v_company.primary_color,
    'iban', COALESCE(v_company.primary_iban, v_bank.iban),
    'bic', COALESCE(v_company.primary_bic, v_bank.bic),
    'bank_name', COALESCE(v_company.primary_bank_name, v_bank.name),
    'invoice_prefix', v_company.invoice_prefix,
    'payment_terms_days', v_company.payment_terms_days,
    'default_vat_rate', v_company.default_vat_rate,
    'invoice_notes', v_company.invoice_notes,
    'small_business_regulation', v_company.small_business_regulation,
    'company_type', v_company.company_type,
    'is_managing_director', v_company.is_managing_director,
    'ownership_percentage', v_company.ownership_percentage
  );
END;
$$;

-- Kommentar
COMMENT ON TABLE public.companies IS 'Mandanten / Firmen des Nutzers. Unterstützt Multi-Company (Freelancer + GmbH + Beteiligungen).';
