import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate, formatINR } from "@/lib/format";
import { amountInWords, hsnSummary } from "@/lib/gst";
import { Download, Printer, Copy, Trash2, CheckCircle2, ArrowLeft, MessageCircle, Plus, Clock, Mail, Truck, ExternalLink, Pencil, Ban, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/routes/_authenticated/dashboard";
import { themeFor, THEME_LIST, type InvoiceThemeKey } from "@/lib/invoice-themes";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice · HalfPace Bilora" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const [downloading, setDownloading] = useState(false);

  const { data } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inv = await (supabase.from("invoices" as any)).select("*").eq("id", id).single();
      if (inv.error) throw inv.error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = await (supabase.from("invoice_items" as any)).select("*").eq("invoice_id", id).order("position");
      if (items.error) throw items.error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { invoice: inv.data as any, items: (items.data as unknown) as any[] };
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["payments", id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("payments" as any))
        .select("*").eq("invoice_id", id).order("payment_date", { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as unknown) as any[];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["invoice-events", id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("invoice_events" as any))
        .select("*").eq("invoice_id", id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as unknown) as any[];
    },
  });

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [ewbOpen, setEwbOpen] = useState(false);

  if (!data || !company) return <PageContainer><p className="text-muted-foreground">Loading…</p></PageContainer>;
  const { invoice, items } = data;
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balanceDue = Number(invoice.total) - totalPaid;

  // Status lifecycle helpers ----------------------------------------------
  const TERMINAL = new Set(["paid", "partial", "cancelled"]);
  const bumpStatus = async (
    next: "finalized" | "pdf_generated" | "shared" | "cancelled",
    message: string,
  ) => {
    // Don't overwrite paid/partial/cancelled unless explicitly cancelling
    if (next !== "cancelled" && TERMINAL.has(invoice.status)) return;
    // Don't downgrade: shared > pdf_generated > finalized > draft
    const rank: Record<string, number> = { draft: 0, finalized: 1, pdf_generated: 2, shared: 3 };
    if (next in rank && invoice.status in rank && rank[next] <= rank[invoice.status]) {
      // still log the activity, but skip status write
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("invoice_events" as any)).insert({
        invoice_id: id, company_id: company.id, event_type: next, message,
      });
      qc.invalidateQueries({ queryKey: ["invoice-events", id] });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("invoices" as any))
      .update({ status: next, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("invoice_events" as any)).insert({
      invoice_id: id, company_id: company.id, event_type: next, message,
    });
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoice-events", id] });
    qc.invalidateQueries({ queryKey: ["dashboard-invoices"] });
  };
  const finalize = () => bumpStatus("finalized", "Invoice finalized").then(() => toast.success("Invoice finalized"));
  const cancelInvoice = async () => {
    if (!confirm("Cancel this invoice? It will no longer count toward outstanding or revenue.")) return;
    await bumpStatus("cancelled", "Invoice cancelled");
    toast.success("Invoice cancelled");
  };

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const [{ pdf }, { InvoicePDF }, qrcode] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/invoice-pdf"),
        import("qrcode"),
      ]);
      let qrDataUrl: string | undefined;
      if (company.upi_id) {
        const upi = `upi://pay?pa=${encodeURIComponent(company.upi_id)}&pn=${encodeURIComponent(company.name)}&am=${invoice.total}&cu=INR&tn=${encodeURIComponent(invoice.invoice_number)}`;
        qrDataUrl = await qrcode.toDataURL(upi, { margin: 0, width: 256 });
      }
      const doc = <InvoicePDF company={company} invoice={invoice} items={items} qrDataUrl={qrDataUrl} theme={invoice.invoice_theme ?? company.invoice_theme} />;
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${invoice.invoice_number}.pdf`; a.click();
      URL.revokeObjectURL(url);
      await bumpStatus("pdf_generated", "PDF generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const markPaid = async () => {
    if (balanceDue <= 0) return toast.info("Already fully paid");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("payments" as any))
      .insert({ invoice_id: id, company_id: company.id, amount: balanceDue, mode: "other", notes: "Marked as paid" });
    if (error) return toast.error(error.message);
    toast.success("Marked as paid");
    qc.invalidateQueries({ queryKey: ["payments", id] });
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoice-events", id] });
    qc.invalidateQueries({ queryKey: ["dashboard-invoices"] });
  };

  const duplicate = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { invoice_number: _n, id: _i, created_at: _c, updated_at: _u, ...rest } = invoice;
    void _n; void _i; void _c; void _u;
    const { nextInvoiceNumber } = await import("@/lib/api/invoices.functions");
    const { useServerFn: _ } = await import("@tanstack/react-start"); void _;
    const next = await nextInvoiceNumber({ data: { company_id: company.id } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase.from("invoices" as any))
      .insert({ ...rest, invoice_number: next.invoice_number, status: "draft", amount_paid: 0 })
      .select("id").single();
    if (error) return toast.error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemRows = items.map(({ id: _x, invoice_id: _y, created_at: _z, ...it }: any) => {
      void _x; void _y; void _z;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { ...it, invoice_id: (created as any).id };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("invoice_items" as any)).insert(itemRows);
    toast.success("Duplicated");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigate({ to: "/invoices/$id", params: { id: (created as any).id } });
  };

  const remove = async () => {
    if (!confirm("Delete this invoice?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("invoices" as any)).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    navigate({ to: "/invoices" });
  };

  const whatsapp = () => {
    const msg = `Hi ${invoice.customer_name},\n\nYour invoice ${invoice.invoice_number} from ${company.name} is ready.\nAmount: ${formatINR(invoice.total)}\nDue: ${formatDate(invoice.due_date)}\n\nPlease find the PDF attached.\n\nThank you for your business.\n— Sent via ${BRAND.name}`;
    const digits = (invoice.customer_phone || "").replace(/\D/g, "");
    const target = digits ? `https://wa.me/${digits.length === 10 ? "91" + digits : digits}` : `https://wa.me/`;
    window.open(`${target}?text=${encodeURIComponent(msg)}`, "_blank");
    void bumpStatus("shared", "Shared via WhatsApp");
  };

  const emailInvoice = () => {
    if (!invoice.customer_email) return toast.error("No customer email on file");
    const subject = `Invoice ${invoice.invoice_number} from ${company.name}`;
    const body =
      `Hi ${invoice.customer_name},\n\n` +
      `Please find invoice ${invoice.invoice_number} for ${formatINR(invoice.total)} attached.\n` +
      (invoice.due_date ? `Due date: ${formatDate(invoice.due_date)}\n` : "") +
      `\nThank you for your business.\n${company.name}\n\n— Sent via ${BRAND.name}`;
    window.location.href = `mailto:${encodeURIComponent(invoice.customer_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.info("Opening your email app. Attach the downloaded PDF before sending.");
    void bumpStatus("shared", "Shared via Email");
  };

  const theme = themeFor(invoice.invoice_theme ?? company.invoice_theme);
  const hsnRows = hsnSummary(items);
  const totalTax = Number(invoice.cgst_amount || 0) + Number(invoice.sgst_amount || 0) + Number(invoice.igst_amount || 0);
  const roundOff = Math.round((Number(invoice.total) - (Number(invoice.subtotal) - Number(invoice.discount_amount || 0) + totalTax)) * 100) / 100;
  const shipName = invoice.shipping_name || invoice.customer_name;
  const shipAddr = invoice.shipping_address || invoice.customer_billing_address;
  const sameAddress = !invoice.shipping_address || invoice.shipping_address === invoice.customer_billing_address;
  const termsLines: string[] = (invoice.terms || "").split(/\r?\n/).map((t: string) => t.trim()).filter(Boolean);
  const statusLabel: Record<string, string> = {
    draft: "Draft", finalized: "Finalized", pdf_generated: "PDF Generated",
    shared: "Shared", sent: "Sent", paid: "Paid", partial: "Partially Paid",
    overdue: "Overdue", cancelled: "Cancelled",
  };
  const canEdit = !TERMINAL.has(invoice.status);
  const canDelete = invoice.status === "draft";
  const updateTheme = async (key: InvoiceThemeKey) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("invoices" as any)).update({ invoice_theme: key }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    toast.success(`Theme set to ${themeFor(key).label}`);
  };

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2"><Link to="/invoices"><ArrowLeft className="size-4" /> Back</Link></Button>
      <PageHeader
        title={invoice.invoice_number}
        description={`${formatDate(invoice.invoice_date)} · ${invoice.customer_name}`}
        actions={
          <>
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/invoices/$id/edit" params={{ id }}><Pencil className="size-4" /> Edit</Link>
              </Button>
            )}
            {invoice.status === "draft" && (
              <Button variant="outline" size="sm" onClick={finalize}><FileCheck2 className="size-4" /> Finalize</Button>
            )}
            {balanceDue > 0 && <Button variant="outline" size="sm" onClick={() => setPayDialogOpen(true)}><Plus className="size-4" /> Record payment</Button>}
            {balanceDue > 0 && <Button variant="outline" size="sm" onClick={markPaid}><CheckCircle2 className="size-4" /> Mark paid</Button>}
            <Button variant="outline" size="sm" onClick={whatsapp}><MessageCircle className="size-4" /> Share</Button>
            <Button variant="outline" size="sm" onClick={emailInvoice}><Mail className="size-4" /> Email</Button>
            <Button variant="outline" size="sm" onClick={() => setEwbOpen(true)}><Truck className="size-4" /> E-Way Bill</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <Button variant="outline" size="sm" onClick={duplicate}><Copy className="size-4" /> Duplicate</Button>
            {!TERMINAL.has(invoice.status) && invoice.status !== "cancelled" && (
              <Button variant="outline" size="sm" onClick={cancelInvoice}><Ban className="size-4" /> Cancel</Button>
            )}
            {canDelete && <Button variant="outline" size="sm" onClick={remove}><Trash2 className="size-4" /></Button>}
            <Button size="sm" onClick={downloadPDF} disabled={downloading}>
              <Download className="size-4" /> {downloading ? "Generating…" : "Download PDF"}
            </Button>
          </>
        }
      />

      <PaymentDialog
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        invoiceId={id}
        companyId={company.id}
        suggested={balanceDue}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["payments", id] });
          qc.invalidateQueries({ queryKey: ["invoice", id] });
          qc.invalidateQueries({ queryKey: ["invoices"] });
          qc.invalidateQueries({ queryKey: ["invoice-events", id] });
          qc.invalidateQueries({ queryKey: ["dashboard-invoices"] });
        }}
      />

      <EwbDialog
        open={ewbOpen}
        onOpenChange={setEwbOpen}
        invoice={invoice}
        items={items}
        company={company}
      />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <Card
          className="p-8 print:shadow-none"
          style={{ ["--invoice-accent" as string]: theme.accent, ["--invoice-surface" as string]: theme.surface, ["--invoice-border" as string]: theme.border } as React.CSSProperties}
        >
          {/* Accent ribbon */}
          <div className="h-1.5 -mx-8 -mt-8 mb-6 rounded-t-md" style={{ background: theme.accent }} />

          {/* Header */}
          <div className="flex justify-between items-start gap-6">
            <div className="flex gap-4 min-w-0 flex-1">
              {company.logo_url && <img src={company.logo_url} className="h-16 w-16 object-contain shrink-0" alt="" />}
              <div className="min-w-0">
                <div className="text-xl font-semibold truncate">{company.name}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {[company.address_line1, company.address_line2].filter(Boolean).join(", ")}
                  {(company.address_line1 || company.address_line2) && <br />}
                  {[company.city, company.state, company.pincode].filter(Boolean).join(", ")}
                  {company.gstin && <><br /><span className="font-medium text-foreground">GSTIN:</span> {company.gstin}{company.pan && <span className="ml-3"><span className="font-medium text-foreground">PAN:</span> {company.pan}</span>}</>}
                  {(company.phone || company.email) && <br />}
                  {company.phone && <>Tel: {company.phone}</>}
                  {company.phone && company.email && "  ·  "}
                  {company.email && <>{company.email}</>}
                  {(company as { website?: string }).website && <><br />{(company as { website?: string }).website}</>}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-bold uppercase tracking-widest" style={{ color: theme.accent }}>Tax Invoice</div>
              <span
                className="inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: theme.accent, color: theme.accentForeground }}
              >
                {statusLabel[invoice.status] || invoice.status}
              </span>
              <div className="mt-3 p-3 rounded-md border border-border text-xs space-y-1 min-w-[220px]" style={{ background: theme.surface }}>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Invoice #</span><span className="font-mono font-semibold">{invoice.invoice_number}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Date</span><span className="font-semibold">{formatDate(invoice.invoice_date)}</span></div>
                {invoice.due_date && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Due date</span><span className="font-semibold">{formatDate(invoice.due_date)}</span></div>}
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Place of supply</span><span className="font-semibold">{invoice.customer_state || "—"}</span></div>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 rounded-md border border-border" style={{ background: theme.surface }}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bill to</div>
              <div className="font-semibold mt-1">{invoice.customer_name}</div>
              <div className="text-xs mt-1 whitespace-pre-line">
                {invoice.customer_billing_address}
                {invoice.customer_state && `\n${invoice.customer_state}`}
              </div>
              <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                {invoice.customer_gstin && <div>GSTIN: <span className="text-foreground font-medium">{invoice.customer_gstin}</span></div>}
                {invoice.customer_phone && <div>Tel: {invoice.customer_phone}</div>}
                {invoice.customer_email && <div>{invoice.customer_email}</div>}
              </div>
            </div>
            <div className="p-4 rounded-md border border-border" style={{ background: theme.surface }}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Ship to {sameAddress && <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">(same as billing)</span>}</div>
              <div className="font-semibold mt-1">{shipName}</div>
              <div className="text-xs mt-1 whitespace-pre-line">{shipAddr}</div>
            </div>
          </div>

          <table className="w-full mt-6 text-sm table-fixed">
            <colgroup>
              <col style={{ width: "5%" }} />
              <col style={{ width: "38%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead>
              <tr className="text-xs uppercase" style={{ background: theme.accent, color: theme.accentForeground }}>
                <th className="text-left p-2 rounded-l">#</th>
                <th className="text-left p-2">Item</th>
                <th className="text-left p-2">HSN/SAC</th>
                <th className="text-right p-2">Qty</th>
                <th className="text-right p-2">Rate</th>
                <th className="text-right p-2">GST</th>
                <th className="text-right p-2 rounded-r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className={`border-b border-border align-top ${i % 2 ? "bg-muted/30" : ""}`}>
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 break-words"><div className="font-medium">{it.name}</div>{it.description && <div className="text-xs text-muted-foreground break-words">{it.description}</div>}</td>
                  <td className="p-2 font-mono text-xs break-all">{it.hsn_sac || "—"}</td>
                  <td className="p-2 text-right tabular-nums whitespace-nowrap">{it.quantity} {it.unit}</td>
                  <td className="p-2 text-right tabular-nums whitespace-nowrap">{formatINR(it.rate)}</td>
                  <td className="p-2 text-right tabular-nums whitespace-nowrap">{it.gst_rate}%</td>
                  <td className="p-2 text-right font-medium tabular-nums whitespace-nowrap">{formatINR(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* HSN tax summary */}
          {hsnRows.length > 0 && (
            <div className="mt-6 rounded-md border border-border overflow-hidden text-sm">
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider" style={{ background: theme.surface }}>
                    <th className="text-left p-2">HSN / SAC</th>
                    <th className="text-right p-2">Taxable</th>
                    {invoice.is_interstate
                      ? <th className="text-right p-2">IGST</th>
                      : (<><th className="text-right p-2">CGST</th><th className="text-right p-2">SGST</th></>)}
                    <th className="text-right p-2">Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnRows.map((r) => (
                    <tr key={r.hsn} className="border-t border-border">
                      <td className="p-2 font-mono">{r.hsn}</td>
                      <td className="p-2 text-right tabular-nums">{formatINR(r.taxable)}</td>
                      {invoice.is_interstate
                        ? <td className="p-2 text-right tabular-nums">{formatINR(r.igst)}</td>
                        : (<><td className="p-2 text-right tabular-nums">{formatINR(r.cgst)}</td><td className="p-2 text-right tabular-nums">{formatINR(r.sgst)}</td></>)}
                      <td className="p-2 text-right tabular-nums font-medium">{formatINR(r.total_tax)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-semibold" style={{ background: theme.surface }}>
                    <td className="p-2">Total</td>
                    <td className="p-2 text-right tabular-nums">{formatINR(hsnRows.reduce((a, b) => a + b.taxable, 0))}</td>
                    {invoice.is_interstate
                      ? <td className="p-2 text-right tabular-nums">{formatINR(invoice.igst_amount)}</td>
                      : (<><td className="p-2 text-right tabular-nums">{formatINR(invoice.cgst_amount)}</td><td className="p-2 text-right tabular-nums">{formatINR(invoice.sgst_amount)}</td></>)}
                    <td className="p-2 text-right tabular-nums">{formatINR(totalTax)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Totals + amount in words */}
          <div className="grid grid-cols-[1fr_280px] gap-6 mt-6 items-start">
            <div className="p-3 rounded-md border border-border text-sm" style={{ background: theme.surface }}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Amount in words</div>
              <div className="font-semibold">{amountInWords(invoice.total)}</div>
            </div>
            <div className="p-4 rounded-md border border-border text-sm space-y-1" style={{ background: theme.surface }}>
              <Row label="Subtotal" value={formatINR(invoice.subtotal)} />
              {Number(invoice.discount_amount) > 0 && <Row label="Discount" value={`- ${formatINR(invoice.discount_amount)}`} />}
              {invoice.is_interstate ? (
                <Row label="IGST" value={formatINR(invoice.igst_amount)} />
              ) : (
                <>
                  <Row label="CGST" value={formatINR(invoice.cgst_amount)} />
                  <Row label="SGST" value={formatINR(invoice.sgst_amount)} />
                </>
              )}
              {roundOff !== 0 && <Row label="Round off" value={`${roundOff > 0 ? "+ " : "- "}${formatINR(Math.abs(roundOff))}`} />}
              <div className="flex justify-between font-bold text-base border-t-2 pt-2 mt-2" style={{ borderColor: theme.accent, color: theme.accent }}>
                <span>Grand Total</span><span className="tabular-nums">{formatINR(invoice.total)}</span>
              </div>
              {Number(invoice.amount_paid) > 0 && (
                <>
                  <Row label="Paid" value={`- ${formatINR(invoice.amount_paid)}`} />
                  <div className="flex justify-between font-semibold pt-1"><span>Balance due</span><span className="tabular-nums">{formatINR(Math.max(0, Number(invoice.total) - Number(invoice.amount_paid)))}</span></div>
                </>
              )}
            </div>
          </div>

          {/* Bank + terms */}
          {(company.bank_name || company.bank_account_number || company.upi_id) && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              {(company.bank_name || company.bank_account_number) && (
                <div className="p-4 rounded-md border border-border text-xs">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Bank details</div>
                  <div className="space-y-0.5 text-foreground">
                    {company.bank_name && <div>Bank: <span className="font-medium">{company.bank_name}</span></div>}
                    {company.bank_account_name && <div>A/C Name: <span className="font-medium">{company.bank_account_name}</span></div>}
                    {company.bank_account_number && <div>A/C No: <span className="font-mono font-medium">{company.bank_account_number}</span></div>}
                    {company.bank_ifsc && <div>IFSC: <span className="font-mono font-medium">{company.bank_ifsc}</span></div>}
                  </div>
                </div>
              )}
              {company.upi_id && (
                <div className="p-4 rounded-md border border-border text-xs">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Scan & Pay (UPI)</div>
                  <div className="font-mono">{company.upi_id}</div>
                  <p className="text-muted-foreground mt-1">A scannable UPI QR is embedded in the PDF.</p>
                </div>
              )}
            </div>
          )}

          {(invoice.notes || termsLines.length > 0) && (
            <div className="mt-6 p-4 rounded-md border border-border text-xs space-y-3">
              {invoice.notes && (
                <div>
                  <div className="uppercase tracking-widest text-[10px] text-muted-foreground mb-1">Notes</div>
                  <div className="whitespace-pre-line">{invoice.notes}</div>
                </div>
              )}
              {termsLines.length > 0 && (
                <div>
                  <div className="uppercase tracking-widest text-[10px] text-muted-foreground mb-1">Terms & conditions</div>
                  <ol className="list-decimal pl-5 space-y-0.5">
                    {termsLines.map((t, i) => <li key={i}>{t}</li>)}
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Signatures */}
          <div className="mt-8 grid grid-cols-2 gap-6">
            <div className="flex flex-col items-center pt-10">
              <div className="w-2/3 border-t border-foreground/70 pt-2 text-center text-sm font-semibold">Receiver Signature</div>
              <div className="text-[10px] text-muted-foreground mt-1">Goods received in good condition</div>
            </div>
            <div className="flex flex-col items-center relative">
              {(company as { stamp_url?: string }).stamp_url && <img src={(company as { stamp_url?: string }).stamp_url} alt="" className="absolute right-2 -top-2 h-16 w-16 object-contain opacity-80" />}
              {company.signature_url
                ? <img src={company.signature_url} alt="" className="h-12 object-contain" />
                : <div className="h-12" />}
              <div className="w-2/3 border-t border-foreground/70 pt-2 text-center text-sm font-semibold mt-2">Authorised Signatory</div>
              <div className="text-[10px] text-muted-foreground mt-1">For {company.name}</div>
            </div>
          </div>

          <div className="mt-8 pt-3 border-t border-border flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Computer-generated invoice</span>
            <span>Generated by {BRAND.name}</span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-xs text-muted-foreground mb-2">Invoice theme</div>
            <Select value={(invoice.invoice_theme ?? company.invoice_theme ?? "modern-blue") as string} onValueChange={(v) => updateTheme(v as InvoiceThemeKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {THEME_LIST.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-3 rounded-full border border-border" style={{ background: t.accent }} />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          <Card className="p-5">
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={invoice.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="font-semibold">{formatINR(invoice.total)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Paid</div>
                <div className="font-semibold text-success">{formatINR(totalPaid)}</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">Balance due</div>
              <div className={`text-2xl font-semibold mt-1 ${balanceDue > 0 ? "text-foreground" : "text-success"}`}>{formatINR(Math.max(0, balanceDue))}</div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Payments</h3>
              {balanceDue > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setPayDialogOpen(true)}><Plus className="size-4" /></Button>
              )}
            </div>
            {(payments ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {payments!.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{formatINR(p.amount)}</div>
                      <div className="text-xs text-muted-foreground capitalize">{p.mode} · {formatDate(p.payment_date)}{p.reference ? ` · ${p.reference}` : ""}</div>
                    </div>
                    <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Delete this payment?")) return;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const { error } = await (supabase.from("payments" as any)).delete().eq("id", p.id);
                        if (error) return toast.error(error.message);
                        qc.invalidateQueries({ queryKey: ["payments", id] });
                        qc.invalidateQueries({ queryKey: ["invoice", id] });
                        qc.invalidateQueries({ queryKey: ["invoices"] });
                        qc.invalidateQueries({ queryKey: ["invoice-events", id] });
                      }}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {company.upi_id && (
            <Card className="p-5">
              <div className="text-xs text-muted-foreground">UPI payment</div>
              <div className="font-mono text-sm mt-1">{company.upi_id}</div>
              <p className="text-xs text-muted-foreground mt-2">A scannable UPI QR code is embedded in the PDF.</p>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="size-4" /> Activity</h3>
            {(events ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {events!.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-foreground">{e.message || e.event_type}</div>
                      <div className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}

function EwbDialog({ open, onOpenChange, invoice, items, company }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoice: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  company: any;
}) {
  const [transporter, setTransporter] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [distance, setDistance] = useState("");

  const ewb = {
    supplyType: "O",
    subSupplyType: "1",
    docType: "INV",
    docNo: invoice.invoice_number,
    docDate: invoice.invoice_date,
    fromGstin: company.gstin || "URP",
    fromTrdName: company.name,
    fromAddr1: company.address_line1 || "",
    fromPlace: company.city || "",
    fromPincode: company.pincode || "",
    fromStateCode: company.state_code || "",
    toGstin: invoice.customer_gstin || "URP",
    toTrdName: invoice.customer_name,
    toAddr1: invoice.customer_billing_address || "",
    toPlace: (invoice.customer_state || "").split(",")[0] || "",
    toPincode: "",
    toStateCode: "",
    totalValue: Number(invoice.subtotal),
    cgstValue: Number(invoice.cgst_amount || 0),
    sgstValue: Number(invoice.sgst_amount || 0),
    igstValue: Number(invoice.igst_amount || 0),
    cessValue: 0,
    totInvValue: Number(invoice.total),
    transporterId: "",
    transporterName: transporter,
    transDocNo: "",
    transMode: "1",
    transDistance: distance || "0",
    vehicleNo: vehicle,
    vehicleType: "R",
    itemList: items.map((it, i) => ({
      itemNo: i + 1,
      productName: it.name,
      productDesc: it.description || it.name,
      hsnCode: it.hsn_sac || "",
      quantity: Number(it.quantity),
      qtyUnit: it.unit || "NOS",
      taxableAmount: Number(it.subtotal ?? it.total),
      cgstRate: Number(it.cgst_rate || 0),
      sgstRate: Number(it.sgst_rate || 0),
      igstRate: Number(it.igst_rate || 0),
      cessRate: 0,
    })),
  };

  const json = JSON.stringify(ewb, null, 2);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast.success("E-Way Bill JSON copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const downloadJson = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `EWB-${invoice.invoice_number}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>E-Way Bill preparation</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground -mt-1">
          Generated locally from this invoice. Copy or download the JSON, then upload it to the official E-Way Bill portal — no paid GSP integration required.
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="space-y-1.5"><Label>Transporter</Label><Input value={transporter} onChange={(e) => setTransporter(e.target.value)} placeholder="Optional" /></div>
          <div className="space-y-1.5"><Label>Vehicle no</Label><Input value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} placeholder="MH12AB1234" /></div>
          <div className="space-y-1.5"><Label>Distance (km)</Label><Input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} /></div>
        </div>
        <Textarea readOnly value={json} rows={10} className="font-mono text-[11px] mt-3" />
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button type="button" variant="outline" onClick={copyJson}><Copy className="size-4" /> Copy JSON</Button>
          <Button type="button" variant="outline" onClick={downloadJson}><Download className="size-4" /> Download JSON</Button>
          <Button type="button" asChild>
            <a href="https://ewaybillgst.gov.in/" target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Open E-Way Bill portal</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ open, onOpenChange, invoiceId, companyId, suggested, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoiceId: string;
  companyId: string;
  suggested: number;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState<string>("");
  const [mode, setMode] = useState("cash");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount || suggested);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("payments" as any)).insert({
      invoice_id: invoiceId, company_id: companyId, amount: amt, mode, reference, payment_date: paymentDate, notes,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    setAmount(""); setReference(""); setNotes("");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3 mt-2">
          <div className="space-y-1.5 col-span-2"><Label>Amount *</Label>
            <Input type="number" step="0.01" placeholder={`Suggested: ${suggested.toFixed(2)}`} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["cash", "upi", "bank_transfer", "card", "cheque", "other"].map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2"><Label>Reference number</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref / cheque no" /></div>
          <div className="space-y-1.5 col-span-2"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <DialogFooter className="col-span-2 mt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save payment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}