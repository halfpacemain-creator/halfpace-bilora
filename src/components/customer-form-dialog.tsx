import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES } from "@/lib/india";
import { toast } from "sonner";

export interface CustomerLike {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  billing_address: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  companyId,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId?: string;
  customer?: CustomerLike | null;
  onSaved?: (c: CustomerLike) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit customer" : "New customer"}</DialogTitle>
        </DialogHeader>
        <CustomerFormBody
          key={customer?.id ?? "new"}
          companyId={companyId}
          customer={customer}
          onSaved={(c) => { onSaved?.(c); onOpenChange(false); }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CustomerFormBody({ companyId, customer, onSaved }: { companyId?: string; customer?: CustomerLike | null; onSaved: (c: CustomerLike) => void }) {
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    gstin: customer?.gstin ?? "",
    billing_address: customer?.billing_address ?? "",
    city: customer?.city ?? "",
    state: customer?.state ?? "",
    state_code: customer?.state_code ?? "",
    pincode: customer?.pincode ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return toast.error("Set up your business first");
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = { ...form, company_id: companyId };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table: any = supabase.from("customers" as never);
    const q: any = customer
      ? table.update(payload).eq("id", customer.id).select("*").single()
      : table.insert(payload).select("*").single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(customer ? "Customer updated" : "Customer added");
    onSaved(data as CustomerLike);
  };

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-4 mt-2">
      <Field label="Name *" className="col-span-2">
        <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
      <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="GSTIN" className="col-span-2">
        <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} className="font-mono" placeholder="22AAAAA0000A1Z5" />
      </Field>
      <Field label="Billing address" className="col-span-2">
        <Textarea rows={2} value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
      </Field>
      <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
      <Field label="Pincode"><Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></Field>
      <Field label="State" className="col-span-2">
        <Select value={form.state} onValueChange={(v) => {
          const s = INDIAN_STATES.find((x) => x.name === v);
          setForm({ ...form, state: v, state_code: s?.code ?? "" });
        }}>
          <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
          <SelectContent>
            {INDIAN_STATES.map((s) => <SelectItem key={s.code} value={s.name}>{s.name} ({s.code})</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <DialogFooter className="col-span-2 mt-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save customer"}</Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}