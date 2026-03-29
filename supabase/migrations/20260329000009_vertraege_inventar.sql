-- ============================================================
-- Migration 000009: Vertragsmanagement + Inventar
-- ============================================================

-- ─── Verträge ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vertraege (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vertragspartner TEXT NOT NULL,
  kategorie TEXT NOT NULL DEFAULT 'sonstige',
  -- Laufzeit
  beginn DATE NOT NULL,
  ende DATE,
  kuendigungsfrist_tage INTEGER DEFAULT 30,
  naechste_kuendigung DATE,
  automatische_verlaengerung BOOLEAN DEFAULT false,
  verlaengerung_monate INTEGER DEFAULT 12,
  -- Kosten
  betrag NUMERIC(12,2) DEFAULT 0,
  zahlungsrhythmus TEXT DEFAULT 'monatlich',
  -- Status
  status TEXT DEFAULT 'aktiv' CHECK (status IN ('aktiv','gekuendigt','abgelaufen','pausiert')),
  -- Erinnerung
  erinnerung_tage INTEGER DEFAULT 60,
  erinnerung_aktiv BOOLEAN DEFAULT true,
  -- Metadaten
  notizen TEXT,
  dokument_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vertraege ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_vertraege" ON public.vertraege
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE INDEX idx_vertraege_company ON public.vertraege(company_id);
CREATE INDEX idx_vertraege_status ON public.vertraege(status);
CREATE INDEX idx_vertraege_naechste_kuendigung ON public.vertraege(naechste_kuendigung);

-- ─── Inventar / Lagerbestand ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  artikelnummer TEXT,
  name TEXT NOT NULL,
  beschreibung TEXT,
  kategorie TEXT DEFAULT 'sonstige',
  -- Bestand
  bestand NUMERIC(12,3) DEFAULT 0,
  einheit TEXT DEFAULT 'Stück',
  mindestbestand NUMERIC(12,3) DEFAULT 0,
  maximalbestand NUMERIC(12,3),
  -- Preise
  einkaufspreis NUMERIC(12,2) DEFAULT 0,
  verkaufspreis NUMERIC(12,2) DEFAULT 0,
  -- Lager
  lagerort TEXT,
  lieferant TEXT,
  lieferzeit_tage INTEGER DEFAULT 7,
  -- Status
  aktiv BOOLEAN DEFAULT true,
  -- Metadaten
  bild_url TEXT,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_inventar" ON public.inventar
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE INDEX idx_inventar_company ON public.inventar(company_id);
CREATE INDEX idx_inventar_kategorie ON public.inventar(kategorie);

-- ─── Inventar-Bewegungen ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventar_bewegungen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  artikel_id UUID NOT NULL REFERENCES public.inventar(id) ON DELETE CASCADE,
  typ TEXT NOT NULL CHECK (typ IN ('eingang','ausgang','korrektur','inventur')),
  menge NUMERIC(12,3) NOT NULL,
  bestand_vorher NUMERIC(12,3) NOT NULL,
  bestand_nachher NUMERIC(12,3) NOT NULL,
  preis NUMERIC(12,2),
  referenz TEXT,
  notiz TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventar_bewegungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_inventar_bewegungen" ON public.inventar_bewegungen
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- ─── Trigger: updated_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_vertraege_updated_at') THEN
    CREATE TRIGGER update_vertraege_updated_at
      BEFORE UPDATE ON public.vertraege
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_inventar_updated_at') THEN
    CREATE TRIGGER update_inventar_updated_at
      BEFORE UPDATE ON public.inventar
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
