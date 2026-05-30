import process from "node:process";

import { matchQuery } from "./ai-matcher";
import { seedProducts } from "./seed-data";

type OpenWaConfig = {
  apiBaseUrl?: string;
  apiKey?: string;
  sessionId?: string;
  webhookSecret?: string;
};

type IncomingOpenWaMessage = {
  event?: string;
  sessionId?: string;
  chatId?: string;
  text?: string;
  fromMe?: boolean;
};

function getEnvValue(env: unknown, key: string): string | undefined {
  if (env && typeof env === "object" && key in env) {
    const value = (env as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const value = process.env[key];
  return value?.trim() || undefined;
}

function getOpenWaConfig(env: unknown): OpenWaConfig {
  return {
    apiBaseUrl: getEnvValue(env, "OPENWA_API_BASE_URL") || "http://localhost:2785/api",
    apiKey: getEnvValue(env, "OPENWA_API_KEY"),
    sessionId: getEnvValue(env, "OPENWA_SESSION_ID"),
    webhookSecret: getEnvValue(env, "OPENWA_WEBHOOK_SECRET"),
  };
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function normalizeOpenWaPayload(payload: any): IncomingOpenWaMessage {
  const data = payload?.data ?? payload?.payload ?? {};
  const message = data?.message ?? payload?.message ?? data;

  return {
    event: pickString(payload?.event, data?.event),
    sessionId: pickString(payload?.sessionId, data?.sessionId, message?.sessionId),
    chatId: pickString(
      payload?.chatId,
      data?.chatId,
      data?.from,
      message?.chatId,
      message?.from,
      message?.to,
    ),
    text: pickString(
      payload?.text,
      payload?.body,
      data?.text,
      data?.body,
      message?.text,
      message?.body,
      message?.caption,
    ),
    fromMe: pickBoolean(payload?.fromMe, data?.fromMe, message?.fromMe),
  };
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyWebhookSignature(request: Request, body: string, secret?: string) {
  if (!secret) return true;

  const signature = pickString(
    request.headers.get("x-openwa-signature"),
    request.headers.get("x-signature"),
    request.headers.get("x-hub-signature-256"),
  );
  if (!signature) return false;

  const expectedHex = await hmacSha256Hex(secret, body);
  const receivedHex = signature.replace(/^sha256=/i, "");
  return timingSafeEqual(receivedHex.toLowerCase(), expectedHex);
}

async function sendOpenWaText(config: OpenWaConfig, sessionId: string, chatId: string, text: string) {
  if (!config.apiKey) {
    throw new Error("OPENWA_API_KEY is not configured");
  }

  const baseUrl = config.apiBaseUrl?.replace(/\/+$/, "") || "http://localhost:2785/api";
  const response = await fetch(
    `${baseUrl}/sessions/${encodeURIComponent(sessionId)}/messages/send-text`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.apiKey,
      },
      body: JSON.stringify({ chatId, text }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenWA send failed (${response.status}): ${errorText}`);
  }
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  });
}

export async function handleOpenWaWebhook(request: Request, env: unknown) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const config = getOpenWaConfig(env);
  const rawBody = await request.text();

  if (!(await verifyWebhookSignature(request, rawBody, config.webhookSecret))) {
    return json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const incoming = normalizeOpenWaPayload(payload);
  if (incoming.fromMe) {
    return json({ ok: true, ignored: true, reason: "Message was sent by this session" });
  }

  if (incoming.event && incoming.event !== "message.received") {
    return json({ ok: true, ignored: true, reason: `Ignored event ${incoming.event}` });
  }

  if (!incoming.chatId || !incoming.text) {
    return json({
      ok: true,
      ignored: true,
      reason: "Webhook payload did not include a text message with chatId/from",
    });
  }

  const result = matchQuery(incoming.text, seedProducts);
  const sessionId = incoming.sessionId || config.sessionId;
  if (!sessionId) {
    return json(
      { ok: false, error: "OpenWA session ID missing from payload and OPENWA_SESSION_ID" },
      { status: 500 },
    );
  }

  await sendOpenWaText(config, sessionId, incoming.chatId, result.reply);

  return json({
    ok: true,
    event: incoming.event ?? "message.received",
    chatId: incoming.chatId,
    sessionId,
    reply: result.reply,
    confidence: result.confidence,
    source: result.response_source,
  });
}
