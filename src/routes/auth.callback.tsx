import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { completeSignupOnboarding } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "Signing you in… · HalfPace Bilora" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeOnboarding = useServerFn(completeSignupOnboarding);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // supabase-js auto-detects the OAuth redirect (code or hash tokens)
        // and persists the session. Give it a beat, then read it back.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchErr } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (exchErr) throw exchErr;
        }
        const { data, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;
        if (!data.session) throw new Error("No session returned from Google sign-in.");

        try {
          await completeOnboarding({ data: { fullName: "", companyName: "", rollbackOnFailure: false } });
        } catch (onboardErr) {
          console.warn("Onboarding sync failed (continuing to dashboard)", onboardErr);
        }
        await queryClient.invalidateQueries();
        if (!cancelled) navigate({ to: "/dashboard", replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Google sign-in failed.";
        if (!cancelled) setError(message);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, queryClient, completeOnboarding]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-8 py-6 shadow-lg text-center">
        {error ? (
          <>
            <div className="text-sm font-medium text-destructive">{error}</div>
            <button
              className="text-sm text-primary hover:underline"
              onClick={() => navigate({ to: "/auth", replace: true })}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <Loader2 className="size-6 animate-spin text-primary" />
            <div className="text-sm font-medium">Finishing sign-in…</div>
            <div className="text-xs text-muted-foreground">One moment.</div>
          </>
        )}
      </div>
    </div>
  );
}