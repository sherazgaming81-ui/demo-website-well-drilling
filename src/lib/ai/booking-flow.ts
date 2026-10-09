import { dateBounds, formatDate, validateBooking, type BookingErrors, type BookingFields } from "@/lib/booking";
import { bookingServices, business } from "@/lib/site-data";
import { createBooking, newRequestId } from "@/lib/booking-store";

/**
 * The part that makes this a calling agent rather than a FAQ box: it asks for one
 * thing at a time, validates each answer with the SAME rules the estimate form
 * uses, reads the whole request back, and only then writes it through
 * createBooking(). No LLM is involved in this path on purpose — a booking must not
 * depend on a model being available, and free-text answers must not be trusted to
 * a parser that can hallucinate a phone number.
 */

export type FlowStage = "service" | "zip" | "date" | "time" | "name" | "email" | "phone" | "notes" | "consent" | "confirm" | "done";

export type FlowSession = {
  stage: FlowStage;
  fields: Partial<BookingFields> & { website: string };
  requestId?: string;
  reasks: number;
  updatedAt: number;
  reference?: string;
};

export type FlowStep = {
  session: FlowSession;
  reply: string;
  chips: string[];
  progress: { stage: FlowStage | "done"; label: string } | null;
  booked?: { reference: string };
};

const ORDER: FlowStage[] = ["service", "zip", "date", "time", "name", "email", "phone", "notes", "consent", "confirm"];

const LABEL: Record<FlowStage, string> = {
  service: "the service",
  zip: "your property ZIP code",
  date: "a preferred date",
  time: "the best time to connect",
  name: "your name",
  email: "your email",
  phone: "your phone number",
  notes: "anything else we should know",
  consent: "your OK to store this",
  confirm: "your confirmation",
  done: "done",
};

const HOUR_OPTIONS = ["Morning · 8–12", "Afternoon · 12–5", "I'm flexible"];

/** Cheap intent check so free chat can offer to start booking. */
export function wantsToBook(text: string): boolean {
  return /\b(book|booking|schedule|book me|reserve|start|get started|request an? estimate|free estimate|quote)\b/i.test(text);
}

export function startFlow(seed?: string | null): FlowSession {
  const session: FlowSession = { stage: "service", fields: { website: "" }, reasks: 0, updatedAt: Date.now() };
  if (seed) {
    const service = matchService(seed);
    if (service) {
      session.fields.service = service;
      session.stage = "zip";
    }
  }
  return session;
}

export function progressOf(session: FlowSession) {
  if (session.stage === "done") return { stage: "done" as const, label: "Sent to the office" };
  const index = ORDER.indexOf(session.stage);
  return { stage: session.stage, label: `Step ${index + 1} of ${ORDER.length} · ${LABEL[session.stage]}` };
}

function matchService(text: string): string | undefined {
  const t = text.toLowerCase();
  const direct = bookingServices.find((option) => t.includes(option.value) || t.includes(option.label.toLowerCase()));
  if (direct) return direct.value;
  if (/\b(not sure|unsure|idk|no idea|advice|help me decide|both|any|depends)\b/.test(t)) return "not-sure";
  if (/rock/.test(t)) return "rock-wells";
  if (/screen|sandy/.test(t)) return "screen-wells";
  if (/artesian|pressur/.test(t)) return "artesian-wells";
  if (/salt|pepper|irrigat|livestock|cattle/.test(t)) return "salt-pepper-wells";
  if (/pump|pressure|repair|replace/.test(t)) return "pump-installation";
  if (/abandon|seal|old well|unused/.test(t)) return "well-abandonment";
  return undefined;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (days: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d; };
const nextWeekday = (target: number) => { const d = addDays(1); while (d.getUTCDay() !== target) d.setUTCDate(d.getUTCDate() + 1); return d; };

/** Only unambiguous shapes: ISO, "tomorrow", "in 5 days", "next week", month/day,
 *  "Sep 20" / "20 Sep", and weekday names. Anything else is re-asked, not guessed. */
export function parseDate(text: string): string | null {
  const t = text.toLowerCase().replace(/(\d)(st|nd|rd|th)/g, "$1").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (t === "tomorrow" || t === "tmrw" || t === "tmr") return iso(addDays(1));
  if (t === "today") return null; // tomorrow is the earliest we can honour
  if (t === "next week") return iso(addDays(7));
  const inDays = t.match(/^in (\d{1,2}) days?$/);
  if (inDays) return iso(addDays(Number(inDays[1])));
  const slash = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (slash) {
    const month = Number(slash[1]); const day = Number(slash[2]);
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : new Date().getUTCFullYear();
    return build(year, month, day);
  }
  for (let i = 0; i < 12; i++) {
    const name = MONTHS[i];
    if (t.includes(name)) {
      const digits = [...t.matchAll(/\d{1,2}/g)].map((m) => Number(m[0])).filter((n) => n >= 1 && n <= 31);
      if (!digits.length) return null;
      const yearHint = t.match(/20\d\d/)?.[0];
      return build(yearHint ? Number(yearHint) : new Date().getUTCFullYear(), i + 1, digits[0]);
    }
  }
  for (let d = 0; d < 7; d++) {
    if (t.includes(WEEKDAYS[d])) return iso(nextWeekday(d));
  }
  return null;
}

function build(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  // A date already past means they meant next year's edition of it.
  const { min } = dateBounds();
  if (iso(candidate) < min) return iso(new Date(Date.UTC(year + 1, month - 1, day)));
  return iso(candidate);
}

function parseTime(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(flexible|any ?time|whatever|doesn.t matter|no preference|both|either)\b/.test(t)) return "flexible";
  if (/\b(morning|a\.?m\.?|early|before noon|9|10|11)\b/.test(t) && !/afternoon|p\.m/.test(t)) return "morning";
  if (/\b(afternoon|p\.?m\.?|noon|after 12|1|2|3|4)\b/.test(t)) return "afternoon";
  return null;
}

