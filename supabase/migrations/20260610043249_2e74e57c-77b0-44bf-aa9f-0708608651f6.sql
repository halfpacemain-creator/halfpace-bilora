
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.owns_company(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(UUID) TO authenticated;
