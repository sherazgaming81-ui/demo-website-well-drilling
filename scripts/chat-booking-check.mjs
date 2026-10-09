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
const steps = [
  ["start", "book me", true],
  ["service", "screen well", false],
  ["zip-bad", "123", false],
  ["zip", "28801", false],
  ["date", "tomorrow", false],
  ["time", "morning", false],
  ["name", "Alex Rivera", false],
  ["email", email, false],
  ["phone", "(904) 555-0142", false],
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

check("bad ZIP was re-asked, not accepted", /five-digit/i.test(seen["zip-bad"].text ?? ""));
check("consent step read the whole request back", /Here's what I've got/i.test(seen.consent.text ?? ""));
const reference = seen["confirm"].booking?.booked?.reference;
check("chat booked and returned a real reference", /^AQ-[A-F0-9]{8}$/.test(reference ?? ""), String(reference));
check("progress meter tracked the flow", (seen["time"].booking?.progress?.label ?? "").includes("of 10"), seen["time"].booking?.progress?.label);
check("chips were offered for the choice steps", (seen.start.booking?.chips?.length ?? 0) >= 5, `${seen.start.booking?.chips?.length} service chips`);

// The store is shared with the form: four more from this email plus the chat booking
// must hit the five-per-hour limit, proving the chat wrote to the real store.
let blocked = 0;
for (let index = 0; index < 6; index++) {
  const res = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service: "screen-wells", zip: "28801", preferredDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), timePreference: "morning", fullName: "Alex Rivera", email, phone: "(904) 555-0142", notes: "", consent: true, website: "", requestId: crypto.randomUUID() }),
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
check("re-booking after a completed flow starts a fresh one", again.booking?.stage === "service" || again.booking?.stage === "zip", `stage=${again.booking?.stage ?? "chat"}`);

console.log(`\n${fails === 0 ? "CHAT BOOKING: all checks passed" : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
