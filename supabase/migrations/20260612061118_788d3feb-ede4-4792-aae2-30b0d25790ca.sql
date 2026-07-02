ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS invoice_theme TEXT NOT NULL DEFAULT 'modern-blue';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_theme TEXT;