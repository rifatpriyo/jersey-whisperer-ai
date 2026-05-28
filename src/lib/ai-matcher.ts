import type { Product, QueryReasoning, Size, EditionType, SourceCountry, KitType } from "./types";
import { bdt } from "./inventory-utils";

const SIZE_WORDS: Record<string, Size> = {
  s: "S", small: "S",
  m: "M", medium: "M",
  l: "L", large: "L",
  xl: "XL", "extra large": "XL", "extra-large": "XL",
  xxl: "XXL", "double xl": "XXL",
};

const AVAIL_WORDS = ["ase", "ache", "available", "stock", "pawa", "paowa", "achee", "ase?", "ache?", "stock e ache"];
const PRICE_WORDS = ["price", "dam", "koto", "rate"];

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

    // soft name keyword match (only counts if team/player not detected, to avoid leaking unrelated)
    const nameLower = p.product_name.toLowerCase();
    if (!detected_team && !detected_player) {
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

  // Critical: if user specified a team that is NOT in inventory, do not match by player coincidence
  if (detected_team) {
    const teamExists = products.some(
      (p) => p.team_country_club.toLowerCase() === detected_team.toLowerCase(),
    );
    if (!teamExists) {
      return {
        original: query,
        normalized,
        detected_team,
        detected_player,
        detected_year,
        detected_size,
        detected_edition,
        detected_source,
        detected_kit,
        confidence: 0,
        reason: `Customer asked about "${detected_team}" but no product with that team/country/club exists in inventory. Refusing to substitute another product.`,
        reply: `Sorry, ${detected_team} er jersey ta currently inventory te nei. Apni onno club/country, player, season ba size bolle ami abar check korte parbo.`,
        candidates: [],
      };
    }
  }

  if (!top || top.score < 45) {
    return {
      original: query,
      normalized,
      detected_team,
      detected_player,
      detected_year,
      detected_size,
      detected_edition,
      detected_source,
      detected_kit,
      confidence: top?.score ?? 0,
      reason: "No confident match found in inventory.",
      reply:
        "Sorry, ei jersey ta currently inventory te nei. Apni club/country, player, season ba size bolle ami abar check korte parbo.",
      candidates,
    };
  }

  if (top.score < 70 && candidates.length > 1) {
    const list = candidates
      .map((c, i) => `${i + 1}. ${c.name}`)
      .join("\n");
    return {
      original: query,
      normalized,
      detected_team,
      detected_player,
      detected_year,
      detected_size,
      detected_edition,
      detected_source,
      detected_kit,
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
  let reason = `High-confidence match (${top.score}). Used inventory record for ${p.product_name}.`;

  if (detected_size) {
    const v = p.variants.find((x) => x.size === detected_size);
    if (!v) {
      reply = `${p.product_name} available ache. Available sizes: ${p.variants.map((x) => x.size).join(", ")}. Apni je size cheyechen (${detected_size}) seita nei.`;
    } else if (v.stock_quantity === 0) {
      reply = `Sorry, ${p.product_name} size ${v.size} ekhon stock e nei. Possible restock date: ${v.possible_restock_date || "TBA"}. Chaile preorder korte paren.`;
    } else if (v.stock_quantity <= v.low_stock_threshold) {
      reply = `Available ache, but only ${v.stock_quantity} pcs left. Price ${bdt(v.selling_price)}. Chaile ekhon reserve korte paren.`;
    } else {
      reply = `Yes, ${p.product_name} size ${v.size} available ache. Price ${bdt(v.selling_price)}. Stock e ${v.stock_quantity} pcs ache. Order korte chaile bolben.`;
    }
  } else {
    const sizes = p.variants.map((v) => `${v.size} (${v.stock_quantity})`).join(", ");
    reply = `${p.product_name} available ache. Available sizes: ${sizes}. Kon size lagbe?`;
  }

  return {
    original: query,
    normalized,
    detected_team,
    detected_player,
    detected_year,
    detected_size,
    detected_edition,
    detected_source,
    detected_kit,
    matched_product_id: p.id,
    matched_product_name: p.product_name,
    confidence: top.score,
    reason,
    reply,
    candidates,
  };
}
