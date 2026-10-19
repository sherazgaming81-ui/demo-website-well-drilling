import { NextRequest } from "next/server";
import { business } from "@/lib/site-data";
import { buildMessages } from "@/lib/ai/brain";
import { openingStep, stepFlow, wantsToBook, type FlowSession } from "@/lib/ai/booking-flow";
import { fetchCompletion, readStream, resolveAttempts, type Attempt } from "@/lib/ai/providers";
import { createThinkScrubber, readsAsNarration, sanitizeAnswer } from "@/lib/ai/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { messages: [{role, content}, ...] }  → text/event-stream
 *
 *   data: {"type":"start","provider":"Dahl Inference","model":"deepseek-ai/…"}
 *   data: {"type":"delta","text":"…"}
 *   data: {"type":"done"}
 *
 * Each model in the chain is tried in order. If the whole chain fails — or no key is
 * configured — this returns a clear 503 with a plain sentence and the number to call,
 * never an invented answer: the assistant only ever says what a model actually said.
 */

type IncomingMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 20;
const MAX_CHARS = 1500;
const MAX_TOTAL_CHARS = 12_000;
const ATTEMPT_TIMEOUT_MS = 12_000;
// A visitor must not be left staring at "typing" while we discover that every model
// is rate-limited or out of quota — past this budget the chain stops and says so.
// 8 attempts × 12s would otherwise be minutes of nothing.
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
function flowStream(step: { session: FlowSession; reply: string; progress: { stage: string; label: string } | null; booked?: { reference: string } }, key: string | null): Response {
  saveFlow(key, step.session);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(event({ type: "start", provider: "booking-flow", model: "guided" }));
      for (let index = 0; index < step.reply.length; index += 90) {
        controller.enqueue(event({ type: "delta", text: step.reply.slice(index, index + 90) }));
      }
      controller.enqueue(event({ type: "booking", stage: step.session.stage, progress: step.progress, ...(step.booked ? { booked: step.booked } : {}) }));
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
      mode: attempts.length ? "live" : "unavailable",
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
      { error: `You have sent quite a few messages. Give it ten minutes, or call ${business.phoneDisplay} and the office will take it from there.` },
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
  // A finished flow must not lock the visitor out of starting another one: once the
  // booking is done, a fresh "book me" opens a new flow instead of chatting at them.
  const canOpenFlow = !activeFlow || activeFlow.stage === "done";
  if (wantsFlow || restarting || (canOpenFlow && wantsToBook(lastUser))) {
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
    return unavailable();
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
          let streamed = "";
          const scrub = createThinkScrubber();
          try {
            await readStream(upstream.body as ReadableStream<Uint8Array>, {
              onDelta: (text) => {
                // drop the chain of thought before it reaches the browser
                const visible = scrub.push(text);
                if (!visible) return;
                streamed += visible;
                streamController.enqueue(event({ type: "delta", text: visible }));
              },
              onDone: () => {},
            });
            // A model can break the two rules that matter for this business: quoting a
            // price, and narrating its reasoning. Stream first for speed, then replace
            // the bubble with a version that never shows a figure or a thought trail.
            const clean = sanitizeAnswer(streamed);
            if (clean.changed) {
              // Stripping a price or a thought trail can leave nothing behind, and the
              // widget ignores an empty replace — which would leave the narration on
              // screen. So when nothing honest remains, say so instead.
              const shown = clean.text.trim().length >= 24 ? clean.text : UNSAID;
              streamController.enqueue(event({ type: "replace", text: shown }));
              console.warn(`[chat] sanitised ${attempt.model}: ${clean.violations.join(", ") || "formatting"}`);
            }
            streamController.enqueue(event({ type: "done", fallback: false }));
          } catch (error) {
            // The provider died mid-answer. Keep whatever was already streamed and
            // close cleanly — the widget shows the partial reply plus a note — unless
            // what got out before the break is nothing but the model's own narration,
            // in which case the honest line replaces it rather than staying on screen.
            if (readsAsNarration(streamed) || sanitizeAnswer(streamed).text.trim().length < 24) {
              streamController.enqueue(event({ type: "replace", text: UNSAID }));
            }
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
  return unavailable();
}

/**
 * The honest failure. No scripted answer is served in its place — the visitor is told
 * plainly, given the number, and left one tap away from the form, so an outage is an
 * outage and not a bot pretending to know things.
 */
/** When a reply turns out to be nothing but the model talking to itself, this is what
 *  the bubble says instead — short, Hinglish, honest about the failure. */
const UNSAID = `Is baar jawab tayyar nahi ho saka — dobara poochein, ya office ko ${business.phoneDisplay} par call kar dein. Wahi details le kar aage badha denge.`;

function unavailable(): Response {
  return Response.json(
    {
      error: `Is baar jawab tayyar nahi ho saka — answer service abhi reachable nahi hai, aur main guess nahi karunga. Dobara try karein, ${business.phoneDisplay} par call kar lein, ya is page ka inspection form bhar dein — office wahi details le kar aage badha dega.`,
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
