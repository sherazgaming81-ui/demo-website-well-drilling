export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type Attempt = {
  provider: string;
  label: string;
  url: string;
  key: string;
  model: string;
  headers: Record<string, string>;
};

type ProviderDef = {
  label: string;
  url: string;
  keyEnv: string;
  modelEnv: string;
  defaultModels: string[];
  extraHeaders?: (key: string) => Record<string, string>;
};

/**
 * Default order is speed-first, then breadth, then free-tier depth.
 * Override entirely with AI_PROVIDER_CHAIN.
 */
export const PROVIDER_DEFS: Record<string, ProviderDef> = {
  groq: {
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    // groq retired the llama-3.3 slugs this template shipped with; gpt-oss is what
    // this key can actually call, and it answers in `content` with reasoning separate.
    defaultModels: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
  },
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    // Every ":free" slug this template shipped with is now unavailable for free
    // accounts; these two answer in plain content instead of silently returning "".
    defaultModels: [
      "google/gemma-4-26b-a4b-it:free",
      "google/gemma-4-31b-it:free",
      "apodex/apodex-1.1-mini:free",
    ],
    extraHeaders: () => ({
      // Optional but recommended by OpenRouter for attribution.
      "HTTP-Referer": process.env.SITE_URL || "https://aquiferreachllc.vercel.app",
      "X-Title": "Aquifer Reach LLC",
    }),
  },
  gemini: {
    label: "Google Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    // Verified live: 2.5-flash, flash-latest and flash-lite all exist on this key.
    defaultModels: ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"],
  },
  cerebras: {
    label: "Cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    keyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    defaultModels: ["llama-3.3-70b"],
  },
  together: {
    label: "Together AI",
    url: "https://api.together.xyz/v1/chat/completions",
    keyEnv: "TOGETHER_API_KEY",
    modelEnv: "TOGETHER_MODEL",
    defaultModels: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  },
  deepinfra: {
    label: "DeepInfra",
    url: "https://api.deepinfra.com/v1/openai/chat/completions",
    keyEnv: "DEEPINFRA_API_KEY",
    modelEnv: "DEEPINFRA_MODEL",
    defaultModels: ["meta-llama/Llama-3.3-70B-Instruct"],
  },
  custom: {
    label: "Custom endpoint",
    url: "",
    keyEnv: "CUSTOM_AI_KEY",
    modelEnv: "CUSTOM_AI_MODEL",
    defaultModels: [],
  },
};

const DEFAULT_CHAIN = "groq,openrouter,gemini,cerebras,together,deepinfra";

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

    const url = id === "custom" ? process.env.CUSTOM_AI_BASE_URL?.trim() : def.url;
    if (!url) continue;

    for (const model of modelList(def)) {
      attempts.push({
        provider: id,
        label: def.label,
        url,
        key,
        model,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          ...(def.extraHeaders ? def.extraHeaders(key) : {}),
        },
      });
    }
  }
  return attempts;
}

/** True when at least one provider is configured (used for health checks). */
export function hasLiveProvider(): boolean {
  return resolveAttempts().length > 0;
}

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onDone: () => void;
};

/**
 * Fire one streaming completion. Throws with a readable message when the
 * provider rejects the attempt, so the caller can move to the next one.
 * The caller owns the AbortSignal.
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
      // Reasoning models (gpt-oss) spend part of the budget on hidden reasoning before
      // any content appears; 600 could come back with an empty answer, which reads as
      // "the bot is broken". 1200 leaves room for both.
      max_tokens: 1200,
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
 * Providers differ slightly, so every shape is tolerated.
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
          choices?: { delta?: { content?: string }; message?: { content?: string }; text?: string }[];
        };
        const choice = parsed.choices?.[0];
        const text = choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? "";
        if (text) handlers.onDelta(text);
      } catch {
        // Ignore keep-alives and provider-specific noise.
      }
    }
  }
  handlers.onDone();
}
