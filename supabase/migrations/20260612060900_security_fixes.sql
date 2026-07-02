-- Restrict company-assets storage reads to owner only.
-- Signed URLs continue to work (they bypass RLS) for sharing on invoices.
DROP POLICY IF EXISTS "company_assets_read" ON storage.objects;
CREATE POLICY "company_assets_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lock down SECURITY DEFINER functions that should only run from triggers / internally.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_invoice_payment_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_invoice_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- owns_company is used inside RLS policies and must remain executable.
-- next_invoice_number is intentionally callable by authenticated users and
-- already enforces ownership via owns_company() internally.
