-- Advisor Documents: structured document handover to tax advisor
CREATE TABLE IF NOT EXISTS public.advisor_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'other',
  period TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shared', 'reviewed', 'approved')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advisor Comments: communication thread per document
CREATE TABLE IF NOT EXISTS public.advisor_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.advisor_documents(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  author_type TEXT NOT NULL DEFAULT 'client' CHECK (author_type IN ('client', 'advisor')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.advisor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage advisor documents"
  ON public.advisor_documents FOR ALL
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "Company members can manage advisor comments"
  ON public.advisor_comments FOR ALL
  USING (document_id IN (
    SELECT id FROM public.advisor_documents
    WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  ));

-- Trigger
CREATE TRIGGER update_advisor_documents_updated_at
  BEFORE UPDATE ON public.advisor_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_advisor_documents_company_id ON public.advisor_documents(company_id);
CREATE INDEX idx_advisor_comments_document_id ON public.advisor_comments(document_id);
