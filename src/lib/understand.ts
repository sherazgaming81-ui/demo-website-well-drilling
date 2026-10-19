import { karachiAreas, serviceAreas } from "@/lib/site-data";
import { dateBounds } from "@/lib/booking";

/**
 * Reading what a customer actually typed.
 *
 * This file is deliberately free of UI and of the model: it turns messy human text —
 * "kal", "tomooreow", "korangiiii", "0300 555 0142", "+92 314 2580054" — into the
 * canonical value the form and the office need. Both the chat flow and the booking
 * form call it, so "smart in chat, strict in the form" cannot happen.
 *
 * The rule throughout: correct what is obviously a typo, keep what is ambiguous, and
 * never invent. A name we do not recognise is passed through cleaned, not rejected.
 */

/* ------------------------------------------------------------------ spelling *//* ------------------------------------------------------------- short commands */
/**
 * The one-word answers a flow runs on (cancel, yes, no, skip) are the ones people
 * mistype most, because they are typed fast on a phone. A stuck key or a missing
 * letter must not turn "canel" into a fresh question about the estimate.
 * Budget is tight on purpose: one edit for short words, two for longer ones, and a
 * leading word only ever counts as itself — "no" must never match "not".
 */
export function matchesCommand(text: string, words: readonly string[]): string | null {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const word of words) {
    const target = word.replace(/[^a-z0-9]/g, "");
    if (tokens.includes(target)) return word;
    const budget = target.length <= 5 ? 1 : 2;
    for (const token of tokens) {
      if (Math.abs(token.length - target.length) > budget) continue;
      if (levenshtein(token, target) <= budget) return word;
    }
  }
  return null;
}



const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
};

/** A key stuck on a phone: "korangiiii" → "korangi". Letters only — a run of digits
   is a date ("20/11"), not a typo, and collapsing it would quietly move an appt. */
const collapseRuns = (value: string) => value.replace(/([a-zA-Z])\1{1,}/g, "$1");

