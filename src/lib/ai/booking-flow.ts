import { dateBounds, formatDate, validateBooking, type BookingErrors, type BookingFields } from "@/lib/booking";
import { bookingServices, business } from "@/lib/site-data";
import { normalizeArea, normalizePhone, parseDateInput, parseTimeInput } from "@/lib/understand";
import { createBooking, newRequestId } from "@/lib/booking-store";

/**
 * The part that makes this a calling agent rather than a FAQ box: it asks for one
 * thing at a time, validates each answer with the SAME rules the estimate form
 * uses, reads the whole request back, and only then writes it through
 * createBooking(). No LLM is involved in this path on purpose — a booking must not
 * depend on a model being available, and free-text answers must not be trusted to
 * a parser that can hallucinate a phone number.
 */

export type FlowStage = "service" | "area" | "date" | "time" | "name" | "email" | "phone" | "notes" | "consent" | "confirm" | "done";

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
  progress: { stage: FlowStage | "done"; label: string } | null;
  booked?: { reference: string };
};

const ORDER: FlowStage[] = ["service", "area", "date", "time", "name", "email", "phone", "notes", "consent", "confirm"];

const LABEL: Record<FlowStage, string> = {
  service: "the service",
  area: "your area of the city",
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
      session.stage = "area";
    }
  }
  return session;
}

export function progressOf(session: FlowSession) {
  if (session.stage === "done") return { stage: "done" as const, label: "Sent to the office" };
  const index = ORDER.indexOf(session.stage);
  return { stage: session.stage, label: `Step ${index + 1} of ${ORDER.length} · ${LABEL[session.stage]}` };
}

/**
 * Maps free text to a service id.
 *
 * Deliberately driven by bookingServices in src/lib/site-data.ts rather than a
 * hand-written keyword table: swapping the niche must not require editing this
 * file, and a hard-coded list is exactly how a "rock well" rule survived the last
 * rebrand and silently swallowed an "inverter board" answer.
 */
/** The opening question, worded from the current service list. */
function serviceQuestion(): string {
  const list = bookingServices.map((option, index) => `${index + 1}. ${option.label.split(" — ")[0]}`);
  return `Which do you need?\n${list.join("\n")}\nReply with the number or the name — if none of those fit, ${bookingServices.length} is fine and we will work it out with you.`;
}

