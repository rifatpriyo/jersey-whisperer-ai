import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { forecastProduct } from "@/lib/forecast";
import { Globe, MessageCircle, Newspaper, Database, Inbox, Sparkles } from "lucide-react";

export const Route = createFileRoute("/forecast")({
  head: () => ({ meta: [{ title: "Forecast Preview — JerseyBecho AI" }] }),
  component: ForecastPage,
});

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}/100</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function demandBadgeClass(d: string) {
  if (d === "Spike") return "bg-destructive/15 text-destructive border-destructive/30";
  if (d === "High") return "bg-accent text-accent-foreground border-transparent";
  if (d === "Medium") return "bg-info/15 text-info border-info/30";
  if (d === "Low") return "bg-warning/15 text-warning-foreground border-warning/40";
  return "bg-muted text-muted-foreground";
}

function ForecastPage() {
  const { products } = useStore();
  const forecasts = useMemo(() => {
    try {
      return products.map(forecastProduct).sort((a, b) => b.score - a.score);
    } catch (e) {
      console.error("Forecast error:", e);
      return [];
    }
  }, [products]);

  return (
    <>
      <PageHeader
        title="Forecast Preview"
        subtitle="Demand Spike Score (DSS) — combines trend, queries, stock, margin, and velocity"
      />

      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-sm">
              <div className="font-semibold text-foreground mb-1">
                External Signal Layer — API-ready Roadmap
              </div>
              <div className="text-muted-foreground mb-3">
                Current MVP uses simulated/manual trend signals. Production version will connect
                these sources through secure backend APIs (no keys in frontend).
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                <SourceChip icon={Globe} title="Google Trends BD" desc="Search interest" />
                <SourceChip icon={Newspaper} title="Meta Ad Library" desc="Competitor ad activity" />
                <SourceChip icon={MessageCircle} title="Sports news" desc="Player/team hype" />
                <SourceChip icon={Inbox} title="Messenger / WhatsApp" desc="Real query velocity" />
                <SourceChip icon={Database} title="Inventory DB" desc="Stock risk & margin" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {forecasts.map((f) => (
          <Card key={f.product_id} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{f.product_name}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <Badge variant="outline" className={demandBadgeClass(f.demand)}>
                      {f.demand} Demand
                    </Badge>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      {f.action}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {f.query_count} queries · trend {f.trend_signal}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-bold text-foreground leading-none">{f.score}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">DSS / 100</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                <ScoreBar label="Trend signal" value={f.breakdown.trend} />
                <ScoreBar label="Query demand" value={f.breakdown.queries} />
                <ScoreBar label="Stock risk" value={f.breakdown.stock} />
                <ScoreBar label="Profit margin" value={f.breakdown.margin} />
                <ScoreBar label="Sales velocity" value={f.breakdown.velocity} />
              </div>

              <div className="text-sm bg-muted/40 rounded-md p-3 border border-border">
                {f.explanation}
              </div>

              {(f.action === "Buy Now" || f.action === "Restock Soon") && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge className="bg-primary text-primary-foreground">
                    Restock ~{f.suggested_restock_quantity} pcs
                  </Badge>
                  {f.priority_sizes.map((s) => (
                    <Badge key={s} variant="outline" className="font-mono">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {forecasts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No products to forecast yet. Add inventory to see DSS scores.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function SourceChip({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-background border border-border">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium text-foreground truncate">{title}</div>
        <div className="text-[10px] text-muted-foreground truncate">{desc}</div>
      </div>
    </div>
  );
}
