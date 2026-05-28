export type EditionType = "Player Edition" | "Fan Edition" | "Retro Kit";
export type ManufacturingType = "Imported" | "BD-made";
export type SourceCountry = "China" | "Thailand" | "Bangladesh";
export type KitType = "Home" | "Away" | "Third" | "Retro";
export type Size = "S" | "M" | "L" | "XL" | "XXL";
export type Status = "Available" | "Low Stock" | "Out of Stock" | "Preorder";
export type TrendSignal = "None" | "Low" | "Medium" | "High";
export type Channel = "Messenger" | "WhatsApp" | "Manual" | "Instagram";

export interface Variant {
  id: string;
  size: Size;
  stock_quantity: number;
  low_stock_threshold: number;
  buy_price: number;
  selling_price: number;
  status: Status;
  stocked_date?: string;
  possible_restock_date?: string;
  notes?: string;
}

export interface Product {
  id: string;
  product_name: string;
  team_country_club: string;
  player_name?: string;
  season_year: number;
  kit_type: KitType;
  edition_type: EditionType;
  manufacturing_type: ManufacturingType;
  source_country: SourceCountry;
  supplier_name?: string;
  product_image_url?: string;
  trend_signal: TrendSignal;
  trend_reason?: string;
  popularity_score?: number;
  query_count?: number; // simulated query demand
  created_at: string;
  variants: Variant[];
}

export interface FallbackMatch {
  product_id: string;
  product_name: string;
  reason: string;
}

export interface QueryReasoning {
  original: string;
  normalized: string;
  detected_team?: string;
  detected_player?: string;
  detected_year?: number;
  detected_size?: Size;
  detected_edition?: EditionType;
  detected_source?: SourceCountry;
  detected_kit?: KitType;
  matched_product_id?: string;
  matched_product_name?: string;
  closest_fallback?: FallbackMatch;
  confidence: number;
  reason: string;
  reply: string;
  candidates?: { product_id: string; name: string; score: number }[];
}
