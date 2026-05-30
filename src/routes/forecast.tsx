import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { forecastProduct } from "@/lib/forecast";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchTrendSignalsFromSupabase,
  saveForecastScoreToSupabase,
  seedTrendSignalsToSupabase,
  semanticProductSearchLocalFallback,
  semanticTrendSearchLocalFallback,
  type SemanticSearchHit,
  type StoredTrendSignal,
} from "@/lib/supabase-service";
import { useStore } from "@/lib/store";
import { localTrendSignals } from "@/lib/trend-signals";
import { Database, Search, Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/forecast")({
  head: () => ({ meta: [{ title: "Forecast Preview - JerseyBecho AI" }] }),
  component: ForecastPage,
});

function toPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function MomentumBadge({ momentum }: { momentum: "breakout" | "rising" | "stable" }) {
  const className =
    momentum === "breakout"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : momentum === "rising"
        ? "bg-warning/15 text-warning-foreground border-warning/40"
        : "bg-muted text-muted-foreground border-border";

  return (
    <Badge variant="outline" className={className}>
      {momentum}
    </Badge>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{toPercent(value)}</span>
      </div>
      <Progress value={Math.round(value * 100)} className="h-1.5" />
    </div>
  );
}

function ForecastPage() {
  const { products } = useStore();
  const [trendSignals, setTrendSignals] = useState<StoredTrendSignal[]>(localTrendSignals);
  const [searchQuery, setSearchQuery] = useState("Argentina 2XL player edition");
  const [productMatches, setProductMatches] = useState<SemanticSearchHit[]>([]);
  const [trendMatches, setTrendMatches] = useState<SemanticSearchHit[]>([]);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const forecasts = useMemo(() => {
    try {
      return products
        .map(forecastProduct)
        .sort((left, right) => right.demandSpikeScore - left.demandSpikeScore);
    } catch (error) {
      console.error("Forecast error:", error);
      return [];
    }
  }, [products]);

  const topRecommendations = forecasts.slice(0, 10);

  useEffect(() => {
    let cancelled = false;

    const loadTrendSignals = async () => {
      if (!isSupabaseConfigured) {
        setTrendSignals(localTrendSignals);
        return;
      }

      try {
        const remote = await fetchTrendSignalsFromSupabase();
        if (cancelled) return;

        if (remote.length === 0) {
          const seeded = await seedTrendSignalsToSupabase(localTrendSignals);
          if (!cancelled && seeded.length > 0) {
            setTrendSignals(seeded);
            return;
          }
        }

        setTrendSignals(remote.length > 0 ? remote : localTrendSignals);
      } catch {
        if (!cancelled) setTrendSignals(localTrendSignals);
      }
    };

    void loadTrendSignals();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setProductMatches(semanticProductSearchLocalFallback(searchQuery));
    setTrendMatches(semanticTrendSearchLocalFallback(searchQuery));
  }, [searchQuery]);

  useEffect(() => {
    if (!isSupabaseConfigured || forecasts.length === 0) return;
    void Promise.allSettled(
      forecasts.map((forecast) => saveForecastScoreToSupabase(forecast.product_id, forecast)),
    );
  }, [forecasts]);

  const missedInsights = useMemo(() => {
    const insights: string[] = [];

    const argentinaLargeSizeRisk = products.some(
      (product) =>
        product.team_country_club === "Argentina" &&
        product.variants.some(
          (variant) =>
            ["XL", "XXL"].includes(variant.size) && variant.stock_quantity > 0 && variant.stock_quantity <= 2,
        ),
    );
    if (argentinaLargeSizeRisk) {
      insights.push("Argentina demand is high, but XL/2XL stock is limited.");
    }

    if (
      products.some((product) =>
        /Portugal|Cristiano|Ronaldo/i.test(
          `${product.team_country_club} ${product.player_name ?? ""} ${product.font_name ?? ""}`,
        ),
      )
    ) {
      insights.push("Portugal/Ronaldo interest is rising after recent football attention.");
    }

    if (
      products.some(
        (product) =>
          product.edition_type === "Player Edition" &&
          product.variants.some((variant) => variant.selling_price - variant.buy_price >= 250),
      )
    ) {
      insights.push("High-margin player editions should be promoted before fan editions.");
    }

    if (trendSignals.some((signal) => signal.language === "bn" && signal.growthWeight >= 0.7)) {
      insights.push("Bangla jersey searches are rising; add Bangla-friendly product tags.");
    }

    if (
      forecasts.some((forecast) => forecast.breakdown.competitorAd >= 0.7)
    ) {
      insights.push("Competitor/ad activity is strong around popular national-team kits.");
    }

    return insights.slice(0, 5);
  }, [forecasts, products, trendSignals]);

  return (
    <>
      <PageHeader
        title="Forecast Preview"
        subtitle="Use demand signals to decide what to restock, promote, or hold this week"
      />

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-foreground">Top 10 Product Recommendations</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  AI-ranked actions from your inventory, market demand, sports news, customer queries,
                  competitor activity, stock movement, and profit margin.
                </div>
              </div>
              <Button variant="outline" onClick={() => setMethodologyOpen(true)}>
                How is the score calculated?
              </Button>
            </div>

            <div className="space-y-3">
              {topRecommendations.map((forecast, index) => (
                <div
                  key={forecast.product_id}
                  className="rounded-xl border border-border bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          #{index + 1}
                        </div>
                        <div className="truncate font-semibold text-foreground">
                          {forecast.product_name} - {forecast.sizeLabel}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {forecast.team} · {forecast.typeLabel}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className={forecast.urgencyColor}>
                          Score: {forecast.demandSpikeScore}/100
                        </Badge>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          Action: {formatActionLabel(forecast.action)}
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Reasons
                        </div>
                        <ul className="mt-2 space-y-1 text-sm text-foreground/90">
                          {buildSellerReasons(forecast).map((reason) => (
                            <li key={reason}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="w-full rounded-lg border border-border bg-muted/30 p-3 lg:max-w-[280px]">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Recommendation
                      </div>
                      <div className="mt-2 text-sm text-foreground/90">
                        {forecast.recommendation}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {topRecommendations.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                  No products are available yet for recommendation ranking.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div className="font-semibold text-foreground">What You Might Be Missing</div>
            </div>
            <div className="space-y-3">
              {missedInsights.map((insight) => (
                <div
                  key={insight}
                  className="rounded-lg border border-border bg-background/80 p-3 text-sm text-foreground/90"
                >
                  {insight}
                </div>
              ))}
              {missedInsights.length === 0 && (
                <div className="rounded-lg border border-border bg-background/80 p-3 text-sm text-muted-foreground">
                  Add more products or trend signals to unlock missed-opportunity insights.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardContent className="p-0 overflow-x-auto">
          <div className="border-b border-border px-5 py-4">
            <div className="font-semibold text-foreground">Bangladesh Trend Signals</div>
            <div className="text-xs text-muted-foreground">
              Cached local snapshots that imitate a Google Trends-style signal layer without live requests.
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Momentum</TableHead>
                <TableHead>GrowthWeight</TableHead>
                <TableHead>Matched team/player</TableHead>
                <TableHead>Explanation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trendSignals.map((signal) => (
                <TableRow key={`${signal.keyword}-${signal.channel}`}>
                  <TableCell className="font-medium">{signal.keyword}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {signal.channel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {signal.language}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <MomentumBadge momentum={signal.momentum} />
                  </TableCell>
                  <TableCell className="font-mono">{toPercent(signal.growthWeight)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {signal.matchedTeam || signal.matchedPlayer
                      ? [signal.matchedTeam, signal.matchedPlayer].filter(Boolean).join(" / ")
                      : "-"}
                  </TableCell>
                  <TableCell className="max-w-[360px] text-xs text-muted-foreground">
                    {signal.explanation}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="border-b border-border px-5 py-4">
            <div className="font-semibold text-foreground">Demand Spike Score Table</div>
            <div className="text-xs text-muted-foreground">
              Product scoring uses demand signals, stock movement, margin, and customer interest.
            </div>
          </div>

          {forecasts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Recent inquiries</TableHead>
                  <TableHead className="text-right">Trend score</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Demand Spike Score</TableHead>
                  <TableHead>Urgency label</TableHead>
                  <TableHead>Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecasts.map((forecast) => (
                  <TableRow key={forecast.product_id}>
                    <TableCell className="font-medium">{forecast.product_name}</TableCell>
                    <TableCell>{forecast.team}</TableCell>
                    <TableCell>{forecast.typeLabel}</TableCell>
                    <TableCell className="font-mono text-xs">{forecast.sizeLabel}</TableCell>
                    <TableCell className="text-right font-mono">{forecast.stock}</TableCell>
                    <TableCell className="text-right font-mono">{forecast.recentInquiries}</TableCell>
                    <TableCell className="text-right font-mono">
                      {toPercent(forecast.breakdown.marketTrend)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{forecast.marginPercent}%</TableCell>
                    <TableCell className="text-right font-mono">{forecast.demandSpikeScore}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={forecast.urgencyColor}>
                        {forecast.urgencyLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[280px] text-sm text-foreground/90">
                      <div>{forecast.recommendation}</div>
                      {forecast.matchedTrendKeyword && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Matched signal: {forecast.matchedTrendKeyword}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No products to forecast yet. Add inventory to see DSS scores.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-5">
          <Accordion type="single" collapsible>
            <AccordionItem value="technical-details" className="border-b-0">
              <AccordionTrigger>Technical implementation details</AccordionTrigger>
              <AccordionContent>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {isSupabaseConfigured ? "Supabase + pgvector configured" : "Local fallback mode"}
                  </Badge>
                  <Badge variant="outline">Vercel API routes</Badge>
                  <Badge variant="outline">Gemini/Groq</Badge>
                </div>
                <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Backend proof includes Supabase/Postgres, pgvector, Vercel serverless endpoints,
                  Gemini/Groq integration, and the products, trend_signals, forecast_scores, and
                  chat_logs data flow used by the demo.
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div>
                    <div className="mb-2 text-sm font-medium text-foreground">
                      Retrieval proof search
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Argentina 2XL player edition"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <SemanticPanel title="Product context" items={productMatches} />
                    <SemanticPanel title="Trend context" items={trendMatches} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Sheet open={methodologyOpen} onOpenChange={setMethodologyOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Demand Score Methodology</SheetTitle>
            <SheetDescription>
              How the preliminary demo ranks what to restock, promote, or hold.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="font-medium text-foreground">Demand Spike Score</div>
              <div className="mt-2 whitespace-pre-line text-muted-foreground">
                {`30% Market Trend
15% Sports News
25% Customer Queries
15% Competitor Ad Signal
10% Stock Reduction Rate
5% Profit Margin`}
              </div>
            </div>

            <MethodRow
              title="Market Trend"
              body="Google Trends-style Bangladesh demand signals"
            />
            <MethodRow
              title="Sports News"
              body="player/team hype from football events, match results, transfers, trophy wins, or viral attention"
            />
            <MethodRow
              title="Customer Queries"
              body="how often buyers ask about a product or size"
            />
            <MethodRow
              title="Competitor Ad Signal"
              body="Meta Ad Library/competitor visibility and market saturation signal"
            />
            <MethodRow
              title="Stock Reduction Rate"
              body="how quickly stock is dropping or becoming risky"
            />
            <MethodRow
              title="Profit Margin"
              body="prioritizes profitable products when demand is healthy"
            />

            <div className="rounded-lg border border-border bg-background p-4 text-muted-foreground">
              For preliminary demo, Market Trend, Sports News, and Competitor Ad signals use cached/local snapshots.
              Production version connects to Google Trends API, sports/news sources, Meta Ad Library signals,
              Messenger/WhatsApp query streams, and Supabase/Postgres history.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function buildSellerReasons(forecast: ReturnType<typeof forecastProduct>) {
  const reasons: string[] = [];
  if (forecast.breakdown.marketTrend >= 0.7) {
    reasons.push("Market trend demand is active.");
  }
  if (forecast.breakdown.sportsNews >= 0.7) {
    reasons.push("Sports/news demand is rising.");
  }
  if (forecast.breakdown.customerQueries >= 0.6) {
    reasons.push("Customer queries are active.");
  }
  if (forecast.breakdown.stockReductionRate >= 0.7) {
    reasons.push("Stock movement suggests risk of missed sales.");
  }
  if (forecast.breakdown.competitorAd >= 0.7) {
    reasons.push("Competitor activity is strong in this category.");
  }
  if (forecast.breakdown.profitMargin >= 0.5) {
    reasons.push("Profit margin supports stronger focus.");
  }
  if (!reasons.length) {
    reasons.push("Demand is steady, but not urgent yet.");
  }
  return reasons.slice(0, 3);
}

function formatActionLabel(action: ReturnType<typeof forecastProduct>["action"]) {
  if (action === "Buy Now" || action === "Preorder / Restock") return "Restock Immediately";
  if (action === "Restock Soon") return "Restock Soon";
  if (action === "Promote") return "Promote This Week";
  return "Hold / Monitor";
}

function MethodRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="font-medium text-foreground">{title}</div>
      <div className="mt-1 text-muted-foreground">{body}</div>
    </div>
  );
}

function SemanticPanel({ title, items }: { title: string; items: SemanticSearchHit[] }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        <div className="text-sm font-medium text-foreground">{title}</div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${title}-${item.id}`} className="rounded-md border border-border bg-muted/30 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-xs font-medium text-foreground">
                {String(item.metadata.product_name || item.metadata.keyword || item.id)}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">
                {Math.round(item.similarity * 100)}%
              </div>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {item.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
