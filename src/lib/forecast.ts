import type { Product, Variant, TrendSignal } from "./types";

export interface ForecastResult {
  product_id: string;
  product_name: string;
  score: number; // 0-100 DSS
  demand: "No Action" | "Low" | "Medium" | "High" | "Spike";
  action: "Buy Now" | "Restock Soon" | "Preorder / Restock" | "Monitor" | "Promote" | "Hold";
  explanation: string;
  suggested_restock_quantity: number;
  priority_sizes: string[];
  query_count: number;
  trend_signal: TrendSignal;
  trend_reason: string;
  breakdown: {
    trend: number;        // 0-100
    queries: number;      // 0-100
    stock: number;        // 0-100
    margin: number;       // 0-100
    velocity: number;     // 0-100
  };
}

function safeVariants(p: Product): Variant[] {
  const list = Array.isArray(p.variants) ? p.variants : [];
  return list.map((v) => ({
    id: v?.id ?? crypto.randomUUID(),
    size: v?.size ?? "M",
    stock_quantity: Number.isFinite(v?.stock_quantity) ? v.stock_quantity : 0,
    low_stock_threshold: Number.isFinite(v?.low_stock_threshold) ? v.low_stock_threshold : 3,
    buy_price: Number.isFinite(v?.buy_price) ? v.buy_price : 0,
    selling_price: Number.isFinite(v?.selling_price) ? v.selling_price : 0,
    status: v?.status ?? "Available",
    stocked_date: v?.stocked_date,
    possible_restock_date: v?.possible_restock_date,
    notes: v?.notes,
  }));
}

function trendScore(t: TrendSignal | undefined): number {
  switch (t) {
    case "High": return 90;
    case "Medium": return 60;
    case "Low": return 30;
    default: return 0;
  }
}

function queryScore(q: number): number {
  if (q >= 15) return 100;
  if (q >= 8) return 75;
  if (q >= 3) return 45;
  if (q >= 1) return 20;
  return 0;
}

function stockRiskScore(v: Variant[]): number {
  if (!v.length) return 100;
  let worst = 0;
  for (const x of v) {
    let s = 15; // healthy
    if (x.stock_quantity === 0) s = 100;
    else if (x.stock_quantity <= x.low_stock_threshold) s = 85;
    else if (x.stock_quantity <= x.low_stock_threshold + 2) s = 55;
    if (s > worst) worst = s;
  }
  return worst;
}

function marginPercent(v: Variant[]): number {
  const valid = v.filter((x) => x.selling_price > 0);
  if (!valid.length) return 0;
  const avg =
    valid.reduce((s, x) => s + (x.selling_price - x.buy_price) / x.selling_price, 0) /
    valid.length;
  return avg * 100;
}

function marginScore(pct: number): number {
  if (pct >= 35) return 100;
  if (pct >= 25) return 70;
  if (pct >= 15) return 45;
  return 20;
}

function velocityScore(q: number): number {
  if (q >= 15) return 100;
  if (q >= 8) return 75;
  if (q >= 3) return 50;
  if (q >= 1) return 25;
  return 0;
}

export function forecastProduct(p: Product): ForecastResult {
  const variants = safeVariants(p);
  const queryCount = Number.isFinite(p?.query_count) ? (p.query_count as number) : 0;
  const trend = p?.trend_signal ?? "None";
  const trendReason = p?.trend_reason || "No external trend signal";

  const trendS = trendScore(trend);
  const queryS = queryScore(queryCount);
  const stockS = stockRiskScore(variants);
  const marginPct = marginPercent(variants);
  const marginS = marginScore(marginPct);
  const velocityS = velocityScore(queryCount);

  const dss = Math.round(
    trendS * 0.25 +
    queryS * 0.25 +
    stockS * 0.20 +
    marginS * 0.15 +
    velocityS * 0.15,
  );

  const demand: ForecastResult["demand"] =
    dss >= 80 ? "Spike" :
    dss >= 60 ? "High" :
    dss >= 40 ? "Medium" :
    dss >= 20 ? "Low" : "No Action";

  const lowOrOut = variants.filter((v) => v.stock_quantity <= v.low_stock_threshold);
  const allOut = variants.length > 0 && variants.every((v) => v.stock_quantity === 0);

  let action: ForecastResult["action"] = "Hold";
  if (allOut) action = "Preorder / Restock";
  else if (dss >= 80 && lowOrOut.length > 0) action = "Buy Now";
  else if (dss >= 60) action = "Restock Soon";
  else if (dss >= 40) action = "Monitor";
  else if (marginS >= 70 && queryS < 45) action = "Promote";

  const priority_sizes = lowOrOut.length
    ? lowOrOut.map((v) => v.size)
    : variants.map((v) => v.size);

  const suggested_restock_quantity =
    demand === "Spike" ? 25 :
    demand === "High" ? 20 :
    demand === "Medium" ? 12 : 6;

  const explanation =
    `${p.product_name} has DSS ${dss}/100. ` +
    `Demand level: ${demand}. ` +
    `Trend signal ${trendS}/100 (${trendReason}), customer queries ${queryS}/100 (${queryCount} in last 24h), ` +
    `stock risk ${stockS}/100, profit margin ${marginS}/100 (${Math.round(marginPct)}%), sales velocity ${velocityS}/100. ` +
    `Recommended action: ${action}` +
    (action === "Buy Now" || action === "Restock Soon"
      ? `, restock ~${suggested_restock_quantity} pcs, prioritize ${priority_sizes.join("/")}.`
      : ".");

  return {
    product_id: p.id,
    product_name: p.product_name,
    score: dss,
    demand,
    action,
    explanation,
    suggested_restock_quantity,
    priority_sizes,
    query_count: queryCount,
    trend_signal: trend,
    trend_reason: trendReason,
    breakdown: {
      trend: trendS,
      queries: queryS,
      stock: stockS,
      margin: marginS,
      velocity: velocityS,
    },
  };
}
