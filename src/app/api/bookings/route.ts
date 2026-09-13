import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { demoBookings } from "@/db/schema";
import { validateBooking, type BookingFields } from "@/lib/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const confirmation = (id: string, status = 200) => NextResponse.json({ ok: true, reference: `AQ-${id.slice(0, 8).toUpperCase()}` }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== request.headers.get("host") && originHost !== request.headers.get("x-forwarded-host")) {
        return NextResponse.json({ error: "This request is not allowed." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Please submit the booking form as JSON." }, { status: 415 });
  }
  let fields: BookingFields;
  try {
    const body = await request.text();
    if (body.length > 12_000) return NextResponse.json({ error: "Your request is too large." }, { status: 413 });
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid form");
    fields = parsed as BookingFields;
  } catch {
    return NextResponse.json({ error: "We couldn't read the form. Please try again." }, { status: 400 });
  }
  const errors = validateBooking(fields);
  if (typeof fields.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fields.requestId)) {
    return NextResponse.json({ error: "Please reopen the booking form and try again." }, { status: 400 });
  }
  if (fields.website) return NextResponse.json({ error: "We couldn't accept this request." }, { status: 400 });
  if (Object.keys(errors).length) return NextResponse.json({ error: "Please check the highlighted fields.", errors }, { status: 422 });

  try {
    const [existing] = await db.select({ id: demoBookings.id }).from(demoBookings).where(eq(demoBookings.requestId, fields.requestId)).limit(1);
    if (existing) return confirmation(existing.id);
    const email = fields.email.trim().toLowerCase();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await db.select({ total: count() }).from(demoBookings).where(and(eq(demoBookings.email, email), gte(demoBookings.createdAt, oneHourAgo)));
    if (recent.total >= 5) {
      return NextResponse.json({ error: "You've already sent several requests. Please wait an hour before trying again." }, { status: 429, headers: { "Retry-After": "3600" } });
    }
    const [booking] = await db.insert(demoBookings).values({
      requestId: fields.requestId,
      fullName: fields.fullName.trim(),
      email,
      phone: fields.phone.trim(),
      zip: fields.zip.trim(),
      service: fields.service,
      preferredDate: fields.preferredDate,
      timePreference: fields.timePreference,
      notes: fields.notes.trim(),
      consent: true,
    }).onConflictDoNothing({ target: demoBookings.requestId }).returning({ id: demoBookings.id });
    if (booking) return confirmation(booking.id, 201);
    const [duplicate] = await db.select({ id: demoBookings.id }).from(demoBookings).where(eq(demoBookings.requestId, fields.requestId)).limit(1);
    if (duplicate) return confirmation(duplicate.id);
    throw new Error("Booking insert did not return a record");
  } catch (error) {
    console.error("Unable to save demo request:", error instanceof Error ? error.message : "Database error");
    return NextResponse.json({ error: "We couldn't save your request just now. Your details are still here—please try again shortly." }, { status: 503 });
  }
}
