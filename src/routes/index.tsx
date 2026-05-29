import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { bdt } from "@/lib/inventory-utils";
import { forecastProduct } from "@/lib/forecast";
import {
  Boxes,
  Layers,
  AlertTriangle,
  PackageX,
  Clock,
  CalendarClock,
  Wallet,
  TrendingUp,
  Flame,
  Brain,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — JerseyBecho AI" },
      { name: "description", content: "AI-powered inventory dashboard for jersey sellers." },
    ],
  }),
  component: DashboardPage,
});

function Stat({
  icon: Icon, label, value, hint, accent,
}: { icon: any; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="overflow-hidden card-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {label}
            </div>
            <div className="text-2xl font-bold mt-1 text-foreground">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent || "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { products } = useStore();

  const stats = useMemo(() => {
    let totalUnits = 0,
      lowStock = 0,
      outOfStock = 0,
      preorder = 0,
      restocking = 0,
      invValue = 0,
      profit = 0;
    for (const p of products) {
      for (const v of p.variants) {
        totalUnits += v.stock_quantity;
        invValue += v.stock_quantity * v.buy_price;
        profit += v.stock_quantity * (v.selling_price - v.buy_price);
        if (v.stock_quantity === 0 && v.status === "Preorder") preorder++;
        else if (v.stock_quantity === 0) outOfStock++;
        else if (v.stock_quantity <= v.low_stock_threshold) lowStock++;
        if (v.possible_restock_date) restocking++;
      }
    }
    return { totalUnits, lowStock, outOfStock, preorder, restocking, invValue, profit };
  }, [products]);

  const forecasts = useMemo(
    () => products.map(forecastProduct).sort((a, b) => b.score - a.score),
    [products],
  );
  const highDemand = forecasts.filter((f) => f.demand === "High");
  const restockAlerts = forecasts.filter(
    (f) => f.action === "Buy Now" || f.action === "Restock Soon" || f.action === "Preorder / Restock",
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="24/7 AI inventory intelligence for jersey sellers"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Stat icon={Boxes} label="Total products" value={String(products.length)} />
        <Stat icon={Layers} label="Total stock units" value={String(stats.totalUnits)} />
        <Stat icon={AlertTriangle} label="Low stock" value={String(stats.lowStock)} accent="bg-warning/15 text-warning-foreground" />
        <Stat icon={PackageX} label="Out of stock" value={String(stats.outOfStock)} accent="bg-destructive/10 text-destructive" />
        <Stat icon={Clock} label="Preorder" value={String(stats.preorder)} accent="bg-info/15 text-info" />
        <Stat icon={CalendarClock} label="Expected restock" value={String(stats.restocking)} />
        <Stat icon={Wallet} label="Inventory value" value={bdt(stats.invValue)} accent="bg-primary/10 text-primary" />
        <Stat icon={TrendingUp} label="Potential profit" value={bdt(stats.profit)} accent="bg-success/15 text-success" />
        <Stat icon={Flame} label="High demand" value={String(highDemand.length)} accent="bg-accent text-accent-foreground" />
        <Stat icon={Brain} label="AI restock alerts" value={String(restockAlerts.length)} accent="bg-primary/10 text-primary" />
      </div>

      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-md bg-accent text-accent-foreground flex items-center justify-center">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold">Today's AI Business Alerts</div>
              <div className="text-xs text-muted-foreground">
                Inventory-aware insights generated from your real stock data
              </div>
            </div>
          </div>
          <ul className="space-y-2">
            {forecasts.slice(0, 5).map((f) => (
              <li
                key={f.product_id}
                className="flex items-start gap-3 p-3 rounded-md border border-border bg-muted/30"
              >
                <Badge
                  variant="outline"
                  className={
                    f.demand === "Spike"
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : f.demand === "High"
                      ? "bg-accent text-accent-foreground border-transparent"
                      : f.demand === "Medium"
                      ? "bg-info/15 text-info border-info/30"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {f.action}
                </Badge>
                <div className="text-sm text-foreground/90 flex-1">
                  <span className="font-medium">{f.product_name}</span> — {f.explanation}
                </div>
                <span className="text-xs font-mono text-muted-foreground">{f.score}/100</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="font-semibold mb-1">Inventory-first AI architecture</div>
          <p className="text-xs text-muted-foreground mb-3">
            JerseyBecho AI uses an inventory-first AI architecture. Instead of giving random
            chatbot answers, it first checks structured stock data, then explains the match,
            then generates a safe customer reply, and finally updates demand forecasting
            signals for future restock decisions.
          </p>
          <ol className="grid md:grid-cols-7 gap-2 text-xs text-muted-foreground">
            {[
              "Customer Message",
              "Entity Detection",
              "Inventory Match",
              "Safe Reply",
              "Demand Signal",
              "Forecast Score (DSS)",
              "Restock Action",
            ].map((s, i) => (
              <li
                key={i}
                className="p-2 rounded-md border border-border bg-background"
              >
                <div className="text-[10px] font-semibold text-primary">STEP {i + 1}</div>
                {s}
              </li>
            ))}
          </ol>
          <div className="grid md:grid-cols-5 gap-2 mt-4 text-xs">
            {[
              "Reduce late replies",
              "Reduce stockout risk",
              "Improve restock decisions",
              "Convert more Messenger leads",
              "Save operator cost",
            ].map((k) => (
              <div key={k} className="px-3 py-2 rounded-md bg-primary/5 text-primary font-medium">
                ✓ {k}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Link to="/query-sim" className="text-sm text-primary underline">Try the AI query simulator →</Link>
            <Link to="/forecast" className="text-sm text-primary underline">See forecasts →</Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
