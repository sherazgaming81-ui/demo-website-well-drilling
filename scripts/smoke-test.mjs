import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.TEST_URL || "http://127.0.0.1:3000";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, baseURL });
const results = [];
const ok = (text) => { results.push(text); console.log(`PASS ${text}`); };

const errors = [];
const failedRequests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
page.on("response", (response) => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });

try {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.title(), /^Freeze Point AC Care/);
  assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
  ok(`Homepage renders with the real business title`);

  // Every picture the page asks for must actually load — this is what breaks
  // when public/images is missing or a path is wrong. Photos below the fold are
  // lazily loaded, so walk the page first and wait for every image to settle.
  // The page sets scroll-behavior: smooth, so window.scrollTo() animates and a fast
  // loop never actually gets anywhere. Jump instantly instead.
  await page.evaluate(async () => {
    const el = document.documentElement;
    for (let y = 0; y < el.scrollHeight; y += 400) {
      el.scrollTo({ top: y, behavior: "instant" });
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    el.scrollTo({ top: 0, behavior: "instant" });
  });
  // Force every picture to load now (some are lazy and below the fold) so the
  // check is deterministic, then wait — bounded, so one stuck image cannot hang
  // the suite.
  await page.evaluate(() => { for (const img of document.querySelectorAll("img")) img.loading = "eager"; });
  await page.waitForFunction(() => [...document.querySelectorAll("img")].every((img) => img.complete), null, { timeout: 25000, polling: 250 }).catch(() => {});
  const media = await page.evaluate(() => [...document.querySelectorAll("img")].map((img) => ({ src: img.currentSrc || img.src, w: img.naturalWidth })));
  assert.ok(media.length >= 13, `expected the hero, six service photos and six work photos, found ${media.length}`);
  const broken = media.filter((item) => item.w === 0);
  assert.deepEqual(broken, [], `images that failed or never loaded: ${broken.map((b) => b.src).join(", ") || "none"}`);
  // Independently confirm each distinct /images/ file answers 200 on the server.
  const paths = [...new Set(media.map((item) => item.src.match(/images%2F[a-z0-9-]+\.jpg/)?.[0]).filter(Boolean))];
  for (const path of paths) {
    const res = await page.request.get(`/_next/image?url=%2F${path}&w=640&q=75`);
    assert.equal(res.status(), 200, `optimizer request failed for ${path}`);
  }
  assert.ok(paths.length >= 7, `expected the seven distinct photos to be referenced, saw ${paths.length}`);
  // check() answers true for families that are simply not declared, so assert on the
  // loaded set instead: both self-hosted faces must exist and be actually used
  const fonts = await page.evaluate(() => {
    const families = new Set();
    document.fonts.forEach((face) => families.add(face.family));
    const h1 = document.querySelector("h1 > span");
    const body = document.body;
    return {
      families: [...families],
      display: h1 ? getComputedStyle(h1).fontFamily : "",
      body: getComputedStyle(body).fontFamily,
    };
  });
  assert.ok(fonts.families.includes("Freeze Display"), `display face missing: ${fonts.families.join(", ")}`);
  assert.ok(fonts.families.includes("Freeze Body"), `body face missing: ${fonts.families.join(", ")}`);
  assert.match(fonts.display, /Freeze Display/);
  assert.match(fonts.body, /Freeze Body/);
  ok(`${media.length} images decoded, no 404s, both self-hosted faces loaded and applied`);

  const marquee = await page.evaluate(() => {
    const track = document.querySelector(".marquee-track");
    const items = [...document.querySelectorAll(".marquee-item")].map((el) => el.textContent.trim());
    return { count: items.length, first: items[0] ?? null, anim: track ? getComputedStyle(track).animationName : "none" };
  });
  assert.ok(marquee.count >= 16, `marquee should hold the brand list twice for a seamless loop, saw ${marquee.count}`);
  assert.equal(marquee.anim, "marquee-run");

  const brokenAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((link) => link.getAttribute("href")).filter((href) => href.length > 1 && !document.getElementById(href.slice(1))));
  assert.deepEqual(brokenAnchors, []);
  ok("All internal navigation targets exist");

  // Inside the open assistant: no leftovers from the previous niche, in the parts
  // of the page a body-text scan never sees (dialog chrome, placeholders).
  await page.getByRole("button", { name: "Ask about your AC" }).click();
  await page.getByRole("dialog", { name: /assistant/i }).waitFor({ state: "visible", timeout: 8000 });
  const chrome = await page.evaluate(() => {
    const panel = document.querySelector(".chat-panel");
    const input = panel.querySelector("input");
    return `${panel.innerText} ${input?.getAttribute("placeholder") ?? ""}`;
  });
  for (const stale of ["Aquifer", "well", "drilling", "estimate form"]) {
    assert.ok(!new RegExp(stale, "i").test(chrome), `assistant chrome still says: ${stale}`);
  }
  assert.match(chrome, /Freeze Point Assistant/);
  ok("Assistant chrome is fully on-niche (title, greeting, placeholder)");

  // The greeting screen: what it says, the four starters, and the option menu —
  // each item of the menu has to actually do something, so each is measured.
  const greet = await page.evaluate(() => {
    const panel = document.querySelector(".chat-panel");
    return {
      lead: panel.querySelector(".chat-greet h2")?.innerText ?? "",
      hi: panel.querySelector(".chat-greet-hi")?.innerText ?? "",
      starters: [...panel.querySelectorAll(".chat-starters button")].map((b) => b.innerText.trim()),
      recent: Boolean(panel.querySelector(".chat-recent")),
      log: Boolean(panel.querySelector(".chat-log")),
      bubble: Boolean(panel.querySelector(".chat-row-assistant .chat-bubble")),
    };
  });
  assert.match(greet.lead, /How can we help\?/i);
  assert.match(greet.hi, /Hi there/);
  assert.equal(greet.starters.length, 4, `expected 4 starter buttons, got ${greet.starters.length}`);
  assert.equal(greet.recent, false, "a fresh visitor must not be shown a previous message they never had");
  assert.equal(greet.log, false, "the empty state should not render a transcript at all");
  assert.equal(greet.bubble, false, "the old greeting bubble came back — the screen replaced it");
  const startersLive = await page.evaluate(() => [...document.querySelectorAll(".chat-starters button")].every((b) => !b.disabled));
  assert.equal(startersLive, true, "a starter button is not clickable");
  ok(`Greeting screen: "${greet.hi}" → "${greet.lead}" with 4 starters, no fake history, no leftover bubble`);

  await page.getByRole("button", { name: "Chat options" }).click();
  const menu = await page.evaluate(() => [...document.querySelectorAll(".chat-menu [role='menuitem']")].map((b) => b.innerText.trim()));
  assert.deepEqual(menu.map((m) => m.toLowerCase()), ["expand window", "download transcript", "start a new chat"]);
  const narrow = await page.evaluate(() => Math.round(document.querySelector(".chat-panel").getBoundingClientRect().width));
  await page.getByRole("menuitem", { name: /expand window/i }).click();
  const wide = await page.evaluate(() => Math.round(document.querySelector(".chat-panel").getBoundingClientRect().width));
  assert.ok(wide > narrow + 120, `Expand window only moved ${wide - narrow}px (${narrow} → ${wide})`);
  // Nothing to save and nothing to clear yet, so both items must say so instead of
  // firing an empty download — a dead button is the one thing this widget bans.
  await page.getByRole("button", { name: "Chat options" }).click();
  const disabledNow = await page.evaluate(() =>
    [...document.querySelectorAll(".chat-menu [role='menuitem']")].map((b) => `${b.innerText.trim()}:${b.disabled}`));
  assert.deepEqual(disabledNow, ["Shrink window:false", "Download transcript:true", "Start a new chat:true"], disabledNow.join(", "));
  // shrink again, so every later measurement of the panel is of its default size
  await page.getByRole("menuitem", { name: /shrink window/i }).click();
  const back = await page.evaluate(() => Math.round(document.querySelector(".chat-panel").getBoundingClientRect().width));
  assert.equal(back, narrow, `Shrink window did not give the default width back (${back} vs ${narrow})`);
  ok(`Option menu works: Expand widens the panel ${narrow}px → ${wide}px (transcript + new chat wired to real actions)`);

  await page.getByRole("button", { name: "Add an emoji" }).click();
  const picked = await page.evaluate(() => document.querySelectorAll(".chat-emoji button").length);
  assert.ok(picked >= 8, `emoji picker showed ${picked} entries`);
  await page.locator(".chat-emoji button").first().click();
  const withEmoji = await page.getByRole("textbox", { name: "Your question" }).inputValue();
  assert.match(withEmoji, /\S/, "clicking an emoji did not reach the input");
  await page.getByRole("textbox", { name: "Your question" }).fill("");
  assert.equal(await page.evaluate(() => Boolean(document.querySelector(".chat-emoji"))), false, "the picker stayed open after picking");
  ok(`Emoji button works (${picked} faces, inserting into the field, closing after)`);

  // No file picker and no microphone: the composer offers exactly one tool besides
  // sending, because that is all this chat can act on.
  const composer = await page.evaluate(() => [...document.querySelectorAll(".chat-input button")].map((b) => b.getAttribute("aria-label")));
  assert.deepEqual(composer.filter((n) => n && !/emoji|send|stop/i.test(n)), [], `the composer offers buttons it cannot back up: ${composer.join(", ")}`);
  ok("Composer is text + emoji + send only — no attachment or voice control");

  await page.getByRole("button", { name: "Close chat" }).click();
  await page.waitForTimeout(250);

  // Regression guard: the answer must not begin inside a word (a streaming
  // scrubber once swallowed the leading capital I of "Installation cost …").
  await page.getByRole("button", { name: "Ask about your AC" }).click();
  await page.getByRole("dialog", { name: /assistant/i }).waitFor({ state: "visible", timeout: 8000 });
  await page.getByRole("textbox", { name: "Your question" }).fill("Reply with exactly one short sentence that starts with the word Installation.");
  await page.getByRole("button", { name: "Send your question" }).click();
  await page.waitForFunction(() => { const el = [...document.querySelectorAll(".chat-row-assistant .chat-bubble")].pop(); return !document.querySelector(".chat-send.is-stop") && el && el.textContent.trim().length > 12 && !document.querySelector(".chat-typing"); }, null, { timeout: 90000 }).catch(() => {});
  const firstWords = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".chat-row-assistant .chat-bubble")].pop();
    const text = (el?.textContent || "").trim();
    const panel = document.querySelector(".chat-panel");
    return { head: text.slice(0, 24), tagLeak: /think/.test(panel.innerText) };
  });
  assert.equal(firstWords.tagLeak, false, "a model tag reached the visible chat");
  const metaLine = await page.evaluate(() => document.querySelector(".chat-row-assistant .chat-meta")?.innerText ?? "");
  assert.match(metaLine, /Freeze Point · AI assistant · (just now|\d+[mh] ago)/, `attribution line reads ${JSON.stringify(metaLine)}`);
  // an eaten leading character shows up as a lowercase or clipped start; model
  // phrasing itself is not what this guards
  assert.match(firstWords.head.trim(), /^[A-Z]/, `answer begins mid-word: ${firstWords.head}`);
  ok(`Streamed answer keeps its first character and shows no tags ("${firstWords.head.trim()}")`);
  await page.getByRole("button", { name: "Close chat" }).click();
  await page.waitForTimeout(250);

  // Services, dialog, and the estimate request handed over from it.
  assert.equal(await page.locator(".service-card").count(), 6);
  await page.getByRole("button", { name: "Learn more about ac repair", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  assert.equal(await page.getByRole("heading", { name: "AC repair", exact: true }).count(), 2); // the card and the dialog
  await page.getByRole("button", { name: "Request an inspection for this" }).click();
  assert.equal(await page.getByLabel("What can we help you with?").inputValue(), "ac-repair");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  ok("Six services, service dialog, and a prefilled inspection request");

  // Work gallery carries real captions, FAQ opens and closes.
  assert.equal(await page.locator(".work-tile").count(), 6);
  assert.match(await page.locator(".work-tile figcaption").first().innerText(), /Clifton|Gulshan|Karachi|Nazimabad|Phase|Faisal/);
  await page.getByRole("button", { name: "Can you just refill the gas?", exact: true }).click();
  assert.equal(await page.locator("#faq-answer-2").isVisible(), true);
  assert.match(await page.locator("#faq-answer-2").innerText(), /not consumed|leaking/i);
  await page.getByRole("button", { name: "Can you just refill the gas?", exact: true }).click();
  assert.equal(await page.locator("#faq-answer-2").isVisible(), false);
  ok("Project gallery and FAQ accordion");

  // Real contact details must be present, and placeholder demo text gone.
  const body = await page.locator("body").innerText();
  assert.match(body, /0300 555 0142/);
  assert.match(body, /Shahrah-e-Faisal/);
  assert.match(body, /9 am – 9 pm|9 am–9 pm/);
  // This is a portfolio piece: it must say so honestly, and must not leak the
  // previous niche it was built from. "water" is deliberately not on the list —
  // condensate and dripping water are genuine AC complaints.
  assert.match(body, /Demonstration website/i);
  for (const stale of ["Aquifer", "Jacksonville", "\\bwell\\b", "drilling", "ZIP code", "Northeast Florida"]) {
    assert.ok(!new RegExp(stale, "i").test(body), `leftover copy from the old niche: ${stale}`);
  }
  ok("Real Karachi details, honest demo disclosure, and no leftovers from the old niche");

  // The booking form: validation first, then a successful request.
  await page.getByRole("button", { name: "Request a free inspection", exact: true }).first().click();
  await page.getByRole("button", { name: "Next: your details" }).click();
  assert.equal(await page.getByText("Please choose a service.").count(), 1);
  await page.getByLabel("What can we help you with?").selectOption("ac-gas");
  await page.getByLabel("Area of Karachi, or postal code", { exact: true }).fill("Gulshan-e-Iqbal");
  const preferredDate = await page.getByLabel("Your preferred date").getAttribute("min");
  await page.getByLabel("Your preferred date").fill(preferredDate);
  await page.getByLabel("Best time to connect").selectOption("morning");
  await page.getByRole("button", { name: "Next: your details" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Request my free inspection" }).click();
  assert.equal(await page.getByText("Enter a valid email address.").count(), 1);
  await page.getByLabel("Full name", { exact: true }).fill("Alex Rivera");
  await page.getByLabel("Email address", { exact: true }).fill(`freeze-smoke-${Date.now()}@example.com`);
  await page.getByLabel("Phone number", { exact: true }).fill("0311 555 0142");
  await page.getByLabel(/Anything else we should know/).fill("Smoke test request — please do not call this number.");
  await page.getByRole("checkbox").check();
  const requestPromise = page.waitForRequest((request) => request.url().includes("/api/bookings") && request.method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "Request my free inspection" }).click();
  const sentRequest = await requestPromise;
  await page.getByRole("heading", { name: "You’re on your way." }).waitFor({ timeout: 15000 });
  const reference = await page.locator(".reference").innerText();
  assert.match(reference, /^FP-[A-F0-9]{8}$/);
  await page.screenshot({ path: "artifacts/aquifer-confirmation.png" });
  ok(`Inspection request accepted with reference ${reference}`);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download your request summary" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), `Freeze Point-${reference}.txt`);
  ok("Downloadable inspection summary for the customer's records");

  const payload = sentRequest.postDataJSON();
  const duplicate = await page.request.post("/api/bookings", { data: payload });
  assert.equal(duplicate.status(), 200);
  assert.equal((await duplicate.json()).reference, reference);
  const invalid = await page.request.post("/api/bookings", { data: { ...payload, requestId: crypto.randomUUID(), email: "invalid", consent: false } });
  assert.equal(invalid.status(), 422);
  const invalidData = await invalid.json();
  assert.ok(invalidData.errors.email && invalidData.errors.consent);
  const crossOrigin = await page.request.post("/api/bookings", { headers: { Origin: "https://outside.example" }, data: payload });
  assert.equal(crossOrigin.status(), 403);
  const malformed = await page.request.post("/api/bookings", { headers: { "Content-Type": "application/json" }, data: "{bad" });
  assert.equal(malformed.status(), 400);
  const health = await page.request.get("/api/health");
  assert.equal(health.status(), 200);
  ok("API validation, origin protection, idempotency, and healthy status");
  await page.getByRole("button", { name: "Back to exploring" }).click();

  // Legal dialogs carry the real business language.
  await page.getByRole("button", { name: "Privacy policy", exact: true }).click();
  assert.equal(await page.getByRole("heading", { name: "Your privacy matters." }).count(), 1);
  const privacy = await page.getByRole("dialog").innerText();
  assert.match(privacy, /0300 555 0142/);
  assert.ok(!/fictional|demonstration brand/i.test(privacy));
  await page.getByRole("button", { name: "Got it" }).click();
  ok("Privacy dialog with the real phone and no demo language");

  // Nothing may scroll sideways at any supported width.
  for (const width of [1600, 1440, 1240, 1060, 900, 768, 440, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(120);
    const size = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    assert.ok(size.content <= size.viewport, `Horizontal overflow at ${width}px: ${size.content}px`);
    const clipped = await page.evaluate(() => [...document.querySelectorAll(".brand-word, h1, h2, .trust-stat > strong, .service-link")].filter((el) => el.scrollWidth > el.clientWidth + 2).map((el) => `${el.className}:${el.scrollWidth}>${el.clientWidth}`));
    assert.deepEqual(clipped, [], `text clipped at ${width}px: ${clipped.join(", ")}`);
  }
  ok("No horizontal overflow and no clipped text at ten widths");

  // Mobile: hamburger navigation and the compact header CTA.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.getByRole("button", { name: "Open navigation" }).click();
  assert.equal(await page.locator("#mobile-navigation").isVisible(), true);
  await page.locator("#mobile-navigation").getByRole("link", { name: "Our work" }).click();
  assert.equal(await page.locator("#mobile-navigation").count(), 0);
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.screenshot({ path: "artifacts/aquifer-mobile-booking.png" });
  await page.keyboard.press("Escape");
  ok("Mobile navigation, anchor hand-off, and dialog");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "artifacts/aquifer-desktop.png" });
  await page.screenshot({ path: "artifacts/aquifer-full-page.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "artifacts/aquifer-mobile.png" });

  // ── The assistant books an inspection on its own, through the UI ────────
  await page.evaluate(() => document.documentElement.scrollTo({ top: 0, behavior: "instant" }));
  await page.setViewportSize({ width: 1456, height: 900 });
  await page.getByRole("button", { name: "Ask about your AC" }).click();
  const assistant = page.getByRole("dialog", { name: /assistant/i });
  await assistant.waitFor({ state: "visible", timeout: 8000 });

  const settle = () =>
    page.waitForFunction(
      () => {
        const bubble = [...document.querySelectorAll(".chat-row-assistant .chat-bubble")].pop();
        const streaming = Boolean(document.querySelector(".chat-send.is-stop"));
        return !streaming && bubble && bubble.textContent.trim().length > 20 && !document.querySelector(".chat-typing");
      },
      null,
      { timeout: 120000 },
    );
  const answer = async (text) => {
    await page.getByRole("textbox", { name: "Your question" }).fill(text);
    await page.getByRole("button", { name: "Send your question" }).click();
    await settle();
  };
  const clickChip = async (label) => {
    await page.getByRole("dialog", { name: /assistant/i }).getByRole("button", { name: label, exact: true }).click();
    await settle();
  };

  await answer("I want to book an inspection");
  await clickChip("Inverter board fault");
  await answer("12");
  assert.match(await page.getByRole("dialog", { name: /assistant/i }).innerText(), /your area/i, "an unusable area was accepted without a re-ask");
  await answer("Gulshan-e-Iqbal");
  await clickChip("Tomorrow");
  await clickChip("Morning · 9 am–1 pm");
  await answer("Ayesha Khan");
  await answer(`smoke-${Date.now()}@example.com`);
  await answer("0300 555 0142");
  await clickChip("Skip");
  await clickChip("Yes, go ahead");
  const readback = await page.locator(".chat-row-assistant .chat-bubble").last().innerText();
  assert.match(readback, /Here's what I've got/);
  assert.match(readback, /Service:|Area:|Preferred date:/);
  await clickChip("Yes, send it");
  const bookedRef = (await page.locator(".chat-booked-ref").innerText().catch(() => "")).trim();
  assert.match(bookedRef, /^FP-[A-F0-9]{8}$/, `chat did not return a reference (got "${bookedRef}")`);
  ok(`Assistant booked an inspection on its own — reference ${bookedRef}`);

  // Stability: the box must not jump when a long reply arrives or the chip row
  // appears and disappears — that shift is what read as "unstable" on a PC.
  const box = () =>
    page.evaluate(() => {
      const r = document.querySelector(".chat-panel").getBoundingClientRect();
      const log = document.querySelector(".chat-log");
      return {
        top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height),
        logPad: Math.round(log.getBoundingClientRect().width), gutter: getComputedStyle(log).scrollbarGutter,
      };
    });
  const beforeBox = await box();
  await page.getByRole("textbox", { name: "Your question" }).fill("Tell me in detail how a new screen well works in Florida sand, step by step.");
  await page.getByRole("button", { name: "Send your question" }).click();
  await page.waitForFunction(() => { const el = [...document.querySelectorAll(".chat-row-assistant .chat-bubble")].pop(); return !document.querySelector(".chat-send.is-stop") && el && el.textContent.trim().length > 120 && !document.querySelector(".chat-typing"); }, null, { timeout: 60000 });
  const afterLong = await box();

  await page.getByRole("textbox", { name: "Your question" }).fill("ok book me");
  await page.getByRole("button", { name: "Send your question" }).click();
  await page.waitForFunction(() => Boolean(document.querySelector(".chat-chips.is-flow")), null, { timeout: 40000 });
  const withChips = await box();
  const meterSeen = await page.locator(".chat-meter i").count();

  await clickChip("AC repair — not cooling or making noise");
  await settle();
  await page.getByRole("textbox", { name: "Your question" }).fill("cancel");
  await page.getByRole("button", { name: "Send your question" }).click();
  // the meter disappears when the flow ends; the "Start over" chip stays by design
  // wait for the words themselves, not for a DOM side-effect that can land first
  await page.getByRole("dialog", { name: /assistant/i }).getByText(/nothing was saved/i).waitFor({ timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector(".chat-meter"), null, { timeout: 20000 });
  const afterCancel = await box();

  const states = [["a long reply", afterLong], ["the chip row and meter", withChips], ["cancelling the flow", afterCancel]];
  for (const [name, state] of states) {
    assert.equal(state.top, beforeBox.top, `panel top moved ${state.top - beforeBox.top}px after ${name}`);
    assert.equal(state.h, beforeBox.h, `panel height changed ${state.h - beforeBox.h}px after ${name}`);
    assert.equal(state.left, beforeBox.left, `panel shifted horizontally after ${name}`);
    assert.equal(state.w, beforeBox.w, `panel width changed after ${name}`);
    assert.equal(state.logPad, beforeBox.logPad, `text column re-flowed after ${name}`);
  }
  assert.ok(meterSeen >= 10, `expected a 10-segment meter, saw ${meterSeen}`);
  assert.match(beforeBox.gutter, /stable/, "scrollbar gutter is not reserved, so text shifts when the bar appears");
  ok(`Panel holds still on desktop: ${beforeBox.w}×${beforeBox.h}px through a long reply, the chip row and a cancel — no shift at all`);

  // Desktop must not be cramped or cut off any more.
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector(".chat-panel");
    const log = document.querySelector(".chat-log");
    const r = panel.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      fitsViewport: r.bottom <= innerHeight + 1 && r.top >= -1,
      logScrollable: log.scrollHeight >= log.clientHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      meter: document.querySelectorAll(".chat-meter i").length,
    };
  });
  assert.ok(geometry.width >= 500, `desktop assistant panel is only ${geometry.width}px wide`);
  assert.equal(geometry.fitsViewport, true, "the assistant panel runs past the viewport on desktop");
  assert.equal(geometry.overflow, 0, "the assistant adds horizontal overflow on desktop");
  ok(`Desktop assistant is roomy (${geometry.width}px, panel fully on screen, log scrolls)`);

  // There is one assistant surface now. The route has to be gone, not an empty shell,
  // and nothing on the site may still point at it.
  const gone = await page.request.get(`${baseURL}/assistant`);
  assert.equal(gone.status(), 404, `/assistant answers ${gone.status()} — the page was meant to be deleted`);
  const dangling = await page.evaluate(() => [...document.querySelectorAll("a[href=\"/assistant\"]")].length);
  assert.equal(dangling, 0, `${dangling} link(s) still point at the deleted assistant page`);
  ok("/assistant is deleted (404) and no link on the page still references it");

  // Reload with a conversation behind it: the greeting must offer it back, and only
  // hand it over when the visitor takes it.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Ask about your AC" }).click();
  await page.getByRole("dialog", { name: /assistant/i }).waitFor({ state: "visible", timeout: 8000 });
  const resume = await page.evaluate(() => {
    const card = document.querySelector(".chat-recent");
    return {
      card: Boolean(card),
      line: card?.querySelector(".chat-recent-line")?.innerText ?? "",
      label: card?.querySelector(".chat-recent-top strong")?.innerText ?? "",
      bubbles: document.querySelectorAll(".chat-bubble").length,
    };
  });
  assert.equal(resume.card, true, "a reload lost the recent-message card");
  assert.match(resume.label, /recent message/i);
  assert.ok(resume.line.length > 20, `the card preview is empty — got ${JSON.stringify(resume.line)}`);
  assert.equal(resume.bubbles, 0, "the transcript came back before it was asked for");
  await page.screenshot({ path: "artifacts/assistant-greeting.png" });
  await page.locator(".chat-recent").click();
  const restored = await page.evaluate(() => ({
    bubbles: document.querySelectorAll(".chat-row-assistant .chat-bubble").length,
    greet: Boolean(document.querySelector(".chat-greet")),
    log: Boolean(document.querySelector(".chat-log")),
  }));
  assert.ok(restored.bubbles >= 2, `picking the chat back up restored ${restored.bubbles} answers`);
  assert.equal(restored.greet, false, "the greeting screen stayed after resuming");
  assert.equal(restored.log, true, "no transcript rendered after resuming");
  ok(`Reload hands the chat back through the card, on request (${restored.bubbles} assistant turns restored)`);

  await page.getByRole("button", { name: "Chat options" }).click();
  const [chatDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("menuitem", { name: /download transcript/i }).click(),
  ]);
  const savedTo = await chatDownload.path();
  const file = await import("node:fs/promises").then((fs) => fs.readFile(savedTo, "utf8"));
  assert.match(chatDownload.suggestedFilename(), /^Freeze Point-chat-\d{4}-\d{2}-\d{2}\.txt$/);
  assert.match(file, /Freeze Point AC Care — chat transcript/);
  assert.match(file, /^You · \d{2}:\d{2}$/m);
  assert.match(file, /FP-[A-F0-9]{8}|No request was submitted/, "the transcript neither carries the reference nor says there is none");
  ok(`Transcript downloads as a real file (${chatDownload.suggestedFilename()}, ${file.split("\n").length} lines, reference included)`);

  await page.getByRole("button", { name: "Chat options" }).click();
  await page.getByRole("menuitem", { name: /start a new chat/i }).click();
  const wiped = await page.evaluate(() => ({
    bubbles: document.querySelectorAll(".chat-bubble").length,
    greet: Boolean(document.querySelector(".chat-greet")),
    stored: sessionStorage.getItem("freezepoint.chat.v1"),
  }));
  assert.equal(wiped.bubbles, 0, "Start a new chat left messages on screen");
  assert.equal(wiped.greet, true, "Start a new chat did not return to the greeting");
  assert.ok(!wiped.stored || JSON.parse(wiped.stored).turns.length === 0, `the tab copy survived: ${wiped.stored?.slice(0, 60)}`);
  ok("Start a new chat clears the panel and the tab copy, as the privacy dialog says");
  await page.screenshot({ path: "artifacts/assistant-panel.png" });

  await page.setViewportSize({ width: 1456, height: 900 });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);

  // Motion layer: nothing may stay invisible, and the reduced-motion path must
  // show everything immediately. Measured at desktop width after a full instant
  // sweep, so "not yet scrolled to" can never be mistaken for "never revealed".
  await page.setViewportSize({ width: 1456, height: 900 });
  await page.evaluate(async () => {
    const el = document.documentElement;
    for (let y = 0; y <= el.scrollHeight; y += 450) {
      el.scrollTo({ top: y, behavior: "instant" });
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
  });
  await page.waitForTimeout(400);
  const revealState = await page.evaluate(() => {
    const all = [...document.querySelectorAll("[data-reveal]")];
    return { total: all.length, stuck: all.filter((el) => !el.hasAttribute("data-shown")).map((el) => el.className.slice(0, 34)) };
  });
  assert.ok(revealState.total > 45, `expected the page to be reveal-wired, found ${revealState.total}`);
  assert.deepEqual(revealState.stuck, [], `elements never revealed: ${revealState.stuck.join(", ")}`);
  const visible = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].every((el) => Number(getComputedStyle(el).opacity) > 0.98));
  assert.equal(visible, true, "some revealed elements are still transparent");

  // Motion is desktop-only by design, so measure it at a desktop width first.
  await page.setViewportSize({ width: 1456, height: 900 });
  await page.waitForTimeout(250);
  // ── New motion: parallax, rail, lightbox, before/after, cursor haze ─────
  const motionChecks = await page.evaluate(() => {
    const px = document.querySelector("[data-parallax]");
    const railOn = document.querySelectorAll(".process-rail i.is-on").length;
    return {
      parallaxVar: px ? (px.getAttribute("style") || "") : "missing",
      hasParallaxNodes: document.querySelectorAll("[data-parallax]").length,
      railSegments: document.querySelectorAll(".process-rail i").length,
      railOn,
      mist: Boolean(document.getElementById("cold-mist")),
      slider: Boolean(document.querySelector(".ba-handle[role='slider']")),
    };
  });
  assert.ok(motionChecks.hasParallaxNodes >= 7, `expected hero + six service images to be parallax-wired, saw ${motionChecks.hasParallaxNodes}`);
  assert.equal(motionChecks.mist, true, "the cursor haze is missing on a fine pointer");
  assert.equal(motionChecks.slider, true, "the before/after handle is missing");

  await page.evaluate(() => document.querySelector("#process")?.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(700);
  const railNow = await page.evaluate(() => document.querySelectorAll(".process-rail i.is-on").length);
  assert.ok(railNow >= 1 && railNow <= motionChecks.railSegments, `rail progress out of range: ${railNow}/${motionChecks.railSegments}`);
  assert.match(await page.evaluate(() => document.querySelector("[data-parallax]")?.getAttribute("style") ?? ""), /--py: -?\d+(\.\d+)?/, "parallax never wrote a value");
  ok(`Parallax driving ${motionChecks.hasParallaxNodes} layers, process rail at ${railNow}/${motionChecks.railSegments}, cursor haze mounted`);

  // cursor haze follows the pointer
  const before = await page.evaluate(() => document.getElementById("cold-mist")?.style.transform ?? "");
  await page.mouse.move(300, 300); await page.waitForTimeout(120);
  await page.mouse.move(1000, 620); await page.waitForTimeout(450);
  const after = await page.evaluate(() => ({ t: document.getElementById("cold-mist")?.style.transform ?? "", on: document.getElementById("cold-mist")?.classList.contains("is-on") }));
  assert.notEqual(after.t, before, "the haze did not move with the pointer");
  assert.equal(after.on, true, "the haze never switched on");

  // lightbox: shared-element zoom + keyboard + focus return
  await page.evaluate(() => document.querySelector("#work")?.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(300);
  await page.locator(".work-tile button").first().click();
  await page.getByRole("dialog", { name: /open photo|clifton/i }).waitFor({ state: "visible", timeout: 6000 }).catch(async () => {
    await page.locator(".work-lightbox").waitFor({ state: "visible", timeout: 4000 });
  });
  const lb = await page.evaluate(() => {
    const img = document.querySelector(".work-lightbox-figure img");
    return {
      open: Boolean(document.querySelector(".work-lightbox")),
      locked: document.body.style.overflow,
      // the FLIP must be the only thing animating: a duplicated view-transition-name
      // is what made the browser abort the transition and log an error on every open
      staleNames: document.querySelectorAll("[style*='view-transition-name']").length,
      animating: typeof img?.getAnimations === "function" ? img.getAnimations().length : 0,
      radius: img ? getComputedStyle(img).borderRadius : "none",
    };
  });
  assert.equal(lb.open, true, "the lightbox did not open");
  assert.equal(lb.locked, "hidden", "background scroll was not locked while the lightbox was open");
  assert.equal(lb.staleNames, 0, "a stray view-transition-name is still set");
  assert.notEqual(lb.radius, "0px", "the lightbox image lost its rounding");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(350);
  assert.match(await page.locator(".work-lightbox-bar span").first().innerText(), /2 \/ 6/, "arrow keys do not page through the gallery");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".work-lightbox").count(), 0, "Escape did not close the lightbox");
  ok("Lightbox: FLIP-zooms from the clicked tile, pages with arrows, locks scroll, closes on Escape");

  // before/after: keyboard and pointer both move the divider
  await page.evaluate(() => document.querySelector(".ba")?.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(400);
  await page.locator(".ba-handle").focus();
  const startAt = await page.evaluate(() => document.querySelector(".ba-clip").style.width);
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  const keyAt = await page.evaluate(() => document.querySelector(".ba-clip").style.width);
  assert.notEqual(keyAt, startAt, "arrow keys do not move the comparison handle");
  const baBox = await page.locator(".ba").boundingBox();
  await page.mouse.move(baBox.x + baBox.width * 0.78, baBox.y + baBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(baBox.x + baBox.width * 0.22, baBox.y + baBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const dragAt = await page.evaluate(() => ({ w: document.querySelector(".ba-clip").style.width, aria: document.querySelector(".ba-handle").getAttribute("aria-valuenow") }));
  assert.ok(parseFloat(dragAt.w) < 35, `drag did not close the before side (${dragAt.w})`);
  assert.equal(dragAt.aria, Math.round(parseFloat(dragAt.w)).toString(), "aria-valuenow drifted from the visual position");
  ok(`Before/after slider responds to keys and drag (${startAt} → ${dragAt.w}, announced as ${dragAt.aria}%)`);

  // on a phone: the haze is not mounted at all and parallax writes no transform
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const phoneState = await page.evaluate(() => ({
    mist: Boolean(document.getElementById("cold-mist")),
    pxTransform: (() => { const el = document.querySelector("[data-parallax]"); return el ? getComputedStyle(el).transform : "none"; })(),
    baCursor: getComputedStyle(document.querySelector(".ba")).cursor,
  }));
  assert.equal(phoneState.mist, false, "the cursor haze is still mounted in a narrow window");
  assert.ok(phoneState.pxTransform === "none" || phoneState.pxTransform.endsWith(") 0px)"), `parallax still transforming on mobile: ${phoneState.pxTransform}`);
  ok("Phone: no cursor haze, parallax transform neutralised");
  await page.setViewportSize({ width: 1456, height: 900 });
  await page.waitForTimeout(200);

  // Motion state is only meaningful mid-page: scroll to 60% and let the
  // rAF-throttled listener run before reading --scroll and the compact header.
  await page.evaluate(() => document.documentElement.scrollTo({ top: Math.round(document.documentElement.scrollHeight * 0.6), behavior: "instant" }));
  await page.waitForTimeout(400);
  const motion = await page.evaluate(() => {
    const ring = document.querySelector(".contours-ring");
    const rotor = document.querySelector(".contours-rotor");
    const runs = (el) => (el ? getComputedStyle(el).animationName : "none");
    return {
      rings: document.querySelectorAll(".contours-ring").length,
      ringAnim: runs(ring),
      rotorAnim: runs(rotor),
      heroAnim: runs(document.querySelector(".hero-image > img")),
      progress: getComputedStyle(document.documentElement).getPropertyValue("--scroll").trim(),
      scrolledClass: document.querySelector(".site-header").className.includes("is-scrolled"),
      stats: [...document.querySelectorAll(".trust-stat > strong")].map((el) => el.textContent.trim()),
    };
  });
  assert.equal(motion.rings, 26, "each of the two contour panels should carry 13 animated rings");
  assert.equal(motion.ringAnim, "contour-breathe");
  assert.equal(motion.rotorAnim, "contour-drift");
  assert.equal(motion.heroAnim, "hero-breathe");
  assert.ok(Number(motion.progress) > 0.5, `reading progress line did not advance (${motion.progress})`);
  assert.equal(motion.scrolledClass, true, "header never compacted on scroll");
  assert.match(motion.stats.join(" "), /11\+|11/);
  assert.match(motion.stats.join(" "), /9,400\+?/);
  ok(`Motion live: ${motion.rings} contour rings drifting, hero breathing, brand marquee running, stats ${motion.stats[0]}/${motion.stats[1]}, progress ${(Number(motion.progress) * 100).toFixed(0)}%`);

  // Touch/small screens: ONLY the contour rings stop. Everything else a user sees
  // as "the site is alive" must keep running on a phone.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const phone = await page.evaluate(() => {
    const name = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).animationName : "missing"; };
    return {
      rotor: name(".difference-contours .contours-rotor"),
      ctaRotor: name(".cta-contours .contours-rotor"),
      ring: name(".cta-contours .contours-ring"),
      hero: name(".hero-image > img"),
      blur: getComputedStyle(document.querySelector(".site-header")).backdropFilter,
      running: document.getAnimations().filter((a) => a.playState === "running").length,
    };
  });
  assert.equal(phone.rotor, "none", "the navy-section Contours still drift on a phone");
  assert.equal(phone.ctaRotor, "none", "the closing-panel Contours still drift on a phone");
  assert.equal(phone.ring, "none", "contour rings still breathe on a phone");
  assert.equal(phone.hero, "hero-breathe", "the hero photograph stopped animating on a phone");
  assert.notEqual(phone.blur, "none", "the header blur was removed on a phone");
  assert.ok(phone.running > 0, "no animation is running on a phone at all");
  ok(`Mobile 390px: both Contours panels are still, ${phone.running} other animations still running`);
  await page.setViewportSize({ width: 1456, height: 900 });
  await page.waitForTimeout(200);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const calm = await page.evaluate(() => {
    const els = [...document.querySelectorAll("[data-reveal]")];
    return {
      hidden: els.filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length,
      ringAnim: getComputedStyle(document.querySelector(".contours-ring")).animationDuration,
      heroAnim: getComputedStyle(document.querySelector(".hero-image > img")).animationDuration,
    };
  });
  assert.equal(calm.hidden, 0, `${calm.hidden} elements would be invisible with reduced motion on`);
  assert.ok(parseFloat(calm.ringAnim) < 0.02 && parseFloat(calm.heroAnim) < 0.02, "animations not neutralised under reduced motion");
  ok("prefers-reduced-motion: content visible, animation off");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // ── Area pages ───────────────────────────────────────────────────────────
  // The locality pages are generated from serviceAreas, so the check is that they
  // exist, are linked from the home page, carry valid structured data, and hand the
  // visitor back to the one booking dialog — with the area already filled in.
  await page.setViewportSize({ width: 1456, height: 900 });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  const stripLinks = await page.locator(".home-areas a").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
  assert.ok(stripLinks.length >= 7, `the home page links ${stripLinks.length} areas, expected the list plus "All areas"`);
  assert.equal(new Set(stripLinks).size, stripLinks.length, "the areas strip on the home page repeats a link");
  ok(`Home page links every area page (${stripLinks.length} links, no duplicates)`);

  await page.goto(`${baseURL}/areas`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  const areasIndex = await page.evaluate(() => ({
    cards: document.querySelectorAll(".area-card").length,
    hrefs: [...document.querySelectorAll(".area-card")].map((el) => el.getAttribute("href")),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    title: document.title,
  }));
  assert.match(areasIndex.title, /^AC repair areas in Karachi/);
  assert.ok(areasIndex.cards >= 6, `/areas shows ${areasIndex.cards} cards, expected 6`);
  assert.equal(areasIndex.overflow, 0, "/areas overflows horizontally");
  ok(`/areas lists ${areasIndex.cards} areas, no overflow`);

  await page.goto(`${baseURL}/areas/clifton`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  const clifton = await page.evaluate(() => {
    const json = [...document.querySelectorAll('script[type="application/ld+json"]')].map((el) => {
      try { return JSON.parse(el.textContent ?? ""); } catch { return { broken: true }; }
    });
    const graph = json.flatMap((entry) => entry["@graph"] ?? [entry]).map((entry) => entry["@type"]);
    return {
      h1: document.querySelector("h1")?.innerText ?? "",
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
      faq: document.querySelectorAll(".area-faq details").length,
      nearby: [...document.querySelectorAll(".area-nearby-link")].map((el) => el.getAttribute("href")),
      graph,
      broken: json.some((entry) => entry.broken),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "",
    };
  });
  assert.match(clifton.h1, /Clifton/);
  assert.ok(clifton.canonical.endsWith("/areas/clifton"), `canonical is ${clifton.canonical}`);
  assert.equal(clifton.broken, false, "the JSON-LD on the area page is not parseable");
  for (const type of ["Service", "FAQPage", "BreadcrumbList"]) {
    assert.ok(clifton.graph.includes(type), `area page schema is missing ${type} — got ${clifton.graph.join(", ")}`);
  }
  assert.ok(clifton.faq >= 3, `only ${clifton.faq} questions on the area page`);
  assert.equal(clifton.overflow, 0, "the area page overflows horizontally");
  assert.match(clifton.ogImage, /og\.jpg$/, `og:image is ${clifton.ogImage}`);
  for (const href of clifton.nearby) assert.ok(href === "/areas" || /^\/areas\/[a-z-]+$/.test(href ?? ""), `odd cross-link ${href}`);
  await page.screenshot({ path: "artifacts/area-clifton.png" });
  ok(`Area page: ${clifton.faq} local questions, schema (${clifton.graph.filter((t) => t !== "LocalBusiness").join("+")}), ${clifton.nearby.length} cross-links, og:image`);

  await page.goto(`${baseURL}/areas/north-nazimabad`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(200);
  await page.locator(".sub-hero-actions a.button-primary, .sub-hero-actions a").first().click();
  await page.waitForTimeout(600);
  const handoff = await page.evaluate(() => {
    const area = document.getElementById("booking-area");
    return {
      dialog: Boolean(document.querySelector(".modal")),
      url: location.pathname + location.search,
      area: area ? area.value : null,
      step1: Boolean(document.querySelector("#booking-area")),
    };
  });
  assert.equal(handoff.dialog, true, "the area page's CTA did not open the booking dialog");
  assert.equal(handoff.url, "/", `the handoff did not land on the home page — it is at ${handoff.url}`);
  assert.equal(handoff.step1, true, "the dialog did not open on the details step");
  assert.match(handoff.area ?? "", /^North Nazimabad$/, `the area was not prefilled — field holds ${JSON.stringify(handoff.area)}`);
  ok(`Area CTA hands over to the one booking dialog with the area prefilled ("${handoff.area}")`);

  const unknown = await page.request.get(`${baseURL}/areas/nowhere-land`);
  assert.equal(unknown.status(), 404, `an unknown area returned ${unknown.status()} instead of 404`);
  const sitemap = await (await page.request.get(`${baseURL}/sitemap.xml`)).text();
  const inSitemap = ["/areas", ...["clifton", "dha", "gulshan-e-iqbal", "north-nazimabad", "malir", "saddar-shahrah"].map((slug) => `/areas/${slug}`)];
  const missing = inSitemap.filter((href) => !sitemap.includes(href));
  assert.equal(missing.length, 0, `sitemap is missing ${missing.join(", ")}`);
  ok(`Unknown area 404s, and all 7 area URLs are in sitemap.xml`);

  assert.deepEqual(failedRequests, [], `failed network requests: ${failedRequests.join(", ")}`);
  assert.deepEqual(errors, [], `client errors: ${errors.join(", ")}`);
  ok("Zero failed requests and zero client errors");
  console.log(`\n${results.length} smoke checks passed.`);
} finally {
  await browser.close();
}
