# Deploying HalfPace Bilora to Netlify

End-to-end steps to take a fresh clone of this repo to a live, working
deployment. No code edits required.

## 1. Create a Supabase project

1. Create a new project at https://supabase.com.
2. In **Project Settings → API**, copy:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon` / `publishable` key → `VITE_SUPABASE_PUBLISHABLE_KEY`

## 2. Apply the database migrations

All schema, RLS policies, triggers and RPC functions live in
`supabase/migrations/`. Apply them once against your fresh project:

```bash
npx supabase link --project-ref <YOUR-PROJECT-REF>
npx supabase db push
```

This creates every table (`profiles`, `companies`, `customers`, `products`,
`invoices`, `invoice_items`, `payments`, `invoice_events`, `user_settings`,
`user_preferences`), the `company-assets` storage bucket, and RPC functions
including `public.complete_user_onboarding(_full_name text, _company_name text)`
and `public.next_invoice_number(_company_id uuid)`.

## 3. Configure Supabase Auth

In **Authentication → URL Configuration**:

- **Site URL**: your Netlify URL (e.g. `https://your-site.netlify.app`).
- **Redirect URLs**: add both the Netlify URL and any custom domain.

### Enable Google sign-in (optional)

1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web application).
2. Authorized redirect URI: `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`.
3. Paste the Client ID and Secret into Supabase → **Authentication → Providers → Google**.

The app uses `window.location.origin` for OAuth callback so it works on
both `*.netlify.app` and custom domains — no code change required.

## 4. Push to GitHub and connect Netlify

1. Push this repo to GitHub.
2. In Netlify, click **Add new site → Import an existing project** and pick
   the repository.
3. Netlify auto-detects `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `.output/public`
4. Add the two environment variables from step 1 in
   **Site settings → Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Click **Deploy**.

## 5. Verify

After the first deploy:

- Load the site — the landing page and `/auth` render.
- Sign up with email + password — you should land on `/dashboard`.
- Create a customer, product, and invoice — PDF download works.
- Refresh any nested route (`/invoices`, `/reports`) — no 404.

That's it — the app is production-ready.