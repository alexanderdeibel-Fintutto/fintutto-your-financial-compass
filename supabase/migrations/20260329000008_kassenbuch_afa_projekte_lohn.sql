-- ============================================================
-- Migration 000008: Kassenbuch, AfA, Projekte, Kostenstellen,
--                   Zeiterfassung, Lohnabrechnung, Multi-Währung
-- ============================================================

-- ─── KASSENBUCH ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kassenbuch_eintraege (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  datum         DATE NOT NULL,
  belegnummer   TEXT,
  beschreibung  TEXT NOT NULL,
  typ           TEXT NOT NULL CHECK (typ IN ('einnahme', 'ausgabe')),
  betrag        NUMERIC(12,2) NOT NULL CHECK (betrag > 0),
  mwst_satz     NUMERIC(5,2) NOT NULL DEFAULT 0,
  mwst_betrag   NUMERIC(12,2) NOT NULL DEFAULT 0,
  netto_betrag  NUMERIC(12,2) NOT NULL DEFAULT 0,
  kassenstand   NUMERIC(12,2) NOT NULL DEFAULT 0,
  kategorie     TEXT,
  zahlungsart   TEXT NOT NULL DEFAULT 'bar' CHECK (zahlungsart IN ('bar','ec','sonstige')),
  tagesabschluss_id UUID,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kassenbuch_tagesabschluesse (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  datum         DATE NOT NULL,
  anfangsbestand NUMERIC(12,2) NOT NULL DEFAULT 0,
  einnahmen     NUMERIC(12,2) NOT NULL DEFAULT 0,
  ausgaben      NUMERIC(12,2) NOT NULL DEFAULT 0,
  endbestand    NUMERIC(12,2) NOT NULL DEFAULT 0,
  abgeschlossen BOOLEAN NOT NULL DEFAULT FALSE,
  abgeschlossen_von UUID REFERENCES auth.users(id),
  abgeschlossen_am  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, datum)
);

-- ─── ANLAGENVERWALTUNG (AfA) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS anlagegueter (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bezeichnung       TEXT NOT NULL,
  kategorie         TEXT NOT NULL CHECK (kategorie IN (
    'Büroausstattung','EDV/Software','Fahrzeuge','Maschinen',
    'Gebäude','Grundstücke','Immaterielle Wirtschaftsgüter',
    'Betriebs- und Geschäftsausstattung','Sonstiges'
  )),
  anschaffungsdatum DATE NOT NULL,
  anschaffungskosten NUMERIC(12,2) NOT NULL,
  nutzungsdauer_jahre INTEGER NOT NULL CHECK (nutzungsdauer_jahre > 0),
  abschreibungsart  TEXT NOT NULL DEFAULT 'linear' CHECK (abschreibungsart IN ('linear','degressiv','sofort')),
  restwert          NUMERIC(12,2) NOT NULL DEFAULT 0,
  aktueller_buchwert NUMERIC(12,2),
  seriennummer      TEXT,
  lieferant         TEXT,
  kostenstelle_id   UUID,
  aktiv             BOOLEAN NOT NULL DEFAULT TRUE,
  abgang_datum      DATE,
  abgang_erloese    NUMERIC(12,2),
  notizen           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS afa_buchungen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  anlagegut_id    UUID NOT NULL REFERENCES anlagegueter(id) ON DELETE CASCADE,
  jahr            INTEGER NOT NULL,
  monat           INTEGER CHECK (monat BETWEEN 1 AND 12),
  afa_betrag      NUMERIC(12,2) NOT NULL,
  buchwert_anfang NUMERIC(12,2) NOT NULL,
  buchwert_ende   NUMERIC(12,2) NOT NULL,
  gebucht         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── KOSTENSTELLEN ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kostenstellen (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nummer      TEXT NOT NULL,
  bezeichnung TEXT NOT NULL,
  beschreibung TEXT,
  aktiv       BOOLEAN NOT NULL DEFAULT TRUE,
  budget      NUMERIC(12,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, nummer)
);

-- Kostenstellen-Zuordnung zu Transaktionen (Many-to-Many)
CREATE TABLE IF NOT EXISTS transaktion_kostenstellen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaktion_id  UUID NOT NULL,
  kostenstelle_id UUID NOT NULL REFERENCES kostenstellen(id) ON DELETE CASCADE,
  anteil_prozent  NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (anteil_prozent > 0 AND anteil_prozent <= 100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(transaktion_id, kostenstelle_id)
);

-- ─── PROJEKTVERWALTUNG ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS projekte (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  projektnummer   TEXT NOT NULL,
  bezeichnung     TEXT NOT NULL,
  beschreibung    TEXT,
  status          TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('planung','aktiv','pausiert','abgeschlossen','storniert')),
  kunde_id        UUID,
  startdatum      DATE,
  enddatum        DATE,
  budget          NUMERIC(12,2),
  stundensatz     NUMERIC(8,2),
  kostenstelle_id UUID REFERENCES kostenstellen(id),
  farbe           TEXT DEFAULT '#3b82f6',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, projektnummer)
);

