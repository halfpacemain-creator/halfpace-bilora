import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";
import { Plus, Search } from "lucide-react";
import { StatusBadge } from "@/routes/_authenticated/dashboard";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices · HalfPace Bilora" }] }),
  component: InvoicesLayout,
});

function InvoicesLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/invoices") return <Outlet />;
  return <InvoicesList />;
}

function InvoicesList() {
  const { data: company } = useCompany();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: invoices } = useQuery({
    enabled: !!company,
    queryKey: ["invoices", company?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("invoices" as any))
        .select("*").eq("company_id", company!.id).order("invoice_date", { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as unknown) as any[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (invoices ?? []).filter((inv) => {
      const effStatus = (inv.status !== "paid" && inv.status !== "cancelled" && inv.due_date && inv.due_date < today) ? "overdue" : inv.status;
      if (status !== "all" && effStatus !== status) return false;
      if (from && inv.invoice_date < from) return false;
      if (to && inv.invoice_date > to) return false;
      if (q && !`${inv.invoice_number} ${inv.customer_name ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [invoices, search, status, from, to, today]);

  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description="All your invoices in one place."
        actions={<Button asChild><Link to="/invoices/new"><Plus className="size-4" /> New invoice</Link></Button>}
      />
      <Card className="p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_160px]">
          <div className="relative">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input placeholder="Search by number or customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="finalized">Finalized</SelectItem>
              <SelectItem value="pdf_generated">PDF Generated</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
              <SelectItem value="partial">Partially paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        </div>
        {!invoices || invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No invoices yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No invoices match these filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => {
                const effStatus = (inv.status !== "paid" && inv.status !== "cancelled" && inv.due_date && inv.due_date < today) ? "overdue" : inv.status;
                return (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-accent">
                    <TableCell className="font-medium">
                      <Link to="/invoices/$id" params={{ id: inv.id }}>{inv.invoice_number}</Link>
                    </TableCell>
                    <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                    <TableCell>{inv.customer_name || "—"}</TableCell>
                    <TableCell>{formatDate(inv.due_date)}</TableCell>
                    <TableCell><StatusBadge status={effStatus} /></TableCell>
                    <TableCell className="text-right font-medium">{formatINR(inv.total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}