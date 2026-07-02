import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeTotals } from "@/lib/gst";
import { formatINR } from "@/lib/format";
import { ArrowLeft, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { CustomerFormDialog } from "@/components/customer-form-dialog";
import { THEME_LIST, DEFAULT_THEME, type InvoiceThemeKey } from "@/lib/invoice-themes";

export const Route = createFileRoute("/_authenticated/invoices/$id/edit")({
  head: () => ({ meta: [{ title: "Edit invoice · HalfPace Bilora" }] }),
  component: EditInvoice,
});

interface Item {
  uid: string;
  product_id: string | null;
  name: string; description: string; hsn_sac: string; unit: string;
  quantity: number; rate: number; gst_rate: number;
}
const blank = (): Item => ({
  uid: crypto.randomUUID(), product_id: null, name: "", description: "",
  hsn_sac: "", unit: "Nos", quantity: 1, rate: 0, gst_rate: 18,
});

function EditInvoice() {
  const { id } = Route.useParams();
  const { data: company } = useCompany();
  const navigate = useNavigate();
  const qc = useQueryClient();

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

  const { data: customers } = useQuery({
    enabled: !!company,
    queryKey: ["customers", company?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("customers" as any)).select("*").eq("company_id", company!.id).order("name");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as unknown) as any[];
    },
  });
  const { data: products } = useQuery({
    enabled: !!company,
    queryKey: ["products", company?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("products" as any)).select("*").eq("company_id", company!.id).order("name");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as unknown) as any[];
    },
  });

  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<Item[]>([blank()]);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [theme, setTheme] = useState<InvoiceThemeKey>(DEFAULT_THEME);
  const [shippingAddress, setShippingAddress] = useState("");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data || loaded) return;
    const inv = data.invoice;
    setCustomerId(inv.customer_id ?? "");
    setInvoiceDate(inv.invoice_date ?? "");
    setDueDate(inv.due_date ?? "");
    setDiscountType(inv.discount_type ?? "amount");
    setDiscountValue(Number(inv.discount_value || 0));
    setNotes(inv.notes ?? "");
    setTerms(inv.terms ?? "");
    setTheme((inv.invoice_theme as InvoiceThemeKey) ?? DEFAULT_THEME);
    setShippingAddress(inv.shipping_address ?? "");
    setItems(
      (data.items ?? []).map((it) => ({
        uid: crypto.randomUUID(),
        product_id: it.product_id ?? null,
        name: it.name ?? "", description: it.description ?? "",
        hsn_sac: it.hsn_sac ?? "", unit: it.unit ?? "Nos",
        quantity: Number(it.quantity ?? 1), rate: Number(it.rate ?? 0),
        gst_rate: Number(it.gst_rate ?? 18),
      })),
    );
    setLoaded(true);
  }, [data, loaded]);

  const customer = (customers ?? []).find((c) => c.id === customerId);
  const isInterstate = useMemo(() => {
    if (!company?.state_code || !customer?.state_code) return false;
    return company.state_code !== customer.state_code;
  }, [company?.state_code, customer?.state_code]);

  const totals = useMemo(
    () => computeTotals(items, { isInterstate, discountType, discountValue }),
    [items, isInterstate, discountType, discountValue],
  );

  const updateItem = (i: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const selectProduct = (i: number, productId: string) => {
    const p = (products ?? []).find((x) => x.id === productId);
    if (!p) return;
    updateItem(i, {
      product_id: p.id, name: p.name, description: p.description ?? "",
      hsn_sac: p.hsn_sac ?? "", unit: p.unit ?? "Nos",
      rate: Number(p.selling_price), gst_rate: Number(p.gst_rate),
    });
  };

  const save = async () => {
    if (!company || !customer || items.length === 0 || !items[0].name) {
      return toast.error("Pick a customer and add at least one item");
    }
    setSaving(true);
    try {
      const payload = {
        customer_id: customer.id,
        invoice_date: invoiceDate,
        due_date: dueDate,
        customer_name: customer.name,
        customer_gstin: customer.gstin,
        customer_billing_address: customer.billing_address,
        customer_state: customer.state,
        customer_state_code: customer.state_code,
        shipping_address: shippingAddress || null,
        subtotal: totals.subtotal,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: totals.discount_amount,
        cgst_amount: totals.cgst,
        sgst_amount: totals.sgst,
        igst_amount: totals.igst,
        total: totals.total,
        is_interstate: isInterstate,
        notes, terms,
        invoice_theme: theme,
        updated_at: new Date().toISOString(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (supabase.from("invoices" as any)).update(payload).eq("id", id);
      if (updErr) throw updErr;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: delErr } = await (supabase.from("invoice_items" as any)).delete().eq("invoice_id", id);
      if (delErr) throw delErr;
      const itemRows = items.map((it, idx) => ({
        invoice_id: id, product_id: it.product_id, position: idx,
        name: it.name, description: it.description, hsn_sac: it.hsn_sac,
        unit: it.unit, quantity: it.quantity, rate: it.rate, gst_rate: it.gst_rate,
        taxable_amount: totals.items[idx].taxable_amount,
        cgst_amount: totals.items[idx].cgst_amount,
        sgst_amount: totals.items[idx].sgst_amount,
        igst_amount: totals.items[idx].igst_amount,
        total: totals.items[idx].total,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insErr } = await (supabase.from("invoice_items" as any)).insert(itemRows);
      if (insErr) throw insErr;
      // Log edit event
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("invoice_events" as any)).insert({
        invoice_id: id, company_id: company.id,
        event_type: "edited", message: "Invoice edited",
      });
      toast.success("Invoice updated");
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-events", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-invoices"] });
      navigate({ to: "/invoices/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!data || !company) return <PageContainer><p className="text-muted-foreground">Loading…</p></PageContainer>;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link to="/invoices/$id" params={{ id }}><ArrowLeft className="size-4" /> Back</Link>
      </Button>
      <PageHeader
        title={`Edit ${data.invoice.invoice_number}`}
        description="Invoice number stays the same. Totals and PDF will be regenerated."
        actions={
          <>
            <Button variant="outline" asChild><Link to="/invoices/$id" params={{ id }}>Cancel</Link></Button>
            <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</Button>
          </>
        }
      />

      <CustomerFormDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        companyId={company.id}
        onSaved={(c) => {
          qc.invalidateQueries({ queryKey: ["customers", company.id] });
          setCustomerId(c.id);
        }}
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <Card className="p-6 grid grid-cols-4 gap-4">
            <div className="space-y-1.5 col-span-4">
              <Label>Customer *</Label>
              <div className="flex gap-2">
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setCustomerDialogOpen(true)}>
                  <UserPlus className="size-4" /> New
                </Button>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Invoice date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as InvoiceThemeKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{THEME_LIST.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-4">
              <Label>Shipping address (leave blank to use billing)</Label>
              <Textarea rows={2} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="hidden lg:grid grid-cols-[minmax(220px,3fr)_100px_80px_110px_88px_120px_36px] gap-3 px-4 py-3 bg-muted/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <div>Product / Service</div>
              <div>HSN/SAC</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Rate</div>
              <div className="text-right">GST%</div>
              <div className="text-right">Amount</div>
              <div />
            </div>
            <ul className="divide-y divide-border">
              {items.map((it, i) => {
                const lineTotal = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
                return (
                  <li key={it.uid} className="bg-card">
                    <div className={`hidden lg:grid grid-cols-[minmax(220px,3fr)_100px_80px_110px_88px_120px_36px] gap-3 px-4 py-4 items-start ${i % 2 ? "bg-muted/20" : ""}`}>
                      <div className="space-y-2 min-w-0">
                        {(products ?? []).length > 0 && (
                          <Select value={it.product_id ?? ""} onValueChange={(v) => selectProduct(i, v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick from catalog…" /></SelectTrigger>
                            <SelectContent>{(products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                        <Input placeholder="Item name *" value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} className="font-medium h-9" />
                        <Textarea placeholder="Description" rows={1} value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} className="text-xs min-h-9" />
                      </div>
                      <Input className="font-mono text-xs h-9" value={it.hsn_sac} onChange={(e) => updateItem(i, { hsn_sac: e.target.value })} />
                      <Input type="number" step="0.01" className="h-9 text-right tabular-nums" value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
                      <Input type="number" step="0.01" className="h-9 text-right tabular-nums" value={it.rate} onChange={(e) => updateItem(i, { rate: Number(e.target.value) })} />
                      <Select value={String(it.gst_rate)} onValueChange={(v) => updateItem(i, { gst_rate: Number(v) })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{[0, 3, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                      </Select>
                      <div className="text-right text-sm font-semibold pt-2 tabular-nums">{formatINR(lineTotal)}</div>
                      <Button type="button" size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} disabled={items.length <= 1}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {/* Mobile */}
                    <div className="lg:hidden p-4 space-y-3">
                      <Input placeholder="Item name *" value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">HSN</Label><Input value={it.hsn_sac} onChange={(e) => updateItem(i, { hsn_sac: e.target.value })} /></div>
                        <div><Label className="text-xs">GST%</Label>
                          <Select value={String(it.gst_rate)} onValueChange={(v) => updateItem(i, { gst_rate: Number(v) })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{[0, 3, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">Qty</Label><Input type="number" value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} /></div>
                        <div><Label className="text-xs">Rate</Label><Input type="number" value={it.rate} onChange={(e) => updateItem(i, { rate: Number(e.target.value) })} /></div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-border">
                        <span className="text-sm text-muted-foreground">Amount</span>
                        <span className="font-semibold">{formatINR(lineTotal)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="p-3 border-t border-border bg-muted/30">
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, blank()])}>
                <Plus className="size-4" /> Add line item
              </Button>
            </div>
          </Card>

          <Card className="p-6 grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Terms & conditions</Label><Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
          </Card>
        </div>

        <Card className="p-6 h-fit sticky top-6">
          <h3 className="font-semibold mb-4">Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(totals.subtotal)}</span></div>
            <div className="grid grid-cols-[1fr_90px] gap-2 items-center">
              <Label className="text-xs text-muted-foreground">Discount</Label>
              <div className="flex gap-1">
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as "amount" | "percent")}>
                  <SelectTrigger className="h-8 w-[60px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">₹</SelectItem>
                    <SelectItem value="percent">%</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="h-8" type="number" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
              </div>
            </div>
            {totals.discount_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount amt</span><span>- {formatINR(totals.discount_amount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Taxable</span><span>{formatINR(totals.taxable)}</span></div>
            {isInterstate ? (
              <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>{formatINR(totals.igst)}</span></div>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{formatINR(totals.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{formatINR(totals.sgst)}</span></div>
              </>
            )}
            <div className="border-t border-border pt-3 mt-3 flex justify-between">
              <span className="font-semibold">Grand total</span>
              <span className="font-semibold text-lg">{formatINR(totals.total)}</span>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}