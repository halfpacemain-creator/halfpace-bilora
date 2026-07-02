import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, FileText, Receipt, ShieldCheck, Sparkles, Zap, Infinity as InfinityIcon } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { completeSignupOnboarding } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "HalfPace Bilora — Free Forever GST Billing & Invoice Software" },
      { name: "description", content: "HalfPace Bilora is 100% free GST billing software for India. No subscriptions, no premium plans, no feature limits — invoices, GST reports, PDF & UPI QR for life." },
      { property: "og:title", content: "HalfPace Bilora — Free Forever GST Billing" },
      { property: "og:description", content: "Free for life GST invoicing for India. No plans, no limits, no hidden fees." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const completeOnboarding = useServerFn(completeSignupOnboarding);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || cancelled) return;
      completeOnboarding({ data: { fullName: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? "", companyName: "", rollbackOnFailure: false } })
        .catch((error) => console.error("Onboarding check failed", error))
        .finally(() => {
          if (!cancelled) navigate({ to: "/dashboard", replace: true });
        });
    });
    return () => { cancelled = true; };
  }, [completeOnboarding, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="size-8 rounded-md flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
              <Building2 className="size-4" />
            </div>
            {BRAND.name}
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth">Get started</Link></Button>
          </div>
        </div>
      </header>
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-accent text-accent-foreground border border-border">
          <InfinityIcon className="size-3" /> Free forever · no plans, no limits
        </div>
        <h1 className="font-serif text-6xl md:text-7xl tracking-tight mt-6 leading-[1.05]">
          GST billing that stays<br /><span className="italic text-primary">free for life.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Every feature — invoices, GST reports, PDF, UPI QR, e-Way Bill prep, backups — included for every user, forever. No subscriptions, no premium tiers, no hidden fees.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Get started — it's free</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth">Sign in</Link></Button>
        </div>
        <div className="mt-6 text-xs text-muted-foreground">No credit card. No trial. No upgrade prompts. Ever.</div>
      </section>
      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: InfinityIcon, title: "Free forever", text: "No subscriptions, no premium plans. Every core billing feature is yours for life." },
          { icon: Receipt, title: "Automatic GST", text: `${BRAND.name} detects intra- vs inter-state and splits CGST/SGST or applies IGST automatically.` },
          { icon: FileText, title: "Premium PDF invoices", text: "Vector PDFs with your logo, signature, bank details and UPI QR code embedded." },
          { icon: Zap, title: "Lightning fast", text: "Create an invoice in under 30 seconds with reusable customers and product catalog." },
          { icon: ShieldCheck, title: "You own your data", text: "Export every customer, product, invoice and payment as CSV anytime. No vendor lock-in." },
          { icon: Sparkles, title: "Multiple templates", text: "Pick from Modern Blue, Corporate Black, Premium Gold and Minimal White." },
          { icon: Building2, title: "Built for India", text: "HSN/SAC, GSTIN, state codes, e-Way Bill prep and Indian number formatting." },
        ].map((f) => (
          <div key={f.title} className="p-6 rounded-xl border border-border bg-card shadow-sm">
            <div className="size-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
              <f.icon className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
      </footer>
    </div>
  );
}
