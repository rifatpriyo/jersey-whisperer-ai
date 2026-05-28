import { Badge } from "@/components/ui/badge";
import type { Status, TrendSignal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: Status }) {
  const cls = {
    Available: "bg-success/15 text-success border-success/30",
    "Low Stock": "bg-warning/20 text-warning-foreground border-warning/40",
    "Out of Stock": "bg-destructive/15 text-destructive border-destructive/30",
    Preorder: "bg-info/15 text-info border-info/30",
  }[status];
  return (
    <Badge variant="outline" className={cn("font-medium", cls)}>
      {status}
    </Badge>
  );
}

export function TrendBadge({ trend }: { trend: TrendSignal }) {
  const cls: Record<TrendSignal, string> = {
    High: "bg-accent text-accent-foreground border-transparent",
    Medium: "bg-info/15 text-info border-info/30",
    Low: "bg-muted text-muted-foreground border-border",
    None: "bg-muted/50 text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", cls[trend])}>
      {trend}
    </Badge>
  );
}

