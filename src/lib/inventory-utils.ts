import type { Status, EditionType, ManufacturingType } from "./types";

export function computeStatus(qty: number, threshold: number, preorder = false): Status {
  if (preorder && qty === 0) return "Preorder";
  if (qty === 0) return "Out of Stock";
  if (qty <= threshold) return "Low Stock";
  return "Available";
}

export function computeProfitMargin(buy: number, sell: number): number {
  if (!sell || sell === 0) return 0;
  return Math.round(((sell - buy) / sell) * 100);
}

export function defaultPrices(edition: EditionType, mfg: ManufacturingType) {
  if (edition === "Retro Kit") return { buy: 950, sell: 1290 };
  if (edition === "Player Edition" && mfg === "Imported") return { buy: 800, sell: 1099 };
  if (edition === "Fan Edition") return { buy: 700, sell: 899 };
  return { buy: 800, sell: 1099 };
}

export const bdt = (n: number) => `৳${n.toLocaleString("en-BD")}`;
