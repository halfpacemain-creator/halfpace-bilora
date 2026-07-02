import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-success/15 text-success border-success/30",
    partial: "bg-warning/15 text-warning border-warning/30",
    draft: "bg-muted text-muted-foreground border-border",
    finalized: "bg-primary/10 text-primary border-primary/30",
    pdf_generated: "bg-primary/15 text-primary border-primary/30",
    shared: "bg-accent text-accent-foreground border-accent",
    sent: "bg-accent text-accent-foreground border-accent",
    overdue: "bg-destructive/15 text-destructive border-destructive/30",
    cancelled: "bg-muted text-muted-foreground border-border line-through",
  };
  const labelMap: Record<string, string> = {
    partial: "partially paid",
    pdf_generated: "PDF generated",
  };
  const label = labelMap[status] ?? status;
  return <Badge variant="outline" className={`text-[10px] mt-1 capitalize ${map[status] || ""}`}>{label}</Badge>;
}