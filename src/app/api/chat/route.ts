import { NextRequest } from "next/server";
import { buildMessages, offlineAnswer } from "@/lib/ai/brain";
import { openingStep, stepFlow, wantsToBook, type FlowSession } from "@/lib/ai/booking-flow";
import { fetchCompletion, readStream, resolveAttempts, type Attempt } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { messages: [{role, content}, ...] }  → text/event-stream
 *
 *   data: {"type":"start","provider":"Groq","model":"llama-3.3-70b-versatile"}
 *   data: {"type":"delta","text":"Most residential wells..."}
 *   data: {"type":"done","fallback":false}
 *
 * Any failure that is not the visitor's fault (provider down, rate limit, bad
 * key) moves to the next provider; if the whole chain fails, the offline
 * knowledge base answers instead.
 */

type IncomingMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 20;
const MAX_CHARS = 1500;
const MAX_TOTAL_CHARS = 12_000;
const ATTEMPT_TIMEOUT_MS = 12_000;
// One visitor should never be left staring at "typing" while we work out that every
// provider is rate-limited or out of quota — after this budget the offline knowledge
// base answers instead. 8 attempts × 12s would otherwise be minutes.
const CHAIN_BUDGET_MS = 18_000;

/* ----------------------------- rate limiting ----------------------------- */

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30; // messages per window per IP — generous for one visitor

const globalForLimits = globalThis as typeof globalThis & {
  __chatRateLimit?: Map<string, number[]>;
  __chatBookingFlows?: Map<string, FlowSession>;
};

/* ----------------------- guided booking sessions ----------------------- */

const FLOW_TTL_MS = 30 * 60 * 1000;
const FLOW_MAX = 1000;
const flows = (globalForLimits.__chatBookingFlows ??= new Map<string, FlowSession>());

function flowKey(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null;
}

function getFlow(key: string | null): FlowSession | undefined {
  if (!key) return undefined;
  const found = flows.get(key);
  if (!found) return undefined;
  if (Date.now() - found.updatedAt > FLOW_TTL_MS) {
    flows.delete(key);
    return undefined;
  }
  return found;
}

function saveFlow(key: string | null, session: FlowSession | undefined) {
  if (!key || !session) return;
  if (session.stage === "done") {
    // keep the finished record briefly so a repeat "yes" cannot double-book
    flows.set(key, session);
  } else {
    flows.set(key, session);
  }
  if (flows.size > FLOW_MAX) {
    const cutoff = Date.now() - FLOW_TTL_MS;
    for (const [id, value] of flows) if (value.updatedAt < cutoff) flows.delete(id);
  }
}

/** One flow turn, delivered as the same SSE shape the widget already speaks. */
function flowStream(step: { session: FlowSession; reply: string; chips: string[]; progress: { stage: string; label: string } | null; booked?: { reference: string } }, key: string | null): Response {
  saveFlow(key, step.session);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(event({ type: "start", provider: "booking-flow", model: "guided" }));
      for (let index = 0; index < step.reply.length; index += 90) {
        controller.enqueue(event({ type: "delta", text: step.reply.slice(index, index + 90) }));
      }
      controller.enqueue(
        event({
          type: "booking",
          stage: step.session.stage,
          progress: step.progress,
          chips: step.chips,
          ...(step.booked ? { booked: step.booked } : {}),
        }),
      );
      controller.enqueue(event({ type: "done", fallback: false }));
      controller.close();
    },
  });
  return new Response(stream, { headers: streamHeaders("booking-flow", "guided") });
}
const hits = (globalForLimits.__chatRateLimit ??= new Map<string, number[]>());

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const times = (hits.get(ip) ?? []).filter((time) => time > cutoff);
  if (times.length >= RATE_MAX) {
    hits.set(ip, times);
    return true;
  }
  times.push(now);
  hits.set(ip, times);
  if (hits.size > 2000) {
    for (const [key, value] of hits) {
      if (!value.some((time) => time > cutoff)) hits.delete(key);
    }
  }
  return false;
}

/* -------------------------------- helpers -------------------------------- */

const encoder = new TextEncoder();
const event = (payload: unknown) => encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from some browsers omit it
  try {
    const host = new URL(origin).host;
    return host === request.headers.get("host") || host === request.headers.get("x-forwarded-host");
  } catch {
    return false;
  }
}

/** The newest visitor line, without any of the history rules — used by the flow. */
function latestUserText(body: unknown): string {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages)) return "";
  for (let index = messages.length - 1; index >= 0; index--) {
    const entry = messages[index] as { role?: unknown; content?: unknown } | null;
    if (entry && typeof entry === "object" && entry.role === "user" && typeof entry.content === "string") {
      return entry.content.trim().slice(0, MAX_CHARS);
    }
  }
  return "";
}

function parseMessages(body: unknown): IncomingMessage[] | null {
  if (!body || typeof body !== "object") return null;
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const cleaned: IncomingMessage[] = [];
  let total = 0;

  for (const entry of messages.slice(-MAX_MESSAGES)) {
    if (!entry || typeof entry !== "object") return null;
    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;
    // The visitor can only ever be a user or an assistant turn; "system" is
    // ours to set, and a client-supplied one is dropped, not honoured.
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") return null;
    const text = content.trim().slice(0, MAX_CHARS);
    if (!text) continue;
    total += text.length;
    if (total > MAX_TOTAL_CHARS) return null;
    cleaned.push({ role, content: text });
  }

  if (!cleaned.some((message) => message.role === "user")) return null;
  return cleaned;
}

