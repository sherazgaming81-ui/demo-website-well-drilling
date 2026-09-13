import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.TEST_URL || "http://127.0.0.1:3000";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, baseURL });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const results = [];
const ok = (text) => { results.push(text); console.log(`PASS ${text}`); };
try {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.title(), "Aquifer Well Co. | Good Water. From the Ground Up.");
  assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
  await page.screenshot({ path: "artifacts/aquifer-desktop.png" });
  await page.screenshot({ path: "artifacts/aquifer-full-page.png", fullPage: true });
  ok("Homepage, fonts, and image rendering");

  const brokenAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((link) => link.getAttribute("href")).filter((href) => href.length > 1 && !document.getElementById(href.slice(1))));
  assert.deepEqual(brokenAnchors, []);
  ok("All internal navigation targets exist");

  await page.getByRole("button", { name: "Learn more about residential wells", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  assert.equal(await page.getByRole("heading", { name: "Residential wells", exact: true }).count(), 2);
  await page.getByRole("button", { name: "Explore your options—free" }).click();
  assert.equal(await page.getByLabel("What can we help you with?").inputValue(), "residential");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  ok("Service details, preselected booking, and Escape dismissal");

  await page.getByRole("button", { name: "Next customer story" }).click();
  assert.equal(await page.getByText("James R.", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "Previous customer story" }).click();
  assert.equal(await page.getByText("Mark & Sarah T.", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "What does a new well cost?", exact: true }).click();
  assert.equal(await page.locator("#faq-answer-2").isVisible(), true);
  assert.equal(await page.locator("#faq-answer-0").isVisible(), false);
  ok("Customer-story carousel and FAQ accordion");

  await page.getByRole("button", { name: "Book your free demo", exact: true }).click();
  await page.getByRole("button", { name: "Next: your details" }).click();
  assert.equal(await page.getByText("Please choose a service.", { exact: true }).count(), 1);
  await page.getByLabel("What can we help you with?").selectOption("residential");
  await page.getByLabel("Property ZIP code", { exact: true }).fill("28801");
  const preferredDate = await page.getByLabel("Your preferred date").getAttribute("min");
  await page.getByLabel("Your preferred date").fill(preferredDate);
  await page.getByLabel("Best time to connect").selectOption("morning");
  await page.getByRole("button", { name: "Next: your details" }).click();
  await page.getByRole("button", { name: "Request my free demo" }).click();
  assert.equal(await page.getByText("Enter a valid email address.", { exact: true }).count(), 1);
  await page.getByLabel("Full name", { exact: true }).fill("Alex Demo");
  await page.getByLabel("Email address", { exact: true }).fill(`aquifer-smoke-${Date.now()}@example.com`);
  await page.getByLabel("Phone number", { exact: true }).fill("(919) 555-0142");
  await page.getByLabel(/Anything else we should know/).fill("Automated demonstration request. No real customer or appointment.");
  await page.getByRole("checkbox").check();
  await page.screenshot({ path: "artifacts/aquifer-booking.png" });
  const requestPromise = page.waitForRequest((request) => request.url().includes("/api/bookings") && request.method() === "POST");
  await page.getByRole("button", { name: "Request my free demo" }).click();
  const sentRequest = await requestPromise;
  await page.getByRole("heading", { name: "You’re on your way." }).waitFor({ timeout: 15000 });
  const reference = await page.locator(".reference").innerText();
  assert.match(reference, /^AQ-[A-F0-9]{8}$/);
  await page.screenshot({ path: "artifacts/aquifer-confirmation.png" });
  ok(`Database-backed booking saved with reference ${reference}`);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download your request summary" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), `Aquifer-${reference}.txt`);
  ok("Downloadable booking request summary");

  const payload = sentRequest.postDataJSON();
  const duplicate = await page.request.post("/api/bookings", { data: payload });
  assert.equal(duplicate.status(), 200);
  assert.equal((await duplicate.json()).reference, reference);
  const invalid = await page.request.post("/api/bookings", { data: { ...payload, requestId: crypto.randomUUID(), email: "invalid", consent: false } });
  assert.equal(invalid.status(), 422);
  const invalidData = await invalid.json();
  assert.ok(invalidData.errors.email);
  assert.ok(invalidData.errors.consent);
  const crossOrigin = await page.request.post("/api/bookings", { headers: { Origin: "https://outside.example" }, data: payload });
  assert.equal(crossOrigin.status(), 403);
  const malformed = await page.request.post("/api/bookings", { headers: { "Content-Type": "application/json" }, data: "{bad" });
  assert.equal(malformed.status(), 400);
  ok("API validation, origin protection, and idempotent submission");
  await page.getByRole("button", { name: "Back to exploring" }).click();

  for (const width of [1440, 1024, 768, 760, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(100);
    const size = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    assert.ok(size.content <= size.viewport, `Horizontal overflow at ${width}px: ${size.content}`);
  }
  ok("No horizontal overflow at seven desktop, tablet, and phone widths");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "artifacts/aquifer-mobile.png" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  assert.equal(await page.locator("#mobile-navigation").isVisible(), true);
  await page.locator("#mobile-navigation").getByRole("link", { name: "How it works" }).click();
  assert.equal(await page.locator("#mobile-navigation").count(), 0);
  await page.getByRole("button", { name: "Free demo", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.screenshot({ path: "artifacts/aquifer-mobile-booking.png" });
  await page.keyboard.press("Escape");
  ok("Mobile navigation, anchor selection, and booking dialog");

  await page.getByRole("button", { name: "Privacy policy", exact: true }).click();
  assert.equal(await page.getByRole("heading", { name: "Your privacy matters." }).count(), 1);
  await page.getByRole("button", { name: "Got it" }).click();
  assert.deepEqual(errors, [], `Client errors: ${errors.join(", ")}`);
  const health = await page.request.get("/api/health");
  assert.equal(health.status(), 200);
  ok("Privacy dialog, zero client errors, and healthy PostgreSQL connection");
  console.log(`\n${results.length} smoke checks passed.`);
} finally {
  await browser.close();
}
