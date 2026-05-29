import type {
  Product,
  QueryReasoning,
  Size,
  EditionType,
  SourceCountry,
  KitType,
  FallbackMatch,
  IntentType,
  ResponseSource,
} from "./types";
import { bdt } from "./inventory-utils";

// ---------- Shop policy knowledge ----------
export const SHOP_POLICY = {
  delivery_inside_dhaka: 80,
  delivery_outside_dhaka: 120,
  pickup_point: "Mohammadpur",
  pickup_time: "11 AM - 8 PM",
  cod: true,
  print_charge: 150,
  exchange_window_hours: 24,
  material: "premium replica polyester",
  couriers: ["Steadfast", "Pathao"],
  regular_max_size: "2XL",
  special_preorder_sizes: ["3XL", "4XL", "5XL"],
};

const PRICE_BY_EDITION: Record<EditionType, number> = {
  "Player Edition": 1099,
  "Fan Edition": 899,
  "Retro Kit": 1290,
};

// ---------- Detection dictionaries ----------
const SIZE_WORDS: Record<string, Size> = {
  s: "S", small: "S",
  m: "M", medium: "M",
  l: "L", large: "L",
  xl: "XL", "extra large": "XL", "extra-large": "XL",
  xxl: "XXL", "2xl": "XXL", "double xl": "XXL",
};
const SPECIAL_SIZES = ["3xl", "4xl", "5xl", "xxxl"];

const TEAMS = [
  "Argentina", "Brazil", "Portugal", "Spain", "France", "Germany", "England",
  "Real Madrid", "Barcelona", "Barca", "Manchester United", "Man United",
  "Manchester City", "Man City", "Liverpool", "Chelsea", "Arsenal", "PSG",
  "Juventus", "Bayern Munich", "Bayern", "Bangladesh",
];
const TEAM_ALIAS: Record<string, string> = {
  barca: "Barcelona",
  "man united": "Manchester United",
  "man city": "Manchester City",
  arg: "Argentina",
  bayern: "Bayern Munich",
};

const PLAYERS = [
  "Messi", "Ronaldo", "Cristiano", "Neymar", "Mbappe", "Haaland", "Bellingham",
  "Lamine Yamal", "Yamal", "Salah", "De Bruyne", "Vinicius", "Rodrygo",
];

// ---------- Helpers ----------
function normalize(q: string) {
  return q.toLowerCase().replace(/[?,.!]/g, " ").replace(/\s+/g, " ").trim();
}
function detectSize(n: string): Size | undefined {
  const tokens = n.split(" ");
  for (const t of tokens) {
    const k = t.replace(/[^a-z0-9]/g, "");
    if (SIZE_WORDS[k]) return SIZE_WORDS[k];
  }
  if (n.includes("extra large")) return "XL";
  return undefined;
}
function detectSpecialSize(n: string): string | undefined {
  for (const s of SPECIAL_SIZES) if (n.includes(s)) return s.toUpperCase();
  return undefined;
}
function detectYear(n: string): number | undefined {
  const m = n.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : undefined;
}
function detectFromList(n: string, list: string[]): string | undefined {
  for (const item of list) {
    if (n.includes(item.toLowerCase())) {
      return TEAM_ALIAS[item.toLowerCase()] || item;
    }
  }
  return undefined;
}
function detectEdition(n: string): EditionType | undefined {
  if (n.includes("retro")) return "Retro Kit";
  if (n.includes("player edition") || n.includes("player kit") || n.includes("player version"))
    return "Player Edition";
  if (n.includes("fan edition") || n.includes("fan kit") || n.includes("fan version"))
    return "Fan Edition";
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
  if (n.includes("thailand") || n.includes("thai")) return "Thailand";
  if (n.includes("bd-made") || n.includes("bd made") || n.includes("bangladesh") || n.includes("local"))
    return "Bangladesh";
  return undefined;
}
function availableSizes(p: Product): string {
  const inStock = p.variants.filter((v) => v.stock_quantity > 0);
  if (!inStock.length) return p.variants.map((v) => v.size).join(", ") || "—";
  return inStock.map((v) => v.size).join(", ");
}

