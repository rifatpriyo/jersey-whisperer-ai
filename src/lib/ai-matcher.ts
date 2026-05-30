import type {
  ConversationContext,
  EditionType,
  FallbackMatch,
  IntentType,
  KitType,
  ManufacturingType,
  MissingField,
  Product,
  QueryReasoning,
  ResponseSource,
  Size,
  SourceCountry,
} from "./types";
import { bdt } from "./inventory-utils";

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

const SIZE_WORDS: Record<string, Size> = {
  s: "S",
  small: "S",
  m: "M",
  medium: "M",
  l: "L",
  large: "L",
  xl: "XL",
  "extra large": "XL",
  "extra-large": "XL",
  xxl: "XXL",
  "2xl": "XXL",
  "double xl": "XXL",
};

const SPECIAL_SIZES = ["3xl", "4xl", "5xl", "xxxl"];

const TEAMS = [
  "Argentina",
  "Brazil",
  "Portugal",
  "Spain",
  "France",
  "Germany",
  "England",
  "Real Madrid",
  "Barcelona",
  "Barca",
  "Manchester United",
  "Man United",
  "Manchester City",
  "Man City",
  "Liverpool",
  "Chelsea",
  "Arsenal",
  "PSG",
  "Juventus",
  "Bayern Munich",
  "Bayern",
  "Bangladesh",
];

const TEAM_ALIAS: Record<string, string> = {
  barca: "Barcelona",
  "man united": "Manchester United",
  "man city": "Manchester City",
  arg: "Argentina",
  bayern: "Bayern Munich",
};

const PLAYER_ALIASES = [
  { canonical: "Messi", aliases: ["messi", "messi10", "messi 10", "মেসি"] },
  { canonical: "Neymar", aliases: ["neymar", "neymar10", "neymar 10", "নেইমার"] },
  {
    canonical: "Cristiano",
    aliases: ["cristiano", "cristiano7", "cristiano 7", "ronaldo", "ronaldo7"],
  },
  { canonical: "Bellingham", aliases: ["bellingham", "bellingham5", "bellingham 5"] },
  {
    canonical: "Lamine Yamal",
    aliases: ["lamine yamal", "lamineyamal19", "lamine yamal19", "yamal", "yamal19"],
  },
  { canonical: "Mbappe", aliases: ["mbappe", "mbappe7"] },
  { canonical: "Haaland", aliases: ["haaland", "haaland9"] },
  { canonical: "Salah", aliases: ["salah", "salah11"] },
];

const DEFAULT_FONT_BY_PLAYER: Record<string, string> = {
  Messi: "Messi10",
  Neymar: "Neymar10",
  Cristiano: "Cristiano7",
  Ronaldo: "Cristiano7",
  Bellingham: "Bellingham5",
  "Lamine Yamal": "Lamine Yamal19",
  Yamal: "Lamine Yamal19",
};