function parseZip(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 5) return digits;
  if (digits.length > 5 && /^\d{5}/.test(digits)) return digits.slice(0, 5);
  return null;
}

function parseName(text: string): string | null {
  const clean = text.trim().replace(/\s+/g, " ").replace(/^(my name is|it.s|this is|i am|im)\s+/i, "");
  return clean.length >= 2 && clean.length <= 100 ? clean : null;
}

function parseEmail(text: string): string | null {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

function parsePhone(text: string): string | null {
  const cleaned = text.replace(/[^\d+().\s-]/g, "").trim();
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15 || cleaned.length > 32) return null;
  return cleaned;
}

function parseConsent(text: string): boolean | null {
  const t = text.toLowerCase().trim();
  if (/^(y|yes|yeah|yep|sure|ok|okay|agree|i agree|go ahead|do it|send it|fine|yes please)\b/.test(t) && !/\b(no|not|don.t|never)\b/.test(t)) return true;
  if (/^(n|no|nope|don.t|do not|cancel|stop|never)\b/.test(t)) return false;
  return null;
}

export function isCancel(text: string): boolean {
  return /^\s*(cancel|stop|quit|never ?mind|forget it|back out|exit)\b/i.test(text);
}

const errorFor = (fields: Partial<BookingFields>, key: keyof BookingFields): string | undefined =>
  validateBooking({ website: "", ...fields } as BookingFields)[key];

function ask(stage: FlowStage, extra = ""): string {
  switch (stage) {
    case "service":
      return `Sure — I can start that for you. What are you after: a new rock well, a screen well, an artesian well, a salt & pepper well, pump work, or closing an old well? If you're not sure, say so and we'll figure it out together.${extra}`;
    case "zip":
      return "What's the ZIP code of the property? That's how we confirm the crew actually covers your area.";
    case "date": {
      const { min, max } = dateBounds();
      return `Got it. What date suits you? We can look at anything from tomorrow through ${formatDate(max)} — "tomorrow", "next Friday" or "Sep 20" all work.`;
    }
    case "time":
      return "And when is best to connect — morning, afternoon, or are you flexible?";
    case "name":
      return "Thanks. What name should the office ask for when they call?";
    case "email":
      return "Your email address, please — that's where we'll send the written estimate.";
    case "phone":
      return "And a phone number we can reach you on? Something like (904) 555-0142.";
    case "notes":
      return "Anything else the crew should know — acreage, gate codes, an old well that's already on site? Say 'skip' if not.";
    case "consent":
      return "Last thing: I need your OK to store these details so the office can respond. That's it — no marketing list, no obligation. Do I have it?";
    case "confirm":
      return "Quick check before I send this — shall I pass it to the office?";
    default:
      return "Anything else I can help with?";
  }
}

