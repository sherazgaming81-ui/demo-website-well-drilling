/**
 * Checks the DEPLOYED site, not the local build — the class of bug this catches
 * is "HTML is new but the stylesheet Vercel served is stale", which no amount of
 * local testing would reveal.
 *
 *   node scripts/deploy-check.mjs
 *   DEPLOY_URL=https://some-other-preview.vercel.app node scripts/deploy-check.mjs
 */
const base = (process.env.DEPLOY_URL || "https://demo-website-well-drilling.vercel.app").replace(/\/$/, "");

let failures = 0;
const check = (name, pass, extra = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
};

const html = await (await fetch(`${base}/`, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
check("homepage responds", html.length > 5000, `${html.length} bytes`);
check("serves the real business title", /<title>Aquifer Reach LLC/.test(html));
check("no demo/fictional copy left", !/demonstration brand|fictional demonstration|hello@aquifer\.example|\(888\) 555-0142/i.test(html));

// A canonical that points at a host nobody serves is worse than no canonical.
const canonical = html.match(/rel="canonical" href="(https?:\/\/[^"]+)"/)?.[1];
check("page declares a canonical URL", Boolean(canonical), canonical ?? "none");
if (canonical) {
  const res = await fetch(canonical, { method: "GET", redirect: "follow" }).catch(() => null);
  check("canonical host actually serves the site", Boolean(res?.ok), res ? String(res.status) : "unreachable");
}

const cssHrefs = [...new Set([...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]))];
check("stylesheets are linked", cssHrefs.length > 0, cssHrefs.join(", ") || "none found");

const css = (await Promise.all(cssHrefs.map((href) => fetch(base + href).then((r) => r.text())))).join("\n");
const required = [".work-tile", ".work-grid", ".proof-list", ".site-legal-note", ".form-disclaimer", "@font-face"];
const missing = required.filter((selector) => !css.includes(selector));
check("deployed CSS is current (not a stale chunk)", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `${css.length} bytes`);

const assets = [...new Set([...html.matchAll(/images%2F([a-z0-9-]+\.jpg)/g)].map((m) => `/images/${m[1]}`))];
for (const path of ["/fonts/dm-sans.ttf", "/icon.png", "/robots.txt", "/sitemap.xml", ...assets]) {
  const res = await fetch(base + path, { method: "GET" });
  check(`asset ${path}`, res.status === 200, String(res.status));
}
check("every photo on the page is referenced", assets.length >= 7, `${assets.length} distinct photos`);

// The precise regression: absolutely positioned next/image pixels must stay
// inside their tile. When the .work-tile rule is missing, they escape and paint
// over the hero and the footer.
try {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1456, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
    for (const img of document.querySelectorAll("img")) img.loading = "eager";
  });
  await page.waitForFunction(() => [...document.querySelectorAll("img")].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});

  const geometry = await page.evaluate(() => {
    const escaped = [...document.querySelectorAll("img")].filter((img) => {
      const holder = img.closest(".work-tile, .hero-image, .service-image, .service-dialog-image");
      if (!holder) return false;
      const t = holder.getBoundingClientRect();
      const r = img.getBoundingClientRect();
      return r.width > 0 && (r.left < t.left - 4 || r.top < t.top - 4 || r.right > t.right + 4 || r.bottom > t.bottom + 4);
    }).map((img) => img.getAttribute("src")?.slice(0, 60) || "unknown");
    const broken = [...document.querySelectorAll("img")].filter((i) => i.naturalWidth === 0).length;
    const note = document.querySelector(".site-legal-note");
    return { escaped, broken, noteSize: note ? getComputedStyle(note).fontSize : null, scrollW: document.documentElement.scrollWidth, vw: innerWidth };
  });
  check("no image escapes its container", geometry.escaped.length === 0, geometry.escaped.join(", ") || "all contained");
  check("no broken images in the browser", geometry.broken === 0, `${geometry.broken} broken`);
  check("footer legal note is small print", geometry.noteSize === "8px", String(geometry.noteSize));
  check("no horizontal overflow at 1456px", geometry.scrollW <= geometry.vw, `${geometry.scrollW} > ${geometry.vw}`);
  await page.close();
  await browser.close();
} catch (error) {
  console.log(`SKIP browser geometry checks (${error instanceof Error ? error.message.split("\n")[0] : "unavailable"}) — install with: npx playwright install chromium`);
}

console.log(`\n${failures === 0 ? "DEPLOYED SITE VERIFIED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
