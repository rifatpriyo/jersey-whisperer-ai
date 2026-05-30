import process from "node:process";

import { matchQuery } from "./ai-matcher";
import { seedProducts } from "./seed-data";

type TelegramConfig = {
  botToken?: string;
  webhookSecret?: string;
};

type TelegramMessage = {
  chatId?: number | string;
  text?: string;
};

function getEnvValue(env: unknown, key: string): string | undefined {
  if (env && typeof env === "object" && key in env) {
    const value = (env as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const value = process.env[key];
  return value?.trim() || undefined;
}

function getTelegramConfig(env: unknown): TelegramConfig {
  return {
    botToken: getEnvValue(env, "TELEGRAM_BOT_TOKEN"),
    webhookSecret: getEnvValue(env, "TELEGRAM_WEBHOOK_SECRET"),
  };
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

function normalizeTelegramPayload(payload: any): TelegramMessage {
  const message =
    payload?.message ??
    payload?.edited_message ??
    payload?.channel_post ??
    payload?.callback_query?.message;
  const callbackText = payload?.callback_query?.data;

  return {
    chatId: message?.chat?.id,
    text: typeof message?.text === "string" ? message.text : callbackText,
  };
}

function isAuthorizedWebhook(request: Request, secret?: string) {
  if (!secret) return true;

  const received = request.headers.get("x-telegram-bot-api-secret-token");
  return received === secret;
}

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram sendMessage failed (${response.status}): ${errorText}`);
  }
}

export async function handleTelegramWebhook(request: Request, env: unknown) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const config = getTelegramConfig(env);
  if (!config.botToken) {
    return json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 500 });
  }

  if (!isAuthorizedWebhook(request, config.webhookSecret)) {
    return json({ ok: false, error: "Invalid Telegram webhook secret" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const incoming = normalizeTelegramPayload(payload);
  if (!incoming.chatId || !incoming.text) {
    return json({
      ok: true,
      ignored: true,
      reason: "Telegram update did not contain a text message",
    });
  }

  const result = matchQuery(incoming.text, seedProducts);
  await sendTelegramMessage(config.botToken, incoming.chatId, result.reply);

  return json({
    ok: true,
    chatId: incoming.chatId,
    reply: result.reply,
    confidence: result.confidence,
    source: result.response_source,
  });
}