/** Answer straight from the offline knowledge base, streamed like a provider. */
function offlineStream(history: IncomingMessage[]): Response {
  const answer = offlineAnswer(history);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(event({ type: "start", provider: "offline", model: "knowledge-base" }));
      // Deliver in small pieces so the widget renders it like a live answer.
      const words = answer.split(" ");
      for (let index = 0; index < words.length; index += 3) {
        controller.enqueue(event({ type: "delta", text: words.slice(index, index + 3).join(" ") + " " }));
        await new Promise((resolve) => setTimeout(resolve, 45));
      }
      controller.enqueue(event({ type: "done", fallback: true }));
      controller.close();
    },
  });
  return new Response(stream, { headers: streamHeaders("offline", "knowledge-base") });
}

function streamHeaders(provider: string, model: string): Record<string, string> {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-AI-Provider": provider,
    "X-AI-Model": sanitizeHeader(model),
  };
}

const sanitizeHeader = (value: string) => value.replace(/[^\w./:-]/g, "_").slice(0, 120);

/* --------------------------------- routes -------------------------------- */

/** Lets the owner check, without exposing keys, that the brain is wired up. */
export async function GET() {
  const attempts = resolveAttempts();
  return Response.json(
    {
      ok: true,
      providers: [...new Set(attempts.map((attempt) => attempt.provider))],
      models: attempts.map((attempt) => `${attempt.provider}/${attempt.model}`),
      mode: attempts.length ? "live" : "offline knowledge base",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "This request is not allowed." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Send the chat as JSON." }, { status: 415 });
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return Response.json(
      { error: "You've sent quite a few messages. Please call (904) 477-9809 or try again in a few minutes." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let parsed: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 60_000) return Response.json({ error: "That message is too long." }, { status: 413 });
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ error: "We couldn't read that message. Please try again." }, { status: 400 });
  }

  const sessionId = flowKey((parsed as { sessionId?: unknown }).sessionId);
  const wantsFlow = (parsed as { startBooking?: unknown }).startBooking === true;

  // The guided booking flow is deterministic and runs with no provider at all, so a
  // visitor can still book while the LLM chain is down or unconfigured. It is stateful
  // on the server and only needs the newest line, so it is handled before the history
  // rules below — a booking must not fail because of a chat-shape technicality.
  const lastUser = latestUserText(parsed);
  const activeFlow = getFlow(sessionId);

  if (activeFlow && activeFlow.stage !== "done") {
    return flowStream(await stepFlow(activeFlow, lastUser), sessionId);
  }
  const restarting = /^\s*(start over|start again)\s*$/i.test(lastUser);
  if (wantsFlow || restarting || (!activeFlow && wantsToBook(lastUser))) {
    return flowStream(openingStep(wantsFlow || restarting ? null : lastUser), sessionId);
  }

  const history = parseMessages(parsed);
  if (!history) {
    return Response.json(
      { error: "Please send a question for the assistant." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const attempts = resolveAttempts();
  if (attempts.length === 0) {
    return offlineStream(history);
  }

  const messages = buildMessages(history);
  const failures: string[] = [];
  const clientSignal = request.signal;
  const chainStartedAt = Date.now();

  for (const attempt of attempts) {
    if (clientSignal.aborted) {
      return new Response(null, { status: 499 });
    }
    if (Date.now() - chainStartedAt > CHAIN_BUDGET_MS) {
      failures.push(`chain budget of ${CHAIN_BUDGET_MS}ms exhausted after ${failures.length} attempt(s)`);
      break;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), ATTEMPT_TIMEOUT_MS);
    const relayAbort = () => controller.abort(clientSignal.reason);
    clientSignal.addEventListener("abort", relayAbort, { once: true });

    try {
      const upstream = await fetchCompletion(attempt as Attempt, messages, controller.signal);

      const stream = new ReadableStream<Uint8Array>({
        async start(streamController) {
          streamController.enqueue(
            event({ type: "start", provider: attempt.label, model: attempt.model }),
          );
          try {
            await readStream(upstream.body as ReadableStream<Uint8Array>, {
              onDelta: (text) => streamController.enqueue(event({ type: "delta", text })),
              onDone: () => {},
            });
            streamController.enqueue(event({ type: "done", fallback: false }));
          } catch (error) {
            // The provider died mid-answer. Keep whatever was already streamed
            // and close cleanly — the widget shows the partial reply plus a note.
            streamController.enqueue(
              event({ type: "error", message: "The answer was interrupted." }),
            );
            streamController.enqueue(event({ type: "done", fallback: false }));
          } finally {
            clearTimeout(timer);
            clientSignal.removeEventListener("abort", relayAbort);
            streamController.close();
          }
        },
        cancel() {
          clearTimeout(timer);
          controller.abort(new Error("client left"));
        },
      });

      return new Response(stream, { headers: streamHeaders(attempt.provider, attempt.model) });
    } catch (error) {
      clearTimeout(timer);
      clientSignal.removeEventListener("abort", relayAbort);
      const reason = error instanceof Error ? error.message : "unknown error";
      failures.push(`${attempt.provider}/${attempt.model}: ${reason}`);
      console.warn(`[chat] ${attempt.provider} failed → trying next. ${reason}`);
    }
  }

  console.error("[chat] every provider failed:\n" + failures.join("\n"));
  return offlineStream(history);
}
