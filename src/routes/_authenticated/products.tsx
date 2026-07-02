import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

interface Product {
  id: string; company_id: string; name: string; description: string | null;
  type: string; hsn_sac: string | null; unit: string | null;
  selling_price: number; gst_rate: number; stock: number | null; track_inventory: boolean;
}

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products & Services · HalfPace Bilora" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { data: company } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");

  const { data: products } = useQuery({
    enabled: !!company,
    queryKey: ["products", company?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("products" as any))
        .select("*").eq("company_id", company!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown) as Product[];
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("products" as any)).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const filtered = (products ?? []).filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.hsn_sac ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.description ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <PageContainer>
      <PageHeader
        title="Products & Services"
        description="Your catalog of goods and services."
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> Add item</Button></DialogTrigger>
            <ProductDialog
              key={editing?.id ?? "new"}
              product={editing}
              companyId={company?.id}
              onSaved={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["products"] }); }}
            />
          </Dialog>
        }
      />
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="size-4 text-muted-foreground" />
          <Input placeholder="Search by name, HSN or description" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No items yet. Add a product or service.</p>
        ) : (
          <div className="overflow-x-auto"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>HSN/SAC</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>GST</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      {p.name}
                      <Badge variant="outline" className="text-[10px] uppercase">{p.type}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.hsn_sac || "—"}</TableCell>
                  <TableCell className="text-sm">{p.unit || "—"}</TableCell>
                  <TableCell className="font-medium">{formatINR(p.selling_price)}</TableCell>
                  <TableCell className="text-sm">{p.gst_rate}%</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        )}
      </Card>
    </PageContainer>
  );
}

function ProductDialog({ product, companyId, onSaved }: { product: Product | null; companyId?: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    type: product?.type ?? "product",
    hsn_sac: product?.hsn_sac ?? "",
    unit: product?.unit ?? "Nos",
    selling_price: product?.selling_price ?? 0,
    gst_rate: product?.gst_rate ?? 18,
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!companyId) return toast.error("Set up your business first");
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), company_id: companyId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = product
        ? (supabase.from("products" as any)).update(payload).eq("id", product.id)
        : (supabase.from("products" as any)).insert(payload);
      const { error } = await q;
      if (error) { console.error("[product-save]", error); toast.error(error.message); return; }
      toast.success(product ? "Item updated" : "Item added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>{product ? "Edit item" : "Add item"}</DialogTitle></DialogHeader>
      <form onSubmit={save} className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label>Name *</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="service">Service</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Unit</Label>
          <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Nos, Kg, Hr…" />
        </div>
        <div className="space-y-1.5">
          <Label>HSN / SAC</Label>
          <Input value={form.hsn_sac} onChange={(e) => setForm({ ...form, hsn_sac: e.target.value })} className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label>GST rate (%)</Label>
          <Select value={String(form.gst_rate)} onValueChange={(v) => setForm({ ...form, gst_rate: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 3, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Selling price (₹)</Label>
          <Input type="number" step="0.01" required value={form.selling_price}
            onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Description</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <DialogFooter className="col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}