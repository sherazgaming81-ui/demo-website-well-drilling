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
check("serves the real business title", /<title>Freeze Point AC Care/.test(html));
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
// Icons are read from the document, not hardcoded: Next names them from the files in
// src/app (icon.svg today, icon.png before), and a check pinned to a stale name cries
// wolf. Whatever the page asks for must answer 200.
const icons = [...new Set([...html.matchAll(/<link[^>]+href="(\/[^"]*(?:icon|apple-icon)[^"]*\.(?:svg|png|ico))"/g)].map((m) => m[1]))];
check("page links at least one icon", icons.length > 0, icons.join(", ") || "none");
const fonts = [...new Set([...css.matchAll(/url\(([^)]*\/fonts\/[^)]+)\)/g)].map((m) => m[1].replace(/["']/g, "")))];
check("stylesheet references the self-hosted fonts", fonts.length >= 2, fonts.join(", ") || "none found");
const manifestHref = html.match(/rel="manifest" href="([^"]+)"/)?.[1];
check("page links a web app manifest", Boolean(manifestHref), manifestHref ?? "no link rel=manifest");
for (const path of [...fonts, ...icons, manifestHref, "/robots.txt", "/sitemap.xml", ...assets].filter(Boolean)) {
  const res = await fetch(base + path, { method: "GET" });
  check(`asset ${path}`, res.status === 200, String(res.status));
}
// The area pages are generated from src/lib/site-data.ts, so the deploy is the
// moment they either exist or do not: each URL must answer, carry its own title,
// and keep the share image a page-level openGraph block can so easily drop.
for (const [href, needle] of [["/areas", "Six parts of"], ["/areas/clifton", "AC repair in Clifton"], ["/areas/malir", "AC repair in Malir"]]) {
  const res = await fetch(base + href);
  const body = await res.text();
  const hasOg = /property="og:image" content="[^"]*\/og\.jpg"/.test(body);
  check(`deployed page ${href}`, res.status === 200 && body.includes(needle) && hasOg, `${res.status}, "${needle}" ${body.includes(needle) ? "found" : "missing"}, og:image ${hasOg ? "set" : "MISSING"}`);
}
const missingPage = await fetch(`${base}/areas/a-place-that-does-not-exist`);
check("unknown area page 404s", missingPage.status === 404, String(missingPage.status));

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
    // An image that is deliberately offset inside a clipping frame is not escaping
    // it — parallax translates the <img> by up to 16px while the holder clips it.
    // What would be a bug: a holder that no longer clips, or an image that no
    // longer covers the frame (letterboxing). Both are checked explicitly.
    const escaped = [...document.querySelectorAll("img")]
      .filter((img) => {
        const holder = img.closest(".work-tile, .hero-image, .service-image, .service-dialog-image");
        if (!holder) return false;
        const cs = getComputedStyle(holder);
        const t = holder.getBoundingClientRect();
        const r = img.getBoundingClientRect();
        if (r.width === 0) return false;
        if (cs.overflow !== "hidden" && cs.overflow !== "clip") return true;
        const slack = Math.abs(parseFloat(getComputedStyle(img).getPropertyValue("--pa") || "0")) + 6;
        const covers = r.width >= t.width - 1 && r.height >= t.height - 1;
        const inside =
          r.left >= t.left - slack && r.top >= t.top - slack &&
          r.right <= t.right + slack && r.bottom <= t.bottom + slack;
        return !(covers && inside);
      })
      .map((img) => img.getAttribute("src")?.split("url=")[1]?.slice(0, 40) || "unknown");
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