function normalize(query: string) {
  return query
    .toLowerCase()
    .replace(/[?,.!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function squish(value: string) {
  return normalize(value).replace(/\s+/g, "");
}

function dedupe<T>(values: T[]) {
  return [...new Set(values)];
}

function detectSize(normalized: string): Size | undefined {
  const tokens = normalized.split(" ");
  for (const token of tokens) {
    const key = token.replace(/[^a-z0-9]/g, "");
    if (SIZE_WORDS[key]) return SIZE_WORDS[key];
  }
  if (normalized.includes("extra large")) return "XL";
  return undefined;
}

function detectSpecialSize(normalized: string): string | undefined {
  for (const special of SPECIAL_SIZES) {
    if (normalized.includes(special)) return special.toUpperCase();
  }
  return undefined;
}

function detectYear(normalized: string): number | undefined {
  const match = normalized.match(/\b(19|20)\d{2}\b/);
  return match ? Number.parseInt(match[0], 10) : undefined;
}

function detectFromList(normalized: string, list: string[]): string | undefined {
  for (const item of list) {
    if (normalized.includes(item.toLowerCase())) {
      return TEAM_ALIAS[item.toLowerCase()] || item;
    }
  }
  return undefined;
}

function detectPlayer(normalized: string): string | undefined {
  for (const player of PLAYER_ALIASES) {
    if (player.aliases.some((alias) => normalized.includes(alias))) {
      return player.canonical;
    }
  }
  return undefined;
}

function detectEdition(normalized: string): EditionType | undefined {
  if (/(retro kit|\bretro\b)/.test(normalized)) return "Retro Kit";
  if (/(player edition|player version|player kit|\bplayer\b)/.test(normalized)) {
    return "Player Edition";
  }
  if (/(fan edition|fan version|fan kit|\bfan\b)/.test(normalized)) return "Fan Edition";
  return undefined;
}

function detectKit(normalized: string): KitType | undefined {
  if (/\bhome\b/.test(normalized)) return "Home";
  if (/\baway\b/.test(normalized)) return "Away";
  if (/\bthird\b/.test(normalized)) return "Third";
  if (/\bretro\b/.test(normalized)) return "Retro";
  return undefined;
}

function detectSource(normalized: string): SourceCountry | undefined {
  if (normalized.includes("china")) return "China";
  if (normalized.includes("thailand") || normalized.includes("thai")) return "Thailand";
  if (
    normalized.includes("bd-made") ||
    normalized.includes("bd made") ||
    normalized.includes("bangladesh") ||
    normalized.includes("local")
  ) {
    return "Bangladesh";
  }
  return undefined;
}

function detectManufacturing(normalized: string): ManufacturingType | undefined {
  if (normalized.includes("imported")) return "Imported";
  if (normalized.includes("bd-made") || normalized.includes("bd made") || normalized.includes("local")) {
    return "BD-made";
  }
  return undefined;
}

function hasPrintIntent(normalized: string) {
  return (
    /(font|print|name number|name & number|name and number|custom print|customize)/.test(
      normalized,
    ) ||
    /(\u09ab\u09a8\u09cd\u099f|\u09aa\u09cd\u09b0\u09bf\u09a8\u09cd\u099f|\u09a8\u09c7\u0987\u09ae)/.test(
      normalized,
    )
  );
}

function detectFontPrint(
  normalized: string,
  products: Product[],
  detectedPlayer?: string,
): string | undefined {
  if (/(blank|no print|no font|without print|plain)/.test(normalized)) {
    return "Blank / No print";
  }

  const inventoryFonts = dedupe(
    products
      .map((product) => product.font_name?.trim())
      .filter((value): value is string => Boolean(value)),
  );

  const squishedQuery = squish(normalized);
  for (const font of inventoryFonts) {
    if (squishedQuery.includes(squish(font))) return font;
  }

  if (detectedPlayer && hasPrintIntent(normalized)) {
    const fromInventory = products.find(
      (product) =>
        product.player_name?.toLowerCase().includes(detectedPlayer.toLowerCase()) && product.font_name,
    )?.font_name;
    return fromInventory || DEFAULT_FONT_BY_PLAYER[detectedPlayer];
  }

  return undefined;
}

function availableSizesFromProducts(products: Product[]) {
  const available = new Set<string>();
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.stock_quantity > 0) available.add(variant.size);
    }
  }
  return [...available];
}

function availableSizes(product: Product) {
  const inStock = product.variants.filter((variant) => variant.stock_quantity > 0);
  if (!inStock.length) {
    return product.variants.map((variant) => variant.size).join(", ") || "-";
  }
  return inStock.map((variant) => variant.size).join(", ");
}

function findTeamProducts(products: Product[], team: string) {
  return products.filter(
    (product) => product.team_country_club.toLowerCase() === team.toLowerCase(),
  );
}