const squash = (value: string) =>
  collapseRuns(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")).replace(/[^a-z0-9]/g, "");

/** Exact → prefix → edit distance, with the budget scaling by word length. */
function closest(needle: string, options: string[]): string | null {
  const target = squash(needle);
  if (target.length < 3) return null;
  const squashed = options.map((option) => ({ option, key: squash(option) }));
  const exact = squashed.find((entry) => entry.key === target);
  if (exact) return exact.option;
  const prefix = squashed.filter((entry) => entry.key.startsWith(target) || target.startsWith(entry.key));
  if (prefix.length === 1) return prefix[0].option;
  const budget = target.length <= 4 ? 1 : target.length <= 6 ? 2 : 3;
  let best: { option: string; distance: number } | undefined;
  for (const entry of squashed) {
    if (Math.abs(entry.key.length - target.length) > budget) continue;
    const distance = levenshtein(target, entry.key);
    if (distance <= budget && (!best || distance < best.distance)) best = { option: entry.option, distance };
  }
  return best?.option ?? null;
}

export const titleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

/* ---------------------------------------------------------------------- area */

/**
 * What an area word may be matched against. Canonical names accept a typo
 * ("korangiiii", "gulshan iqbal"); aliases match only exactly — they are shorter and
 * sloppier, and a fuzzy hit on one quietly renames a real neighbourhood into someone
 * else's, which is worse than not matching at all.
 */
type AreaEntry = { key: string; canonical: string; display: string; fuzzy: boolean };
const AREA_ENTRIES: AreaEntry[] = [];
const pushEntry = (entry: AreaEntry) => {
  if (!AREA_ENTRIES.some((seen) => seen.key === entry.key)) AREA_ENTRIES.push(entry);
};
/**
 * An alias like "dha phase 5" belongs to DHA, but the *display* must keep the detail —
 * saving "DHA" and losing the phase is exactly what the office cannot use. So the
 * display is the alias with the area's own name spelled the way the brand spells it.
 */
const displayFor = (alias: string, name: string) => {
  const rest = alias.toLowerCase().startsWith(`${name.toLowerCase()} `) ? alias.slice(name.length).trim() : "";
  if (!rest) return alias.toLowerCase() === name.toLowerCase() ? name : titleCase(alias);
  return `${name} ${titleCase(rest)}`;
};
for (const area of karachiAreas) {
  pushEntry({ key: squash(area.name), canonical: area.name, display: area.name, fuzzy: true });
  for (const alias of area.aliases) {
    pushEntry({ key: squash(alias), canonical: area.name, display: displayFor(alias, area.name), fuzzy: false });
  }
}
for (const area of serviceAreas) {
  pushEntry({ key: squash(area.name), canonical: area.name, display: area.name, fuzzy: true });
}

export function matchArea(word: string): AreaEntry | null {
  const target = squash(word);
  if (target.length < 3) return null;
  const exact = AREA_ENTRIES.find((entry) => entry.key === target);
  if (exact) return exact;
  let best: { entry: AreaEntry; distance: number } | undefined;
  for (const entry of AREA_ENTRIES) {
    if (!entry.fuzzy) continue;
    const budget = target.length <= 6 ? 1 : target.length <= 9 ? 2 : 3;
    if (Math.abs(entry.key.length - target.length) > budget) continue;
    const distance = levenshtein(target, entry.key);
    if (distance <= budget && (!best || distance < best.distance)) best = { entry, distance };
  }
  return best?.entry ?? null;
}

const AREA_NOISE = /^(my|the)?\s*(area|locality|zone|town|colony|plot|house|flat)?\s*(is|of|:)?\s*/i;

export type AreaResult = { value: string; corrected: boolean };

/**
 * "korangiiii" → "Korangi", "gulshan e iqbal" → "Gulshan-e-Iqbal",
 * "dha phase 6" → "DHA Phase 6", "75350" → "75350".
 * The first recognisable word becomes canonical; anything after it (a block, a
 * phase, a street) is kept, so detail is never thrown away to win a spelling.
 */
export function normalizeArea(raw: string): AreaResult | null {
  const cleaned = raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(i am from|i'm from|we are in|we're in|my area is|area is|based in|from)\s+/i, "")
    .replace(AREA_NOISE, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (!cleaned) return null;

  const digits = cleaned.replace(/\D/g, "");
  if (/^\d{5}([- ]\d{5})?$/.test(cleaned.trim())) return { value: digits.slice(0, 5), corrected: false };

  if (!/[A-Za-z]/.test(cleaned)) return null;
  /* Karachi names carry numbers constantly — "DHA Phase 5", "Clifton Block 2",
     "Korangi Block 5" — and the gallery itself shows "DHA Phase 5". A guard that
     rejected digits was rejecting the areas the site tells people to type, so
     numbers are part of the shape now (a leading letter still is what makes it a
     place rather than a stray number). */
  const shape = /^[A-Za-z][A-Za-z0-9.'#\-\s]{1,59}$/;
  if (!shape.test(cleaned)) return null;

  // the flag answers a different question than the match does: is what we are about to
  // save different from what the visitor typed? (a stuck key still counts)
  const asTyped = cleaned.toLowerCase().replace(/[^a-z0-9]/g, "");
  const words = cleaned.split(" ");
  const tail = words.slice(1).join(" ");
  const single = words.length === 1 ? cleaned : words[0];
  const withTail = (canonical: string, rest: string) => {
    const value = rest ? `${canonical} ${titleCase(rest)}` : canonical;
    return { value, corrected: value.toLowerCase().replace(/[^a-z0-9]/g, "") !== asTyped };
  };
  const whole = matchArea(cleaned);
  if (whole) return { value: whole.display, corrected: squash(whole.display) !== asTyped };
  const head = matchArea(single);
  if (head) return withTail(head.display, tail);

  // multi-word names typed with the join words in ("Gulshan e Iqbal") match as a pair
  if (words.length > 1) {
    const pair = matchArea(`${words[0]} ${words[1]}`);
    if (pair) return withTail(pair.display, words.slice(2).join(" "));
  }

  // an area we do not know is kept as the visitor wrote it, only tidied —
  // so there is nothing to announce and nothing to apologise for
  const fallback = titleCase(cleaned);
  return { value: fallback, corrected: false };
}

/* ---------------------------------------------------------------------- date */

const MONTHS = [
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
];
const MONTH_ALIASES = [
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep|sept", "oct", "nov", "dec",
];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
/** Roman Urdu / Hindi weekday names, including the ones people spell both ways. */
const URDU_WEEKDAYS = [
  ["itarwar", "itwar", "itarvar", "sunday"],
  ["somwar", "somvaar", "somvaar", "monday"],
  ["mangal", "mangalvaar", "mangalvaar", "tuesday"],
  ["budh", "budhav", "burhaat", "wednesday"],
  ["jumberat", "jumeraat", "guerve", "thursday"],
  ["jumma", "juma", "shukraan", "friday"],
  ["shanwar", "hafte", "starnay", "saturday"],
];
const iso = (date: Date) => date.toISOString().slice(0, 10);
const shift = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};
const nextWeekday = (target: number) => {
  const date = shift(1);
  while (date.getUTCDay() !== target) date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

function buildDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  const { min } = dateBounds();
  if (iso(candidate) < min) return iso(new Date(Date.UTC(year + 1, month - 1, day)));
  return iso(candidate);
}

function monthIndex(word: string): number | null {
  for (let i = 0; i < MONTHS.length; i++) {
    const names = [MONTHS[i], ...MONTH_ALIASES[i].split("|")];
    if (names.some((name) => name === squash(word) || closest(word, [name]) === name)) return i;
  }
  return null;
}

function weekdayIndex(word: string): number | null {
  for (let d = 0; d < WEEKDAYS.length; d++) {
    const names = [WEEKDAYS[d], ...URDU_WEEKDAYS[d].slice(0, 3)];
    if (names.some((name) => name === squash(word) || closest(word, [name]) === name)) return d;
  }
  return null;
}

/**
 * Anything a person plausibly types for a day: English, Roman Urdu, a bare day of the
 * month, a slash date, "in 3 din", "jaldi se", and the misspellings of all of them.
 * Returns null when the text is genuinely not a date — the caller re-asks rather than
 * guessing a day somebody did not ask for.
 */
export function parseDateInput(raw: string): string | null {
  const text = collapseRuns(raw.toLowerCase().replace(/(\d)(st|nd|rd|th)/g, "$1")).replace(/\s+/g, " ").trim();
  if (!text || text.length > 80) return null;
  const tokens = text.split(" ").map((word) => word.replace(/[^a-z0-9/-]/g, "")).filter(Boolean);
  const whole = tokens.join("");
  /* A phrase may be typed as one word or several, and with a stuck key. Each candidate
     is compared against every token and against the joined line; closest() answers with
     the option it matched, so that is what gets compared back. */
  const near = (word: string) => {
    const target = squash(word);
    if (target.length < 3) return tokens.includes(word);
    return [whole, ...tokens].some((token) => token === word || token === target || closest(word, [token]) === token);
  };
  const has = (...words: string[]) => words.some(near);
  const { min, max } = dateBounds();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text >= min && text <= max ? text : buildDate(+text.slice(0, 4), +text.slice(5, 7), +text.slice(8, 10));
  if (has("kal", "cl", "kalu", "tomorrow", "tmrw", "tmr", "tommorow", "tomooreow")) return iso(shift(1));
  if (has("parson", "parso", "paras", "dayafter", "after")) {
    if (text.includes("after") && !has("tomorrow")) return iso(shift(2));
    if (has("parson", "parso", "paras")) return iso(shift(2));
  }
  if (has("nextweek", "aglehafta", "aglahafta", "agle", "hafta")) return iso(shift(7));
  if (has("weekend", "haffte", "chhutti")) return iso(nextWeekday(6));
  if (has("asap", "jaldise", "jakar", "anyday", "kabhibhi", "anytime", "dontmatter")) return min;

  const inDays = text.match(/(?:in|ke baad|baad)\s*(\d{1,2})\s*(days?|din|divas)?/) ?? text.match(/^(\d{1,2})\s*(days?|din)$/);
  if (inDays) return iso(shift(Number(inDays[1])));

  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : new Date().getUTCFullYear();
    // "20/10" is day/month here; "10/20" can only be month/day.
    return a > 12 ? buildDate(year, b, a) : buildDate(year, a, b);
  }

  const month = tokens.findIndex((word) => monthIndex(word) !== null);
  const numbers = [...text.matchAll(/\b(\d{1,2})\b/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= 31);
  if (month !== -1 && numbers.length) {
    const index = monthIndex(tokens[month])!;
    const day = numbers.find((n) => n !== index + 1) ?? numbers[0];
    const year = Number(text.match(/\b(20\d\d)\b/)?.[1] ?? new Date().getUTCFullYear());
    return buildDate(year, index + 1, day);
  }
  if (month !== -1 && !numbers.length) return null;

  const weekday = tokens.findIndex((word) => weekdayIndex(word) !== null);
  if (weekday !== -1) return iso(nextWeekday(weekdayIndex(tokens[weekday])!));

  // A bare "12" or "12 ko" means the 12th of this month, else of next month — and a
  // day that is simply past is answered null, not rolled into next year, where the
  // booking window would reject it with a message that explains nothing.
  if (numbers.length === 1 && (tokens.length === 1 || (tokens.length === 2 && has("ko", "tareekh", "date")))) {
    const now = new Date();
    const day = numbers[0];
    const exact = (year: number, month: number) => {
      const candidate = new Date(Date.UTC(year, month - 1, day));
      if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
      const value = iso(candidate);
      return value >= min && value <= max ? value : null;
    };
    return (
      exact(now.getUTCFullYear(), now.getUTCMonth() + 1) ??
      exact(now.getUTCFullYear(), now.getUTCMonth() + 2) ??
      exact(now.getUTCFullYear() + 1, now.getUTCMonth() === 11 ? 1 : now.getUTCMonth() + 2) ??
      null
    );
  }
  return null;
}

/* ------------------------------------------------------------------ day part */

export function parseTimeInput(raw: string): string | null {
  const text = collapseRuns(raw.toLowerCase().replace(/[^a-z0-9.\s-]/g, " ")).replace(/\s+/g, " ").trim();
  if (!text) return null;
  const tokens = text.split(" ").filter(Boolean);
  const has = (...words: string[]) => words.some((word) => tokens.includes(word) || closest(word, tokens) === word);
  if (has("flexible", "anytime", "any", "both", "either", "dontmatter", "koi", "jab", "chalega", "jo", "kabhi")) return "flexible";
  if (has("subah", "subha", "savera", "morning", "am", "early", "nahar")) return "morning";
  if (has("shaam", "sham", "evening", "raat", "night", "pm", "baad")) return "afternoon";
  const hour = text.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (hour) return hour[2] === "am" ? "morning" : "afternoon";
  const bare = text.match(/^\s*(\d{1,2})\s*$/);
  if (bare) {
    const h = Number(bare[1]);
    if (h >= 1 && h <= 11) return "morning";
    if (h >= 12 && h <= 23) return "afternoon";
  }
  if (/\b(9|10|11)\b/.test(text) && !/\b(4|5|6|7|8)\b/.test(text)) return "morning";
  return null;
}

/* --------------------------------------------------------------------- phone */

/**
 * Pakistani numbers only — that is what the office can actually dial from Karachi.
 * Every shape a person writes is accepted, and everything is stored as E.164 so the
 * WhatsApp link and the job card cannot disagree.
 */
export function normalizePhone(raw: string): { e164: string; display: string } | null {
  const candidates = raw.match(/[+]?[\d][\d\s().-]{7,20}/g) ?? [];
  for (const candidate of candidates) {
    let digits = candidate.replace(/\D/g, "");
    if (digits.startsWith("0092")) digits = digits.slice(4);
    else if (digits.startsWith("92") && digits.length >= 11) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10 && digits.startsWith("3")) {
      const rest = digits.slice(1);
      return { e164: `+92${digits}`, display: `0${digits.slice(0, 4)} ${rest.slice(0, 3)} ${rest.slice(3)}` };
    }
    if (digits.length === 10 && digits.startsWith("21")) {
      return { e164: `+92${digits}`, display: `021 ${digits.slice(2, 6)} ${digits.slice(6)}` }; // Karachi landline
    }
  }
  return null;
}
