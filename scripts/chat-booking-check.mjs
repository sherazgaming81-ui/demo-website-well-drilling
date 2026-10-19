/**
 * Drives a whole booking conversation through POST /api/chat and proves the request
 * really lands in the same store the estimate form writes to.
 *   node scripts/chat-booking-check.mjs          (against http://127.0.0.1:3000)
 *   TEST_URL=http://127.0.0.1:3000 node scripts/chat-booking-check.mjs
 */
const base = (process.env.TEST_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const session = crypto.randomUUID();
let fails = 0;

const check = (name, pass, extra = "") => {
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
};

async function turn(content, start = false) {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: session, ...(start ? { startBooking: true } : {}), messages: [{ role: "user", content }] }),
  });
  if (!res.ok) return { status: res.status, text: await res.text() };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", booking = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i = buf.indexOf("\n\n");
    while (i !== -1) {
      const line = buf.slice(0, i).split("\n").find((l) => l.startsWith("data:"));
      buf = buf.slice(i + 2);
      i = buf.indexOf("\n\n");
      if (!line) continue;
      try {
        const p = JSON.parse(line.slice(5).trim());
        if (p.type === "delta") text += p.text;
        if (p.type === "booking") booking = p;
      } catch {}
    }
  }
  return { text: text.trim(), booking };
}

const email = `chat-flow-${Date.now()}@example.com`;
/* Typed the way a customer types: Roman Urdu for the day, a stuck key in the area, a
   morning in "subah", and a number this office could not dial. The flow is expected to
   read all of it, correct what is obviously a typo, and refuse what it cannot call. */
const steps = [
  ["start", "book me", true],
  ["service", "inverter board not working", false],
  ["area-bad", "123", false],
  ["area-typo", "korangiiii", false],
  ["date-kal", "kal", false],
  ["time-urdu", "subah", false],
  ["name", "Sheraz Ahmed", false],
  ["email", email, false],
  ["phone-foreign", "(904) 555-0142", false],
  ["phone", "+92 314 2580054", false],
  ["notes", "skip", false],
  ["consent", "yes", false],
  ["confirm", "yes", false],
];

let lastStage = null;
const seen = {};
for (const [label, message, start] of steps) {
  const r = await turn(message, start);
  seen[label] = r;
  lastStage = r.booking?.stage ?? lastStage;
  const priced = /\$\s?\d|\d+\s?per foot/i.test(r.text);
  check(`step ${label}`, r.text.length > 20 && !priced, `stage=${r.booking?.stage ?? "-"}${priced ? " ⚠ price!" : ""}`);
}

check("an unusable area was re-asked, not accepted", /area/i.test(seen["area-bad"].text ?? ""));
// the stuck key is fixed and said back, so a wrong read is caught here, not on the phone
check("“korangiiii” is read back as Korangi", /Korangi/.test(seen["area-typo"].text ?? ""), (seen["area-typo"].text ?? "").slice(0, 70));
check("…and the flow moved on to the date", seen["area-typo"].booking?.stage === "date", `stage=${seen["area-typo"].booking?.stage}`);
check("“kal” is understood as tomorrow", seen["date-kal"].booking?.stage === "time", `stage=${seen["date-kal"].booking?.stage}`);
check("“subah” is understood as morning", seen["time-urdu"].booking?.stage === "name", `stage=${seen["time-urdu"].booking?.stage}`);
check("a number the office cannot dial is refused", /pakistan/i.test(seen["phone-foreign"].text ?? ""), (seen["phone-foreign"].text ?? "").slice(0, 70));
check("…and the stage stayed on phone", seen["phone-foreign"].booking?.stage === "phone", `stage=${seen["phone-foreign"].booking?.stage}`);
check("consent step read the whole request back", /Here's what I've got/i.test(seen.consent.text ?? ""));
const readback = seen.consent.text ?? "";
check("the readback shows the corrected area", /Area:\s*Korangi\b/.test(readback), (readback.match(/Area:.*/) ?? [""])[0].slice(0, 40));
check("the readback shows a canonical +92 number", /\+923142580054/.test(readback), (readback.match(/Phone:.*/) ?? [""])[0].slice(0, 40));
const reference = seen["confirm"].booking?.booked?.reference;
check("chat booked and returned a real reference", /^FP-[A-F0-9]{8}$/.test(reference ?? ""), String(reference));
check("the flow names its stage (the header line, not a bar)", (seen["time-urdu"].booking?.progress?.label ?? "").includes("of 10"), seen["time-urdu"].booking?.progress?.label);
check("the flow no longer sends a chip row at all", seen.start.booking?.chips === undefined, JSON.stringify(seen.start.booking ?? {}).slice(0, 70));

