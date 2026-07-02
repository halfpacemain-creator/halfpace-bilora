import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/format";
import { Plus, FileText, IndianRupee, Clock, CheckCircle2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { StatusBadge } from "@/components/status-badge";

export const Route = createLazyFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: company } = useCompany();
  const companyId = company?.id;

  const { data: invoices } = useQuery({
    enabled: !!companyId,
    queryKey: ["dashboard-invoices", companyId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("invoices" as any))
        .select("*").eq("company_id", companyId).order("invoice_date", { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });

  const list = invoices ?? [];
  const totalSales = list.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const invoiceCount = list.length;
  const pending = list.filter((i) => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0);
  const paidCount = list.filter((i) => i.status === "paid").length;

  const months: { label: string; total: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-IN", { month: "short" });
    const total = list
      .filter((inv) => {
        const id = new Date(inv.invoice_date);
        return id.getFullYear() === d.getFullYear() && id.getMonth() === d.getMonth() && inv.status === "paid";
      })
      .reduce((s, inv) => s + Number(inv.total), 0);
    months.push({ label, total });
  }

  const recent = list.slice(0, 5);

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back${company ? ", " + company.name : ""}`}
        description="Here's what's happening with your business today."
        actions={
          <Button asChild>
            <Link to="/invoices/new"><Plus className="size-4" /> New Invoice</Link>
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={IndianRupee} label="Total sales" value={formatINR(totalSales)} accent="success" />
        <Kpi icon={FileText} label="Invoices" value={invoiceCount.toString()} accent="primary" />
        <Kpi icon={Clock} label="Pending" value={formatINR(pending)} accent="warning" />
        <Kpi icon={CheckCircle2} label="Paid" value={paidCount.toString()} accent="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mt-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-semibold">Revenue (last 6 months)</h2>
            <span className="text-xs text-muted-foreground">Paid invoices only</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => "₹" + Math.round(v / 1000) + "k"} />
                <Tooltip
                  formatter={(v: number) => formatINR(v)}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Recent invoices</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet. Create your first one.</p>
          ) : (
            <div className="space-y-3">
              {recent.map((inv) => (
                <Link key={inv.id} to="/invoices/$id" params={{ id: inv.id }} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition">
                  <div>
                    <div className="text-sm font-medium">{inv.invoice_number}</div>
                    <div className="text-xs text-muted-foreground">{inv.customer_name || "—"} · {formatDate(inv.invoice_date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{formatINR(inv.total)}</div>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent: "primary" | "success" | "warning" }) {
  const map = {
    primary: "bg-accent text-accent-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
  } as const;
  return (
    <Card className="p-5 h-full flex flex-col justify-between min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground truncate">{label}</span>
        <div className={`size-8 rounded-md flex items-center justify-center ${map[accent]}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="text-2xl font-semibold tracking-tight mt-2 tabular-nums truncate">{value}</div>
    </Card>
  );
}