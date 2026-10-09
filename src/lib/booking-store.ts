import { randomUUID } from "node:crypto";
import { validateBooking, type BookingErrors, type BookingFields } from "@/lib/booking";
import { bookingServices } from "@/lib/site-data";

/**
 * One booking store, two front doors: POST /api/bookings (the estimate dialog) and
 * the chat assistant's guided booking flow. Both call createBooking, so pricing-free
 * copy, validation, throttling, idempotency and the optional webhook forward can
 * never drift apart between the two.
 *
 * Storage is process memory only — see the README note. It intentionally never reads
 * an env var at import time, so a missing variable cannot break the build the way
 * DATABASE_URL once did.
 */
type StoredBooking = { id: string; email: string; createdAt: number };

const MAX_ENTRIES = 500;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_EMAIL_PER_WINDOW = 5;

const globalForStore = globalThis as typeof globalThis & {
  __leadStoreByRequest?: Map<string, StoredBooking>;
  __leadStoreByEmail?: Map<string, number[]>;
};

const byRequestId = (globalForStore.__leadStoreByRequest ??= new Map<string, StoredBooking>());
const byEmail = (globalForStore.__leadStoreByEmail ??= new Map<string, number[]>());

export type BookingOutcome =
  | { ok: true; reference: string; created: boolean; status: 200 | 201 }
  | { ok: false; status: 400 | 422 | 429; error: string; errors?: BookingErrors; retryAfterSeconds?: number };

const referenceFor = (id: string) => `AQ-${id.slice(0, 8).toUpperCase()}`;

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

/** True when the owner has wired a real inbox, so /api/health can report it. */
export const leadForwardingEnabled = () => Boolean(process.env.LEAD_WEBHOOK_URL?.trim());

async function forward(lead: Record<string, unknown>) {
  const webhook = process.env.LEAD_WEBHOOK_URL?.trim();
  if (!webhook) return;
  // Fire and forget: the visitor already has a reference either way.
  void fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
    signal: AbortSignal.timeout(5000),
  }).catch((cause) => console.error("Lead forward failed:", cause instanceof Error ? cause.message : cause));
}

/**
 * Validates, de-duplicates, throttles, stores and (optionally) forwards.
 * `fields.website` is the honeypot; a bogus/missing requestId is rejected.
 */
export async function createBooking(input: Partial<BookingFields>, requestIdHint?: string): Promise<BookingOutcome> {
  const fields = { ...input } as BookingFields;

  if (typeof fields.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fields.requestId)) {
    return { ok: false, status: 400, error: "Please reopen the booking form and try again." };
  }
  if (fields.website) return { ok: false, status: 400, error: "We couldn't accept this request." };

  const errors = validateBooking(fields);
  if (Object.keys(errors).length) {
    return { ok: false, status: 422, error: "Please check the highlighted fields.", errors };
  }

  prune();

  const existing = byRequestId.get(fields.requestId);
  if (existing) return { ok: true, reference: referenceFor(existing.id), created: false, status: 200 };

  const email = fields.email.trim().toLowerCase();
  const recent = (byEmail.get(email) ?? []).filter((time) => time > Date.now() - WINDOW_MS);
  if (recent.length >= MAX_PER_EMAIL_PER_WINDOW) {
    return {
      ok: false,
      status: 429,
      error: "You've already sent several requests. Please wait an hour before trying again.",
      retryAfterSeconds: 3600,
    };
  }

  const id = randomUUID();
  byRequestId.set(fields.requestId, { id, email, createdAt: Date.now() });
  recent.push(Date.now());
  byEmail.set(email, recent);

  await forward({
    reference: referenceFor(id),
    receivedAt: new Date().toISOString(),
    fullName: fields.fullName.trim(),
    email,
    phone: fields.phone.trim(),
    zip: fields.zip.trim(),
    service: fields.service,
    serviceLabel: bookingServices.find((item) => item.value === fields.service)?.label ?? fields.service,
    preferredDate: fields.preferredDate,
    timePreference: fields.timePreference,
    notes: fields.notes.trim(),
    source: "aquifer-reach-website",
  });

  return { ok: true, reference: referenceFor(id), created: true, status: 201 };
}

/** Used by the chat flow so a retry of the same conversation cannot double-book. */
export function newRequestId() {
  return randomUUID();
}
