import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { validateBooking, type BookingFields } from "@/lib/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo storage: no database.
 * Requests live in this process only, so nothing needs to be provisioned to run
 * the site. Entries are kept for the dedupe/rate-limit window and then pruned.
 */
type StoredBooking = { id: string; email: string; createdAt: number };

const MAX_ENTRIES = 500;
const WINDOW_MS = 60 * 60 * 1000; // one hour, as the rate limit message promises
const MAX_PER_EMAIL_PER_WINDOW = 5;

const globalForStore = globalThis as typeof globalThis & {
  __demoBookingsByRequest?: Map<string, StoredBooking>;
  __demoBookingsByEmail?: Map<string, number[]>;
};

const byRequestId = (globalForStore.__demoBookingsByRequest ??= new Map<string, StoredBooking>());
const byEmail = (globalForStore.__demoBookingsByEmail ??= new Map<string, number[]>());

function prune() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, times] of byEmail) {
    const kept = times.filter((time) => time > cutoff);
    if (kept.length) byEmail.set(key, kept);
    else byEmail.delete(key);
  }
  while (byRequestId.size > MAX_ENTRIES) {
    const oldest = byRequestId.keys().next().value;
    if (oldest === undefined) break;
    byRequestId.delete(oldest);
  }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

const confirmation = (id: string, status = 200) =>
  json({ ok: true, reference: `AQ-${id.slice(0, 8).toUpperCase()}` }, status);

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== request.headers.get("host") && originHost !== request.headers.get("x-forwarded-host")) {
        return json({ error: "This request is not allowed." }, 403);
      }
    } catch {
      return json({ error: "Invalid request origin." }, 403);
    }
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Please submit the booking form as JSON." }, 415);
  }

  let fields: BookingFields;
  try {
    const body = await request.text();
    if (body.length > 12_000) return json({ error: "Your request is too large." }, 413);
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid form");
    fields = parsed as BookingFields;
  } catch {
    return json({ error: "We couldn't read the form. Please try again." }, 400);
  }

  if (typeof fields.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fields.requestId)) {
    return json({ error: "Please reopen the booking form and try again." }, 400);
  }

  if (fields.website) return json({ error: "We couldn't accept this request." }, 400);

  const errors = validateBooking(fields);
  if (Object.keys(errors).length) return json({ error: "Please check the highlighted fields.", errors }, 422);

  prune();

  // Idempotent resubmits get the same reference back.
  const existing = byRequestId.get(fields.requestId);
  if (existing) return confirmation(existing.id);

  const email = fields.email.trim().toLowerCase();
  const recent = (byEmail.get(email) ?? []).filter((time) => time > Date.now() - WINDOW_MS);
  if (recent.length >= MAX_PER_EMAIL_PER_WINDOW) {
    return json(
      { error: "You've already sent several requests. Please wait an hour before trying again." },
      429,
      { "Retry-After": "3600" },
    );
  }

  const id = randomUUID();
  byRequestId.set(fields.requestId, { id, email, createdAt: Date.now() });
  recent.push(Date.now());
  byEmail.set(email, recent);

  return confirmation(id, 201);
}