export function summary(session: FlowSession): string {
  const f = session.fields;
  const service = bookingServices.find((option) => option.value === f.service)?.label ?? f.service ?? "—";
  const lines = [
    `Service: ${service}`,
    `Property ZIP: ${f.zip ?? "—"}`,
    `Preferred date: ${f.preferredDate ? formatDate(f.preferredDate) : "—"}`,
    `Time: ${f.timePreference === "morning" ? "Morning · 8–12" : f.timePreference === "afternoon" ? "Afternoon · 12–5" : "Flexible"}`,
    `Name: ${f.fullName ?? "—"}`,
    `Email: ${f.email ?? "—"}`,
    `Phone: ${f.phone ?? "—"}`,
    `Notes: ${f.notes?.trim() ? f.notes.trim() : "none"}`,
  ];
  return `Here's what I've got:\n\n${lines.join("\n")}\n\nReply **yes** and I'll send it to the office right now. Or tell me what to change — say "change email" — or "cancel".`;
}

function chipsFor(stage: FlowStage, session: FlowSession): string[] {
  switch (stage) {
    case "service":
      return bookingServices.map((option) => option.label);
    case "date":
      return ["Tomorrow", "Next week", "Next Monday"];
    case "time":
      return HOUR_OPTIONS;
    case "notes":
      return ["Skip"];
    case "consent":
      return ["Yes, go ahead", "No"];
    case "confirm":
      return ["Yes, send it", "Change email", "Change date", "Cancel"];
    default:
      return [];
  }
}

const reask = (session: FlowSession, message: string): FlowStep => ({
  session,
  reply: message,
  chips: chipsFor(session.stage, session),
  progress: progressOf(session),
});

/** The flow's opening turn: used when a visitor asks to book, or taps the CTA. */
export function openingStep(seed?: string | null): FlowStep {
  const session = startFlow(seed);
  return { session, reply: ask(session.stage), chips: chipsFor(session.stage, session), progress: progressOf(session) };
}

/**
 * Feed one visitor message into the flow. Returns the reply to show, the chips to
 * offer, and (once booked) the reference.
 */
