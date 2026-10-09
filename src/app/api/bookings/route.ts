import { NextRequest, NextResponse } from "next/server";
import { createBooking } from "@/lib/booking-store";
import type { BookingFields } from "@/lib/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { service, zip, preferredDate, timePreference, fullName, email, phone,
 *        notes, consent, website, requestId }
 *
 * All rules live in src/lib/booking-store.ts so the chat assistant books through
 * exactly the same path as this form. This file only handles the HTTP layer.
 */
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

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

  const result = await createBooking(fields);
  if (!result.ok) {
    return json(
      { error: result.error, ...(result.errors ? { errors: result.errors } : {}) },
      result.status,
      result.status === 429 ? { "Retry-After": String(result.retryAfterSeconds ?? 3600) } : {},
    );
  }

  return json({ ok: true, reference: result.reference }, result.status);
}
