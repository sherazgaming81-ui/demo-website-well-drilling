export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type Attempt = {
  provider: string;
  label: string;
  url: string;
  key: string;
  model: string;
  headers: Record<string, string>;
  /** Merged into the request body — used to turn the model's chain of thought off. */
  extraBody: Record<string, unknown>;
};

type ProviderDef = {
  label: string;
  /** Overridable so a self-hosted or proxied gateway can be used without a code change. */
  baseEnv: string;
  defaultBase: string;
  keyEnv: string;
  modelEnv: string;
  defaultModels: string[];
  extraBody?: () => Record<string, unknown>;
};

/**
 * One brain: the Dahl Inference gateway (OpenAI-compatible, free tier — the first
 * 100M tokens). The other providers this template shipped with (Groq, OpenRouter,
 * Gemini, Cerebras, Together, DeepInfra) are gone: every slug they defaulted to was
 * retired or paywalled, so every question burned 8 dead attempts before falling back.
 *
 * The three models below are what GET https://inference.dahl.global/v1/models returns,
 * in priority order — deepseek first, as asked. Because they are tried in sequence,
 * one model being overloaded is still not a dead end.
 */
export const PROVIDER_DEFS: Record<string, ProviderDef> = {
  dahl: {
    label: "Dahl Inference",
    baseEnv: "DAHL_BASE_URL",
    defaultBase: "https://inference.dahl.global/v1",
    keyEnv: "DAHL_API_KEY",
    modelEnv: "DAHL_MODEL",
    defaultModels: [
      "deepseek-ai/DeepSeek-V4-Flash-0731",
      "MiniMaxAI/MiniMax-M2.7",
      "zai-org/GLM-5.3-Flash",
    ],
    extraBody: () => ({
      // Verified against the live API: with this flag the response has no `reasoning`
      // field at all, so nothing can leak into the chat and no tokens are wasted on it.
      chat_template_kwargs: { thinking: false },
      enable_thinking: false,
    }),
  },
};

const DEFAULT_CHAIN = "dahl";

function modelList(def: ProviderDef): string[] {
  const raw = process.env[def.modelEnv];
  if (raw && raw.trim()) {
    return raw.split(",").map((model) => model.trim()).filter(Boolean);
  }
  return def.defaultModels;
}

/** Every (provider × model) pair we are able to try, in priority order. */
export function resolveAttempts(): Attempt[] {
  const chain = (process.env.AI_PROVIDER_CHAIN || DEFAULT_CHAIN)
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  const attempts: Attempt[] = [];
  for (const id of chain) {
    const def = PROVIDER_DEFS[id];
    if (!def) continue;

    const key = process.env[def.keyEnv]?.trim();
    if (!key) continue;

    const base = (process.env[def.baseEnv]?.trim() || def.defaultBase).replace(/\/+$/, "");
    if (!base) continue;

    for (const model of modelList(def)) {
      attempts.push({
        provider: id,
        label: def.label,
        url: `${base}/chat/completions`,
        key,
        model,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        extraBody: def.extraBody ? def.extraBody() : {},
      });
    }
  }
  return attempts;
}

/** True when at least one model is configured (used for health checks). */
export function hasLiveProvider(): boolean {
  return resolveAttempts().length > 0;
}

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onDone: () => void;
};

/**
 * Fire one streaming completion. Throws with a readable message when the gateway
 * rejects the attempt, so the caller can move to the next model. The caller owns
 * the AbortSignal.
 */
export async function fetchCompletion(
  attempt: Attempt,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<Response> {
  const response = await fetch(attempt.url, {
    method: "POST",
    headers: attempt.headers,
    signal,
    body: JSON.stringify({
      model: attempt.model,
      messages,
      stream: true,
      temperature: 0.4,
      // The gateway spends this budget on `content` only (thinking is disabled above),
      // so ~1200 tokens is far more than an answer needs while still bounding cost.
      max_tokens: 1200,
      ...attempt.extraBody,
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${detail ? ` — ${detail.slice(0, 180)}` : ""}`);
  }
  return response;
}

/**
 * Parse an OpenAI-style SSE stream and hand each text delta to the caller.
 *
 * Only `delta.content` is ever surfaced. `delta.reasoning`, `reasoning_content`,
 * and `thinking` are deliberately ignored — that is the model's chain of thought and
 * a visitor must never see it, even if a gateway starts sending it again.
 */
export async function readStream(
  body: ReadableStream<Uint8Array>,
  handlers: StreamHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n");
    while (boundary !== -1) {
      const line = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 1);
      boundary = buffer.indexOf("\n");

      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: Record<string, unknown>; message?: Record<string, unknown> }[];
        };
        const choice = parsed.choices?.[0];
        const text = (choice?.delta?.content ?? choice?.message?.content ?? "") as unknown;
        if (typeof text === "string" && text) handlers.onDelta(text);
      } catch {
        // Ignore keep-alives and provider-specific noise.
      }
    }
  }
  handlers.onDone();
}
