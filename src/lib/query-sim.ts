import type {
  ConversationContext,
  Product,
  QueryReasoning,
  Status,
} from "./types";

export type EnhancedReplySource = "Gemini AI" | "Rule-based fallback";

export interface ShopPolicy {
  delivery_inside_dhaka: number;
  delivery_outside_dhaka: number;
  pickup_point: string;
  pickup_time: string;
  cod: boolean;
  print_charge: number;
  exchange_window_hours: number;
  material: string;
  couriers: string[];
  regular_max_size: string;
  special_preorder_sizes: string[];
}

export interface SafeInventoryVariant {
  size: string;
  selling_price: number;
  stock_quantity: number;
  status: Status;
  possible_restock_date?: string;
}

export interface SafeInventoryProduct {
  product_id: string;
  product_name: string;
  team_country_club: string;
  player_name?: string;
  font_name?: string;
  has_print?: boolean;
  season_year: number;
  kit_type: Product["kit_type"];
  edition_type: Product["edition_type"];
  manufacturing_type: Product["manufacturing_type"];
  source_country: Product["source_country"];
  variants: SafeInventoryVariant[];
}

export interface RecentTurnSummary {
  customerMessage: string;
  botReply: string;
}

export interface GeminiChatRequest {
  message: string;
  inventoryContext: SafeInventoryProduct[];
  shopPolicy: ShopPolicy;
  matchResult: QueryReasoning;
  conversationContext: ConversationContext;
  recentTurns: RecentTurnSummary[];
}

export interface GeminiChatSuccessResponse {
  reply: string;
  source: "Gemini AI";
  model: string;
}

export interface GeminiChatErrorResponse {
  error: string;
  details?: string;
}

export interface GroqChatRequest {
  message: string;
  inventoryContext: SafeInventoryProduct[];
  shopPolicy: ShopPolicy;
  matchResult: QueryReasoning;
  conversationContext: ConversationContext;
}

export interface GroqChatSuccessResponse {
  reply: string;
  source: "Groq AI";
  model: string;
}

export interface GroqChatErrorResponse {
  error: string;
  details?: string;
}

export function buildSafeInventoryContext(
  products: Product[],
  matchResult: QueryReasoning,
): SafeInventoryProduct[] {
  const orderedIds: string[] = [];

  if (matchResult.matched_product_id) {
    orderedIds.push(matchResult.matched_product_id);
  }

  for (const candidate of matchResult.candidates ?? []) {
    orderedIds.push(candidate.product_id);
  }

  if (matchResult.closest_fallback?.product_id) {
    orderedIds.push(matchResult.closest_fallback.product_id);
  }

  if (matchResult.detected_team) {
    for (const product of products) {
      if (product.team_country_club.toLowerCase() === matchResult.detected_team.toLowerCase()) {
        orderedIds.push(product.id);
      }
    }
  }

  const seen = new Set<string>();
  const relevantProducts: Product[] = [];

  for (const id of orderedIds) {
    if (seen.has(id)) continue;
    const product = products.find((item) => item.id === id);
    if (!product) continue;
    seen.add(id);
    relevantProducts.push(product);
    if (relevantProducts.length === 3) break;
  }

  return relevantProducts.map((product) => ({
    product_id: product.id,
    product_name: product.product_name,
    team_country_club: product.team_country_club,
    player_name: product.player_name,
    font_name: product.font_name,
    has_print: product.has_print,
    season_year: product.season_year,
    kit_type: product.kit_type,
    edition_type: product.edition_type,
    manufacturing_type: product.manufacturing_type,
    source_country: product.source_country,
    variants: product.variants.map((variant) => ({
      size: variant.size,
      selling_price: variant.selling_price,
      stock_quantity: variant.stock_quantity,
      status: variant.status,
      possible_restock_date: variant.possible_restock_date,
    })),
  }));
}
