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
  assert.match(await page.title(), /^Aquifer Reach LLC/);
  assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
  ok(`Homepage renders with the real business title`);

  // Every picture the page asks for must actually load — this is what breaks
  // when public/images is missing or a path is wrong. Photos below the fold are
  // lazily loaded, so walk the page first and wait for every image to settle.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
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

  const brokenAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((link) => link.getAttribute("href")).filter((href) => href.length > 1 && !document.getElementById(href.slice(1))));
  assert.deepEqual(brokenAnchors, []);
  ok("All internal navigation targets exist");

  // Services, dialog, and the estimate request handed over from it.
  assert.equal(await page.locator(".service-card").count(), 6);
  await page.getByRole("button", { name: "Learn more about rock wells", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  assert.equal(await page.getByRole("heading", { name: "Rock wells", exact: true }).count(), 2); // the card and the dialog
  await page.getByRole("button", { name: "Request an estimate for this" }).click();
  assert.equal(await page.getByLabel("What can we help you with?").inputValue(), "rock-wells");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  ok("Six services, service dialog, and prefilled estimate request");

  // Work gallery carries real captions, FAQ opens and closes.
  assert.equal(await page.locator(".work-tile").count(), 6);
  assert.match(await page.locator(".work-tile figcaption").first().innerText(), /Jacksonville|site|rig|casing|pressure|light/i);
  await page.getByRole("button", { name: "What does a new well cost?", exact: true }).click();
  assert.equal(await page.locator("#faq-answer-3").isVisible(), true);
  await page.getByRole("button", { name: "What does a new well cost?", exact: true }).click();
  assert.equal(await page.locator("#faq-answer-3").isVisible(), false);
  ok("Project gallery and FAQ accordion");

  // Real contact details must be present, and placeholder demo text gone.
  const body = await page.locator("body").innerText();
  assert.match(body, /\(904\) 477-9809/);
  assert.match(body, /646 E 21st St, Jacksonville, FL 32206/);
  assert.match(body, /14404 Bartram Creek Blvd/);
  assert.ok(!/demo|illustrative sample|fictional|lorem/i.test(body.replace(/demonstrat\w*|democracy/gi, "")), "leftover demo/fictional wording on the page");
  ok("Real phone, both addresses, and no demo/fictional copy left");

  // The booking form: validation first, then a successful request.
  await page.getByRole("button", { name: "Request your free estimate", exact: true }).first().click();
  await page.getByRole("button", { name: "Next: your details" }).click();
  assert.equal(await page.getByText("Please choose a service.").count(), 1);
  await page.getByLabel("What can we help you with?").selectOption("pump-installation");
  await page.getByLabel("Property ZIP code", { exact: true }).fill("32256");
  const preferredDate = await page.getByLabel("Your preferred date").getAttribute("min");
  await page.getByLabel("Your preferred date").fill(preferredDate);
  await page.getByLabel("Best time to connect").selectOption("morning");
  await page.getByRole("button", { name: "Next: your details" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Request my free estimate" }).click();
  assert.equal(await page.getByText("Enter a valid email address.").count(), 1);
  await page.getByLabel("Full name", { exact: true }).fill("Alex Rivera");
  await page.getByLabel("Email address", { exact: true }).fill(`aquifer-smoke-${Date.now()}@example.com`);
  await page.getByLabel("Phone number", { exact: true }).fill("(904) 555-0142");
  await page.getByLabel(/Anything else we should know/).fill("Smoke test request. Please do not call this number.");
  await page.getByRole("checkbox").check();
  const requestPromise = page.waitForRequest((request) => request.url().includes("/api/bookings") && request.method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "Request my free estimate" }).click();
  const sentRequest = await requestPromise;
  await page.getByRole("heading", { name: "You’re on your way." }).waitFor({ timeout: 15000 });
  const reference = await page.locator(".reference").innerText();
  assert.match(reference, /^AQ-[A-F0-9]{8}$/);
  await page.screenshot({ path: "artifacts/aquifer-confirmation.png" });
  ok(`Estimate request accepted with reference ${reference}`);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download your request summary" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), `Aquifer-${reference}.txt`);
  ok("Downloadable estimate summary for the customer's records");

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
  assert.match(privacy, /\(904\) 477-9809/);
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
  await page.getByRole("button", { name: "Estimate", exact: true }).click();
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

  assert.deepEqual(failedRequests, [], `failed network requests: ${failedRequests.join(", ")}`);
  assert.deepEqual(errors, [], `client errors: ${errors.join(", ")}`);
  ok("Zero failed requests and zero client errors");
  console.log(`\n${results.length} smoke checks passed.`);
} finally {
  await browser.close();
}
