import type { Product, QueryReasoning, Size, EditionType, SourceCountry, KitType, FallbackMatch } from "./types";
import { bdt } from "./inventory-utils";

const SIZE_WORDS: Record<string, Size> = {
  s: "S", small: "S",
  m: "M", medium: "M",
  l: "L", large: "L",
  xl: "XL", "extra large": "XL", "extra-large": "XL",
  xxl: "XXL", "double xl": "XXL",
};

const TEAMS = [
  "Argentina", "Brazil", "Portugal", "Spain", "France", "Germany", "England",
  "Real Madrid", "Barcelona", "Manchester United", "Manchester City", "Liverpool",
  "Chelsea", "Arsenal", "PSG", "Juventus", "Bayern Munich", "Bangladesh",
];
const PLAYERS = [
  "Messi", "Ronaldo", "Neymar", "Mbappe", "Haaland", "Bellingham",
  "Lamine Yamal", "Yamal", "Salah", "De Bruyne", "Vinicius", "Rodrygo",
];

function normalize(q: string) {
  return q.toLowerCase().replace(/[?,.!]/g, " ").replace(/\s+/g, " ").trim();
}

function detectSize(n: string): Size | undefined {
  const tokens = n.split(" ");
  for (const t of tokens) {
    const k = t.replace(/[^a-z]/g, "");
    if (SIZE_WORDS[k]) return SIZE_WORDS[k];
  }
  if (n.includes("extra large")) return "XL";
  return undefined;
}

function detectYear(n: string): number | undefined {
  const m = n.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : undefined;
}

function detectFromList(n: string, list: string[]): string | undefined {
  const lower = n.toLowerCase();
  for (const item of list) {
    if (lower.includes(item.toLowerCase())) return item;
  }
  return undefined;
}

function detectEdition(n: string): EditionType | undefined {
  if (n.includes("retro")) return "Retro Kit";
  if (n.includes("player edition") || n.includes("player kit")) return "Player Edition";
  if (n.includes("fan edition") || n.includes("fan kit")) return "Fan Edition";
  return undefined;
}

function detectKit(n: string): KitType | undefined {
  if (n.includes("home")) return "Home";
  if (n.includes("away")) return "Away";
  if (n.includes("third")) return "Third";
  if (n.includes("retro")) return "Retro";
  return undefined;
}

function detectSource(n: string): SourceCountry | undefined {
  if (n.includes("china")) return "China";
  if (n.includes("thailand")) return "Thailand";
  if (n.includes("bd-made") || n.includes("bd made") || n.includes("bangladesh")) return "Bangladesh";
  return undefined;
}

function availableSizes(p: Product): string {
  const inStock = p.variants.filter((v) => v.stock_quantity > 0);
  if (!inStock.length) return p.variants.map((v) => v.size).join(", ");
  return inStock.map((v) => v.size).join(", ");
}

