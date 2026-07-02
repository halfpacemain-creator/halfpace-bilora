import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { completeSignupOnboarding } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in · HalfPace Bilora" }, { name: "description", content: "Sign in to HalfPace Bilora — your GST billing dashboard." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeOnboarding = useServerFn(completeSignupOnboarding);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    // Use cached session first to avoid a blocking network call before the form paints.
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/dashboard", replace: true });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // hard-stop duplicate submissions
    setAuthError("");
    const cleanEmail = email.trim().toLowerCase();
    // Explicit client-side validation — never call auth with empty credentials.
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRe.test(cleanEmail)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (!forgot) {
      if (!password || password.length < 6) {
        setAuthError("Password must be at least 6 characters.");
        return;
      }
      if (mode === "signup") {
        if (!name.trim()) { setAuthError("Please enter your full name."); return; }
        if (!companyName.trim()) { setAuthError("Please enter your business name."); return; }
      }
    }
    setLoading(true);
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent. Check your inbox.");
        setForgot(false);
        setLoading(false);
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        let session = data.session;
        if (!session) {
          const login = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
          if (login.error || !login.data.session) {
            throw new Error(login.error?.message || "Account was created, but automatic login did not start. Please try again.");
          }
          session = login.data.session;
        }

        await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
        await completeOnboarding({ data: { fullName: name.trim(), companyName: companyName.trim(), rollbackOnFailure: true } });
        await queryClient.invalidateQueries();
        toast.success("Account created. Welcome to HalfPace Bilora.");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        if (!data.session) throw new Error("Sign in succeeded but no session was created. Please try again.");
        await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
        const { data: verified, error: verifyError } = await supabase.auth.getUser();
        if (verifyError || !verified.user) throw new Error(verifyError?.message || "Could not verify your sign-in session.");
        await completeOnboarding({ data: { fullName: "", companyName: "", rollbackOnFailure: false } });
        await queryClient.invalidateQueries();
        toast.success("Signed in successfully.");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      const message = friendlyAuthError(err);
      setAuthError(message);
      toast.error(message);
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (loading) return;
    setLoading(true);
    setAuthError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (result.redirected) return;
      await completeOnboarding({ data: { fullName: "", companyName: "", rollbackOnFailure: false } });
      await queryClient.invalidateQueries();
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const message = friendlyAuthError(err, "Google sign-in failed");
      setAuthError(message);
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {loading && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-8 py-6 shadow-lg">
            <Loader2 className="size-6 animate-spin text-primary" />
            <div className="text-sm font-medium">
              {forgot ? "Sending reset link…" : mode === "signup" ? "Creating your account…" : "Signing you in…"}
            </div>
            <div className="text-xs text-muted-foreground">Please wait a moment.</div>
          </div>
        </div>
      )}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 text-white relative overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
        <Link to="/" className="flex items-center gap-2 font-semibold relative z-10">
          <Building2 className="size-6" /> {BRAND.name}
        </Link>
        <div className="relative z-10 max-w-md">
          <h1 className="font-serif text-5xl leading-tight">Beautiful GST invoices, sent in seconds.</h1>
          <p className="mt-4 text-white/80">
            Manage customers, products and invoices with automatic CGST/SGST/IGST and premium PDF exports.
          </p>
        </div>
        <div className="text-sm text-white/70 relative z-10">© {new Date().getFullYear()} {BRAND.name} — {BRAND.tagline}</div>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-semibold tracking-tight">{forgot ? "Reset password" : mode === "signup" ? "Create your account" : "Welcome back"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {forgot ? "We'll email you a reset link." : "Sign in to manage your invoices."}
          </p>
          <Card className="p-6 mt-6 shadow-sm">
            {!forgot && (
              <>
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogle} disabled={loading}>
                  <GoogleIcon /> Continue with Google
                </Button>
                <div className="flex items-center gap-3 my-4 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
                </div>
                <Tabs value={mode} onValueChange={(v) => { setMode(v as "signin" | "signup"); setAuthError(""); }}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="signin">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Sign up</TabsTrigger>
                  </TabsList>
                  <TabsContent value="signin" />
                  <TabsContent value="signup" />
                </Tabs>
              </>
            )}
            <form onSubmit={handleAuth} className="space-y-3 mt-4">
              {mode === "signup" && !forgot && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="companyName">Business name</Label>
                    <Input id="companyName" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {!forgot && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setForgot(true)}>
                        Forgot?
                      </button>
                    )}
                  </div>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {forgot ? "Send reset link" : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
              {authError && (
                <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {authError}
                </p>
              )}
              {forgot && (
                <Button type="button" variant="ghost" className="w-full" onClick={() => setForgot(false)}>
                  Back to sign in
                </Button>
              )}
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function friendlyAuthError(err: unknown, fallback = "Authentication failed") {
  const raw = err instanceof Error ? err.message : String(err || fallback);
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials")) return "The email or password is incorrect.";
  if (lower.includes("already registered") || lower.includes("user already")) return "An account with this email already exists. Please sign in instead.";
  if (lower.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (lower.includes("rate limit") || lower.includes("security purposes")) return raw;
  if (lower.includes("failed to fetch") || lower.includes("network")) return "Network error. Please check your connection and try again.";
  return raw || fallback;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}