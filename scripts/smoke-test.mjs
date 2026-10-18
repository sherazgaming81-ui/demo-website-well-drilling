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
  const fontLoaded = await page.evaluate(() => document.fonts.check('700 16px "DM Sans"'));
  assert.equal(fontLoaded, true, "self-hosted DM Sans did not load");
  ok(`${media.length} images decoded, no 404s, DM Sans active`);

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
  await page.getByRole("button", { name: "Close chat" }).click();
  await page.waitForTimeout(250);

  // Regression guard: the answer must not begin inside a word (a streaming
  // scrubber once swallowed the leading capital I of "Installation cost …").
  await page.getByRole("button", { name: "Ask about your AC" }).click();
  await page.getByRole("dialog", { name: /assistant/i }).waitFor({ state: "visible", timeout: 8000 });
  await page.getByRole("textbox", { name: "Your question" }).fill("Reply with exactly one short sentence that starts with the word Installation.");
  await page.getByRole("button", { name: "Send your question" }).click();
  await page.waitForFunction(() => { const el = [...document.querySelectorAll(".chat-row-assistant .chat-bubble")].pop(); return el && el.textContent.trim().length > 12 && !document.querySelector(".chat-typing"); }, null, { timeout: 90000 }).catch(() => {});
  const firstWords = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".chat-row-assistant .chat-bubble")].pop();
    const text = (el?.textContent || "").trim();
    const panel = document.querySelector(".chat-panel");
    return { head: text.slice(0, 24), tagLeak: /think/.test(panel.innerText) };
  });
  assert.equal(firstWords.tagLeak, false, "a model tag reached the visible chat");
  assert.match(firstWords.head, /Installation|install|\bI\b/, `answer begins mid-word: ${firstWords.head}`);
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
        return bubble && bubble.textContent.trim().length > 20 && !document.querySelector(".chat-typing");
      },
      null,
      { timeout: 45000 },
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
  await page.waitForFunction(() => { const el = [...document.querySelectorAll(".chat-row-assistant .chat-bubble")].pop(); return el && el.textContent.trim().length > 120 && !document.querySelector(".chat-typing"); }, null, { timeout: 60000 });
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

  // The standalone page.
  await page.goto(`${baseURL}/assistant`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("heading", { name: "Ask the assistant" }).count(), 1);
  const pageGeom = await page.evaluate(() => {
    const panel = document.querySelector(".chat-panel.is-page");
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    return { width: Math.round(r.width), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  assert.ok(pageGeom && pageGeom.width >= 700, `assistant page panel is only ${pageGeom?.width}px wide`);
  assert.equal(pageGeom?.overflow, 0, "the assistant page overflows horizontally");
  await page.getByRole("textbox", { name: "Your question" }).fill("Do you cover St Augustine?");
  await page.getByRole("button", { name: "Send your question" }).click();
  await settle();
  const onPage = await page.locator(".chat-row-assistant .chat-bubble").last().innerText();
  assert.ok(onPage.length > 30, "the assistant page did not answer");
  await page.screenshot({ path: "artifacts/assistant-page.png" });
  ok(`Assistant page works on its own (${pageGeom.width}px panel, answered in ${onPage.split(" ").length} words)`);

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

  assert.deepEqual(failedRequests, [], `failed network requests: ${failedRequests.join(", ")}`);
  assert.deepEqual(errors, [], `client errors: ${errors.join(", ")}`);
  ok("Zero failed requests and zero client errors");
  console.log(`\n${results.length} smoke checks passed.`);
} finally {
  await browser.close();
}
