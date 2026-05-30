import type {
  GroqChatErrorResponse,
  GroqChatRequest,
  GroqChatSuccessResponse,
} from "../src/lib/query-sim";

const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 15000;

const SYSTEM_INSTRUCTION = [
  "You are JerseyBecho AI, a Bangladesh jersey shop sales assistant.",
  "The rule-based matcher already extracted safe inventory context.",
  "Your job is to write the final customer-facing reply naturally in Bangla/Banglish/English.",
  "Use only the provided inventory context and shop policy.",
  "Never invent product, stock, price, size, supplier, source country, or restock date.",
  "If required information is missing, ask one short follow-up question.",
  "If product is not in inventory, say it is not currently available.",
  'If user asks a funny or absurd word like "miau" or "meow", reply exactly: "Halum \u{1F604} Jersey lagbe naki sir?"',
  "Keep replies short and seller-like.",
].join(" ");

interface GroqUpstreamResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

function jsonResponse(body: GroqChatSuccessResponse | GroqChatErrorResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function isGroqChatRequest(value: unknown): value is GroqChatRequest {
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
    typeof payload.matchResult === "object"
  );
}

function extractGroqText(payload: GroqUpstreamResponse | null): string | undefined {
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : undefined;
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

    if (!isGroqChatRequest(payload)) {
      return jsonResponse(
        {
          error: "Invalid request body.",
          details:
            "Expected message, inventoryContext, shopPolicy, conversationContext, and matchResult.",
        },
        400,
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: "Missing GROQ_API_KEY" }, 500);
    }

    const { message, inventoryContext, shopPolicy, conversationContext, matchResult } = payload;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const upstreamResponse = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: SYSTEM_INSTRUCTION,
            },
            {
              role: "user",
              content: [
                `Customer message:\n${message}`,
                `Inventory context JSON:\n${JSON.stringify(inventoryContext, null, 2)}`,
                `Shop policy JSON:\n${JSON.stringify(shopPolicy, null, 2)}`,
                `Conversation context JSON:\n${JSON.stringify(conversationContext, null, 2)}`,
                `Rule-based match result JSON:\n${JSON.stringify(matchResult, null, 2)}`,
              ].join("\n\n"),
            },
          ],
        }),
      });

      const rawText = await upstreamResponse.text();
      let upstreamPayload: GroqUpstreamResponse | null = null;

      try {
        upstreamPayload = rawText ? (JSON.parse(rawText) as GroqUpstreamResponse) : null;
      } catch {
        upstreamPayload = null;
      }

      if (!upstreamResponse.ok) {
        return jsonResponse(
          {
            error: "Groq API request failed.",
            details:
              upstreamPayload?.error?.message ||
              rawText ||
              `Groq returned status ${upstreamResponse.status}.`,
          },
          502,
        );
      }

      const reply = extractGroqText(upstreamPayload);
      if (!reply) {
        return jsonResponse({ error: "Groq API returned no usable reply text." }, 502);
      }

      return jsonResponse({
        reply,
        source: "Groq AI",
        model: GROQ_MODEL,
      });
    } catch (error) {
      const details =
        error instanceof Error ? error.message : "Network error while calling Groq API.";
      return jsonResponse(
        {
          error: "Groq API network failure.",
          details,
        },
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