function matchService(text: string): string | undefined {
  const t = text.toLowerCase().replace(/[^a-z0-9&\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return undefined;

  const exact = bookingServices.find((option) => t.includes(option.value) || t.includes(option.label.toLowerCase()));
  if (exact) return exact.value;

  // A number is the shortest possible answer, and the list is shown numbered.
  const choice = /^\s*(?:option|no\.?|sno\.?|choice)?\s*([1-9])\s*(?:st|nd|rd|th)?\s*$/.exec(t);
  if (choice) {
    const picked = bookingServices[Number(choice[1]) - 1];
    if (picked) return picked.value;
  }
  if (/\b(not sure|unsure|idk|no idea|advice|help me decide|what do you think|depends)\b/.test(t)) return "not-sure";

  // Score by how many meaningful words of each label the message contains.
  const stop = new Set(["the", "a", "an", "my", "i", "to", "of", "for", "and", "or", "is", "it", "in", "on", "need", "want", "wanting", "please", "have", "has", "not", "no", "get", "too", "but", "with", "from", "new", "just", "some", "ac", "air", "conditioner", "unit"]);
  let best: { value: string; score: number } | undefined;
  for (const option of bookingServices) {
    if (option.value === "not-sure") continue;
    const words = option.label.toLowerCase().split(/[^a-z0-9&-]+/).filter((w) => w.length > 3 && !stop.has(w));
    const score = words.reduce((total, word) => (t.includes(word) ? total + 1 : total), 0);
    if (score > 0 && (!best || score > best.score)) best = { value: option.value, score };
  }
  return best && best.score >= 1 ? best.value : undefined;
}

/* Dates, day parts, areas and phone numbers are read by src/lib/understand.ts — the
   same reader the form's validation uses, so "kal" and "korangiiii" cannot mean one
   thing in chat and another in the form. */
function parseName(text: string): string | null {
  const clean = text.trim().replace(/\s+/g, " ").replace(/^(my name is|it.s|this is|i am|im)\s+/i, "");
  return clean.length >= 2 && clean.length <= 100 ? clean : null;
}

function parseEmail(text: string): string | null {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
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
      return `Sure — I can start that for you. ${serviceQuestion()}`;
    case "area":
      return `Which area of ${business.city}? A neighbourhood name or a five-digit postal code both work — that's how we confirm a technician can reach you same-day.`;
    case "date": {
      const { max } = dateBounds();
      return `Kaunsa din theek hai? Kal, parson, next Friday ya 12 October — jo likh dein chalta hai. Window: kal se ${formatDate(max)} tak.`;
    }

    case "time":
      return "And when suits — morning (9 am–1 pm), evening (4–9 pm), or flexible either way?";
    case "name":
      return "Thanks. What name should the office ask for when they call?";
    case "email":
      return "Your email address, please — that's where the written quote goes once the technician has read the unit.";
    case "phone":
      return `And a phone number we can reach you on — the way we write it here is ${business.phoneDisplay}.`;
    case "notes":
      return "Anything the technician should know before arriving — which room, since when, gate or roof access? Say 'skip' if not.";
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
    `Area: ${f.area ?? "—"}`,
    `Preferred date: ${f.preferredDate ? formatDate(f.preferredDate) : "—"}`,
    `Time: ${f.timePreference === "morning" ? "Morning · 9 am–1 pm" : f.timePreference === "afternoon" ? "Evening · 4–9 pm" : "Any time"}`,
    `Name: ${f.fullName ?? "—"}`,
    `Email: ${f.email ?? "—"}`,
    `Phone: ${f.phone ?? "—"}`,
    `Notes: ${f.notes?.trim() ? f.notes.trim() : "none"}`,
  ];
  return `Here's what I've got:\n\n${lines.join("\n")}\n\nReply **yes** and I'll send it to the office right now. Or tell me what to change — say "change email" — or "cancel".`;
}

const reask = (session: FlowSession, message: string): FlowStep => ({
  session,
  reply: message,
  progress: progressOf(session),
});

/** The flow's opening turn: used when a visitor asks to book, or taps the CTA. */
export function openingStep(seed?: string | null): FlowStep {
  const session = startFlow(seed);
  return { session, reply: ask(session.stage), progress: progressOf(session) };
}

/**
 * Feed one visitor message into the flow. Returns the reply to show and, once booked,
 * the reference. Nothing is offered as a button any more — the flow says what it needs
 * in words and the visitor answers in words.
 */
export async function stepFlow(previous: FlowSession, text: string): Promise<FlowStep> {
  const session: FlowSession = { ...previous, fields: { ...previous.fields }, updatedAt: Date.now() };
  const raw = text.trim();

  if (isCancel(raw)) {
    return { ...session, session: { ...session, stage: "done" }, reply: `No problem — I've dropped it. Nothing was saved. If you change your mind, the office is on ${business.phoneDisplay}, ${business.hours.map((h) => `${h.days} ${h.time}`).join(", ")}.`, progress: null };
  }

  if (session.stage === "confirm") {
    const change = raw.match(/^change\s+(service|area|date|time|name|email|phone|notes)$/i)?.[1];
    if (change) {
      const map: Record<string, FlowStage> = { service: "service", area: "area", date: "date", time: "time", name: "name", email: "email", phone: "phone", notes: "notes" };
      session.stage = map[change];
      return { session, reply: ask(session.stage), progress: progressOf(session) };
    }
    const yes = parseConsent(raw);
    if (yes === null) {
      return reask(session, "Just say yes and I'll send it, tell me what to change, or say cancel.");
    }
    if (yes === false) {
      return { session: { ...session, stage: "done" }, reply: `Alright, I've left it with you — nothing was sent. You can also call ${business.phoneDisplay} and they'll take it from there.`, progress: null };
    }
    session.requestId ??= newRequestId();
    const result = await createBooking({ ...session.fields, consent: true, website: "", requestId: session.requestId } as BookingFields);
    if (!result.ok) {
      // Push the visitor straight back to the field the server objected to.
      const firstKey = result.errors ? (Object.keys(result.errors)[0] as keyof BookingFields) : undefined;
      const stageForField: Partial<Record<keyof BookingFields, FlowStage>> = { service: "service", area: "area", preferredDate: "date", timePreference: "time", fullName: "name", email: "email", phone: "phone", notes: "notes", consent: "consent" };
      const next = firstKey && stageForField[firstKey] ? stageForField[firstKey]! : "confirm";
      session.stage = next;
      const detail = firstKey && result.errors?.[firstKey] ? ` ${result.errors[firstKey]}` : ` ${result.error}`;
      return { session, reply: `I couldn't send that yet.${detail}`, progress: progressOf(session) };
    }
    session.stage = "done";
    session.reference = result.reference;
    return {
      session,
      reply: result.created
        ? `Done — that's with the office now. Your reference is **${result.reference}**. Quote it if you call ${business.phoneDisplay}. Someone will phone you to agree a time; a request here isn't a confirmed booking, and no work starts until you approve a written estimate.`
        : `That one had already come through — same reference: **${result.reference}**. No duplicate was sent.`,

      progress: progressOf(session),
      booked: { reference: result.reference },
    };
  }

  switch (session.stage) {
    case "service": {
      const value = matchService(raw);
      if (!value) return reask(session, `I can book ${bookingServices.map((o) => o.label.toLowerCase()).join(", ")}, or we can start with a conversation if you're not sure yet.`);
      session.fields.service = value;
      session.stage = "area";
      return next(session, value === "not-sure" ? "No problem — that's common, and the on-site visit is exactly what clears it up." : "");
    }
    case "area": {
      const area = normalizeArea(raw);
      if (!area) return reask(session, `Aap ka area? Jaise "DHA Phase 5", "Gulshan-e-Iqbal", "Korangi" — ya five-digit postal code jaise ${business.postalCode}.`);
      session.fields.area = area.value;
      session.stage = "date";
      // a spelling we fixed is said out loud, so a wrong read is caught here and not
      // on the phone call three hours later
      return next(session, area.corrected ? `${area.value} — samajh gaya.` : "");
    }
    case "date": {
      if (/^(no preference|any ?day|anytime|whenever|you choose|no idea)\b/i.test(raw)) {
        const { min } = dateBounds();
        session.fields.preferredDate = min;
        session.stage = "time";
        return next(session, `No problem — I'll put ${formatDate(min)} as a placeholder and the office will agree the real day with you.`);
      }
      // "aaj"/"today" is understood perfectly — it just is not something the schedule can
      // honour, so the nearest real day is taken and said out loud instead of re-asking
      if (/^(aaj|aj|today|abhi|isi\s+din)\b/i.test(raw.trim())) {
        const { min } = dateBounds();
        session.fields.preferredDate = min;
        session.stage = "time";
        return next(session, `Aaj sabse pehla slot nahi — ${formatDate(min)} rakh diya. Real din office call par confirm karega.`);
      }
      const date = parseDateInput(raw);
      if (!date)
        return reask(
          session,
          `Date samajh nahi aayi — "kal", "parson", "next Friday", "12 October" ya "12/11" sab chalta hai. Window ${formatDate(dateBounds().min)} se ${formatDate(dateBounds().max)} tak hai.`,
        );
      const err = errorFor({ ...session.fields, preferredDate: date }, "preferredDate");
      // the date was read but cannot be booked: say which one was read, and up to when
      if (err)
        return reask(
          session,
          `${formatDate(date)} window se bahar hai — ${formatDate(dateBounds().min)} se ${formatDate(dateBounds().max)} tak. Us beech ka koi din likhein.`,
        );
      session.fields.preferredDate = date;
      session.stage = "time";
      return next(session);
    }
    case "time": {
      const time = parseTimeInput(raw);
      if (!time) return reask(session, "subah (9 am–1 pm), shaam (4–9 pm), ya flexible — jo chale?");
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
      const phone = normalizePhone(raw);
      if (!phone)
        return reask(
          session,
          "Pakistan ka mobile number chahiye — jaise 0300 5550142 ya +92 314 2580054. Karachi landline (021 se shuru) bhi chalega.",
        );
      session.fields.phone = phone.e164;
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
        return { session: { ...session, stage: "done" }, reply: `That's fine — nothing is saved without your OK. If you'd rather do this by phone, we're on ${business.phoneDisplay}, ${business.hours.map((h) => `${h.days} ${h.time}`).join(", ")}.`, progress: null };
      }
      session.fields.consent = true;
      session.stage = "confirm";
      return { session, reply: summary(session), progress: progressOf(session) };
    }
    default:
      return { session, reply: ask("service"), progress: progressOf(session) };
  }
}

function next(session: FlowSession, prefix = ""): FlowStep {
  const reply = prefix ? `${prefix}\n\n${ask(session.stage)}` : ask(session.stage);
  return { session, reply, progress: progressOf(session) };
}

/** Keeps the free-chat brain honest about what the flow can and cannot promise. */
export const flowGuardrails = {
  neverQuotesPrice: true,
  neverConfirmsAppointment: true,
  validationSource: "src/lib/booking.ts",
  storeSource: "src/lib/booking-store.ts",
} as const satisfies Record<string, unknown>;

export type { BookingErrors };
