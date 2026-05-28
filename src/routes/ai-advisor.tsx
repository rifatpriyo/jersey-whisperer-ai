import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { forecastProduct } from "@/lib/forecast";
import { Brain, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/ai-advisor")({
  head: () => ({ meta: [{ title: "AI Stock Advisor — JerseyBecho AI" }] }),
  component: AdvisorPage,
});

interface Reco {
  product: string;
  reason: string;
  urgency: "Low" | "Medium" | "High";
  action: string;
  impact: string;
}

function AdvisorPage() {
  const { products } = useStore();

  const recos = useMemo<Reco[]>(() => {
    const out: Reco[] = [];
    for (const p of products) {
      const f = forecastProduct(p);
      for (const v of p.variants) {
        if (v.stock_quantity === 0 && v.status === "Preorder") {
          out.push({
            product: `${p.product_name} — ${v.size}`,
            reason: `Out of stock. Possible restock ${v.possible_restock_date || "TBA"}.`,
            urgency: "High",
            action: "Keep preorder open and notify supplier.",
            impact: "Capture demand without losing customer to competitor.",
          });
        } else if (v.stock_quantity === 0) {
          out.push({
            product: `${p.product_name} — ${v.size}`,
            reason: "Out of stock with no preorder set.",
            urgency: "High",
            action: "Mark as preorder or restock immediately.",
            impact: "Avoid stockout reply on Messenger/WhatsApp.",
          });
        } else if (v.stock_quantity <= v.low_stock_threshold) {
          out.push({
            product: `${p.product_name} — ${v.size}`,
            reason: `Low stock (${v.stock_quantity} left, threshold ${v.low_stock_threshold}).`,
            urgency: p.trend_signal === "High" ? "High" : "Medium",
            action: `Restock ${f.suggested_restock_quantity} pcs.`,
            impact: "Prevent missed sales on hot items.",
          });
        }
      }
      if (p.trend_signal === "High" && f.action === "Promote") {
        out.push({
          product: p.product_name,
          reason: `High trend signal: ${p.trend_reason}`,
          urgency: "Medium",
          action: "Promote on Facebook/Instagram, prioritize M/L/XL.",
          impact: "Convert hype into orders before trend fades.",
        });
      }
      const margin =
        p.variants.reduce((s, v) => s + (v.selling_price - v.buy_price) / v.selling_price, 0) /
        p.variants.length;
      if (p.manufacturing_type === "Imported" && p.edition_type === "Player Edition" && margin > 0.25) {
        out.push({
          product: p.product_name,
          reason: "Imported Player Edition — higher profit potential.",
          urgency: "Low",
          action: "Prioritize M/L/XL sizes in next supplier order.",
          impact: "Higher margin per unit vs Fan Edition.",
        });
      }
    }
    return out.sort((a, b) => {
      const order = { High: 0, Medium: 1, Low: 2 };
      return order[a.urgency] - order[b.urgency];
    });
  }, [products]);

  return (
    <>
      <PageHeader
        title="AI Stock Advisor"
        subtitle="Explainable, inventory-aware recommendations"
      />

      <Card className="mb-4 border-accent/40 bg-accent/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Brain className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-foreground">Rule-based AI reasoning</div>
            <div className="text-muted-foreground">
              Recommendations are derived from real stock levels, profit margins, trend signals and
              simulated demand. Every suggestion is explainable and safe — no hallucinated products
              or prices.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {recos.map((r, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex items-center gap-2 md:w-24">
                <Badge
                  variant="outline"
                  className={
                    r.urgency === "High"
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : r.urgency === "Medium"
                      ? "bg-warning/15 text-warning-foreground border-warning/40"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  <AlertCircle className="h-3 w-3 mr-1" /> {r.urgency}
                </Badge>
              </div>
              <div className="flex-1 grid md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Product</div>
                  <div className="font-medium">{r.product}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Reason</div>
                  <div>{r.reason}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Suggested action</div>
                  <div className="font-medium text-primary">{r.action}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Business impact</div>
                  <div>{r.impact}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {recos.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              All stock levels look healthy. No urgent actions.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
