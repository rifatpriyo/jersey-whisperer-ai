import { getBestTrendForProduct, getTrendScoreForProduct } from "./trend-signals";
import type { Product, TrendSignal, Variant } from "./types";

type UrgencyLabel =
  | "CRITICAL RESTOCK REQUIRED"
  | "MEDIUM REPLENISHMENT"
  | "HOLD STATUS";

export interface ForecastResult {
  product_id: string;
  product_name: string;
  team: string;
  typeLabel: string;
  sizeLabel: string;
  stock: number;
  recentInquiries: number;
  recentSales: number;
  demandSpikeScore: number;
  urgencyLabel: UrgencyLabel;
  urgencyColor: string;
  breakdown: {
    marketTrend: number;
    sportsNews: number;
    customerQueries: number;
    competitorAd: number;
    stockReductionRate: number;
    profitMargin: number;
  };
  matchedTrendKeyword?: string;
  recommendation: string;
  marginPercent: number;
  score: number;
  demand: "No Action" | "Low" | "Medium" | "High" | "Spike";
  action: "Buy Now" | "Restock Soon" | "Preorder / Restock" | "Monitor" | "Promote" | "Hold";
  explanation: string;
  suggested_restock_quantity: number;
  priority_sizes: string[];
  query_count: number;
  trend_signal: TrendSignal;
  trend_reason: string;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function safeVariants(product: Product): Variant[] {
  if (!Array.isArray(product.variants)) return [];
  return product.variants.map((variant) => ({
    id: variant?.id ?? crypto.randomUUID(),
    size: variant?.size ?? "M",
    stock_quantity: Number.isFinite(variant?.stock_quantity) ? variant.stock_quantity : 0,
    low_stock_threshold: Number.isFinite(variant?.low_stock_threshold)
      ? variant.low_stock_threshold
      : 3,
    buy_price: Number.isFinite(variant?.buy_price) ? variant.buy_price : 0,
    selling_price: Number.isFinite(variant?.selling_price) ? variant.selling_price : 0,
    status: variant?.status ?? "Available",
    stocked_date: variant?.stocked_date,
    possible_restock_date: variant?.possible_restock_date,
    notes: variant?.notes,
  }));
}

function sumStock(variants: Variant[]) {
  return variants.reduce((total, variant) => total + Math.max(variant.stock_quantity, 0), 0);
}

function getAverageMargin(variants: Variant[]) {
  const valid = variants.filter((variant) => variant.selling_price > 0);
  if (!valid.length) return 0;
  const totalMargin = valid.reduce((sum, variant) => {
    return sum + (variant.selling_price - variant.buy_price) / variant.selling_price;
  }, 0);
  return clamp01(totalMargin / valid.length);
}

function getStockReductionRate(stock: number) {
  if (stock === 0) return 1;
  if (stock <= 2) return 0.9;
  if (stock <= 5) return 0.7;
  if (stock <= 8) return 0.45;
  return 0.2;
}

function getCompetitorAdScore(product: Product) {
  const text =
    `${product.team_country_club} ${product.player_name ?? ""} ${product.font_name ?? ""}`.toLowerCase();
  if (text.includes("argentina") || text.includes("messi")) return 0.9;
  if (text.includes("portugal") || text.includes("ronaldo") || text.includes("cristiano")) return 0.8;
  if (text.includes("real madrid") || text.includes("mbappe")) return 0.78;
  if (text.includes("brazil") || text.includes("neymar")) return 0.68;
  if (text.includes("barcelona")) return 0.58;
  return 0.45;
}

function getSportsNewsScore(product: Product) {
  const text =
    `${product.team_country_club} ${product.player_name ?? ""} ${product.font_name ?? ""}`.toLowerCase();
  if (text.includes("portugal") || text.includes("ronaldo") || text.includes("cristiano")) return 0.88;
  if (text.includes("argentina") || text.includes("messi")) return 0.86;
  if (text.includes("brazil") || text.includes("neymar")) return 0.72;
  if (text.includes("real madrid") || text.includes("mbappe")) return 0.74;
  if (text.includes("barcelona")) return 0.6;
  return 0.5;
}

function getDemandLabel(score: number): ForecastResult["demand"] {
  if (score >= 80) return "Spike";
  if (score >= 65) return "High";
  if (score >= 50) return "Medium";
  if (score >= 35) return "Low";
  return "No Action";
}

function getUrgency(score: number) {
  if (score >= 80) {
    return {
      label: "CRITICAL RESTOCK REQUIRED" as const,
      color: "bg-destructive/15 text-destructive border-destructive/30",
    };
  }
  if (score >= 65) {
    return {
      label: "MEDIUM REPLENISHMENT" as const,
      color: "bg-warning/15 text-warning-foreground border-warning/40",
    };
  }
  return {
    label: "HOLD STATUS" as const,
    color: "bg-muted text-muted-foreground border-border",
  };
}

function getPrioritySizes(variants: Variant[]) {
  const lowOrOut = variants.filter(
    (variant) => variant.stock_quantity <= Math.max(variant.low_stock_threshold, 3),
  );
  const base = lowOrOut.length ? lowOrOut : variants;
  return [...new Set(base.map((variant) => variant.size))];
}

function getAction(score: number, stock: number): ForecastResult["action"] {
  if (stock === 0) return "Preorder / Restock";
  if (score >= 80) return "Buy Now";
  if (score >= 65) return "Restock Soon";
  if (score >= 50) return "Monitor";
  if (score >= 35) return "Promote";
  return "Hold";
}

function inferTrendSignalFromScore(score: number): TrendSignal {
  if (score >= 0.85) return "High";
  if (score >= 0.65) return "Medium";
  if (score > 0.2) return "Low";
  return "None";
}

function estimateRecentSales(product: Product, recentInquiries: number) {
  const popularity = Number.isFinite(product.popularity_score)
    ? (product.popularity_score as number) / 100
    : 0.45;
  const marketTrend = getTrendScoreForProduct(product);
  return Math.min(
    10,
    Math.max(0, Math.round(recentInquiries * 0.35 + popularity * 3 + marketTrend * 2)),
  );
}

function getRecommendation(args: {
  score: number;
  stock: number;
  prioritySizes: string[];
  matchedTrendKeyword?: string;
}) {
  const trendSuffix = args.matchedTrendKeyword
    ? ` Search demand is clustering around "${args.matchedTrendKeyword}".`
    : "";

  if (args.stock === 0) {
    return `Restock before the next supplier cycle and keep preorder open.${trendSuffix}`;
  }
  if (args.score >= 80) {
    return `Restock before the next supplier cycle and keep preorder open.${trendSuffix}`;
  }
  if (args.score >= 65) {
    return `Restock soon, prioritizing ${args.prioritySizes.join("/") || "core sizes"} while demand stays active.${trendSuffix}`;
  }
  if (args.score >= 50) {
    return `Promote this week and monitor stock movement before placing a larger supplier order.${trendSuffix}`;
  }
  return `Hold stock for now and monitor demand before committing additional buying.${trendSuffix}`;
}

function getSuggestedRestockQuantity(score: number, stock: number) {
  if (score >= 80) return Math.max(12, 20 - stock);
  if (score >= 65) return Math.max(8, 14 - stock);
  if (score >= 50) return Math.max(6, 10 - stock);
  return Math.max(4, 6 - stock);
}

function buildReasons(
  score: ReturnType<typeof calculateDemandSpikeScore>,
  product: Product,
  stock: number,
  recentInquiries: number,
) {
  const reasons: string[] = [];
  if (score.breakdown.marketTrend >= 0.7) {
    reasons.push("Market trend demand is active in Bangladesh searches.");
  }
  if (score.breakdown.sportsNews >= 0.7) {
    reasons.push("Sports/news attention is rising around this team/player.");
  }
  if (score.breakdown.customerQueries >= 0.6) {
    reasons.push("Customer queries are active for this product or size.");
  }
  if (score.breakdown.competitorAd >= 0.7) {
    reasons.push("Competitor/ad activity is strong around this category.");
  }
  if (stock <= 5) {
    reasons.push("Stock movement suggests risk of missed sales.");
  }
  if (score.breakdown.profitMargin >= 0.5) {
    reasons.push("Profit margin is healthy enough to justify stronger focus.");
  }
  if (!reasons.length) {
    reasons.push(`Demand is steady for ${product.team_country_club}, but not urgent yet.`);
  }
  return reasons.slice(0, 3);
}

export function calculateDemandSpikeScore(
  product: Product,
  recentInquiries: number,
  recentSales: number,
) {
  const variants = safeVariants(product);
  const stock = sumStock(variants);
  const averageMargin = getAverageMargin(variants);
  const bestTrend = getBestTrendForProduct(product);

  const marketTrend = clamp01(getTrendScoreForProduct(product));
  const sportsNews = clamp01(getSportsNewsScore(product));
  const customerQueries = clamp01(recentInquiries / 15);
  const competitorAd = clamp01(getCompetitorAdScore(product));
  const stockReductionRate = clamp01(getStockReductionRate(stock));
  const profitMargin = clamp01(averageMargin / 0.5);

  const demandSpikeScore = Math.round(
    (marketTrend * 0.3 +
      sportsNews * 0.15 +
      customerQueries * 0.25 +
      competitorAd * 0.15 +
      stockReductionRate * 0.1 +
      profitMargin * 0.05) *
      100,
  );

  const urgency = getUrgency(demandSpikeScore);
  const prioritySizes = getPrioritySizes(variants);
  const recommendation = getRecommendation({
    score: demandSpikeScore,
    stock,
    prioritySizes,
    matchedTrendKeyword: bestTrend?.keyword,
  });

  return {
    demandSpikeScore,
    urgencyLabel: urgency.label,
    urgencyColor: urgency.color,
    breakdown: {
      marketTrend,
      sportsNews,
      customerQueries,
      competitorAd,
      stockReductionRate,
      profitMargin,
    },
    matchedTrendKeyword: bestTrend?.keyword,
    recommendation,
  };
}

export function forecastProduct(product: Product): ForecastResult {
  const variants = safeVariants(product);
  const stock = sumStock(variants);
  const recentInquiries = Number.isFinite(product.query_count)
    ? (product.query_count as number)
    : 0;
  const recentSales = estimateRecentSales(product, recentInquiries);
  const dss = calculateDemandSpikeScore(product, recentInquiries, recentSales);
  const bestTrend = getBestTrendForProduct(product);
  const averageMargin = getAverageMargin(variants);
  const trendScore = getTrendScoreForProduct(product);
  const action = getAction(dss.demandSpikeScore, stock);
  const suggestedRestockQuantity = getSuggestedRestockQuantity(dss.demandSpikeScore, stock);
  const sellerReasons = buildReasons(dss, product, stock, recentInquiries);

  return {
    product_id: product.id,
    product_name: product.product_name,
    team: product.team_country_club,
    typeLabel: `${product.kit_type} / ${product.edition_type}`,
    sizeLabel: variants.map((variant) => variant.size).join(", ") || "-",
    stock,
    recentInquiries,
    recentSales,
    demandSpikeScore: dss.demandSpikeScore,
    urgencyLabel: dss.urgencyLabel,
    urgencyColor: dss.urgencyColor,
    breakdown: dss.breakdown,
    matchedTrendKeyword: dss.matchedTrendKeyword,
    recommendation: dss.recommendation,
    marginPercent: Math.round(averageMargin * 100),
    score: dss.demandSpikeScore,
    demand: getDemandLabel(dss.demandSpikeScore),
    action,
    explanation: sellerReasons.join(" "),
    suggested_restock_quantity: suggestedRestockQuantity,
    priority_sizes: getPrioritySizes(variants),
    query_count: recentInquiries,
    trend_signal: inferTrendSignalFromScore(trendScore),
    trend_reason:
      bestTrend?.explanation ||
      product.trend_reason ||
      "No cached Bangladesh trend snapshot matched this product.",
  };
}