// ---------- Intent detection ----------
function detectIntent(n: string): IntentType {
  if (/^(hi|hello|hey|salam|assalamu|asalamu|assalam)\b/.test(n)) return "greeting";
  if (/(miau|meow|halum|hala\b|woof|bark)/.test(n)) return "funny";
  if (/(exchange|return|ferot|ferot dewa|change korte)/.test(n)) return "exchange";
  if (/(cod|cash on delivery|advance|payment|bkash|nagad)/.test(n)) return "payment";
  if (/(material|quality|original|fabric|kapor|kapor kemon)/.test(n)) return "material";
  if (/(discount|offer|kom dam|kom dame|kome)/.test(n)) return "discount";
  if (/(tracking|order id|order status|order update|dispatch|courier kobe)/.test(n))
    return "order_status";
  if (/(size chart|size cart)/.test(n)) return "size_chart";
  if (/(pickup|physical shop|dokan|store location|shop kothay)/.test(n)) return "pickup";
  if (/(delivery|courier|dhaka delivery|outside dhaka|delivery charge|delivery koto)/.test(n))
    return "delivery";
  if (/(print|name.*print|number print|customize|name customization|font)/.test(n))
    return "custom_print";
  if (/(price|koto|dam|daam|koto taka|kemne dam)/.test(n)) return "price";
  // size-specific intents
  if (/(highest size|biggest size|max size|3xl|4xl|5xl|xxxl|height.*weight|kon size)/.test(n))
    return "size";
  // availability
  if (
    /(ase|ache|available|hobe|stock|paowa|paoa|paben|peyechen|peyechi|ki ase|ki ache)/.test(n) ||
    /(jersey|kit|jercy|jersi)/.test(n)
  )
    return "availability";
  return "unknown";
}

