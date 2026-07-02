-- 1. Storage: scope SELECT on company-assets to the owner's folder
DROP POLICY IF EXISTS "company_assets_read" ON storage.objects;

CREATE POLICY "company_assets_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Convert SECURITY DEFINER functions callable by signed-in users to SECURITY INVOKER.
--    Both queries only touch rows the caller already has RLS access to.

CREATE OR REPLACE FUNCTION public.owns_company(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.next_invoice_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  pfx TEXT;
  yr  TEXT := to_char(CURRENT_DATE, 'YYYY');
  n   INT;
  cand TEXT;
BEGIN
  IF NOT public.owns_company(_company_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(invoice_prefix, 'INV') INTO pfx
  FROM public.companies WHERE id = _company_id;

  SELECT COALESCE(MAX((regexp_replace(invoice_number, '.*-', ''))::INT), 0) + 1
  INTO n FROM public.invoices
  WHERE company_id = _company_id
    AND invoice_number LIKE pfx || '-' || yr || '-%';

  cand := pfx || '-' || yr || '-' || lpad(n::TEXT, 4, '0');
  RETURN cand;
END;
$$;