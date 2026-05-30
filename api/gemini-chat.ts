import type {
  GeminiChatErrorResponse,
  GeminiChatRequest,
  GeminiChatSuccessResponse,
} from "../src/lib/query-sim";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const REQUEST_TIMEOUT_MS = 15000;

const SYSTEM_INSTRUCTION = [
  "You are JerseyBecho AI, a Bangladesh jersey shop sales assistant.",
  "Reply naturally in Bangla, Banglish, or English based on the customer's language.",
  "Behave like a real step-by-step jersey shop sales operator.",
  "Use recentTurns only to understand the conversation flow.",
  "Use only the provided inventory context, shop policy, conversation context, and match result for factual claims.",
  "Never invent stock, price, product, size, supplier, source country, or restock date.",
  "Inventory matching already happened before you were called. Respect matchResult and missing_fields.",
  "If matchResult.missing_fields has any value, ask one clear follow-up question instead of guessing.",
  "Do not guess missing size, edition, kit type, or team.",
  "If conversation context provides previous team, edition, size, kit, or font/print, use it.",
  "If product is missing, say it is not currently in inventory and ask for clarification.",
  "If multiple products match, ask clarification.",
  "For font/print questions, answer only from inventory context or shop policy.",
  "If the query is a general shop policy question, answer only from shop policy.",
  'For "miau" or "meow", reply exactly: "Halum \u{1F604} Jersey lagbe naki sir?"',
  "Keep replies short and seller-like.",
].join(" ");

interface GeminiTextPart {
  text?: string;
}

interface GeminiUpstreamResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiTextPart[];
    };
  }>;
  error?: {
    message?: string;
  };
}

function jsonResponse(body: GeminiChatSuccessResponse | GeminiChatErrorResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function isGeminiChatRequest(value: unknown): value is GeminiChatRequest {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.message === "string" &&
    Array.isArray(payload.inventoryContext) &&
    payload.shopPolicy !== null &&
    typeof payload.shopPolicy === "object" &&
    payload.conversationContext !== null &&
    typeof payload.conversationContext === "object" &&
    payload.matchResult !== null &&
    typeof payload.matchResult === "object" &&
    Array.isArray(payload.recentTurns)
  );
}

function extractGeminiText(payload: GeminiUpstreamResponse | null): string | undefined {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return undefined;

  const text = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();

  return text || undefined;
}

export const config = {
  runtime: "nodejs",
  maxDuration: 15,
};

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    if (!isGeminiChatRequest(payload)) {
      return jsonResponse(
        {
          error: "Invalid request body.",
          details:
            "Expected message, inventoryContext, shopPolicy, conversationContext, matchResult, and recentTurns.",
        },
        400,
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        {
          error: "Missing GEMINI_API_KEY",
        },
        500,
      );
    }

    const {
      message,
      inventoryContext,
      shopPolicy,
      conversationContext,
      matchResult,
      recentTurns,
    } = payload;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const upstreamResponse = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: `Customer message:\n${message}` },
                {
                  text: `Inventory context JSON:\n${JSON.stringify(inventoryContext, null, 2)}`,
                },
                {
                  text: `Shop policy JSON:\n${JSON.stringify(shopPolicy, null, 2)}`,
                },
                {
                  text: `Conversation context JSON:\n${JSON.stringify(conversationContext, null, 2)}`,
                },
                {
                  text: `Recent conversation turns JSON:\n${JSON.stringify(recentTurns.slice(-6), null, 2)}`,
                },
                {
                  text: `Rule-based match result JSON:\n${JSON.stringify(matchResult, null, 2)}`,
                },
              ],
            },
          ],
        }),
      });

      const rawText = await upstreamResponse.text();
      let upstreamPayload: GeminiUpstreamResponse | null = null;

      try {
        upstreamPayload = rawText ? JSON.parse(rawText) : null;
      } catch {
        upstreamPayload = null;
      }

      if (!upstreamResponse.ok) {
        return jsonResponse(
          {
            error: "Gemini API request failed.",
            details:
              upstreamPayload?.error?.message ||
              rawText ||
              `Gemini returned status ${upstreamResponse.status}.`,
          },
          502,
        );
      }

      const reply = extractGeminiText(upstreamPayload);
      if (!reply) {
        return jsonResponse(
          {
            error: "Gemini API returned no usable reply text.",
          },
          502,
        );
      }

      return jsonResponse({
        reply,
        source: "Gemini AI",
        model: GEMINI_MODEL,
      });
    } catch (error) {
      const details =
        error instanceof Error ? error.message : "Network error while calling Gemini API.";
      return jsonResponse(
        {
          error: "Gemini API network failure.",
          details,
        },
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
