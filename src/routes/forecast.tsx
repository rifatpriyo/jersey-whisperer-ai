import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { forecastProduct } from "@/lib/forecast";

export const Route = createFileRoute("/forecast")({
  head: () => ({ meta: [{ title: "Forecast Preview — JerseyBecho AI" }] }),
  component: ForecastPage,
});

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}/{max}</span>
      </div>
      <Progress value={(value / max) * 100} className="h-1.5" />
    </div>
  );
}

function ForecastPage() {
  const { products } = useStore();
  const forecasts = useMemo(
    () => products.map(forecastProduct).sort((a, b) => b.score - a.score),
    [products],
  );

  return (
    <>
      <PageHeader
        title="Forecast Preview"
        subtitle="Explainable demand forecasting from stock, margin, queries, trend & urgency"
      />

      <div className="grid lg:grid-cols-2 gap-4">
        {forecasts.map((f) => (
          <Card key={f.product_id} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-foreground">{f.product_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Action: <span className="font-medium text-primary">{f.action}</span> · Demand:{" "}
                    {f.demand}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-foreground leading-none">{f.score}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">/ 100</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                <ScoreBar label="Stock risk" value={f.breakdown.stock} max={25} />
                <ScoreBar label="Profit margin" value={f.breakdown.margin} max={20} />
                <ScoreBar label="Query demand" value={f.breakdown.queries} max={25} />
                <ScoreBar label="Trend signal" value={f.breakdown.trend} max={20} />
                <ScoreBar label="Restock urgency" value={f.breakdown.urgency} max={10} />
              </div>

              <div className="text-sm bg-muted/40 rounded-md p-3 border border-border">
                {f.explanation}
              </div>

              {f.action === "Restock" && (
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
      </div>
    </>
  );
}