export async function stepFlow(previous: FlowSession, text: string): Promise<FlowStep> {
  const session: FlowSession = { ...previous, fields: { ...previous.fields }, updatedAt: Date.now() };
  const raw = text.trim();

  if (isCancel(raw)) {
    return { ...session, session: { ...session, stage: "done" }, reply: `No problem — I've dropped it. Nothing was saved. If you change your mind, the office is on ${business.phoneDisplay}, ${business.hours.map((h) => `${h.days} ${h.time}`).join(", ")}.`, chips: ["Start over"], progress: null };
  }

  if (session.stage === "confirm") {
    const change = raw.match(/^change\s+(service|zip|date|time|name|email|phone|notes)$/i)?.[1];
    if (change) {
      const map: Record<string, FlowStage> = { service: "service", zip: "zip", date: "date", time: "time", name: "name", email: "email", phone: "phone", notes: "notes" };
      session.stage = map[change];
      return { session, reply: ask(session.stage), chips: chipsFor(session.stage, session), progress: progressOf(session) };
    }
    const yes = parseConsent(raw);
    if (yes === null) {
      return reask(session, "Just say yes and I'll send it, tell me what to change, or say cancel.");
    }
    if (yes === false) {
      return { session: { ...session, stage: "done" }, reply: `Alright, I've left it with you — nothing was sent. You can also call ${business.phoneDisplay} and they'll take it from there.`, chips: ["Start over"], progress: null };
    }
    session.requestId ??= newRequestId();
    const result = await createBooking({ ...session.fields, consent: true, website: "", requestId: session.requestId } as BookingFields);
    if (!result.ok) {
      // Push the visitor straight back to the field the server objected to.
      const firstKey = result.errors ? (Object.keys(result.errors)[0] as keyof BookingFields) : undefined;
      const stageForField: Partial<Record<keyof BookingFields, FlowStage>> = { service: "service", zip: "zip", preferredDate: "date", timePreference: "time", fullName: "name", email: "email", phone: "phone", notes: "notes", consent: "consent" };
      const next = firstKey && stageForField[firstKey] ? stageForField[firstKey]! : "confirm";
      session.stage = next;
      const detail = firstKey && result.errors?.[firstKey] ? ` ${result.errors[firstKey]}` : ` ${result.error}`;
      return { session, reply: `I couldn't send that yet.${detail}`, chips: chipsFor(next, session), progress: progressOf(session) };
    }
    session.stage = "done";
    session.reference = result.reference;
    return {
      session,
      reply: result.created
        ? `Done — that's with the office now. Your reference is **${result.reference}**. Quote it if you call ${business.phoneDisplay}. Someone will phone you to agree a time; a request here isn't a confirmed booking, and no work starts until you approve a written estimate.`
        : `That one had already come through — same reference: **${result.reference}**. No duplicate was sent.`,
      chips: [],
      progress: progressOf(session),
      booked: { reference: result.reference },
    };
  }

  switch (session.stage) {
    case "service": {
      const value = matchService(raw);
      if (!value) return reask(session, `I can book ${bookingServices.map((o) => o.label.toLowerCase()).join(", ")}, or we can start with a conversation if you're not sure yet.`);
      session.fields.service = value;
      session.stage = "zip";
      return next(session, value === "not-sure" ? "No problem — that's common, and the on-site visit is exactly what clears it up." : "");
    }
    case "zip": {
      const zip = parseZip(raw);
      if (!zip) return reask(session, "I need a five-digit US ZIP for that — it's how we confirm coverage.");
      session.fields.zip = zip;
      session.stage = "date";
      return next(session);
    }
    case "date": {
      if (/^(no preference|any ?day|anytime|whenever|you choose|no idea)\b/i.test(raw)) {
        const { min } = dateBounds();
        session.fields.preferredDate = min;
        session.stage = "time";
        return next(session, `No problem — I'll put ${formatDate(min)} as a placeholder and the office will agree the real day with you.`);
      }
      const date = parseDate(raw);
      if (!date) return reask(session, `I couldn't read that date. Try "tomorrow", "next Friday" or "Sep 20". The window is ${formatDate(dateBounds().min)} to ${formatDate(dateBounds().max)}.`);
      const err = errorFor({ ...session.fields, preferredDate: date }, "preferredDate");
      if (err) return reask(session, err);
      session.fields.preferredDate = date;
      session.stage = "time";
      return next(session);
    }
    case "time": {
      const time = parseTime(raw);
      if (!time) return reask(session, "Morning (8–12), afternoon (12–5), or flexible — which suits you?");
      session.fields.timePreference = time;
      session.stage = "name";
      return next(session);
    }
    case "name": {
      const name = parseName(raw);
      if (!name) return reask(session, "A first and last name is enough — the office needs something to ask for on the phone.");
      session.fields.fullName = name;
      session.stage = "email";
      return next(session);
    }
    case "email": {
      const email = parseEmail(raw);
      if (!email) return reask(session, "That doesn't look like an email address. It should look like name@example.com.");
      session.fields.email = email;
      session.stage = "phone";
      return next(session);
    }
    case "phone": {
      const phone = parsePhone(raw);
      if (!phone) return reask(session, "I need a number with an area code, like (904) 555-0142.");
      session.fields.phone = phone;
      session.stage = "notes";
      return next(session);
    }
    case "notes": {
      session.fields.notes = /^(skip|none|no|nothing|that's it|that is it)$/i.test(raw) ? "" : raw.slice(0, 1500);
      session.stage = "consent";
      return next(session);
    }
    case "consent": {
      const yes = parseConsent(raw);
      if (yes === null) return reask(session, "A simple yes or no is all I need here.");
      if (yes === false) {
        return { session: { ...session, stage: "done" }, reply: `That's fine — nothing is saved without your OK. If you'd rather do this by phone, we're on ${business.phoneDisplay}, ${business.hours.map((h) => `${h.days} ${h.time}`).join(", ")}.`, chips: ["Start over"], progress: null };
      }
      session.fields.consent = true;
      session.stage = "confirm";
      return { session, reply: summary(session), chips: chipsFor("confirm", session), progress: progressOf(session) };
    }
    default:
      return { session, reply: ask("service"), chips: chipsFor("service", session), progress: progressOf(session) };
  }
}

function next(session: FlowSession, prefix = ""): FlowStep {
  const reply = prefix ? `${prefix}\n\n${ask(session.stage)}` : ask(session.stage);
  return { session, reply, chips: chipsFor(session.stage, session), progress: progressOf(session) };
}

/** Keeps the free-chat brain honest about what the flow can and cannot promise. */
export const flowGuardrails = {
  neverQuotesPrice: true,
  neverConfirmsAppointment: true,
  validationSource: "src/lib/booking.ts",
  storeSource: "src/lib/booking-store.ts",
} as const satisfies Record<string, unknown>;

export type { BookingErrors };
