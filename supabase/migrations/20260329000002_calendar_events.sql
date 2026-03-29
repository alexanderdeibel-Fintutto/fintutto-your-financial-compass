-- ============================================================
-- Migration: calendar_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  start_date    DATE NOT NULL,
  end_date      DATE,
  start_time    TIME,
  end_time      TIME,
  type          TEXT NOT NULL DEFAULT 'other'
                  CHECK (type IN ('deadline','viewing','payment','maintenance','other')),
  property_id   UUID,
  property_name TEXT,
  contact_id    UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_name  TEXT,
  reminder      TEXT NOT NULL DEFAULT 'none'
                  CHECK (reminder IN ('none','1day','1week')),
  recurring     TEXT NOT NULL DEFAULT 'none'
                  CHECK (recurring IN ('none','daily','weekly','monthly','yearly')),
  color         TEXT NOT NULL DEFAULT 'bg-gray-500',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_events_company_access" ON public.calendar_events
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_calendar_events_company_id ON public.calendar_events(company_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON public.calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON public.calendar_events(type);

CREATE OR REPLACE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