function scoreProducts(
  products: Product[],
  detected: {
    team?: string;
    player?: string;
    fontPrint?: string;
    year?: number;
    size?: Size;
    edition?: EditionType;
    kit?: KitType;
    source?: SourceCountry;
    manufacturingType?: ManufacturingType;
    normalized: string;
  },
) {
  const normalizedFontPrint = detected.fontPrint ? squish(detected.fontPrint) : undefined;
  const scored = products.map((product) => {
    let score = 0;
    const teamLower = product.team_country_club.toLowerCase();
    if (detected.team && teamLower === detected.team.toLowerCase()) score += 35;
    else if (detected.team && teamLower.includes(detected.team.toLowerCase())) score += 25;

    if (
      detected.player &&
      product.player_name?.toLowerCase().includes(detected.player.toLowerCase())
    ) {
      score += 18;
    }

    if (normalizedFontPrint && squish(product.font_name || "") === normalizedFontPrint) score += 24;
    if (detected.year && product.season_year === detected.year) score += 15;
    if (detected.size && product.variants.some((variant) => variant.size === detected.size)) score += 10;
    if (detected.edition && product.edition_type === detected.edition) score += 15;
    if (detected.kit && product.kit_type === detected.kit) score += 14;
    if (detected.source && product.source_country === detected.source) score += 6;
    if (detected.manufacturingType && product.manufacturing_type === detected.manufacturingType) {
      score += 6;
    }

    if (!detected.team && !detected.player && !normalizedFontPrint) {
      const nameLower = product.product_name.toLowerCase();
      const tokens = detected.normalized.split(" ").filter((token) => token.length > 3);
      const hits = tokens.filter((token) => nameLower.includes(token)).length;
      if (hits >= 2) score += 15;
    }

    return { product, score };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored;
}

function summarizeReusedContext(context?: Partial<ConversationContext>) {
  if (!context) return undefined;

  const parts: string[] = [];
  if (context.lastDetectedTeam) parts.push(`Team: ${context.lastDetectedTeam}`);
  if (context.lastDetectedKitType) parts.push(`Kit: ${context.lastDetectedKitType}`);
  if (context.lastDetectedEdition) parts.push(`Edition: ${context.lastDetectedEdition}`);
  if (context.lastDetectedSize) parts.push(`Size: ${context.lastDetectedSize}`);
  if (context.lastDetectedFontPrint) parts.push(`Font/Print: ${context.lastDetectedFontPrint}`);
  if (context.lastDetectedYear) parts.push(`Year: ${context.lastDetectedYear}`);
  if (context.lastDetectedSourceCountry) parts.push(`Source: ${context.lastDetectedSourceCountry}`);
  if (context.lastDetectedManufacturingType) {
    parts.push(`Mfg: ${context.lastDetectedManufacturingType}`);
  }

  return parts.join(", ");
}

function buildBaseReasoning(args: {
  query: string;
  normalized: string;
  intent: IntentType;
  team?: string;
  player?: string;
  fontPrint?: string;
  year?: number;
  size?: Size;
  edition?: EditionType;
  source?: SourceCountry;
  manufacturingType?: ManufacturingType;
  kit?: KitType;
  updatedContext: ConversationContext;
  reusedContext?: Partial<ConversationContext>;
}): Omit<QueryReasoning, "response_source" | "confidence" | "reason" | "reply"> {
  return {
    original: args.query,
    normalized: args.normalized,
    intent: args.intent,
    detected_team: args.team,
    detected_player: args.player,
    detected_font: args.fontPrint,
    detected_font_print: args.fontPrint,
    detected_year: args.year,
    detected_size: args.size,
    detected_edition: args.edition,
    detected_source: args.source,
    detected_manufacturing_type: args.manufacturingType,
    detected_kit: args.kit,
    missing_fields: [],
    reused_context: args.reusedContext,
    updated_context: args.updatedContext,
  };
}

function policyReply(intent: IntentType): string | undefined {
  switch (intent) {
    case "greeting":
      return "Assalamu alaikum sir! Kon jersey/kit ta dekhte chacchen?";
    case "funny":
      return "Halum \u{1F604} Jersey lagbe naki sir?";
    case "delivery":
      return `Dhakar vitore delivery charge ${bdt(SHOP_POLICY.delivery_inside_dhaka)}, outside Dhaka ${bdt(SHOP_POLICY.delivery_outside_dhaka)}.`;
    case "pickup":
      return `Ji sir, pickup point ${SHOP_POLICY.pickup_point}. Time: ${SHOP_POLICY.pickup_time}.`;
    case "size_chart":
      return "Sure sir, size chart photo pathano hobe. Apnar height/weight dile size recommend korte parbo.";
    case "order_status":
      return "Kindly order ID/phone number ta diben sir, ami check kore update dicchi.";
    case "exchange":
      return `Ji sir, delivery pawar ${SHOP_POLICY.exchange_window_hours} hours er moddhe exchange request korte hobe.`;
    case "payment":
      return "Ji sir, cash on delivery available. Custom print/preorder hole advance lagte pare.";
    case "material":
      return "Sir premium replica quality, breathable polyester fabric. Summer e comfortable.";
    case "discount":
      return "Sir stock er upor depend kore 2 jersey nile discount dewa jete pare.";
    default:
      return undefined;
  }
}

function mergeContext(
  previous: ConversationContext,
  rawTeam?: string,
) {
  if (
    rawTeam &&
    previous.lastDetectedTeam &&
    rawTeam.toLowerCase() !== previous.lastDetectedTeam.toLowerCase()
  ) {
    return { lastDetectedTeam: rawTeam } as ConversationContext;
  }

  return { ...previous };
}

function buildUpdatedContext(
  baseContext: ConversationContext,
  slots: {
    team?: string;
    kit?: KitType;
    edition?: EditionType;
    size?: Size;
    fontPrint?: string;
    source?: SourceCountry;
    manufacturingType?: ManufacturingType;
    year?: number;
  },
) {
  return {
    ...baseContext,
    ...(slots.team ? { lastDetectedTeam: slots.team } : {}),
    ...(slots.kit ? { lastDetectedKitType: slots.kit } : {}),
    ...(slots.edition ? { lastDetectedEdition: slots.edition } : {}),
    ...(slots.size ? { lastDetectedSize: slots.size } : {}),
    ...(slots.fontPrint ? { lastDetectedFontPrint: slots.fontPrint } : {}),
    ...(slots.source ? { lastDetectedSourceCountry: slots.source } : {}),
    ...(slots.manufacturingType
      ? { lastDetectedManufacturingType: slots.manufacturingType }
      : {}),
    ...(slots.year ? { lastDetectedYear: slots.year } : {}),
  };
}

function applyReusedContext(
  baseContext: ConversationContext,
  slots: {
    rawTeam?: string;
    rawKit?: KitType;
    rawEdition?: EditionType;
    rawSize?: Size;
    rawFontPrint?: string;
    rawSource?: SourceCountry;
    rawManufacturingType?: ManufacturingType;
    rawYear?: number;
  },
) {
  const reusedContext: Partial<ConversationContext> = {};

  const team = slots.rawTeam || baseContext.lastDetectedTeam || undefined;
  if (!slots.rawTeam && baseContext.lastDetectedTeam) {
    reusedContext.lastDetectedTeam = baseContext.lastDetectedTeam;
  }

  const kit = slots.rawKit || baseContext.lastDetectedKitType;
  if (!slots.rawKit && baseContext.lastDetectedKitType) {
    reusedContext.lastDetectedKitType = baseContext.lastDetectedKitType;
  }

  const edition = slots.rawEdition || baseContext.lastDetectedEdition;
  if (!slots.rawEdition && baseContext.lastDetectedEdition) {
    reusedContext.lastDetectedEdition = baseContext.lastDetectedEdition;
  }

  const size = slots.rawSize || baseContext.lastDetectedSize;
  if (!slots.rawSize && baseContext.lastDetectedSize) {
    reusedContext.lastDetectedSize = baseContext.lastDetectedSize;
  }

  const fontPrint = slots.rawFontPrint || baseContext.lastDetectedFontPrint;
  if (!slots.rawFontPrint && baseContext.lastDetectedFontPrint) {
    reusedContext.lastDetectedFontPrint = baseContext.lastDetectedFontPrint;
  }

  const source = slots.rawSource || baseContext.lastDetectedSourceCountry;
  if (!slots.rawSource && baseContext.lastDetectedSourceCountry) {
    reusedContext.lastDetectedSourceCountry = baseContext.lastDetectedSourceCountry;
  }

  const manufacturingType =
    slots.rawManufacturingType || baseContext.lastDetectedManufacturingType;
  if (!slots.rawManufacturingType && baseContext.lastDetectedManufacturingType) {
    reusedContext.lastDetectedManufacturingType = baseContext.lastDetectedManufacturingType;
  }

  const year = slots.rawYear || baseContext.lastDetectedYear;
  if (!slots.rawYear && baseContext.lastDetectedYear) {
    reusedContext.lastDetectedYear = baseContext.lastDetectedYear;
  }

  return {
    team,
    kit,
    edition,
    size,
    fontPrint,
    source,
    manufacturingType,
    year,
    reusedContext: Object.keys(reusedContext).length ? reusedContext : undefined,
  };
}

function buildClosestFallback(
  teamProducts: Product[],
  reference?: string,
): FallbackMatch | undefined {
  if (!teamProducts.length) return undefined;
  const stocked = teamProducts.find((product) =>
    product.variants.some((variant) => variant.stock_quantity > 0),
  );
  const picked = stocked || teamProducts[0];
  return {
    product_id: picked.id,
    product_name: picked.product_name,
    reason: `Closest available product for ${reference || picked.team_country_club}.`,
  };
}

function buildCandidates(scored: Array<{ product: Product; score: number }>) {
  return scored
    .filter((entry) => entry.score > 0)
    .slice(0, 3)
    .map((entry) => ({
      product_id: entry.product.id,
      name: entry.product.product_name,
      score: entry.score,
    }));
}

function buildPrintReply(args: {
  fontPrint?: string;
  team?: string;
  edition?: EditionType;
  size?: Size;
  printPossible: boolean;
  preferKitFirst?: boolean;
}) {
  const intro = args.fontPrint
    ? args.printPossible
      ? `Ji sir ${args.fontPrint} print available/possible.`
      : `Ei ${args.fontPrint} ready inventory te nei, but custom print possible hote pare sir.`
    : "Ji sir, name & number print possible.";

  if (!args.team) {
    return `${intro} Printing charge ${bdt(SHOP_POLICY.print_charge)}. Kon jersey/kit ar size lagbe sir?`;
  }

  if (!args.edition && !args.size) {
    if (args.preferKitFirst) {
      return `${intro} Printing charge ${bdt(SHOP_POLICY.print_charge)}. Kon ${args.team} kit ar size lagbe sir?`;
    }
    return `${intro} Printing charge ${bdt(SHOP_POLICY.print_charge)}. ${args.team} er player edition naki fan edition, ar kon size lagbe sir?`;
  }

  if (!args.size) {
    return `${intro} Printing charge ${bdt(SHOP_POLICY.print_charge)}. ${args.team} er kon size lagbe sir?`;
  }

  if (!args.edition) {
    return `${intro} Printing charge ${bdt(SHOP_POLICY.print_charge)}. ${args.team} er player edition naki fan edition lagbe sir?`;
  }

  return `${intro} Printing charge ${bdt(SHOP_POLICY.print_charge)}.`;
}

function formatMissingFields(fields: MissingField[]) {
  const labels: Record<MissingField, string> = {
    team_country_club: "Team/club/country",
    kit_type: "Kit type",
    edition_type: "Edition",
    size: "Size",
    font_print: "Font / Print",
    source_country: "Source country",
    manufacturing_type: "Manufacturing type",
    season_year: "Season year",
  };

  return fields.map((field) => labels[field]).join(", ");
}

export function matchQuery(
  query: string,
  products: Product[],
  previousContext: ConversationContext = {},
): QueryReasoning {
  const normalized = normalize(query);
  const intent = detectIntent(normalized);
  const safeBase = buildBaseReasoning({
    query,
    normalized,
    intent,
    updatedContext: previousContext,
  });

  try {
    const rawTeam = detectFromList(normalized, TEAMS);
    const rawPlayer = detectPlayer(normalized);
    const rawEdition = detectEdition(normalized);
    const rawKit = detectKit(normalized);
    const rawSize = detectSize(normalized);
    const rawSource = detectSource(normalized);
    const rawManufacturingType = detectManufacturing(normalized);
    const rawYear = detectYear(normalized);
    const rawSpecialSize = detectSpecialSize(normalized);
    const rawFontPrint = detectFontPrint(normalized, products, rawPlayer);

    const contextBase = mergeContext(previousContext, rawTeam);
    const appliedContext = applyReusedContext(contextBase, {
      rawTeam,
      rawKit,
      rawEdition,
      rawSize,
      rawFontPrint,
      rawSource,
      rawManufacturingType,
      rawYear,
    });

    const updatedContext = buildUpdatedContext(contextBase, {
      team: appliedContext.team,
      kit: appliedContext.kit,
      edition: appliedContext.edition,
      size: appliedContext.size,
      fontPrint: appliedContext.fontPrint,
      source: appliedContext.source,
      manufacturingType: appliedContext.manufacturingType,
      year: appliedContext.year,
    });

    const base = buildBaseReasoning({
      query,
      normalized,
      intent,
      team: appliedContext.team,
      player: rawPlayer,
      fontPrint: appliedContext.fontPrint,
      year: appliedContext.year,
      size: appliedContext.size,
      edition: appliedContext.edition,
      source: appliedContext.source,
      manufacturingType: appliedContext.manufacturingType,
      kit: appliedContext.kit,
      updatedContext,
      reusedContext: appliedContext.reusedContext,
    });

    const policyIntents: IntentType[] = [
      "greeting",
      "funny",
      "delivery",
      "pickup",
      "size_chart",
      "order_status",
      "exchange",
      "payment",
      "material",
      "discount",
    ];

    if (policyIntents.includes(intent)) {
      const source: ResponseSource = intent === "funny" ? "Funny fallback" : "Shop policy";
      return {
        ...base,
        response_source: source,
        confidence: 92,
        reason: `Intent ${intent} handled directly from shop policy.`,
        reply: policyReply(intent)!,
        candidates: [],
        closest_fallback: undefined,
      };
    }

    if (intent === "size" && rawSpecialSize) {
      const reply = appliedContext.team
        ? `${appliedContext.team} ${rawSpecialSize} special preorder possible kina supplier check korte hobe sir. Regular stock e usually S-2XL thake.`
        : `Regular stock e usually ${SHOP_POLICY.regular_max_size} porjonto thake sir. 3XL/4XL/5XL special preorder hote pare. Kon team/club er jersey lagbe?`;

      return {
        ...base,
        response_source: "Shop policy",
        confidence: 84,
        reason: `Special preorder size detected: ${rawSpecialSize}.`,
        reply,
        missing_fields: appliedContext.team ? [] : ["team_country_club"],
        candidates: [],
        closest_fallback: undefined,
      };
    }

    if (intent === "price" && !appliedContext.team && !appliedContext.edition) {
      return {
        ...base,
        response_source: "Shop policy",
        confidence: 72,
        reason: "Generic price question without product context.",
        reply: `Player Edition ${bdt(PRICE_BY_EDITION["Player Edition"])}, Fan Edition ${bdt(PRICE_BY_EDITION["Fan Edition"])}, Retro Kit ${bdt(PRICE_BY_EDITION["Retro Kit"])} sir.`,
        candidates: [],
        closest_fallback: undefined,
      };
    }

    const scored = scoreProducts(products, {
      team: appliedContext.team,
      player: rawPlayer,
      fontPrint: appliedContext.fontPrint,
      year: appliedContext.year,
      size: appliedContext.size,
      edition: appliedContext.edition,
      kit: appliedContext.kit,
      source: appliedContext.source,
      manufacturingType: appliedContext.manufacturingType,
      normalized,
    });
    const candidates = buildCandidates(scored);

    if (intent === "custom_print" || hasPrintIntent(normalized) || appliedContext.fontPrint) {
    const inferredFontTeamProducts = appliedContext.team
      ? findTeamProducts(products, appliedContext.team)
      : [];
    const printPossible =
      Boolean(
        appliedContext.fontPrint &&
          products.some(
            (product) =>
              squish(product.font_name || "") === squish(appliedContext.fontPrint || ""),
          ),
      ) || SHOP_POLICY.print_charge > 0;

    const missingFields: MissingField[] = [];
    if (!appliedContext.team) missingFields.push("team_country_club");
    if (!appliedContext.size) missingFields.push("size");
    if (!appliedContext.kit && inferredFontTeamProducts.length > 1) {
      missingFields.push("kit_type");
    }
    if (!appliedContext.edition && appliedContext.team) {
      missingFields.push("edition_type");
    }

      return {
        ...base,
        response_source: "Shop policy",
        confidence: printPossible ? 88 : 70,
        reason: `Font/print request detected.${summarizeReusedContext(appliedContext.reusedContext) ? ` Reused context: ${summarizeReusedContext(appliedContext.reusedContext)}.` : ""}`,
        reply: buildPrintReply({
          fontPrint: appliedContext.fontPrint,
          team: appliedContext.team,
          edition: appliedContext.edition,
          size: appliedContext.size,
          printPossible,
        }),
        missing_fields: dedupe(missingFields),
        candidates,
        closest_fallback: undefined,
      };
    }

    if (normalized === "oi") {
      return {
        ...base,
        response_source: "General support",
        confidence: 40,
        reason: 'Short prompt "oi" detected without any jersey slot.',
        reply: "Ji sir, bolun. Kon jersey lagbe?",
        missing_fields: ["team_country_club"],
        candidates,
        closest_fallback: undefined,
      };
    }

    if (["what", "hmm", "ok", "accha"].includes(normalized)) {
      return {
        ...base,
        response_source: "General support",
        confidence: 20,
        reason: "Unclear standalone follow-up detected. Context should not be reused here.",
        reply: "Sir, kon jersey ta dekhte chacchen? Team/club, edition, size bolle ami check korte parbo.",
        missing_fields: ["team_country_club", "edition_type", "size"],
        candidates,
        closest_fallback: undefined,
      };
    }

    if (!appliedContext.team) {
      return {
        ...base,
        response_source: "General support",
        confidence: 25,
        reason: "No team/club/country found. Asking the highest-priority missing slot.",
        reply: "Kon team/club/country er jersey lagbe sir?",
        missing_fields: ["team_country_club"],
        candidates,
        closest_fallback: undefined,
      };
    }

    const teamProducts = findTeamProducts(products, appliedContext.team);
    const closestFallback = buildClosestFallback(teamProducts, appliedContext.team);

    if (!teamProducts.length) {
      return {
        ...base,
        response_source: "Inventory",
        confidence: 0,
        reason: `"${appliedContext.team}" is not currently in inventory.`,
        reply: `${appliedContext.team} er jersey ta currently inventory te nei sir. Onno team/club/country bolle ami abar check korte parbo.`,
        closest_fallback: undefined,
        candidates: [],
      };
    }

    const availableEditions = dedupe(teamProducts.map((product) => product.edition_type));

    if (!appliedContext.edition) {
    const missingFields: MissingField[] = ["edition_type"];
    if (!appliedContext.size) missingFields.push("size");
    return {
      ...base,
      response_source: "Inventory",
      confidence: 68,
      reason: `Team detected as ${appliedContext.team}, but edition is still missing.${summarizeReusedContext(appliedContext.reusedContext) ? ` Reused context: ${summarizeReusedContext(appliedContext.reusedContext)}.` : ""}`,
      reply: appliedContext.size
        ? `${appliedContext.team} ${appliedContext.size} check kortesi sir. Player edition naki fan edition lagbe?`
        : `Ji sir ${appliedContext.team} jersey available ache. Player edition naki fan edition lagbe? Ar size ta bolben?`,
      missing_fields: missingFields,
        candidates,
        closest_fallback: closestFallback,
      };
    }

    const teamEditionProducts = teamProducts.filter(
      (product) => product.edition_type === appliedContext.edition,
    );

    if (!teamEditionProducts.length) {
    return {
      ...base,
      response_source: "Inventory",
      confidence: 42,
      reason: `${appliedContext.team} exists, but ${appliedContext.edition} is not available in inventory.`,
      reply: `${appliedContext.team} er ${appliedContext.edition} currently inventory te nei sir. ${availableEditions.join(", ")} available ache.`,
      missing_fields: [],
        candidates,
        closest_fallback: closestFallback,
      };
    }

    if (!appliedContext.size) {
    const sizes = availableSizesFromProducts(teamEditionProducts);
    return {
      ...base,
      response_source: "Inventory",
      confidence: 76,
      reason: `${appliedContext.team} and ${appliedContext.edition} detected. Size is still missing.`,
      reply:
        sizes.length > 0
          ? `Ji sir ${appliedContext.team} ${appliedContext.edition} available ache. Kon size lagbe sir? ${sizes.join(", ")} available thakte pare.`
          : `Ji sir ${appliedContext.team} ${appliedContext.edition} available ache. Kon size lagbe sir? S, M, L, XL, XXL?`,
      missing_fields: ["size"],
        candidates,
        closest_fallback: closestFallback,
      };
    }

    const teamEditionSizeProducts = teamEditionProducts.filter((product) =>
      product.variants.some((variant) => variant.size === appliedContext.size),
    );

    if (!appliedContext.kit) {
    const distinctKits = dedupe(teamEditionSizeProducts.map((product) => product.kit_type));
    if (distinctKits.length > 1) {
      return {
        ...base,
        response_source: "Inventory",
        confidence: 66,
        reason: "Team, edition, and size are known, but multiple kit types still match.",
        reply: "Home, away naki retro kit lagbe sir?",
        missing_fields: ["kit_type"],
          candidates,
          closest_fallback: closestFallback,
        };
      }
    }

    let filteredProducts = teamEditionProducts.filter((product) =>
      product.variants.some((variant) => variant.size === appliedContext.size),
    );

    if (appliedContext.kit) {
      filteredProducts = filteredProducts.filter(
        (product) => product.kit_type === appliedContext.kit,
      );
    }

    if (appliedContext.year) {
      filteredProducts = filteredProducts.filter(
        (product) => product.season_year === appliedContext.year,
      );
    }

    if (appliedContext.source) {
      filteredProducts = filteredProducts.filter(
        (product) => product.source_country === appliedContext.source,
      );
    }

    if (appliedContext.manufacturingType) {
      filteredProducts = filteredProducts.filter(
        (product) => product.manufacturing_type === appliedContext.manufacturingType,
      );
    }

    if (!filteredProducts.length && appliedContext.kit) {
    return {
      ...base,
      response_source: "Inventory",
      confidence: 30,
      reason: `Requested kit ${appliedContext.kit} is not available for the selected team, edition, and size.`,
      reply: `${appliedContext.team} er ${appliedContext.kit} ${appliedContext.edition} size ${appliedContext.size} currently inventory te nei sir.`,
      missing_fields: [],
        candidates,
        closest_fallback: closestFallback,
      };
    }

    if (!filteredProducts.length) {
    return {
      ...base,
      response_source: "Inventory",
      confidence: 34,
      reason: "Exact team + edition + size combination not found in inventory.",
      reply: `${appliedContext.team} ${appliedContext.edition} size ${appliedContext.size} currently inventory te paini sir. Onno size lagle bolben.`,
      missing_fields: [],
        candidates,
        closest_fallback: closestFallback,
      };
    }

    if (!appliedContext.kit && filteredProducts.length > 1) {
    return {
      ...base,
      response_source: "Inventory",
      confidence: 60,
      reason: "Multiple final products still match and kit clarification is required.",
      reply: "Home, away naki retro kit lagbe sir?",
      missing_fields: ["kit_type"],
        candidates,
        closest_fallback: closestFallback,
      };
    }

    const matchedProduct =
      filteredProducts.find((product) => {
        if (!appliedContext.fontPrint) return true;
        return squish(product.font_name || "") === squish(appliedContext.fontPrint);
      }) || filteredProducts[0];

    const matchedVariant = matchedProduct?.variants.find(
      (variant) => variant.size === appliedContext.size,
    );

    if (!matchedProduct) {
      return {
        ...base,
        response_source: "General support",
        confidence: 15,
        reason: "No matched product found after filtering. Returning safe clarification.",
        reply: "Sir, kon jersey ta dekhte chacchen? Team/club, edition, size bolle ami check korte parbo.",
        missing_fields: ["team_country_club", "edition_type", "size"],
        candidates,
        closest_fallback: closestFallback,
      };
    }

    if (!matchedVariant) {
      return {
        ...base,
        response_source: "Inventory",
        confidence: 40,
        matched_product_id: matchedProduct.id,
        matched_product_name: matchedProduct.product_name,
        reason: "Matched product found, but the requested size is not stocked on that product.",
        reply: `${matchedProduct.product_name} available ache sir. Kintu ${appliedContext.size} size ta currently nei. Available sizes: ${availableSizes(matchedProduct)}.`,
        missing_fields: [],
        candidates,
        closest_fallback: closestFallback,
      };
    }

    let reply = "";
    if (matchedVariant.stock_quantity === 0) {
      reply = `Sorry sir, ${matchedProduct.product_name} ${matchedProduct.edition_type} size ${matchedVariant.size} ekhon stock e nei. Possible restock: ${matchedVariant.possible_restock_date || "TBA"}.`;
    } else if (matchedVariant.stock_quantity <= matchedVariant.low_stock_threshold) {
      reply = `Ji sir ${matchedProduct.product_name} ${matchedProduct.edition_type} size ${matchedVariant.size} low stock ache. Price ${bdt(matchedVariant.selling_price)}. Stock e ${matchedVariant.stock_quantity} pcs ache.`;
    } else {
      reply = `Ji sir ${matchedProduct.product_name} ${matchedProduct.edition_type} size ${matchedVariant.size} available ache. Price ${bdt(matchedVariant.selling_price)}. Stock e ${matchedVariant.stock_quantity} pcs ache.`;
    }

    if (
      appliedContext.fontPrint &&
      squish(matchedProduct.font_name || "") !== squish(appliedContext.fontPrint)
    ) {
      reply += ` ${appliedContext.fontPrint} custom print possible hote pare. Printing charge ${bdt(SHOP_POLICY.print_charge)}.`;
    } else if (appliedContext.fontPrint) {
      reply += ` ${appliedContext.fontPrint} print available ache.`;
    }

    if (intent === "price") {
      reply += ` Delivery inside Dhaka ${bdt(SHOP_POLICY.delivery_inside_dhaka)}, outside Dhaka ${bdt(SHOP_POLICY.delivery_outside_dhaka)}.`;
    }

    return {
      ...base,
      response_source: "Inventory",
      matched_product_id: matchedProduct.id,
      matched_product_name: matchedProduct.product_name,
      confidence: 90,
      reason: `Final slot-filled inventory match found.${summarizeReusedContext(appliedContext.reusedContext) ? ` Reused context: ${summarizeReusedContext(appliedContext.reusedContext)}.` : ""}${base.missing_fields.length ? ` Missing fields: ${formatMissingFields(base.missing_fields)}.` : ""}`,
      reply,
      missing_fields: [],
      candidates,
      closest_fallback: closestFallback,
    };
  } catch (error) {
    console.error("[ai-matcher] matchQuery crashed", error);
    return {
      ...safeBase,
      response_source: "General support",
      confidence: 0,
      reason: "Safe fallback returned after matcher error.",
      reply: "Sir, kon jersey ta dekhte chacchen? Team/club, edition, size bolle ami check korte parbo.",
      missing_fields: ["team_country_club", "edition_type", "size"],
      candidates: [],
      closest_fallback: undefined,
      updated_context: previousContext,
    };
  }
}

function detectIntent(normalized: string): IntentType {
  if (/^(hi|hello|hey|salam|assalamu|asalamu|assalam)\b/.test(normalized)) return "greeting";
  if (/(miau|meow|halum|hala\b|woof|bark)/.test(normalized)) return "funny";
  if (/(exchange|return|ferot|ferot dewa|change korte)/.test(normalized)) return "exchange";
  if (/(cod|cash on delivery|advance|payment|bkash|nagad)/.test(normalized)) return "payment";
  if (/(material|quality|original|fabric|kapor|kapor kemon)/.test(normalized)) return "material";
  if (/(discount|offer|kom dam|kom dame|kome)/.test(normalized)) return "discount";
  if (/(tracking|order id|order status|order update|dispatch|courier kobe)/.test(normalized)) {
    return "order_status";
  }
  if (/(size chart|size cart)/.test(normalized)) return "size_chart";
  if (/(pickup|physical shop|dokan|store location|shop kothay)/.test(normalized)) return "pickup";
  if (/(delivery|courier|dhaka delivery|outside dhaka|delivery charge|delivery koto)/.test(normalized)) {
    return "delivery";
  }
  if (hasPrintIntent(normalized)) return "custom_print";
  if (/(price|koto|dam|daam|koto taka|kemne dam)/.test(normalized)) return "price";
  if (/(highest size|biggest size|max size|3xl|4xl|5xl|xxxl|height.*weight|kon size)/.test(normalized)) {
    return "size";
  }
  if (
    /(ase|ache|available|hobe|stock|paowa|paoa|paben|peyechen|peyechi|ki ase|ki ache)/.test(
      normalized,
    ) ||
    /(jersey|kit|jercy|jersi)/.test(normalized)
  ) {
    return "availability";
  }
  return "unknown";
}
