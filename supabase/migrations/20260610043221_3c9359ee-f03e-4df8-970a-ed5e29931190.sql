
-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- COMPANIES
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  legal_name TEXT,
  gstin TEXT,
  pan TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  state_code TEXT,
  pincode TEXT,
  country TEXT DEFAULT 'India',
  logo_url TEXT,
  signature_url TEXT,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  upi_id TEXT,
  invoice_prefix TEXT DEFAULT 'INV',
  invoice_terms TEXT DEFAULT E'1. Payment due within 30 days.\n2. Interest @18% p.a. on overdue amounts.\n3. Subject to local jurisdiction.',
  invoice_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX companies_owner_idx ON public.companies(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_company" ON public.companies FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helper: is the given company owned by current user?
CREATE OR REPLACE FUNCTION public.owns_company(_company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = auth.uid());
$$;

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gstin TEXT,
  billing_address TEXT,
  shipping_address TEXT,
  city TEXT,
  state TEXT,
  state_code TEXT,
  pincode TEXT,
  country TEXT DEFAULT 'India',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customers_company_idx ON public.customers(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_customers" ON public.customers FOR ALL USING (public.owns_company(company_id)) WITH CHECK (public.owns_company(company_id));
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'product', -- product | service
  hsn_sac TEXT,
  unit TEXT DEFAULT 'Nos',
  selling_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18,
  stock NUMERIC(14,2),
  track_inventory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_company_idx ON public.products(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_products" ON public.products FOR ALL USING (public.owns_company(company_id)) WITH CHECK (public.owns_company(company_id));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INVOICES
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | paid | overdue | cancelled
  -- snapshot customer
  customer_name TEXT,
  customer_gstin TEXT,
  customer_billing_address TEXT,
  customer_state TEXT,
  customer_state_code TEXT,
  -- totals
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_type TEXT DEFAULT 'amount', -- amount | percent
  discount_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  cgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  sgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  igst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_interstate BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  terms TEXT,
  theme TEXT NOT NULL DEFAULT 'modern_blue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, invoice_number)
);
CREATE INDEX invoices_company_idx ON public.invoices(company_id);
CREATE INDEX invoices_customer_idx ON public.invoices(customer_id);
CREATE INDEX invoices_status_idx ON public.invoices(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_invoices" ON public.invoices FOR ALL USING (public.owns_company(company_id)) WITH CHECK (public.owns_company(company_id));
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INVOICE ITEMS
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  description TEXT,
  hsn_sac TEXT,
  unit TEXT,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 1,
  rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  taxable_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  cgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  sgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  igst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invoice_items_invoice_idx ON public.invoice_items(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_invoice_items" ON public.invoice_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.owns_company(i.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.owns_company(i.company_id)));

-- next invoice number per company
CREATE OR REPLACE FUNCTION public.next_invoice_number(_company_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pfx TEXT;
  yr TEXT := to_char(CURRENT_DATE, 'YYYY');
  n INT;
  cand TEXT;
BEGIN
  IF NOT public.owns_company(_company_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(invoice_prefix, 'INV') INTO pfx FROM public.companies WHERE id = _company_id;
  SELECT COALESCE(MAX( (regexp_replace(invoice_number, '.*-', ''))::INT ), 0) + 1
  INTO n FROM public.invoices
  WHERE company_id = _company_id AND invoice_number LIKE pfx || '-' || yr || '-%';
  cand := pfx || '-' || yr || '-' || lpad(n::TEXT, 4, '0');
  RETURN cand;
END; $$;
