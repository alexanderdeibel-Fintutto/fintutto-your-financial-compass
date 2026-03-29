-- ============================================================
-- E-Commerce Connections & Orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ecommerce_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('shopify', 'woocommerce', 'amazon', 'ebay')),
  store_name TEXT NOT NULL,
  store_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
  last_sync_at TIMESTAMPTZ,
  order_count INTEGER DEFAULT 0,
  revenue_total NUMERIC(15,2) DEFAULT 0,
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_interval_hours INTEGER DEFAULT 24,
  settings JSONB DEFAULT '{
    "import_orders": true,
    "import_products": false,
    "import_customers": true,
    "auto_create_invoices": true,
    "auto_create_transactions": true,
    "default_revenue_account": "8400",
    "default_tax_rate": 19,
    "order_status_filter": ["completed", "processing"]
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ecommerce_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.ecommerce_connections(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  platform_order_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  shipping_amount NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'refunded')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  items JSONB DEFAULT '[]'::jsonb,
  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  invoice_created BOOLEAN DEFAULT false,
  invoice_id UUID REFERENCES public.invoices(id),
  transaction_created BOOLEAN DEFAULT false,
  transaction_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Payment Reminder History (replaces localStorage)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reminder_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  reminder_level INTEGER NOT NULL CHECK (reminder_level BETWEEN 1 AND 3),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_to_email TEXT,
  notes TEXT,
  UNIQUE(invoice_id, reminder_level)
);

-- RLS
ALTER TABLE public.ecommerce_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage ecommerce_connections"
  ON public.ecommerce_connections FOR ALL
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "Company members can manage ecommerce_orders"
  ON public.ecommerce_orders FOR ALL
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "Company members can manage reminder_history"
  ON public.reminder_history FOR ALL
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Triggers
CREATE TRIGGER update_ecommerce_connections_updated_at
  BEFORE UPDATE ON public.ecommerce_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_ecommerce_connections_company ON public.ecommerce_connections(company_id);
CREATE INDEX idx_ecommerce_orders_connection ON public.ecommerce_orders(connection_id);
CREATE INDEX idx_ecommerce_orders_company ON public.ecommerce_orders(company_id);
CREATE INDEX idx_reminder_history_invoice ON public.reminder_history(invoice_id);
CREATE INDEX idx_reminder_history_company ON public.reminder_history(company_id);