// The store is shared with the form: four more from this email plus the chat booking
// must hit the five-per-hour limit, proving the chat wrote to the real store.
let blocked = 0;
for (let index = 0; index < 6; index++) {
  const res = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service: "ac-inverter", area: "Gulshan-e-Iqbal", preferredDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), timePreference: "morning", fullName: "Alex Rivera", email, phone: "0300 5550142", notes: "", consent: true, website: "", requestId: crypto.randomUUID() }),
  });
  if (res.status === 429) blocked++;
}
check("chat booking shares the form's throttle (store is one place)", blocked > 0, blocked ? "429 reached via the form" : "no rate-limit hit");

// cancel and re-book paths
const cancelSession = crypto.randomUUID();
const rawTurn = async (body) => {
  const res = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  return text;
};
const started = await rawTurn({ sessionId: cancelSession, startBooking: true, messages: [{ role: "user", content: "I want to book" }] });
const cancelled = await rawTurn({ sessionId: cancelSession, messages: [{ role: "user", content: "cancel" }] });
check("cancel ends the flow and says nothing was saved", /nothing was saved|dropped it/i.test(cancelled), started.includes("data:") ? "" : "start produced no stream");
const emptyStart = await rawTurn({ sessionId: crypto.randomUUID(), startBooking: true, messages: [] });
check("startBooking works with no history at all", emptyStart.includes('"stage":"service"'), emptyStart.slice(0, 60));

// a finished flow must still accept a new booking typed in plain text
const again = await turn("book me another visit");
check("re-booking after a completed flow starts a fresh one", again.booking?.stage === "service" || again.booking?.stage === "area", `stage=${again.booking?.stage ?? "chat"}`);


/** a stable little hash so each session id maps to its own rate-limit bucket */


/* ------------------------------------------------------------------ the reader */
// Each phrasing has to be understood as a date by the shared reader — two languages, a
// stuck key, a slash date, a bare day of the month, "as soon as possible" — because
// "re-ask until the visitor types what the parser wanted" is not smartness, it is a bug
// with manners. The flow is walked to the date step, answered, and the stage it lands on
// is the verdict. One rate-limit bucket per session: /api/chat limits messages per IP,
// and this section exercises a parser, not a load.
const hash = (value) => [...value].reduce((total, ch) => (total * 31 + ch.charCodeAt(0)) % 100000, 7);

async function askIn(id, content, start = false) {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.99.${(hash(id) % 250) + 1}.1` },
    body: JSON.stringify({ sessionId: id, ...(start ? { startBooking: true } : {}), messages: [{ role: "user", content }] }),
  });
  const raw = await res.text();
  const text = [...raw.matchAll(/"type":"delta","text":"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`)).join("");
  return { stage: /"stage":"([a-z]+)"/.exec(raw)?.[1] ?? (res.ok ? "none" : `http-${res.status}`), text };
} 
/** a flow sitting on the date step, plus the area answer that got it there */
async function toDateStep(areaAnswer = "Gulshan-e-Iqbal") {
  const id = crypto.randomUUID();
  await askIn(id, "book", true); // service step
  const service = await askIn(id, "ac-gas"); // area step
  const area = await askIn(id, areaAnswer); // date step
  return { id, service, area };
}