export function matchQuery(query: string, products: Product[]): QueryReasoning {
  const normalized = normalize(query);
  const detected_team = detectFromList(normalized, TEAMS);
  const detected_player = detectFromList(normalized, PLAYERS);
  const detected_year = detectYear(normalized);
  const detected_size = detectSize(normalized);
  const detected_edition = detectEdition(normalized);
  const detected_kit = detectKit(normalized);
  const detected_source = detectSource(normalized);

  const scored = products.map((p) => {
    let score = 0;
    const teamLower = p.team_country_club.toLowerCase();
    if (detected_team && teamLower === detected_team.toLowerCase()) score += 35;
    else if (detected_team && teamLower.includes(detected_team.toLowerCase())) score += 25;

    if (detected_player && p.player_name?.toLowerCase().includes(detected_player.toLowerCase())) score += 25;
    if (detected_year && p.season_year === detected_year) score += 15;
    if (detected_size && p.variants.some((v) => v.size === detected_size)) score += 10;
    if (detected_edition && p.edition_type === detected_edition) score += 10;
    if (detected_kit && p.kit_type === detected_kit) score += 10;
    if (detected_source && p.source_country === detected_source) score += 5;

    if (!detected_team && !detected_player) {
      const nameLower = p.product_name.toLowerCase();
      const tokens = normalized.split(" ").filter((t) => t.length > 3);
      const hits = tokens.filter((t) => nameLower.includes(t)).length;
      if (hits >= 2) score += 20;
    }

    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const candidates = scored
    .filter((s) => s.score > 0)
    .slice(0, 3)
    .map((s) => ({ product_id: s.p.id, name: s.p.product_name, score: s.score }));

  // Compute team-level fallback (team or player exists in inventory)
  const sameTeamProducts = detected_team
    ? products.filter((p) => p.team_country_club.toLowerCase() === detected_team.toLowerCase())
    : detected_player
    ? products.filter((p) => p.player_name?.toLowerCase().includes(detected_player.toLowerCase()))
    : [];

  let closest_fallback: FallbackMatch | undefined;
  if (sameTeamProducts.length) {
    // Prefer one with stock
    const withStock = sameTeamProducts.find((p) =>
      p.variants.some((v) => v.stock_quantity > 0),
    );
    const pick = withStock || sameTeamProducts[0];
    closest_fallback = {
      product_id: pick.id,
      product_name: pick.product_name,
      reason: `Closest available product for ${detected_team || detected_player}.`,
    };
  }

  const base = {
    original: query,
    normalized,
    detected_team,
    detected_player,
    detected_year,
    detected_size,
    detected_edition,
    detected_source,
    detected_kit,
    closest_fallback,
  };

  // Case 1: Team explicitly named, NOT in inventory at all
  if (detected_team) {
    const teamExists = products.some(
      (p) => p.team_country_club.toLowerCase() === detected_team.toLowerCase(),
    );
    if (!teamExists) {
      return {
        ...base,
        confidence: 0,
        reason: `Customer asked about "${detected_team}" but no product with that team/country/club exists in inventory.`,
        reply: `Sorry, ${detected_team} er jersey ta currently inventory te nei. Apni onno club/country, player, season ba size bolle ami abar check korte parbo.`,
        candidates: [],
      };
    }

    // Case 2: Team exists, but with a kit_type filter that doesn't match any product
    if (detected_kit) {
      const exact = products.find(
        (p) =>
          p.team_country_club.toLowerCase() === detected_team.toLowerCase() &&
          p.kit_type === detected_kit,
      );
      if (!exact) {
        const fb = closest_fallback;
        const fbProduct = sameTeamProducts.find((p) => p.id === fb?.product_id) || sameTeamProducts[0];
        const sizes = fbProduct ? availableSizes(fbProduct) : "";
        return {
          ...base,
          confidence: 35,
          reason: `Team "${detected_team}" exists but requested kit type "${detected_kit}" is not in inventory. Suggesting closest available product.`,
          reply: fbProduct
            ? `${detected_team} er ${detected_kit} Kit currently inventory te nei. But ${fbProduct.product_name} available ache in ${sizes}. Apni eta dekhte chan?`
            : `${detected_team} er ${detected_kit} Kit currently inventory te nei.`,
          candidates,
        };
      }
    }
  }

  if (!top || top.score < 45) {
    // If a team/player fallback exists, surface it
    if (closest_fallback && sameTeamProducts.length) {
      const fbProduct = sameTeamProducts[0];
      const sizes = availableSizes(fbProduct);
      return {
        ...base,
        confidence: top?.score ?? 0,
        matched_product_id: undefined,
        matched_product_name: undefined,
        reason: "Exact match not found. Closest inventory product found based on team/player.",
        reply: `Exact match paini, but ${fbProduct.product_name} available ache in ${sizes}. Apni eta dekhte chan?`,
        candidates,
      };
    }
    return {
      ...base,
      confidence: top?.score ?? 0,
      reason: "No confident match found in inventory.",
      reply:
        "Sorry, ei jersey ta currently inventory te nei. Apni club/country, player, season ba size bolle ami abar check korte parbo.",
      candidates,
    };
  }

  if (top.score < 70 && candidates.length > 1) {
    const list = candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
    return {
      ...base,
      confidence: top.score,
      matched_product_id: top.p.id,
      matched_product_name: top.p.product_name,
      reason: "Multiple partial matches. Asking for clarification.",
      reply: `Apni ki eta bujhaisen?\n${list}`,
      candidates,
    };
  }

  // High confidence
  const p = top.p;
  let reply = "";
  const reason = `High-confidence match (${top.score}). Used inventory record for ${p.product_name}.`;

  if (detected_size) {
    const v = p.variants.find((x) => x.size === detected_size);
    if (!v) {
      reply = `${p.product_name} available ache. Available sizes: ${availableSizes(p)}. Apni je size cheyechen (${detected_size}) seita nei.`;
    } else if (v.stock_quantity === 0) {
      reply = `Sorry, ${p.product_name} size ${v.size} ekhon stock e nei. Possible restock date: ${v.possible_restock_date || "TBA"}. Chaile preorder korte paren.`;
    } else if (v.stock_quantity <= v.low_stock_threshold) {
      reply = `Yes, ${p.product_name} size ${v.size} available ache, but low stock. Price ${bdt(v.selling_price)}. Stock e ${v.stock_quantity} pcs ache. Chaile reserve korte paren.`;
    } else {
      reply = `Yes, ${p.product_name} size ${v.size} available ache. Price ${bdt(v.selling_price)}. Stock e ${v.stock_quantity} pcs ache. Order korte chaile bolben.`;
    }
  } else {
    const sizes = p.variants.map((v) => `${v.size} (${v.stock_quantity})`).join(", ");
    reply = `${p.product_name} available ache. Available sizes: ${sizes}. Kon size lagbe?`;
  }

  return {
    ...base,
    matched_product_id: p.id,
    matched_product_name: p.product_name,
    confidence: top.score,
    reason,
    reply,
    candidates,
  };
}
