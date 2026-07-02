import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Package, FileText, Settings, LogOut, Plus, Building2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompany } from "@/hooks/use-company";
import { BRAND } from "@/lib/brand";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/products", label: "Products", icon: Package },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: company } = useCompany();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="size-9 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="font-semibold tracking-tight truncate max-w-[160px]">{company?.name || BRAND.name}</div>
              <div className="text-[11px] text-muted-foreground">Billing & GST Invoicing</div>
            </div>
          </Link>
        </div>
        <div className="p-3">
          <Button asChild className="w-full justify-start gap-2 shadow-sm" size="sm">
            <Link to="/invoices/new"><Plus className="size-4" /> New Invoice</Link>
          </Button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => {
            const active = path === item.to || path.startsWith(item.to + "/");
            return (
              <Link key={item.to} to={item.to} className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                <item.icon className="size-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}