const phrasings = [
  ["kal", "tomorrow, Roman Urdu"],
  ["parson", "day after tomorrow"],
  ["tomooreow", "misspelt tomorrow"],
  ["tomorow", "misspelt, single o"],
  ["agle hafta", "next week, Roman Urdu"],
  ["12 nov", "day and short month"],
  ["20/11", "slash date, both two digits"],
  ["in 3 din", "counted days, mixed language"],
  ["somwar", "Monday, Roman Urdu"],
  ["budh", "Wednesday, Roman Urdu"],
  ["jaldi se", "as soon as possible"],
  ["5", "a bare day of the month, past this month"],
];
const missed = [];
for (const [typed, meaning] of phrasings) {
  const { id } = await toDateStep();
  const { stage } = await askIn(id, typed);
  if (stage !== "time") missed.push(`“${typed}” (${meaning}) → stage=${stage}`);
}
check("every date phrasing a customer types is understood", missed.length === 0, missed.length ? missed.join("; ") : `${phrasings.length}/${phrasings.length} moved on to the time step`);

// a date that is read correctly but cannot be booked is explained, not repeated
{
  const { id } = await toDateStep();
  const { stage, text } = await askIn(id, "2 feb");
  check("a date outside the window says so, with the window", stage === "date" && /window se bahar/i.test(text), `stage=${stage} · ${text.slice(0, 74)}`);
}
// “aaj” is understood — it simply cannot be honoured, so the nearest real day is taken
{
  const { id } = await toDateStep();
  const { stage, text } = await askIn(id, "aaj");
  check("“aaj” gets the nearest real day, not a re-ask", stage === "time" && /Aaj sabse pehla slot nahi/.test(text), `stage=${stage} · ${text.slice(0, 74)}`);
}
// areas: a stuck key is corrected and said back; an unknown area is kept, not refused
{
  const id = crypto.randomUUID();
  await askIn(id, "book", true);
  await askIn(id, "ac-gas");
  const area = await askIn(id, "korangiiii");
  check("“korangiiii” is read back as Korangi", /Korangi/.test(area.text) && area.stage === "date", `${area.text.slice(0, 64)} · stage=${area.stage}`);
  const id2 = crypto.randomUUID();
  await askIn(id2, "book", true);
  await askIn(id2, "ac-gas");
  const unknown = await askIn(id2, "Mehman Colony");
  check("an area with no page of its own is still accepted", unknown.stage === "date", `stage=${unknown.stage} · ${unknown.text.slice(0, 60)}`);
  const id3 = crypto.randomUUID();
  await askIn(id3, "book", true);
  await askIn(id3, "ac-gas");
  const digits = await askIn(id3, "75350");
  check("a five-digit postal code passes as the area", digits.stage === "date", `stage=${digits.stage}`);
}
// the parts of an answer that are not dates
{
  const { id } = await toDateStep("korangiiii");
  await askIn(id, "kal");
  const time = await askIn(id, "subah");
  check("“subah” reads as the morning window", time.stage === "name", `stage=${time.stage} · ${time.text.slice(0, 60)}`);
  await askIn(id, "Sheraz Ahmed"); // name step
  await askIn(id, "reader-probe@example.com"); // email step, so the next line is the phone step
  const phone = await askIn(id, "0092-314-2580054");
  check("a scribbled +92 number is normalised, not refused", phone.stage === "notes", `stage=${phone.stage} · ${phone.text.slice(0, 60)}`);
  const id4 = crypto.randomUUID();
  await askIn(id4, "book", true);
  await askIn(id4, "ac-gas");
  await askIn(id4, "Korangi");
  await askIn(id4, "kal");
  await askIn(id4, "subah");
  await askIn(id4, "Sheraz Ahmed");
  await askIn(id4, "foreign-probe@example.com");
  const foreign = await askIn(id4, "(904) 555-0142");
  check("a number the office cannot dial is refused in the customer’s language", /Pakistan ka mobile/i.test(foreign.text) && foreign.stage === "phone", `${foreign.text.slice(0, 64)} · stage=${foreign.stage}`);
}

console.log(`\n${fails === 0 ? "CHAT BOOKING: all checks passed" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
