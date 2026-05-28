import type { Product, Variant } from "./types";

export interface ForecastResult {
  product_id: string;
  product_name: string;
  score: number;
  demand: "Low" | "Medium" | "High";
  action: "Restock" | "Hold" | "Discount" | "Preorder" | "Promote";
  explanation: string;
  suggested_restock_quantity: number;
  priority_sizes: string[];
  breakdown: {
    stock: number;
    margin: number;
    queries: number;
    trend: number;
    urgency: number;
  };
}

function stockScore(v: Variant[]) {
  // worst variant drives risk
  let worst = 0;
  for (const x of v) {
    if (x.stock_quantity === 0) worst = Math.max(worst, 25);
    else if (x.stock_quantity <= x.low_stock_threshold) worst = Math.max(worst, 20);
    else if (x.stock_quantity <= x.low_stock_threshold * 2) worst = Math.max(worst, 10);
    else worst = Math.max(worst, 3);
  }
  return worst;
}

function marginScore(v: Variant[]) {
  const avg = v.reduce((s, x) => s + (x.selling_price - x.buy_price) / x.selling_price, 0) / v.length;
  const pct = avg * 100;
  if (pct >= 50) return 20;
  if (pct >= 35) return 15;
  if (pct >= 20) return 10;
  return 5;
}

function queryScore(q = 0) {
  if (q >= 15) return 25;
  if (q >= 8) return 18;
  if (q >= 3) return 10;
  return 3;
}

function trendScore(t: string) {
  if (t === "High") return 20;
  if (t === "Medium") return 12;
  return 5;
}

function urgencyScore(v: Variant[]) {
  const dates = v.map((x) => x.possible_restock_date).filter(Boolean) as string[];
  if (!dates.length) return 0;
  const now = Date.now();
  let best = 0;
  for (const d of dates) {
    const diff = (new Date(d).getTime() - now) / (1000 * 60 * 60 * 24);
    if (diff <= 7) best = Math.max(best, 10);
    else if (diff <= 14) best = Math.max(best, 7);
    else best = Math.max(best, 3);
  }
  return best;
}

export function forecastProduct(p: Product): ForecastResult {
  const stock = stockScore(p.variants);
  const margin = marginScore(p.variants);
  const queries = queryScore(p.query_count);
  const trend = trendScore(p.trend_signal);
  const urgency = urgencyScore(p.variants);
  const score = stock + margin + queries + trend + urgency;

  const demand: ForecastResult["demand"] = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";

  const lowOrOut = p.variants.filter((v) => v.stock_quantity <= v.low_stock_threshold);
  const allOut = p.variants.every((v) => v.stock_quantity === 0);

  let action: ForecastResult["action"] = "Hold";
  if (allOut) action = "Preorder";
  else if (lowOrOut.length > 0 && demand !== "Low") action = "Restock";
  else if (demand === "High") action = "Promote";
  else if (demand === "Low" && margin >= 15) action = "Discount";

  const priority_sizes = lowOrOut.length
    ? lowOrOut.map((v) => v.size)
    : p.variants.map((v) => v.size);

  const suggested_restock_quantity = demand === "High" ? 20 : demand === "Medium" ? 12 : 6;

  const explanation =
    `${p.product_name} forecast score ${score}/100. Demand ${demand} because ` +
    `stock risk ${stock}/25, margin ${margin}/20, queries ${queries}/25, ` +
    `trend ${trend}/20 (${p.trend_reason || "trend signal"}), urgency ${urgency}/10. ` +
    `Action: ${action}${action === "Restock" ? ` ~${suggested_restock_quantity} pcs, prioritize ${priority_sizes.join("/")}` : ""}.`;

  return {
    product_id: p.id,
    product_name: p.product_name,
    score,
    demand,
    action,
    explanation,
    suggested_restock_quantity,
    priority_sizes,
    breakdown: { stock, margin, queries, trend, urgency },
  };
}