// ---------- Product scoring ----------
function scoreProducts(
  products: Product[],
  detected: {
    team?: string;
    player?: string;
    year?: number;
    size?: Size;
    edition?: EditionType;
    kit?: KitType;
    source?: SourceCountry;
    normalized: string;
  },
) {
  const scored = products.map((p) => {
    let score = 0;
    const teamLower = p.team_country_club.toLowerCase();
    if (detected.team && teamLower === detected.team.toLowerCase()) score += 35;
    else if (detected.team && teamLower.includes(detected.team.toLowerCase())) score += 25;

    if (detected.player && p.player_name?.toLowerCase().includes(detected.player.toLowerCase()))
      score += 20;
    if (detected.year && p.season_year === detected.year) score += 15;
    if (detected.size && p.variants.some((v) => v.size === detected.size)) score += 8;
    if (detected.edition && p.edition_type === detected.edition) score += 12;
    if (detected.kit && p.kit_type === detected.kit) score += 12;
    if (detected.source && p.source_country === detected.source) score += 5;

    if (!detected.team && !detected.player) {
      const nameLower = p.product_name.toLowerCase();
      const tokens = detected.normalized.split(" ").filter((t) => t.length > 3);
      const hits = tokens.filter((t) => nameLower.includes(t)).length;
      if (hits >= 2) score += 15;
    }
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ---------- Policy / static replies ----------
function policyReply(intent: IntentType, n: string): string | undefined {
  switch (intent) {
    case "greeting":
      return "Assalamu alaikum sir! Kon jersey/kit ta dekhte chacchen?";
    case "funny":
      return "Halum 😄 Jersey lagbe naki sir?";
    case "delivery":
      return `Dhakar vitore delivery charge ৳${SHOP_POLICY.delivery_inside_dhaka}, outside Dhaka ৳${SHOP_POLICY.delivery_outside_dhaka}.`;
    case "pickup":
      return `Ji sir, pickup point ${SHOP_POLICY.pickup_point}. Time: ${SHOP_POLICY.pickup_time}.`;
    case "size_chart":
      return "Sure sir, size chart photo pathano hobe. Apnar height/weight dile size recommend korte parbo.";
    case "order_status":
      return "Kindly order ID/phone number ta diben sir, ami check kore update dicchi.";
    case "custom_print":
      return `Ji sir, name & number printing available. Extra charge ৳${SHOP_POLICY.print_charge}.`;
    case "exchange":
      return `Ji sir, delivery pawar ${SHOP_POLICY.exchange_window_hours} hours er moddhe exchange request korte hobe. Exchange delivery charge applicable.`;
    case "payment":
      return "Ji sir, cash on delivery available. Advance normally lage na, custom print/preorder hole advance lagte pare.";
    case "material":
      return `Sir premium replica quality, breathable polyester fabric. Summer e comfortable.`;
    case "discount":
      return "Sir currently offer thakte pare. 2 jersey nile discount dewa jete pare depending on stock.";
  }
  return undefined;
}

// ---------- Main matcher ----------
export function matchQuery(query: string, products: Product[]): QueryReasoning {
  const normalized = normalize(query);
  const intent = detectIntent(normalized);

  const detected_team = detectFromList(normalized, TEAMS);
  const detected_player = detectFromList(normalized, PLAYERS);
  const detected_year = detectYear(normalized);
  const detected_size = detectSize(normalized);
  const detected_special = detectSpecialSize(normalized);
  const detected_edition = detectEdition(normalized);
  const detected_kit = detectKit(normalized);
  const detected_source = detectSource(normalized);
  const detected_font = detected_player;

  const base = {
    original: query,
    normalized,
    intent,
    detected_team,
    detected_player,
    detected_font,
    detected_year,
    detected_size,
    detected_edition,
    detected_kit,
    detected_source,
  };

  // 1. Pure policy intents — handle before inventory
  const policyIntents: IntentType[] = [
    "greeting", "funny", "delivery", "pickup", "size_chart",
    "order_status", "exchange", "payment", "material", "discount",
  ];
  if (policyIntents.includes(intent)) {
    const source: ResponseSource = intent === "funny" ? "Funny fallback" : "Shop policy";
    return {
      ...base,
      response_source: source,
      confidence: 90,
      reason: `Intent: ${intent}. Answered from shop policy knowledge.`,
      reply: policyReply(intent, normalized)!,
      candidates: [],
    };
  }

  // 2. Custom print intent (mention of print/font)
  if (intent === "custom_print") {
    return {
      ...base,
      response_source: "Shop policy",
      confidence: 88,
      reason: "Customer asking about custom name/number printing.",
      reply: policyReply("custom_print", normalized)!,
      candidates: [],
    };
  }

  // 3. Size intent (special preorder sizes 3XL/4XL/5XL)
  if (intent === "size" && detected_special) {
    let teamPart = "";
    if (detected_team) teamPart = `${detected_team} `;
    return {
      ...base,
      response_source: "Shop policy",
      confidence: 80,
      reason: `Special preorder size detected: ${detected_special}.`,
      reply: detected_team
        ? `${teamPart}${detected_special} special preorder possible kina supplier check korte hobe sir. Regular stock e usually S-2XL thake.`
        : `Regular stock e usually 2XL porjonto thake sir. 3XL/4XL/5XL special preorder hote pare, kintu supplier confirm korte hobe. Kon team/club er jersey lagbe?`,
      candidates: [],
    };
  }

  // 4. Pure price intent without product context
  if (intent === "price" && !detected_team && !detected_player && !detected_edition) {
    return {
      ...base,
      response_source: "Shop policy",
      confidence: 70,
      reason: "Generic price question — quoted edition-tier prices.",
      reply: `Player Edition ৳${PRICE_BY_EDITION["Player Edition"]}, Fan Edition ৳${PRICE_BY_EDITION["Fan Edition"]}, Retro Kit ৳${PRICE_BY_EDITION["Retro Kit"]}.`,
      candidates: [],
    };
  }

  // 5. Inventory matching
  const scored = scoreProducts(products, {
    team: detected_team, player: detected_player, year: detected_year,
    size: detected_size, edition: detected_edition, kit: detected_kit,
    source: detected_source, normalized,
  });
  const top = scored[0];
  const candidates = scored
    .filter((s) => s.score > 0).slice(0, 3)
    .map((s) => ({ product_id: s.p.id, name: s.p.product_name, score: s.score }));

  // Fallback by team/player
  const sameTeamProducts = detected_team
    ? products.filter((p) => p.team_country_club.toLowerCase() === detected_team.toLowerCase())
    : detected_player
    ? products.filter((p) => p.player_name?.toLowerCase().includes(detected_player.toLowerCase()))
    : [];
  let closest_fallback: FallbackMatch | undefined;
  if (sameTeamProducts.length) {
    const withStock = sameTeamProducts.find((p) => p.variants.some((v) => v.stock_quantity > 0));
    const pick = withStock || sameTeamProducts[0];
    closest_fallback = {
      product_id: pick.id,
      product_name: pick.product_name,
      reason: `Closest available product for ${detected_team || detected_player}.`,
    };
  }

  // 5a. Team named but not in inventory
  if (detected_team) {
    const teamExists = products.some(
      (p) => p.team_country_club.toLowerCase() === detected_team.toLowerCase(),
    );
    if (!teamExists) {
      return {
        ...base,
        response_source: "Inventory",
        confidence: 0,
        reason: `"${detected_team}" not in inventory.`,
        reply: `Sorry sir, ${detected_team} er jersey ta currently inventory te nei. Apni onno club/country, player, season ba size bolle ami abar check korte parbo.`,
        candidates: [],
        closest_fallback,
      };
    }

    // 5b. Team exists but kit_type mismatch
    if (detected_kit) {
      const exact = products.find(
        (p) =>
          p.team_country_club.toLowerCase() === detected_team.toLowerCase() &&
          p.kit_type === detected_kit,
      );
      if (!exact) {
        const fbProduct =
          sameTeamProducts.find((p) => p.id === closest_fallback?.product_id) ||
          sameTeamProducts[0];
        const sizes = fbProduct ? availableSizes(fbProduct) : "";
        return {
          ...base,
          response_source: "Inventory",
          confidence: 40,
          reason: `Team "${detected_team}" exists but requested kit "${detected_kit}" not in inventory. Suggesting fallback.`,
          reply: fbProduct
            ? `Sir ${detected_team} er ${detected_kit} Kit currently inventory te nei. But ${fbProduct.product_name} available ache in ${sizes}. Apni eta dekhte chan?`
            : `${detected_team} er ${detected_kit} Kit currently inventory te nei.`,
          candidates,
          closest_fallback,
        };
      }
    }
  }

  // 5c. Low confidence — suggest fallback or clarification
  if (!top || top.score < 45) {
    if (closest_fallback && sameTeamProducts.length) {
      const fbProduct = sameTeamProducts[0];
      const sizes = availableSizes(fbProduct);
      return {
        ...base,
        response_source: "Inventory",
        confidence: top?.score ?? 0,
        reason: "Exact match not found. Surfacing closest team/player product.",
        reply: `Sir exact match paini, but ${fbProduct.product_name} available ache in ${sizes}. Apni eta dekhte chan?`,
        candidates,
        closest_fallback,
      };
    }
    // Clarification
    return {
      ...base,
      response_source: "General support",
      confidence: top?.score ?? 0,
      reason: "No confident match. Asking clarification.",
      reply:
        "Sir, kon jersey ta dekhte chacchen? Team/club, size, edition (Player/Fan/Retro) bolle ami check kore bolte parbo.",
      candidates,
      closest_fallback,
    };
  }

  // 5d. Multiple partial matches
  if (top.score < 70 && candidates.length > 1) {
    const list = candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
    return {
      ...base,
      response_source: "Inventory",
      confidence: top.score,
      matched_product_id: top.p.id,
      matched_product_name: top.p.product_name,
      reason: "Multiple partial matches. Asking customer to clarify.",
      reply: `Apni ki eta bujhaisen sir?\n${list}`,
      candidates,
      closest_fallback,
    };
  }

  // 5e. High confidence match — handle availability / price / size sub-intents
  const p = top.p;
  let reply = "";
  const reason = `High-confidence match (${top.score}) for ${p.product_name}. Intent: ${intent}.`;

  if (intent === "price") {
    reply = `${p.product_name} ${p.edition_type} price ৳${PRICE_BY_EDITION[p.edition_type]} sir. Delivery inside Dhaka ৳${SHOP_POLICY.delivery_inside_dhaka}, outside Dhaka ৳${SHOP_POLICY.delivery_outside_dhaka}.`;
  } else if (detected_size) {
    const v = p.variants.find((x) => x.size === detected_size);
    if (!v) {
      reply = `${p.product_name} available ache sir. Available sizes: ${availableSizes(p)}. Apni je size cheyechen (${detected_size}) seita currently nei.`;
    } else if (v.stock_quantity === 0) {
      reply = `Sorry sir, ${p.product_name} size ${v.size} ekhon stock e nei. Possible restock: ${v.possible_restock_date || "TBA"}. Chaile preorder korte paren.`;
    } else if (v.stock_quantity <= v.low_stock_threshold) {
      reply = `Ji sir ${p.product_name} size ${v.size} available, but low stock (${v.stock_quantity} pcs). Price ${bdt(v.selling_price)}. Delivery inside Dhaka ৳${SHOP_POLICY.delivery_inside_dhaka}. Chaile reserve korte paren.`;
    } else {
      reply = `Ji sir ${p.product_name} size ${v.size} available ache. Price ${bdt(v.selling_price)}. Stock e ${v.stock_quantity} pcs ache. Delivery inside Dhaka ৳${SHOP_POLICY.delivery_inside_dhaka}, outside Dhaka ৳${SHOP_POLICY.delivery_outside_dhaka}. Order korte chaile bolben.`;
    }
  } else {
    const sizes = p.variants.map((v) => `${v.size} (${v.stock_quantity})`).join(", ");
    reply = `Ji sir ${p.product_name} available ache. Available sizes: ${sizes}. Kon size lagbe janaben kindly?`;
  }

  return {
    ...base,
    response_source: "Inventory",
    matched_product_id: p.id,
    matched_product_name: p.product_name,
    confidence: top.score,
    reason,
    reply,
    candidates,
    closest_fallback,
  };
}
