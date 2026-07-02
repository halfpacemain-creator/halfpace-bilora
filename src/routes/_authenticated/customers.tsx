import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerFormDialog, type CustomerLike } from "@/components/customer-form-dialog";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers · HalfPace Bilora" }] }),
  component: CustomersPage,
});

type Customer = CustomerLike;

function CustomersPage() {
  const { data: company } = useCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const { data: customers } = useQuery({
    enabled: !!company,
    queryKey: ["customers", company?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("customers" as any))
        .select("*").eq("company_id", company!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown) as Customer[];
    },
  });

  const filtered = (customers ?? []).filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").includes(search) || (c.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const remove = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("customers" as any)).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Customer deleted");
    qc.invalidateQueries({ queryKey: ["customers"] });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        description="Manage the people and businesses you bill."
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4" /> Add customer
          </Button>
        }
      />
      <CustomerFormDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        companyId={company?.id}
        customer={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["customers"] })}
      />

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="size-4 text-muted-foreground" />
          <Input placeholder="Search by name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No customers yet. Add your first one.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.phone || "—"}<br />{c.email || ""}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.gstin || "—"}</TableCell>
                  <TableCell className="text-sm">{c.state || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}