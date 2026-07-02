import { createLazyFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";

export const Route = createLazyFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function startOfMonthIso(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x.toISOString().slice(0, 10);
}

function ReportsPage() {
  const { data: company } = useCompany();
  const [from, setFrom] = useState(startOfMonthIso());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: invoices } = useQuery({
    enabled: !!company,
    queryKey: ["report-invoices", company?.id, from, to],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("invoices" as any))
        .select("*").eq("company_id", company!.id)
        .gte("invoice_date", from).lte("invoice_date", to)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as unknown) as any[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const summary = useMemo(() => {
    const list = invoices ?? [];
    const totalBilled = list.reduce((s, i) => s + Number(i.total), 0);
    const totalPaid = list.reduce((s, i) => s + Number(i.amount_paid || 0), 0);
    const cgst = list.reduce((s, i) => s + Number(i.cgst_amount || 0), 0);
    const sgst = list.reduce((s, i) => s + Number(i.sgst_amount || 0), 0);
    const igst = list.reduce((s, i) => s + Number(i.igst_amount || 0), 0);
    return { totalBilled, totalPaid, outstanding: totalBilled - totalPaid, cgst, sgst, igst, count: list.length };
  }, [invoices]);

  const byCustomer = useMemo(() => {
    const map = new Map<string, { name: string; total: number; paid: number; count: number }>();
    (invoices ?? []).forEach((inv) => {
      const key = inv.customer_name ?? "—";
      const cur = map.get(key) ?? { name: key, total: 0, paid: 0, count: 0 };
      cur.total += Number(inv.total);
      cur.paid += Number(inv.amount_paid || 0);
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [invoices]);

  const outstanding = useMemo(() => {
    return (invoices ?? [])
      .filter((i) => Number(i.total) - Number(i.amount_paid || 0) > 0.01 && i.status !== "cancelled")
      .map((i) => ({
        ...i,
        balance: Number(i.total) - Number(i.amount_paid || 0),
        overdue: i.due_date && i.due_date < today,
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [invoices, today]);

  return (
    <PageContainer>
      <PageHeader title="Reports" description="Sales, taxes and outstanding receivables." />

      <Card className="p-4 mb-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="ml-auto text-xs text-muted-foreground">{summary.count} invoices</div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Stat label="Total billed" value={formatINR(summary.totalBilled)} />
        <Stat label="Collected" value={formatINR(summary.totalPaid)} tone="success" />
        <Stat label="Outstanding" value={formatINR(summary.outstanding)} tone={summary.outstanding > 0 ? "warning" : "muted"} />
        <Stat label="GST collected" value={formatINR(summary.cgst + summary.sgst + summary.igst)} />
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="customers">By customer</TabsTrigger>
          <TabsTrigger value="gst">GST summary</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card className="p-4">
            {(invoices ?? []).length === 0 ? <Empty /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">GST</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invoices!.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.customer_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(inv.subtotal)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(Number(inv.cgst_amount) + Number(inv.sgst_amount) + Number(inv.igst_amount))}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatINR(inv.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card className="p-4">
            {byCustomer.length === 0 ? <Empty /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Invoices</TableHead><TableHead className="text-right">Billed</TableHead><TableHead className="text-right">Collected</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
                <TableBody>
                  {byCustomer.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(c.total)}</TableCell>
                      <TableCell className="text-right tabular-nums text-success">{formatINR(c.paid)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(c.total - c.paid)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="gst">
          <Card className="p-6 grid gap-4 md:grid-cols-3">
            <Stat label="CGST" value={formatINR(summary.cgst)} />
            <Stat label="SGST" value={formatINR(summary.sgst)} />
            <Stat label="IGST" value={formatINR(summary.igst)} />
            <div className="md:col-span-3 pt-4 border-t border-border flex justify-between text-sm">
              <span className="text-muted-foreground">Total GST</span>
              <span className="font-semibold tabular-nums">{formatINR(summary.cgst + summary.sgst + summary.igst)}</span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="outstanding">
          <Card className="p-4">
            {outstanding.length === 0 ? <p className="text-sm text-muted-foreground py-12 text-center">All caught up — no outstanding invoices.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {outstanding.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.invoice_number}</TableCell>
                      <TableCell>{o.customer_name}</TableCell>
                      <TableCell className={o.overdue ? "text-destructive font-medium" : ""}>{formatDate(o.due_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(o.total)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{formatINR(o.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "muted" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  return (
    <Card className="p-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${cls}`}>{value}</div>
    </Card>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground py-12 text-center">No invoices in this date range.</p>;
}