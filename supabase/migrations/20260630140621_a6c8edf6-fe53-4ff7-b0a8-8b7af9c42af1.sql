CREATE OR REPLACE FUNCTION public.complete_user_onboarding(
  _full_name TEXT,
  _company_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  user_email TEXT := auth.jwt()->>'email';
  company_record public.companies%ROWTYPE;
  profile_record public.profiles%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication session is missing';
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (uid, user_email, NULLIF(trim(COALESCE(_full_name, '')), ''))
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    updated_at = now()
  RETURNING * INTO profile_record;

  SELECT * INTO company_record
  FROM public.companies
  WHERE owner_id = uid
  ORDER BY created_at ASC
  LIMIT 1;

  IF company_record.id IS NULL THEN
    INSERT INTO public.companies (
      owner_id,
      name,
      email,
      country,
      invoice_prefix,
      invoice_terms,
      invoice_theme
    ) VALUES (
      uid,
      COALESCE(NULLIF(trim(_company_name), ''), NULLIF(trim(_full_name), ''), split_part(COALESCE(user_email, 'My Business'), '@', 1), 'My Business'),
      user_email,
      'India',
      'INV',
      E'1. Payment due within 30 days.\n2. Interest @18% p.a. on overdue amounts.\n3. Subject to local jurisdiction.',
      'modern-blue'
    )
    RETURNING * INTO company_record;
  END IF;

  INSERT INTO public.user_settings (user_id)
  VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'profile_id', profile_record.id,
    'company_id', company_record.id,
    'ready', true
  );
END;
$$;
REVOKE ALL ON FUNCTION public.complete_user_onboarding(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_user_onboarding(TEXT, TEXT) TO authenticated;