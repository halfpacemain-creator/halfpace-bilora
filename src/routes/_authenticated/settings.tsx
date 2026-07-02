import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, type Company } from "@/hooks/use-company";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { INDIAN_STATES } from "@/lib/india";
import { toast } from "sonner";
import { Upload, Download, Mail, Sparkles, Loader2 } from "lucide-react";
import { THEME_LIST, type InvoiceThemeKey, themeFor } from "@/lib/invoice-themes";
import { Check } from "lucide-react";
import { isValidGstinFormat, lookupGstin } from "@/lib/gst-lookup";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · HalfPace Bilora" }] }),
  component: SettingsPage,
});

type Form = Omit<Company, "id" | "owner_id">;
const empty: Form = {
  name: "", legal_name: "", gstin: "", pan: "", email: "", phone: "",
  address_line1: "", address_line2: "", city: "", state: "", state_code: "",
  pincode: "", country: "India", logo_url: "", signature_url: "",
  bank_name: "", bank_account_name: "", bank_account_number: "", bank_ifsc: "",
  upi_id: "", invoice_prefix: "INV", invoice_terms: "", invoice_notes: "",
  invoice_theme: "modern-blue",
};

function SettingsPage() {
  const { data: company, isLoading } = useCompany();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [fetchingGstin, setFetchingGstin] = useState(false);
  const gstinValid = !form.gstin || isValidGstinFormat(form.gstin);

  useEffect(() => {
    if (company) {
      const { id: _id, owner_id: _o, ...rest } = company;
      void _id; void _o;
      setForm({ ...empty, ...rest });
    }
  }, [company]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fetchGstinDetails = async () => {
    if (fetchingGstin) return;
    const g = (form.gstin ?? "").toUpperCase().trim();
    if (!isValidGstinFormat(g)) {
      toast.error("Enter a valid 15-character GSTIN to fetch details.");
      return;
    }
    setFetchingGstin(true);
    try {
      const r = await lookupGstin(g);
      if (!r) {
        toast.error("Unable to fetch GST details. Please verify the GSTIN or enter the details manually.");
        return;
      }
      // Merge — never overwrite a field the user already filled.
      setForm((f) => ({
        ...f,
        gstin: g,
        legal_name: f.legal_name || r.legal_name || f.legal_name,
        name: f.name || r.trade_name || r.legal_name || f.name,
        pan: f.pan || r.pan || f.pan,
        address_line1: f.address_line1 || r.address_line1 || f.address_line1,
        address_line2: f.address_line2 || r.address_line2 || f.address_line2,
        city: f.city || r.city || f.city,
        pincode: f.pincode || r.pincode || f.pincode,
        state: r.state ?? f.state,
        state_code: r.state_code ?? f.state_code,
      }));
      toast.success(
        r.source === "derived"
          ? "State and PAN derived from GSTIN. Please complete the remaining fields."
          : "Business details imported successfully.",
      );
    } catch {
      toast.error("Unable to fetch GST details. Please verify the GSTIN or enter the details manually.");
    } finally {
      setFetchingGstin(false);
    }
  };

  const upload = async (file: File, kind: "logo" | "signature") => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const path = `${u.user.id}/${kind}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data: signed } = await supabase.storage.from("company-assets").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (kind === "logo") set("logo_url", signed?.signedUrl ?? "");
    else set("signature_url", signed?.signedUrl ?? "");
    toast.success("Uploaded");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("Please sign in again."); return; }
      const payload = { ...form, owner_id: u.user.id };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = company
        ? (supabase.from("companies" as any)).update(payload).eq("id", company.id)
        : (supabase.from("companies" as any)).insert(payload);
      const { error } = await q;
      if (error) { toast.error(error.message); return; }
      await qc.invalidateQueries({ queryKey: ["company"] });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <PageContainer><p className="text-muted-foreground">Loading…</p></PageContainer>;

  const exportCsv = async (table: "customers" | "products" | "invoices" | "invoice_items" | "payments") => {
    if (!company) return toast.error("Save your business profile first.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from(table as any)).select("*").eq("company_id", company.id);
    if (error) return toast.error(error.message);
    const rows = ((data ?? []) as unknown) as Record<string, unknown>[];
    if (rows.length === 0) return toast.info(`No ${table} to export yet.`);
    const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()));
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${table}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} ${table}`);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description={company ? "Update your company profile, branding and bank details." : "Welcome! Set up your business profile to start invoicing."}
      />
      <form onSubmit={save}>
        <Tabs defaultValue="business">
          <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="bank">Bank & UPI</TabsTrigger>
            <TabsTrigger value="invoice">Invoice defaults</TabsTrigger>
            <TabsTrigger value="themes">Invoice themes</TabsTrigger>
            <TabsTrigger value="sharing">Email & sharing</TabsTrigger>
            <TabsTrigger value="data">Your data</TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <Card className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Business name *" full><Input required value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Legal name"><Input value={form.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} /></Field>
              <Field label="GSTIN" full>
                <div className="flex gap-2">
                  <Input
                    className={`font-mono ${form.gstin && !gstinValid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    maxLength={15}
                    value={form.gstin ?? ""}
                    onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={fetchGstinDetails}
                    disabled={fetchingGstin || !form.gstin || !gstinValid}
                    className="shrink-0 gap-2"
                  >
                    {fetchingGstin ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {fetchingGstin ? "Fetching…" : "Fetch business details"}
                  </Button>
                </div>
                {form.gstin && !gstinValid && (
                  <p className="text-xs text-destructive mt-1">Invalid GSTIN format.</p>
                )}
                {gstinValid && form.gstin && (
                  <p className="text-xs text-muted-foreground mt-1">
                    We auto-fill state and PAN from your GSTIN. Connect a GSTN provider later to import the full business profile.
                  </p>
                )}
              </Field>
              <Field label="PAN"><Input className="font-mono" value={form.pan ?? ""} onChange={(e) => set("pan", e.target.value.toUpperCase())} /></Field>
              <Field label="Email"><Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Address line 1" full><Input value={form.address_line1 ?? ""} onChange={(e) => set("address_line1", e.target.value)} /></Field>
              <Field label="Address line 2" full><Input value={form.address_line2 ?? ""} onChange={(e) => set("address_line2", e.target.value)} /></Field>
              <Field label="City"><Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
              <Field label="Pincode"><Input value={form.pincode ?? ""} onChange={(e) => set("pincode", e.target.value)} /></Field>
              <Field label="State *" full>
                <Select value={form.state ?? ""} onValueChange={(v) => {
                  const s = INDIAN_STATES.find((x) => x.name === v);
                  setForm((f) => ({ ...f, state: v, state_code: s?.code ?? "" }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>{INDIAN_STATES.map((s) => <SelectItem key={s.code} value={s.name}>{s.name} ({s.code})</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </Card>
          </TabsContent>

          <TabsContent value="branding">
            <Card className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <AssetUpload label="Company logo" value={form.logo_url} onPick={(f) => upload(f, "logo")} onClear={() => set("logo_url", "")} />
              <AssetUpload label="Authorized signature" value={form.signature_url} onPick={(f) => upload(f, "signature")} onClear={() => set("signature_url", "")} />
            </Card>
          </TabsContent>

          <TabsContent value="bank">
            <Card className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Bank name"><Input value={form.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} /></Field>
              <Field label="Account holder"><Input value={form.bank_account_name ?? ""} onChange={(e) => set("bank_account_name", e.target.value)} /></Field>
              <Field label="Account number"><Input value={form.bank_account_number ?? ""} onChange={(e) => set("bank_account_number", e.target.value)} /></Field>
              <Field label="IFSC"><Input className="font-mono" value={form.bank_ifsc ?? ""} onChange={(e) => set("bank_ifsc", e.target.value.toUpperCase())} /></Field>
              <Field label="UPI ID" full><Input value={form.upi_id ?? ""} onChange={(e) => set("upi_id", e.target.value)} placeholder="name@bank" /></Field>
            </Card>
          </TabsContent>

          <TabsContent value="invoice">
            <Card className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Invoice prefix"><Input value={form.invoice_prefix ?? "INV"} onChange={(e) => set("invoice_prefix", e.target.value)} /></Field>
              <div />
              <Field label="Default terms & conditions" full>
                <Textarea rows={4} value={form.invoice_terms ?? ""} onChange={(e) => set("invoice_terms", e.target.value)} />
              </Field>
              <Field label="Default notes" full>
                <Textarea rows={3} value={form.invoice_notes ?? ""} onChange={(e) => set("invoice_notes", e.target.value)} />
              </Field>
            </Card>
          </TabsContent>

          <TabsContent value="themes">
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="text-base font-semibold">Default invoice theme</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This theme is used for every new invoice and PDF. You can still override per invoice in the editor.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {THEME_LIST.map((t) => {
                  const selected = (form.invoice_theme ?? "modern-blue") === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => set("invoice_theme", t.key)}
                      className={`group relative text-left rounded-xl border-2 transition overflow-hidden ${selected ? "border-primary shadow-md" : "border-border hover:border-muted-foreground/40"}`}
                    >
                      <ThemePreview theme={t.key} />
                      <div className="p-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">{t.label}</div>
                          <div className="flex gap-1 mt-1">
                            {t.swatches.map((c) => (
                              <span key={c} className="size-3 rounded-full border border-border" style={{ background: c }} />
                            ))}
                          </div>
                        </div>
                        {selected && <span className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Check className="size-3.5" /></span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Live preview</h4>
                <div className="rounded-lg border border-border overflow-hidden bg-muted/30 p-6 flex justify-center">
                  <ThemePreview theme={(form.invoice_theme ?? "modern-blue") as InvoiceThemeKey} large />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="sharing">
            <Card className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-md bg-accent text-accent-foreground flex items-center justify-center"><Mail className="size-4" /></div>
                <div>
                  <h3 className="text-base font-semibold">No paid email or WhatsApp API needed</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    HalfPace Bilora keeps your costs at zero by using the tools you already have:
                  </p>
                </div>
              </div>
              <ul className="text-sm space-y-2 list-disc pl-6 text-muted-foreground">
                <li><span className="text-foreground font-medium">Email</span> — clicking "Email" on an invoice opens your default mail app (Gmail, Outlook, etc.) with the message pre-filled. Attach the downloaded PDF and send.</li>
                <li><span className="text-foreground font-medium">WhatsApp</span> — opens a wa.me deep link with a pre-written message to your customer. Attach the PDF inside WhatsApp.</li>
                <li><span className="text-foreground font-medium">Optional SMTP</span> — server-side SMTP sending is on the roadmap as an opt-in setting. Until then, your own email client works perfectly and costs nothing.</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                We will never make sending invoices depend on a paid third-party API.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="data">
            <Card className="p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold">Your data, your files</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Export everything stored in HalfPace Bilora as CSV. Open the files in Excel, Google Sheets, Tally or any accounting tool. No lock-in, ever.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {(["customers", "products", "invoices", "invoice_items", "payments"] as const).map((t) => (
                  <Button key={t} type="button" variant="outline" className="justify-between" onClick={() => exportCsv(t)}>
                    <span className="capitalize">{t.replace("_", " ")}</span>
                    <Download className="size-4" />
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Exports are generated locally in your browser from your own account data. Nothing is sent to a third party.
              </p>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={saving} className="gap-2 w-full sm:w-auto">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 min-w-0 ${full ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function AssetUpload({ label, value, onPick, onClear }: { label: string; value: string | null; onPick: (f: File) => void; onClear: () => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="border border-dashed border-border rounded-lg p-4 flex items-center gap-4 bg-muted/30">
        {value ? (
          <img src={value} alt={label} className="h-16 w-16 object-contain bg-card rounded" />
        ) : (
          <div className="h-16 w-16 bg-card rounded flex items-center justify-center text-muted-foreground"><Upload className="size-5" /></div>
        )}
        <div className="flex-1">
          <label className="inline-block">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (f) onPick(f);
            }} />
            <Button type="button" variant="outline" size="sm" asChild><span>Choose file</span></Button>
          </label>
          {value && <Button type="button" variant="ghost" size="sm" onClick={onClear}>Remove</Button>}
        </div>
      </div>
    </div>
  );
}
function ThemePreview({ theme, large }: { theme: InvoiceThemeKey; large?: boolean }) {
  const t = themeFor(theme);
  const isMinimal = t.headerStyle === "minimal";
  const scale = large ? 1.4 : 1;
  return (
    <div
      className="w-full rounded-md overflow-hidden border border-border shrink-0"
      style={{ background: "#fff", color: t.ink, fontFamily: "system-ui, sans-serif", maxWidth: large ? 520 : "100%" }}
    >
      {!isMinimal && <div style={{ height: 6 * scale, background: t.accent }} />}
      <div style={{ padding: 12 * scale }}>
        <div className="flex items-start justify-between" style={{ gap: 8 }}>
          <div>
            <div style={{ fontSize: 11 * scale, fontWeight: 700, color: t.ink, fontFamily: t.fontHeading.includes("Times") ? "Georgia, serif" : "system-ui" }}>Acme Pvt Ltd</div>
            <div style={{ fontSize: 8 * scale, color: t.muted, marginTop: 2 }}>Mumbai, MH · GSTIN 27AAAAA0000A1Z5</div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 10 * scale, fontWeight: 700, color: t.accent, letterSpacing: 1.5, fontFamily: t.fontHeading.includes("Times") ? "Georgia, serif" : "system-ui" }}>TAX INVOICE</div>
            <div style={{ fontSize: 8 * scale, color: t.muted }}>INV-2026-0042</div>
          </div>
        </div>
        <div style={{ marginTop: 10 * scale, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 * scale }}>
          <div style={{ padding: 6 * scale, background: isMinimal ? "transparent" : t.surface, border: isMinimal ? `1px solid ${t.border}` : "none", borderRadius: 3 }}>
            <div style={{ fontSize: 6.5 * scale, color: t.muted, letterSpacing: 0.5 }}>BILL TO</div>
            <div style={{ fontSize: 8 * scale, fontWeight: 700, marginTop: 2 }}>Beta Traders</div>
          </div>
          <div style={{ padding: 6 * scale, background: isMinimal ? "transparent" : t.surface, border: isMinimal ? `1px solid ${t.border}` : "none", borderRadius: 3 }}>
            <div style={{ fontSize: 6.5 * scale, color: t.muted, letterSpacing: 0.5 }}>SUPPLY</div>
            <div style={{ fontSize: 8 * scale, fontWeight: 700, marginTop: 2 }}>Maharashtra</div>
          </div>
        </div>
        <div style={{ marginTop: 8 * scale, border: `1px solid ${t.border}`, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 32px 56px 40px 56px", padding: 4 * scale, background: isMinimal ? t.surface : t.accent, color: isMinimal ? t.ink : t.accentForeground, fontSize: 6.5 * scale, fontWeight: 700, letterSpacing: 0.5 }}>
            <span>ITEM</span><span style={{ textAlign: "right" }}>QTY</span><span style={{ textAlign: "right" }}>RATE</span><span style={{ textAlign: "right" }}>GST</span><span style={{ textAlign: "right" }}>AMT</span>
          </div>
          {[1, 2].map((i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 32px 56px 40px 56px", padding: 4 * scale, fontSize: 7 * scale, borderTop: `1px solid ${t.border}`, background: i % 2 ? t.surface : "transparent" }}>
              <span>Consulting</span><span style={{ textAlign: "right" }}>1</span><span style={{ textAlign: "right" }}>5,000</span><span style={{ textAlign: "right" }}>18%</span><span style={{ textAlign: "right" }}>5,900</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 * scale, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 140, fontSize: 7.5 * scale }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: t.muted }}>Subtotal</span><span>10,000</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTop: `1px solid ${t.border}`, color: t.accent, fontWeight: 700, fontSize: 9 * scale }}>
              <span>Total</span><span>11,800</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
