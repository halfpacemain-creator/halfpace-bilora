import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { nextInvoiceNumber } from "@/lib/api/invoices.functions";
import { useCompany } from "@/hooks/use-company";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeTotals } from "@/lib/gst";
import { formatINR, isoDate, addDays } from "@/lib/format";
import { Plus, Trash2, GripVertical, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { CustomerFormDialog, type CustomerLike } from "@/components/customer-form-dialog";
import { THEME_LIST, DEFAULT_THEME, type InvoiceThemeKey } from "@/lib/invoice-themes";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/_authenticated/invoices/new")({
  head: () => ({ meta: [{ title: "New invoice · HalfPace Bilora" }] }),
  component: NewInvoice,
});

interface Item {
  uid: string;
  product_id: string | null;
  name: string; description: string; hsn_sac: string; unit: string;
  quantity: number; rate: number; gst_rate: number;
}

const blankItem = (): Item => ({
  uid: crypto.randomUUID(),
  product_id: null, name: "", description: "", hsn_sac: "", unit: "Nos",
  quantity: 1, rate: 0, gst_rate: 18,
});

function NewInvoice() {
  const { data: company } = useCompany();
  const navigate = useNavigate();
  const nextNum = useServerFn(nextInvoiceNumber);
  const qc = useQueryClient();

  const [customerId, setCustomerId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState(isoDate());
  const [dueDate, setDueDate] = useState(isoDate(addDays(new Date(), 30)));
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [theme, setTheme] = useState<InvoiceThemeKey>(DEFAULT_THEME);

  const { data: customers } = useQuery({
    enabled: !!company,
    queryKey: ["customers", company?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("customers" as any))
        .select("*").eq("company_id", company!.id).order("name");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as unknown) as any[];
    },
  });

  const { data: products } = useQuery({
    enabled: !!company,
    queryKey: ["products", company?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("products" as any))
        .select("*").eq("company_id", company!.id).order("name");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as unknown) as any[];
    },
  });

  useEffect(() => {
    if (company && !invoiceNumber) {
      nextNum({ data: { company_id: company.id } }).then((r) => setInvoiceNumber(r.invoice_number)).catch(console.error);
    }
    if (company && !terms) setTerms(company.invoice_terms ?? "");
    if (company && !notes) setNotes(company.invoice_notes ?? "");
    if (company?.invoice_theme) setTheme((prev) => (prev === DEFAULT_THEME ? (company.invoice_theme as InvoiceThemeKey) : prev));
  }, [company, invoiceNumber, nextNum, terms, notes]);

  const customer = (customers ?? []).find((c) => c.id === customerId);
  const isInterstate = useMemo(() => {
    if (!company?.state_code || !customer?.state_code) return false;
    return company.state_code !== customer.state_code;
  }, [company?.state_code, customer?.state_code]);

  const totals = useMemo(
    () => computeTotals(items, { isInterstate, discountType, discountValue }),
    [items, isInterstate, discountType, discountValue],
  );

  const updateItem = (i: number, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const selectProduct = (i: number, productId: string) => {
    const p = (products ?? []).find((x) => x.id === productId);
    if (!p) return;
    updateItem(i, {
      product_id: p.id, name: p.name, description: p.description ?? "", hsn_sac: p.hsn_sac ?? "",
      unit: p.unit ?? "Nos", rate: Number(p.selling_price), gst_rate: Number(p.gst_rate),
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((it) => it.uid === active.id);
      const newIdx = prev.findIndex((it) => it.uid === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const save = async (status: "draft" | "sent") => {
    if (!company || !customer || items.length === 0 || !items[0].name) {
      return toast.error("Pick a customer and add at least one item");
    }
    setSaving(true);
    const invoicePayload = {
      company_id: company.id,
      customer_id: customer.id,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      status,
      customer_name: customer.name,
      customer_gstin: customer.gstin,
      customer_billing_address: customer.billing_address,
      customer_state: customer.state,
      customer_state_code: customer.state_code,
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
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase.from("invoices" as any))
      .insert(invoicePayload).select("id").single();
    if (error) { setSaving(false); return toast.error(error.message); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created_ = created as any;
    const itemRows = items.map((it, idx) => ({
      invoice_id: created_.id,
      product_id: it.product_id,
      position: idx,
      name: it.name,
      description: it.description,
      hsn_sac: it.hsn_sac,
      unit: it.unit,
      quantity: it.quantity,
      rate: it.rate,
      gst_rate: it.gst_rate,
      taxable_amount: totals.items[idx].taxable_amount,
      cgst_amount: totals.items[idx].cgst_amount,
      sgst_amount: totals.items[idx].sgst_amount,
      igst_amount: totals.items[idx].igst_amount,
      total: totals.items[idx].total,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: itemErr } = await (supabase.from("invoice_items" as any)).insert(itemRows);
    setSaving(false);
    if (itemErr) return toast.error(itemErr.message);
    toast.success("Invoice created");
    navigate({ to: "/invoices/$id", params: { id: created_.id } });
  };

  return (
    <PageContainer>
      <PageHeader
        title="New invoice"
        description={invoiceNumber ? `Number: ${invoiceNumber}` : "Generating number…"}
        actions={
          <>
            <Button variant="outline" disabled={saving} onClick={() => save("draft")}>Save draft</Button>
            <Button disabled={saving} onClick={() => save("sent")}>{saving ? "Saving..." : "Save invoice"}</Button>
          </>
        }
      />

      <CustomerFormDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        companyId={company?.id}
        onSaved={(c) => {
          qc.invalidateQueries({ queryKey: ["customers", company?.id] });
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
                  <SelectTrigger className="flex-1"><SelectValue placeholder={(customers ?? []).length ? "Select customer" : "No customers yet — add one"} /></SelectTrigger>
                  <SelectContent>
                    {(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setCustomerDialogOpen(true)} className="shrink-0">
                  <UserPlus className="size-4" /> New customer
                </Button>
              </div>
              {customer && (
                <p className="text-xs text-muted-foreground mt-1">
                  {customer.gstin && <>GSTIN: {customer.gstin} · </>}
                  {customer.state} · Tax: {isInterstate ? "IGST (interstate)" : "CGST + SGST (intrastate)"}
                </p>
              )}
            </div>
            <div className="space-y-1.5"><Label>Invoice date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Invoice #</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="font-mono" /></div>
            <div className="space-y-1.5">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as InvoiceThemeKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THEME_LIST.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            {/* Desktop sticky header */}
            <div className="hidden lg:grid sticky top-0 z-10 grid-cols-[28px_minmax(240px,3fr)_100px_80px_110px_88px_120px_36px] gap-3 px-4 py-3 bg-muted/60 backdrop-blur text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <div />
              <div>Product / Service</div>
              <div>HSN/SAC</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Rate</div>
              <div className="text-right">GST%</div>
              <div className="text-right">Amount</div>
              <div />
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((it) => it.uid)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-border">
                  {items.map((it, i) => (
                    <LineItemRow
                      key={it.uid}
                      item={it}
                      index={i}
                      products={products ?? []}
                      onChange={(patch) => updateItem(i, patch)}
                      onPickProduct={(pid) => selectProduct(i, pid)}
                      onRemove={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                      canRemove={items.length > 1}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <div className="p-3 border-t border-border bg-muted/30 sticky bottom-0">
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, blankItem()])}>
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
            <Row label="Subtotal" value={formatINR(totals.subtotal)} />
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
            {totals.discount_amount > 0 && <Row label="Discount amount" value={`- ${formatINR(totals.discount_amount)}`} />}
            <Row label="Taxable" value={formatINR(totals.taxable)} />
            {isInterstate ? (
              <Row label="IGST" value={formatINR(totals.igst)} />
            ) : (
              <>
                <Row label="CGST" value={formatINR(totals.cgst)} />
                <Row label="SGST" value={formatINR(totals.sgst)} />
              </>
            )}
            <div className="border-t border-border pt-3 mt-3">
              <Row label={<span className="font-semibold text-foreground">Grand total</span>} value={<span className="font-semibold text-lg">{formatINR(totals.total)}</span>} />
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LineItemRow({ item, index, products, onChange, onPickProduct, onRemove, canRemove }: {
  item: Item;
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any[];
  onChange: (patch: Partial<Item>) => void;
  onPickProduct: (pid: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const lineTotal = (Number(item.quantity) || 0) * (Number(item.rate) || 0);

  return (
    <li ref={setNodeRef} style={style} className="bg-card">
      {/* Desktop row */}
      <div className={`hidden lg:grid grid-cols-[28px_minmax(240px,3fr)_100px_80px_110px_88px_120px_36px] gap-3 px-4 py-4 items-start hover:bg-muted/30 transition-colors ${index % 2 ? "bg-muted/20" : ""}`}>
        <button type="button" {...attributes} {...listeners} className="mt-2 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing" aria-label="Drag to reorder">
          <GripVertical className="size-4" />
        </button>
        <div className="space-y-2 min-w-0">
          {products.length > 0 && (
            <Select value={item.product_id ?? ""} onValueChange={onPickProduct}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick from catalog…" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input placeholder="Item name *" value={item.name} onChange={(e) => onChange({ name: e.target.value })} className="font-medium h-9" />
          <Textarea placeholder="Description (optional)" rows={1} value={item.description} onChange={(e) => onChange({ description: e.target.value })} className="text-xs min-h-9 resize-y break-words" />
        </div>
        <Input className="font-mono text-xs h-9" value={item.hsn_sac} onChange={(e) => onChange({ hsn_sac: e.target.value })} />
        <Input type="number" step="0.01" className="h-9 text-right tabular-nums" value={item.quantity} onChange={(e) => onChange({ quantity: Number(e.target.value) })} />
        <Input type="number" step="0.01" className="h-9 text-right tabular-nums" value={item.rate} onChange={(e) => onChange({ rate: Number(e.target.value) })} />
        <Select value={String(item.gst_rate)} onValueChange={(v) => onChange({ gst_rate: Number(v) })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{[0, 3, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
        </Select>
        <div className="text-right text-sm font-semibold pt-2 tabular-nums whitespace-nowrap">{formatINR(lineTotal)}</div>
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} disabled={!canRemove} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Mobile card */}
      <div className="lg:hidden p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing" aria-label="Drag to reorder">
              <GripVertical className="size-4" />
            </button>
            <span>Item #{index + 1}</span>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onRemove} disabled={!canRemove}>
            <Trash2 className="size-4" />
          </Button>
        </div>
        {products.length > 0 && (
          <Select value={item.product_id ?? ""} onValueChange={onPickProduct}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pick from catalog…" /></SelectTrigger>
            <SelectContent>
              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input placeholder="Item name *" value={item.name} onChange={(e) => onChange({ name: e.target.value })} />
        <Textarea placeholder="Description (optional)" rows={2} value={item.description} onChange={(e) => onChange({ description: e.target.value })} className="text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label className="text-xs">HSN/SAC</Label><Input className="font-mono text-xs h-9" value={item.hsn_sac} onChange={(e) => onChange({ hsn_sac: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">GST%</Label>
            <Select value={String(item.gst_rate)} onValueChange={(v) => onChange({ gst_rate: Number(v) })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{[0, 3, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Qty</Label><Input type="number" step="0.01" className="h-9" value={item.quantity} onChange={(e) => onChange({ quantity: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Rate</Label><Input type="number" step="0.01" className="h-9" value={item.rate} onChange={(e) => onChange({ rate: Number(e.target.value) })} /></div>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-border text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-semibold tabular-nums">{formatINR(lineTotal)}</span>
        </div>
      </div>
    </li>
  );
}