-- ─── ZEITERFASSUNG ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zeiteintraege (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  projekt_id    UUID REFERENCES projekte(id) ON DELETE SET NULL,
  mitarbeiter_id UUID,
  datum         DATE NOT NULL,
  start_zeit    TIME,
  end_zeit      TIME,
  dauer_minuten INTEGER NOT NULL CHECK (dauer_minuten > 0),
  beschreibung  TEXT,
  abrechenbar   BOOLEAN NOT NULL DEFAULT TRUE,
  abgerechnet   BOOLEAN NOT NULL DEFAULT FALSE,
  stundensatz   NUMERIC(8,2),
  betrag        NUMERIC(12,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MITARBEITER / LOHNABRECHNUNG ────────────────────────────
CREATE TABLE IF NOT EXISTS mitarbeiter (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  personalnummer    TEXT,
  vorname           TEXT NOT NULL,
  nachname          TEXT NOT NULL,
  email             TEXT,
  eintrittsdatum    DATE NOT NULL,
  austrittsdatum    DATE,
  beschaeftigungsart TEXT NOT NULL DEFAULT 'vollzeit' CHECK (beschaeftigungsart IN (
    'vollzeit','teilzeit','minijob','werkstudent','aushilfe','freiberufler'
  )),
  bruttogehalt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  steuerklasse      INTEGER CHECK (steuerklasse BETWEEN 1 AND 6),
  sozialversicherungsnummer TEXT,
  iban              TEXT,
  kostenstelle_id   UUID REFERENCES kostenstellen(id),
  aktiv             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lohnabrechnungen (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mitarbeiter_id    UUID NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,
  monat             INTEGER NOT NULL CHECK (monat BETWEEN 1 AND 12),
  jahr              INTEGER NOT NULL,
  bruttogehalt      NUMERIC(12,2) NOT NULL,
  -- Arbeitnehmer-Abzüge
  lohnsteuer        NUMERIC(12,2) NOT NULL DEFAULT 0,
  kirchensteuer     NUMERIC(12,2) NOT NULL DEFAULT 0,
  solidaritaetszuschlag NUMERIC(12,2) NOT NULL DEFAULT 0,
  rv_an             NUMERIC(12,2) NOT NULL DEFAULT 0,  -- Rentenversicherung AN
  kv_an             NUMERIC(12,2) NOT NULL DEFAULT 0,  -- Krankenversicherung AN
  pv_an             NUMERIC(12,2) NOT NULL DEFAULT 0,  -- Pflegeversicherung AN
  av_an             NUMERIC(12,2) NOT NULL DEFAULT 0,  -- Arbeitslosenversicherung AN
  nettogehalt       NUMERIC(12,2) NOT NULL,
  -- Arbeitgeber-Anteile
  rv_ag             NUMERIC(12,2) NOT NULL DEFAULT 0,
  kv_ag             NUMERIC(12,2) NOT NULL DEFAULT 0,
  pv_ag             NUMERIC(12,2) NOT NULL DEFAULT 0,
  av_ag             NUMERIC(12,2) NOT NULL DEFAULT 0,
  gesamtkosten_ag   NUMERIC(12,2) NOT NULL,
  -- Status
  status            TEXT NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf','freigegeben','ausgezahlt')),
  auszahlungsdatum  DATE,
  notizen           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mitarbeiter_id, monat, jahr)
);

-- ─── MULTI-WÄHRUNG ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waehrungskurse (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basiswaehrung TEXT NOT NULL DEFAULT 'EUR',
  zielwaehrung  TEXT NOT NULL,
  kurs          NUMERIC(12,6) NOT NULL,
  datum         DATE NOT NULL,
  quelle        TEXT DEFAULT 'manual',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(basiswaehrung, zielwaehrung, datum)
);

-- ─── JAHRESABSCHLUSS-ASSISTENT ───────────────────────────────
CREATE TABLE IF NOT EXISTS jahresabschluss (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  jahr          INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','in_bearbeitung','abgeschlossen','beim_steuerberater')),
  checkliste    JSONB NOT NULL DEFAULT '[]',
  notizen       TEXT,
  steuerberater_freigabe BOOLEAN NOT NULL DEFAULT FALSE,
  abgeschlossen_am TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, jahr)
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kassenbuch_company_datum ON kassenbuch_eintraege(company_id, datum);
CREATE INDEX IF NOT EXISTS idx_anlagegueter_company ON anlagegueter(company_id);
CREATE INDEX IF NOT EXISTS idx_afa_buchungen_anlagegut ON afa_buchungen(anlagegut_id, jahr);
CREATE INDEX IF NOT EXISTS idx_kostenstellen_company ON kostenstellen(company_id);
CREATE INDEX IF NOT EXISTS idx_projekte_company ON projekte(company_id);
CREATE INDEX IF NOT EXISTS idx_zeiteintraege_projekt ON zeiteintraege(projekt_id, datum);
CREATE INDEX IF NOT EXISTS idx_mitarbeiter_company ON mitarbeiter(company_id);
CREATE INDEX IF NOT EXISTS idx_lohnabrechnungen_mitarbeiter ON lohnabrechnungen(mitarbeiter_id, jahr, monat);

-- ─── UPDATED_AT TRIGGERS ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_kassenbuch_updated_at BEFORE UPDATE ON kassenbuch_eintraege FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_anlagegueter_updated_at BEFORE UPDATE ON anlagegueter FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_projekte_updated_at BEFORE UPDATE ON projekte FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_zeiteintraege_updated_at BEFORE UPDATE ON zeiteintraege FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_mitarbeiter_updated_at BEFORE UPDATE ON mitarbeiter FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_lohnabrechnungen_updated_at BEFORE UPDATE ON lohnabrechnungen FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE kassenbuch_eintraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE kassenbuch_tagesabschluesse ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagegueter ENABLE ROW LEVEL SECURITY;
ALTER TABLE afa_buchungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE kostenstellen ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaktion_kostenstellen ENABLE ROW LEVEL SECURITY;
ALTER TABLE projekte ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeiteintraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitarbeiter ENABLE ROW LEVEL SECURITY;
ALTER TABLE lohnabrechnungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE waehrungskurse ENABLE ROW LEVEL SECURITY;
ALTER TABLE jahresabschluss ENABLE ROW LEVEL SECURITY;

-- RLS Policies (company_members pattern)
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kassenbuch_eintraege','kassenbuch_tagesabschluesse',
    'anlagegueter','kostenstellen','projekte',
    'zeiteintraege','mitarbeiter','lohnabrechnungen','jahresabschluss'
  ] LOOP
    EXECUTE format('
      CREATE POLICY IF NOT EXISTS "%s_company_access" ON %I
      FOR ALL USING (
        company_id IN (
          SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
      )', t, t);
  END LOOP;
END $$;

-- Öffentliche Wechselkurse (lesbar für alle authentifizierten Nutzer)
CREATE POLICY IF NOT EXISTS "waehrungskurse_read" ON waehrungskurse
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY IF NOT EXISTS "waehrungskurse_write" ON waehrungskurse
  FOR ALL USING (auth.uid() IS NOT NULL);
