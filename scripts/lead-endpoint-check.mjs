const base = process.env.TEST_URL || "http://127.0.0.1:3111";

const d = new Date();
d.setUTCDate(d.getUTCDate() + 1);
const valid = {
  service: "rock-wells",
  zip: "32256",
  preferredDate: d.toISOString().slice(0, 10),
  timePreference: "morning",
  fullName: "Alex Demo",
  email: `aquifer-lead-${Date.now()}@example.com`,
  phone: "(919) 555-0142",
  notes: "Automated demonstration request. No real customer or appointment.",
  consent: true,
  website: "",
  requestId: crypto.randomUUID(),
};

const post = (body, headers = {}) =>
  fetch(`${base}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

let failures = 0;
const check = (name, pass, extra = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
};

const health = await fetch(`${base}/api/health`);
const healthBody = await health.json();
check("GET /api/health returns 200", health.status === 200 && healthBody.ok === true, JSON.stringify(healthBody));

const first = await post(valid);
const firstBody = await first.json();
check("valid booking -> 201 + ok", first.status === 201 && firstBody.ok === true, `status=${first.status}`);
check("reference matches /^AQ-[A-F0-9]{8}$/ (dialog + smoke-test expect this)", /^AQ-[A-F0-9]{8}$/.test(firstBody.reference || ""), firstBody.reference);

const dupe = await post(valid);
const dupeBody = await dupe.json();
check("same requestId -> 200 + same reference (idempotent)", dupe.status === 200 && dupeBody.reference === firstBody.reference, `${dupe.status} ${dupeBody.reference}`);

const badData = await post({ ...valid, requestId: crypto.randomUUID(), email: "invalid", consent: false });
const badDataBody = await badData.json();
check("invalid email + no consent -> 422 with errors.email/consent", badData.status === 422 && !!badDataBody.errors?.email && !!badDataBody.errors?.consent, JSON.stringify(badDataBody.errors));

const crossOrigin = await post(valid, { Origin: "https://outside.example" });
check("foreign Origin -> 403", crossOrigin.status === 403, `status=${crossOrigin.status}`);

const malformed = await post("{bad");
check("malformed JSON -> 400", malformed.status === 400, `status=${malformed.status}`);

const noJson = await fetch(`${base}/api/bookings`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hi" });
check("non-JSON content type -> 415", noJson.status === 415, `status=${noJson.status}`);

const noReqId = await post({ ...valid, requestId: "not-a-uuid" });
check("missing/bad requestId -> 400", noReqId.status === 400, `status=${noReqId.status}`);

const honeypot = await post({ ...valid, requestId: crypto.randomUUID(), website: "spam" });
check("honeypot filled -> 400", honeypot.status === 400, `status=${honeypot.status}`);

for (let i = 0; i < 5; i++) {
  const r = await post({ ...valid, requestId: crypto.randomUUID() });
  if (i === 4) check("throttling: repeated requests from same email -> 429", r.status === 429, `status=${r.status}`);
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
