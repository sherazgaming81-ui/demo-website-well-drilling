/**
 * Regenerates public/og.jpg — the card that appears when someone pastes the link
 * into WhatsApp, iMessage or X.
 *
 * The words are not retyped by hand: they are read out of src/lib/site-data.ts, the
 * same file the pages and the assistant are built from, so the share image cannot go
 * on quoting a tagline the site has since changed. The card is laid out at 2x in
 * Chromium and screenshotted back down to 1200x630 (scale: "css"), which is why the
 * type stays crisp with no image library in the dependencies.
 *
 *   node scripts/make-og.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const data = readFileSync(path.join(root, "src/lib/site-data.ts"), "utf8");

/** Reads `key: "value"` (or a template literal) out of the site-data source. */
function field(name) {
  const match = data.match(new RegExp(`\\b${name}:\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|\`([^\`]*)\`)`));
  if (!match) throw new Error(`site-data.ts: could not read "${name}"`);
  return (match[1] ?? match[2]).replace(/\\"/g, '"');
}

const values = {
  name: field("name"),
  tagline: field("tagline"),
  headline: field("headline"),
  phone: field("phoneDisplay"),
  city: field("city"),
  inspection: field("inspectionLine"),
};
for (const [key, value] of Object.entries(values)) console.log(`  ${key.padEnd(11)} ${value}`);

// "Cold air, on the day you called." -> the last clause gets the frost colour.
const clauses = values.headline.replace(/[.]$/, "").split(/,\s*/);
const headlineHtml = clauses
  .map((clause, index) => (index === clauses.length - 1 ? `<em>${clause}.</em>` : `${clause}<br />`))
  .join("");

const file = (rel) => `file://${path.join(root, rel)}`;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><style>
  @font-face { font-family: "Freeze Display"; src: url("${file("public/fonts/freeze-display.woff2")}") format("woff2"); font-weight: 200 800; }
  @font-face { font-family: "Freeze Body"; src: url("${file("public/fonts/freeze-body.woff2")}") format("woff2"); font-weight: 200 800; }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    font-family: "Freeze Body", Arial, sans-serif; color: #eaf6ff; position: relative;
    background:
      radial-gradient(900px 620px at 78% -10%, #1d7fb0 0%, transparent 62%),
      radial-gradient(700px 520px at 4% 108%, #12506f 0%, transparent 60%),
      linear-gradient(158deg, #0a2536 0%, #0d3a54 46%, #0f5c85 100%);
  }
  .lines { position: absolute; inset: 0; background-image: linear-gradient(#ffffff0a 1px, transparent 1px); background-size: 100% 42px; }
  .rings { position: absolute; right: 280px; top: -150px; opacity: .15; color: #79dbf5; }
  .wrap { position: relative; display: grid; grid-template-columns: 1fr 452px; height: 100%; }
  .copy { padding: 56px 46px 50px 62px; display: flex; flex-direction: column; }
  .plaque { height: 74px; width: auto; border-radius: 12px; filter: drop-shadow(0 10px 26px #02141e66); }
  .kicker { margin-top: 32px; font-size: 13px; font-weight: 700; letter-spacing: 3.6px; color: #79dbf5; }
  h1 { margin-top: 12px; font-family: "Freeze Display", sans-serif; font-weight: 620; font-size: 60px; line-height: 1.06; letter-spacing: -2.6px; color: #fff; }
  h1 em { font-style: normal; color: #79dbf5; }
  .sub { margin-top: 18px; font-size: 19px; line-height: 1.6; color: #b9d9e9; max-width: 560px; }
  .chips { margin-top: auto; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .chip { font-size: 14px; font-weight: 600; padding: 9px 15px; border-radius: 100px; background: #ffffff14; border: 1px solid #ffffff26; color: #dff2ff; white-space: nowrap; }
  .chip.phone { background: #f5f9fc; border-color: #f5f9fc; color: #0a2536; font-weight: 700; }
  .photo { position: relative; }
  .photo img { width: 100%; height: 100%; object-fit: cover; object-position: 52% 42%; }
  .photo::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, #0a2536 0%, #0a253622 26%, transparent 58%), linear-gradient(0deg, #06222f88, transparent 46%); }
  .badge { position: absolute; z-index: 2; left: 42px; top: 52px; display: inline-flex; align-items: center; gap: 9px; background: #f5f9fcf2; color: #0d2231; font-size: 13px; font-weight: 700; letter-spacing: 1.6px; padding: 11px 16px; border-radius: 100px; }
  .badge i { width: 8px; height: 8px; border-radius: 50%; background: #17a67a; display: block; }
  .fine { position: absolute; z-index: 2; right: 26px; bottom: 20px; font-size: 12.5px; color: #cfe6f2b3; }
</style></head><body>
  <div class="lines"></div>
  <svg class="rings" width="620" height="620" viewBox="0 0 640 520" fill="none">
    <g transform="translate(320 260) rotate(-18)" stroke="currentColor" stroke-width="0.9">
      <ellipse rx="90" ry="62"/><ellipse rx="132" ry="94"/><ellipse rx="176" ry="126"/>
      <ellipse rx="220" ry="158"/><ellipse rx="266" ry="192"/><ellipse rx="312" ry="228"/>
    </g>
  </svg>
  <div class="wrap">
    <div class="copy">
      <img class="plaque" src="${file("public/logo.webp")}" alt="" />
      <p class="kicker">${values.tagline.toUpperCase()} · ${values.city.toUpperCase()}</p>
      <h1>${headlineHtml}</h1>
      <p class="sub">${values.inspection}</p>
      <div class="chips">
        <span class="chip">Same-day visit before 4 pm</span>
        <span class="chip">90-day workmanship warranty</span>
        <span class="chip phone">${values.phone}</span>
      </div>
    </div>
    <div class="photo">
      <span class="badge"><i></i>SAME-DAY IN ${values.city.toUpperCase()}</span>
      <img src="${file("public/images/hero.jpg")}" alt="" />
      <p class="fine">Demonstration website — illustrative brand</p>
    </div>
  </div>
</body></html>`;

// The card is written to disk and opened as a file:// page, not setContent'd: a
// setContent document has no origin of its own, and Chromium then refuses the
// file:// fonts and photos it references. Silent fallbacks are the last thing a
// brand card should ship with, so both are asserted below instead of hoped for.
const scratch = path.join(root, "artifacts/og-card.html");
await mkdir(path.dirname(scratch), { recursive: true });
await writeFile(scratch, html);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto(`file://${scratch}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const loaded = await page.evaluate(async () => {
  await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; }))));
  return {
    displayFont: document.fonts.check('700 40px "Freeze Display"'),
    bodyFont: document.fonts.check('400 20px "Freeze Body"'),
    images: Array.from(document.images).map((img) => `${img.src.split("/").pop()}:${img.naturalWidth}x${img.naturalHeight}`),
  };
});
if (!loaded.displayFont || !loaded.bodyFont) throw new Error(`web fonts did not load: ${JSON.stringify(loaded)}`);
if (loaded.images.some((entry) => entry.endsWith(":0x0"))) throw new Error(`an image failed to load: ${loaded.images.join(" ")}`);
console.log(`  assets      ${[loaded.displayFont && "Freeze Display", loaded.bodyFont && "Freeze Body", ...loaded.images].filter(Boolean).join(", ")}`);
const overflow = await page.evaluate(() => {
  const copy = document.querySelector(".copy");
  return { scrollH: copy.scrollHeight, clientH: copy.clientHeight, h1: document.querySelector("h1").getBoundingClientRect().height };
});
if (overflow.scrollH > overflow.clientH + 1) console.log(`note: copy column overflows by ${overflow.scrollH - overflow.clientH}px`);
await page.screenshot({ path: path.join(root, "public/og.jpg"), type: "jpeg", quality: 89, scale: "css", clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log(`wrote public/og.jpg (1200x630, h1 ${Math.round(overflow.h1)}px tall)`);
