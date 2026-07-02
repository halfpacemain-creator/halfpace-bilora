CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  default_invoice_theme TEXT NOT NULL DEFAULT 'modern-blue',
  default_invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  default_payment_terms TEXT NOT NULL DEFAULT 'Due within 30 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_user_settings" ON public.user_settings;
CREATE POLICY "own_user_settings" ON public.user_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_user_settings_updated ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  date_format TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
  currency TEXT NOT NULL DEFAULT 'INR',
  dashboard_period TEXT NOT NULL DEFAULT 'month',
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_user_preferences" ON public.user_preferences;
CREATE POLICY "own_user_preferences" ON public.user_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_user_preferences_updated ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "own_profile" ON public.profiles;
CREATE POLICY "own_profile" ON public.profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "own_company" ON public.companies;
CREATE POLICY "own_company" ON public.companies
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

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
  user_email TEXT;
  company_record public.companies%ROWTYPE;
  profile_record public.profiles%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication session is missing';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;

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